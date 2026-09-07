// ============================================================================
// functions/index.js — Cloud Functions de Firestop Suite (Superba)
// ============================================================================
// Resuelve el problema huevo-y-gallina de invitar gente a un Espacio de
// Trabajo: para entrar a `miembrosUids` de un espacio hacía falta ya estar
// en `miembrosUids` (las reglas de Firestore no dejan que alguien se
// agregue a un array que no controla). Con Admin SDK esta función bypassea
// las reglas de seguridad, así que valida a mano todo lo que haría falta.
//
// Reemplaza el parche temporal que existía para editoresUids de proyectos
// (ver firestore-sync.js) — misma idea, ahora hecha bien desde el arranque
// de espacios de trabajo, en vez de otro parche de reglas.
// ============================================================================
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

function sanitizarEmailComoId(email) {
  return String(email || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
}

// Se llama sin argumentos, apenas hay sesión iniciada y el email está
// verificado — mismo momento en que hoy se llama fsResolverInvitacionesPendientes
// para proyectos (ver firebase-auth.js). Usa el email del token de Auth, NUNCA
// uno mandado por el cliente, para que nadie pueda pedir "aceptar" invitaciones
// de un correo que no es el suyo.
exports.aceptarInvitacionesEspacio = onCall(async (request) => {
  const auth = request.auth;
  if (!auth || !auth.uid) {
    throw new HttpsError("unauthenticated", "Hace falta sesión iniciada.");
  }
  const email = auth.token && auth.token.email;
  if (!email || !auth.token.email_verified) {
    throw new HttpsError("failed-precondition", "El correo debe estar verificado.");
  }
  const uid = auth.uid;
  const emailId = sanitizarEmailComoId(email);
  const ref = db.collection("invitacionesEspacio").doc(emailId);
  const snap = await ref.get();
  if (!snap.exists) return { aceptadas: [] };
  const pendientes = snap.data().pendientes || [];
  if (pendientes.length === 0) return { aceptadas: [] };

  const aceptadas = [];
  for (const inv of pendientes) {
    if (!inv || !inv.espacioId) continue;
    try {
      const espacioRef = db.collection("espacios").doc(inv.espacioId);
      const espacioSnap = await espacioRef.get();
      if (!espacioSnap.exists) continue; // espacio borrado o inválido: se descarta, no se reintenta
      await espacioRef.update({
        miembrosUids: admin.firestore.FieldValue.arrayUnion(uid),
      });
      aceptadas.push(inv);
    } catch (e) {
      // Si algo puntual falla, esa invitación queda pendiente para reintentar
      // en el próximo login — mismo criterio que ya usa la versión de proyectos.
      console.error("No se pudo aceptar invitación a espacio", inv.espacioId, e);
    }
  }
  if (aceptadas.length > 0) {
    await ref.update({
      pendientes: admin.firestore.FieldValue.arrayRemove(...aceptadas),
    });
  }
  return { aceptadas: aceptadas.map((a) => a.espacioId) };
});

// Crea la invitación pendiente — llamable desde el cliente vía SDK normal
// de Firestore (igual que fsCompartirProyecto), no necesita ser función:
// cualquier miembro de un espacio puede escribir en invitacionesEspacio/{emailId}
// (reglas abiertas, igual que invitaciones/ hoy). Documentado acá solo como
// referencia de la forma esperada del documento:
//
// invitacionesEspacio/{emailSanitizado}
//   pendientes: [{ espacioId, nombreEspacio, invitadoPor }]

// Lista los miembros de un espacio con su email/nombre — el cliente NO
// puede resolver un uid ajeno a un perfil por su cuenta (Firestore no
// guarda el email de cada miembro, solo el uid, y Auth de otro usuario
// solo lo puede leer el Admin SDK). De ahí la Cloud Function: valida que
// quien pregunta sea miembro del espacio, y devuelve email/displayName de
// cada uid vía admin.auth().getUser(). Si un uid ya no existe en Auth
// (borrado, caso raro) se devuelve igual con email/nombre vacíos, para no
// tirar abajo el resto de la lista por un solo miembro con problemas.
exports.listarMiembrosEspacio = onCall(async (request) => {
  const auth = request.auth;
  if (!auth || !auth.uid) {
    throw new HttpsError("unauthenticated", "Hace falta sesión iniciada.");
  }
  const espacioId = request.data && request.data.espacioId;
  if (!espacioId) {
    throw new HttpsError("invalid-argument", "Falta espacioId.");
  }
  const espacioSnap = await db.collection("espacios").doc(espacioId).get();
  if (!espacioSnap.exists) {
    throw new HttpsError("not-found", "El espacio no existe.");
  }
  const data = espacioSnap.data();
  const miembrosUids = Array.isArray(data.miembrosUids) ? data.miembrosUids : [];
  if (!miembrosUids.includes(auth.uid)) {
    throw new HttpsError("permission-denied", "No sos miembro de este espacio.");
  }
  const miembros = [];
  for (const uid of miembrosUids) {
    try {
      const userRecord = await admin.auth().getUser(uid);
      miembros.push({
        uid,
        email: userRecord.email || "",
        nombre: userRecord.displayName || "",
        esCreador: uid === data.creadoPor,
      });
    } catch (e) {
      miembros.push({ uid, email: "", nombre: "", esCreador: uid === data.creadoPor });
    }
  }
  return { miembros };
});
