// ============================================================================
// archivo-estado-app.js — encapsulado en IIFE (sin exponer todo a window; ver export list abajo)
// ============================================================================
// PROYECTO_ACTIVO_ID / PROYECTO_ACTIVO_CREADO_EN se declaran fuera del IIFE:
// proyectos.js los reasigna directamente al abrir/crear/borrar un proyecto.
var PROYECTO_ACTIVO_ID = null;
var PROYECTO_ACTIVO_CREADO_EN = null;
var PROYECTO_ACTIVO_COMPARTIDO = false;
var PROYECTO_ACTIVO_FS_VERSION = null;
var PROYECTO_ACTIVO_CANDADO_PROPIO = false;
var PROYECTO_ACTIVO_MULTI_EDITOR = false;
var PROYECTO_ACTIVO_SOLO_LECTURA = false;
var PROYECTO_ACTIVO_HUBO_EDICION = false;
(function () {
let ULTIMO_GUARDADO = null;
let FALLO_AUTOGUARDADO = false;

function actualizarIndicadorArchivo() {
  const badge = document.getElementById("save-status-badge");
  const timeEl = document.getElementById("save-status-time");
  const wrap = document.getElementById("save-status");
  if (!badge || !timeEl || !wrap) return;
  const nombreTxt = "";
  if (FALLO_AUTOGUARDADO) {
    badge.className = "save-status-badge error";
    badge.textContent = "!";
    timeEl.textContent = "sin guardar";
    wrap.title = "No se pudo guardar automáticamente. Exportá el proyecto (.fss) para no perder el trabajo.";
    return;
  }
  if (ULTIMO_GUARDADO) {
    badge.className = "save-status-badge ok";
    badge.textContent = "✓";
    timeEl.textContent = ULTIMO_GUARDADO.toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" });
    wrap.title = `Guardado a las ${ULTIMO_GUARDADO.toLocaleTimeString("es-CR")}${nombreTxt}`;
  } else {
    badge.className = "save-status-badge pending";
    badge.textContent = "✕";
    timeEl.textContent = "";
    wrap.title = `Sin guardar cambios aún${nombreTxt}`;
  }
}

function marcarGuardado() {
  ULTIMO_GUARDADO = new Date();
  actualizarIndicadorArchivo();
}

async function nuevoProyecto() {
  await crearYAbrirProyectoNuevo();
  mostrarToast("Proyecto nuevo. Empezá agregando filas o un levantamiento.");
}

const AUTOSAVE_KEY = "hiltiCortafuegoAutoguardado_v1";
const IDB_NOMBRE = "firestopSuite";
const IDB_VERSION = 2;
const IDB_STORE = "autoguardado";
const IDB_CLAVE = "actual";
const IDB_STORE_PROYECTOS = "proyectos";
const IDB_STORE_META = "meta";
let IDB_PROMESA = null;

function abrirIDB() {
  if (IDB_PROMESA) return IDB_PROMESA;
  IDB_PROMESA = new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error("IndexedDB no disponible en este navegador")); return; }
    const req = indexedDB.open(IDB_NOMBRE, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
      if (!db.objectStoreNames.contains(IDB_STORE_PROYECTOS)) db.createObjectStore(IDB_STORE_PROYECTOS);
      if (!db.objectStoreNames.contains(IDB_STORE_META)) db.createObjectStore(IDB_STORE_META);
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        IDB_PROMESA = null;
        avisarFalloGuardado(new Error("Esta pestaña quedó vieja (se abrió la app en otro lado). Recargá la página."));
      };
      resolve(db);
    };
    req.onerror = () => { IDB_PROMESA = null; reject(req.error || new Error("No se pudo abrir IndexedDB")); };
    req.onblocked = () => { IDB_PROMESA = null; reject(new Error("IndexedDB bloqueada por otra pestaña — cerrá las demás pestañas de esta app y volvé a intentar.")); };
  });
  return IDB_PROMESA;
}
function idbGuardar(valor) {
  return abrirIDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(valor, IDB_CLAVE);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Error al escribir"));
    tx.onabort = () => reject(tx.error || new Error("Transacción abortada (¿sin espacio?)"));
  }));
}
function idbLeer() {
  return abrirIDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(IDB_CLAVE);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error || new Error("Error al leer"));
  }));
}
function idbBorrar() {
  return abrirIDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(IDB_CLAVE);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Error al borrar"));
  }));
}
function idbGuardarProyecto(id, valor) {
  return abrirIDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_PROYECTOS, "readwrite");
    tx.objectStore(IDB_STORE_PROYECTOS).put(valor, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Error al escribir el proyecto"));
    tx.onabort = () => reject(tx.error || new Error("Transacción abortada (¿sin espacio?)"));
  }));
}
function idbLeerProyecto(id) {
  return abrirIDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_PROYECTOS, "readonly");
    const req = tx.objectStore(IDB_STORE_PROYECTOS).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error || new Error("Error al leer el proyecto"));
  }));
}
function idbBorrarProyecto(id) {
  return abrirIDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_PROYECTOS, "readwrite");
    tx.objectStore(IDB_STORE_PROYECTOS).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Error al borrar el proyecto"));
  }));
}
function idbListarProyectos() {
  return abrirIDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_PROYECTOS, "readonly");
    const store = tx.objectStore(IDB_STORE_PROYECTOS);
    const out = [];
    const req = store.openCursor();
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) { out.push({ id: cursor.key, data: cursor.value }); cursor.continue(); }
      else resolve(out);
    };
    req.onerror = () => reject(req.error || new Error("Error al listar proyectos"));
  }));
}
function idbGuardarActivo(id) {
  return abrirIDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_META, "readwrite");
    tx.objectStore(IDB_STORE_META).put(id, "activo");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Error al guardar el proyecto activo"));
  }));
}
function idbLeerActivo() {
  return abrirIDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_META, "readonly");
    const req = tx.objectStore(IDB_STORE_META).get("activo");
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error || new Error("Error al leer el proyecto activo"));
  }));
}

function idbGuardarMetaClave(clave, valor) {
  return abrirIDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_META, "readwrite");
    tx.objectStore(IDB_STORE_META).put(valor, clave);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Error al guardar " + clave));
  }));
}
function idbLeerMetaClave(clave) {
  return abrirIDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_META, "readonly");
    const req = tx.objectStore(IDB_STORE_META).get(clave);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error || new Error("Error al leer " + clave));
  }));
}

async function pedirAlmacenamientoPersistente() {
  try {
    if (!navigator.storage || !navigator.storage.persist) return;
    if (await navigator.storage.persisted()) return;
    await navigator.storage.persist();
  } catch (e) {}
}

