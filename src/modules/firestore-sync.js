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
// Documentos Firestore (esquema liviano/pesado — 03/09/2026):
//   proyectos/{proyectoId}                    ← LIVIANO, esto es lo que se
//                                                lee al LISTAR proyectos
//     ownerId, ownerEmail, nombre, cliente, fecha
//     espacioId: string | null        // null = "Propio" del owner (privado)
//     editoresUids: [uid, ...]        // quién puede pedir el candado además del owner
//     candado: { uid, nombre, desde } | null
//     versionSync: number             // sube 1 en cada fsSubirCambios exitoso
//     tieneContenido: boolean         // false hasta la primera subida real
//     actualizadoEn: timestamp servidor
//   proyectos/{proyectoId}/contenido/data     ← PESADO, solo se lee al ABRIR
//     payloadJson: string             // datosProyectoActual() sin imágenes, como JSON
//     imagenesUrls: { key: url }      // fotos/planos subidos a Storage (opcional)
//     versionSync: number             // copia de la del liviano, para que el
//                                        listener en vivo (fsEscucharProyecto)
//                                        tenga todo en un solo snapshot
//   invitaciones/{emailSanitizado}
//     pendientes: [{ proyectoId, nombre, rol, invitadoPor }]
//   espacios/{espacioId}
//     nombre, miembrosUids: [uid, ...], creadoPor, creadoEn
//   invitacionesEspacio/{emailSanitizado}
//     pendientes: [{ espacioId, nombreEspacio, invitadoPor }]
//     — la aceptación real (agregar el uid a miembrosUids) la hace la Cloud
//       Function aceptarInvitacionesEspacio (functions/index.js), no el
//       cliente: mismo problema huevo-y-gallina que editoresUids, resuelto
//       de raíz esta vez en vez de otro parche de reglas.
//
// MIGRACIÓN: los proyectos creados antes de esta partición (ej. Prueba 2,
// Demasa, UCR Golfito) tienen el contenido embebido directo en el documento
// liviano (payloadJson/imagenesUrls ahí mismo). Se detectan por tener el
// campo payloadJson presente, se leen igual sin romper nada, y se migran
// solos a la subcolección `contenido` la próxima vez que alguien guarda
// cambios sobre ellos (ver fsSubirCambios) — no hace falta correr nada a
// mano ni bloquear la apertura mientras tanto.
// ============================================================================
(function () {

const CANDADO_TIMEOUT_MS = 5 * 60 * 1000;

let _db = null;
function db() {
  if (!_db) _db = firebase.firestore();
  return _db;
}

function sanitizarEmailComoId(email) {
  return String(email).trim().toLowerCase().replace(/[/]/g, "_");
}

async function fsAsegurarProyecto(proyectoId, { nombre, cliente, fecha, ownerId, ownerEmail, espacioId }) {
  const ref = db().collection("proyectos").doc(proyectoId);
  const snap = await ref.get();
  if (snap.exists) {
    await ref.update({ nombre: nombre || "", cliente: cliente || "", fecha: fecha || "" });
    return;
  }
  await ref.set({
    ownerId,
    ownerEmail: ownerEmail || "",
    nombre: nombre || "",
    cliente: cliente || "",
    fecha: fecha || "",
    espacioId: espacioId !== undefined ? espacioId : null,
    editoresUids: [],
    candado: null,
    versionSync: 0,
    tieneContenido: false,
    actualizadoEn: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

async function fsCompartirProyecto(proyectoId, nombreProyecto, email, rol, invitadoPorEmail) {
  const emailId = sanitizarEmailComoId(email);
  const ref = db().collection("invitaciones").doc(emailId);
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const pendientes = snap.exists ? (snap.data().pendientes || []) : [];
    const yaEstaba = pendientes.some((p) => p.proyectoId === proyectoId);
    if (yaEstaba) return;
    pendientes.push({ proyectoId, nombre: nombreProyecto || "", rol: rol || "editor", invitadoPor: invitadoPorEmail || "" });
    tx.set(ref, { pendientes }, { merge: true });
  });
}

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

async function fsListarProyectosCompartidosConmigo(uid) {
  const q = await db().collection("proyectos").where("editoresUids", "array-contains", uid).get();
  return q.docs.map((d) => Object.assign({ id: d.id }, d.data()));
}

async function fsListarMisProyectosCompartidos(uid) {
  const q = await db().collection("proyectos").where("ownerId", "==", uid).get();
  return q.docs.map((d) => Object.assign({ id: d.id }, d.data()));
}

async function fsBorrarProyectoDeNube(proyectoId) {
  const ref = db().collection("proyectos").doc(proyectoId);
  try { await ref.collection("contenido").doc("data").delete(); } catch (e) {}
  await ref.delete();
}

async function fsCrearEspacio(nombre, uid) {
  const ref = await db().collection("espacios").add({
    nombre: nombre || "",
    miembrosUids: [uid],
    creadoPor: uid,
    creadoEn: firebase.firestore.FieldValue.serverTimestamp(),
  });
  return ref.id;
}

async function fsListarMisEspacios(uid) {
  const q = await db().collection("espacios").where("miembrosUids", "array-contains", uid).get();
  return q.docs.map((d) => Object.assign({ id: d.id }, d.data()));
}

async function fsListarProyectosDeEspacio(espacioId) {
  const q = await db().collection("proyectos").where("espacioId", "==", espacioId).get();
  return q.docs.map((d) => Object.assign({ id: d.id }, d.data()));
}

async function fsInvitarAEspacio(espacioId, nombreEspacio, email, invitadoPorEmail) {
  const emailId = sanitizarEmailComoId(email);
  const ref = db().collection("invitacionesEspacio").doc(emailId);
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const pendientes = snap.exists ? (snap.data().pendientes || []) : [];
    const yaEstaba = pendientes.some((p) => p.espacioId === espacioId);
    if (yaEstaba) return;
    pendientes.push({ espacioId, nombreEspacio: nombreEspacio || "", invitadoPor: invitadoPorEmail || "" });
    tx.set(ref, { pendientes }, { merge: true });
  });
}

async function fsAceptarInvitacionesEspacio() {
  if (!firebase.functions) {
    console.error("firebase-functions-compat.js no está cargado — no se pueden aceptar invitaciones a espacios.");
    return [];
  }
  const llamar = firebase.functions().httpsCallable("aceptarInvitacionesEspacio");
  const r = await llamar();
  return (r && r.data && r.data.aceptadas) || [];
}

async function fsListarInvitacionesPendientes(email) {
  if (!email) return [];
  const emailId = sanitizarEmailComoId(email);
  const snap = await db().collection("invitacionesEspacio").doc(emailId).get();
  if (!snap.exists) return [];
  return snap.data().pendientes || [];
}

// Renombra un espacio — cualquier miembro puede (mismo criterio simple que
// el resto de Espacios de Trabajo hoy; si hace falta restringir a
// creadoPor más adelante, se ajusta en las reglas de Firestore).
async function fsRenombrarEspacio(espacioId, nuevoNombre) {
  await db().collection("espacios").doc(espacioId).update({ nombre: nuevoNombre || "" });
}

// Borra el espacio y limpia el espacioId de todos sus proyectos (vuelven a
// "Propio" del dueño de cada uno, no se borran ni se mueven de dueño).
// Solo debería poder llamarlo el creador — la reglas de Firestore son la
// protección real (allow delete: if creadoPor == request.auth.uid), esto
// asume que ya están así; si no, avisar a Kevin de actualizarlas.
async function fsBorrarEspacio(espacioId) {
  const q = await db().collection("proyectos").where("espacioId", "==", espacioId).get();
  for (const d of q.docs) {
    try { await db().collection("proyectos").doc(d.id).update({ espacioId: null }); } catch (e) {
      console.error("No se pudo desvincular el proyecto", d.id, "del espacio borrado", e);
    }
  }
  await db().collection("espacios").doc(espacioId).delete();
}

// Un miembro se saca a sí mismo de un espacio (no es lo mismo que borrarlo:
// el espacio y sus proyectos siguen existiendo para el resto).
async function fsSalirDeEspacio(espacioId, uid) {
  await db().collection("espacios").doc(espacioId).update({
    miembrosUids: firebase.firestore.FieldValue.arrayRemove(uid),
  });
}

async function fsMoverProyectoDeEspacio(proyectoId, nuevoEspacioId) {
  const ref = db().collection("proyectos").doc(proyectoId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("El proyecto no existe en la nube todavía.");
  const data = snap.data();
  if (data.candado && data.candado.uid && !candadoEstaVencido(data.candado)) {
    throw new Error("No se puede mover: " + (data.candado.nombre || "otra persona") + " lo tiene abierto ahora mismo.");
  }
  await ref.update({ espacioId: nuevoEspacioId || null });
}

function candadoEstaVencido(candado) {
  if (!candado || !candado.desde) return true;
  const ms = typeof candado.desde.toMillis === "function" ? candado.desde.toMillis() : new Date(candado.desde).getTime();
  return (Date.now() - ms) > CANDADO_TIMEOUT_MS;
}

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
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const candado = snap.data().candado;
    if (candado && candado.uid === uid) {
      tx.update(ref, { candado: null });
    }
  });
}

