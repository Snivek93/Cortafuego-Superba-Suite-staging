// ============================================================================
// firestore-sync.js — Fase 3: proyectos compartidos entre usuarios de la
// organización, con candado de edición y detección de conflicto offline.
// ============================================================================
// Alcance de esta entrega: sincroniza el payload JSON del proyecto (filas,
// config, projectInfo — el mismo que ya arma datosProyectoActual()). Las
// fotos/planos viajan aparte por Firebase Storage (ver
// firestore-storage-sync.js) — este archivo solo guarda y lee el mapa
// liviano {key: url} en el campo imagenesUrls del documento.
//
// IndexedDB sigue siendo la única fuente de verdad para USO NORMAL de la
// app (arranque, edición del día a día). Firestore es:
//   (a) el lugar donde vive quién tiene acceso a qué proyecto y quién tiene
//       el candado de edición ahora mismo, y
//   (b) un respaldo remoto del payload que permite detectar — no resolver
//       en automático — cuando dos dispositivos editaron el mismo proyecto
//       sin verse entre sí (típicamente por estar ambos sin señal a la vez).
//
// Requiere firebase-firestore-compat.js cargado en index.html (junto a
// firebase-app-compat.js y firebase-auth-compat.js, ya presentes) y que
// firebase-auth.js haya corrido antes (usa el mismo firebase.initializeApp).
//
// Documentos Firestore:
//   proyectos/{proyectoId}
//     ownerId, ownerEmail, nombre
//     editoresUids: [uid, ...]        // quién puede pedir el candado además del owner
//     candado: { uid, nombre, desde } | null
//     versionSync: number             // sube 1 en cada fsSubirCambios exitoso
//     payloadJson: string             // datosProyectoActual() sin imágenes, como JSON
//     imagenesUrls: { key: url }      // fotos/planos subidos a Storage (opcional)
//     actualizadoEn: timestamp servidor
//   invitaciones/{emailSanitizado}
//     pendientes: [{ proyectoId, nombre, rol, invitadoPor }]
// ============================================================================
(function () {

// Mismo criterio de "quedó inactivo" en ambos lados (UI y lógica): si el
// candado tiene más de este tiempo sin renovarse, cualquiera puede tomarlo
// aunque figure ocupado — evita que una pestaña cerrada de golpe (batería,
// crash) deje el proyecto bloqueado para siempre.
const CANDADO_TIMEOUT_MS = 5 * 60 * 1000;

let _db = null;
function db() {
  if (!_db) _db = firebase.firestore();
  return _db;
}

function sanitizarEmailComoId(email) {
  // Firestore no permite "/" en IDs de documento; el resto de caracteres de
  // un correo son válidos, pero por prolijidad se pasa todo a minúsculas y
  // se cambia "@"/"." por algo legible al inspeccionar la consola de Firebase.
  return String(email).trim().toLowerCase().replace(/[/]/g, "_");
}

// ---------------------------------------------------------------------------
// Metadata del proyecto — crear/asegurar que exista antes de compartir
// ---------------------------------------------------------------------------
async function fsAsegurarProyecto(proyectoId, { nombre, ownerId, ownerEmail }) {
  const ref = db().collection("proyectos").doc(proyectoId);
  const snap = await ref.get();
  if (snap.exists) {
    // Ya existe (ej. otro dispositivo del mismo owner lo creó primero) —
    // solo refresca el nombre para que las listas de "compartido conmigo"
    // no queden con un nombre viejo.
    await ref.update({ nombre: nombre || "" });
    return;
  }
  await ref.set({
    ownerId,
    ownerEmail: ownerEmail || "",
    nombre: nombre || "",
    editoresUids: [],
    candado: null,
    versionSync: 0,
    payloadJson: null,
    actualizadoEn: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

// ---------------------------------------------------------------------------
// Compartir — siempre pasa por 'invitaciones', exista o no la cuenta del
// destinatario todavía. Uniforme: no hace falta buscar si el email ya tiene
// cuenta creada.
// ---------------------------------------------------------------------------
async function fsCompartirProyecto(proyectoId, nombreProyecto, email, rol, invitadoPorEmail) {
  const emailId = sanitizarEmailComoId(email);
  const ref = db().collection("invitaciones").doc(emailId);
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const pendientes = snap.exists ? (snap.data().pendientes || []) : [];
    const yaEstaba = pendientes.some((p) => p.proyectoId === proyectoId);
    if (yaEstaba) return; // idempotente: compartir dos veces no duplica
    pendientes.push({ proyectoId, nombre: nombreProyecto || "", rol: rol || "editor", invitadoPor: invitadoPorEmail || "" });
    tx.set(ref, { pendientes }, { merge: true });
  });
}

// Se corre una vez por sesión, apenas hay usuario autenticado y verificado
// (después de esperarAutenticacion()). Mueve cualquier invitación pendiente
// de este email a editoresUids del proyecto correspondiente, y limpia la
// invitación ya resuelta.
async function fsResolverInvitacionesPendientes(uid, email) {
  const emailId = sanitizarEmailComoId(email);
  const ref = db().collection("invitaciones").doc(emailId);
  const snap = await ref.get();
  if (!snap.exists) return [];
  const pendientes = snap.data().pendientes || [];
  if (pendientes.length === 0) return [];

  const resueltas = [];
  for (const inv of pendientes) {
    try {
      await db().collection("proyectos").doc(inv.proyectoId).update({
        editoresUids: firebase.firestore.FieldValue.arrayUnion(uid),
      });
      resueltas.push(inv);
    } catch (e) {
      // Si el proyecto ya no existe o el update falla, esa invitación en
      // particular se deja pendiente (no se borra) para reintentar en el
      // próximo login — mejor eso que perderla en silencio.
      console.error("No se pudo resolver invitación a", inv.proyectoId, e);
    }
  }
  if (resueltas.length > 0) {
    await ref.update({
      pendientes: firebase.firestore.FieldValue.arrayRemove(...resueltas),
    });
  }
  return resueltas;
}

async function fsQuitarAcceso(proyectoId, uid) {
  await db().collection("proyectos").doc(proyectoId).update({
    editoresUids: firebase.firestore.FieldValue.arrayRemove(uid),
  });
}

// Proyectos donde el usuario actual es editor invitado (no owner) — para
// mostrarlos en la Pantalla de Proyectos junto a los propios.
async function fsListarProyectosCompartidosConmigo(uid) {
  const q = await db().collection("proyectos").where("editoresUids", "array-contains", uid).get();
  return q.docs.map((d) => Object.assign({ id: d.id }, d.data()));
}

// Proyectos donde el usuario actual es el DUEÑO. Como fsAsegurarProyecto solo
// se llama al compartir, el documento en Firestore existe únicamente para los
// proyectos que ya se compartieron con alguien — así que esto devuelve
// exactamente "mis proyectos compartidos", sin traer los privados.
//
// Hace falta aparte de fsListarProyectosCompartidosConmigo porque el owner NO
// está en editoresUids (fsAsegurarProyecto lo crea vacío), y sin esto el dueño
// nunca vería el candado de la persona a la que le compartió el proyecto —
// que es justo el caso de uso principal del badge.
//
// NO materializa nada en IndexedDB: estos proyectos ya son locales por
// definición (los creó este usuario). Solo se usa para leer metadata remota.
async function fsListarMisProyectosCompartidos(uid) {
  const q = await db().collection("proyectos").where("ownerId", "==", uid).get();
  return q.docs.map((d) => Object.assign({ id: d.id }, d.data()));
}

// ---------------------------------------------------------------------------
// Candado de edición
// ---------------------------------------------------------------------------
function candadoEstaVencido(candado) {
  if (!candado || !candado.desde) return true;
  // candado.desde puede venir como Firestore Timestamp (tiene .toMillis) o
  // ya convertido a número/Date según de dónde se leyó.
  const ms = typeof candado.desde.toMillis === "function" ? candado.desde.toMillis() : new Date(candado.desde).getTime();
  return (Date.now() - ms) > CANDADO_TIMEOUT_MS;
}

// Devuelve { ok: true } si se tomó, o { ok: false, ocupadoPor: nombre } si
// alguien más lo tiene y no venció.
async function fsTomarCandado(proyectoId, uid, nombre) {
  const ref = db().collection("proyectos").doc(proyectoId);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { ok: false, ocupadoPor: null };
    const candado = snap.data().candado;
    const libre = !candado || candado.uid === uid || candadoEstaVencido(candado);
    if (!libre) return { ok: false, ocupadoPor: candado.nombre || "otra persona" };
    tx.update(ref, {
      candado: { uid, nombre: nombre || "", desde: firebase.firestore.FieldValue.serverTimestamp() },
    });
    return { ok: true };
  });
}

async function fsSoltarCandado(proyectoId, uid) {
  const ref = db().collection("proyectos").doc(proyectoId);
  // Transacción por seguridad: si otro dispositivo ya tomó el candado
  // mientras tanto (ej. el timeout venció y alguien más entró), este
  // dispositivo no debe borrárselo por error.
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const candado = snap.data().candado;
    if (candado && candado.uid === uid) {
      tx.update(ref, { candado: null });
    }
  });
}

