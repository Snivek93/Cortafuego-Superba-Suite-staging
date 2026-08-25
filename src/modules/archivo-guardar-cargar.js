// ============================================================================
// archivo-guardar-cargar.js — encapsulado en IIFE (sin exponer todo a window; ver export list abajo)
// ============================================================================
(function () {
const FSS_MAGIC = "FSS1:";
const FSS_MAGIC_V2 = "FSS2:";
const FSS_IMG_SEP = "\n@@FSSIMG@@\n";

function extraerImagenesGrandes(jsonString) {
  const obj = JSON.parse(jsonString);
  const imagenes = {};
  let contador = 0;
  if (Array.isArray(obj.filas)) {
    obj.filas.forEach(f => {
      if (Array.isArray(f.fotos)) {
        f.fotos = f.fotos.map(foto => {
          const key = "img" + (contador++);
          imagenes[key] = foto;
          return "@@IMG:" + key;
        });
      }
    });
  }
  if (Array.isArray(obj.planos)) {
    obj.planos.forEach(p => {
      if (typeof p.dataUrl === "string") {
        const key = "img" + (contador++);
        imagenes[key] = p.dataUrl;
        p.dataUrl = "@@IMG:" + key;
      }
    });
  }
  return { jsonSinImagenes: JSON.stringify(obj), imagenesJson: JSON.stringify(imagenes) };
}

function reinsertarImagenesGrandes(jsonSinImagenes, imagenesJson) {
  const obj = JSON.parse(jsonSinImagenes);
  const imagenes = JSON.parse(imagenesJson);
  const resolver = (v) => (typeof v === "string" && v.startsWith("@@IMG:")) ? (imagenes[v.slice(6)] || "") : v;
  if (Array.isArray(obj.filas)) {
    obj.filas.forEach(f => { if (Array.isArray(f.fotos)) f.fotos = f.fotos.map(resolver); });
  }
  if (Array.isArray(obj.planos)) {
    obj.planos.forEach(p => { if (p.dataUrl) p.dataUrl = resolver(p.dataUrl); });
  }
  return JSON.stringify(obj);
}

function enmascararFSS(jsonString) {
  const { jsonSinImagenes, imagenesJson } = extraerImagenesGrandes(jsonString);
  return FSS_MAGIC_V2 + btoa(unescape(encodeURIComponent(jsonSinImagenes))) + FSS_IMG_SEP + imagenesJson;
}

function desenmascararFSS(contenido) {
  if (contenido.startsWith(FSS_MAGIC_V2)) {
    const resto = contenido.slice(FSS_MAGIC_V2.length);
    const sepIdx = resto.indexOf(FSS_IMG_SEP);
    if (sepIdx === -1) return decodeURIComponent(escape(atob(resto)));
    const b64 = resto.slice(0, sepIdx);
    const imagenesJson = resto.slice(sepIdx + FSS_IMG_SEP.length);
    const jsonSinImagenes = decodeURIComponent(escape(atob(b64)));
    return reinsertarImagenesGrandes(jsonSinImagenes, imagenesJson);
  }
  if (contenido.startsWith(FSS_MAGIC)) {
    const b64 = contenido.slice(FSS_MAGIC.length);
    return decodeURIComponent(escape(atob(b64)));
  }
  return contenido;
}

function descargarArchivo(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function exportarProyectoJSON() {
  const payload = datosProyectoActual();
  const nombre = (PROJECT_INFO.nombre || "proyecto").replace(/[^a-z0-9\-_ ]/gi, "").trim().replace(/\s+/g, "-") || "proyecto";
  const jsonStr = JSON.stringify(payload, null, 1);
  descargarArchivo(`${nombre}-cortafuego.fss`, enmascararFSS(jsonStr), "application/octet-stream");
  mostrarToast("Proyecto descargado como archivo .fss");
}

function aplicarProyectoImportado(data) {
  pushUndo();
  ROWS = data.filas.map(f => Object.assign(nuevaFila(), f, { _id: typeof f._id === "number" ? f._id : ROW_SEQ++ }));
  ROW_SEQ = Math.max(ROW_SEQ, ...ROWS.map(r => r._id), 0) + 1;
  if (Array.isArray(data.filasJuntas)) {
    ROWS_J = data.filasJuntas.map(f => Object.assign({}, f, { _id: typeof f._id === "number" ? f._id : ROW_J_SEQ++ }));
    ROW_J_SEQ = Math.max(ROW_J_SEQ, ...ROWS_J.map(r => r._id), 0) + 1;
  }
  MANUAL_ITEMS = Array.isArray(data.itemsManuales) ? data.itemsManuales.map(m => Object.assign({}, m, { _id: MANUAL_ITEM_SEQ++ })) : [];
  if (data.config) Object.assign(CONFIG, data.config);
  if (data.projectInfo) Object.assign(PROJECT_INFO, data.projectInfo);
  if (data.mainTableOverride) { MAIN_TABLE = data.mainTableOverride; guardarMatricesLocalStorage(); }
  if (data.juntasTableOverride) { JUNTAS_TABLE = data.juntasTableOverride; guardarMatricesLocalStorage(); }
  PLANOS = Array.isArray(data.planos) ? data.planos : [];
  PLANO_SEQ = PLANOS.reduce((m, p) => Math.max(m, p.id || 0), 0) + 1;
  INFORMES_ACREDITACION = Array.isArray(data.informes) ? data.informes : [];
  INFORME_ACR_SEQ = INFORMES_ACREDITACION.reduce((m, i) => Math.max(m, i.id || 0), 0) + 1;
  sincronizarCamposConfig();
  renderTable();
  if (ACTIVE_TAB === "resumen") renderResumen();
  if (ACTIVE_TAB === "levantamiento-tab") renderLevantamientoTab();
  marcarCambio();
  mostrarToast(`Proyecto cargado: ${ROWS.length} fila(s).`);
}

function pedirEleccion(mensaje, opciones, onElegir) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  const botones = opciones.map(o => `<button class="${o.clase || "secondary"}" data-act="${o.act}">${escapeHtml(o.label)}</button>`).join("");
  overlay.innerHTML = `
    <div class="modal-box">
      <p>${escapeHtml(mensaje)}</p>
      <div class="modal-actions">${botones}</div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) { overlay.remove(); return; }
    const act = e.target.dataset.act;
    if (act) { overlay.remove(); onElegir(act); }
  });
}

// "Abrir…" importa un .fss como PROYECTO NUEVO en la lista (no pisa el que
// tenías abierto — eso era el comportamiento viejo de un solo proyecto).
// Si el archivo trae el mismo id de un proyecto que ya tenés guardado
// (ej. reimportás tu propio backup, o Sebastián te reenvía el mismo
// archivo), pregunta si reemplazarlo o guardarlo aparte como copia.
async function importarProyectoJSON(file) {
  const reader = new FileReader();
  reader.onerror = () => mostrarToast("No se pudo leer el archivo seleccionado.", "error");
  reader.onload = async () => {
    let data;
    try {
      const contenido = desenmascararFSS(reader.result);
      data = JSON.parse(contenido);
      if (!data || !Array.isArray(data.filas)) throw new Error("Formato no reconocido");
    } catch (err) {
      mostrarToast("No se pudo leer el archivo. Verificá que sea un .fss exportado desde esta calculadora.", "error");
      return;
    }

    const guardarComoProyecto = async (idAUsar) => {
      try {
        await window.idbGuardarProyecto(idAUsar, Object.assign({}, data, { id: idAUsar }));
        await window.abrirProyectoExistente(idAUsar);
        mostrarToast(`Proyecto importado: ${data.filas.length} fila(s).`);
      } catch (e) {
        mostrarToast("No se pudo guardar el proyecto importado: " + e.message, "error");
      }
    };

    let existentes = [];
    try { existentes = await window.idbListarProyectos(); } catch (e) { existentes = []; }
    const yaExiste = data.id && existentes.some(p => p.id === data.id);

    if (!yaExiste) {
      const id = data.id || ("p_" + Date.now().toString(36) + "_importado");
      await guardarComoProyecto(id);
      return;
    }

    pedirEleccion("Ya tenés un proyecto guardado de este mismo archivo. ¿Qué querés hacer?", [
      { label: "Reemplazar", act: "reemplazar", clase: "danger" },
      { label: "Guardar como copia", act: "copia", clase: "primary" },
      { label: "Cancelar", act: "cancelar", clase: "secondary" },
    ], async (eleccion) => {
      if (eleccion === "reemplazar") {
        await guardarComoProyecto(data.id);
      } else if (eleccion === "copia") {
        const nuevoId = "p_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
        await guardarComoProyecto(nuevoId);
      }
    });
  };
  reader.readAsText(file);
}

function sincronizarCamposConfig() {
  ["C13", "C14", "C15"].forEach(id => { const el = document.getElementById("cfg-" + id); if (el) el.value = CONFIG[id]; });
  const c17 = document.getElementById("cfg-C17"); if (c17) c17.value = CONFIG.C17 * 100;
  const c17j = document.getElementById("cfg-C17_JUNTAS"); if (c17j) c17j.value = CONFIG.C17_JUNTAS * 100;
  if (window.actualizarChipDesperdicio) window.actualizarChipDesperdicio();
  ["UMB_FS", "UMB_CP606", "UMB_SILGG"].forEach(id => { const el = document.getElementById("cfg-" + id); if (el) el.value = CONFIG[id]; });
  const pn = document.getElementById("proj-nombre"); if (pn) pn.value = PROJECT_INFO.nombre;
  const pc = document.getElementById("proj-cliente"); if (pc) pc.value = PROJECT_INFO.cliente;
  const pf = document.getElementById("proj-fecha"); if (pf) pf.value = PROJECT_INFO.fecha;
}

window.descargarArchivo = descargarArchivo;
window.exportarProyectoJSON = exportarProyectoJSON;
window.aplicarProyectoImportado = aplicarProyectoImportado;
window.importarProyectoJSON = importarProyectoJSON;
window.sincronizarCamposConfig = sincronizarCamposConfig;
})();
