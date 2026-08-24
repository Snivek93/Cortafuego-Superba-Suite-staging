// ============================================================================
// archivo-estado-app.js — encapsulado en IIFE (sin exponer todo a window; ver export list abajo)
// ============================================================================
// PROYECTO_ACTIVO_ID / PROYECTO_ACTIVO_CREADO_EN se declaran fuera del IIFE:
// proyectos.js los reasigna directamente al abrir/crear/borrar un proyecto.
var PROYECTO_ACTIVO_ID = null;
var PROYECTO_ACTIVO_CREADO_EN = null;
(function () {
// ARCHIVO — Nuevo / Abrir / Guardar / Guardar como (comportamiento tipo Word)
let CURRENT_FILE_HANDLE = null;
let CURRENT_FILE_NAME = null;
let ULTIMO_GUARDADO = null;
let FALLO_AUTOGUARDADO = false;
const FS_ACCESS_OK = typeof window.showSaveFilePicker === "function" && typeof window.showOpenFilePicker === "function";

function actualizarIndicadorArchivo() {
  const badge = document.getElementById("save-status-badge");
  const timeEl = document.getElementById("save-status-time");
  const wrap = document.getElementById("save-status");
  if (!badge || !timeEl || !wrap) return;
  const nombreTxt = CURRENT_FILE_NAME ? ` · ${CURRENT_FILE_NAME}` : "";
  // El fallo de autoguardado manda sobre cualquier otro estado: si no se pudo
  // guardar, el indicador se queda en rojo hasta que un guardado funcione. Un
  // toast no sirve acá porque se va solo a los 4 segundos y el usuario puede
  // seguir trabajando media hora creyendo que está todo guardado.
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

async function guardarComoArchivo() {
  let htmlStr;
  try { htmlStr = construirHTMLConDatos(); } catch (err) { mostrarToast("No se pudo generar el archivo: " + err.message, "error"); return; }
  const sugerido = nombreArchivoSugerido();
  if (FS_ACCESS_OK) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: sugerido,
        types: [{ description: "Aplicación con proyecto (HTML)", accept: { "text/html": [".html"] } }]
      });
      const writable = await handle.createWritable();
      await writable.write(htmlStr);
      await writable.close();
      CURRENT_FILE_HANDLE = handle;
      CURRENT_FILE_NAME = handle.name;
      marcarGuardado();
      mostrarToast(`Guardado como "${handle.name}".`);
    } catch (err) {
      if (err.name !== "AbortError") mostrarToast("No se pudo guardar el archivo: " + err.message, "error");
    }
  } else {
    descargarArchivo(sugerido, htmlStr, "text/html");
    CURRENT_FILE_HANDLE = null;
    CURRENT_FILE_NAME = sugerido;
    marcarGuardado();
    mostrarToast(`Descargado como "${sugerido}". "Guardar" lo volverá a descargar con este mismo nombre.`);
  }
}

async function guardarArchivo() {
  if (FS_ACCESS_OK && CURRENT_FILE_HANDLE) {
    try {
      const htmlStr = construirHTMLConDatos();
      const writable = await CURRENT_FILE_HANDLE.createWritable();
      await writable.write(htmlStr);
      await writable.close();
      marcarGuardado();
      mostrarToast(`Guardado en "${CURRENT_FILE_HANDLE.name}".`);
      return;
    } catch (err) {
      mostrarToast("No se pudo guardar en el archivo original. Elegí dónde guardar de nuevo.", "error");
      CURRENT_FILE_HANDLE = null;
    }
  }
  if (!FS_ACCESS_OK && CURRENT_FILE_NAME) {
    let htmlStr;
    try { htmlStr = construirHTMLConDatos(); } catch (err) { mostrarToast("No se pudo generar el archivo: " + err.message, "error"); return; }
    descargarArchivo(CURRENT_FILE_NAME, htmlStr, "text/html");
    marcarGuardado();
    mostrarToast(`Guardado como "${CURRENT_FILE_NAME}".`);
    return;
  }
  await guardarComoArchivo();
}

