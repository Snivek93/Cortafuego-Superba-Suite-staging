// ============================================================================
// informes-acreditacion.js — encapsulado en IIFE (sin exponer todo a window; ver export list abajo)
// ============================================================================
// INFORMES_ACREDITACION e INFORME_ACR_SEQ se declaran fuera del IIFE a propósito
// (con `var`, no `let`) — mismo patrón que PLANOS/PLANO_SEQ en planos.js. El
// guardado/carga de proyecto les hace reasignación directa, no solo mutación.
var INFORMES_ACREDITACION = [];
var INFORME_ACR_SEQ = 1;

(function () {
// --- Checklist cerrado (aprobado por Kevin) --------------------------------
const ACR_CHECKLIST_CUMPLE = {
  penetrante: [
    "Espesor de sello cumple el mínimo del sistema (contacto continuo / aplicación tipo volcán o anillo)",
    "Espesor de sello cumple el mínimo en espacio anular",
    "Vueltas de cinta intumescente correctas según sistema",
    "Collar metálico de retención presente y correctamente instalado",
    "Lana mineral de alta densidad como respaldo/relleno según sistema",
    "Instalación verificada por ambas caras de la pared/losa",
    "Sin compromisos de integridad visibles",
  ],
  junta_interior: [
    "Espesor de sello de junta cumple el mínimo del sistema",
    "Instalación verificada por ambos lados de la pared",
    "Junta sellada de forma continua, sin compromisos de integridad visibles",
  ],
  junta_muro_cortina: [
    "Espesor de spray/sellador cumple el mínimo del sistema",
    "Traslape correcto hacia la losa de concreto",
    "Traslape correcto hacia el elemento de fachada (aluminio/marco)",
    "Acabado uniforme sin discontinuidades",
  ],
};
const ACR_CHECKLIST_NOCUMPLE_COMUN = [
  "Espesor insuficiente respecto al mínimo del sistema",
  "Sello desplazado o movido posterior a la instalación",
  "Orificio o hueco detectado (sellado incompleto)",
  "Material distinto al especificado en el sistema UL",
  "Instalación pendiente (aún no ejecutada, con método/producto ya definido)",
  "Daño por terceros / contratistas externos, requiere reparación",
];
const ACR_CHECKLIST_NOCUMPLE = {
  penetrante: [
    "Faltan vueltas de cinta intumescente",
    "Falta collar metálico de retención",
    "Falta lana mineral de respaldo donde el sistema la requiere",
    "Falta instalación por una de las dos caras de la pared",
  ],
  junta_interior: [
    "Traslape insuficiente hacia losa/pared",
  ],
  junta_muro_cortina: [
    "Traslape insuficiente hacia losa/pared",
    "Traslape insuficiente hacia elemento de fachada (muro cortina)",
  ],
};
const ACR_CHECKLIST_LABEL_CORTO = {
  "Espesor de sello cumple el mínimo del sistema (contacto continuo / aplicación tipo volcán o anillo)": "Espesor OK (contacto continuo)",
  "Espesor de sello cumple el mínimo en espacio anular": "Espesor OK (espacio anular)",
  "Vueltas de cinta intumescente correctas según sistema": "Cinta correcta",
  "Collar metálico de retención presente y correctamente instalado": "Collar OK",
  "Lana mineral de alta densidad como respaldo/relleno según sistema": "Lana mineral OK",
  "Instalación verificada por ambas caras de la pared/losa": "Verificado ambas caras",
  "Sin compromisos de integridad visibles": "Sin daños visibles",
  "Espesor de sello de junta cumple el mínimo del sistema": "Espesor OK",
  "Instalación verificada por ambos lados de la pared": "Verificado ambos lados",
  "Junta sellada de forma continua, sin compromisos de integridad visibles": "Sellado continuo, sin daños",
  "Espesor de spray/sellador cumple el mínimo del sistema": "Espesor OK",
  "Traslape correcto hacia la losa de concreto": "Traslape a losa OK",
  "Traslape correcto hacia el elemento de fachada (aluminio/marco)": "Traslape a fachada OK",
  "Acabado uniforme sin discontinuidades": "Acabado uniforme",
  "Espesor insuficiente respecto al mínimo del sistema": "Espesor insuficiente",
  "Sello desplazado o movido posterior a la instalación": "Sello desplazado",
  "Orificio o hueco detectado (sellado incompleto)": "Orificio/hueco",
  "Material distinto al especificado en el sistema UL": "Material distinto",
  "Instalación pendiente (aún no ejecutada, con método/producto ya definido)": "Instalación pendiente",
  "Daño por terceros / contratistas externos, requiere reparación": "Daño por terceros",
  "Faltan vueltas de cinta intumescente": "Faltan vueltas de cinta",
  "Falta collar metálico de retención": "Falta collar metálico",
  "Falta lana mineral de respaldo donde el sistema la requiere": "Falta lana mineral",
  "Falta instalación por una de las dos caras de la pared": "Falta por una cara",
  "Traslape insuficiente hacia losa/pared": "Traslape insuficiente",
  "Traslape insuficiente hacia elemento de fachada (muro cortina)": "Traslape insuf. (fachada)",
};
function labelCortoChecklist(item) { return ACR_CHECKLIST_LABEL_CORTO[item] || item; }
const ACR_RECOMENDACION = {
  "Espesor insuficiente respecto al mínimo del sistema": "aumentar el espesor del sello hasta cumplir el mínimo indicado por el sistema UL",
  "Sello desplazado o movido posterior a la instalación": "repasar y resellar el punto afectado",
  "Orificio o hueco detectado (sellado incompleto)": "completar el sellado de forma pareja, sin huecos",
  "Material distinto al especificado en el sistema UL": "sustituir por el material especificado en el sistema UL correspondiente",
  "Instalación pendiente (aún no ejecutada, con método/producto ya definido)": "completar la instalación con el método y producto ya definidos",
  "Daño por terceros / contratistas externos, requiere reparación": "reparar el sector dañado por terceros",
  "Faltan vueltas de cinta intumescente": "completar las vueltas de cinta intumescente requeridas por el sistema",
  "Falta collar metálico de retención": "instalar el collar metálico de retención",
  "Falta lana mineral de respaldo donde el sistema la requiere": "instalar la lana mineral de respaldo requerida",
  "Falta instalación por una de las dos caras de la pared": "completar la instalación por la cara faltante de la pared",
  "Traslape insuficiente hacia losa/pared": "aumentar el traslape hacia la losa/pared hasta el mínimo requerido",
  "Traslape insuficiente hacia elemento de fachada (muro cortina)": "aumentar el traslape hacia el elemento de fachada hasta el mínimo requerido",
};

function normaParaSubtipo(categoria, subtipo) {
  if (categoria === "penetrante") return "UL 1479 / ASTM E814";
  if (subtipo === "muro_cortina") return "ASTM E2307 (UL y/o Intertek)";
  return "UL 2079 / ASTM E1966";
}
const PRODUCTOS_CON_CINTA = new Set(["Cinta con Collar Metálico CP 648-E/ER", "Cinta sin Collar Metálico CP 648-E"]);
const PRODUCTOS_CON_COLLAR_METALICO = new Set(["Cinta con Collar Metálico CP 648-E/ER", "Collarín CP 643N/644"]);
const TIPOS_CON_LANA_MINERAL = new Set([
  "Bandeja de Cables", "Ducto Rectangular", "Ducto Rectangular Aislado", "Ducto Redondo", "Ducto Redondo Aislado",
  "Pasante Múltiple", "Vacío", "Viga W", "Viga Canal", "Viga Tubo Rectangular",
]);
const PRODUCTOS_CON_LANA_MINERAL = new Set([
  "Espuma CP 620", "Almohadilla CFS-BL", 'Manga CP 653 4"', 'Paso de cables MSL M 3"x4"', 'Paso de cables MSL L 6"x4"', "Mortero CP 637",
]);
function elementoUsaCinta(el) { return PRODUCTOS_CON_CINTA.has(el.producto); }
function elementoUsaCollarMetalico(el) { return PRODUCTOS_CON_COLLAR_METALICO.has(el.producto); }
function elementoUsaLanaMineral(el) { return TIPOS_CON_LANA_MINERAL.has(el.tipoPenetrante) || PRODUCTOS_CON_LANA_MINERAL.has(el.producto); }
function checklistNoCumpleFor(el) {
  if (el.categoria !== "penetrante") {
    const especifico = el.subtipo === "muro_cortina" ? ACR_CHECKLIST_NOCUMPLE.junta_muro_cortina : ACR_CHECKLIST_NOCUMPLE.junta_interior;
    let items = ACR_CHECKLIST_NOCUMPLE_COMUN.concat(especifico);
    if (el.producto !== "CFS SP WB") {
      items = items.filter((i) => i !== "Traslape insuficiente hacia losa/pared" && i !== "Traslape insuficiente hacia elemento de fachada (muro cortina)");
    }
    return items;
  }
  let items = ACR_CHECKLIST_NOCUMPLE_COMUN.concat(ACR_CHECKLIST_NOCUMPLE.penetrante);
  if (!elementoUsaCinta(el)) {
    items = items.filter((i) => i !== "Faltan vueltas de cinta intumescente");
  } else {
    items = items.filter((i) => i !== "Espesor insuficiente respecto al mínimo del sistema");
  }
  if (!elementoUsaCollarMetalico(el)) items = items.filter((i) => i !== "Falta collar metálico de retención");
  if (!elementoUsaLanaMineral(el)) items = items.filter((i) => i !== "Falta lana mineral de respaldo donde el sistema la requiere");
  if (el.ubicacion !== "Pared") items = items.filter((i) => i !== "Falta instalación por una de las dos caras de la pared");
  return items;
}

function esTuberiaCombustible(tipo) {
  return !!tipo && tipo.indexOf("Tubería Combustible") === 0;
}
const PRODUCTOS_DIAMETRO_MAYOR_2 = new Set(["Cinta con Collar Metálico CP 648-E/ER", "Cinta sin Collar Metálico CP 648-E", "Collarín CP 643N/644"]);
function productoRequiereDiametroMayor2(producto) { return PRODUCTOS_DIAMETRO_MAYOR_2.has(producto); }
function opcionesProductoPenetrante(material, tipo, ubicacion, espacioAnular, diametro) {
  if (!material || !tipo || !ubicacion) return [];
  if (esTuberiaCombustible(tipo) && !diametro) return [];
  const ap = espacioAnular ? "Otro" : 0;
  const out = [];
  (window.OPTS_P || []).forEach((p) => {
    if (esTuberiaCombustible(tipo)) {
      const requiereMayor2 = productoRequiereDiametroMayor2(p);
      if (diametro === "mayor2" && !requiereMayor2) return;
      if (diametro === "menor2" && requiereMayor2) return;
    }
    const key = window.dbKey(material, tipo, ubicacion, ap, p);
    const row = window.MAIN_TABLE ? window.MAIN_TABLE[key] : null;
    if (row) out.push({ producto: p, sistemaUL: row[1], espesor: row[0] });
  });
  return out;
}
function resolverFilaJunta(junta, tipo, barreras, posicion, producto) {
  const candidatos = (window.JUNTAS_TABLE || []).filter((r) => r.j === junta && r.t === tipo && r.b === barreras && r.p === posicion && r.prod === producto);
  if (!candidatos.length) return null;
  return candidatos.reduce((a, b) => (b.max > a.max ? b : a));
}
function fraccion(v) {
  return (window.formatFraccionPulgadas ? window.formatFraccionPulgadas(v) : `${v}"`);
}
function ubicacionLabel(material) {
  return material === "Panel de Yeso" ? "Pared de Panel Liviano" : "Pared o Losa de Concreto";
}
function nombreElemento(el) {
  return el.categoria === "penetrante" ? el.tipoPenetrante : `Junta ${el.juntaTipo}`;
}
function descripcionElemento(el) {
  if (el.categoria === "penetrante") {
    return ubicacionLabel(el.material);
  }
  const pos = el.juntaPosicion ? `${el.juntaPosicion} — ` : "";
  return `${pos}${el.juntaBarreras}`;
}

let ACR_VISTA = "historial"; // historial | galeria | form | editorFoto
let ACR_DRAFT = null;
let ACR_EDITANDO_ID = null;
let ACR_ZONA_ACTIVA = null;
let ACR_ELEMENTO_FORM = null;
let ACR_ELEMENTO_EDITANDO_ID = null;
let ACR_FOTO_EDIT = null;
let ACR_DESC_FOTO_MODAL_ID = null; // id de la foto cuyo popup de descripción está abierto
let ACR_DESC_FOTO_ES_NUEVA = false; // true = se abrió justo tras tomar la foto (fondo pantalla completa)
let ACR_FOTO_MODO_BORRAR = false; // true = tocar una foto la marca para borrar (no para el informe)
let ACR_FOTOS_A_BORRAR = new Set();
let ACR_FOTO_CONFIRMAR_BORRAR = null; // { ids: [...] } cuando se pidió confirmación
let ACR_CHECKLIST_EXPANDIDO = new Set();
let ACR_OBSERVACION_ABIERTA = new Set();
let ACR_DATOS_GENERALES_ABIERTO = true;
let ACR_OBS_GENERAL_ABIERTA = false;
function claveChecklist(elId, zona) { return `${elId}|${zona || ""}`; }
const ACR_PALETA = ["#e2001a", "#ff9900", "#0072ce", "#111111", "#ffffff"];

function ultimoInformeGuardado() {
  if (!INFORMES_ACREDITACION.length) return null;
  return INFORMES_ACREDITACION.slice().sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""))[0];
}
function nuevoBorradorInforme() {
  const anterior = ultimoInformeGuardado();
  return {
    id: null,
    fecha: new Date().toISOString().slice(0, 10),
    proyecto: (window.PROJECT_INFO && window.PROJECT_INFO.nombre) || "",
    ubicacion: anterior ? (anterior.ubicacion || "") : "",
    cliente: (window.PROJECT_INFO && window.PROJECT_INFO.cliente) || (anterior ? anterior.cliente : "") || "",
    empresaInstaladora: anterior ? anterior.empresaInstaladora : "",
    acompanantes: [],
    inspector: anterior ? anterior.inspector : "kevin",
    zonas: [],
    fotos: [],
    elementos: [],
    checklistModo: "general",
    checklist: { general: {}, porZona: {} },
    esSeguimiento: false,
    seguimientoTexto: "",
    observaciones: "",
    textoInformeManual: null,
    planoRefs: [],
    tipoInforme: "avance", // "avance" | "final"
  };
}
function estadoChecklistDefault(categoria, subtipo) {
  return { cumple: true, marcados: [], observacion: "" };
}
function obtenerEstadoChecklist(elementoId, zona) {
  if (ACR_DRAFT.checklistModo === "porZona" && zona) {
    if (!ACR_DRAFT.checklist.porZona[zona]) ACR_DRAFT.checklist.porZona[zona] = {};
    if (!ACR_DRAFT.checklist.porZona[zona][elementoId]) ACR_DRAFT.checklist.porZona[zona][elementoId] = estadoChecklistDefault();
    return ACR_DRAFT.checklist.porZona[zona][elementoId];
  }
  if (!ACR_DRAFT.checklist.general[elementoId]) ACR_DRAFT.checklist.general[elementoId] = estadoChecklistDefault();
  return ACR_DRAFT.checklist.general[elementoId];
}

function abrirVisorAcreditacion() {
  ACR_VISTA = "historial";
  ACR_DRAFT = null;
  let overlay = document.getElementById("acr-visor-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "acr-visor-overlay";
    overlay.className = "acr-visor-overlay";
    document.body.appendChild(overlay);
  }
  document.body.classList.add("modal-open");
  renderAcreditacion();
}
function cerrarVisorAcreditacion() {
  const overlay = document.getElementById("acr-visor-overlay");
  if (overlay) overlay.remove();
  document.body.classList.remove("modal-open");
  ACR_DRAFT = null;
  ACR_FOTO_EDIT = null;
}

function abrirNuevoInforme() {
  ACR_DRAFT = nuevoBorradorInforme();
  ACR_EDITANDO_ID = null;
  ACR_VISTA = "galeria";
  ACR_DATOS_GENERALES_ABIERTO = !(ACR_DRAFT.proyecto && ACR_DRAFT.cliente && ACR_DRAFT.empresaInstaladora);
  ACR_OBS_GENERAL_ABIERTA = false;
  renderAcreditacion();
}
function abrirEditarInforme(id) {
  const informe = INFORMES_ACREDITACION.find((i) => i.id === id);
  if (!informe) return;
  ACR_DRAFT = JSON.parse(JSON.stringify(informe));
  ACR_EDITANDO_ID = id;
  ACR_VISTA = "galeria";
  ACR_DATOS_GENERALES_ABIERTO = true;
  ACR_OBS_GENERAL_ABIERTA = false;
  renderAcreditacion();
}
function duplicarInforme(id) {
  const informe = INFORMES_ACREDITACION.find((i) => i.id === id);
  if (!informe) return;
  const copia = JSON.parse(JSON.stringify(informe));
  copia.id = INFORME_ACR_SEQ++;
  copia.fecha = new Date().toISOString().slice(0, 10);
  INFORMES_ACREDITACION.push(copia);
  if (window.marcarCambio) marcarCambio();
  renderAcreditacion();
  if (window.mostrarToast) mostrarToast("Informe duplicado — ajustá la fecha y los datos de esta nueva visita.");
}
function eliminarInforme(id) {
  const hacer = () => {
    INFORMES_ACREDITACION = INFORMES_ACREDITACION.filter((i) => i.id !== id);
    if (window.marcarCambio) marcarCambio();
    renderAcreditacion();
  };
  if (window.pedirConfirmacion) pedirConfirmacion("¿Eliminar este informe de acreditación? No se puede deshacer.", hacer);
  else hacer();
}
function guardarInformeDesdeFormulario() {
  if (!ACR_DRAFT.fecha) { if (window.mostrarToast) mostrarToast("Ingresá la fecha de la visita.", "error"); return; }
  if (ACR_EDITANDO_ID != null) {
    const idx = INFORMES_ACREDITACION.findIndex((i) => i.id === ACR_EDITANDO_ID);
    if (idx !== -1) INFORMES_ACREDITACION[idx] = Object.assign({}, ACR_DRAFT, { id: ACR_EDITANDO_ID });
  } else {
    INFORMES_ACREDITACION.push(Object.assign({}, ACR_DRAFT, { id: INFORME_ACR_SEQ++ }));
  }
  if (window.marcarCambio) marcarCambio();
  ACR_VISTA = "historial";
  ACR_DRAFT = null;
  renderAcreditacion();
  if (window.mostrarToast) mostrarToast("Informe de acreditación guardado.");
}
function cancelarFormularioInforme() {
  const hacer = () => { ACR_VISTA = "historial"; ACR_DRAFT = null; renderAcreditacion(); };
  if (window.pedirConfirmacion) pedirConfirmacion("¿Salir sin guardar? Se pierden los cambios de este informe.", hacer);
  else hacer();
}

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function renderAcreditacion() {
  const overlay = document.getElementById("acr-visor-overlay");
  if (!overlay) return;
  const contPrevio = overlay.querySelector(".acr-content");
  const scrollPrevio = contPrevio ? contPrevio.scrollTop : 0;
  const titulos = { historial: "Informes de Acreditación", galeria: "Fotos del recorrido", form: "Informe de Acreditación" };
  const volverA = { historial: null, galeria: "historial", form: "galeria" };
  const accionesDerecha = {
    galeria: `<button type="button" class="acr-topbar-right-btn" data-acr-action="siguiente-a-form">Siguiente</button>`,
  };
  const enEditorFoto = ACR_VISTA === "editorFoto";
  overlay.innerHTML = `
    ${enEditorFoto ? "" : `
    <div class="acr-topbar">
      <button type="button" id="acr-btn-volver" class="lev-exit-btn"><svg class="icon"><use href="#i-arrow-left"/></svg>${volverA[ACR_VISTA] ? "Atrás" : "Cerrar"}</button>
      <span class="acr-topbar-title">${titulos[ACR_VISTA]}</span>
      <span class="acr-topbar-right">${accionesDerecha[ACR_VISTA] || ""}</span>
    </div>`}
    <div class="acr-content ${enEditorFoto ? "acr-content-editor" : ""}">
      ${ACR_VISTA === "historial" ? renderHistorialHTML() : ""}
      ${ACR_VISTA === "galeria" ? renderGaleriaHTML() : ""}
      ${ACR_VISTA === "form" ? renderFormularioHTML() : ""}
      ${enEditorFoto ? renderEditorFotoHTML() : ""}
    </div>
    ${ACR_DESC_FOTO_MODAL_ID != null ? renderModalDescripcionFotoHTML() : ""}
    ${ACR_FOTO_CONFIRMAR_BORRAR ? renderModalConfirmarBorrarFotoHTML() : ""}
  `;
  attachEventos(overlay);
  const contNuevo = overlay.querySelector(".acr-content");
  if (contNuevo) contNuevo.scrollTop = scrollPrevio;
  if (ACR_VISTA === "editorFoto") inicializarCanvasEditor();
}

