// ============================================================================
// excel-export-import.js — encapsulado en IIFE (sin exponer todo a window; ver export list abajo)
// ============================================================================
(function () {
// ============================================================================
// excel-export-import.js
// Exportar a Excel (hoja CALCULADORA, Levantamiento de Penetrantes y de Juntas), exportar/importar matrices maestras de Base de Datos, comparación de cambios antes de aplicar una matriz importada, e importar un levantamiento desde el Excel original.
// (Parte del proyecto Calculadora Cortafuego Hilti — ver README.md para el mapa completo de módulos.)
// ============================================================================

// Exportar el levantamiento actual al formato de la hoja CALCULADORA del
// Excel original de Hilti (mismos encabezados, misma fila de inicio de datos).
//
// Solo se exportan las columnas que existen en el Excel original (A-J, K
// recalculada, L-P, R). Los campos que agregamos en esta app y que el Excel
// original no contempla (Membrana, tamaño y forma de instalación del Putty
// Pad) NO se exportan como columnas — no tienen dónde ir en el original y no
// afectan a P, que siempre es el genérico "Putty Pad CP 617" sin importar el
// tamaño elegido acá.
// ============================================================================
const K_TEXTO = {
  "Multiple": "Múltiple",
  "Vacio": "Vacío"
};
function kFromLTexto(L) {
  const k = kFromL(L);
  return K_TEXTO[k] || k;
}

function exportarLevantamientoExcel() {
  if (ROWS.length === 0) { mostrarToast("No hay filas para exportar.", "error"); return; }

  const HEADERS = [
    "Zona o Descripción", "Nivel", "Cantidad Penetrantes\n(und)",
    "Diámetro \nTubería o Cable\n(in)", "Espesor del Aislamiento \n(in)",
    "Dimensión A\n(cm)", "Dimensión B\n(cm)", "Profundidad \nCajas Electricas\n(cm)",
    "Espacio Anular\n(in)", "Porcentaje de Ocupación (%)",
    "Tipo de penetrante", "Tipo de Penetrante", "Tipo de Barrera",
    "Material de Barrera", "F Rating", "Material Cortafuego Hilti",
    "NORMATIVA\nSistemas UL 1479", "Nota"
  ];

  // Filas 1-21 en blanco para respetar el mismo desplazamiento del original
  // (encabezados en la fila 22, datos desde la fila 23).
  const aoa = [];
  for (let i = 0; i < 21; i++) aoa.push([]);
  aoa.push(HEADERS);

  // Los campos numéricos vacíos deben quedar como celda realmente en blanco
  // (undefined), nunca como texto "" — un "" en una celda hace que Excel la
  // trate como texto y cualquier fórmula que sume/reste esa celda (ej. D23+2*E23)
  // devuelve #VALOR!, aunque la celda se vea "vacía" a simple vista.
  const numOrBlank = (v) => (v === "" || v === undefined || v === null) ? undefined : v;

  for (const r of ROWS) {
    aoa.push([
      r.A || "", r.B || "", numOrBlank(r.C), numOrBlank(r.D), numOrBlank(r.E),
      numOrBlank(r.F), numOrBlank(r.G), numOrBlank(r.H),
      numOrBlank(r.I), numOrBlank(r.J),
      kFromLTexto(r.L), r.L, r.M, r.N, r.O, r.P,
      undefined, r.R || ""
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 22 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
    { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
    { wch: 22 }, { wch: 34 }, { wch: 12 }, { wch: 16 }, { wch: 10 },
    { wch: 30 }, { wch: 18 }, { wch: 22 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "CALCULADORA");

  const nombre = (PROJECT_INFO && PROJECT_INFO.nombre) ? PROJECT_INFO.nombre.trim() : "";
  const fileName = `Levantamiento${nombre ? " - " + nombre : ""}.xlsx`.replace(/[\\/:*?"<>|]/g, "");
  XLSX.writeFile(wb, fileName);
  mostrarToast(`Excel exportado: ${ROWS.length} fila(s). Pegá los datos a partir de la fila 23 de tu Excel original (celdas A:R).`);
}

// ============================================================================
// Exportar Levantamiento (Penetrantes) a Excel — hoja plana, agrupada por
// zona/nivel, pensada para compartir en campo (no es el formato original de
// Hilti; para eso está "Exportar a Excel (formato original)").
// ============================================================================
function exportarLevantamientoPenetrantesExcel() {
  const grupos = agruparPorZona();
  const totalItems = grupos.reduce((acc, g) => acc + g.items.length, 0);
  if (totalItems === 0) { mostrarToast("No hay penetrantes con datos completos para exportar.", "error"); return; }

  const HEADERS = ["Zona", "Nivel", "Cantidad", "Tipo de Penetrante", "Dimensión", "Espacio Anular (in)", "Tipo de Barrera", "Material de Barrera", "F Rating", "Material Cortafuego Hilti", "Nota"];
  const aoa = [];
  const nombreProy = (PROJECT_INFO && PROJECT_INFO.nombre) ? PROJECT_INFO.nombre.trim() : "";
  aoa.push([`Levantamiento de Penetrantes${nombreProy ? " — " + nombreProy : ""}`]);
  aoa.push([`Generado: ${new Date().toLocaleDateString("es-CR")}`]);
  aoa.push([]);
  aoa.push(HEADERS);

  grupos.forEach(g => {
    g.items.forEach(r => {
      const esRedondoLibre = levUsaDiametroLibre(r.L) && r.F !== "";
      const dim = r.D !== "" ? formatFraccionPulgadas(r.D)
        : esRedondoLibre ? `⌀${formatFraccionPulgadas(n(r.F) / 2.54)}`
        : r.F !== "" ? `${r.F}×${r.G}${r.H !== "" ? "×" + r.H : ""} cm` : "";
      aoa.push([
        g.zonaRaw, g.nivel, r.C,
        TIPO_LABEL_CORTO[r.L] || r.L, dim,
        levOcultaAnular(r.L) ? "" : formatFraccionPulgadas(r.I),
        r.M, r.N, r.O, r.P, r.R || ""
      ]);
    });
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 22 }, { wch: 10 }, { wch: 10 }, { wch: 30 }, { wch: 16 },
    { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 10 }, { wch: 30 }, { wch: 22 }
  ];
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: HEADERS.length - 1 } }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Levantamiento Penetrantes");

  const nombre = (nombreProy || "proyecto").replace(/[^a-z0-9\-_ ]/gi, "").trim().replace(/\s+/g, "-") || "proyecto";
  XLSX.writeFile(wb, `${nombre}-levantamiento-penetrantes.xlsx`);
  mostrarToast(`Excel exportado: ${totalItems} penetrante(s) en ${grupos.length} zona(s).`);
}

// ============================================================================
// Exportar Levantamiento (Juntas) a Excel — hoja plana, agrupada por zona/nivel.
// ============================================================================
function exportarLevantamientoJuntasExcel() {
  const grupos = agruparJuntasPorZona();
  const totalItems = grupos.reduce((acc, g) => acc + g.items.length, 0);
  if (totalItems === 0) { mostrarToast("No hay juntas con datos completos para exportar.", "error"); return; }

  const HEADERS = ["Zona", "Nivel", "Cantidad", "Junta", "Barreras", "Producto", "Largo (cm)", "Ancho (cm)", "Espesor (cm)", "Nota"];
  const aoa = [];
  const nombreProy = (PROJECT_INFO && PROJECT_INFO.nombre) ? PROJECT_INFO.nombre.trim() : "";
  aoa.push([`Levantamiento de Juntas${nombreProy ? " — " + nombreProy : ""}`]);
  aoa.push([`Generado: ${new Date().toLocaleDateString("es-CR")}`]);
  aoa.push([]);
  aoa.push(HEADERS);

  grupos.forEach(g => {
    g.items.forEach(r => {
      const f = computeSingleJuntaRow(r);
      aoa.push([
        g.zonaRaw, g.nivel, r.cantidad,
        juntaLabelCorta(r, f.superiorInferior),
        barrerasLabelCorto(r.barreras),
        r.producto, r.longitud, r.ancho,
        f.espesorCm !== null && f.espesorCm !== undefined ? Number(f.espesorCm.toFixed(2)) : "",
        r.nota || ""
      ]);
    });
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 22 }, { wch: 10 }, { wch: 10 }, { wch: 26 }, { wch: 18 },
    { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 13 }, { wch: 22 }
  ];
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: HEADERS.length - 1 } }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Levantamiento Juntas");

  const nombre = (nombreProy || "proyecto").replace(/[^a-z0-9\-_ ]/gi, "").trim().replace(/\s+/g, "-") || "proyecto";
  XLSX.writeFile(wb, `${nombre}-levantamiento-juntas.xlsx`);
  mostrarToast(`Excel exportado: ${totalItems} junta(s) en ${grupos.length} zona(s).`);
}

// ============================================================================
// Base de Datos — exportar/importar las matrices maestras (MAIN_TABLE para
// Penetrantes, JUNTAS_TABLE para Juntas) como Excel, para poder actualizar
// sistemas UL, links o espesores sin tocar código. La matriz editada se
// guarda en localStorage (persiste en este navegador) y además se embebe en
// el proyecto al hacer "Guardar"/"Guardar como", para que quede fija en ese
// archivo aunque se abra en otro dispositivo.
// ============================================================================
// ============================================================================
// Comparación de cambios antes de aplicar una matriz importada — para no
// reemplazar la matriz "a ciegas": se le muestra al usuario exactamente qué
// combinaciones son nuevas, cuáles cambiaron y cuáles se eliminarían.
// ============================================================================
function construirMapaLegibleMainTable(tabla) {
  const mapa = {};
  const APS = [0, "Otro"];
  OPTS_N.forEach(N => OPTS_L.forEach(L => OPTS_M.forEach(M => APS.forEach(AP => OPTS_P.forEach(P => {
    const key = dbKey(N, L, M, AP, P);
    if (!tabla[key]) return;
    mapa[key] = `${N} · ${L} · ${M} · ${AP === 0 ? "Estándar" : "Ampliado"} · ${P}`;
  })))));
  return mapa;
}

function diffMainTable(vieja, nueva) {
  const mapaVieja = construirMapaLegibleMainTable(vieja);
  const mapaNueva = construirMapaLegibleMainTable(nueva);
  const nuevas = [], eliminadas = [], modificadas = [];
  Object.keys(mapaNueva).forEach(key => {
    if (!(key in vieja)) { nuevas.push(mapaNueva[key]); return; }
    if (JSON.stringify(vieja[key]) !== JSON.stringify(nueva[key])) modificadas.push(mapaNueva[key]);
  });
  Object.keys(mapaVieja).forEach(key => {
    if (!(key in nueva)) eliminadas.push(mapaVieja[key]);
  });
  return { nuevas, eliminadas, modificadas };
}

function claveJunta(r) { return [r.j, r.t, r.b, r.p, r.prod, r.min, r.max].join("|"); }
function labelJunta(r) { return `${r.j} · ${r.t} · ${r.b} · ${r.prod}${r.p ? " · " + r.p : ""}`; }

function diffJuntasTable(vieja, nueva) {
  const mapaVieja = {}; vieja.forEach(r => { mapaVieja[claveJunta(r)] = r; });
  const mapaNueva = {}; nueva.forEach(r => { mapaNueva[claveJunta(r)] = r; });
  const nuevas = [], eliminadas = [], modificadas = [];
  Object.keys(mapaNueva).forEach(k => {
    if (!(k in mapaVieja)) { nuevas.push(labelJunta(mapaNueva[k])); return; }
    if (JSON.stringify(mapaVieja[k]) !== JSON.stringify(mapaNueva[k])) modificadas.push(labelJunta(mapaNueva[k]));
  });
  Object.keys(mapaVieja).forEach(k => {
    if (!(k in mapaNueva)) eliminadas.push(labelJunta(mapaVieja[k]));
  });
  return { nuevas, eliminadas, modificadas };
}

function mostrarResumenCambiosYConfirmar(titulo, diff, onConfirm) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  const secciones = [
    { label: "Combinaciones nuevas", items: diff.nuevas, cls: "diff-nueva" },
    { label: "Combinaciones modificadas", items: diff.modificadas, cls: "diff-modificada" },
    { label: "Combinaciones que se eliminarían", items: diff.eliminadas, cls: "diff-eliminada" },
  ].filter(s => s.items.length > 0);
  const totalCambios = diff.nuevas.length + diff.modificadas.length + diff.eliminadas.length;

  const cuerpoHtml = totalCambios === 0
    ? `<p style="margin:0;">No se detectaron cambios respecto a la matriz actual — el archivo importado es igual al que ya está cargado.</p>`
    : secciones.map(s => `
        <div class="diff-seccion">
          <div class="diff-seccion-titulo ${s.cls}">${escapeHtml(s.label)} (${s.items.length})</div>
          <ul class="diff-lista">${s.items.slice(0, 40).map(i => `<li>${escapeHtml(i)}</li>`).join("")}</ul>
          ${s.items.length > 40 ? `<div class="diff-mas">…y ${s.items.length - 40} más</div>` : ""}
        </div>
      `).join("");

  overlay.innerHTML = `
    <div class="modal-box modal-box-wide">
      <p style="margin-bottom:10px;"><strong>${escapeHtml(titulo)}</strong></p>
      <div class="diff-scroll">${cuerpoHtml}</div>
      <div class="modal-actions" style="margin-top:14px;">
        <button class="secondary" data-act="cancel">Cancelar</button>
        <button class="primary" data-act="ok" ${totalCambios === 0 ? "disabled" : ""}>Aplicar cambios</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay || e.target.dataset.act === "cancel") { overlay.remove(); return; }
    if (e.target.dataset.act === "ok" && totalCambios > 0) { overlay.remove(); onConfirm(); }
  });
}

function guardarMatricesLocalStorage() {
  try {
    localStorage.setItem("hiltiMainTableOverride", JSON.stringify(MAIN_TABLE));
    localStorage.setItem("hiltiJuntasTableOverride", JSON.stringify(JUNTAS_TABLE));
  } catch (e) { /* localStorage no disponible, se ignora */ }
}

function cargarMatricesLocalStorage() {
  try {
    const m = localStorage.getItem("hiltiMainTableOverride");
    const j = localStorage.getItem("hiltiJuntasTableOverride");
    if (m) MAIN_TABLE = JSON.parse(m);
    if (j) JUNTAS_TABLE = JSON.parse(j);
  } catch (e) { /* se ignora, se queda con la matriz original */ }
}

function restaurarMatricesOriginales() {
  pedirConfirmacion("Esto va a restaurar las matrices de Penetrantes y Juntas a los valores originales de fábrica, descartando cualquier edición hecha en este navegador. ¿Continuar?", () => {
    MAIN_TABLE = JSON.parse(MAIN_TABLE_DEFAULT_JSON);
    JUNTAS_TABLE = JSON.parse(JUNTAS_TABLE_DEFAULT_JSON);
    try { localStorage.removeItem("hiltiMainTableOverride"); localStorage.removeItem("hiltiJuntasTableOverride"); } catch (e) { /* noop */ }
    renderTable();
    if (ACTIVE_TAB === "resumen") renderResumen();
    if (ACTIVE_TAB === "levantamiento-tab") renderLevantamientoTab();
    mostrarToast("Matrices restauradas a los valores originales.");
  });
}

function exportarMatrizPenetrantesExcel() {
  const HEADERS = ["Barrera", "Penetrante", "Tipo", "Espacio Anular", "Producto Hilti", "Espesor (in)",
    "Sistema UL 1", "Link 1", "Sistema UL 2", "Link 2", "Sistema UL 3", "Link 3", "Sistema UL 4", "Link 4", "Sistema UL 5", "Link 5"];
  const aoa = [HEADERS];
  const APS = [0, "Otro"];
  OPTS_N.forEach(N => OPTS_L.forEach(L => OPTS_M.forEach(M => APS.forEach(AP => OPTS_P.forEach(P => {
    const key = dbKey(N, L, M, AP, P);
    const row = MAIN_TABLE[key];
    if (!row) return;
    aoa.push([
      N, L, M, AP === 0 ? "Estándar (0)" : "Ampliado (Otro)", P, row[0] === null || row[0] === undefined ? "" : row[0],
      row[1] || "", row[2] || "", row[3] || "", row[4] || "",
      row[5] || "", row[6] || "", row[7] || "", row[8] || "",
      row[9] || "", row[10] || "",
    ]);
  })))));
  if (aoa.length <= 1) { mostrarToast("No hay combinaciones en la matriz para exportar.", "error"); return; }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = HEADERS.map((h, i) => ({ wch: i === 1 ? 28 : i < 6 ? 16 : 24 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Matriz Penetrantes");
  XLSX.writeFile(wb, "matriz-penetrantes-hilti.xlsx");
  mostrarToast(`Matriz exportada: ${aoa.length - 1} combinación(es).`);
}

async function importarMatrizPenetrantesExcel(file) {
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const filas = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }).slice(1);
    const nueva = {};
    let ok = 0, malas = 0;
    filas.forEach(r => {
      if (!r || r.length === 0 || !r[0]) return;
      const [N, L, M, apLabel, P, espesor, s1, l1, s2, l2, s3, l3, s4, l4, s5, l5] = r;
      if (!OPTS_N.includes(N) || !OPTS_L.includes(L) || !OPTS_M.includes(M) || !OPTS_P.includes(P)) { malas++; return; }
      const AP = String(apLabel).startsWith("Ampliado") ? "Otro" : 0;
      const key = dbKey(N, L, M, AP, P);
      nueva[key] = [
        espesor === "" ? null : Number(espesor),
        s1 || null, l1 || null, s2 || null, l2 || null,
        s3 || null, l3 || null, s4 || null, l4 || null,
        s5 || null, l5 || null,
      ];
      ok++;
    });
    if (ok === 0) { mostrarToast("No se reconoció ninguna fila válida. Verificá que sea el formato exportado desde esta app (Barrera/Penetrante/Tipo deben coincidir exacto con las opciones de la app).", "error"); return; }
    const diff = diffMainTable(MAIN_TABLE, nueva);
    const tituloModal = `Revisar cambios en la matriz de Penetrantes${malas ? ` (${malas} fila(s) del Excel se ignoraron por no coincidir con las opciones de la app)` : ""}`;
    mostrarResumenCambiosYConfirmar(tituloModal, diff, () => {
      MAIN_TABLE = nueva;
      guardarMatricesLocalStorage();
      renderTable();
      if (ACTIVE_TAB === "resumen") renderResumen();
      if (ACTIVE_TAB === "levantamiento-tab") renderLevantamientoTab();
      marcarCambio();
      mostrarToast(`Matriz de Penetrantes actualizada: ${ok} combinación(es).`);
    });
  } catch (e) {
    mostrarToast("No se pudo leer el Excel: " + e.message, "error");
  }
}

function exportarMatrizJuntasExcel() {
  const HEADERS = ["Junta", "Tipo", "Barreras", "Posición o Sistema", "Producto", "Espesor (in)", "Traslape (in)", "Compresión Lana", "Ancho Mín (in)", "Ancho Máx (in)", "Sistema UL", "Link Ficha"];
  const aoa = [HEADERS, ...JUNTAS_TABLE.map(r => [r.j, r.t, r.b, r.p, r.prod, r.esp, r.tras, r.comp, r.min, r.max, r.sis, r.link])];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = HEADERS.map((h, i) => ({ wch: i === 3 || i === 4 ? 26 : i === 10 || i === 11 ? 24 : 14 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Matriz Juntas");
  XLSX.writeFile(wb, "matriz-juntas-hilti.xlsx");
  mostrarToast(`Matriz exportada: ${JUNTAS_TABLE.length} fila(s).`);
}

async function importarMatrizJuntasExcel(file) {
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const filas = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }).slice(1);
    const nueva = [];
    filas.forEach(r => {
      if (!r || r.length === 0 || !r[0]) return;
      const [j, t, b, p, prod, esp, tras, comp, min, max, sis, link] = r;
      nueva.push({
        j, t, b, p: p === "" ? null : p, prod,
        esp: n(esp), tras: n(tras), comp: n(comp),
        min: min === "" ? null : n(min), max: max === "" ? null : n(max),
        sis, link,
      });
    });
    if (nueva.length === 0) { mostrarToast("No se reconoció ninguna fila válida en el Excel.", "error"); return; }
    const diff = diffJuntasTable(JUNTAS_TABLE, nueva);
    mostrarResumenCambiosYConfirmar("Revisar cambios en la matriz de Juntas", diff, () => {
      JUNTAS_TABLE = nueva;
      guardarMatricesLocalStorage();
      if (ACTIVE_TAB === "levantamiento-juntas-tab") renderLevantamientoTabJuntas();
      marcarCambio();
      mostrarToast(`Matriz de Juntas actualizada: ${nueva.length} fila(s).`);
    });
  } catch (e) {
    mostrarToast("No se pudo leer el Excel: " + e.message, "error");
  }
}

// ============================================================================
// Importar un levantamiento desde el Excel original (hoja CALCULADORA)
// ----------------------------------------------------------------------------
// Si el proyecto ya tiene filas se ofrece REEMPLAZAR o AÑADIR (acumular varios
// levantamientos). Al añadir NO se tocan los espesores/desperdicio del proyecto
// (parámetros de cálculo): solo se avisa si el Excel trae valores distintos.
// ============================================================================
// Campos que identifican una fila para detectar repetidas al añadir.
const CAMPOS_FIRMA_IMPORT = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "L", "M", "N", "O", "P"];
function firmaFilaImport(r) {
  return CAMPOS_FIRMA_IMPORT.map(k => {
    const v = r[k];
    return (v === undefined || v === null) ? "" : String(v).trim();
  }).join("\u241F");
}
// Fila sin datos reales (las que trae un proyecto recién creado): ni zona, ni
// nivel, ni dimensiones, ni nota. Reemplazarlas no pierde nada.
function filaEnBlancoImport(r) {
  const vacio = (v) => v === "" || v === undefined || v === null;
  return vacio(r.A) && vacio(r.B) && vacio(r.D) && vacio(r.F) && vacio(r.G) && vacio(r.H) && vacio(r.R);
}
// Separa las filas del Excel en "nuevas" y "ya existen idénticas" (cada fila
// existente se consume una sola vez, así una fila repetida a propósito dentro
// del mismo Excel no se confunde con un duplicado).
function separarRepetidasImport(existentes, nuevas) {
  const disponibles = new Map();
  existentes.forEach(r => { const k = firmaFilaImport(r); disponibles.set(k, (disponibles.get(k) || 0) + 1); });
  const sinRepetir = [];
  let repetidas = 0;
  nuevas.forEach(r => {
    const k = firmaFilaImport(r);
    const quedan = disponibles.get(k) || 0;
    if (quedan > 0) { disponibles.set(k, quedan - 1); repetidas++; }
    else sinRepetir.push(r);
  });
  return { sinRepetir, repetidas };
}

function importarExcel(file) {
  const reader = new FileReader();
  reader.onerror = () => mostrarToast("No se pudo leer el archivo seleccionado.", "error");
  reader.onload = () => {
    let nuevas, nuevoConfig, sheetName;
    try {
      const data = new Uint8Array(reader.result);
      const wb = XLSX.read(data, { type: "array", cellFormula: false });
      sheetName = wb.SheetNames.find(n => n.toUpperCase().includes("CALCULADORA")) || wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      if (!ws) throw new Error("No se encontró la hoja CALCULADORA en el archivo.");

      // Config: espesores y desperdicio, si existen en las celdas conocidas
      const readCell = (ref) => { const c = ws[ref]; return c ? c.v : undefined; };
      nuevoConfig = {};
      const c13 = readCell("C13"), c14 = readCell("C14"), c15 = readCell("C15"), c17 = readCell("C17");
      if (typeof c13 === "number") nuevoConfig.C13 = c13;
      if (typeof c14 === "number") nuevoConfig.C14 = c14;
      if (typeof c15 === "number") nuevoConfig.C15 = c15;
      if (typeof c17 === "number") nuevoConfig.C17 = c17;

      // Filas de datos a partir de la fila 23 (índice 22)
      const filas2d = XLSX.utils.sheet_to_json(ws, { header: 1, range: 22, defval: "", raw: true });
      nuevas = [];
      for (const r of filas2d) {
        const A = r[0], B = r[1], C = r[2], D = r[3], E = r[4], F = r[5], G = r[6], H = r[7], I = r[8], J = r[9],
          L = r[11], M = r[12], N = r[13], O = r[14], P = r[15];
        if (typeof L !== "string" || !OPTS_L.includes(L.trim())) continue; // solo filas con tipo de penetrante válido
        const num = (v, def) => (v === "" || v === undefined || v === null || isNaN(parseFloat(v))) ? def : parseFloat(v);
        nuevas.push({
          _id: ROW_SEQ++,
          A: (A === undefined || A === null) ? "" : A.toString(), B: (B === undefined || B === null) ? "" : B.toString(),
          C: num(C, 1), D: num(D, ""), E: num(E, 0),
          F: num(F, ""), G: num(G, ""), H: num(H, ""),
          I: num(I, 0), J: num(J, 0),
          L: L.trim(),
          M: OPTS_M.includes(M) ? M : OPTS_M[0],
          N: OPTS_N.includes(N) ? N : OPTS_N[0],
          O: OPTS_O.includes(O) ? O : OPTS_O[0],
          P: OPTS_P.includes(P) ? P : OPTS_P[0],
        });
      }
      if (nuevas.length === 0) throw new Error("No se encontraron filas con datos en la hoja CALCULADORA (a partir de la fila 23).");
    } catch (err) {
      mostrarToast("No se pudo leer el Excel. " + err.message, "error");
      return;
    }

    const refrescar = () => {
      renderTable();
      if (ACTIVE_TAB === "resumen") renderResumen();
      if (ACTIVE_TAB === "levantamiento-tab") renderLevantamientoTab();
      marcarCambio();
    };
    const aplicarReemplazo = () => {
      pushUndo();
      ROWS = nuevas;
      Object.assign(CONFIG, nuevoConfig);
      sincronizarCamposConfig();
      refrescar();
      mostrarToast(`Levantamiento importado: ${nuevas.length} fila(s) cargadas desde "${sheetName}".`);
    };
    const aplicarAnadir = (lista, omitidas) => {
      if (lista.length === 0) {
        mostrarToast("No se añadió nada: todas las filas del Excel ya existen idénticas en el proyecto.", "error");
        return;
      }
      pushUndo();
      ROWS = ROWS.concat(lista);
      refrescar();
      mostrarToast(`Levantamiento añadido: ${lista.length} fila(s) nuevas desde "${sheetName}"`
        + (omitidas ? ` (${omitidas} omitida(s) por ya existir)` : "") + `. Total en el proyecto: ${ROWS.length}.`);
    };

    const existentes = ROWS.filter(r => !filaEnBlancoImport(r));
    // Proyecto sin datos reales (p. ej. recién creado): no hay nada que conservar ni que elegir.
    if (existentes.length === 0) { aplicarReemplazo(); return; }

    // Sin el cuadro de elección (no debería pasar) se conserva el comportamiento anterior.
    if (typeof window.pedirEleccion !== "function") {
      pedirConfirmacion(`Se encontraron ${nuevas.length} fila(s) en el Excel. Esto va a reemplazar las filas actuales del proyecto. ¿Continuar?`, aplicarReemplazo);
      return;
    }

    const { sinRepetir, repetidas } = separarRepetidasImport(existentes, nuevas);
    // Espesores/desperdicio del Excel distintos a los del proyecto (solo informativo).
    const configDistinta = Object.keys(nuevoConfig).some(k => Number(CONFIG[k]) !== Number(nuevoConfig[k]));
    let mensaje = `El Excel trae ${nuevas.length} fila(s) y el proyecto ya tiene ${existentes.length}. ¿Qué querés hacer?`;
    if (repetidas > 0) mensaje += repetidas === nuevas.length
      ? " Todas las filas del Excel ya existen idénticas en el proyecto."
      : ` ${repetidas} de ellas ya existen idénticas en el proyecto.`;
    if (configDistinta) mensaje += " Ojo: el Excel trae espesores/desperdicio distintos a los del proyecto; al añadir se conservan los del proyecto y al reemplazar se usan los del Excel.";

    const opciones = [];
    if (repetidas > 0) {
      opciones.push({ label: `Añadir solo las ${sinRepetir.length} nuevas (omite ${repetidas} que ya existen)`, act: "anadir-nuevas", clase: "primary" });
      opciones.push({ label: `Añadir las ${nuevas.length} (incluye ${repetidas} repetida(s))`, act: "anadir-todas", clase: "secondary" });
    } else {
      opciones.push({ label: `Añadir ${nuevas.length} fila(s) al levantamiento actual`, act: "anadir-todas", clase: "primary" });
    }
    opciones.push({ label: "Reemplazar todo (descarta las filas actuales)", act: "reemplazar", clase: "danger" });
    opciones.push({ label: "Cancelar", act: "cancelar", clase: "secondary" });

    window.pedirEleccion(mensaje, opciones, (eleccion) => {
      if (eleccion === "anadir-nuevas") aplicarAnadir(sinRepetir, repetidas);
      else if (eleccion === "anadir-todas") aplicarAnadir(nuevas, 0);
      else if (eleccion === "reemplazar") aplicarReemplazo();
    });
  };
  reader.readAsArrayBuffer(file);
}

// ============================================================================

// --- Exports usados por otros módulos ---
window.kFromLTexto = kFromLTexto;
window.exportarLevantamientoExcel = exportarLevantamientoExcel;
window.exportarLevantamientoPenetrantesExcel = exportarLevantamientoPenetrantesExcel;
window.exportarLevantamientoJuntasExcel = exportarLevantamientoJuntasExcel;
window.guardarMatricesLocalStorage = guardarMatricesLocalStorage;
window.cargarMatricesLocalStorage = cargarMatricesLocalStorage;
window.restaurarMatricesOriginales = restaurarMatricesOriginales;
window.exportarMatrizPenetrantesExcel = exportarMatrizPenetrantesExcel;
window.importarMatrizPenetrantesExcel = importarMatrizPenetrantesExcel;
window.exportarMatrizJuntasExcel = exportarMatrizJuntasExcel;
window.importarMatrizJuntasExcel = importarMatrizJuntasExcel;
window.importarExcel = importarExcel;
})();