function extraerDatosDeHTML(texto) {
  const match = texto.match(/<script[^>]*id=["']embedded-project-data["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match || !match[1].trim()) return null;
  try { return JSON.parse(match[1]); } catch (e) { return null; }
}

async function procesarArchivoAbierto(file, handle) {
  const texto = await file.text();
  let data = null;
  if (/\.json$/i.test(file.name)) {
    try { data = JSON.parse(texto); } catch (e) { data = null; }
  } else {
    data = extraerDatosDeHTML(texto);
  }
  if (!data || !Array.isArray(data.filas)) {
    mostrarToast("No se pudo leer el archivo. Verificá que sea un proyecto guardado desde esta calculadora.", "error");
    return;
  }
  const aplicar = () => {
    aplicarProyectoImportado(data);
    CURRENT_FILE_HANDLE = handle || null;
    CURRENT_FILE_NAME = file.name;
    marcarGuardado();
  };
  if (ROWS.length > 0 || ROWS_J.length > 0) {
    pedirConfirmacion("Esto va a reemplazar el proyecto actual (sin guardar) por el del archivo. ¿Continuar?", aplicar);
  } else {
    aplicar();
  }
}

async function abrirArchivo() {
  if (FS_ACCESS_OK) {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: "Aplicación con proyecto (HTML o JSON)", accept: { "text/html": [".html"], "application/json": [".json"] } }]
      });
      const file = await handle.getFile();
      await procesarArchivoAbierto(file, handle);
    } catch (err) {
      if (err.name !== "AbortError") mostrarToast("No se pudo abrir el archivo: " + err.message, "error");
    }
  } else {
    document.getElementById("file-abrir-proyecto").click();
  }
}

async function nuevoProyecto() {
  // Antes esto vaciaba el proyecto actual en el lugar y pedía confirmación
  // porque era destructivo. Con multi-proyecto ya no lo es: el proyecto
  // anterior queda guardado tal cual, esto solo crea uno nuevo y cambia a él.
  await crearYAbrirProyectoNuevo();
  mostrarToast("Proyecto nuevo. Empezá agregando filas o un levantamiento.");
}

// ---------------------------------------------------------------------------
// AUTOGUARDADO — IndexedDB
// ---------------------------------------------------------------------------
// Antes esto vivía en localStorage, que en Safari iOS tope a ~5 MB. Con 6-20
// fotos por informe en base64 eso se llena y setItem lanza QuotaExceededError,
// que antes se tragaba un catch vacío: el usuario perdía la jornada sin aviso.
// IndexedDB no tiene ese techo (desde Safari 17 la cuota va hasta el 20-80%
// del disco según el tipo de app).
//
// OJO — lo que esto NO resuelve: el borrado de almacenamiento a los 7 días de
// iOS le pega igual a IndexedDB que a localStorage. Contra eso están: usar la
// app desde el ícono de pantalla de inicio (no una pestaña de Safari),
// navigator.storage.persist(), y exportar .fss de vez en cuando.
const AUTOSAVE_KEY = "hiltiCortafuegoAutoguardado_v1"; // clave vieja; solo se usa para migrar
const IDB_NOMBRE = "firestopSuite";
const IDB_VERSION = 2; // v2: agrega 'proyectos' y 'meta' sin tocar el store viejo (se migra, no se borra en el upgrade)
const IDB_STORE = "autoguardado"; // legacy v1 — solo lectura, para migración una sola vez
const IDB_CLAVE = "actual"; // legacy v1
const IDB_STORE_PROYECTOS = "proyectos"; // v2 — clave: id de proyecto, valor: mismo payload de siempre
const IDB_STORE_META = "meta"; // v2 — clave 'activo': id del proyecto abierto actualmente
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
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("No se pudo abrir IndexedDB"));
    req.onblocked = () => reject(new Error("IndexedDB bloqueada por otra pestaña"));
  });
  return IDB_PROMESA;
}
// --- Legacy v1 (un solo slot) — solo se usan para leer/migrar/limpiar ---
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
// --- v2 multi-proyecto ---
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

// Le pide al navegador que no expulse estos datos cuando ande apretado de
// espacio. Es best-effort: si lo niega, no pasa nada malo. Hay que pedirlo en
// cada arranque porque algunos navegadores lo resetean al cerrar.
async function pedirAlmacenamientoPersistente() {
  try {
    if (!navigator.storage || !navigator.storage.persist) return;
    if (await navigator.storage.persisted()) return;
    await navigator.storage.persist();
  } catch (e) { /* best-effort: no hay datos en riesgo si falla */ }
}

function avisarFalloGuardado(err) {
  console.error("Autoguardado falló:", err);
  const primeraVez = !FALLO_AUTOGUARDADO;
  FALLO_AUTOGUARDADO = true;
  actualizarIndicadorArchivo();
  // El toast solo la primera vez: el indicador rojo es el que queda fijo.
  if (primeraVez && window.mostrarToast) {
    mostrarToast("No se pudo guardar automáticamente. Exportá el proyecto (.fss) ya para no perder el trabajo.", "error");
  }
}