// Suscripción en vivo al estado del candado — para pintar el badge
// "Editando: Sebastián" / "Solo lectura" en la Pantalla de Proyectos sin
// tener que refrescar a mano.
function fsEscucharCandado(proyectoId, callback) {
  return db().collection("proyectos").doc(proyectoId).onSnapshot(
    (snap) => callback(snap.exists ? snap.data().candado : null),
    (err) => console.error("Error escuchando candado de", proyectoId, err)
  );
}

// Suscripción en vivo al documento COMPLETO — para que quien tiene el
// proyecto abierto (viéndolo, no necesariamente editándolo) vea los cambios
// de otra persona en segundos, sin tener que cerrar y volver a abrir. Un
// solo listener a la vez (el proyecto abierto), no uno por tarjeta de la
// lista — ver fsEscucharCandado arriba para el porqué de esa distinción.
// callback recibe (data, metadata); metadata.hasPendingWrites permite
// distinguir el eco optimista de una escritura propia (todavía no
// confirmada por el servidor) de un cambio que realmente vino de afuera.
function fsEscucharProyecto(proyectoId, callback) {
  return db().collection("proyectos").doc(proyectoId).onSnapshot(
    (snap) => { if (snap.exists) callback(snap.data(), snap.metadata); },
    (err) => console.error("Error escuchando proyecto", proyectoId, err)
  );
}