function fsEscucharCandado(proyectoId, callback) {
  return db().collection("proyectos").doc(proyectoId).onSnapshot(
    (snap) => callback(snap.exists ? snap.data().candado : null),
    (err) => console.error("Error escuchando candado de", proyectoId, err)
  );
}

function fsEscucharProyecto(proyectoId, callback) {
  const ref = db().collection("proyectos").doc(proyectoId);
  const contRef = ref.collection("contenido").doc("data");
  let unsub = null;
  let cancelado = false;
  ref.get().then((snap) => {
    if (cancelado) return;
    const esquemaViejo = snap.exists && Object.prototype.hasOwnProperty.call(snap.data(), "payloadJson");
    const objetivo = esquemaViejo ? ref : contRef;
    unsub = objetivo.onSnapshot(
      (s) => { if (s.exists) callback(s.data(), s.metadata); },
      (err) => console.error("Error escuchando proyecto", proyectoId, err)
    );
  }).catch((err) => console.error("No se pudo determinar el esquema para escuchar", proyectoId, err));
  return () => { cancelado = true; if (unsub) unsub(); };
}

async function fsSubirCambios(proyectoId, payloadJson, versionEsperada, imagenesUrls) {
  const ref = db().collection("proyectos").doc(proyectoId);
  const contRef = ref.collection("contenido").doc("data");
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { ok: false, conflicto: false, error: "El proyecto no existe en Firestore." };
    const data = snap.data();
    const contSnap = await tx.get(contRef);
    const versionRemota = data.versionSync || 0;
    if (versionEsperada !== null && versionEsperada !== undefined && versionRemota !== versionEsperada) {
      return { ok: false, conflicto: true, versionRemota };
    }
    const versionNueva = versionRemota + 1;
    const urlsPrevias = contSnap.exists ? (contSnap.data().imagenesUrls || {}) : (data.imagenesUrls || {});
    const urlsFinal = (imagenesUrls && Object.keys(imagenesUrls).length > 0)
      ? Object.assign({}, urlsPrevias, imagenesUrls)
      : urlsPrevias;
    tx.set(contRef, { payloadJson, versionSync: versionNueva, imagenesUrls: urlsFinal });
    tx.update(ref, {
      versionSync: versionNueva,
      tieneContenido: true,
      actualizadoEn: firebase.firestore.FieldValue.serverTimestamp(),
      payloadJson: firebase.firestore.FieldValue.delete(),
      imagenesUrls: firebase.firestore.FieldValue.delete(),
    });
    return { ok: true, version: versionNueva };
  });
}