function avisarFalloGuardado(err) {
  console.error("Autoguardado falló:", err);
  const primeraVez = !FALLO_AUTOGUARDADO;
  FALLO_AUTOGUARDADO = true;
  actualizarIndicadorArchivo();
  if (primeraVez && window.mostrarToast) {
    mostrarToast("No se pudo guardar automáticamente. Exportá el proyecto (.fss) ya para no perder el trabajo.", "error");
  }
}

let autosaveTimer = null;
let guardadoEnCurso = false;
let guardadoPendiente = false;
async function guardarAutoAhora() {
  if (guardadoEnCurso) { guardadoPendiente = true; return; }
  if (!PROYECTO_ACTIVO_ID) return;
  guardadoEnCurso = true;
  try {
    const payload = datosProyectoActual();
    payload.id = PROYECTO_ACTIVO_ID;
    payload.guardadoEn = new Date().toISOString();
    payload.creadoEn = PROYECTO_ACTIVO_CREADO_EN || payload.guardadoEn;
    await idbGuardarProyecto(PROYECTO_ACTIVO_ID, payload);
    if (FALLO_AUTOGUARDADO) FALLO_AUTOGUARDADO = false;
    marcarGuardado();
  } catch (e) {
    avisarFalloGuardado(e);
  } finally {
    guardadoEnCurso = false;
    if (guardadoPendiente) { guardadoPendiente = false; guardarAutoAhora(); }
  }
  if (PROYECTO_ACTIVO_COMPARTIDO && !FALLO_AUTOGUARDADO) sincronizarConFirestore();
}
function marcarCambio() {
  if (PROYECTO_ACTIVO_ID) PROYECTO_ACTIVO_HUBO_EDICION = true;
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(guardarAutoAhora, 600);
}

let firestoreSyncTimer = null;
let firestoreSyncEnCurso = false;
let firestoreSyncPendiente = false;
let avisandoSoloLectura = false;
let avisandoTamano = false;
let avisandoFotoFallida = false;
let reintentoFotosTimer = null;
let reintentoFotosIntentos = 0;
const REINTENTO_FOTOS_MAX = 6;
async function sincronizarConFirestoreAhora() {
  if (firestoreSyncEnCurso) { firestoreSyncPendiente = true; return; }
  if (!PROYECTO_ACTIVO_COMPARTIDO || !PROYECTO_ACTIVO_ID) return;
  firestoreSyncEnCurso = true;
  try {
    const payload = datosProyectoActual();
    const { jsonSinImagenes, imagenesJson } = extraerImagenesGrandes(JSON.stringify(payload));
    let imagenesUrls = null;
    let fotosFallaron = false;
    if (window.fsSubirImagenesFaltantes) {
      try {
        const resultadoFotos = await window.fsSubirImagenesFaltantes(PROYECTO_ACTIVO_ID, imagenesJson);
        imagenesUrls = resultadoFotos.urls;
        fotosFallaron = !!resultadoFotos.algunaFallo;
      } catch (e) {
        fotosFallaron = true;
        console.error("No se pudieron subir las fotos a Storage (se reintenta después):", e);
      }
    }
    const tamPayload = new Blob([jsonSinImagenes]).size;
    if (tamPayload > 900 * 1024) {
      if (!avisandoTamano) {
        avisandoTamano = true;
        if (window.mostrarToast) mostrarToast("El proyecto quedó muy grande para sincronizarlo a la nube (" + Math.round(tamPayload / 1024) + " KB de texto). Se sigue guardando local, pero no se sube. Avisá para revisarlo.", "error");
      }
      console.error("Payload demasiado grande para Firestore:", tamPayload, "bytes");
      return;
    }
    avisandoTamano = false;
    const resultado = await window.fsSubirCambios(PROYECTO_ACTIVO_ID, jsonSinImagenes, PROYECTO_ACTIVO_FS_VERSION, imagenesUrls);
    if (resultado.ok) {
      PROYECTO_ACTIVO_FS_VERSION = resultado.version;
      PROYECTO_ACTIVO_HUBO_EDICION = false;
      avisandoSoloLectura = false;
      try { await idbGuardarMetaClave(claveVersionLocal(PROYECTO_ACTIVO_ID), resultado.version); } catch (e2) {}
      if (fotosFallaron) {
        if (!avisandoFotoFallida) {
          avisandoFotoFallida = true;
          if (window.mostrarToast) mostrarToast("Una o más fotos no se pudieron subir a la nube todavía (señal floja). Se sigue intentando solo.", "error");
        }
        programarReintentoFotos();
      } else {
        avisandoFotoFallida = false;
        reintentoFotosIntentos = 0;
        if (reintentoFotosTimer) { clearTimeout(reintentoFotosTimer); reintentoFotosTimer = null; }
      }
      return;
    }
    if (resultado.conflicto) {
      avisarConflictoSync(resultado.versionRemota);
      return;
    }
    console.error("No se pudo sincronizar con Firestore:", resultado.error);
  } catch (e) {
    if (e && e.code === "permission-denied") {
      if (!avisandoSoloLectura) {
        avisandoSoloLectura = true;
        if (window.mostrarToast) mostrarToast("Tus cambios se están guardando localmente, pero no se suben a la nube todavía porque otra persona tiene el proyecto en edición.", "error");
      }
    } else if (e && (e.code === "invalid-argument" || e.code === "resource-exhausted")) {
      if (!avisandoTamano) {
        avisandoTamano = true;
        if (window.mostrarToast) mostrarToast("La nube rechazó este proyecto (" + e.code + "). Se sigue guardando local, pero no se sube. Avisá para revisarlo.", "error");
      }
      console.error("Firestore rechazó la escritura (no es falta de señal):", e);
    } else {
      console.error("Error de red al sincronizar con Firestore (se reintentará):", e);
    }
  } finally {
    firestoreSyncEnCurso = false;
    if (firestoreSyncPendiente) { firestoreSyncPendiente = false; sincronizarConFirestoreAhora(); }
  }
}
function sincronizarConFirestore() {
  if (firestoreSyncTimer) clearTimeout(firestoreSyncTimer);
  firestoreSyncTimer = setTimeout(sincronizarConFirestoreAhora, 3000);
}

function programarReintentoFotos() {
  if (reintentoFotosTimer) return;
  if (reintentoFotosIntentos >= REINTENTO_FOTOS_MAX) return;
  const idAlProgramar = PROYECTO_ACTIVO_ID;
  const espera = 15000 * (reintentoFotosIntentos + 1);
  reintentoFotosTimer = setTimeout(() => {
    reintentoFotosTimer = null;
    reintentoFotosIntentos++;
    if (PROYECTO_ACTIVO_ID === idAlProgramar && PROYECTO_ACTIVO_COMPARTIDO) {
      sincronizarConFirestoreAhora();
    }
  }, espera);
}