// ---------------------------------------------------------------------------
// Sync de contenido + detección de conflicto por versión
// ---------------------------------------------------------------------------
// payloadJson: el JSON de datosProyectoActual() SIN el campo de imágenes
// (ver firestore-storage-sync.js para el envío de fotos/planos aparte).
// versionEsperada: la versión que este dispositivo leyó la última vez que
// sincronizó (null si nunca sincronizó este proyecto en esta sesión/
// dispositivo). imagenesUrls (opcional): mapa {key: url} armado por
// fsSubirImagenesFaltantes en firestore-storage-sync.js.
//
// Devuelve:
//   { ok: true, version: N }                         — subió limpio
//   { ok: false, conflicto: true, versionRemota: N }  — alguien más subió
//     una versión distinta mientras este dispositivo no tenía esa versión
//     como base; el llamador decide qué hacer (ver pedirEleccion en
//     archivo-guardar-cargar.js, mismo patrón que "Abrir…" con id repetido).
async function fsSubirCambios(proyectoId, payloadJson, versionEsperada, imagenesUrls) {
  const ref = db().collection("proyectos").doc(proyectoId);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { ok: false, conflicto: false, error: "El proyecto no existe en Firestore." };
    const versionRemota = snap.data().versionSync || 0;
    if (versionEsperada !== null && versionEsperada !== undefined && versionRemota !== versionEsperada) {
      return { ok: false, conflicto: true, versionRemota };
    }
    const versionNueva = versionRemota + 1;
    const cambios = {
      payloadJson,
      versionSync: versionNueva,
      actualizadoEn: firebase.firestore.FieldValue.serverTimestamp(),
    };
    // imagenesUrls es opcional: solo se manda cuando hubo fotos que subir o
    // que ya estaban en caché (ver fsSubirImagenesFaltantes en
    // firestore-storage-sync.js). Si el proyecto no tiene fotos, se omite
    // el campo en vez de escribir un objeto vacío innecesariamente.
    //
    // MEZCLA, no reemplazo: si esta subida trae fotos nuevas pero ALGUNA
    // foto de una subida anterior falló y quedó pendiente (ver comentario
    // en fsSubirImagenesFaltantes), un reemplazo completo del campo la
    // desaparecería de Firestore aunque siga bien subida. Bug real
    // encontrado esta sesión: una foto que fallaba al subir dejaba el
    // informe con la foto en blanco para siempre, sin aviso.
    if (imagenesUrls && Object.keys(imagenesUrls).length > 0) {
      cambios.imagenesUrls = Object.assign({}, snap.data().imagenesUrls || {}, imagenesUrls);
    }
    tx.update(ref, cambios);
    return { ok: true, version: versionNueva };
  });
}

async function fsDescargarUltimaVersion(proyectoId) {
  const snap = await db().collection("proyectos").doc(proyectoId).get();
  if (!snap.exists) return null;
  const data = snap.data();
  return {
    payloadJson: data.payloadJson,
    version: data.versionSync || 0,
    imagenesUrls: data.imagenesUrls || {},
    // editoresUids/ownerId: para que quien llama pueda distinguir un
    // respaldo privado (nadie más en editoresUids) de un proyecto
    // realmente compartido — el candado y el listener en vivo solo tienen
    // sentido en el segundo caso (ver PROYECTO_ACTIVO_MULTI_EDITOR).
    editoresUids: data.editoresUids || [],
    ownerId: data.ownerId || null,
  };
}

window.fsAsegurarProyecto = fsAsegurarProyecto;
window.fsCompartirProyecto = fsCompartirProyecto;
window.fsResolverInvitacionesPendientes = fsResolverInvitacionesPendientes;
window.fsQuitarAcceso = fsQuitarAcceso;
window.fsListarProyectosCompartidosConmigo = fsListarProyectosCompartidosConmigo;
window.fsListarMisProyectosCompartidos = fsListarMisProyectosCompartidos;
window.fsTomarCandado = fsTomarCandado;
window.fsSoltarCandado = fsSoltarCandado;
window.fsEscucharCandado = fsEscucharCandado;
window.fsEscucharProyecto = fsEscucharProyecto;
window.fsSubirCambios = fsSubirCambios;
window.fsDescargarUltimaVersion = fsDescargarUltimaVersion;
// Exportado aparte para poder probar la lógica de vencimiento sin Firestore real.
window.candadoEstaVencido = candadoEstaVencido;

})();