let autosaveTimer = null;
let guardadoEnCurso = false;
let guardadoPendiente = false;
async function guardarAutoAhora() {
  // Si ya hay una escritura en vuelo, se marca pendiente y se reintenta al
  // terminar — evita que dos guardados se pisen y queden fuera de orden.
  if (guardadoEnCurso) { guardadoPendiente = true; return; }
  // Sin proyecto activo no hay dónde guardar (ej. justo antes de que
  // termine de arrancar la Pantalla de Proyectos). No es un error.
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
}
function marcarCambio() {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(guardarAutoAhora, 600);
}

// Migración desde el localStorage viejo: se corre una sola vez, la primera vez
// que la app arranca con IndexedDB vacío. Solo borra el localStorage DESPUÉS de
// confirmar que la escritura en IndexedDB funcionó.
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
    // Si no se pudo escribir en IndexedDB, se deja el localStorage intacto y se
    // devuelven los datos igual para no perder la sesión del usuario.
    console.error("No se pudo migrar el autoguardado a IndexedDB:", e);
  }
  return data;
}
function autoguardadoTieneContenido(data) {
  if (!data) return false;
  // Antes esto solo miraba `filas`, así que un proyecto con informes o planos
  // pero sin filas de levantamiento se descartaba al recargar. Bug real.
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
    // Aunque IndexedDB falle, se intenta leer el localStorage viejo por si hay
    // algo rescatable de antes de la migración.
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

// ---------------------------------------------------------------------------
// MULTI-PROYECTO — abrir / crear / migrar
// ---------------------------------------------------------------------------
// Vuelca un payload guardado (mismo formato de siempre) sobre el estado en
// memoria de la app. Reutilizado tanto al abrir un proyecto existente como
// al restaurar el activo en el arranque.
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
}

// Abre un proyecto que YA existe en el store 'proyectos'. Devuelve false sin
// tocar nada si el id no existe (ej. el puntero 'activo' quedó apuntando a
// algo que se borró) — el que llama decide qué hacer en ese caso.
async function abrirProyectoExistente(id) {
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
  try { await idbGuardarActivo(id); } catch (e) { /* best-effort: si falla, se reintenta el próximo guardado */ }
  cargarProyectoEnApp(data);
  CURRENT_FILE_HANDLE = null;
  CURRENT_FILE_NAME = null;
  UNDO_STACK.length = 0;
  actualizarBotonDeshacer();
  ULTIMO_GUARDADO = data.guardadoEn ? new Date(data.guardadoEn) : null;
  FALLO_AUTOGUARDADO = false;
  actualizarIndicadorArchivo();
  return true;
}

// Crea un proyecto vacío y lo deja como activo. No escribe nada en IndexedDB
// todavía — el primer autoguardado (marcarCambio → guardarAutoAhora) es el
// que efectivamente lo persiste bajo este id. Si el usuario no le pone
// nombre, PROJECT_INFO.nombre queda vacío y la Pantalla de Proyectos lo
// muestra en "Borradores" con la fecha de creación.
async function crearYAbrirProyectoNuevo() {
  const id = "p_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
  PROYECTO_ACTIVO_ID = id;
  PROYECTO_ACTIVO_CREADO_EN = new Date().toISOString();
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
  CURRENT_FILE_HANDLE = null;
  CURRENT_FILE_NAME = null;
  UNDO_STACK.length = 0;
  actualizarBotonDeshacer();
  ULTIMO_GUARDADO = null;
  FALLO_AUTOGUARDADO = false;
  actualizarIndicadorArchivo();
  return id;
}