function estadoInformeLabel(informe) {
  const total = informe.elementos.length;
  if (total === 0) return { texto: "Sin elementos", clase: "acr-badge-neutro" };
  const estados = informe.checklistModo === "porZona"
    ? Object.values(informe.checklist.porZona || {}).flatMap((z) => Object.values(z))
    : Object.values(informe.checklist.general || {});
  const noCumplen = estados.filter((e) => !e.cumple).length;
  if (noCumplen === 0) return { texto: "Todo cumple", clase: "acr-badge-ok" };
  return { texto: `${noCumplen} pendiente(s)`, clase: "acr-badge-warn" };
}
function renderHistorialHTML() {
  const lista = INFORMES_ACREDITACION.slice().sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  const filas = lista.map((informe) => {
    const estado = estadoInformeLabel(informe);
    const firmanteLabel = informe.inspector === "sebastian" ? "Arq. Sebastián Rojas Sonderegger" : "Ing. Kevin Soto Navarro";
    return `
      <div class="acr-card">
        <div class="acr-card-main">
          <div class="acr-card-fecha">${escapeHtml(informe.fecha || "(sin fecha)")}</div>
          <div class="acr-card-sub">${escapeHtml(firmanteLabel)} · ${informe.elementos.length} elemento(s) · ${informe.fotos.length} foto(s)</div>
          <span class="acr-badge ${estado.clase}">${estado.texto}</span>
        </div>
        <div class="acr-card-actions">
          <button type="button" class="secondary icon-only-btn" data-acr-action="generar-pdf" data-id="${informe.id}" title="Generar PDF"><svg class="icon"><use href="#i-download"/></svg></button>
          <button type="button" class="secondary icon-only-btn" data-acr-action="editar" data-id="${informe.id}" title="Editar"><svg class="icon"><use href="#i-edit"/></svg></button>
          <button type="button" class="secondary icon-only-btn" data-acr-action="duplicar" data-id="${informe.id}" title="Duplicar"><svg class="icon"><use href="#i-copy"/></svg></button>
          <button type="button" class="secondary icon-only-btn" data-acr-action="eliminar" data-id="${informe.id}" title="Eliminar"><svg class="icon"><use href="#i-trash"/></svg></button>
        </div>
      </div>`;
  }).join("");
  return `
    <div class="acr-historial">
      <button type="button" class="primary" data-acr-action="nuevo"><svg class="icon"><use href="#i-plus"/></svg>Nuevo informe de acreditación</button>
      ${lista.length ? `<div class="acr-lista">${filas}</div>` : `<p class="hint" style="margin-top:16px">Todavía no hay informes de acreditación en este proyecto.</p>`}
    </div>`;
}

function todasSeleccionadas() {
  return ACR_DRAFT.fotos.length > 0 && ACR_DRAFT.fotos.every((f) => f.seleccionada);
}
function renderModalDescripcionFotoHTML() {
  const foto = ACR_DRAFT.fotos.find((f) => f.id === ACR_DESC_FOTO_MODAL_ID);
  if (!foto) return "";
  if (ACR_DESC_FOTO_ES_NUEVA) {
    // Foto recién tomada: la foto queda de fondo a pantalla completa (mismo
    // tratamiento visual que el editor) con el popup de descripción encima.
    return `
      <div class="acr-visor-foto acr-visor-foto-fullscreen acr-desc-foto-fondo">
        <div class="acr-editor-canvas-wrap"><img src="${foto.dataUrl}" alt="Foto" class="acr-desc-foto-fondo-img"></div>
        <div class="acr-desc-foto-overlay acr-desc-foto-overlay-sobre-fondo">
          <div class="acr-desc-foto-modal">
            <div class="acr-desc-foto-header">
              <span>Descripción de la foto</span>
              <button type="button" class="primary" data-acr-action="desc-foto-aplicar">Aplicar</button>
            </div>
            <textarea id="acr-desc-foto-input" placeholder="Ej. Vista general del muro cortafuego (opcional)" rows="4">${escapeHtml(foto.descripcion)}</textarea>
          </div>
        </div>
      </div>`;
  }
  return `
    <div class="acr-desc-foto-overlay">
      <div class="acr-desc-foto-modal">
        <div class="acr-desc-foto-header">
          <button type="button" class="secondary" data-acr-action="desc-foto-cancelar">Atrás</button>
          <span>Descripción de la foto</span>
          <button type="button" class="primary" data-acr-action="desc-foto-aplicar">Aplicar</button>
        </div>
        <textarea id="acr-desc-foto-input" placeholder="Ej. Vista general del muro cortafuego" rows="4">${escapeHtml(foto.descripcion)}</textarea>
      </div>
    </div>`;
}

function renderGaleriaHTML() {
  const fotos = ACR_DRAFT.fotos;
  const seleccionadas = fotos.filter((f) => f.seleccionada).length;
  const modoBorrar = ACR_FOTO_MODO_BORRAR;
  let numFigura = 0;
  const items = fotos.map((f, idx) => {
    const marcadaParaBorrar = ACR_FOTOS_A_BORRAR.has(f.id);
    if (f.seleccionada) numFigura++;
    const prefijoFigura = f.seleccionada ? `<strong>Figura ${numFigura}.</strong> ` : "";
    return `
    <div class="acr-foto-item ${f.seleccionada ? "acr-foto-seleccionada" : ""} ${marcadaParaBorrar ? "acr-foto-marcada-borrar" : ""}" data-acr-drag-item data-id="${f.id}" ${modoBorrar ? "" : `draggable="true"`}>
      <div class="acr-foto-thumb-wrap" ${modoBorrar ? `data-acr-action="toggle-foto-borrar" data-id="${f.id}"` : ""}>
        <img src="${f.dataUrl}" alt="Foto ${idx + 1}">
        ${modoBorrar ? `
          <span class="acr-foto-check-borrar ${marcadaParaBorrar ? "active" : ""}"><svg class="icon"><use href="#i-check"/></svg></span>
        ` : `
          <button type="button" class="acr-foto-check-btn ${f.seleccionada ? "active" : ""}" data-acr-action="toggle-foto" data-idx="${idx}" title="${f.seleccionada ? "Quitar del informe" : "Incluir en el informe"}" aria-label="Seleccionar foto">
            <svg class="icon"><use href="#i-check"/></svg>
          </button>
          <button type="button" class="acr-foto-icon-btn acr-foto-icon-borrar" data-acr-action="pedir-borrar-foto" data-id="${f.id}" title="Borrar" aria-label="Borrar foto"><svg class="icon"><use href="#i-trash"/></svg></button>
          <button type="button" class="acr-foto-icon-btn acr-foto-icon-editar" data-acr-action="editar-foto" data-id="${f.id}" title="Editar" aria-label="Editar foto"><svg class="icon"><use href="#i-edit"/></svg></button>
        `}
      </div>
      <p class="acr-foto-desc-preview" ${modoBorrar ? "" : `data-acr-action="editar-descripcion-foto" data-id="${f.id}"`}>${prefijoFigura}${f.descripcion ? escapeHtml(f.descripcion) : '<span class="hint">Sin descripción — tocá para agregarla</span>'}</p>
    </div>`;
  }).join("");
  return `
    <div class="acr-galeria">
      ${modoBorrar ? "" : `
      <label class="primary acr-btn-add-foto">
        <svg class="icon"><use href="#i-camera"/></svg>Añadir foto
        <input type="file" accept="image/*" multiple id="acr-input-fotos" hidden>
      </label>`}
      ${fotos.length ? `
        <div class="acr-galeria-selectbar">
          ${modoBorrar ? `
            <span class="hint">${ACR_FOTOS_A_BORRAR.size} de ${fotos.length} marcadas para borrar</span>
            <div class="acr-galeria-selectbar-botones">
              <button type="button" class="secondary" data-acr-action="cancelar-modo-borrar">Cancelar</button>
              <button type="button" class="danger" data-acr-action="pedir-borrar-varias" ${ACR_FOTOS_A_BORRAR.size ? "" : "disabled"}>Borrar (${ACR_FOTOS_A_BORRAR.size})</button>
            </div>
          ` : `
            <span class="hint">${seleccionadas} de ${fotos.length} seleccionadas — solo las seleccionadas van al informe</span>
            <div class="acr-galeria-selectbar-botones">
              <button type="button" class="secondary" data-acr-action="toggle-seleccion-todas">${todasSeleccionadas() ? "Deseleccionar todas" : "Seleccionar todas"}</button>
              <button type="button" class="secondary" data-acr-action="activar-modo-borrar">Seleccionar para borrar</button>
            </div>
          `}
        </div>
        <div class="acr-fotos-grid">${items}</div>
      ` : `<p class="hint" style="margin-top:16px">Todavía no agregaste fotos. Tocá "Añadir foto" arriba.</p>`}
    </div>`;
}

function renderModalConfirmarBorrarFotoHTML() {
  const n = ACR_FOTO_CONFIRMAR_BORRAR.ids.length;
  return `
    <div class="acr-desc-foto-overlay">
      <div class="acr-desc-foto-modal acr-confirmar-modal">
        <p class="acr-confirmar-texto">${n === 1 ? "¿Borrar esta foto? No se puede deshacer." : `¿Borrar ${n} fotos? No se puede deshacer.`}</p>
        <div class="acr-confirmar-botones">
          <button type="button" class="secondary" data-acr-action="cancelar-borrar-foto">Cancelar</button>
          <button type="button" class="danger" data-acr-action="confirmar-borrar-foto">Borrar</button>
        </div>
      </div>
    </div>`;
}



function renderAcompanantesHTML() {
  return ACR_DRAFT.acompanantes.map((a, idx) => `
    <div class="acr-acompanante-row">
      <input type="text" data-acr-field="acompanante-nombre" data-idx="${idx}" value="${escapeHtml(a.nombre)}" placeholder="Nombre">
      <input type="text" data-acr-field="acompanante-cargo" data-idx="${idx}" value="${escapeHtml(a.cargo)}" placeholder="Cargo / empresa">
      <button type="button" class="secondary icon-only-btn" data-acr-action="quitar-acompanante" data-idx="${idx}" title="Quitar"><svg class="icon"><use href="#i-trash"/></svg></button>
    </div>`).join("");
}
function renderZonasHTML() {
  const chips = ACR_DRAFT.zonas.map((z, idx) => `
    <span class="acr-tag">${escapeHtml(z)}<button type="button" data-acr-action="quitar-zona" data-idx="${idx}" aria-label="Quitar">&times;</button></span>`).join("");
  return `
    <div class="acr-tags-wrap">${chips}</div>
    <div class="acr-tag-input-row">
      <input type="text" id="acr-input-zona" placeholder="Ej. Nivel 20, Sótano, Torre B...">
      <button type="button" class="secondary" data-acr-action="agregar-zona">Agregar</button>
    </div>`;
}
function renderSelectorElemento() {
  return `
    <div class="acr-elemento-add-buttons">
      <button type="button" class="secondary" data-acr-action="abrir-elemento-penetrante"><svg class="icon"><use href="#i-plus"/></svg>Agregar tipo de penetrante</button>
      <button type="button" class="secondary" data-acr-action="abrir-elemento-junta"><svg class="icon"><use href="#i-plus"/></svg>Agregar junta</button>
      <button type="button" class="secondary" data-acr-action="precargar-levantamiento"><svg class="icon"><use href="#i-download"/></svg>Precargar de Levantamiento</button>
    </div>`;
}
function elementoClaveDedup(e) {
  return e.categoria === "penetrante"
    ? ["p", e.material, e.tipoPenetrante, e.ubicacion, e.espacioAnular ? 1 : 0, e.diametro || "", e.producto].join("|")
    : ["j", e.juntaTipo, e.juntaBarreras, e.juntaPosicion, e.producto].join("|");
}
function precargarElementosDesdeLevantamiento() {
  const vistos = new Set(ACR_DRAFT.elementos.map(elementoClaveDedup));
  const agregados = [];
  (window.ROWS || []).forEach((r) => {
    if (!r || !r.L || !r.N || !r.M || !r.P) return;
    const espacioAnular = (window.n ? window.n(r.I) : parseFloat(r.I)) > 0;
    let diametro = "";
    if (esTuberiaCombustible(r.L)) {
      const d = window.n ? window.n(r.D) : parseFloat(r.D);
      if (!d) return;
      diametro = d > 2 ? "mayor2" : "menor2";
    }
    const opciones = opcionesProductoPenetrante(r.N, r.L, r.M, espacioAnular, diametro);
    const encontrado = opciones.find((o) => o.producto === r.P);
    if (!encontrado) return;
    const nuevo = {
      id: Date.now() + Math.random(), categoria: "penetrante", subtipo: null,
      material: r.N, tipoPenetrante: r.L, ubicacion: r.M, espacioAnular, diametro: diametro || null,
      producto: r.P, sistemaUL: encontrado.sistemaUL, espesor: encontrado.espesor, traslape: null,
    };
    const key = elementoClaveDedup(nuevo);
    if (vistos.has(key)) return;
    vistos.add(key);
    agregados.push(nuevo);
  });
  (window.ROWS_J || []).forEach((r) => {
    if (!r || !r.tipo || !r.barreras || !r.producto) return;
    const junta = window.juntaParaTipo ? window.juntaParaTipo(r.tipo) : null;
    const posiciones = r.posicionPI === "Superior e Inferior" ? ["Superior", "Inferior"] : [r.posicion || r.posicionPI].filter(Boolean);
    posiciones.forEach((posicion) => {
      const fila = resolverFilaJunta(junta, r.tipo, r.barreras, posicion, r.producto);
      if (!fila) return;
      const nuevo = {
        id: Date.now() + Math.random(), categoria: "junta", subtipo: r.tipo === "Muro Cortina" ? "muro_cortina" : "interior",
        juntaTipo: r.tipo, juntaBarreras: r.barreras, juntaPosicion: posicion, producto: r.producto,
        sistemaUL: fila.sis, espesor: fila.esp, traslape: fila.tras || null,
      };
      const key = elementoClaveDedup(nuevo);
      if (vistos.has(key)) return;
      vistos.add(key);
      agregados.push(nuevo);
    });
  });
  if (!agregados.length) {
    if (window.mostrarToast) mostrarToast("No hay tipos nuevos en Levantamiento para precargar.");
    return;
  }
  ACR_DRAFT.elementos = ACR_DRAFT.elementos.concat(agregados);
  if (window.mostrarToast) mostrarToast(`Se precargaron ${agregados.length} tipo(s) desde Levantamiento.`);
  renderAcreditacion();
}
function renderElementosLista() {
  if (!ACR_DRAFT.elementos.length) return `<p class="hint">Todavía no agregaste ningún tipo de penetrante ni junta.</p>`;
  return ACR_DRAFT.elementos.map((el) => `
    <div class="acr-elemento-card">
      <div>
        <strong>${escapeHtml(nombreElemento(el))}</strong>
        <span class="hint">${escapeHtml(descripcionElemento(el))}</span>
      </div>
      <div class="acr-elemento-card-actions">
        <button type="button" class="secondary icon-only-btn" data-acr-action="editar-elemento" data-id="${el.id}" title="Editar"><svg class="icon"><use href="#i-edit"/></svg></button>
        <button type="button" class="secondary icon-only-btn" data-acr-action="quitar-elemento" data-id="${el.id}" title="Quitar"><svg class="icon"><use href="#i-trash"/></svg></button>
      </div>
    </div>`).join("");
}
function renderChecklistParaElemento(el, zona) {
  const estado = obtenerEstadoChecklist(el.id, zona);
  const clave = claveChecklist(el.id, zona);
  const expandido = ACR_CHECKLIST_EXPANDIDO.has(clave);
  const chips = estado.cumple ? "" : checklistNoCumpleFor(el).map((item) => `
    <button type="button" class="acr-chip ${estado.marcados.includes(item) ? "active" : ""}" data-acr-action="toggle-check" data-elid="${el.id}" data-zona="${escapeHtml(zona || "")}" data-item="${escapeHtml(item)}">${escapeHtml(labelCortoChecklist(item))}</button>`).join("");
  const obsAbierta = ACR_OBSERVACION_ABIERTA.has(clave) || !!estado.observacion;
  return `
    <div class="acr-checklist-elemento">
      <div class="acr-checklist-elemento-header">
        <button type="button" class="acr-checklist-elemento-toggle" data-acr-action="toggle-expandir-checklist" data-elid="${el.id}" data-zona="${escapeHtml(zona || "")}">
          <span class="acr-checklist-elemento-titulo">${escapeHtml(nombreElemento(el))} <span class="hint">${escapeHtml(descripcionElemento(el))}</span></span>
          <span class="acr-checklist-estado-badge ${estado.cumple ? "ok" : "warn"}">${estado.cumple ? "Cumple" : "No cumple"}</span>
          <svg class="icon acr-chevron ${expandido ? "acr-chevron-abierto" : ""}"><use href="#i-chevron-down"/></svg>
        </button>
        <div class="acr-checklist-elemento-actions">
          <button type="button" class="secondary icon-only-btn" data-acr-action="editar-elemento" data-id="${el.id}" title="Editar"><svg class="icon"><use href="#i-edit"/></svg></button>
          <button type="button" class="secondary icon-only-btn" data-acr-action="quitar-elemento" data-id="${el.id}" title="Quitar"><svg class="icon"><use href="#i-trash"/></svg></button>
        </div>
      </div>
      ${expandido ? `
        <div class="acr-toggle-cumple">
          <button type="button" class="${estado.cumple ? "active" : ""}" data-acr-action="toggle-cumple" data-elid="${el.id}" data-zona="${escapeHtml(zona || "")}">Cumple</button>
          <button type="button" class="${!estado.cumple ? "active" : ""}" data-acr-action="toggle-cumple" data-elid="${el.id}" data-zona="${escapeHtml(zona || "")}">No cumple</button>
        </div>
        ${estado.cumple
          ? `<p class="hint">Cumple con todos los requerimientos del sistema UL (espesores, vueltas de cinta si aplica, ambas caras, sin daños ni orificios, producto correcto).</p>`
          : `<div class="acr-chips">${chips}</div>`}
        ${obsAbierta
          ? `<textarea data-acr-field="checklist-observacion" data-elid="${el.id}" data-zona="${escapeHtml(zona || "")}" rows="2" placeholder="Observación puntual (opcional)">${escapeHtml(estado.observacion)}</textarea>`
          : `<button type="button" class="acr-link-btn" data-acr-action="abrir-observacion" data-elid="${el.id}" data-zona="${escapeHtml(zona || "")}">+ Agregar observación</button>`}
      ` : ""}
    </div>`;
}
function renderChecklistSeccion() {
  if (!ACR_DRAFT.elementos.length) return `<p class="hint">Agregá al menos un tipo de penetrante o junta arriba para poder marcar el checklist.</p>`;
  const modoGeneral = ACR_DRAFT.checklistModo === "general";
  let contenido;
  if (modoGeneral) {
    contenido = ACR_DRAFT.elementos.map((el) => renderChecklistParaElemento(el, null)).join("");
  } else {
    if (!ACR_DRAFT.zonas.length) {
      contenido = `<p class="hint">Agregá al menos una zona en el Alcance para poder marcar el checklist por zona.</p>`;
    } else {
      if (!ACR_ZONA_ACTIVA || !ACR_DRAFT.zonas.includes(ACR_ZONA_ACTIVA)) ACR_ZONA_ACTIVA = ACR_DRAFT.zonas[0];
      const tabs = ACR_DRAFT.zonas.map((z) => `<button type="button" class="acr-zona-tab ${z === ACR_ZONA_ACTIVA ? "active" : ""}" data-acr-action="cambiar-zona-activa" data-zona="${escapeHtml(z)}">${escapeHtml(z)}</button>`).join("");
      contenido = `<div class="acr-zona-tabs">${tabs}</div>` + ACR_DRAFT.elementos.map((el) => renderChecklistParaElemento(el, ACR_ZONA_ACTIVA)).join("");
    }
  }
  return `
    <div class="acr-toggle-cumple" style="max-width:340px">
      <button type="button" class="${modoGeneral ? "active" : ""}" data-acr-action="checklist-modo" data-modo="general">General (todo el proyecto)</button>
      <button type="button" class="${!modoGeneral ? "active" : ""}" data-acr-action="checklist-modo" data-modo="porZona">Por zona</button>
    </div>
    ${contenido}`;
}
function nombreInspector(codigo) {
  return codigo === "sebastian" ? "Arq. Sebastián Rojas Sonderegger" : "Ing. Kevin Soto Navarro";
}
function nombreInspectorFirma(codigo) {
  return codigo === "sebastian" ? "Arq. Sebastián Rojas Sonderegger" : "Ing. Kevin Soto Navarro (IC-31624)";
}
function renderDatosGeneralesHTML() {
  const d = ACR_DRAFT;
  const abierto = ACR_DATOS_GENERALES_ABIERTO;
  const resumenPartes = [d.proyecto, d.cliente, d.empresaInstaladora, nombreInspector(d.inspector)].filter(Boolean);
  return `
    <div class="acr-subseccion">
      <button type="button" class="acr-subseccion-toggle" data-acr-action="toggle-datos-generales" aria-expanded="${abierto}">
        <span class="acr-subseccion-titulo" style="margin:0">Datos generales</span>
        ${!abierto && resumenPartes.length ? `<span class="hint acr-datos-generales-resumen">${escapeHtml(resumenPartes.join(" · "))}</span>` : ""}
        <svg class="icon acr-chevron ${abierto ? "acr-chevron-abierto" : ""}"><use href="#i-chevron-down"/></svg>
      </button>
      ${abierto ? `
        <div class="acr-field-row">
          <label class="acr-field-label">Tipo de informe
            <select data-acr-field="tipoInforme">
              <option value="avance" ${d.tipoInforme !== "final" ? "selected" : ""}>Avance</option>
              <option value="final" ${d.tipoInforme === "final" ? "selected" : ""}>Final</option>
            </select>
          </label>
        </div>
        <div class="acr-field-row">
          <label class="acr-field-label">Proyecto
            <input type="text" data-acr-field="proyecto" value="${escapeHtml(d.proyecto)}">
          </label>
          <label class="acr-field-label">Contratista
            <input type="text" data-acr-field="cliente" value="${escapeHtml(d.cliente)}">
          </label>
        </div>
        <label class="acr-field-label">Ubicación del proyecto
          <input type="text" data-acr-field="ubicacion" value="${escapeHtml(d.ubicacion || "")}" placeholder="Ej. San Pedro de Montes de Oca">
        </label>
        <div class="acr-field-row">
          <label class="acr-field-label">Fecha de la visita
            <input type="date" data-acr-field="fecha" value="${escapeHtml(d.fecha)}">
          </label>
          <label class="acr-field-label">Empresa instaladora
            <input type="text" data-acr-field="empresaInstaladora" value="${escapeHtml(d.empresaInstaladora)}">
          </label>
        </div>
        <label class="acr-field-label">Inspector
          <select data-acr-field="inspector">
            <option value="kevin" ${d.inspector === "kevin" ? "selected" : ""}>Ing. Kevin Soto Navarro</option>
            <option value="sebastian" ${d.inspector === "sebastian" ? "selected" : ""}>Arq. Sebastián Rojas Sonderegger</option>
          </select>
        </label>
        <div class="acr-subseccion-titulo" style="font-size:var(--fs-sm);margin-top:6px">Acompañantes de la visita</div>
        ${renderAcompanantesHTML()}
        <div class="acr-acompanante-botones">
          <button type="button" class="secondary" data-acr-action="agregar-acompanante"><svg class="icon"><use href="#i-plus"/></svg>Agregar acompañante</button>
          ${!d.acompanantes.length && ultimoInformeGuardado() && ultimoInformeGuardado().acompanantes.length ? `
            <button type="button" class="secondary" data-acr-action="repetir-acompanantes"><svg class="icon"><use href="#i-copy"/></svg>Repetir del informe anterior</button>
          ` : ""}
        </div>
      ` : ""}
    </div>`;
}
function renderFormularioHTML() {
  const d = ACR_DRAFT;
  return `
    <div class="acr-formulario">
      ${renderDatosGeneralesHTML()}

      <div class="acr-subseccion">
        <div class="acr-subseccion-titulo">Alcance — niveles / zonas visitados</div>
        ${renderZonasHTML()}
      </div>

      <div class="acr-subseccion">
        <div class="acr-subseccion-titulo">Plano del recorrido</div>
        <p class="hint" style="margin:0 0 8px">Anotá el recorrido o zonas revisadas sobre el plano. Las marcas son exclusivas de este informe y no afectan los pines de Levantamiento.</p>
        ${renderSeccionPlanosHTML()}
      </div>

      <div class="acr-subseccion">
        <div class="acr-subseccion-titulo">Tipos de penetrante / juntas presentes</div>
        ${renderSelectorElemento()}
        ${renderChecklistSeccion()}
      </div>

      <div class="acr-subseccion">
        <label class="acr-checkbox-label">
          <input type="checkbox" data-acr-field="esSeguimiento" ${d.esSeguimiento ? "checked" : ""}>
          Esta visita da seguimiento a un incumplimiento detectado antes
        </label>
        ${d.esSeguimiento ? `
          <label class="acr-field-label">¿Qué se detectó en la visita anterior y qué se corrigió?
            <textarea data-acr-field="seguimientoTexto" rows="2">${escapeHtml(d.seguimientoTexto)}</textarea>
          </label>` : ""}
      </div>

      <div class="acr-subseccion">
        ${ACR_OBS_GENERAL_ABIERTA || d.observaciones ? `
        <label class="acr-field-label">Observaciones adicionales / notas (van antes del texto de cumplimiento en el informe final)
          <textarea data-acr-field="observaciones" rows="3">${escapeHtml(d.observaciones)}</textarea>
        </label>` : `
        <button type="button" class="acr-link-btn" data-acr-action="abrir-observacion-general">+ Agregar observaciones adicionales</button>`}
      </div>

      <div class="acr-subseccion">
        <button type="button" class="secondary" data-acr-action="abrir-texto-informe">${d.textoInformeManual != null ? "Ver / editar" : "Ver"} texto del informe</button>
        ${d.textoInformeManual != null ? `<p class="hint">Este texto fue editado a mano — el PDF va a usar esta versión, no la generada automáticamente.</p>` : ""}
      </div>

      <div class="acr-form-footer">
        <button type="button" class="secondary" data-acr-action="cancelar">Cancelar</button>
        <button type="button" class="primary" data-acr-action="guardar"><svg class="icon"><use href="#i-save"/></svg>Guardar informe</button>
      </div>
    </div>`;
}