async function fsDescargarUltimaVersion(proyectoId) {
  const ref = db().collection("proyectos").doc(proyectoId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data();
  let payloadJson = null, imagenesUrls = {};
  if (Object.prototype.hasOwnProperty.call(data, "payloadJson")) {
    payloadJson = data.payloadJson || null;
    imagenesUrls = data.imagenesUrls || {};
  } else if (data.tieneContenido) {
    const contSnap = await ref.collection("contenido").doc("data").get();
    if (contSnap.exists) {
      payloadJson = contSnap.data().payloadJson || null;
      imagenesUrls = contSnap.data().imagenesUrls || {};
    }
  }
  return {
    payloadJson,
    version: data.versionSync || 0,
    imagenesUrls,
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
window.fsBorrarProyectoDeNube = fsBorrarProyectoDeNube;
window.fsCrearEspacio = fsCrearEspacio;
window.fsListarMisEspacios = fsListarMisEspacios;
window.fsListarProyectosDeEspacio = fsListarProyectosDeEspacio;
window.fsInvitarAEspacio = fsInvitarAEspacio;
window.fsAceptarInvitacionesEspacio = fsAceptarInvitacionesEspacio;
window.fsListarInvitacionesPendientes = fsListarInvitacionesPendientes;
window.fsMoverProyectoDeEspacio = fsMoverProyectoDeEspacio;
window.fsRenombrarEspacio = fsRenombrarEspacio;
window.fsBorrarEspacio = fsBorrarEspacio;
window.fsSalirDeEspacio = fsSalirDeEspacio;
window.fsTomarCandado = fsTomarCandado;
window.fsSoltarCandado = fsSoltarCandado;
window.fsEscucharCandado = fsEscucharCandado;
window.fsEscucharProyecto = fsEscucharProyecto;
window.fsSubirCambios = fsSubirCambios;
window.fsDescargarUltimaVersion = fsDescargarUltimaVersion;
window.candadoEstaVencido = candadoEstaVencido;

})();