let reconexionEnCurso = false;
async function manejarReconexion() {
  if (reconexionEnCurso || !PROYECTO_ACTIVO_ID) return;
  if (!window.fsDescargarUltimaVersion || !window.usuarioActual || !window.usuarioActual()) return;
  reconexionEnCurso = true;
  const idAlEmpezar = PROYECTO_ACTIVO_ID;
  try {
    const remoto = await window.fsDescargarUltimaVersion(idAlEmpezar);
    if (PROYECTO_ACTIVO_ID !== idAlEmpezar) return;
    if (!remoto) return;
    PROYECTO_ACTIVO_COMPARTIDO = true;
    PROYECTO_ACTIVO_MULTI_EDITOR = Array.isArray(remoto.editoresUids) && remoto.editoresUids.length > 0;
    const versionDesconocidaOAtrasada =
      PROYECTO_ACTIVO_FS_VERSION === null || remoto.version !== PROYECTO_ACTIVO_FS_VERSION;
    if (PROYECTO_ACTIVO_HUBO_EDICION && versionDesconocidaOAtrasada) {
      avisarConflictoAlReconectar(remoto);
    } else if (versionDesconocidaOAtrasada) {
      const ok = await traerVersionRemotaYAdoptar(idAlEmpezar, remoto);
      if (!ok) PROYECTO_ACTIVO_FS_VERSION = remoto.version;
      if (PROYECTO_ACTIVO_MULTI_EDITOR) await tomarCandadoSiCorresponde(idAlEmpezar);
    } else {
      if (PROYECTO_ACTIVO_MULTI_EDITOR) await tomarCandadoSiCorresponde(idAlEmpezar);
    }
  } catch (e) {
  } finally {
    reconexionEnCurso = false;
  }
}
window.addEventListener("online", manejarReconexion);

function avisarConflictoAlReconectar(remoto) {
  if (avisandoConflicto) return;
  avisandoConflicto = true;
  window.pedirEleccion(
    "Otra persona guardó cambios en este proyecto mientras estabas sin conexión. No se puede combinar automáticamente. Elegi´ cómo seguir.",
    [
      { label: "Traer esos cambios (descarta lo mío)", act: "traer", clase: "danger" },
      { label: "Guardar lo mío como copia aparte", act: "copia", clase: "primary" },
    ],
    async (eleccion) => {
      avisandoConflicto = false;
      await resolverConflictoSync(eleccion, remoto.version);
    },
    true
  );
}

let avisandoConflicto = false;
function avisarConflictoSync(versionRemota) {
  if (avisandoConflicto) return;
  avisandoConflicto = true;
  window.pedirEleccion(
    "Este proyecto cambió en otro dispositivo mientras este estaba sin conexión (o editando al mismo tiempo). ¿Qué querés hacer?",
    [
      { label: "Traer la versión más nueva (descarta tus cambios locales)", act: "traer", clase: "danger" },
      { label: "Guardar tu versión como copia aparte", act: "copia", clase: "primary" },
      { label: "Seguir editando la mía por ahora (decidir después)", act: "cancelar", clase: "secondary" },
    ],
    async (eleccion) => {
      avisandoConflicto = false;
      await resolverConflictoSync(eleccion, versionRemota);
    }
  );
}

async function resolverConflictoSync(eleccion, versionRemota) {
  if (eleccion === "traer") {
    try {
      const remoto = await window.fsDescargarUltimaVersion(PROYECTO_ACTIVO_ID);
      if (!remoto) { mostrarToast("No se pudo traer la versión remota.", "error"); return; }
      let jsonConImagenes = remoto.payloadJson;
      if (remoto.imagenesUrls && Object.keys(remoto.imagenesUrls).length > 0 && window.fsDescargarImagenesComoJson) {
        try {
          const imagenesJson = await window.fsDescargarImagenesComoJson(remoto.imagenesUrls);
          jsonConImagenes = reinsertarImagenesGrandes(remoto.payloadJson, imagenesJson);
        } catch (e2) {
          console.error("No se pudieron bajar las fotos de la versión remota (se trae el resto igual):", e2);
        }
      }
      const data = JSON.parse(jsonConImagenes);
      pushUndo();
      cargarProyectoEnApp(data);
      PROYECTO_ACTIVO_FS_VERSION = remoto.version;
      PROYECTO_ACTIVO_HUBO_EDICION = false;
      try { await idbGuardarMetaClave(claveVersionLocal(PROYECTO_ACTIVO_ID), remoto.version); } catch (e2) {}
      marcarCambio();
      mostrarToast("Se trajo la versión más nueva del proyecto.");
    } catch (e) {
      mostrarToast("No se pudo traer la versión remota: " + e.message, "error");
    }
  } else if (eleccion === "copia") {
    const nuevoId = "p_" + Date.now().toString(36) + "_conflicto";
    const payload = datosProyectoActual();
    payload.id = nuevoId;
    payload.guardadoEn = new Date().toISOString();
    payload.creadoEn = payload.guardadoEn;
    payload.projectInfo = Object.assign({}, payload.projectInfo, {
      nombre: (payload.projectInfo.nombre || "Proyecto") + " (copia local sin sincronizar)",
    });
    try {
      await idbGuardarProyecto(nuevoId, payload);
      mostrarToast("Tu versión se guardó aparte como '" + payload.projectInfo.nombre + "'. Revisala en Proyectos y decidí cuál usar.");
      PROYECTO_ACTIVO_HUBO_EDICION = false;
      try {
        const remoto = await window.fsDescargarUltimaVersion(PROYECTO_ACTIVO_ID);
        if (remoto) {
          const ok = await traerVersionRemotaYAdoptar(PROYECTO_ACTIVO_ID, remoto);
          if (!ok) PROYECTO_ACTIVO_FS_VERSION = remoto.version;
        }
      } catch (e2) {}
    } catch (e) {
      mostrarToast("No se pudo guardar la copia: " + e.message, "error");
    }
  }
}