function acrChip(campo, valor, label, activo) {
  return `<button type="button" class="lev-chip ${activo ? "lev-chip-active" : ""}" data-acr-elform-chip="${campo}" data-valor="${escapeHtml(String(valor))}">${escapeHtml(label)}</button>`;
}
function acrChipIcon(campo, valor, label, activo, iconIds) {
  if (!iconIds) return acrChip(campo, valor, label, activo);
  const ids = Array.isArray(iconIds) ? iconIds : [iconIds];
  const iconsHtml = ids.map((id) => `<svg class="icon-junta"><use href="#${id}"/></svg>`).join("");
  return `<button type="button" class="lev-chip lev-chip-icon ${activo ? "lev-chip-active" : ""}" data-acr-elform-chip="${campo}" data-valor="${escapeHtml(String(valor))}">
    <span class="icon-junta-row">${iconsHtml}</span>
    <span>${escapeHtml(label)}</span>
  </button>`;
}
function acrChipCombo(campos, valores, label, activo) {
  return `<button type="button" class="lev-chip ${activo ? "lev-chip-active" : ""}" data-acr-elform-combo="${campos.join(",")}" data-valores="${escapeHtml(valores.join("|"))}">${escapeHtml(label)}</button>`;
}
const DIAMETROS_PULG_PRESET = [2.5, 3, 4, 6, 8, 10, 12];
const COMBOS_UBICACION_MATERIAL = [
  { label: "Pared de Concreto", ubicacion: "Pared", material: "Concreto" },
  { label: "Pared de Panel de Yeso", ubicacion: "Pared", material: "Panel de Yeso" },
  { label: "Losa de Concreto", ubicacion: "Entrepiso", material: "Concreto" },
];
function abrirModalElemento(categoria, editandoId) {
  if (editandoId != null) {
    const el = ACR_DRAFT.elementos.find((x) => x.id === editandoId);
    if (!el) return;
    ACR_ELEMENTO_EDITANDO_ID = editandoId;
    ACR_ELEMENTO_FORM = el.categoria === "penetrante"
      ? { categoria: "penetrante", material: el.material, tipo: el.tipoPenetrante, ubicacion: el.ubicacion, espacioAnular: el.espacioAnular, diametroPulg: el.diametroPulg != null ? String(el.diametroPulg) : "", producto: el.producto }
      : { categoria: "junta", tipo: el.juntaTipo, barreras: el.juntaBarreras, posicion: el.juntaPosicion, producto: el.producto };
  } else {
    ACR_ELEMENTO_EDITANDO_ID = null;
    ACR_ELEMENTO_FORM = categoria === "penetrante"
      ? { categoria, material: "", tipo: "", ubicacion: "", espacioAnular: false, diametro: "", producto: "" }
      : { categoria, tipo: "", barreras: "", posicion: "", producto: "" };
  }
  let overlay = document.getElementById("acr-elemento-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "acr-elemento-overlay";
    overlay.className = "instr-modal-overlay open";
    document.body.appendChild(overlay);
  }
  renderModalElemento();
}
function cerrarModalElemento() {
  const overlay = document.getElementById("acr-elemento-overlay");
  if (overlay) overlay.remove();
  ACR_ELEMENTO_FORM = null;
  ACR_ELEMENTO_EDITANDO_ID = null;
}
function renderModalElemento() {
  const overlay = document.getElementById("acr-elemento-overlay");
  if (!overlay) return;
  const contentPrevio = overlay.querySelector(".instr-modal-content");
  const scrollPrevio = contentPrevio ? contentPrevio.scrollTop : 0;
  const f = ACR_ELEMENTO_FORM;
  let contenidoHtml;
  if (f.categoria === "penetrante") {
    const esCombustible = esTuberiaCombustible(f.tipo);
    const esAislada = /Aislada/i.test(f.tipo || "");
    const diametroPulgNum = parseFloat(f.diametroPulg);
    const enOtroDiametro = !!f.diametroOtro || (f.diametroPulg && !DIAMETROS_PULG_PRESET.some((dp) => Math.abs(diametroPulgNum - dp) < 0.001));
    const faltaDiametro = esCombustible && !(f.diametroPulg && !isNaN(diametroPulgNum) && diametroPulgNum > 0);
    const diametroCategoria = esCombustible && !faltaDiametro ? (diametroPulgNum > 2 ? "mayor2" : "menor2") : "";
    const opciones = (f.material && f.tipo && f.ubicacion && !faltaDiametro) ? opcionesProductoPenetrante(f.material, f.tipo, f.ubicacion, f.espacioAnular, diametroCategoria) : [];
    contenidoHtml = `
      <div class="acr-modal-seccion">
        <div class="acr-modal-seccion-titulo">Tipo de penetrante</div>
        <div class="lev-chip-grid">${(window.OPTS_L || []).map((t) => acrChip("tipo", t, (window.TIPO_LABEL_CORTO && window.TIPO_LABEL_CORTO[t]) || t, f.tipo === t)).join("")}</div>
      </div>
      ${f.tipo ? `
      <div class="acr-modal-seccion">
        <div class="acr-modal-seccion-titulo">Ubicación</div>
        <div class="lev-chip-grid lev-chip-grid-compact">
          ${COMBOS_UBICACION_MATERIAL.map((c) => acrChipCombo(["ubicacion", "material"], [c.ubicacion, c.material], c.label, f.ubicacion === c.ubicacion && f.material === c.material)).join("")}
        </div>
      </div>
      <div class="acr-modal-seccion">
        <div class="acr-modal-seccion-titulo">Espacio anular</div>
        <div class="lev-chip-grid lev-chip-grid-compact">
          ${acrChip("espacioAnular", "0", "Sin espacio anular", !f.espacioAnular)}
          ${acrChip("espacioAnular", "1", "Con espacio anular", !!f.espacioAnular)}
        </div>
      </div>
      ${esCombustible ? `
      <div class="acr-modal-seccion">
        <div class="acr-modal-seccion-titulo">${esAislada ? "Diámetro exterior total (con aislante)" : "Diámetro de la tubería"}</div>
        <div class="lev-chip-grid lev-chip-grid-compact">
          ${DIAMETROS_PULG_PRESET.map((dp) => acrChip("diametroPulg", String(dp), `${dp}"`, !enOtroDiametro && Math.abs(diametroPulgNum - dp) < 0.001)).join("")}
          <button type="button" class="lev-chip ${enOtroDiametro ? "lev-chip-active" : ""}" data-acr-diametro-otro>Otro</button>
        </div>
        ${enOtroDiametro ? `<input type="number" step="0.125" min="0" inputmode="decimal" class="acr-field-label" style="width:100%;font-size:16px;padding:9px 11px;border:1px solid var(--border);border-radius:var(--radius-sm);margin-top:8px" data-acr-elform-input="diametroPulg" value="${f.diametroPulg || ""}" placeholder='Ej. 5 o 6.5' autofocus>` : ""}
        <p class="hint" style="margin:4px 0 0">${esAislada
          ? "Medí por fuera del aislante. Ese diámetro total (tubería + aislante) es el que define el sistema y las vueltas de cinta — no el diámetro de la tubería sola."
          : `El diámetro exacto define el sistema (Pasta/Sellador ≤2", Cinta/Collarín &gt;2") y, si aplica cinta, el número de vueltas correcto.`}</p>
      </div>` : ""}` : ""}
      ${f.material && f.tipo && f.ubicacion && !faltaDiametro ? (opciones.length ? `
        <div class="acr-modal-seccion">
          <div class="acr-modal-seccion-titulo">Producto instalado</div>
          ${opciones.map((o) => `<button type="button" class="acr-producto-opcion ${f.producto === o.producto ? "active" : ""}" data-acr-elform-chip="producto" data-valor="${escapeHtml(o.producto)}"><strong>${escapeHtml(o.producto)}</strong><span class="hint">Sistema ${escapeHtml(o.sistemaUL)} — mín. ${fraccion(o.espesor)}</span></button>`).join("")}
        </div>` : `<p class="hint">No hay un sistema UL registrado para esa combinación — probá otra ubicación o espacio anular.</p>`) : ""}`;
  } else {
    const tipos = (window.todosLosTipos ? window.todosLosTipos() : []).map((x) => x.tipo);
    const junta = f.tipo && window.juntaParaTipo ? window.juntaParaTipo(f.tipo) : null;
    const barreras = f.tipo && junta && window.barrerasParaTipo ? window.barrerasParaTipo(junta, f.tipo) : [];
    // Si la materialidad tiene una sola opción posible, se autoselecciona y no
    // se le pregunta al usuario — evita un tap redundante cuando no hay
    // elección real que hacer.
    if (barreras.length === 1 && f.barreras !== barreras[0]) { f.barreras = barreras[0]; f.posicion = ""; f.producto = ""; }
    const posiciones = f.tipo && f.barreras && window.posicionesParaCombo ? window.posicionesParaCombo(junta, f.tipo, f.barreras) : [];
    // Mismo criterio para Posición: si con la materialidad ya elegida solo
    // hay una posición posible (Paralelo/Perpendicular u otra), se salta el
    // paso. Si hay más de una y cambian de sistema (como Concreto-Yeso), sí
    // se pregunta porque ahí la posición cambia el sistema UL aplicable.
    if (posiciones.length === 1 && f.posicion !== posiciones[0]) { f.posicion = posiciones[0]; f.producto = ""; }
    const productos = f.tipo && f.barreras && f.posicion && window.productosParaCombo ? window.productosParaCombo(junta, f.tipo, f.barreras, f.posicion) : [];
    const iconoTipo = window.iconoJuntaTipo ? window.iconoJuntaTipo(junta, f.tipo) : null;
    contenidoHtml = `
      <div class="acr-modal-seccion">
        <div class="acr-modal-seccion-titulo">Tipo de junta</div>
        <div class="lev-chip-grid">${tipos.map((t) => {
          const j = window.juntaParaTipo ? window.juntaParaTipo(t) : null;
          const icono = window.iconoJuntaTipo ? window.iconoJuntaTipo(j, t) : null;
          return acrChipIcon("tipo", t, t, f.tipo === t, icono);
        }).join("")}</div>
      </div>
      ${f.tipo && barreras.length > 1 ? `
      <div class="acr-modal-seccion">
        <div class="acr-modal-seccion-titulo">Materialidad de bordes</div>
        <div class="lev-chip-grid">${barreras.map((b) => acrChip("barreras", b, b, f.barreras === b)).join("")}</div>
      </div>` : ""}
      ${f.barreras && posiciones.length > 1 ? `
      <div class="acr-modal-seccion">
        <div class="acr-modal-seccion-titulo">Posición</div>
        <div class="lev-chip-grid lev-chip-grid-compact">${posiciones.map((p) => {
          const icono = window.iconoJuntaPosicion ? window.iconoJuntaPosicion(f.tipo, p) : null;
          return acrChipIcon("posicion", p, p, f.posicion === p, icono);
        }).join("")}</div>
      </div>` : ""}
      ${f.posicion ? `
      <div class="acr-modal-seccion">
        <div class="acr-modal-seccion-titulo">Producto instalado</div>
        <div class="lev-chip-grid lev-chip-grid-compact">${productos.map((p) => acrChip("producto", p, p, f.producto === p)).join("")}</div>
      </div>` : ""}`;
  }
  const puedeConfirmar = f.categoria === "penetrante" ? !!f.producto : !!(f.tipo && f.barreras && f.posicion && f.producto);
  overlay.innerHTML = `
    <div class="instr-modal acr-elemento-modal">
      <div class="instr-modal-header">
        <span>${ACR_ELEMENTO_EDITANDO_ID != null ? "Editar" : "Agregar"} ${f.categoria === "penetrante" ? "tipo de penetrante" : "junta"}</span>
        <button type="button" data-acr-elmodal-cerrar aria-label="Cerrar"><svg class="icon"><use href="#i-close"/></svg></button>
      </div>
      <div class="instr-modal-content">
        ${contenidoHtml}
        <div class="acr-form-footer" style="padding-top:8px">
          <button type="button" class="secondary" data-acr-elmodal-cerrar>Cancelar</button>
          <button type="button" class="primary ${puedeConfirmar ? "" : "acr-btn-incompleto"}" data-acr-elmodal-confirmar>${ACR_ELEMENTO_EDITANDO_ID != null ? "Guardar cambios" : "Añadir"}</button>
        </div>
      </div>
    </div>`;
  bindModalElementoEventos(overlay);
  const contentNuevo = overlay.querySelector(".instr-modal-content");
  if (contentNuevo) contentNuevo.scrollTop = scrollPrevio;
}
function bindModalElementoEventos(overlay) {
  if (overlay.dataset.acrElBind) return;
  overlay.dataset.acrElBind = "1";
  overlay.addEventListener("click", (evt) => {
    const combo = evt.target.closest("[data-acr-elform-combo]");
    if (combo) {
      const campos = combo.getAttribute("data-acr-elform-combo").split(",");
      const valores = combo.getAttribute("data-valores").split("|");
      campos.forEach((campo, i) => { ACR_ELEMENTO_FORM[campo] = valores[i]; });
      ACR_ELEMENTO_FORM.producto = "";
      renderModalElemento();
      return;
    }
    const chip = evt.target.closest("[data-acr-elform-chip]");
    if (chip) {
      const campo = chip.getAttribute("data-acr-elform-chip");
      let valor = chip.getAttribute("data-valor");
      if (campo === "espacioAnular") valor = valor === "1";
      ACR_ELEMENTO_FORM[campo] = valor;
      if (campo === "diametroPulg") { ACR_ELEMENTO_FORM.diametroOtro = false; ACR_ELEMENTO_FORM.producto = ""; }
      if (campo === "material" || campo === "ubicacion" || campo === "espacioAnular") ACR_ELEMENTO_FORM.producto = "";
      if (campo === "tipo") { ACR_ELEMENTO_FORM.barreras = ""; ACR_ELEMENTO_FORM.posicion = ""; ACR_ELEMENTO_FORM.producto = ""; ACR_ELEMENTO_FORM.diametroPulg = ""; ACR_ELEMENTO_FORM.diametroOtro = false; }
      if (campo === "barreras") { ACR_ELEMENTO_FORM.posicion = ""; ACR_ELEMENTO_FORM.producto = ""; }
      if (campo === "posicion") { ACR_ELEMENTO_FORM.producto = ""; }
      renderModalElemento();
      return;
    }
    if (evt.target.closest("[data-acr-diametro-otro]")) {
      ACR_ELEMENTO_FORM.diametroOtro = true;
      ACR_ELEMENTO_FORM.diametroPulg = "";
      ACR_ELEMENTO_FORM.producto = "";
      renderModalElemento();
      return;
    }
    if (evt.target.closest("[data-acr-elmodal-cerrar]")) { cerrarModalElemento(); return; }
    if (evt.target.closest("[data-acr-elmodal-confirmar]")) { confirmarNuevoElemento(); return; }
  });
  overlay.addEventListener("input", (evt) => {
    const input = evt.target.closest("[data-acr-elform-input]");
    if (!input) return;
    const campo = input.getAttribute("data-acr-elform-input");
    ACR_ELEMENTO_FORM[campo] = input.value;
    ACR_ELEMENTO_FORM.producto = "";
    // Re-renderizar perdería el foco del input numérico mientras se escribe;
    // solo hace falta actualizar las opciones de producto que dependen del
    // diámetro, sin regenerar todo el modal.
    const cont = overlay.querySelector(".instr-modal-content");
    if (cont) {
      const scrollPrevio = cont.scrollTop;
      const activeEl = document.activeElement;
      const wasFocused = activeEl === input;
      const cursorPos = wasFocused ? input.selectionStart : null;
      renderModalElemento();
      const overlay2 = document.getElementById("acr-elemento-overlay");
      const contNuevo = overlay2 ? overlay2.querySelector(".instr-modal-content") : null;
      if (contNuevo) contNuevo.scrollTop = scrollPrevio;
      if (wasFocused) {
        const inputNuevo = overlay2 ? overlay2.querySelector('[data-acr-elform-input="' + campo + '"]') : null;
        if (inputNuevo) { inputNuevo.focus(); if (cursorPos != null) inputNuevo.setSelectionRange(cursorPos, cursorPos); }
      }
    }
  });
}

let ACR_TEXTO_INFORME_EDITANDO = false;
// --- Plano del recorrido ligado al informe ---
// Abre el visor de planos en modo "capa de informe": misma imagen y calibración
// del plano real, pero con trazos/pines propios de este informe — aislados de
// los pines de Levantamiento y de otros informes.
// --- Plano marcado en el PDF del informe (Recorte automático o vista completa) ---
// Calcula el rectángulo (en fracción 0-1) que envuelve todas las anotaciones
// de un planoRef, con margen. Devuelve null si no hay ninguna anotación.
function bboxAnotacionesPlano(ref) {
  let minX = 1, minY = 1, maxX = 0, maxY = 0, hayAlgo = false;
  const marcar = (x, y) => { hayAlgo = true; minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); };
  (ref.pines || []).forEach((p) => marcar(p.xFrac, p.yFrac));
  (ref.rectangulos || []).forEach((r) => { marcar(r.xFrac, r.yFrac); marcar(r.xFrac + r.wFrac, r.yFrac + r.hFrac); });
  (ref.lineas || []).forEach((l) => { marcar(l.x1Frac, l.y1Frac); marcar(l.x2Frac, l.y2Frac); });
  (ref.trazos || []).forEach((t) => (t.puntos || []).forEach((p) => marcar(p.xFrac, p.yFrac)));
  (ref.cotas || []).forEach((c) => { marcar(c.x1Frac, c.y1Frac); marcar(c.x2Frac, c.y2Frac); });
  if (!hayAlgo) return null;
  // Margen alrededor de las marcas (15% del tamaño del bbox, mínimo 8% de la hoja)
  const anchoBbox = maxX - minX, altoBbox = maxY - minY;
  const margenX = Math.max(anchoBbox * 0.15, 0.08), margenY = Math.max(altoBbox * 0.15, 0.08);
  return {
    left: Math.max(0, minX - margenX), top: Math.max(0, minY - margenY),
    right: Math.min(1, maxX + margenX), bottom: Math.min(1, maxY + margenY),
  };
}
// Decide si conviene recortar: si el bbox de las marcas ya cubre gran parte
// de la hoja (>55% de ancho o alto), no vale la pena recortar — casi sería
// la hoja completa de todas formas.
function convieneRecortarPlano(bbox) {
  if (!bbox) return false;
  return (bbox.right - bbox.left) < 0.55 && (bbox.bottom - bbox.top) < 0.55;
}
// Genera el dataURL final del plano para el PDF: plano completo con marcas,
// o recortado a la zona marcada según convieneRecortarPlano() (a menos que
// forzarCompleto lo pida explícitamente).
async function generarImagenPlanoParaPDF(planoId, ref, forzarCompleto) {
  const real = (window.PLANOS || []).find((p) => p.id === planoId);
  if (!real || !window.dibujarPlanoConMarcasCanvas) return null;
  const planoVirtual = { id: real.id, nombre: real.nombre, dataUrl: real.dataUrl, width: real.width, height: real.height, pines: ref.pines, trazos: ref.trazos, rectangulos: ref.rectangulos, lineas: ref.lineas, cotas: ref.cotas };
  let dataUrlCompleto;
  try { dataUrlCompleto = await window.dibujarPlanoConMarcasCanvas(planoVirtual); } catch (e) { return null; }
  const bbox = bboxAnotacionesPlano(ref);
  if (forzarCompleto || !convieneRecortarPlano(bbox)) return { dataUrl: dataUrlCompleto, recortado: false };
  // Recortar el dataUrl completo a la zona del bbox usando un canvas aparte
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const sx = bbox.left * real.width, sy = bbox.top * real.height;
      const sw = (bbox.right - bbox.left) * real.width, sh = (bbox.bottom - bbox.top) * real.height;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(sw)); canvas.height = Math.max(1, Math.round(sh));
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      resolve({ dataUrl: canvas.toDataURL("image/jpeg", 0.9), recortado: true });
    };
    img.onerror = () => resolve({ dataUrl: dataUrlCompleto, recortado: false });
    img.src = dataUrlCompleto;
  });
}
function abrirPlanoDelInforme(planoId) {
  if (!window.abrirVisorPlanosConCapaInforme) {
    if (window.mostrarToast) mostrarToast("El módulo de Planos no está cargado.", "error");
    return;
  }
  if (!ACR_DRAFT.planoRefs) ACR_DRAFT.planoRefs = [];
  let ref = ACR_DRAFT.planoRefs.find(r => r.planoId === planoId);
  if (!ref) {
    ref = { planoId, pines: [], trazos: [], rectangulos: [], lineas: [], cotas: [], incluirEnPDF: false, modoPDF: "auto", notaPDF: "" };
    ACR_DRAFT.planoRefs.push(ref);
  }
  window.abrirVisorPlanosConCapaInforme(planoId, ref, () => {
    if (window.marcarCambio) marcarCambio();
    renderAcreditacion();
  });
}

function renderSeccionPlanosHTML() {
  const planos = window.PLANOS || [];
  const botonAgregar = `
    <label class="secondary acr-btn-agregar-plano" for="acr-input-subir-plano">
      <svg class="icon"><use href="#i-upload"/></svg>Agregar plano (PDF)
      <input type="file" accept="application/pdf" id="acr-input-subir-plano" class="lev-foto-input-oculto" multiple>
    </label>`;
  if (!planos.length) {
    return `<p class="hint">Todavía no hay planos cargados en este proyecto.</p>${botonAgregar}`;
  }
  const refs = ACR_DRAFT.planoRefs || [];
  const items = planos.map(p => {
    const ref = refs.find(r => r.planoId === p.id);
    const tieneAnotaciones = ref && (ref.trazos.length || ref.rectangulos.length || ref.lineas.length || ref.pines.length);
    const incluir = tieneAnotaciones && ref.incluirEnPDF;
    return `
      <div class="acr-plano-item">
        <img src="${p.dataUrl}" class="acr-plano-thumb" alt="${escapeHtml(p.nombre)}">
        <div class="acr-plano-info">
          <span class="acr-plano-nombre">${escapeHtml(p.nombre)}</span>
          ${tieneAnotaciones ? `<span class="acr-badge acr-badge-ok">Anotado</span>` : `<span class="hint">Sin anotaciones</span>`}
        </div>
        <button type="button" class="secondary" data-acr-action="abrir-plano-informe" data-id="${p.id}">
          <svg class="icon"><use href="#i-edit"/></svg>${tieneAnotaciones ? "Editar" : "Anotar"}
        </button>
      </div>
      ${tieneAnotaciones ? `
      <div class="acr-plano-pdf-opciones">
        <label class="acr-checkbox-label">
          <input type="checkbox" data-acr-action="toggle-plano-pdf" data-id="${p.id}" ${incluir ? "checked" : ""}>
          Incluir este plano en el PDF del informe (antes de las fotos)
        </label>
        ${incluir ? `
          <div class="acr-field-row">
            <label class="acr-field-label">Vista
              <select data-acr-plano-campo="modoPDF" data-id="${p.id}">
                <option value="auto" ${ref.modoPDF !== "completo" ? "selected" : ""}>Recorte automático de la zona marcada</option>
                <option value="completo" ${ref.modoPDF === "completo" ? "selected" : ""}>Plano completo</option>
              </select>
            </label>
          </div>
          <label class="acr-field-label">Nota / pie de la imagen (qué se marcó o por qué se incluye)
            <textarea data-acr-plano-campo="notaPDF" data-id="${p.id}" rows="2" placeholder="Ej. Se señala el recorrido de losa donde se ubican los sellos revisados en esta visita.">${escapeHtml(ref.notaPDF || "")}</textarea>
          </label>
        ` : ""}
      </div>` : ""}`;
  }).join("");
  return `<div class="acr-planos-lista">${items}</div>${botonAgregar}`;
}

function abrirModalTextoInforme() {
  ACR_TEXTO_INFORME_EDITANDO = false;
  let overlay = document.getElementById("acr-texto-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "acr-texto-overlay";
    overlay.className = "instr-modal-overlay open";
    document.body.appendChild(overlay);
  }
  renderModalTextoInforme();
}
function cerrarModalTextoInforme() {
  const overlay = document.getElementById("acr-texto-overlay");
  if (overlay) overlay.remove();
}
function renderModalTextoInforme() {
  const overlay = document.getElementById("acr-texto-overlay");
  if (!overlay) return;
  const d = ACR_DRAFT;
  const texto = textoCompletoInforme(d);
  overlay.innerHTML = `
    <div class="instr-modal" style="max-width:760px">
      <div class="instr-modal-header">
        <span>Texto del informe</span>
        <button type="button" data-acr-texto-cerrar aria-label="Cerrar"><svg class="icon"><use href="#i-close"/></svg></button>
      </div>
      <div class="instr-modal-content" style="display:flex;flex-direction:column;min-height:0">
        <p class="hint" style="margin:0 0 10px">Cuerpo completo de la carta, en el mismo orden que sale en el PDF. No incluye la firma, el anexo fotográfico ni los sistemas UL adjuntos — esos se arman aparte.</p>
        ${ACR_TEXTO_INFORME_EDITANDO
          ? `<textarea id="acr-texto-informe-textarea" style="width:100%;flex:1;min-height:55vh;font-family:inherit;font-size:16px;line-height:1.55;color:var(--ink);background:var(--surface-raised);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;resize:vertical">${escapeHtml(texto)}</textarea>
             <p class="hint" style="margin:8px 0 0">Separá los párrafos con una línea en blanco. Las líneas que arrancan con “•” salen como viñetas.</p>`
          : `<div class="acr-texto-preview" style="flex:1;overflow-y:auto;max-height:62vh">${escapeHtml(texto).replace(/\n/g, "<br>")}</div>`}
        <div class="acr-form-footer" style="padding-top:12px">
          ${ACR_TEXTO_INFORME_EDITANDO ? `
            <button type="button" class="secondary" data-acr-texto-cancelar-edicion>Cancelar</button>
            <button type="button" class="primary" data-acr-texto-guardar>Guardar</button>
          ` : `
            ${d.textoInformeManual != null ? `<button type="button" class="secondary" data-acr-texto-restaurar>Restaurar automático</button>` : ""}
            <button type="button" class="primary" data-acr-texto-editar><svg class="icon"><use href="#i-edit"/></svg>Editar</button>
          `}
        </div>
      </div>
    </div>`;
  bindModalTextoInformeEventos(overlay);
}
function bindModalTextoInformeEventos(overlay) {
  if (overlay.dataset.acrTxtBind) return;
  overlay.dataset.acrTxtBind = "1";
  overlay.addEventListener("click", (evt) => {
    if (evt.target.closest("[data-acr-texto-cerrar]")) { cerrarModalTextoInforme(); return; }
    if (evt.target.closest("[data-acr-texto-editar]")) { ACR_TEXTO_INFORME_EDITANDO = true; renderModalTextoInforme(); return; }
    if (evt.target.closest("[data-acr-texto-cancelar-edicion]")) { ACR_TEXTO_INFORME_EDITANDO = false; renderModalTextoInforme(); return; }
    if (evt.target.closest("[data-acr-texto-guardar]")) {
      const ta = document.getElementById("acr-texto-informe-textarea");
      ACR_DRAFT.textoInformeManual = ta ? ta.value : "";
      ACR_TEXTO_INFORME_EDITANDO = false;
      renderModalTextoInforme();
      renderAcreditacion();
      return;
    }
    if (evt.target.closest("[data-acr-texto-restaurar]")) {
      ACR_DRAFT.textoInformeManual = null;
      renderModalTextoInforme();
      renderAcreditacion();
      return;
    }
  });
}

// --- Redacción del informe: gramática del informe modelo de Superba ---------
const ACR_TIPO_PLURAL = {
  "Tubería Metal": "Las tuberías de metal",
  "Tubería Metal Aislado": "Las tuberías de metal aisladas",
  "Tubería EMT": "Las tuberías de EMT",
  "Tubería Cobre Aislado HVAC": "Las tuberías de cobre aisladas de HVAC",
  "Tubería Combustible (PVC, CPVC, PEX, PP-R)": "Las tuberías combustibles (PVC, CPVC, PEX, PP-R)",
  "Tubería Combustible Aislada (PVC, CPVC, PEX, PP-R)": "Las tuberías combustibles aisladas (PVC, CPVC, PEX, PP-R)",
  "Bandeja de Cables": "Las bandejas de cables",
  "Cables Sueltos": "Los cables sueltos",
  "Cable Armado": "Los cables armados",
  "Cables en Paso Repenetrable": "Los cables en paso repenetrable",
  "Caja Electromecánica UL": "Las cajas electromecánicas UL",
  "Ducto Rectangular": "Los ductos rectangulares",
  "Ducto Rectangular Aislado": "Los ductos rectangulares aislados",
  "Ducto Redondo": "Los ductos redondos",
  "Ducto Redondo Aislado": "Los ductos redondos aislados",
  "Pasante Múltiple": "Los pasantes múltiples",
  "Vacío": "Los pasantes vacíos",
  "Viga W": "Las vigas W",
  "Viga Canal": "Las vigas canal",
  "Viga Tubo Rectangular": "Las vigas de tubo rectangular",
};
const ACR_PRODUCTO_PROSA = {
  "Pasta FS ONE MAX": "pasta intumescente FS ONE MAX",
  "FS ONE MAX": "pasta intumescente FS ONE MAX",
  "Sellador CP 606": "sellador CP 606",
  "CP 606": "sellador CP 606",
  "Sellador CFS SIL GG": "sellador siliconado CFS SIL GG",
  "CFS SIL GG": "sellador siliconado CFS SIL GG",
  "CFS SP WB": "spray cortafuego CFS SP WB",
  "Cinta con Collar Metálico CP 648-E/ER": "cinta intumescente CP 648-E, collar de retención CP 648-ER",
  "Cinta sin Collar Metálico CP 648-E": "cinta intumescente CP 648-E",
  "Collarín CP 643N/644": "collarín cortafuego CP 643N/644",
  "Espuma CP 620": "espuma cortafuego CP 620",
  "Almohadilla CFS-BL": "almohadilla cortafuego CFS-BL",
  "Mortero CP 637": "mortero cortafuego CP 637",
  "Putty Pad CP 617": "masilla en lámina CP 617",
  'Manga CP 653 4"': 'manga cortafuego CP 653 4"',
  'Manga CP 653 2"': 'manga cortafuego CP 653 2"',
  'Paso de cables MSL M 3"x4"': 'paso de cables MSL M 3"x4"',
  'Paso de cables MSL L 6"x4"': 'paso de cables MSL L 6"x4"',
};
function productoProsa(producto) { return ACR_PRODUCTO_PROSA[producto] || producto; }
function productoCorto(producto) { return String(producto || "").replace(/^Sellador /, "").replace(/^Pasta /, "Pasta "); }
function aplicaAmbosLados(el) { return el.categoria === "penetrante" && el.ubicacion === "Pared"; }
function barreraFrase(el) {
  if (el.material === "Panel de Yeso") return el.ubicacion === "Pared" ? "en pared liviana" : "en entrepiso liviano";
  return el.ubicacion === "Pared" ? "en pared de concreto" : "en losa de concreto";
}
function diametroFrase(el) {
  if (el.diametroPulg) return ` con diámetro de ${fraccion(el.diametroPulg)}`;
  return "";
}
function sujetoElemento(el) {
  if (el.categoria === "penetrante") {
    const base = ACR_TIPO_PLURAL[el.tipoPenetrante] || `Los elementos de tipo ${el.tipoPenetrante}`;
    return `${base}${diametroFrase(el)} ${barreraFrase(el)}`;
  }
  if (el.subtipo === "muro_cortina") return "Las juntas cortafuego de muro cortina";
  const pos = el.juntaPosicion && el.juntaPosicion !== "-" ? ` en posición ${el.juntaPosicion.toLowerCase()}` : "";
  return `Las juntas cortafuego de tipo ${el.juntaTipo} entre ${el.juntaBarreras}${pos}`;
}
function sujetoEsFemenino(sujeto) { return /^Las /.test(sujeto); }
function espesorFrase(el) {
  if (!el.espesor) return "";
  const prod = productoCorto(el.producto);
  if (el.producto === "CFS SP WB") return `espesor mínimo de ${prod} de: ${fraccion(el.espesor)} en húmedo (${fraccion(el.espesor / 2)} en seco)`;
  return `espesor mínimo de ${prod} de: ${fraccion(el.espesor)}`;
}
function traslapeFrase(el) { return el.traslape ? ` y traslape mínimo de ${fraccion(el.traslape)}` : ""; }
function criterioCumple(el) {
  if (elementoUsaCinta(el)) {
    if (el.numVueltasCinta) return `${el.numVueltasCinta} vuelta${el.numVueltasCinta === 1 ? "" : "s"} de cinta intumescente`;
    return "vueltas";
  }
  const esp = espesorFrase(el);
  if (esp) return `${esp}${traslapeFrase(el)}`;
  return "instalación indicada por el sistema";
}
function criterioNoCumple(item, el) {
  switch (item) {
    case "Espesor insuficiente respecto al mínimo del sistema": return espesorFrase(el) || "espesor mínimo";
    case "Sello desplazado o movido posterior a la instalación": return "continuidad del sello (se encuentra desplazado)";
    case "Orificio o hueco detectado (sellado incompleto)": return "sellado completo (se detectan orificios o huecos)";
    case "Material distinto al especificado en el sistema UL": return `producto correcto, se debe utilizar ${productoProsa(el.producto)}`;
    case "Faltan vueltas de cinta intumescente": return "vueltas de cinta intumescente";
    case "Falta collar metálico de retención": return "collar metálico de retención";
    case "Falta lana mineral de respaldo donde el sistema la requiere": return "lana mineral de alta densidad como respaldo";
    case "Falta instalación por una de las dos caras de la pared": return "instalarse por ambos lados";
    case "Traslape insuficiente hacia losa/pared": return `traslape mínimo hacia la losa/pared${el.traslape ? " de: " + fraccion(el.traslape) : ""}`;
    case "Traslape insuficiente hacia elemento de fachada (muro cortina)": return `traslape mínimo hacia el elemento de fachada${el.traslape ? " de: " + fraccion(el.traslape) : ""}`;
    default: return null;
  }
}
const ACR_ESTADO_PROPIO = {
  "Instalación pendiente (aún no ejecutada, con método/producto ya definido)": (suj) => `${suj} se encuentran con instalación pendiente.`,
  "Daño por terceros / contratistas externos, requiere reparación": (suj) => `${suj} presentan daño ocasionado por terceros y requieren reparación.`,
};
function fraseCumple(el, prefijoZona) {
  const suj = sujetoElemento(el);
  const fem = sujetoEsFemenino(suj);
  const ambos = aplicaAmbosLados(el) ? `, se encuentran ${fem ? "instaladas" : "instalados"} por ambos lados` : "";
  return `${prefijoZona}${suj} cumplen con el requerimiento de ${criterioCumple(el)} según el sistema ${el.sistemaUL}${ambos} y no se muestran compromisos de integridad visibles.`;
}
function frasesNoCumple(el, estado, prefijoZona) {
  const suj = sujetoElemento(el);
  const out = [], propios = [], criterios = [];
  (estado.marcados || []).forEach((m) => {
    if (ACR_ESTADO_PROPIO[m]) { propios.push(ACR_ESTADO_PROPIO[m](prefijoZona + suj)); return; }
    const c = criterioNoCumple(m, el);
    if (c) criterios.push(c);
  });
  if (criterios.length) {
    const recs = Array.from(new Set((estado.marcados || []).map((m) => ACR_RECOMENDACION[m]).filter(Boolean)));
    const rec = recs.length ? ` Se recomienda ${recs.join("; ")}.` : "";
    out.push(`${prefijoZona}${suj} no cumplen con el requerimiento de ${criterios.join(", ni con el requerimiento de ")} según el sistema ${el.sistemaUL}.${rec}`);
  }
  propios.forEach((p) => out.push(p));
  if (!out.length) out.push(`${prefijoZona}${suj} presentan un incumplimiento respecto al sistema ${el.sistemaUL}.`);
  if (estado.observacion) out[out.length - 1] += ` ${estado.observacion}`;
  return out;
}
function recorrerEstados(d, visitar) {
  if (d.checklistModo === "general" || !d.zonas.length) {
    d.elementos.forEach((el) => visitar(el, d.checklist.general[el.id] || estadoChecklistDefault(), ""));
    return;
  }
  d.zonas.forEach((zona) => {
    d.elementos.forEach((el) => {
      const estado = (d.checklist.porZona[zona] && d.checklist.porZona[zona][el.id]) || estadoChecklistDefault();
      visitar(el, estado, `En ${zona}: `);
    });
  });
}
// Detecta si existen otros informes guardados del mismo proyecto (por nombre,
// comparación insensible a mayúsculas/espacios) — para saber si el informe
// final puede referirse a "informes anteriores y visitas previas" o si, al
// ser la primera y única visita, esa frase no aplica.
function hayInformesAnterioresDelProyecto(informe) {
  const nombre = (informe.proyecto || "").trim().toLowerCase();
  if (!nombre) return false;
  return INFORMES_ACREDITACION.some((otro) => otro.id !== informe.id && (otro.proyecto || "").trim().toLowerCase() === nombre);
}
function hayHallazgos(d) {
  let hay = false;
  recorrerEstados(d, (el, estado) => { if (!estado.cumple) hay = true; });
  return hay;
}
function generarTextoCumplimiento(d) {
  if (!d.elementos.length) return "Aún no se agregaron tipos de penetrante ni juntas a este informe.";
  const cumplen = [], hallazgos = [];
  recorrerEstados(d, (el, estado, prefijo) => {
    if (estado.cumple) cumplen.push(fraseCumple(el, prefijo));
    else frasesNoCumple(el, estado, prefijo).forEach((f) => hallazgos.push(f));
  });
  const partes = [];
  if (cumplen.length) { partes.push("Cumplimientos verificados:"); cumplen.forEach((f) => partes.push(f)); }
  if (hallazgos.length) { partes.push("Hallazgos de no cumplimiento:"); hallazgos.forEach((f, i) => partes.push(`H-${String(i + 1).padStart(2, "0")}. ${f}`)); }
  return partes.join("\n\n");
}

function leerArchivoComoDataUrl(file) {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
}
// Calidad de las fotos del informe. Bajarlas de 1600/0.85 a 1400/0.72 reduce
// cada foto a menos de la mitad (~600 KB → ~290 KB en base64), lo que además
// achica el PDF final de ~12 MB a ~5 MB con 20 fotos. A 0.72 la diferencia es
// imperceptible en fotos de obra.
const FOTO_MAX_DIM = 1400;
const FOTO_CALIDAD = 0.72;
function redimensionarImagenDataUrl(dataUrl, maxDim) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth, h = img.naturalHeight;
      if (!w || !h) { resolve(dataUrl); return; }
      // Siempre se re-codifica a JPEG, aunque la imagen ya sea chica: antes las
      // imágenes por debajo del límite se devolvían tal cual, así que un PNG
      // pequeño pero pesado entraba sin comprimir.
      if (w > maxDim || h > maxDim) {
        const escala = Math.min(maxDim / w, maxDim / h);
        w = Math.round(w * escala); h = Math.round(h * escala);
      }
      const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      // Fondo blanco: si el origen tiene transparencia (PNG), al pasar a JPEG
      // esas zonas saldrían negras.
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", FOTO_CALIDAD));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
async function agregarFotosDesdeArchivos(fileList) {
  const archivos = Array.from(fileList || []);
  const idsNuevos = [];
  for (const file of archivos) {
    try {
      const dataUrl = await leerArchivoComoDataUrl(file);
      const chica = await redimensionarImagenDataUrl(dataUrl, FOTO_MAX_DIM);
      const id = Date.now() + Math.random();
      ACR_DRAFT.fotos.push({ id, dataUrl: chica, descripcion: "", seleccionada: true });
      idsNuevos.push(id);
    } catch (e) { /* si una foto falla, se sigue con las demás */ }
  }
  // Si se agregó una sola foto (caso típico: cámara), se abre directo el popup
  // de descripción para ponerle texto al toque (o guardarla sin descripción).
  // Si son varias, se quedan en la galería — forzar en cadena es peor experiencia.
  if (idsNuevos.length === 1) { ACR_DESC_FOTO_MODAL_ID = idsNuevos[0]; ACR_DESC_FOTO_ES_NUEVA = true; renderAcreditacion(); }
  else renderAcreditacion();
}
function toggleSeleccionFoto(idx) { const f = ACR_DRAFT.fotos[idx]; if (f) f.seleccionada = !f.seleccionada; renderAcreditacion(); }
function toggleSeleccionTodas() { const marcar = !todasSeleccionadas(); ACR_DRAFT.fotos.forEach((f) => { f.seleccionada = marcar; }); renderAcreditacion(); }
function activarModoBorrarFotos() { ACR_FOTO_MODO_BORRAR = true; ACR_FOTOS_A_BORRAR = new Set(); renderAcreditacion(); }
function cancelarModoBorrarFotos() { ACR_FOTO_MODO_BORRAR = false; ACR_FOTOS_A_BORRAR = new Set(); renderAcreditacion(); }
function toggleFotoParaBorrar(id) {
  if (ACR_FOTOS_A_BORRAR.has(id)) ACR_FOTOS_A_BORRAR.delete(id); else ACR_FOTOS_A_BORRAR.add(id);
  renderAcreditacion();
}
function ejecutarBorradoFotos() {
  if (!ACR_FOTO_CONFIRMAR_BORRAR) return;
  const ids = new Set(ACR_FOTO_CONFIRMAR_BORRAR.ids);
  ACR_DRAFT.fotos = ACR_DRAFT.fotos.filter((f) => !ids.has(f.id));
  ACR_FOTO_CONFIRMAR_BORRAR = null;
  ACR_FOTO_MODO_BORRAR = false;
  ACR_FOTOS_A_BORRAR = new Set();
  renderAcreditacion();
}

function abrirEditorFoto(fotoId) {
  const foto = ACR_DRAFT.fotos.find((f) => f.id === fotoId);
  if (!foto) return;
  ACR_FOTO_EDIT = { fotoId, modo: "anotar", img: null, rect: { left: 0, top: 0, right: 1, bottom: 1 }, trazos: [], trazoActual: null, rectangulos: [], rectanguloActual: null, textos: [], textoPendiente: null, textoSeleccionado: null, color: ACR_PALETA[0], grosorFrac: 0.006, tamanoTexto: 0.035, arrastre: null, herramientasAbiertas: false };
  ACR_VISTA = "editorFoto";
  renderAcreditacion();
}
function renderEditorFotoHTML() {
  const e = ACR_FOTO_EDIT;
  const herramientas = [
    { id: "anotar", icono: "i-edit", label: "Marcar" },
    { id: "texto", icono: "i-list", label: "Texto" },
    { id: "recuadro", icono: "i-rectangle", label: "Recuadro" },
    { id: "recortar", icono: "i-crop", label: "Recortar" },
  ];
  const grosores = [0.003, 0.006, 0.01, 0.016];
  const tamanosTexto = [0.02, 0.035, 0.05, 0.07];
  const mostrarColor = e.modo === "anotar" || e.modo === "texto" || e.modo === "recuadro";
  const mostrarGrosor = e.modo === "anotar" || e.modo === "recuadro";
  const mostrarTamanoTexto = e.modo === "texto";
  const tamanoActivo = e.textoSeleccionado != null && e.textos[e.textoSeleccionado] ? (e.textos[e.textoSeleccionado].tamano || e.tamanoTexto) : e.tamanoTexto;
  return `
    <div class="acr-visor-foto acr-visor-foto-fullscreen">
      <div class="acr-editor-canvas-wrap" id="acr-editor-canvas-wrap"><canvas id="acr-editor-canvas"></canvas></div>
      <button type="button" class="acr-foto-bubble acr-foto-bubble-atras" data-acr-action="editor-cancelar" aria-label="Atrás">
        <svg class="icon"><use href="#i-arrow-left"/></svg>Atrás
      </button>
      <button type="button" class="acr-foto-bubble acr-foto-bubble-aplicar" data-acr-action="editor-aplicar" aria-label="Aplicar">
        Aplicar
      </button>
      ${e.modo === "recortar" ? `
        <button type="button" class="acr-foto-bubble acr-foto-bubble-reset-recorte" data-acr-action="editor-reset-recorte" aria-label="Reiniciar selección">
          Reiniciar selección
        </button>` : ""}
      ${e.modo === "texto" && e.textoPendiente ? `
        <input type="text" id="acr-editor-texto-input" class="acr-editor-texto-flotante" placeholder="Escribí..." value="${escapeHtml(e.textoPendiente.texto || "")}" style="color:${e.color}">
      ` : ""}
      <div class="acr-foto-rail ${e.herramientasAbiertas ? "" : "rail-collapsed"}">
        <button type="button" class="acr-foto-rail-toggle" data-acr-action="toggle-herramientas" title="${e.herramientasAbiertas ? "Ocultar herramientas" : "Herramientas"}">
          <svg class="icon"><use href="#${e.herramientasAbiertas ? "i-chevron-down" : "i-edit"}"/></svg>
        </button>
        ${e.herramientasAbiertas ? `
        <div class="acr-foto-rail-herramientas">
          ${herramientas.map((h) => `
            <button type="button" class="acr-foto-tool-btn ${e.modo === h.id ? "active" : ""}" data-acr-action="editor-modo" data-modo="${h.id}" title="${h.label}" aria-label="${h.label}">
              <svg class="icon"><use href="#${h.icono}"/></svg>
            </button>`).join("")}
        </div>
        <div class="acr-foto-rail-separator"></div>
        ${mostrarColor ? `
          <button type="button" id="acr-foto-rail-color-btn" class="acr-foto-rail-color-preview" style="background:${e.color}" title="Color"></button>
          ${e.flyout === "color" ? `
            <div class="acr-foto-rail-flyout">
              ${ACR_PALETA.map((c) => `<button type="button" class="acr-color-swatch ${e.color === c ? "active" : ""}" data-acr-action="editor-color" data-color="${c}" style="background:${c}"></button>`).join("")}
            </div>` : ""}
        ` : ""}
        ${mostrarGrosor ? `
          <button type="button" id="acr-foto-rail-grosor-btn" class="acr-foto-rail-grosor-btn" title="Grosor">
            <span class="acr-foto-grosor-preview" style="height:${Math.max(1, e.grosorFrac * 300)}px"></span>
          </button>
          ${e.flyout === "grosor" ? `
            <div class="acr-foto-rail-flyout acr-foto-rail-flyout-grosor">
              ${grosores.map((g) => `<button type="button" class="acr-foto-grosor-opcion ${e.grosorFrac === g ? "active" : ""}" data-acr-action="editor-grosor" data-grosor="${g}"><span style="height:${Math.max(1, g * 300)}px"></span></button>`).join("")}
            </div>` : ""}
        ` : ""}
        ${mostrarTamanoTexto ? `
          <button type="button" id="acr-foto-rail-tamano-btn" class="acr-foto-rail-grosor-btn" title="Tamaño de texto">
            <span class="acr-foto-tamano-preview">A</span>
          </button>
          ${e.flyout === "tamano" ? `
            <div class="acr-foto-rail-flyout acr-foto-rail-flyout-grosor">
              ${tamanosTexto.map((t) => `<button type="button" class="acr-foto-tamano-opcion ${tamanoActivo === t ? "active" : ""}" data-acr-action="editor-tamano-texto" data-tamano="${t}" style="font-size:${10 + t * 200}px">A</button>`).join("")}
            </div>` : ""}
        ` : ""}
        <div class="acr-foto-rail-separator"></div>
        <button type="button" class="acr-foto-tool-btn" data-acr-action="editor-deshacer" title="Deshacer" aria-label="Deshacer"><svg class="icon"><use href="#i-undo"/></svg></button>
        ` : ""}
      </div>
    </div>`;
}
function inicializarCanvasEditor() {
  const e = ACR_FOTO_EDIT;
  const foto = ACR_DRAFT.fotos.find((f) => f.id === e.fotoId);
  if (!foto) return;
  const canvas = document.getElementById("acr-editor-canvas");
  const wrap = document.getElementById("acr-editor-canvas-wrap");
  if (!canvas || !wrap) return;
  ligarFlyoutsRailFoto();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  if (e.img) {
    const availW = wrap.clientWidth > 100 ? wrap.clientWidth : Math.max(200, window.innerWidth - 20);
    const availH = wrap.clientHeight > 100 ? wrap.clientHeight : Math.max(200, window.innerHeight - 180);
    const escala = Math.min(availW / e.img.naturalWidth, availH / e.img.naturalHeight, 1);
    const cssW = Math.round(e.img.naturalWidth * escala), cssH = Math.round(e.img.naturalHeight * escala);
    canvas.style.width = `${cssW}px`; canvas.style.height = `${cssH}px`;
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    dibujarEditor(); ligarPunterosEditor(canvas); posicionarInputTextoFlotante(); return;
  }
  const img = new Image();
  img.onload = () => {
    if (ACR_FOTO_EDIT !== e) return;
    e.img = img;
    const availW = wrap.clientWidth > 100 ? wrap.clientWidth : Math.max(200, window.innerWidth - 20);
    const availH = wrap.clientHeight > 100 ? wrap.clientHeight : Math.max(200, window.innerHeight - 180);
    const escala = Math.min(availW / img.naturalWidth, availH / img.naturalHeight, 1);
    const cssW = Math.round(img.naturalWidth * escala), cssH = Math.round(img.naturalHeight * escala);
    canvas.style.width = `${cssW}px`; canvas.style.height = `${cssH}px`;
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    dibujarEditor(); ligarPunterosEditor(canvas); posicionarInputTextoFlotante();
  };
  img.src = foto.dataUrl;
}
// Posiciona el <input> de texto en tiempo real exactamente sobre el punto del
// canvas que se tocó (o sobre el texto que se está editando), para que el
// usuario vea el texto aparecer en el lugar correcto mientras escribe.
function posicionarInputTextoFlotante() {
  const e = ACR_FOTO_EDIT;
  const input = document.getElementById("acr-editor-texto-input");
  const canvas = document.getElementById("acr-editor-canvas");
  if (!input || !canvas || !e.textoPendiente) return;
  const wrap = document.getElementById("acr-editor-canvas-wrap");
  const rectCanvas = canvas.getBoundingClientRect();
  const rectWrap = wrap.getBoundingClientRect();
  const tamanoPx = Math.max(14, Math.round(canvas.width * (e.textoPendiente.tamano || e.tamanoTexto || 0.035)));
  const left = (rectCanvas.left - rectWrap.left) + e.textoPendiente.x * rectCanvas.width;
  const top = (rectCanvas.top - rectWrap.top) + e.textoPendiente.y * rectCanvas.height;
  input.style.left = `${left}px`;
  input.style.top = `${top}px`;
  input.style.fontSize = `${Math.max(14, tamanoPx * (rectCanvas.width / canvas.width))}px`;
  input.focus();
  const val = input.value; input.value = ""; input.value = val; // cursor al final
}
function ligarFlyoutsRailFoto() {
  const btnColor = document.getElementById("acr-foto-rail-color-btn");
  if (btnColor) btnColor.addEventListener("click", () => {
    ACR_FOTO_EDIT.flyout = ACR_FOTO_EDIT.flyout === "color" ? null : "color";
    renderAcreditacion();
  });
  const btnGrosor = document.getElementById("acr-foto-rail-grosor-btn");
  if (btnGrosor) btnGrosor.addEventListener("click", () => {
    ACR_FOTO_EDIT.flyout = ACR_FOTO_EDIT.flyout === "grosor" ? null : "grosor";
    renderAcreditacion();
  });
  const btnTamano = document.getElementById("acr-foto-rail-tamano-btn");
  if (btnTamano) btnTamano.addEventListener("click", () => {
    ACR_FOTO_EDIT.flyout = ACR_FOTO_EDIT.flyout === "tamano" ? null : "tamano";
    renderAcreditacion();
  });
}
function dibujarTextoEnCanvas(ctx, t, W, H, seleccionado) {
  const tamano = Math.max(14, Math.round(W * (t.tamano || 0.035)));
  ctx.font = `700 ${tamano}px Arial, sans-serif`; ctx.textBaseline = "middle";
  const x = t.x * W, y = t.y * H, metrics = ctx.measureText(t.texto);
  if (seleccionado) {
    const padX = tamano * 0.3, padY = tamano * 0.25;
    ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
    ctx.strokeRect(x - padX, y - tamano / 2 - padY, metrics.width + padX * 2, tamano + padY * 2);
    ctx.setLineDash([]);
  }
  // Contorno oscuro fino en vez de caja de fondo — mantiene legibilidad sobre
  // cualquier color de pared sin taparla con un rectángulo.
  ctx.lineJoin = "round"; ctx.miterLimit = 2;
  ctx.strokeStyle = "rgba(0,0,0,0.65)"; ctx.lineWidth = Math.max(2, tamano * 0.12);
  ctx.strokeText(t.texto, x, y);
  ctx.fillStyle = t.color; ctx.fillText(t.texto, x, y);
}
function dibujarEditor() {
  const e = ACR_FOTO_EDIT;
  const canvas = document.getElementById("acr-editor-canvas");
  if (!canvas || !e.img) return;
  const ctx = canvas.getContext("2d"), W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H); ctx.drawImage(e.img, 0, 0, W, H);
  const trazos = e.trazoActual ? e.trazos.concat([e.trazoActual]) : e.trazos;
  trazos.forEach((t) => {
    if (!t.puntos.length) return;
    ctx.strokeStyle = t.color; ctx.lineWidth = Math.max(2, t.grosorFrac * W);
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath();
    t.puntos.forEach((p, i) => { const x = p.x * W, y = p.y * H; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
    ctx.stroke();
  });
  e.textos.forEach((t, i) => dibujarTextoEnCanvas(ctx, t, W, H, e.textoSeleccionado === i));
  const rects = e.rectanguloActual ? e.rectangulos.concat([e.rectanguloActual]) : e.rectangulos;
  rects.forEach((r) => {
    ctx.strokeStyle = r.color; ctx.lineWidth = Math.max(2, r.grosorFrac * W);
    ctx.strokeRect(Math.min(r.x1, r.x2) * W, Math.min(r.y1, r.y2) * H, Math.abs(r.x2 - r.x1) * W, Math.abs(r.y2 - r.y1) * H);
  });
  if (e.modo === "recortar") {
    const r = e.rect, rx = r.left * W, ry = r.top * H, rw = (r.right - r.left) * W, rh = (r.bottom - r.top) * H;
    ctx.save(); ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(0, 0, W, H); ctx.clearRect(rx, ry, rw, rh);
    ctx.drawImage(e.img, r.left * e.img.naturalWidth, r.top * e.img.naturalHeight, (r.right - r.left) * e.img.naturalWidth, (r.bottom - r.top) * e.img.naturalHeight, rx, ry, rw, rh);
    ctx.restore(); ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2; ctx.strokeRect(rx, ry, rw, rh);
    // Handles más grandes (círculo + halo) — antes eran cuadraditos de 9px de
    // buffer, casi invisibles/difíciles de tocar en pantallas de alta densidad.
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const hs = 11 * dpr;
    [[rx, ry], [rx + rw, ry], [rx + rw, ry + rh], [rx, ry + rh]].forEach(([hx, hy]) => {
      ctx.beginPath(); ctx.arc(hx, hy, hs, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.fill();
      ctx.beginPath(); ctx.arc(hx, hy, hs * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff"; ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 1.5; ctx.stroke();
    });
  }
}
function indiceTextoEnPunto(e, p, canvas) {
  const ctx = canvas.getContext("2d"), W = canvas.width, H = canvas.height;
  for (let i = e.textos.length - 1; i >= 0; i--) {
    const t = e.textos[i];
    const tamano = Math.max(14, Math.round(W * (t.tamano || 0.035)));
    ctx.font = `700 ${tamano}px Arial, sans-serif`;
    const metrics = ctx.measureText(t.texto);
    const padX = tamano * 0.4, padY = tamano * 0.3;
    const x = t.x * W, y = t.y * H;
    const left = x - padX, right = x + metrics.width + padX, top = y - tamano / 2 - padY, bottom = y + tamano / 2 + padY;
    if (p.x * W >= left && p.x * W <= right && p.y * H >= top && p.y * H <= bottom) return i;
  }
  return null;
}
function ligarPunterosEditor(canvas) {
  function coordsFrac(evt) {
    const rect = canvas.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (evt.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (evt.clientY - rect.top) / rect.height)) };
  }
  function handleCercano(p) {
    const e = ACR_FOTO_EDIT, r = e.rect, tol = 0.06;
    const esquinas = { tl: { x: r.left, y: r.top }, tr: { x: r.right, y: r.top }, br: { x: r.right, y: r.bottom }, bl: { x: r.left, y: r.bottom } };
    for (const k in esquinas) if (Math.abs(p.x - esquinas[k].x) < tol && Math.abs(p.y - esquinas[k].y) < tol) return k;
    return null;
  }
  canvas.addEventListener("pointerdown", (evt) => {
    evt.preventDefault();
    const e = ACR_FOTO_EDIT, p = coordsFrac(evt);
    canvas.setPointerCapture(evt.pointerId);
    if (e.modo === "anotar") { e.trazoActual = { color: e.color, grosorFrac: e.grosorFrac, puntos: [p] }; }
    else if (e.modo === "recuadro") { e.rectanguloActual = { color: e.color, grosorFrac: e.grosorFrac, x1: p.x, y1: p.y, x2: p.x, y2: p.y }; }
    else if (e.modo === "texto") {
      if (e.textoPendiente) return; // ya está escribiendo uno, no interrumpir
      const idxTocado = indiceTextoEnPunto(e, p, canvas);
      if (idxTocado != null) {
        e.textoSeleccionado = idxTocado;
        e.arrastre = { tipo: "mover-texto", offX: p.x - e.textos[idxTocado].x, offY: p.y - e.textos[idxTocado].y };
        dibujarEditor(); renderAcreditacion();
      } else {
        e.textoSeleccionado = null;
        e.textoPendiente = { x: p.x, y: p.y, texto: "", tamano: e.tamanoTexto };
        dibujarEditor(); renderAcreditacion();
      }
    }
    else {
      const h = handleCercano(p);
      if (h) { e.arrastre = { tipo: "handle", handle: h }; }
      else if (p.x > e.rect.left && p.x < e.rect.right && p.y > e.rect.top && p.y < e.rect.bottom) {
        e.arrastre = { tipo: "mover", offX: p.x - e.rect.left, offY: p.y - e.rect.top, w: e.rect.right - e.rect.left, h: e.rect.bottom - e.rect.top };
      }
    }
  }, { passive: false });
  canvas.addEventListener("pointermove", (evt) => {
    const e = ACR_FOTO_EDIT;
    if (e.modo === "anotar" && e.trazoActual) { evt.preventDefault(); e.trazoActual.puntos.push(coordsFrac(evt)); dibujarEditor(); }
    else if (e.modo === "recuadro" && e.rectanguloActual) { evt.preventDefault(); const p = coordsFrac(evt); e.rectanguloActual.x2 = p.x; e.rectanguloActual.y2 = p.y; dibujarEditor(); }
    else if (e.modo === "texto" && e.arrastre && e.arrastre.tipo === "mover-texto" && e.textoSeleccionado != null) {
      evt.preventDefault();
      const p = coordsFrac(evt);
      e.textos[e.textoSeleccionado].x = Math.max(0, Math.min(1, p.x - e.arrastre.offX));
      e.textos[e.textoSeleccionado].y = Math.max(0, Math.min(1, p.y - e.arrastre.offY));
      dibujarEditor();
    }
    else if (e.modo === "recortar" && e.arrastre) {
      evt.preventDefault();
      const p = coordsFrac(evt), r = e.rect;
      if (e.arrastre.tipo === "mover") {
        let nl = p.x - e.arrastre.offX, nt = p.y - e.arrastre.offY;
        nl = Math.max(0, Math.min(1 - e.arrastre.w, nl)); nt = Math.max(0, Math.min(1 - e.arrastre.h, nt));
        r.left = nl; r.top = nt; r.right = nl + e.arrastre.w; r.bottom = nt + e.arrastre.h;
      } else {
        const h = e.arrastre.handle;
        if (h === "tl") { r.left = Math.min(p.x, r.right - 0.04); r.top = Math.min(p.y, r.bottom - 0.04); }
        if (h === "tr") { r.right = Math.max(p.x, r.left + 0.04); r.top = Math.min(p.y, r.bottom - 0.04); }
        if (h === "br") { r.right = Math.max(p.x, r.left + 0.04); r.bottom = Math.max(p.y, r.top + 0.04); }
        if (h === "bl") { r.left = Math.min(p.x, r.right - 0.04); r.bottom = Math.max(p.y, r.top + 0.04); }
        r.left = Math.max(0, r.left); r.top = Math.max(0, r.top); r.right = Math.min(1, r.right); r.bottom = Math.min(1, r.bottom);
      }
      dibujarEditor();
    }
  }, { passive: false });
  function terminar() { const e = ACR_FOTO_EDIT; if (e.modo === "anotar" && e.trazoActual) { if (e.trazoActual.puntos.length > 1) e.trazos.push(e.trazoActual); e.trazoActual = null; } if (e.modo === "recuadro" && e.rectanguloActual) { if (Math.abs(e.rectanguloActual.x2 - e.rectanguloActual.x1) > 0.01) e.rectangulos.push(e.rectanguloActual); e.rectanguloActual = null; } e.arrastre = null; }
  canvas.addEventListener("pointerup", terminar);
  canvas.addEventListener("pointercancel", terminar);
}
function colocarTextoPendiente() {
  const e = ACR_FOTO_EDIT, input = document.getElementById("acr-editor-texto-input"), texto = input ? input.value.trim() : "";
  if (texto && e.textoPendiente) {
    e.textos.push({ x: e.textoPendiente.x, y: e.textoPendiente.y, texto, color: e.color, tamano: e.textoPendiente.tamano || e.tamanoTexto });
    e.textoSeleccionado = e.textos.length - 1;
  }
  e.textoPendiente = null; renderAcreditacion();
}
function finalizarEdicionFoto() {
  const e = ACR_FOTO_EDIT, foto = ACR_DRAFT.fotos.find((f) => f.id === e.fotoId);
  if (!foto || !e.img) { renderAcreditacion(); return; }
  const W = e.img.naturalWidth, H = e.img.naturalHeight;
  const base = document.createElement("canvas"); base.width = W; base.height = H;
  const bctx = base.getContext("2d"); bctx.drawImage(e.img, 0, 0, W, H);
  e.trazos.forEach((t) => {
    if (!t.puntos.length) return;
    bctx.strokeStyle = t.color; bctx.lineWidth = Math.max(2, t.grosorFrac * W);
    bctx.lineCap = "round"; bctx.lineJoin = "round"; bctx.beginPath();
    t.puntos.forEach((p, i) => { const x = p.x * W, y = p.y * H; if (i === 0) bctx.moveTo(x, y); else bctx.lineTo(x, y); });
    bctx.stroke();
  });
  e.rectangulos.forEach((r) => {
    bctx.strokeStyle = r.color; bctx.lineWidth = Math.max(2, r.grosorFrac * W);
    bctx.strokeRect(Math.min(r.x1, r.x2) * W, Math.min(r.y1, r.y2) * H, Math.abs(r.x2 - r.x1) * W, Math.abs(r.y2 - r.y1) * H);
  });
  e.textos.forEach((t) => dibujarTextoEnCanvas(bctx, t, W, H));
  const r = e.rect, sx = r.left * W, sy = r.top * H, sw = (r.right - r.left) * W, sh = (r.bottom - r.top) * H;
  let finalDataUrl;
  if (sw < W - 1 || sh < H - 1) {
    const crop = document.createElement("canvas"); crop.width = Math.max(1, Math.round(sw)); crop.height = Math.max(1, Math.round(sh));
    crop.getContext("2d").drawImage(base, sx, sy, sw, sh, 0, 0, crop.width, crop.height);
    // 0.8 y no 0.72 como en la captura: acá ya hubo una recodificación previa,
    // y bajar dos veces al mismo nivel acumula artefactos visibles.
    finalDataUrl = crop.toDataURL("image/jpeg", 0.8);
  } else { finalDataUrl = base.toDataURL("image/jpeg", 0.8); }
  foto.dataUrl = finalDataUrl;
  ACR_VISTA = "galeria"; ACR_FOTO_EDIT = null;
  renderAcreditacion();
}

function bindCamposTexto(cont) {
  cont.querySelectorAll("[data-acr-field]").forEach((el) => {
    const campo = el.getAttribute("data-acr-field");
    const evento = (el.tagName === "SELECT" || el.type === "checkbox" || el.type === "date") ? "change" : "input";
    el.addEventListener(evento, () => {
      const idx = el.getAttribute("data-idx"), elid = el.getAttribute("data-elid"), zona = el.getAttribute("data-zona") || null;
      if (campo === "acompanante-nombre") { if (ACR_DRAFT.acompanantes[idx]) ACR_DRAFT.acompanantes[idx].nombre = el.value; }
      else if (campo === "acompanante-cargo") { if (ACR_DRAFT.acompanantes[idx]) ACR_DRAFT.acompanantes[idx].cargo = el.value; }
      else if (campo === "checklist-observacion") { obtenerEstadoChecklist(elid, zona).observacion = el.value; }
      else if (campo === "esSeguimiento") { ACR_DRAFT.esSeguimiento = el.checked; renderAcreditacion(); }
      else { ACR_DRAFT[campo] = el.value; }
    });
  });
  cont.querySelectorAll("[data-acr-plano-campo]").forEach((el) => {
    const campo = el.getAttribute("data-acr-plano-campo");
    const id = Number(el.getAttribute("data-id"));
    const evento = el.tagName === "SELECT" ? "change" : "input";
    el.addEventListener(evento, () => {
      const ref = (ACR_DRAFT.planoRefs || []).find((r) => r.planoId === id);
      if (ref) ref[campo] = el.value;
    });
  });
  const inputZona = document.getElementById("acr-input-zona");
  if (inputZona) inputZona.addEventListener("keydown", (evt) => { if (evt.key === "Enter") { evt.preventDefault(); agregarZonaDesdeInput(); } });
  const inputFotos = document.getElementById("acr-input-fotos");
  if (inputFotos) inputFotos.addEventListener("change", (evt) => { agregarFotosDesdeArchivos(evt.target.files); evt.target.value = ""; });
  const inputPlano = document.getElementById("acr-input-subir-plano");
  if (inputPlano) inputPlano.addEventListener("change", async (evt) => {
    const files = evt.target.files;
    if (!files || !files.length || !window.subirVariosPlanosBasico) { evt.target.value = ""; return; }
    const resultado = await window.subirVariosPlanosBasico(files);
    evt.target.value = "";
    if (resultado.fallidos) mostrarToast(`No se pudo procesar ${resultado.fallidos} archivo(s) (¿son PDF válidos?).`, "error");
    if (resultado.subidos.length) {
      mostrarToast(resultado.subidos.length === 1 ? "Plano agregado." : `${resultado.subidos.length} planos agregados.`);
      renderAcreditacion();
    }
  });
  const inputTexto = document.getElementById("acr-editor-texto-input");
  if (inputTexto) {
    inputTexto.addEventListener("keydown", (evt) => { if (evt.key === "Enter") { evt.preventDefault(); colocarTextoPendiente(); } });
    inputTexto.addEventListener("input", () => { if (ACR_FOTO_EDIT.textoPendiente) ACR_FOTO_EDIT.textoPendiente.texto = inputTexto.value; });
    inputTexto.addEventListener("blur", () => { if (ACR_FOTO_EDIT.textoPendiente) colocarTextoPendiente(); });
  }
  const inputDescFoto = document.getElementById("acr-desc-foto-input");
  if (inputDescFoto) inputDescFoto.focus();
}
// --- Reordenar fotos arrastrando (mouse: HTML5 Drag and Drop; touch: Pointer
// Events, porque iOS Safari no soporta bien el DnD nativo con el dedo) ---
function ligarDragReordenarFotos(overlay) {
  const grid = overlay.querySelector(".acr-fotos-grid");
  if (!grid || grid.dataset.acrDragBind) return;
  grid.dataset.acrDragBind = "1";
  let idArrastrado = null;

  grid.addEventListener("dragstart", (evt) => {
    const item = evt.target.closest("[data-acr-drag-item]");
    if (!item) return;
    idArrastrado = Number(item.getAttribute("data-id"));
    item.classList.add("acr-foto-arrastrando");
    evt.dataTransfer.effectAllowed = "move";
    try { evt.dataTransfer.setData("text/plain", String(idArrastrado)); } catch (e) {}
  });
  grid.addEventListener("dragend", (evt) => {
    const item = evt.target.closest("[data-acr-drag-item]");
    if (item) item.classList.remove("acr-foto-arrastrando");
    grid.querySelectorAll(".acr-foto-drop-antes, .acr-foto-drop-despues").forEach((el) => el.classList.remove("acr-foto-drop-antes", "acr-foto-drop-despues"));
    idArrastrado = null;
  });
  grid.addEventListener("dragover", (evt) => {
    const item = evt.target.closest("[data-acr-drag-item]");
    if (!item || idArrastrado == null) return;
    evt.preventDefault();
    const rect = item.getBoundingClientRect();
    const antes = evt.clientX < rect.left + rect.width / 2;
    grid.querySelectorAll(".acr-foto-drop-antes, .acr-foto-drop-despues").forEach((el) => el.classList.remove("acr-foto-drop-antes", "acr-foto-drop-despues"));
    item.classList.add(antes ? "acr-foto-drop-antes" : "acr-foto-drop-despues");
  });
  grid.addEventListener("drop", (evt) => {
    const item = evt.target.closest("[data-acr-drag-item]");
    if (!item || idArrastrado == null) return;
    evt.preventDefault();
    const rect = item.getBoundingClientRect();
    const antes = evt.clientX < rect.left + rect.width / 2;
    const idDestino = Number(item.getAttribute("data-id"));
    moverFotoRelativoA(idArrastrado, idDestino, antes);
    grid.querySelectorAll(".acr-foto-drop-antes, .acr-foto-drop-despues").forEach((el) => el.classList.remove("acr-foto-drop-antes", "acr-foto-drop-despues"));
  });

  // Fallback táctil: mantener presionado sobre la miniatura (no sobre los
  // botones) e ir arrastrando el dedo reordena en vivo.
  let touchId = null, touchTimer = null;
  grid.addEventListener("pointerdown", (evt) => {
    if (evt.pointerType !== "touch") return;
    const item = evt.target.closest("[data-acr-drag-item]");
    if (!item || evt.target.closest("button")) return;
    touchTimer = setTimeout(() => {
      touchId = Number(item.getAttribute("data-id"));
      item.classList.add("acr-foto-arrastrando");
      if (navigator.vibrate) navigator.vibrate(15);
    }, 350);
  });
  grid.addEventListener("pointermove", (evt) => {
    if (evt.pointerType !== "touch" || touchId == null) return;
    evt.preventDefault();
    const el = document.elementFromPoint(evt.clientX, evt.clientY);
    const item = el && el.closest("[data-acr-drag-item]");
    grid.querySelectorAll(".acr-foto-drop-antes, .acr-foto-drop-despues").forEach((n) => n.classList.remove("acr-foto-drop-antes", "acr-foto-drop-despues"));
    if (item && Number(item.getAttribute("data-id")) !== touchId) {
      const rect = item.getBoundingClientRect();
      const antes = evt.clientX < rect.left + rect.width / 2;
      item.classList.add(antes ? "acr-foto-drop-antes" : "acr-foto-drop-despues");
    }
  }, { passive: false });
  grid.addEventListener("pointerup", (evt) => {
    clearTimeout(touchTimer);
    if (evt.pointerType !== "touch" || touchId == null) { touchId = null; return; }
    const el = document.elementFromPoint(evt.clientX, evt.clientY);
    const item = el && el.closest("[data-acr-drag-item]");
    grid.querySelectorAll(".acr-foto-arrastrando").forEach((n) => n.classList.remove("acr-foto-arrastrando"));
    grid.querySelectorAll(".acr-foto-drop-antes, .acr-foto-drop-despues").forEach((n) => n.classList.remove("acr-foto-drop-antes", "acr-foto-drop-despues"));
    if (item) {
      const idDestino = Number(item.getAttribute("data-id"));
      if (idDestino !== touchId) {
        const rect = item.getBoundingClientRect();
        const antes = evt.clientX < rect.left + rect.width / 2;
        moverFotoRelativoA(touchId, idDestino, antes);
      }
    }
    touchId = null;
  });
  grid.addEventListener("pointercancel", () => { clearTimeout(touchTimer); touchId = null; grid.querySelectorAll(".acr-foto-arrastrando").forEach((n) => n.classList.remove("acr-foto-arrastrando")); });
}
function moverFotoRelativoA(idMovida, idDestino, antesDelDestino) {
  const fotos = ACR_DRAFT.fotos;
  const idxOrigen = fotos.findIndex((f) => f.id === idMovida);
  if (idxOrigen === -1) return;
  const [foto] = fotos.splice(idxOrigen, 1);
  let idxDestino = fotos.findIndex((f) => f.id === idDestino);
  if (idxDestino === -1) { fotos.push(foto); renderAcreditacion(); return; }
  if (!antesDelDestino) idxDestino++;
  fotos.splice(idxDestino, 0, foto);
  renderAcreditacion();
}
// --- Arrastrar archivos desde el escritorio para añadirlos a la galería ---
function ligarDropArchivosFotos(overlay) {
  const galeria = overlay.querySelector(".acr-galeria");
  if (!galeria || galeria.dataset.acrDropBind) return;
  galeria.dataset.acrDropBind = "1";
  galeria.addEventListener("dragover", (evt) => {
    if (!evt.dataTransfer || !Array.from(evt.dataTransfer.types || []).includes("Files")) return;
    evt.preventDefault();
    galeria.classList.add("acr-galeria-dragover");
  });
  galeria.addEventListener("dragleave", (evt) => {
    if (evt.target === galeria) galeria.classList.remove("acr-galeria-dragover");
  });
  galeria.addEventListener("drop", (evt) => {
    if (!evt.dataTransfer || !evt.dataTransfer.files || !evt.dataTransfer.files.length) return;
    evt.preventDefault();
    galeria.classList.remove("acr-galeria-dragover");
    const imagenes = Array.from(evt.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    if (imagenes.length) agregarFotosDesdeArchivos(imagenes);
  });
}
function agregarZonaDesdeInput() {
  const input = document.getElementById("acr-input-zona");
  if (!input || !input.value.trim()) return;
  ACR_DRAFT.zonas.push(input.value.trim()); renderAcreditacion();
}
function attachEventos(overlay) {
  const btnVolver = document.getElementById("acr-btn-volver");
  if (btnVolver) btnVolver.addEventListener("click", () => {
    if (ACR_VISTA === "historial") cerrarVisorAcreditacion();
    else if (ACR_VISTA === "galeria") { ACR_VISTA = "historial"; ACR_DRAFT = null; renderAcreditacion(); }
    else if (ACR_VISTA === "form") { ACR_VISTA = "galeria"; renderAcreditacion(); }
    else if (ACR_VISTA === "editorFoto") { ACR_VISTA = "galeria"; ACR_FOTO_EDIT = null; renderAcreditacion(); }
  });
  bindCamposTexto(overlay);
  ligarDragReordenarFotos(overlay);
  ligarDropArchivosFotos(overlay);
  if (overlay.dataset.acrClickBind) return;
  overlay.dataset.acrClickBind = "1";
  overlay.addEventListener("click", (evt) => {
    const btn = evt.target.closest("[data-acr-action]");
    if (!btn) return;
    const accion = btn.getAttribute("data-acr-action");
    const id = btn.getAttribute("data-id") ? Number(btn.getAttribute("data-id")) : null;
    const idx = btn.getAttribute("data-idx") != null ? Number(btn.getAttribute("data-idx")) : null;
    const elid = btn.getAttribute("data-elid");
    const zona = btn.getAttribute("data-zona") || null;
    if (accion === "nuevo") abrirNuevoInforme();
    else if (accion === "editar") abrirEditarInforme(id);
    else if (accion === "duplicar") duplicarInforme(id);
    else if (accion === "eliminar") eliminarInforme(id);
    else if (accion === "generar-pdf") generarPDFInformeAcreditacion(id);
    else if (accion === "cancelar") cancelarFormularioInforme();
    else if (accion === "guardar") guardarInformeDesdeFormulario();
    else if (accion === "toggle-foto") { toggleSeleccionFoto(idx); return; }
    else if (accion === "toggle-seleccion-todas") toggleSeleccionTodas();
    else if (accion === "activar-modo-borrar") activarModoBorrarFotos();
    else if (accion === "cancelar-modo-borrar") cancelarModoBorrarFotos();
    else if (accion === "toggle-foto-borrar") toggleFotoParaBorrar(Number(btn.getAttribute("data-id")));
    else if (accion === "pedir-borrar-foto") { ACR_FOTO_CONFIRMAR_BORRAR = { ids: [Number(btn.getAttribute("data-id"))] }; renderAcreditacion(); }
    else if (accion === "pedir-borrar-varias") { ACR_FOTO_CONFIRMAR_BORRAR = { ids: Array.from(ACR_FOTOS_A_BORRAR) }; renderAcreditacion(); }
    else if (accion === "cancelar-borrar-foto") { ACR_FOTO_CONFIRMAR_BORRAR = null; renderAcreditacion(); }
    else if (accion === "confirmar-borrar-foto") ejecutarBorradoFotos();
    else if (accion === "editar-foto") abrirEditorFoto(Number(btn.getAttribute("data-id")));
    else if (accion === "abrir-foto") abrirEditorFoto(Number(btn.getAttribute("data-id")));
    else if (accion === "editar-descripcion-foto") { ACR_DESC_FOTO_MODAL_ID = Number(btn.getAttribute("data-id")); ACR_DESC_FOTO_ES_NUEVA = false; renderAcreditacion(); }
    else if (accion === "desc-foto-cancelar") { ACR_DESC_FOTO_MODAL_ID = null; ACR_DESC_FOTO_ES_NUEVA = false; renderAcreditacion(); }
    else if (accion === "desc-foto-aplicar") {
      const foto = ACR_DRAFT.fotos.find((f) => f.id === ACR_DESC_FOTO_MODAL_ID);
      const input = document.getElementById("acr-desc-foto-input");
      if (foto && input) foto.descripcion = input.value;
      ACR_DESC_FOTO_MODAL_ID = null;
      ACR_DESC_FOTO_ES_NUEVA = false;
      renderAcreditacion();
    }
    else if (accion === "toggle-foto-visor") { const foto = ACR_DRAFT.fotos.find((f) => f.id === Number(btn.getAttribute("data-id"))); if (foto) foto.seleccionada = !foto.seleccionada; renderAcreditacion(); }
    else if (accion === "siguiente-a-form") { ACR_VISTA = "form"; renderAcreditacion(); }
    else if (accion === "toggle-datos-generales") { ACR_DATOS_GENERALES_ABIERTO = !ACR_DATOS_GENERALES_ABIERTO; renderAcreditacion(); }
    else if (accion === "agregar-acompanante") { ACR_DRAFT.acompanantes.push({ nombre: "", cargo: "" }); renderAcreditacion(); }
    else if (accion === "repetir-acompanantes") { const anterior = ultimoInformeGuardado(); if (anterior && anterior.acompanantes.length) ACR_DRAFT.acompanantes = JSON.parse(JSON.stringify(anterior.acompanantes)); renderAcreditacion(); }
    else if (accion === "quitar-acompanante") { ACR_DRAFT.acompanantes.splice(idx, 1); renderAcreditacion(); }
    else if (accion === "agregar-zona") agregarZonaDesdeInput();
    else if (accion === "quitar-zona") { const z = ACR_DRAFT.zonas[idx]; ACR_DRAFT.zonas.splice(idx, 1); if (z) delete ACR_DRAFT.checklist.porZona[z]; renderAcreditacion(); }
    else if (accion === "abrir-plano-informe") abrirPlanoDelInforme(id);
    else if (accion === "toggle-plano-pdf") {
      if (!ACR_DRAFT.planoRefs) ACR_DRAFT.planoRefs = [];
      let ref = ACR_DRAFT.planoRefs.find((r) => r.planoId === id);
      if (!ref) { ref = { planoId: id, pines: [], trazos: [], rectangulos: [], lineas: [], cotas: [], incluirEnPDF: false, modoPDF: "auto", notaPDF: "" }; ACR_DRAFT.planoRefs.push(ref); }
      ref.incluirEnPDF = btn.checked;
      renderAcreditacion();
    }
    else if (accion === "abrir-elemento-penetrante") abrirModalElemento("penetrante", null);
    else if (accion === "abrir-elemento-junta") abrirModalElemento("junta", null);
    else if (accion === "precargar-levantamiento") precargarElementosDesdeLevantamiento();
    else if (accion === "editar-elemento") abrirModalElemento(null, id);
    else if (accion === "quitar-elemento") { ACR_DRAFT.elementos = ACR_DRAFT.elementos.filter((e) => e.id !== id); delete ACR_DRAFT.checklist.general[id]; Object.values(ACR_DRAFT.checklist.porZona).forEach((z) => delete z[id]); renderAcreditacion(); }
    else if (accion === "checklist-modo") { ACR_DRAFT.checklistModo = btn.getAttribute("data-modo"); renderAcreditacion(); }
    else if (accion === "cambiar-zona-activa") { ACR_ZONA_ACTIVA = btn.getAttribute("data-zona"); renderAcreditacion(); }
    else if (accion === "toggle-cumple") { const estado = obtenerEstadoChecklist(elid, zona); estado.cumple = !estado.cumple; estado.marcados = []; renderAcreditacion(); }
    else if (accion === "toggle-check") { const estado = obtenerEstadoChecklist(elid, zona); const item = btn.getAttribute("data-item"); const i = estado.marcados.indexOf(item); if (i === -1) estado.marcados.push(item); else estado.marcados.splice(i, 1); renderAcreditacion(); }
    else if (accion === "toggle-expandir-checklist") { const clave = claveChecklist(elid, zona); if (ACR_CHECKLIST_EXPANDIDO.has(clave)) ACR_CHECKLIST_EXPANDIDO.delete(clave); else ACR_CHECKLIST_EXPANDIDO.add(clave); renderAcreditacion(); }
    else if (accion === "abrir-observacion") { ACR_OBSERVACION_ABIERTA.add(claveChecklist(elid, zona)); renderAcreditacion(); }
    else if (accion === "abrir-observacion-general") { ACR_OBS_GENERAL_ABIERTA = true; renderAcreditacion(); }
    else if (accion === "abrir-texto-informe") abrirModalTextoInforme();
    else if (accion === "editor-modo") { ACR_FOTO_EDIT.modo = btn.getAttribute("data-modo"); ACR_FOTO_EDIT.flyout = null; ACR_FOTO_EDIT.textoSeleccionado = null; renderAcreditacion(); }
    else if (accion === "toggle-herramientas") { ACR_FOTO_EDIT.herramientasAbiertas = !ACR_FOTO_EDIT.herramientasAbiertas; renderAcreditacion(); }
    else if (accion === "editor-color") { ACR_FOTO_EDIT.color = btn.getAttribute("data-color"); ACR_FOTO_EDIT.flyout = null; renderAcreditacion(); }
    else if (accion === "editor-grosor") { ACR_FOTO_EDIT.grosorFrac = Number(btn.getAttribute("data-grosor")); ACR_FOTO_EDIT.flyout = null; renderAcreditacion(); }
    else if (accion === "editor-tamano-texto") {
      const t = Number(btn.getAttribute("data-tamano"));
      const e = ACR_FOTO_EDIT;
      e.tamanoTexto = t;
      if (e.textoSeleccionado != null && e.textos[e.textoSeleccionado]) e.textos[e.textoSeleccionado].tamano = t;
      e.flyout = null;
      renderAcreditacion();
    }
    else if (accion === "editor-deshacer") {
      const e = ACR_FOTO_EDIT;
      if (e.modo === "texto") {
        if (e.textoSeleccionado != null && e.textos[e.textoSeleccionado]) { e.textos.splice(e.textoSeleccionado, 1); e.textoSeleccionado = null; }
        else e.textos.pop();
      }
      else if (e.modo === "recuadro") e.rectangulos.pop();
      else e.trazos.pop();
      dibujarEditor();
    }

    else if (accion === "editor-reset-recorte") { ACR_FOTO_EDIT.rect = { left: 0, top: 0, right: 1, bottom: 1 }; dibujarEditor(); }
    else if (accion === "editor-cancelar") { ACR_VISTA = "galeria"; ACR_FOTO_EDIT = null; renderAcreditacion(); }
    else if (accion === "editor-aplicar") finalizarEdicionFoto();
  });
}
function confirmarNuevoElemento() {
  const f = ACR_ELEMENTO_FORM;
  const completo = f.categoria === "penetrante" ? !!f.producto : !!(f.tipo && f.barreras && f.posicion && f.producto);
  if (!completo) { if (window.mostrarToast) mostrarToast("Completá la selección antes de añadir.", "error"); return; }
  let nuevoElemento;
  if (f.categoria === "penetrante") {
    const diametroPulgNum = parseFloat(f.diametroPulg);
    const tieneDiametro = f.diametroPulg && !isNaN(diametroPulgNum) && diametroPulgNum > 0;
    const diametroCategoria = esTuberiaCombustible(f.tipo) && tieneDiametro ? (diametroPulgNum > 2 ? "mayor2" : "menor2") : "";
    const opciones = opcionesProductoPenetrante(f.material, f.tipo, f.ubicacion, f.espacioAnular, diametroCategoria);
    const encontrado = opciones.find((o) => o.producto === f.producto);
    if (!encontrado) { if (window.mostrarToast) mostrarToast("No se pudo agregar — probá elegir el producto de nuevo.", "error"); return; }
    nuevoElemento = { id: ACR_ELEMENTO_EDITANDO_ID != null ? ACR_ELEMENTO_EDITANDO_ID : Date.now() + Math.random(), categoria: "penetrante", subtipo: null, material: f.material, tipoPenetrante: f.tipo, ubicacion: f.ubicacion, espacioAnular: f.espacioAnular, diametroPulg: tieneDiametro ? diametroPulgNum : null, producto: f.producto, sistemaUL: encontrado.sistemaUL, espesor: encontrado.espesor, traslape: null };
    // Vueltas de cinta reales, usando la misma tabla oficial que el motor de
    // cálculo de Levantamiento (vueltasCintaPenetrante) — solo aplica para
    // productos de cinta intumescente en tuberías combustibles.
    if (tieneDiametro && elementoUsaCinta(nuevoElemento) && window.vueltasCintaPenetrante) {
      const row = { L: f.tipo, M: f.material, N: f.ubicacion, P: f.producto, D: diametroPulgNum, E: 0 };
      const nv = window.vueltasCintaPenetrante(row);
      if (typeof nv === "number") nuevoElemento.numVueltasCinta = nv;
    }
  } else {
    const junta = window.juntaParaTipo ? window.juntaParaTipo(f.tipo) : null;
    const fila = resolverFilaJunta(junta, f.tipo, f.barreras, f.posicion, f.producto);
    if (!fila) { if (window.mostrarToast) mostrarToast("No se pudo agregar — probá elegir el producto de nuevo.", "error"); return; }
    nuevoElemento = { id: ACR_ELEMENTO_EDITANDO_ID != null ? ACR_ELEMENTO_EDITANDO_ID : Date.now() + Math.random(), categoria: "junta", subtipo: f.tipo === "Muro Cortina" ? "muro_cortina" : "interior", juntaTipo: f.tipo, juntaBarreras: f.barreras, juntaPosicion: f.posicion, producto: f.producto, sistemaUL: fila.sis, espesor: fila.esp, traslape: fila.tras || null };
  }
  if (ACR_ELEMENTO_EDITANDO_ID != null) { const idx = ACR_DRAFT.elementos.findIndex((e) => e.id === ACR_ELEMENTO_EDITANDO_ID); if (idx !== -1) ACR_DRAFT.elementos[idx] = nuevoElemento; }
  else ACR_DRAFT.elementos.push(nuevoElemento);
  if (window.mostrarToast) mostrarToast(ACR_ELEMENTO_EDITANDO_ID != null ? "Cambios guardados." : "Agregado.");
  cerrarModalElemento(); renderAcreditacion();
}

// --- Armado del cuerpo del informe (bloques) ---
function normaOrganismo(el) { return normaParaSubtipo(el.categoria, el.subtipo); }
function elementosPorNorma(informe, filtro) {
  const vistos = new Set(), out = [];
  informe.elementos.filter(filtro).forEach((el) => { if (vistos.has(el.sistemaUL)) return; vistos.add(el.sistemaUL); out.push(el); });
  return out;
}
function descripcionSistemaUL(el) {
  const suj = sujetoElemento(el).replace(/^(Las|Los) /, "");
  return `${el.sistemaUL}. ${suj.charAt(0).toUpperCase()}${suj.slice(1)}`;
}
function parrafoProductos(elementos) {
  const productos = new Set(); let lana = false;
  elementos.forEach((el) => {
    productos.add(productoProsa(el.producto));
    if (el.categoria === "penetrante" && elementoUsaLanaMineral(el)) lana = true;
    if (el.categoria !== "penetrante") lana = true;
  });
  const lista = [];
  if (lana) lista.push("lana mineral de alta densidad 4pcf");
  productos.forEach((p) => lista.push(p));
  if (!lista.length) return null;
  const texto = lista.length === 1 ? lista[0] : `${lista.slice(0, -1).join(", ")} y ${lista[lista.length - 1]}`;
  return `Los productos considerados para estos ensambles corresponden a ${texto} de la marca Hilti.`;
}
function frasePersonas(informe) {
  const nombres = (informe.acompanantes || []).map((a) => `${a.cargo ? a.cargo + " " : ""}${a.nombre}`).filter((x) => x && x.trim());
  if (!nombres.length) return "";
  const texto = nombres.length === 1 ? nombres[0] : `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
  return ` La visita se realiza en conjunto con ${texto}.`;
}
function construirBloquesAuto(informe) {
  const b = [];
  const push = (t, v, extra) => b.push(Object.assign({ t }, typeof v === "string" ? { texto: v } : { items: v }, extra || {}));
  push("pIzq", "A quien concierna"); push("pIzq", "Estimados presentes,");
  let intro = `Este informe tiene el propósito de servir como reporte de acreditación ${informe.tipoInforme === "final" ? "final" : "del avance"} de la instalación de los sellos cortafuego para el proyecto ${informe.proyecto || "—"}`;
  if (informe.ubicacion) intro += `, ubicado en ${informe.ubicacion}`;
  const mismoInstalador = informe.cliente && informe.empresaInstaladora
    && informe.cliente.trim().toLowerCase() === informe.empresaInstaladora.trim().toLowerCase();
  if (informe.cliente && mismoInstalador) intro += `, a cargo del contratista e instalador ${informe.cliente}`;
  else {
    if (informe.cliente) intro += `, a cargo del contratista ${informe.cliente}`;
    if (informe.empresaInstaladora) intro += ` e instalado por ${informe.empresaInstaladora}`;
  }
  intro += ".";
  intro += frasePersonas(informe);
  if (informe.zonas && informe.zonas.length) intro += ` El recorrido de revisión se realiza en ${informe.zonas.join(", ")}.`;
  push("p", intro);
  const penetrantes = elementosPorNorma(informe, (el) => el.categoria === "penetrante");
  if (penetrantes.length) {
    push("p", "Los sistemas de sellos cortafuegos de penetrantes listados por UL 1479 (ASTM E814) considerados en las revisiones realizadas durante la visita son los siguientes:");
    push("lista", penetrantes.map(descripcionSistemaUL));
    const pp = parrafoProductos(informe.elementos.filter((el) => el.categoria === "penetrante"));
    if (pp) push("p", pp);
  }
  const juntasInt = elementosPorNorma(informe, (el) => el.categoria === "junta" && el.subtipo !== "muro_cortina");
  if (juntasInt.length) {
    push("p", "Los sistemas de sellos cortafuegos de juntas listados por UL 2079 (ASTM E1966) considerados en las revisiones realizadas durante la visita son los siguientes:");
    push("lista", juntasInt.map(descripcionSistemaUL));
    const pj = parrafoProductos(informe.elementos.filter((el) => el.categoria === "junta" && el.subtipo !== "muro_cortina"));
    if (pj) push("p", pj);
  }
  const muroCortina = elementosPorNorma(informe, (el) => el.subtipo === "muro_cortina");
  if (muroCortina.length) {
    push("p", "Los sistemas de sellos cortafuegos de juntas listados por ASTM E2307 (Intertek o UL) considerados en las revisiones realizadas durante la visita son los siguientes:");
    push("lista", muroCortina.map(descripcionSistemaUL));
  }
  push("p", "Las revisiones evidenciadas en el presente informe se realizan durante el recorrido de forma aleatoria con pruebas destructivas o mediciones en sitio que verifiquen las condiciones del sello cortafuego instalado con respecto a los mínimos indicados por los sistemas UL anteriormente listados. Se incluyen en anexos fotos del recorrido como referencia visual del estado de los requerimientos mínimos solicitados por los ensambles.");
  push("titulo", "Resultado de la inspección:");
  if (informe.observaciones) push("p", informe.observaciones);
  generarTextoCumplimiento(informe).split("\n\n").forEach((parrafo) => {
    const limpio = parrafo.trim();
    if (!limpio) return;
    if (limpio === "Cumplimientos verificados:" || limpio === "Hallazgos de no cumplimiento:") push("titulo", limpio, { pequeno: true });
    else push("p", limpio);
  });
  if (informe.esSeguimiento) {
    let seg = "Se verifica que las recomendaciones y hallazgos de no cumplimiento en visitas anteriores al proyecto han sido trabajados por el personal para cumplir con los requerimientos mínimos de los ensambles.";
    if (informe.seguimientoTexto) seg += ` ${informe.seguimientoTexto}`;
    push("p", seg);
  }
  if (hayHallazgos(informe)) push("p", "Con base en lo anterior se comprueba que, a la fecha de la visita del presente informe, la instalación de los productos y sistemas debe mejorarse conforme a los hallazgos de incumplimiento comentados anteriormente. Se realizarán visitas posteriores para verificar la corrección en los puntos que se requieran para lograr el cumplimiento.");
  else if (informe.tipoInforme === "final") {
    const antecedente = hayInformesAnterioresDelProyecto(informe) ? ", en los informes anteriores y en las visitas previas realizadas," : "";
    push("p", `Con base en lo anterior${antecedente} y tomando en consideración que las revisiones aleatorias de los sellos cortafuego se efectúan según las posibilidades y limitaciones de acceso a las distintas zonas del proyecto, se verifica que la instalación de los productos y ensambles de sellos cortafuego revisados en el proyecto ha seguido de forma adecuada los lineamientos mínimos indicados en los sistemas seleccionados, respaldados por las normas ASTM y UL, conforme a la normativa NFPA y al Reglamento Nacional de Protección Contra Incendios de Costa Rica. Se aclara que el presente informe tiene como alcance únicamente la revisión de los sellos cortafuego en las barreras cortafuego; por lo tanto, la integridad y capacidad de resistencia al fuego propia de la barrera (pared o losa), así como cualquier solución con parches, cenefas o cajones, debe ser validada y revisada por parte del proveedor de los materiales correspondientes a dicha aplicación y su respectivo ensamble.`);
  }
  else push("p", "Con base en lo anterior se comprueba que, a la fecha de la visita del presente informe, el avance en la instalación de los productos y sistemas se mantiene de forma correcta conforme a los lineamientos y espesores indicados en los sistemas seleccionados respaldados por las normas ASTM y UL.");
  push("p", "A todo aquel que concierne, se recuerda que la compartimentación se debe realizar de forma integral y este informe se limita a la revisión de los sellos cortafuego en el alcance del contratista acá mencionado. La compartimentación se constituye de barreras cortafuego como paredes y losas, puertas y ventanas cortafuego, sellos cortafuego de pasantes que atraviesen las barreras y sellos cortafuego de juntas entre las barreras de distintos materiales; por lo que, para garantizar un adecuado comportamiento integral de la compartimentación, cualquier sello adicional de otro contratista debe estar presente con su respectiva normativa de respaldo.");
  push("p", "El presente informe refleja el estado de los sellos cortafuego observado a la fecha de la visita indicada y no cubre condiciones, modificaciones o daños ocasionados con posterioridad a esa fecha, ya sea por otros contratistas o por trabajos subsecuentes en el proyecto.");
  push("p", "Agradecemos la confianza depositada en Superba para velar por el cumplimiento de la compartimentación diseñada y quedamos atentos a cualquier duda o necesidad que pueda surgir en este respecto.");
  return b;
}

// --- Texto completo del informe (editable a mano) --------------------------
// El modal "Ver texto del informe" muestra el CUERPO completo de la carta en
// texto plano: encabezado, intro, listas de sistemas UL, metodología,
// resultado de la inspección, seguimiento, conclusión y cierre. NO incluye la
// firma, el anexo fotográfico ni los PDF de sistemas UL — esos los arma el
// generador de PDF aparte y no tiene sentido editarlos como texto.
//
// Si Kevin edita el texto, se guarda en textoInformeManual y el PDF usa esa
// versión: se vuelve a parsear a bloques con parsearTextoABloques().

// Títulos que se dibujan en negrita en el PDF. Se detectan al parsear de vuelta.
const ACR_TITULOS = [
  "Resultado de la inspección:",
  "Cumplimientos verificados:",
  "Hallazgos de no cumplimiento:",
];
// Títulos que van en tamaño chico (sub-encabezados dentro del resultado).
const ACR_TITULOS_PEQUENOS = ["Cumplimientos verificados:", "Hallazgos de no cumplimiento:"];
// Líneas de encabezado que van alineadas a la izquierda, sin justificar.
const ACR_LINEAS_IZQ = ["A quien concierna", "Estimados presentes,"];

function serializarBloques(bloques) {
  const partes = [];
  bloques.forEach((b) => {
    // Las viñetas de una misma lista van pegadas (un salto simple entre ellas)
    // para que en el textarea se lean como un bloque y no sueltas.
    if (b.t === "lista") partes.push((b.items || []).map((item) => `• ${item}`).join("\n"));
    else partes.push(b.texto || "");
  });
  return partes.join("\n\n");
}

function parsearTextoABloques(texto) {
  const bloques = [];
  const parrafos = String(texto == null ? "" : texto).split(/\n\s*\n/);
  parrafos.forEach((crudo) => {
    const limpio = crudo.trim();
    if (!limpio) return;
    // Bloque de viñetas: una o varias líneas que arrancan con • - o *.
    // Una línea sin viñeta dentro del bloque se toma como continuación del
    // ítem anterior (por si Kevin parte un ítem largo en dos renglones).
    if (/^[•\-*]\s/.test(limpio)) {
      const items = [];
      limpio.split("\n").forEach((linea) => {
        const l = linea.trim();
        if (!l) return;
        if (/^[•\-*]\s/.test(l)) items.push(l.replace(/^[•\-*]\s*/, "").trim());
        else if (items.length) items[items.length - 1] += " " + l;
        else items.push(l);
      });
      const ultimo = bloques[bloques.length - 1];
      if (ultimo && ultimo.t === "lista") ultimo.items = ultimo.items.concat(items);
      else bloques.push({ t: "lista", items });
      return;
    }
    if (ACR_TITULOS.includes(limpio)) {
      bloques.push({ t: "titulo", texto: limpio, pequeno: ACR_TITULOS_PEQUENOS.includes(limpio) });
      return;
    }
    if (ACR_LINEAS_IZQ.includes(limpio)) { bloques.push({ t: "pIzq", texto: limpio }); return; }
    // Un párrafo normal partido en varios renglones se une en uno solo:
    // el PDF ya lo vuelve a envolver según el ancho de la caja.
    bloques.push({ t: "p", texto: limpio.split("\n").map((l) => l.trim()).filter(Boolean).join(" ") });
  });
  return bloques;
}

// Texto plano del cuerpo completo: la versión editada a mano si existe,
// si no la generada automáticamente desde los datos del informe.
function textoCompletoInforme(informe) {
  if (informe.textoInformeManual != null) return informe.textoInformeManual;
  return serializarBloques(construirBloquesAuto(informe));
}

// Bloques que consume el generador de PDF.
function construirBloquesInforme(informe) {
  if (informe.textoInformeManual != null) return parsearTextoABloques(informe.textoInformeManual);
  return construirBloquesAuto(informe);
}

function linkSistemaDeElemento(el) {
  try {
    if (el.categoria === "penetrante") {
      const ap = el.espacioAnular ? "Otro" : 0;
      const row = window.MAIN_TABLE ? window.MAIN_TABLE[window.dbKey(el.material, el.tipoPenetrante, el.ubicacion, ap, el.producto)] : null;
      if (!row) return null;
      for (let i = 1; i < row.length; i += 2) { if (row[i] === el.sistemaUL) return row[i + 1] || null; }
      return row[2] || null;
    }
    const junta = window.juntaParaTipo ? window.juntaParaTipo(el.juntaTipo) : null;
    const fila = resolverFilaJunta(junta, el.juntaTipo, el.juntaBarreras, el.juntaPosicion, el.producto);
    return fila ? fila.link || null : null;
  } catch (e) { return null; }
}

async function bytesPDFRemoto(url) {
  const u = String(url || "");
  if (!u || /drive\.google\.com/.test(u)) return null;
  try {
    const resp = await fetch(u, { mode: "cors" });
    if (!resp.ok) return null;
    const bytes = new Uint8Array(await resp.arrayBuffer());
    if (bytes.length < 5) return null;
    const firma = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4]);
    return firma === "%PDF-" ? bytes : null;
  } catch (e) { return null; }
}

