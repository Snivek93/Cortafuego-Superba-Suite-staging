// ============================================================================
// importar-texto-libre.js — encapsulado en IIFE (sin exponer todo a window; ver export list abajo)
// ============================================================================
(function () {
function materialRecomendado(L, diamIn) {
  const map = {
    "Tubería Metal": "Pasta FS ONE MAX",
    "Tubería Metal Aislado": "Pasta FS ONE MAX",
    "Tubería Cobre Aislado HVAC": "Cinta con Collar Metálico CP 648-E/ER",
    "Tubería EMT": "Pasta FS ONE MAX",
    "Tubería Combustible (PVC, CPVC, PEX, PP-R)": (diamIn && diamIn > 2) ? "Cinta con Collar Metálico CP 648-E/ER" : "Pasta FS ONE MAX",
    "Tubería Combustible Aislada (PVC, CPVC, PEX, PP-R)": "Cinta con Collar Metálico CP 648-E/ER",
    "Bandeja de Cables": "Pasta FS ONE MAX",
    "Cable Armado": "Pasta FS ONE MAX",
    "Cables en Paso Repenetrable": 'Manga CP 653 4"',
    "Cables Sueltos": "Pasta FS ONE MAX",
    "Caja Electromecánica UL": "Putty Pad CP 617",
    "Ducto Rectangular": "Pasta FS ONE MAX",
    "Ducto Rectangular Aislado": "Pasta FS ONE MAX",
    "Ducto Redondo": "Pasta FS ONE MAX",
    "Ducto Redondo Aislado": "Pasta FS ONE MAX",
    "Pasante Múltiple": "Pasta FS ONE MAX",
    "Vacío": "Pasta FS ONE MAX",
    "Viga W": "Pasta FS ONE MAX",
    "Viga Canal": "Pasta FS ONE MAX",
    "Viga Tubo Rectangular": "Pasta FS ONE MAX",
  };
  return map[L] || OPTS_P[0];
}

function parseFraccion(txt) {
  if (!txt) return null;
  txt = txt.trim().replace(/"$/, "");
  if (!txt) return null;
  let m = txt.match(/^(-?\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (m) {
    const whole = parseFloat(m[1]), num = parseFloat(m[2]), den = parseFloat(m[3]);
    if (den) return (whole < 0 ? -1 : 1) * (Math.abs(whole) + num / den);
  }
  m = txt.match(/^(-?\d+)\s*\/\s*(\d+)$/);
  if (m) {
    const num = parseFloat(m[1]), den = parseFloat(m[2]);
    if (den) return num / den;
  }
  const v = parseFloat(txt.replace(",", "."));
  return isNaN(v) ? null : v;
}

const TXT_KEYWORDS = [
  [/ducto\s*barra|ducto\s*rectangular/i, "Ducto Rectangular", true],
  [/gaveta/i, "Pasante Múltiple", true],
  [/(bandeja|canasta)/i, "Bandeja de Cables", true],
  [/cables?\s*armados?/i, "Cable Armado", false],
  [/preaislad|cobre.*hvac|hvac.*cobre/i, "Tubería Cobre Aislado HVAC", false],
  [/met[aá]lica?\s*aislad|aislad\w*\s*met[aá]lica?|metal\s*aislad/i, "Tubería Metal Aislado", false],
  [/(^|\s)metal(?:es|ica|ico)?(\s|$)/i, "Tubería Metal", false],
  [/vac[ií]o/i, "Vacío", false],
  [/pvc|cpvc|pex|pp-?r|combustible/i, "Tubería Combustible (PVC, CPVC, PEX, PP-R)", false],
  [/emt/i, "Tubería EMT", false],
  [/incendio/i, "Tubería Metal", false],
];

function parsearTxtLevantamiento(text) {
  const warnings = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");

  let headerEndIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "" && i > 0) { headerEndIdx = i; break; }
  }
  const headerLines = lines.slice(0, headerEndIdx);
  const bodyText = lines.slice(headerEndIdx).join("\n");

  const projectInfo = {};
  const config = {};
  let defaultI = null;
  let defaultN = null;

  headerLines.forEach(line => {
    const l = line.trim();
    let m;
    if ((m = l.match(/proyecto\s+(.+)/i))) projectInfo.nombre = m[1].trim();
    else if ((m = l.match(/cliente\s+(.+)/i))) projectInfo.cliente = m[1].trim();
    else if ((m = l.match(/espacio\s+anular\s+de\s+([\d./]+)/i))) defaultI = parseFraccion(m[1]);
    else if ((m = l.match(/desperdicio\s+de\s+(\d+(?:\.\d+)?)\s*%/i))) config.C17 = parseFloat(m[1]) / 100;
    if (/pared\s+liviana|panel\s+de\s+yeso|gypsum/i.test(l)) defaultN = "Panel de Yeso";
    else if (/pared\s+de\s+concreto|concreto/i.test(l)) defaultN = "Concreto";
  });
  if (defaultN === null) defaultN = OPTS_N[0];
  if (defaultI === null) defaultI = 0.5;

  const blocks = bodyText.split(/\n\s*\n/).map(b => b.split("\n").map(l => l.trim()).filter(Boolean)).filter(b => b.length > 0);

  const filas = [];
  blocks.forEach(blockLines => {
    const zona = blockLines[0];
    const itemLines = blockLines.slice(1);
    itemLines.forEach(line => {
      const original = line;
      const qm = line.match(/^(\d+|[Ii])\s*[xX]?\s*(.*)$/);
      if (!qm) { warnings.push(`No se pudo leer (sin cantidad): "${original}"`); return; }
      const qty = /^[Ii]$/.test(qm[1]) ? 1 : parseInt(qm[1], 10);
      let rest = qm[2].trim();

      let L = null, esDim = false;
      for (const [re, tipo, requiereDims] of TXT_KEYWORDS) {
        if (re.test(rest)) { L = tipo; esDim = requiereDims; break; }
      }
      if (!L) { warnings.push(`Tipo de penetrante no reconocido: "${original}"`); return; }

      const dimM = rest.match(/(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)/);
      const diamM = rest.match(/(\d+\/\d+|\d+(?:\.\d+)?)\s*[”"″]/) || rest.match(/(\d+\/\d+)/);

      const row = {
        A: zona, B: "", C: qty,
        D: "", E: 0, F: "", G: "", H: "", I: defaultI, J: 0,
        L, M: OPTS_M[0], N: defaultN, O: OPTS_O[0],
      };

      if (esDim && dimM) {
        row.F = parseFloat(dimM[1]);
        row.G = parseFloat(dimM[2]);
      } else if (!esDim && diamM) {
        row.D = parseFraccion(diamM[1]);
      } else if (dimM) {
        row.F = parseFloat(dimM[1]); row.G = parseFloat(dimM[2]);
      } else {
        warnings.push(`No se encontró tamaño/diámetro en: "${original}" (se agregó sin dimensión, revisar manualmente)`);
      }

      row.P = materialRecomendado(L, row.D || null);
      filas.push(row);
    });
  });

  return { projectInfo, config, filas, warnings };
}

function importarTxt(file) {
  const reader = new FileReader();
  reader.onerror = () => mostrarToast("No se pudo leer el archivo seleccionado.", "error");
  reader.onload = () => {
    let parsed;
    try {
      parsed = parsearTxtLevantamiento(reader.result);
      if (parsed.filas.length === 0) throw new Error("No se reconoció ninguna fila con cantidad y tipo de penetrante.");
    } catch (err) {
      mostrarToast("No se pudo leer el archivo de texto. " + err.message, "error");
      return;
    }
    const aplicar = () => {
      pushUndo();
      ROWS = parsed.filas.map(f => Object.assign(nuevaFila(), f, { _id: ROW_SEQ++ }));
      Object.assign(CONFIG, parsed.config);
      Object.assign(PROJECT_INFO, parsed.projectInfo);
      sincronizarCamposConfig();
      renderTable();
      if (ACTIVE_TAB === "resumen") renderResumen();
      if (ACTIVE_TAB === "levantamiento-tab") renderLevantamientoTab();
      marcarCambio();
      let msg = `Levantamiento importado: ${parsed.filas.length} fila(s).`;
      if (parsed.warnings.length > 0) msg += ` ${parsed.warnings.length} línea(s) no se pudieron interpretar — revisá la consola o el archivo original.`;
      mostrarToast(msg, parsed.warnings.length > 0 ? "error" : undefined);
      if (parsed.warnings.length > 0) console.warn("Líneas no interpretadas del .txt:", parsed.warnings);
    };
    if (ROWS.length > 0) {
      pedirConfirmacion(`Se encontraron ${parsed.filas.length} fila(s) en el archivo de texto. Esto va a reemplazar las filas actuales del proyecto. ¿Continuar?`, aplicar);
    } else {
      aplicar();
    }
  };
  reader.readAsText(file);
}

function datosProyectoActual() {
  const payload = {
    tipo: "calculadora-cortafuego-hilti-proyecto",
    version: 1,
    fechaExportacion: new Date().toISOString(),
    projectInfo: PROJECT_INFO,
    config: CONFIG,
    filas: ROWS.map(r => Object.assign({}, r)),
    filasJuntas: ROWS_J.map(r => Object.assign({}, r)),
    itemsManuales: MANUAL_ITEMS.map(m => { const c = Object.assign({}, m); delete c._id; return c; }),
    planos: PLANOS,
    informes: INFORMES_ACREDITACION,
  };
  if (JSON.stringify(MAIN_TABLE) !== MAIN_TABLE_DEFAULT_JSON) payload.mainTableOverride = MAIN_TABLE;
  if (JSON.stringify(JUNTAS_TABLE) !== JUNTAS_TABLE_DEFAULT_JSON) payload.juntasTableOverride = JUNTAS_TABLE;
  return payload;
}

function cargarDatosEmbebidos() {
  const tag = document.getElementById("embedded-project-data");
  if (!tag) return false;
  const txt = tag.textContent.trim();
  if (!txt) return false;
  try {
    const data = JSON.parse(txt);
    if (!data || !Array.isArray(data.filas) || data.filas.length === 0) return false;
    ROWS = data.filas.map(f => Object.assign(nuevaFila(), f, { _id: typeof f._id === "number" ? f._id : ROW_SEQ++ }));
    ROW_SEQ = Math.max(ROW_SEQ, ...ROWS.map(r => r._id), 0) + 1;
    if (Array.isArray(data.filasJuntas)) {
      ROWS_J = data.filasJuntas.map(f => Object.assign({}, f, { _id: typeof f._id === "number" ? f._id : ROW_J_SEQ++ }));
      ROW_J_SEQ = Math.max(ROW_J_SEQ, ...ROWS_J.map(r => r._id), 0) + 1;
    }
    MANUAL_ITEMS = Array.isArray(data.itemsManuales) ? data.itemsManuales.map(m => Object.assign({}, m, { _id: MANUAL_ITEM_SEQ++ })) : [];
    if (data.config) Object.assign(CONFIG, data.config);
    if (data.projectInfo) Object.assign(PROJECT_INFO, data.projectInfo);
    if (data.mainTableOverride) MAIN_TABLE = data.mainTableOverride;
    if (data.juntasTableOverride) JUNTAS_TABLE = data.juntasTableOverride;
    PLANOS = Array.isArray(data.planos) ? data.planos : [];
    PLANO_SEQ = PLANOS.reduce((m, p) => Math.max(m, p.id || 0), 0) + 1;
    INFORMES_ACREDITACION = Array.isArray(data.informes) ? data.informes : [];
    INFORME_ACR_SEQ = INFORMES_ACREDITACION.reduce((m, i) => Math.max(m, i.id || 0), 0) + 1;
    return true;
  } catch (e) {
    return false;
  }
}

window.materialRecomendado = materialRecomendado;
window.parseFraccion = parseFraccion;
window.importarTxt = importarTxt;
window.datosProyectoActual = datosProyectoActual;
window.cargarDatosEmbebidos = cargarDatosEmbebidos;
})();