// Se corre una sola vez en el arranque: si todavía no existe ningún proyecto
// en el store nuevo pero hay algo rescatable del slot único viejo (v1
// IndexedDB o el localStorage de antes), lo convierte en el primer proyecto
// de la lista y lo deja activo — el usuario ni se entera de la migración.
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
    await idbBorrar(); // ya está copiado — limpia el slot viejo para no migrar dos veces
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

  document.getElementById("btn-compartir").addEventListener("click", compartirReporte);

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
  const btnMisProyectos = document.getElementById("btn-mis-proyectos");
  if (btnMisProyectos) btnMisProyectos.addEventListener("click", () => { if (window.mostrarPantallaProyectos) window.mostrarPantallaProyectos(); });
  const btnCerrarSesion = document.getElementById("btn-cerrar-sesion");
  if (btnCerrarSesion) btnCerrarSesion.addEventListener("click", () => {
    if (window.pedirConfirmacion) {
      pedirConfirmacion("¿Cerrar sesión?", () => { if (window.cerrarSesion) cerrarSesion(); });
    } else if (confirm("¿Cerrar sesión?")) {
      if (window.cerrarSesion) cerrarSesion();
    }
  });
  document.getElementById("btn-archivo-abrir").addEventListener("click", abrirArchivo);
  document.getElementById("btn-archivo-guardar").addEventListener("click", guardarArchivo);
  document.getElementById("btn-archivo-guardar-como").addEventListener("click", guardarComoArchivo);
  document.getElementById("file-abrir-proyecto").addEventListener("change", (e) => {
    if (e.target.files[0]) procesarArchivoAbierto(e.target.files[0], null);
    e.target.value = "";
  });
  document.getElementById("btn-export-json").addEventListener("click", exportarProyectoJSON);
  document.getElementById("btn-import-json").addEventListener("click", () => {
    document.getElementById("file-import-json").click();
  });
  document.getElementById("btn-import-excel").addEventListener("click", () => {
    document.getElementById("file-import-excel").click();
  });
  document.getElementById("btn-export-excel").addEventListener("click", exportarLevantamientoExcel);
  document.getElementById("btn-export-excel-lev-pen").addEventListener("click", exportarLevantamientoPenetrantesExcel);
  document.getElementById("btn-export-excel-lev-juntas").addEventListener("click", exportarLevantamientoJuntasExcel);
  document.getElementById("btn-import-txt").addEventListener("click", () => {
    document.getElementById("file-import-txt").click();
  });
  document.getElementById("file-import-json").addEventListener("change", (e) => {
    if (e.target.files[0]) importarProyectoJSON(e.target.files[0]);
    e.target.value = "";
  });
  document.getElementById("file-import-excel").addEventListener("change", (e) => {
    if (e.target.files[0]) importarExcel(e.target.files[0]);
    e.target.value = "";
  });
  document.getElementById("file-import-txt").addEventListener("change", (e) => {
    if (e.target.files[0]) importarTxt(e.target.files[0]);
    e.target.value = "";
  });

  actualizarBotonDeshacer();
  pedirAlmacenamientoPersistente();

  if (cargoEmbebido) {
    // Un .html abierto con datos embebidos se trata como proyecto nuevo
    // propio (con su propio id), así el autoguardado normal lo protege
    // igual que a cualquier otro proyecto.
    PROYECTO_ACTIVO_ID = "p_" + Date.now().toString(36) + "_embebido";
    PROYECTO_ACTIVO_CREADO_EN = new Date().toISOString();
    try { await idbGuardarActivo(PROYECTO_ACTIVO_ID); } catch (e) {}
    renderTable();
    renderLevantamientoTab();
    mostrarToast(`Proyecto cargado automáticamente: ${ROWS.length} fila(s).`);
  } else {
    if (window.esperarAutenticacion) await window.esperarAutenticacion();
    await migrarProyectoUnicoSiHaceFalta();
    let activoId = null;
    try { activoId = await idbLeerActivo(); } catch (e) { activoId = null; }
    const restaurado = activoId ? await abrirProyectoExistente(activoId) : false;
    if (restaurado) {
      mostrarToast(`Se restauró tu último proyecto: ${ROWS.length} fila(s).`);
    } else if (window.mostrarPantallaProyectos) {
      await window.mostrarPantallaProyectos();
    } else {
      // Red de seguridad si proyectos.js no llegó a cargar por algún motivo.
      for (let i = 0; i < 3; i++) ROWS.push(nuevaFila());
      renderTable();
      renderLevantamientoTab();
    }
  }
}

document.addEventListener("DOMContentLoaded", initApp);

window.marcarCambio = marcarCambio;
window.UNDO_STACK = UNDO_STACK;
window.pushUndo = pushUndo;
window.deshacerCambio = deshacerCambio;
window.idbListarProyectos = idbListarProyectos;
window.idbBorrarProyecto = idbBorrarProyecto;
window.idbLeerActivo = idbLeerActivo;
window.idbGuardarActivo = idbGuardarActivo;
window.abrirProyectoExistente = abrirProyectoExistente;
window.crearYAbrirProyectoNuevo = crearYAbrirProyectoNuevo;
})();