async function migrarDesdeLocalStorage() {
  let txt = null;
  try { txt = localStorage.getItem(AUTOSAVE_KEY); } catch (e) { return null; }
  if (!txt) return null;
  let data;
  try { data = JSON.parse(txt); } catch (e) { return null; }
  if (!data) return null;
  try {
    await idbGuardar(data);
    localStorage.removeItem(AUTOSAVE_KEY);
    console.info("Autoguardado migrado de localStorage a IndexedDB.");
  } catch (e) {
    console.error("No se pudo migrar el autoguardado a IndexedDB:", e);
  }
  return data;
}
function autoguardadoTieneContenido(data) {
  if (!data) return false;
  return (Array.isArray(data.filas) && data.filas.length > 0)
    || (Array.isArray(data.planos) && data.planos.length > 0)
    || (Array.isArray(data.informes) && data.informes.length > 0)
    || (Array.isArray(data.itemsManuales) && data.itemsManuales.length > 0)
    || (Array.isArray(data.filasJuntas) && data.filasJuntas.length > 0);
}
async function cargarAutoguardado() {
  let data = null;
  try {
    data = await idbLeer();
  } catch (e) {
    avisarFalloGuardado(e);
    try { const txt = localStorage.getItem(AUTOSAVE_KEY); if (txt) data = JSON.parse(txt); } catch (e2) {}
    return autoguardadoTieneContenido(data) ? data : null;
  }
  if (!data) data = await migrarDesdeLocalStorage();
  return autoguardadoTieneContenido(data) ? data : null;
}
function borrarAutoguardado() {
  idbBorrar().catch((e) => console.error("No se pudo borrar el autoguardado:", e));
  try { localStorage.removeItem(AUTOSAVE_KEY); } catch (e) {}
}

function cargarProyectoEnApp(data) {
  ROWS = Array.isArray(data.filas) ? data.filas.map(f => Object.assign(nuevaFila(), f, { _id: typeof f._id === "number" ? f._id : ROW_SEQ++ })) : [];
  ROW_SEQ = Math.max(ROW_SEQ, ...ROWS.map(r => r._id), 0) + 1;
  if (Array.isArray(data.filasJuntas)) {
    ROWS_J = data.filasJuntas.map(f => Object.assign({}, f, { _id: typeof f._id === "number" ? f._id : ROW_J_SEQ++ }));
    ROW_J_SEQ = Math.max(ROW_J_SEQ, ...ROWS_J.map(r => r._id), 0) + 1;
  } else {
    ROWS_J = [];
  }
  MANUAL_ITEMS = Array.isArray(data.itemsManuales) ? data.itemsManuales.map(m => Object.assign({}, m, { _id: MANUAL_ITEM_SEQ++ })) : [];
  Object.assign(CONFIG, CONFIG_DEFAULT);
  if (data.config) Object.assign(CONFIG, data.config);
  PROJECT_INFO.nombre = ""; PROJECT_INFO.cliente = ""; PROJECT_INFO.fecha = "";
  if (data.projectInfo) Object.assign(PROJECT_INFO, data.projectInfo);
  if (data.mainTableOverride) MAIN_TABLE = data.mainTableOverride;
  if (data.juntasTableOverride) JUNTAS_TABLE = data.juntasTableOverride;
  PLANOS = Array.isArray(data.planos) ? data.planos : [];
  PLANO_SEQ = PLANOS.reduce((m, p) => Math.max(m, p.id || 0), 0) + 1;
  INFORMES_ACREDITACION = Array.isArray(data.informes) ? data.informes : [];
  INFORME_ACR_SEQ = INFORMES_ACREDITACION.reduce((m, i) => Math.max(m, i.id || 0), 0) + 1;
  sincronizarCamposConfig();
  const pn = document.getElementById("proj-nombre"); if (pn) pn.value = PROJECT_INFO.nombre;
  const pc = document.getElementById("proj-cliente"); if (pc) pc.value = PROJECT_INFO.cliente;
  const pf = document.getElementById("proj-fecha"); if (pf) pf.value = PROJECT_INFO.fecha;
  renderTable();
  renderLevantamientoTab();
  mostrarVistaProyecto();
}

async function abrirProyectoExistente(id) {
  soltarCandadoActivoSiHaceFalta();
  let data = null;
  try {
    data = await idbLeerProyecto(id);
  } catch (e) {
    avisarFalloGuardado(e);
    return false;
  }
  if (!data) return false;
  PROYECTO_ACTIVO_ID = id;
  PROYECTO_ACTIVO_CREADO_EN = data.creadoEn || data.guardadoEn || new Date().toISOString();
  PROYECTO_ACTIVO_HUBO_EDICION = false;
  try { await idbGuardarActivo(id); } catch (e) {}
  cargarProyectoEnApp(data);
  UNDO_STACK.length = 0;
  actualizarBotonDeshacer();
  ULTIMO_GUARDADO = data.guardadoEn ? new Date(data.guardadoEn) : null;
  FALLO_AUTOGUARDADO = false;
  actualizarIndicadorArchivo();
  detectarSiEsCompartido(id);
  return true;
}

function claveVersionLocal(id) { return "fsVersionLocal:" + id; }

async function traerVersionRemotaYAdoptar(id, remoto) {
  if (!remoto.payloadJson) return false;
  try {
    let jsonConImagenes = remoto.payloadJson;
    if (remoto.imagenesUrls && Object.keys(remoto.imagenesUrls).length > 0 && window.fsDescargarImagenesComoJson) {
      try {
        const imagenesJson = await window.fsDescargarImagenesComoJson(remoto.imagenesUrls);
        jsonConImagenes = reinsertarImagenesGrandes(remoto.payloadJson, imagenesJson);
      } catch (e2) {
        console.error("No se pudieron bajar las fotos de la versión remota (se adopta el resto igual):", e2);
      }
    }
    const data = JSON.parse(jsonConImagenes);
    data.id = id;
    data.guardadoEn = data.guardadoEn || new Date().toISOString();
    data.creadoEn = data.creadoEn || data.guardadoEn;
    await idbGuardarProyecto(id, data);
    try { await idbGuardarMetaClave(claveVersionLocal(id), remoto.version); } catch (e2) {}
    if (PROYECTO_ACTIVO_ID === id) {
      cargarProyectoEnApp(data);
      PROYECTO_ACTIVO_FS_VERSION = remoto.version;
      ULTIMO_GUARDADO = new Date();
      actualizarIndicadorArchivo();
    }
    return true;
  } catch (e) {
    console.error("No se pudo traer la versión remota:", e);
    return false;
  }
}

let UNSUB_LISTENER_PROYECTO = null;
let listenerProyectoTimer = null;

function activarListenerProyectoActivo(id) {
  desactivarListenerProyectoActivo();
  if (!window.fsEscucharProyecto) return;
  UNSUB_LISTENER_PROYECTO = window.fsEscucharProyecto(id, (data, metadata) => {
    manejarActualizacionEnVivo(id, data, metadata);
  });
}

function desactivarListenerProyectoActivo() {
  if (listenerProyectoTimer) { clearTimeout(listenerProyectoTimer); listenerProyectoTimer = null; }
  if (UNSUB_LISTENER_PROYECTO) {
    try { UNSUB_LISTENER_PROYECTO(); } catch (e) {}
    UNSUB_LISTENER_PROYECTO = null;
  }
}