async function generarPDFInformeAcreditacion(informeId) {
  const informe = INFORMES_ACREDITACION.find((i) => i.id === informeId);
  if (!informe) return;
  if (!window.jspdf) { if (window.mostrarToast) mostrarToast("No se pudo cargar el motor de PDF.", "error"); return; }
  const toast = window.mostrarToastProgreso ? mostrarToastProgreso("Generando PDF del informe…") : null;
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "portrait" });
    const titulo = `Informe de Acreditación ${informe.tipoInforme === "final" ? "Final" : "de Avance"} de Sellos Cortafuego`;
    const marginL = 72, anchoTexto = 468, FS = 10.5, LH = 14.5;
    let safe = window.dibujarLetterheadPDF ? window.dibujarLetterheadPDF(doc, titulo) : { top: 140, bottom: 735 };
    let y = safe.top;
    function nuevaPagina() { doc.addPage(); safe = window.dibujarLetterheadPDF ? window.dibujarLetterheadPDF(doc, titulo) : { top: 140, bottom: 735 }; y = safe.top; }
    function asegurar(alto) { if (y + alto > safe.bottom) nuevaPagina(); }
    function dibujarLineaJustificada(linea, x, yy, ancho) {
      const palabras = String(linea).split(" ").filter((p) => p.length);
      if (palabras.length < 2) { doc.text(linea, x, yy); return; }
      const anchoPalabras = palabras.reduce((a, p) => a + doc.getTextWidth(p), 0);
      const espacio = (ancho - anchoPalabras) / (palabras.length - 1);
      if (espacio > doc.getTextWidth(" ") * 4) { doc.text(linea, x, yy); return; }
      let cx = x; palabras.forEach((p) => { doc.text(p, cx, yy); cx += doc.getTextWidth(p) + espacio; });
    }
    function escribirParrafo(texto, opts) {
      opts = opts || {};
      const ancho = opts.ancho || anchoTexto, x = opts.x || marginL;
      doc.setFont("helvetica", opts.negrita ? "bold" : (opts.italica ? "italic" : "normal"));
      doc.setFontSize(opts.size || FS);
      const lineas = doc.splitTextToSize(String(texto == null ? "" : texto), ancho);
      lineas.forEach((linea, i) => {
        asegurar(LH);
        const ultima = i === lineas.length - 1;
        if (opts.justificar && !ultima) dibujarLineaJustificada(linea, x, y, ancho); else doc.text(linea, x, y);
        y += LH;
      });
      y += opts.espacioDespues != null ? opts.espacioDespues : 12;
    }
    doc.setTextColor(20, 20, 20);
    construirBloquesInforme(informe).forEach((bloque) => {
      if (bloque.t === "titulo") { asegurar(LH + 6); y += 4; escribirParrafo(bloque.texto, { negrita: true, size: bloque.pequeno ? FS : FS + 1, espacioDespues: 6 }); }
      else if (bloque.t === "lista") {
        (bloque.items || []).forEach((item) => {
          const lineas = doc.splitTextToSize(item, anchoTexto - 18);
          asegurar(lineas.length * LH); doc.setFont("helvetica", "normal"); doc.setFontSize(FS);
          doc.text("•", marginL + 4, y);
          lineas.forEach((l) => { asegurar(LH); doc.text(l, marginL + 18, y); y += LH; });
        });
        y += 8;
      } else { escribirParrafo(bloque.texto, { justificar: bloque.t === "p" }); }
    });
    asegurar(90); y += 20;
    escribirParrafo("Atentamente,", { espacioDespues: 34 });
    doc.setDrawColor(120, 120, 120); doc.line(marginL, y, marginL + 220, y); y += 14;
    escribirParrafo(nombreInspectorFirma(informe.inspector), { negrita: true, espacioDespues: 2 });
    escribirParrafo("Departamento de Ingeniería Superba", { espacioDespues: 0 });
    // Plano del recorrido marcado (si el usuario lo activó desde la sección
    // "Plano del recorrido" del formulario) — va antes de las fotos.
    const planoRefsAIncluir = (informe.planoRefs || []).filter((r) => r.incluirEnPDF && (r.trazos.length || r.rectangulos.length || r.lineas.length || r.pines.length));
    for (const ref of planoRefsAIncluir) {
      const plano = (window.PLANOS || []).find((p) => p.id === ref.planoId);
      if (!plano || !window.dibujarPlanoConMarcasCanvas) continue;
      let resultado;
      try { resultado = await generarImagenPlanoParaPDF(ref.planoId, ref, ref.modoPDF === "completo"); } catch (e) { continue; }
      if (!resultado) continue;
      nuevaPagina();
      escribirParrafo("PLANO DEL RECORRIDO", { negrita: true, size: FS + 1, espacioDespues: 14 });
      let w = 420, h = 320;
      try { const props = doc.getImageProperties(resultado.dataUrl); if (props && props.width && props.height) { const escala = Math.min(420 / props.width, 460 / props.height); w = props.width * escala; h = props.height * escala; } } catch (e) {}
      const imgX = marginL + (anchoTexto - w) / 2;
      asegurar(h + 30);
      try { doc.addImage(resultado.dataUrl, "JPEG", imgX, y, w, h, undefined, "FAST"); } catch (e) {}
      y += h + 14;
      doc.setFont("helvetica", "italic"); doc.setFontSize(FS - 1);
      const notaBase = ref.notaPDF && ref.notaPDF.trim() ? ref.notaPDF.trim() : `Plano ${plano.nombre}${resultado.recortado ? " — recorte de la zona marcada durante el recorrido." : " — marcado durante el recorrido."}`;
      doc.splitTextToSize(notaBase, anchoTexto).forEach((l) => { asegurar(LH); doc.text(l, marginL + anchoTexto / 2, y, { align: "center" }); y += LH; });
      doc.setFont("helvetica", "normal"); y += 20;
    }
    const fotos = (informe.fotos || []).filter((f) => f.seleccionada);
    if (fotos.length) {
      nuevaPagina();
      escribirParrafo("ANEXO FOTOGRÁFICO", { negrita: true, size: FS + 1, espacioDespues: 14 });
      const imgMaxW = 380, imgMaxH = 300;
      fotos.forEach((foto, idx) => {
        let w = imgMaxW, h = imgMaxH;
        try { const props = doc.getImageProperties(foto.dataUrl); if (props && props.width && props.height) { const escala = Math.min(imgMaxW / props.width, imgMaxH / props.height); w = props.width * escala; h = props.height * escala; } } catch (e) {}
        const imgX = marginL + (anchoTexto - w) / 2;
        asegurar(h + 30);
        try { doc.addImage(foto.dataUrl, "JPEG", imgX, y, w, h, undefined, "FAST"); } catch (e) {}
        y += h + 14;
        doc.setFont("helvetica", "italic"); doc.setFontSize(FS - 1);
        const caption = `Figura ${idx + 1}. ${foto.descripcion || "Sin descripción"}`;
        doc.splitTextToSize(caption, anchoTexto).forEach((l) => { asegurar(LH); doc.text(l, marginL + anchoTexto / 2, y, { align: "center" }); y += LH; });
        doc.setFont("helvetica", "normal"); y += 20;
      });
    }
    const normas = Array.from(new Set(informe.elementos.map(normaOrganismo)));
    const sistemas = [];
    const vistos = new Set();
    informe.elementos.forEach((el) => { if (vistos.has(el.sistemaUL)) return; vistos.add(el.sistemaUL); sistemas.push({ sistema: el.sistemaUL, link: linkSistemaDeElemento(el), descripcion: descripcionSistemaUL(el) }); });
    if (normas.length) {
      nuevaPagina();
      escribirParrafo("ANEXOS: NORMAS", { negrita: true, size: FS + 2, espacioDespues: 16 });
      normas.forEach((n) => escribirParrafo(n, { espacioDespues: 4 }));
      y += 10;
      escribirParrafo("Sistemas incluidos a continuación:", { negrita: true, espacioDespues: 8 });
      sistemas.forEach((s) => escribirParrafo(`•  ${s.descripcion}`, { espacioDespues: 4 }));
    }
    const total = doc.internal.getNumberOfPages();
    for (let p = 1; p <= total; p++) { doc.setPage(p); if (window.dibujarNumeroPaginaPDF) dibujarNumeroPaginaPDF(doc, p, total); }
    const nombreArchivo = `Informe-Acreditacion-${(informe.proyecto || "proyecto").replace(/[^a-z0-9]+/gi, "-")}-${informe.fecha || ""}.pdf`;
    let bytesFinales = new Uint8Array(doc.output("arraybuffer"));
    const conLink = sistemas.filter((s) => s.link);
    if (conLink.length && window.PDFLib) {
      let fallidos = 0;
      try {
        const master = await window.PDFLib.PDFDocument.load(bytesFinales, { ignoreEncryption: true });
        for (const s of conLink) {
          const bytes = await bytesPDFRemoto(s.link);
          if (!bytes) { fallidos++; continue; }
          try { const src = await window.PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true }); const paginas = await master.copyPages(src, src.getPageIndices()); paginas.forEach((pg) => master.addPage(pg)); } catch (e) { fallidos++; }
        }
        bytesFinales = await master.save();
      } catch (e) {}
      if (fallidos && window.mostrarToast) mostrarToast(`${fallidos} sistema(s) UL no se pudieron adjuntar automáticamente.`, "error");
    }
    const blob = new Blob([bytesFinales], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = nombreArchivo;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    if (window.mostrarToast) mostrarToast("PDF del informe generado.");
  } catch (err) {
    console.error("generarPDFInformeAcreditacion:", err);
    if (window.mostrarToast) mostrarToast("No se pudo generar el PDF: " + err.message, "error");
  } finally {
    if (toast && window.ocultarToastProgreso) ocultarToastProgreso(toast);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const btnAbrir = document.getElementById("btn-abrir-acreditacion");
  if (btnAbrir) btnAbrir.addEventListener("click", abrirVisorAcreditacion);
});

window.abrirVisorAcreditacion = abrirVisorAcreditacion;
})();