function manejarActualizacionEnVivo(id, data, metadata) {
  if (PROYECTO_ACTIVO_ID !== id) return;
  if (metadata && metadata.hasPendingWrites) return;
  const versionRemota = data.versionSync || 0;
  if (versionRemota === PROYECTO_ACTIVO_FS_VERSION) return;
  if (PROYECTO_ACTIVO_HUBO_EDICION) return;
  if (listenerProyectoTimer) clearTimeout(listenerProyectoTimer);
  listenerProyectoTimer = setTimeout(() => {
    listenerProyectoTimer = null;
    if (PROYECTO_ACTIVO_ID !== id || PROYECTO_ACTIVO_HUBO_EDICION) return;
    const remoto = { payloadJson: data.payloadJson, version: versionRemota, imagenesUrls: data.imagenesUrls || {} };
    traerVersionRemotaYAdoptar(id, remoto);
  }, 1500);
}

async function detectarSiEsCompartido(id) {
  PROYECTO_ACTIVO_COMPARTIDO = false;
  PROYECTO_ACTIVO_FS_VERSION = null;
  PROYECTO_ACTIVO_CANDADO_PROPIO = false;
  PROYECTO_ACTIVO_MULTI_EDITOR = false;
  if (!window.fsDescargarUltimaVersion || !window.usuarioActual) return;
  const user = window.usuarioActual();
  if (!user) return;
  try {
    let remoto = await window.fsDescargarUltimaVersion(id);
    if (PROYECTO_ACTIVO_ID !== id) return;
    if (!remoto && window.fsAsegurarProyecto) {
      try {
        await window.fsAsegurarProyecto(id, {
          nombre: (typeof PROJECT_INFO !== "undefined" && PROJECT_INFO && PROJECT_INFO.nombre) || "",
          cliente: (typeof PROJECT_INFO !== "undefined" && PROJECT_INFO && PROJECT_INFO.cliente) || "",
          fecha: (typeof PROJECT_INFO !== "undefined" && PROJECT_INFO && PROJECT_INFO.fecha) || "",
          ownerId: user.uid,
          ownerEmail: user.email || "",
          espacioId: window.espacioActivoIdActual ? window.espacioActivoIdActual() : null,
        });
        if (PROYECTO_ACTIVO_ID !== id) return;
        remoto = await window.fsDescargarUltimaVersion(id);
      } catch (e2) {
      }
    }
    if (remoto) {
      PROYECTO_ACTIVO_COMPARTIDO = true;
      PROYECTO_ACTIVO_MULTI_EDITOR = Array.isArray(remoto.editoresUids) && remoto.editoresUids.length > 0;
      let versionLocalConocida = null;
      try { versionLocalConocida = await idbLeerMetaClave(claveVersionLocal(id)); } catch (e2) {}
      let seRecuperoContenido = false;
      if (versionLocalConocida === null || versionLocalConocida !== remoto.version) {
        const ok = await traerVersionRemotaYAdoptar(id, remoto);
        if (!ok) PROYECTO_ACTIVO_FS_VERSION = remoto.version;
        seRecuperoContenido = ok;
      } else {
        PROYECTO_ACTIVO_FS_VERSION = remoto.version;
      }
      if (PROYECTO_ACTIVO_ID !== id) return;
      if (PROYECTO_ACTIVO_MULTI_EDITOR) {
        await tomarCandadoSiCorresponde(id);
        if (PROYECTO_ACTIVO_ID === id) activarListenerProyectoActivo(id);
      }
      if (!remoto.payloadJson && !seRecuperoContenido) {
        sincronizarConFirestoreAhora();
      }
    }
  } catch (e) {
  }
}

async function tomarCandadoSiCorresponde(id) {
  if (!window.fsTomarCandado) { aplicarModoSoloLectura(false); return; }
  const user = window.usuarioActual ? window.usuarioActual() : null;
  if (!user) { aplicarModoSoloLectura(false); return; }
  try {
    const resultado = await window.fsTomarCandado(id, user.uid, user.displayName || user.email || "");
    if (PROYECTO_ACTIVO_ID !== id) return;
    PROYECTO_ACTIVO_CANDADO_PROPIO = !!resultado.ok;
    aplicarModoSoloLectura(!resultado.ok, resultado.ocupadoPor);
  } catch (e) {
    PROYECTO_ACTIVO_CANDADO_PROPIO = false;
    aplicarModoSoloLectura(false);
  }
}

function aplicarModoSoloLectura(activo, ocupadoPor) {
  PROYECTO_ACTIVO_SOLO_LECTURA = !!activo;
  const main = document.querySelector("main");
  const banner = document.getElementById("solo-lectura-banner");
  const texto = document.getElementById("solo-lectura-texto");
  if (main) main.classList.toggle("solo-lectura", PROYECTO_ACTIVO_SOLO_LECTURA);
  if (banner) banner.style.display = PROYECTO_ACTIVO_SOLO_LECTURA ? "flex" : "none";
  if (texto && PROYECTO_ACTIVO_SOLO_LECTURA) {
    texto.textContent = `Solo lectura — ${ocupadoPor || "otra persona"} está editando`;
  }
}

async function soltarCandadoActivoSiHaceFalta() {
  aplicarModoSoloLectura(false);
  desactivarListenerProyectoActivo();
  if (reintentoFotosTimer) { clearTimeout(reintentoFotosTimer); reintentoFotosTimer = null; }
  reintentoFotosIntentos = 0;
  avisandoFotoFallida = false;
  if (!PROYECTO_ACTIVO_COMPARTIDO || !PROYECTO_ACTIVO_CANDADO_PROPIO || !PROYECTO_ACTIVO_ID) {
    PROYECTO_ACTIVO_CANDADO_PROPIO = false;
    return;
  }
  const idPrevio = PROYECTO_ACTIVO_ID;
  const user = window.usuarioActual ? window.usuarioActual() : null;
  PROYECTO_ACTIVO_CANDADO_PROPIO = false;
  if (!user || !window.fsSoltarCandado) return;
  try {
    await window.fsSoltarCandado(idPrevio, user.uid);
  } catch (e) {
  }
}

async function crearYAbrirProyectoNuevo() {
  soltarCandadoActivoSiHaceFalta();
  const id = "p_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
  PROYECTO_ACTIVO_ID = id;
  PROYECTO_ACTIVO_CREADO_EN = new Date().toISOString();
  PROYECTO_ACTIVO_COMPARTIDO = false;
  PROYECTO_ACTIVO_FS_VERSION = null;
  PROYECTO_ACTIVO_MULTI_EDITOR = false;
  PROYECTO_ACTIVO_HUBO_EDICION = false;
  try { await idbGuardarActivo(id); } catch (e) {}
  ROWS = []; ROWS_J = []; MANUAL_ITEMS = []; PLANOS = []; INFORMES_ACREDITACION = [];
  Object.assign(CONFIG, CONFIG_DEFAULT);
  PROJECT_INFO.nombre = ""; PROJECT_INFO.cliente = ""; PROJECT_INFO.fecha = "";
  sincronizarCamposConfig();
  const pn = document.getElementById("proj-nombre"); if (pn) pn.value = "";
  const pc = document.getElementById("proj-cliente"); if (pc) pc.value = "";
  const pf = document.getElementById("proj-fecha"); if (pf) pf.value = "";
  renderTable();
  renderLevantamientoTab();
  mostrarVistaProyecto();
  UNDO_STACK.length = 0;
  actualizarBotonDeshacer();
  ULTIMO_GUARDADO = null;
  FALLO_AUTOGUARDADO = false;
  actualizarIndicadorArchivo();
  detectarSiEsCompartido(id);
  return id;
}

async function migrarProyectoUnicoSiHaceFalta() {
  let lista = [];
  try { lista = await idbListarProyectos(); } catch (e) { return; }
  if (lista.length > 0) return;
  let dataVieja = null;
  try { dataVieja = await idbLeer(); } catch (e) { dataVieja = null; }
  if (!dataVieja) dataVieja = await migrarDesdeLocalStorage();
  if (!autoguardadoTieneContenido(dataVieja)) return;
  const id = "p_" + Date.now().toString(36) + "_migrado";
  dataVieja.id = id;
  dataVieja.creadoEn = dataVieja.guardadoEn || new Date().toISOString();
  dataVieja.guardadoEn = dataVieja.guardadoEn || new Date().toISOString();
  try {
    await idbGuardarProyecto(id, dataVieja);
    await idbGuardarActivo(id);
    await idbBorrar();
    console.info("Proyecto único migrado a la estructura multi-proyecto:", id);
  } catch (e) {
    console.error("No se pudo migrar el proyecto único a multi-proyecto:", e);
  }
}

let UNDO_STACK = [];
const UNDO_MAX = 25;
function pushUndo() {
  try {
    UNDO_STACK.push(JSON.stringify({ rows: ROWS, rowsJ: ROWS_J }));
    if (UNDO_STACK.length > UNDO_MAX) UNDO_STACK.shift();
  } catch (e) {}
  actualizarBotonDeshacer();
}
function actualizarBotonDeshacer() {
  ["btn-deshacer", "btn-deshacer-lev-fs", "btn-deshacer-lev-tab"].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = UNDO_STACK.length === 0;
  });
}
function deshacerCambio() {
  if (UNDO_STACK.length === 0) { mostrarToast("No hay cambios para deshacer.", "error"); return; }
  const prev = JSON.parse(UNDO_STACK.pop());
  ROWS = prev.rows || prev;
  ROWS_J = prev.rowsJ || [];
  const maxId = ROWS.reduce((m, r) => Math.max(m, r._id || 0), 0);
  ROW_SEQ = Math.max(ROW_SEQ, maxId + 1);
  const maxIdJ = ROWS_J.reduce((m, r) => Math.max(m, r._id || 0), 0);
  ROW_J_SEQ = Math.max(ROW_J_SEQ, maxIdJ + 1);
  renderTable();
  if (ACTIVE_TAB === "resumen") renderResumen();
  if (ACTIVE_TAB === "levantamiento-tab") renderLevantamientoTab();
  if (document.body.classList.contains("modo-levantamiento")) renderLevantamiento();
  actualizarBotonDeshacer();
  marcarCambio();
  mostrarToast("Cambio revertido.");
}

function borrarTodo() {
  if (ROWS.length === 0 && ROWS_J.length === 0) { mostrarToast("No hay filas para borrar."); return; }
  pedirConfirmacion(
    `Esto va a borrar las ${ROWS.length} fila(s) de penetrantes y ${ROWS_J.length} de juntas. Podés deshacerlo con el botón "Deshacer". ¿Continuar?`,
    () => {
      pushUndo();
      ROWS = [];
      ROWS_J = [];
      renderTable();
      if (ACTIVE_TAB === "resumen") renderResumen();
      if (ACTIVE_TAB === "levantamiento-tab") renderLevantamientoTab();
      marcarCambio();
      mostrarToast("Se borraron todas las filas.");
    }
  );
}

async function initApp() {
  const yearEl = document.getElementById("footer-year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  cargarMatricesLocalStorage();
  const cargoEmbebido = cargarDatosEmbebidos();
  actualizarIndicadorArchivo();

  document.getElementById("btn-abrir-levantamiento").addEventListener("click", abrirLevantamiento);

  document.querySelectorAll("#lev-vista-toggle-global [data-lev-vista-global]").forEach(btn => {
    btn.addEventListener("click", () => {
      VISTA_LEVANTAMIENTO_TAB = btn.dataset.levVistaGlobal;
      document.querySelectorAll("#lev-vista-toggle-global [data-lev-vista-global]").forEach(b => {
        b.classList.toggle("lev-chip-active", b.dataset.levVistaGlobal === VISTA_LEVANTAMIENTO_TAB);
      });
      renderLevantamientoTab();
      renderLevantamientoTabJuntas();
    });
  });

  document.getElementById("btn-abrir-levantamiento-juntas").addEventListener("click", abrirLevantamientoJuntas);
  document.getElementById("btn-abrir-planos").addEventListener("click", () => abrirVisorPlanos());
  document.getElementById("btn-cerrar-levantamiento").addEventListener("click", cerrarLevantamiento);
  document.getElementById("btn-ver-planos-lev").addEventListener("click", () => abrirVisorPlanos());

  function contextoInstrucciones() {
    if (document.getElementById("planos-visor-overlay")) return "planos";
    if (document.body.classList.contains("modo-levantamiento") && window.getLevMode && window.getLevMode() === "juntas") return "juntas";
    return "penetrantes";
  }
  function activarTabInstrucciones(tab) {
    document.querySelectorAll(".instr-tab-btn").forEach(b => b.classList.toggle("active", b.dataset.instrTab === tab));
    document.querySelectorAll(".instr-tab-panel").forEach(p => p.classList.toggle("active", p.dataset.instrPanel === tab));
  }
  document.querySelectorAll(".instr-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => activarTabInstrucciones(btn.dataset.instrTab));
  });

  document.getElementById("btn-abrir-instrucciones").addEventListener("click", () => {
    activarTabInstrucciones(contextoInstrucciones());
    document.getElementById("instrucciones-modal").classList.add("open");
  });
  document.getElementById("btn-cerrar-instrucciones").addEventListener("click", () => {
    document.getElementById("instrucciones-modal").classList.remove("open");
  });
  document.getElementById("instrucciones-modal").addEventListener("click", (e) => {
    if (e.target.id === "instrucciones-modal") e.currentTarget.classList.remove("open");
  });

  document.getElementById("btn-add-row").addEventListener("click", () => {
    ROWS.push(nuevaFila());
    renderTable();
    marcarCambio();
  });
  document.getElementById("btn-add-5").addEventListener("click", () => {
    for (let i = 0; i < 5; i++) ROWS.push(nuevaFila());
    renderTable();
    marcarCambio();
  });
  document.getElementById("btn-deshacer").addEventListener("click", deshacerCambio);
  const btnDeshacerLevTab = document.getElementById("btn-deshacer-lev-tab");
  if (btnDeshacerLevTab) btnDeshacerLevTab.addEventListener("click", deshacerCambio);
  document.getElementById("btn-borrar-todo").addEventListener("click", borrarTodo);
  const filtroCalcEl = document.getElementById("input-filtro-calc");
  if (filtroCalcEl) filtroCalcEl.addEventListener("input", () => { FILTRO_CALC = filtroCalcEl.value; aplicarFiltroCalc(); });
  document.querySelectorAll(".tab-btn").forEach(b => {
    b.addEventListener("click", () => switchTab(b.dataset.tab));
  });

  const cfgIds = ["C13", "C14", "C15", "C17", "C17_JUNTAS", "UMB_FS", "UMB_CP606", "UMB_SILGG"];
  const cfgPct = ["C17", "C17_JUNTAS"];
  cfgIds.forEach(id => {
    const el = document.getElementById("cfg-" + id);
    el.value = cfgPct.includes(id) ? CONFIG[id] * 100 : CONFIG[id];
    el.addEventListener("input", () => {
      const v = parseFloat(el.value);
      if (cfgPct.includes(id)) CONFIG[id] = isNaN(v) ? 0 : v / 100;
      else CONFIG[id] = isNaN(v) ? 0 : v;
      updateAllBadges();
      if (ACTIVE_TAB === "resumen") renderResumen();
      marcarCambio();
      if (cfgPct.includes(id)) actualizarChipDesperdicio();
    });
  });

  function actualizarChipDesperdicio() {
    const p = document.getElementById("cfg-C17");
    const j = document.getElementById("cfg-C17_JUNTAS");
    const val = document.getElementById("desperdicio-chip-valor");
    if (!p || !j || !val) return;
    const pv = p.value === "" ? "0" : p.value;
    const jv = j.value === "" ? "0" : j.value;
    val.textContent = pv + "% · " + jv + "%";
  }
  window.actualizarChipDesperdicio = actualizarChipDesperdicio;
  actualizarChipDesperdicio();

  const btnDesperdicioChip = document.getElementById("btn-desperdicio-chip");
  const desperdicioPopover = document.getElementById("desperdicio-popover");
  const desperdicioChipWrap = document.getElementById("desperdicio-chip-wrap");
  if (btnDesperdicioChip && desperdicioPopover && desperdicioChipWrap) {
    function posicionarPopoverDesperdicio() {
      const r = btnDesperdicioChip.getBoundingClientRect();
      desperdicioPopover.style.visibility = "hidden";
      desperdicioPopover.hidden = false;
      const w = desperdicioPopover.offsetWidth;
      desperdicioPopover.hidden = true;
      desperdicioPopover.style.visibility = "";
      const margen = 8;
      let left = r.right - w;
      left = Math.max(margen, Math.min(left, window.innerWidth - w - margen));
      desperdicioPopover.style.left = left + "px";
      desperdicioPopover.style.top = (r.bottom + 6) + "px";
    }
    btnDesperdicioChip.addEventListener("click", (e) => {
      e.stopPropagation();
      const abrir = desperdicioPopover.hidden;
      if (abrir) posicionarPopoverDesperdicio();
      desperdicioPopover.hidden = !abrir;
      btnDesperdicioChip.setAttribute("aria-expanded", abrir ? "true" : "false");
    });
    document.addEventListener("click", (e) => {
      if (!desperdicioPopover.hidden && !desperdicioChipWrap.contains(e.target) && !desperdicioPopover.contains(e.target)) {
        desperdicioPopover.hidden = true;
        btnDesperdicioChip.setAttribute("aria-expanded", "false");
      }
    });
    window.addEventListener("scroll", () => {
      desperdicioPopover.hidden = true;
      btnDesperdicioChip.setAttribute("aria-expanded", "false");
    }, { capture: true, passive: true });
  }

  attachTableEvents();

  const projIds = [["proj-nombre", "nombre"], ["proj-cliente", "cliente"], ["proj-fecha", "fecha"]];
  projIds.forEach(([elId, key]) => {
    const el = document.getElementById(elId);
    el.value = PROJECT_INFO[key];
    el.addEventListener("input", () => { PROJECT_INFO[key] = el.value; marcarCambio(); });
  });

  function posicionarDropdown(btn, panel) {
    const r = btn.getBoundingClientRect();
    panel.style.left = "0px";
    panel.style.top = "0px";
    panel.style.visibility = "hidden";
    panel.style.display = "flex";
    const panelWidth = panel.offsetWidth;
    const panelHeight = panel.offsetHeight;
    panel.style.display = "";
    panel.style.visibility = "";

    const margen = 8;
    let left = r.right - panelWidth;
    left = Math.max(margen, Math.min(left, window.innerWidth - panelWidth - margen));
    let top = r.bottom + 6;
    if (top + panelHeight > window.innerHeight - margen) {
      top = Math.max(margen, r.top - panelHeight - 6);
    }
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  }

  function registrarDropdown(btnId, panelId) {
    const btn = document.getElementById(btnId);
    const panel = document.getElementById(panelId);
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const yaAbierto = panel.classList.contains("open");
      document.querySelectorAll(".dropdown-panel.open").forEach(p => p.classList.remove("open"));
      if (!yaAbierto) {
        posicionarDropdown(btn, panel);
        panel.classList.add("open");
      }
    });
    panel.addEventListener("click", (e) => {
      if (e.target.closest(".dropdown-item")) panel.classList.remove("open");
    });
    return panel;
  }
  const menuPdfPanel = registrarDropdown("btn-menu-pdf", "dropdown-panel-pdf");
  const menuPanel = registrarDropdown("btn-menu-proyecto", "dropdown-panel-proyecto");
  document.addEventListener("click", (e) => {
    [["dropdown-pdf", menuPdfPanel], ["dropdown-proyecto", menuPanel]].forEach(([contId, panel]) => {
      if (!document.getElementById(contId).contains(e.target)) panel.classList.remove("open");
    });
  });
  window.addEventListener("scroll", () => {
    [menuPdfPanel, menuPanel].forEach(p => p.classList.remove("open"));
  }, { capture: true, passive: true });

  document.getElementById("btn-pdf-completo").addEventListener("click", () => descargarPDF("completo"));
  document.getElementById("btn-pdf-levantamiento").addEventListener("click", () => descargarPDF("levantamiento"));
  document.getElementById("btn-pdf-levantamiento-resumido").addEventListener("click", () => descargarPDF("levantamiento-resumido"));
  document.getElementById("btn-pdf-resumen").addEventListener("click", () => descargarPDF("resumen"));
  document.getElementById("btn-pdf-memoria").addEventListener("click", descargarMemoriaCalculoPDF);

  document.getElementById("btn-bd-export-penetrantes").addEventListener("click", exportarMatrizPenetrantesExcel);
  document.getElementById("btn-bd-export-juntas").addEventListener("click", exportarMatrizJuntasExcel);
  document.getElementById("btn-bd-import-penetrantes").addEventListener("click", () => document.getElementById("file-import-matriz-penetrantes").click());
  document.getElementById("btn-bd-import-juntas").addEventListener("click", () => document.getElementById("file-import-matriz-juntas").click());
  document.getElementById("file-import-matriz-penetrantes").addEventListener("change", (e) => {
    if (e.target.files[0]) importarMatrizPenetrantesExcel(e.target.files[0]);
    e.target.value = "";
  });
  document.getElementById("file-import-matriz-juntas").addEventListener("change", (e) => {
    if (e.target.files[0]) importarMatrizJuntasExcel(e.target.files[0]);
    e.target.value = "";
  });
  document.getElementById("btn-bd-restaurar").addEventListener("click", restaurarMatricesOriginales);
  document.getElementById("btn-descargar-sistemas").addEventListener("click", descargarSistemasUL);
  document.getElementById("btn-descargar-fichas").addEventListener("click", descargarFichasTecnicas);
  document.getElementById("btn-descargar-submittal").addEventListener("click", descargarSubmittal);
  document.getElementById("btn-pdf-planos").addEventListener("click", exportarPlanosPDF);

  document.getElementById("btn-archivo-nuevo").addEventListener("click", nuevoProyecto);
  const btnHome = document.getElementById("btn-home");
  if (btnHome) btnHome.addEventListener("click", () => { if (window.mostrarPantallaProyectos) window.mostrarPantallaProyectos(); });
  document.getElementById("btn-archivo-abrir").addEventListener("click", () => {
    document.getElementById("file-import-json").click();
  });
  document.getElementById("btn-archivo-guardar-como").addEventListener("click", exportarProyectoJSON);
  const btnToggleExcel = document.getElementById("btn-toggle-excel-texto");
  const subPanelExcel = document.getElementById("dropdown-sub-panel-excel");
  if (btnToggleExcel && subPanelExcel) {
    btnToggleExcel.addEventListener("click", (e) => {
      e.stopPropagation();
      subPanelExcel.classList.toggle("open");
      btnToggleExcel.classList.toggle("open");
    });
  }
  document.getElementById("btn-import-excel").addEventListener("click", () => {
    document.getElementById("file-import-excel").click();
  });
  document.getElementById("btn-export-excel").addEventListener("click", exportarLevantamientoExcel);
  document.getElementById("btn-export-excel-lev-pen").addEventListener("click", exportarLevantamientoPenetrantesExcel);
  document.getElementById("btn-export-excel-lev-juntas").addEventListener("click", exportarLevantamientoJuntasExcel);
  document.getElementById("file-import-json").addEventListener("change", (e) => {
    if (e.target.files[0]) importarProyectoJSON(e.target.files[0]);
    e.target.value = "";
  });
  document.getElementById("file-import-excel").addEventListener("change", (e) => {
    if (e.target.files[0]) importarExcel(e.target.files[0]);
    e.target.value = "";
  });

  actualizarBotonDeshacer();
  pedirAlmacenamientoPersistente();

  if (cargoEmbebido) {
    PROYECTO_ACTIVO_ID = "p_" + Date.now().toString(36) + "_embebido";
    PROYECTO_ACTIVO_CREADO_EN = new Date().toISOString();
    try { await idbGuardarActivo(PROYECTO_ACTIVO_ID); } catch (e) {}
    renderTable();
    renderLevantamientoTab();
    mostrarVistaProyecto();
    mostrarToast(`Proyecto cargado automáticamente: ${ROWS.length} fila(s).`);
  } else {
    if (window.esperarAutenticacion) await window.esperarAutenticacion();
    await migrarProyectoUnicoSiHaceFalta();
    if (window.mostrarPantallaProyectos) {
      await window.mostrarPantallaProyectos();
    } else {
      for (let i = 0; i < 3; i++) ROWS.push(nuevaFila());
      renderTable();
      renderLevantamientoTab();
      mostrarVistaProyecto();
    }
  }
  ocultarSplashInicial();
}

function ocultarSplashInicial() {
  const el = document.getElementById("splash-inicio");
  if (el) el.classList.add("splash-oculto");
}

function mostrarVistaProyecto() {
  document.body.classList.remove("app-arrancando");
}
function ocultarVistaProyecto() {
  document.body.classList.add("app-arrancando");
}

document.addEventListener("DOMContentLoaded", initApp);

window.soltarCandadoActivoSiHaceFalta = soltarCandadoActivoSiHaceFalta;
window.activarListenerProyectoActivo = activarListenerProyectoActivo;
window.ocultarSplashInicial = ocultarSplashInicial;
window.mostrarVistaProyecto = mostrarVistaProyecto;
window.ocultarVistaProyecto = ocultarVistaProyecto;
window.marcarCambio = marcarCambio;
window.UNDO_STACK = UNDO_STACK;
window.pushUndo = pushUndo;
window.deshacerCambio = deshacerCambio;
window.idbListarProyectos = idbListarProyectos;
window.idbGuardarProyecto = idbGuardarProyecto;
window.idbBorrarProyecto = idbBorrarProyecto;
window.idbLeerActivo = idbLeerActivo;
window.idbGuardarActivo = idbGuardarActivo;
window.idbGuardarMetaClave = idbGuardarMetaClave;
window.idbLeerMetaClave = idbLeerMetaClave;
window.abrirProyectoExistente = abrirProyectoExistente;
window.crearYAbrirProyectoNuevo = crearYAbrirProyectoNuevo;
})();
