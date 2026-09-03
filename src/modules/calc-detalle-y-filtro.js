// ============================================================================
// calc-detalle-y-filtro.js — encapsulado en IIFE (sin exponer todo a window; ver export list abajo)
// ============================================================================
// FILTRO_CALC se declara fuera del IIFE (con `var`) porque archivo-estado-app.js
// le hace reasignación directa (no solo mutación) -- ver nota igual en
// ui-tabla-calculadora.js sobre por qué esto es necesario.
var FILTRO_CALC = "";

(function () {
// ============================================================================
// calc-detalle-y-filtro.js
// Detalle de cálculo por línea (para revisar cantidades fila por fila) y filtro de la tabla Calculadora (por zona, nivel, tipo, material, nota).
// (Parte del proyecto Calculadora Cortafuego Hilti — ver README.md para el mapa completo de módulos.)
// ============================================================================

// Detalle de cálculo por línea (para revisar cantidades extrañas fila por fila)
// ============================================================================
function fmtDetalleNum(v, dec) {
  const x = parseFloat(v);
  if (isNaN(x)) return null;
  const f = Math.round(x * Math.pow(10, dec)) / Math.pow(10, dec);
  return f.toLocaleString("es-CR", { maximumFractionDigits: dec });
}
// Para las tablas de la Memoria de Cálculo: SIEMPRE la cantidad exacta de
// decimales pedida (no menos), y coma como separador decimal en todos los
// casos — nunca punto.
function fmtComa(v, dec) {
  const x = parseFloat(v);
  if (isNaN(x)) return "-";
  return x.toFixed(dec).replace(".", ",");
}
function detalleCalculoTexto(row, paraPdf) {
  const u2 = paraPdf ? "cm2" : "cm²";
  const u3 = paraPdf ? "cm3" : "cm³";
  const partes = [];
  const add = (val, label, unit, dec) => {
    if (val === "-" || val === undefined || val === null || val === "") return;
    const num = fmtDetalleNum(val, dec);
    if (num === null || parseFloat(num.replace(",", "")) === 0) return;
    partes.push(`${label}: ${num} ${unit}`);
  };
  add(row.X, "Lana", row.esVolumenLana ? u3 : u2, 1);
  add(row.Y, "Sellador", u3, 1);
  add(row.Z, "Collar", "cm", 1);
  add(row.AA, "Cinta", "cm", 1);
  add(row.AB, "Putty Pads", "und", 2);
  add(row.AC, "Espuma", u3, 1);
  add(row.AD, "Almohadillas", "und", 0);
  add(row.AE, "Manga", "und", 0);
  add(row.AF, "Paso MSL M", "und", 0);
  add(row.AG, "Paso MSL L", "und", 0);
  add(row.AH, "Cinta (sin collar)", "cm", 1);
  add(row.AI, "Collarines", "und", 0);
  add(row.AK, "Mortero", u3, 1);
  add(row.AM, "Sellador CP606", u3, 1);
  add(row.AO, "Sellador SIL GG", u3, 1);
  return partes.length ? partes.join(" · ") : "—";
}

function rowHtml(row, idx) {
  const vis = camposVisibles(row.L);
  const esCaja = row.L === "Caja Electromecánica UL";
  return `<tr data-row-id="${row._id}">
      <td class="rownum">${idx + 1}</td>
      <td>${textHtml(row._id, "A", row.A)}</td>
      <td>${textHtml(row._id, "B", row.B)}</td>
      <td>${numHtml(row._id, "C", row.C, true, "1")}</td>
      <td class="cell-with-hint">${numFraccionHtml(row._id, "D", row.D, vis.D)}</td>
      <td class="cell-with-hint">${numFraccionHtml(row._id, "E", row.E, vis.E)}</td>
      <td>${numHtml(row._id, "F", row.F, vis.F, "0.1")}</td>
      <td>${numHtml(row._id, "G", row.G, vis.G, "0.1")}</td>
      <td>${numHtml(row._id, "H", row.H, vis.H, "0.1")}</td>
      <td class="cell-with-hint">${numFraccionHtml(row._id, "I", row.I, true, row.L === "Caja Electromecánica UL")}</td>
      <td>${numHtml(row._id, "J", row.J, vis.J, "0.01")}</td>
      <td>${selectHtml(row._id, OPTS_L, row.L, "L")}</td>
      <td>${selectHtml(row._id, OPTS_M, row.M, "M", row.L === "Caja Electromecánica UL" ? ["Entrepiso"] : null)}</td>
      <td>${selectHtml(row._id, OPTS_N, row.N, "N", row.M === "Entrepiso" ? ["Panel de Yeso"] : (row.L === "Caja Electromecánica UL" ? ["Concreto"] : null))}</td>
      <td class="mem-cell"><input type="checkbox" class="mem-checkbox" data-id="${row._id}" data-field="MEM" ${row.MEM ? "checked" : ""} ${(row.M !== "Pared" || row.L === "Caja Electromecánica UL") ? "disabled" : ""} title="Membrana: sella solo un lado de la pared"></td>
      <td>${selectHtml(row._id, OPTS_O, row.O, "O")}</td>
      <td>${selectHtml(row._id, OPTS_P, row.P, "P")}</td>
      <td class="${esCaja ? "" : "col-disabled"}">${selectHtml(row._id, ["7", "9"], String(row.PPSIZE || 7), "PPSIZE", null, !esCaja)}</td>
      <td class="${esCaja ? "" : "col-disabled"}">${selectHtml(row._id, ["Fuera", "Dentro"], row.PPINST || "Fuera", "PPINST", null, !esCaja)}</td>
      <td class="norma-cell">${badgeForQ(row)}</td>
      <td>${textHtml(row._id, "R", row.R)}</td>
      <td class="detalle-col">${detalleCalculoTexto(row)}</td>
      <td class="row-actions">
        <button class="icon-btn" title="Duplicar" data-action="dup" data-id="${row._id}"><svg class="icon"><use href="#i-copy"/></svg></button>
        <button class="icon-btn icon-danger" title="Eliminar" data-action="del" data-id="${row._id}"><svg class="icon"><use href="#i-close"/></svg></button>
      </td>
    </tr>`;
}

function renderTable() {
  const tbody = document.getElementById("tbody-calc");
  if (ROWS.length === 0) {
    tbody.innerHTML = `<tr><td colspan="23" class="empty-state">No hay filas todavía. Hacé clic en "+ Agregar fila" para comenzar.</td></tr>`;
    const countEl = document.getElementById("filtro-calc-count");
    if (countEl) countEl.textContent = "";
    return;
  }
  tbody.innerHTML = ROWS.map((row, idx) => rowHtml(computeSingleRow(row), idx)).join("");
  aplicarFiltroCalc();
}

// ============================================================================
// Filtro de la tabla Calculadora (por zona, nivel, tipo, material, nota, etc.)
// ============================================================================

function aplicarFiltroCalc() {
  const term = FILTRO_CALC.trim().toLowerCase();
  const filas = document.querySelectorAll("#tbody-calc tr[data-row-id]");
  let visibles = 0;
  filas.forEach(tr => {
    const id = parseInt(tr.getAttribute("data-row-id"), 10);
    const row = ROWS.find(r => r._id === id);
    if (!row) return;
    const texto = [row.A, row.B, row.L, row.M, row.N, row.O, row.P, row.R, kFromLTexto(row.L)].join(" ").toLowerCase();
    const match = !term || texto.includes(term);
    tr.classList.toggle("row-hidden-filter", !match);
    if (match) visibles++;
  });
  const countEl = document.getElementById("filtro-calc-count");
  if (countEl) countEl.textContent = term ? `${visibles} de ${ROWS.length} fila(s)` : "";
}

// Reemplaza únicamente la fila indicada (se usa en cambios de <select>, que no
// necesitan preservar el foco de un input de texto/número).
function renderRowInPlace(id) {
  const idx = rowIndexOf(id);
  if (idx === -1) return;
  const tr = document.querySelector(`tr[data-row-id="${id}"]`);
  if (!tr) { renderTable(); return; }
  const computed = computeSingleRow(ROWS[idx]);
  tr.outerHTML = rowHtml(computed, idx);
  aplicarFiltroCalc();
}

// Actualiza solo la "pastilla" de normativa de una fila, sin tocar los <input>
// (así el foco y el teclado en celular no se pierden mientras se escribe).
function updateRowBadge(id) {
  const idx = rowIndexOf(id);
  if (idx === -1) return;
  const tr = document.querySelector(`tr[data-row-id="${id}"]`);
  if (!tr) return;
  const badgeCell = tr.querySelector(".norma-cell");
  if (!badgeCell) return;
  const computed = computeSingleRow(ROWS[idx]);
  badgeCell.innerHTML = badgeForQ(computed);
}

function updateAllBadges() {
  ROWS.forEach(row => updateRowBadge(row._id));
}

function attachTableEvents() {
  const tbody = document.getElementById("tbody-calc");
  tbody.addEventListener("input", (e) => {
    const t = e.target;
    const id = Number(t.dataset.id);
    const field = t.dataset.field;
    if (!id || !field) return;
    const row = ROWS.find(r => r._id === id);
    if (!row) return;
    if (t.dataset.fraccion === "1") {
      const parsed = parseFraccion(t.value);
      row[field] = parsed === null ? "" : parsed;
    } else {
      row[field] = t.type === "number" ? (t.value === "" ? "" : parseFloat(t.value)) : t.value;
    }
    updateRowBadge(id);
    marcarCambio();
  });
  // Al salir del campo, reformatear el texto mostrado a fracción prolija
  // (ej. "0.5" o "1/2" tecleado -> se deja como "1/2"), sin afectar el valor
  // ya guardado (que se parsea en cada tecleo, arriba).
  tbody.addEventListener("focusout", (e) => {
    const t = e.target;
    if (!t.dataset || t.dataset.fraccion !== "1") return;
    const id = Number(t.dataset.id);
    const field = t.dataset.field;
    const row = ROWS.find(r => r._id === id);
    if (!row) return;
    t.value = (row[field] === "" || row[field] === null || row[field] === undefined) ? "" : formatFraccionInput(row[field]);
  });
  tbody.addEventListener("change", (e) => {
    const t = e.target;
    if (t.tagName === "SELECT") {
      const id = Number(t.dataset.id);
      const field = t.dataset.field;
      const row = ROWS.find(r => r._id === id);
      if (row) {
        row[field] = t.value;
        if (field === "L" && t.value === "Caja Electromecánica UL") {
          // Las cajas electromecánicas UL solo se instalan en pared de panel de yeso,
          // son siempre una penetración de membrana, y no llevan espacio anular.
          row.M = "Pared"; row.N = "Panel de Yeso"; row.MEM = true; row.I = 0;
        }
        if (field === "M" && t.value === "Entrepiso" && row.N === "Panel de Yeso") {
          row.N = "Concreto"; // no existe Entrepiso + Panel de Yeso
        }
        if (field === "M" && t.value !== "Pared") row.MEM = false; // Membrana solo aplica a Pared
        if (field === "L" || field === "M") renderRowInPlace(id); // pueden cambiar qué inputs/opciones se muestran
        else updateRowBadge(id);
        marcarCambio();
      }
    } else if (t.type === "checkbox" && t.dataset.field === "MEM") {
      const id = Number(t.dataset.id);
      const row = ROWS.find(r => r._id === id);
      if (row) { row.MEM = t.checked; updateRowBadge(id); marcarCambio(); }
    }
  });
  tbody.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const action = btn.dataset.action;
    const idx = ROWS.findIndex(r => r._id === id);
    if (idx === -1) return;
    if (action === "del") {
      pushUndo();
      ROWS.splice(idx, 1);
    } else if (action === "dup") {
      pushUndo();
      const copy = Object.assign({}, ROWS[idx], { _id: ROW_SEQ++ });
      ROWS.splice(idx + 1, 0, copy);
    }
    marcarCambio();
    renderTable();
  });
}

function renderResumen() {
  const computed = computeAllRows().filter(tieneDatosMinimos);
  const resumen = computeResumen(computed, CONFIG.C17, {
    FS_ONE_MAX: CONFIG.UMB_FS, CP606: CONFIG.UMB_CP606, CFS_SIL_GG: CONFIG.UMB_SILGG
  });

  // Juntas: se combinan al mismo Resumen (items, lana, normativa y fichas técnicas).
  const computedJ = computeAllJuntaRows().filter(tieneDatosMinimosJunta);
  mezclarResumenJuntas(resumen, computedJ);

  const modoBar = document.getElementById("modo-productos-bar");
  if (modoBar) {
    const nombresModo = { auto: "Auto", cartuchos: "Cartuchos", cubetas: "Cubetas" };
    const productosPresentes = Object.keys(RESUMEN_MODO_PRODUCTO).filter(p => resumen.items.some(it => it.producto === p));
    modoBar.innerHTML = productosPresentes.map(p => `
      <div class="modo-producto-grupo">
        <span class="modo-producto-label">${escapeHtml(p)}</span>
        <div class="modo-toggle-group">
          ${["auto", "cartuchos", "cubetas"].map(m => `<button type="button" class="modo-btn ${RESUMEN_MODO_PRODUCTO[p] === m ? "modo-btn-active" : ""}" data-modo-producto="${escapeHtml(p)}" data-modo-valor="${m}">${nombresModo[m]}</button>`).join("")}
        </div>
      </div>`).join("");
    modoBar.querySelectorAll("[data-modo-producto]").forEach(btn => {
      btn.addEventListener("click", () => {
        RESUMEN_MODO_PRODUCTO[btn.dataset.modoProducto] = btn.dataset.modoValor;
        renderResumen();
      });
    });
  }

  const matBody = document.getElementById("tbody-materiales");
  const itemsConManuales = combinarItemsConManuales(resumen.items);
  if (itemsConManuales.length === 0) {
    matBody.innerHTML = `<tr><td colspan="6" class="empty-state">Agregá filas y datos en la pestaña Calculadora para ver el resumen.</td></tr>`;
  } else {
    // Códigos válidos de collarín para identificar ítems tipo COLLARÍN
    const COLLAR_OPTS = ["CP 643N 1.5","CP 643N 2","CP 643N 3","CP 643N 4","CP 643N 6","CP 644 8","CP 644 10"];
    // Filas computadas con collarín válido
    const filasCollar = computed.filter(r => r.AJ && r.AJ !== "-" && r.AI && r.AI !== "-");

    matBody.innerHTML = itemsConManuales.map(it => {
      const esCollar = it.tipo === "COLLARÍN" && typeof it._collarCode === "string" && COLLAR_OPTS.includes(it._collarCode);
      // Filas que contribuyen a este ítem de collarín
      const filasDe = esCollar
        ? filasCollar.filter(r => (r.AJ_override || r.AJ) === it._collarCode)
        : [];
      const editBtn = (esCollar && filasDe.length > 0)
        ? `<button type="button" class="btn-editar-collar secondary icon-only-btn"
             data-collar-code="${escapeHtml(it._collarCode)}"
             title="Cambiar talla de collarín"><svg class="icon"><use href="#i-edit"/></svg></button>`
        : "";
      // Fila calculada que además tiene una parte agregada a mano: se muestra
      // sumada, con el aviso de cuánto es manual y un botón que quita solo esa parte.
      const extra = Number(it.manualExtra) || 0;
      const badge = it.manual
        ? ' <span class="badge-manual" title="Agregado a mano">manual</span>'
        : (extra > 0 ? ` <span class="badge-manual" title="De la cantidad total, ${extra} se agregó a mano">incluye ${extra} manual</span>` : "");
      const quitarBtn = (it.manual || extra > 0)
        ? `<button type="button" class="btn-quitar-manual" data-manual-ids="${(it._manualIds || []).join(",")}" title="${it.manual ? "Quitar" : "Quitar la parte manual"}"><svg class="icon"><use href="#i-close"/></svg></button>`
        : "";
      return `<tr class="${it.manual ? "fila-manual" : ""}">
        <td>${escapeHtml(it.codigo)}</td>
        <td class="num">${it.cantidad}</td>
        <td><strong>${escapeHtml(tituloCaseProducto(it.producto))}</strong>${badge}</td>
        <td>${escapeHtml(it.presentacion)}</td>
        <td>${escapeHtml(tituloCase(it.tipo))}</td>
        <td>${editBtn}${quitarBtn}</td>
      </tr>`;
    }).join("");
    matBody.querySelectorAll(".btn-quitar-manual").forEach(btn => {
      btn.addEventListener("click", () => quitarItemsManuales(String(btn.dataset.manualIds || "").split(",")));
    });
    // Botones de editar talla de collarín
    matBody.querySelectorAll(".btn-editar-collar").forEach(btn => {
      btn.addEventListener("click", () => abrirModalCollar(btn.dataset.collarCode, filasCollar));
    });
  }

  const btnAgregarManual = document.getElementById("btn-agregar-manual");
  if (btnAgregarManual) btnAgregarManual.addEventListener("click", abrirModalAgregarManual);

  const normBody = document.getElementById("tbody-normativa");
  if (resumen.normativas.length === 0) {
    normBody.innerHTML = `<tr><td colspan="4" class="empty-state">Sin normativa determinada todavía.</td></tr>`;
  } else {
    normBody.innerHTML = resumen.normativas.map(nrm => {
      return `<tr>
      <td>${escapeHtml(nrm.aplicacion) || "—"}</td>
      <td><a href="${escapeHtml(nrm.link)}" target="_blank" rel="noopener" class="badge badge-ok">${escapeHtml(nrm.norma)}</a></td>
      <td>${escapeHtml(nrm.productoHilti)}</td>
      <td>${escapeHtml(nrm.zonas) || "-"}</td>
    </tr>`;
    }).join("");
  }

  const fichasBody = document.getElementById("tbody-fichas");
  if (fichasBody) {
    if (resumen.fichasTecnicas.length === 0) {
      fichasBody.innerHTML = `<tr><td colspan="2" class="empty-state">Sin fichas técnicas todavía.</td></tr>`;
    } else {
      fichasBody.innerHTML = resumen.fichasTecnicas.map(f => `
      <tr>
        <td>${escapeHtml(f.nombre || "Ficha técnica")}</td>
        <td><a href="${escapeHtml(f.link)}" target="_blank" rel="noopener" class="badge badge-ok">Ver ficha</a></td>
      </tr>`).join("");
    }
  }

  const alertBox = document.getElementById("alertas-box");
  if (resumen.alertas.length === 0) {
    alertBox.innerHTML = "";
    alertBox.style.display = "none";
  } else {
    alertBox.style.display = "block";
    alertBox.innerHTML = `<h3>Filas que requieren atención</h3><ul>` +
      resumen.alertas.map(a => `<li><strong>${escapeHtml(a.zona || "(sin zona)")}</strong> ${a.nivel ? "· Nivel " + escapeHtml(a.nivel) : ""}: ${escapeHtml(a.mensaje)}</li>`).join("") +
      `</ul>`;
  }
}

function fechaLegible(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}


// ---------------------------------------------------------------------------
// Modal: cambiar talla de collarín desde el Resumen
// ---------------------------------------------------------------------------
// Mapa completo de tallas disponibles para el override manual
const COLLAR_OVERRIDE_SIZES = [
  { code: "CP 643N 1.5", label: '1.5"', art: "#00304325" },
  { code: "CP 643N 2",   label: '2"',   art: "#00304326" },
  { code: "CP 643N 3",   label: '3"',   art: "#00304328" },
  { code: "CP 643N 4",   label: '4"',   art: "#00304329" },
  { code: "CP 643N 6",   label: '6"',   art: "#00304331" },
  { code: "CP 644 8",    label: '8"',   art: "#00304341" },
  { code: "CP 644 10",   label: '10"',  art: "#00304344" },
];

function abrirModalCollar(collarCode, filasCollar) {
  // Filas afectadas (las que tienen este código de talla, con o sin override)
  const filasDe = filasCollar.filter(r => (r.AJ_override || r.AJ) === collarCode);
  if (!filasDe.length) return;

  // Talla actual (puede ser la automática o la que ya tiene override)
  const tallaActual = filasDe[0].AJ_override || collarCode;

  // Crear overlay
  const overlay = document.createElement("div");
  overlay.className = "instr-modal-overlay open";
  overlay.style.zIndex = "9999";
  overlay.style.display = "flex";

  const box = document.createElement("div");
  box.className = "instr-modal";
  box.style.maxWidth = "360px";
  box.innerHTML = `
    <div class="instr-modal-header">
      <span>Cambiar talla de collarín</span>
      <button type="button" class="btn-cerrar-collar" title="Cerrar">
        <svg class="icon"><use href="#i-close"/></svg>
      </button>
    </div>
    <div style="padding:20px 24px">
      <p style="margin:0 0 12px;font-size:var(--fs-sm);color:var(--text-secondary)">
        Afecta ${filasDe.length} penetrante${filasDe.length !== 1 ? "s" : ""}
        que usan talla <strong>${collarCode.replace("CP 643N ", "CP643N ").replace("CP 644 ", "CP644 ")}</strong>.
      </p>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px">
        ${COLLAR_OVERRIDE_SIZES.map(sz => `
          <button type="button"
            class="secondary btn-collar-talla${sz.code === tallaActual ? " active" : ""}"
            data-code="${sz.code}"
            style="padding:8px 14px;font-weight:600">
            ${sz.label}
          </button>`).join("")}
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button type="button" class="secondary btn-collar-restaurar">Restaurar automático</button>
        <button type="button" class="primary btn-collar-ok">Aplicar</button>
      </div>
    </div>`;
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  let seleccionado = tallaActual;

  box.querySelectorAll(".btn-collar-talla").forEach(btn => {
    btn.addEventListener("click", () => {
      box.querySelectorAll(".btn-collar-talla").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      seleccionado = btn.dataset.code;
    });
  });

  const cerrar = () => overlay.remove();
  box.querySelector(".btn-cerrar-collar").addEventListener("click", cerrar);
  overlay.addEventListener("click", e => { if (e.target === overlay) cerrar(); });

  // IDs de las filas computed que corresponden a este collarCode
  const idsAfectados = new Set(filasDe.map(r => r._id));

  box.querySelector(".btn-collar-restaurar").addEventListener("click", () => {
    // Quitar override de las filas originales que corresponden a este grupo
    ROWS.forEach(r => { if (idsAfectados.has(r._id)) r.AJ_override = null; });
    marcarCambio();
    renderResumen();
    renderTable();
    cerrar();
  });

  box.querySelector(".btn-collar-ok").addEventListener("click", () => {
    // El AJ automático de las filas afectadas es collarCode (sin override)
    // Si el usuario eligió la misma talla que el auto, se quita el override.
    ROWS.forEach(r => {
      if (idsAfectados.has(r._id)) {
        r.AJ_override = (seleccionado === collarCode) ? null : seleccionado;
      }
    });
    marcarCambio();
    renderResumen();
    renderTable();
    cerrar();
  });
}

const LETTERHEAD_HEADER_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABPsAAAEECAYAAABeGDFcAAAt2UlEQVR4nO3df3DW5Z0v/E9JidwQCASJoTQNInWbtIrMbnWO7E607G7XQgtlxtoyRak7TnO6WmyXdT3UYnVbjsvxqVI9PbTuKmiHajuDv+C421NWsy2eR20H0Ra6llJitEaQwA0JQfKAzx8Ylh/58b1/cYc7r9dMZuTO9b2uT+47/MHb67o+73nnnXcCAAAAADjzDSt2AQAAAABAfgj7AAAAAKBECPsAAAAAoEQI+wAAAACgRAj7AAAAAKBECPsAAAAAoEQI+wAAAACgRAj7AAAAAKBECPsAAAAAoEQI+wAAAACgRAj7AAAAAKBECPsAAAAAoEQI+wAAAACgRAj7AAAAAKBECPsAAAAAoEQI+wAAAACgRAj7AAAAAKBECPsAAAAAoEQI+wAAAACgRAj7AAAAAKBECPsAAAAAoEQI+wAAAACgRAj7AAAAAKBECPsAAAAAoEQI+wAAAACgRAj7AAAAAKBECPsAAAAAoEQI+wAAAACgRAj7AAAAAKBECPsAAAAAoEQI+wAAAACgRAj7AAAAAKBECPsAAAAAoEQI+wAAAACgRAj7AAAAAKBECPsAAAAAoEQI+wAAAACgRAj7AAAAAKBECPsAAAAAoEQI+wAAAACgRAj7AAAAAKBECPsAAAAAoEQI+wAAAACgRAj7AAAAAKBECPsAAAAAoEQI+wAAAACgRAj7AAAAAKBECPsAAAAAoEQI+wAAAACgRAj7AAAAAKBECPsAAAAAoEQI+wAAAACgRAj7AAAAAKBECPsAAAAAoEQI+wAAAACgRAj7AAAAAKBECPsAAAAAoEQI+wAAAACgRAj7AAAAAKBECPsAAAAAoEQI+wAAAACgRAj7AAAAAKBECPsAAAAAoEQI+wAAAACgRAj7AAAAAKBECPsAAAAAoEQI+wAAAACgRAj7AAAAAKBECPsAAAAAoEQI+wAAAACgRAj7AAAAAKBECPsAAAAAoEQI+wAAAACgRAj7AAAAAKBECPsAAAAAoEQI+wAAAACgRAj7AAAAAKBECPsAAAAAoEQI+wAAAACgRAj7AAAAAKBECPsAAAAAoEQI+wAAAACgRAj7AAAAAKBECPsAAAAAoEQI+wAAAACgRAj7AAAAAKBECPsAAAAAoEQI+wAAAACgRAj7AAAAAKBECPsAAAAAoEQI+wAAAACgRAj7AAAAAKBECPsAAAAAoEQI+wAAAACgRLy32AWUopeqpoyNiMsi4qKiFgIwNOyNiBcvbN/+TJHrAAAAKLr3vPPOO8WuoWS8VDXlsoi4MSLmFLcSgCEpHRF3R8TdF7Zv31vcUgAAAIpD2JcH7+7k+0ZELCpuJQDE0dBv4YXt2x8rdiEAAACnm7AvR+8Gfc9ExLTiVgLASVZc2L79xmIXAQAAcDpp0JEDQR/AoLbopaop3yh2EQAAAKeTsC83q0LQBzCY3frufaoAAABDgrAvS+/+41EjDoDBb1WxCwAAADhdhH3Z+0axCwAgkbqXqqYsLHYRAAAAp4OwLwsvVU25KCIai10HAIndWOwCAAAATgdhX3YuK3YBAGRk2rtNlQAAAEqasC87lxW7AAAydlGxCwAAACg0YV92xha7AAAyNrnYBQAAABSasA+AoWJysQsAAAAoNGEfAAAAAJQIYR8AAAAAlIj3FrsAho6KWfUx/qrPxPBJk+Pwvr3Rdue3o2tja8HWK2+oivJzz4muF3bE4Z1dBVsHAAAAYLAQ9lFQZdWpGDPv0phw7fUxYuq0E7434o8uilcu+0RBgrhxTTOjdtl9x/6cXrc6dn7v/oKGiwAAAADF5hgvBZGaURt1D94a9b98NmqX3XdK0BcRMbymLibceFXe166YVX9C0BcRUTn7mvjgk80xdcMDUTn/4ryvCQAAADAYCPvIq3FNM2Pqhgfig082R+Xsa2LYqMp+x5+9YFGUVafyWsP7bl3W5/dGTm+MunsfjvotT8e4ppl5XxsAAACgmIR95EV5Q1Wc//yjUbvsvhg5vTHxc8NGVeZ1d9+4ppm97iI82fCauqhddl/U//LZmHRv/gNHAAAAgGIQ9pEXk7719UQhW2+qm5ZGeUNVzjWUVadi0tfuzOiZYaMqY/z8RVH/y2cjNaM25xoAAAAAiknYR16UjRmb0/MTb74h5xom3HjVgMeG+zJsVGWc9/ATOdcAAAAAUEzCPgaFytnX5LS7r7yhKqqbluZUw7BRlVExqz6nOQAAAACKSdhHXnQ815zzHJO+9fWsn83HzkAAAACAM52wj7zo2PhcznOMbpyT1c66iln1UTn7mpzXP9KZjq4XduQ8DwAAAECxCPvIi471W/MyT81Xbzotz/Rm/9OPxeGdXXmZCwAAAKAYhH3kzYFNuR/lHTm9MaPdfZXzL46R0xtzXjci4o077snLPAAAAADFIuwjb7q2vpiXeSavXBOpGbUDjkvNqI3af/xeXtY8sKk5Dm1pz8tcAAAAAMXy3mIXQOnoePb/xvj5i3KeZ9ioyvjgk82xv/nx6HjuZ9H18tEjwof3dkTXxtaomFUfFTMuibMXLIphoypzXi8iYvePf5CXeQAAAACKSdhH3nS9uC2v841unBOjG+fkdc7edLe1xJ6VGwq+DgAAAEChOcZL3hza0h7dbS3FLiNjex5bXewSAAAAAPJC2EdeHfyPF4tdQsbaf/BEsUsAAAAAyAthH3nVtXVzsUvISHrdao05AAAAgJIh7COvOjY+V+wSMrL7kR8VuwQAAACAvBH2MWQd3LY5OtZvLXYZAAAAAHkj7COvhte+r9glJLbr/nuLXQIAAABAXr232AVQWsZf+fmc5zi4bXO8/ZsX4+3XWuLwvn3R9fJ/7r5LXVAfZWPGxFnvr4vhkybHyOmNWa1xpDMde1ZuyLlWAAAAgMFE2EfeVMyqzyp8O9KZjv1PPxZ7/+Wp6Pjpy3F4Z1efY3s7dlsxqz4qZlwSFZc0Jl7/rYdWZFwnAAAAwGAn7BviKudfHKmPNMTbr7ZG579vyrozbXlDVUxeuSajZw5sao7dP/5BzjvsOtZvfTcEXBVl1amYcONVcfaCRTFsVGWv4490pmPX3Y/ktCYAAADAYCTsG8Im3bsoxs9fdMJrB7dtjs7nn4n0Uz9J3LwiNaM2Jt/3YJ/h2skObtscf7htSUGaYxze2RVtS1ZF25JVMa5pZtR8+ZYYXlN3wpi3HlrR7+5BAAAAgDPVe955551i13DGealqyjMRkd1lcYNEeUNVfOjnv+h3zJHOdHT+4pnY+6/ret31l2QX3cnzvfk//yF23bE2p9ozNeHmeXHO33w9ho2qjO62lnjlsk8I+2Bouu3C9u3fKHYRAAAAhWRn3xA18eYbBhwzbFRljG6cE6Mb50TE0R15+376eEREnPX+uhh9+dyMdvPtWPjXWR8TzsWuO9ZG+/1PRdnZqaKsDwAAAHC6CPuGoLLqVIy+fG7Gz42YOi1GTJ2W8XPpdauj5erbMn4unw7v7LKbDwAAACh5733zzTed483QWX8+Nd7+6bZil5G1qmuvSLwjL1dvLF982o/tAvRmzJLP3Prmm2/eWuw6AAAACsnOviHo7KsHPsKbD61Lrsu50y4AAAAAyQn7hpiKWfWndKcthN1rVuQl6CtvqIryc8855fWuF3Y4lgsAAABwEmHfEDP+qs8UfI30utXx+vUrsnq2vKEqKj91WVT+xSdj5PT+Gx53t7XEvn97LHZ996GsGm9UzKqPihmXREREqv7oXYRdWzcf+/7br7ZmHFhOuHlelI0Zc+zPJ8+bXr8huja29jvHuKaZcdYHajNatzcdG5/LOhQtq05F1bVXnPCz5FvHxueiY/3WfsdMuHleVFzyZ1E2Zmwc3rf3hM8nE12/2hJdL27LukFLeUNVVH3+U1k9e7JcPpdM9HyGIxsuiIiIt19rOaWOgd5/AAAAzjzvaWtrc2dfhvbesOCMvLOvvKEqPvTzXxR0jYPbNsfvZs/POMgob6iKiTffEJWzr8lq3QObmqPt28sThxdl1amo/+WzA95dmMlR5JplC6O6aWm/Y450puNXtdP7/H5qRm188MnmROsltb/58dj1T9/PKNg599G7jnVhLqQDm5pj28wv9Pq9QrwX3W0t8daD90T7/U9l9DtaiPcjvW517H7kRwUL3CbduyjGz1/U75iW6z8b6TXPF2T9wWjMks9EasFXil0GAABAQQ0rdgGcPvnamdSf1q98OeOgb1zTzDj/XzdkHfRFRIyc3hhTHlofk+5dFGXVqQHHpz46OVGTkrEfn524hopL+t+JGBEDrlk5a2bi9ZIa3Tgnpjy0Ps599K5E701ExIg/uijvdfSmv92bFX/20byvN7ymLibedGec/8z/jsr5Fyd+btSfXJb3WipnX5PR72wmyqpTMW7OwgHHnXPjf8vrugAAABSfsG8IGTc3+zAtiZ0rbx/wiOrJxjXNjNpl9+WtO/D4+YvivHVrIjUj92OwERFlY8bmZZ7BYHTjnMTvTfcbOwpf0AAKeYR4eE1d1N37cEy6t/+dbz0K2b2653c2n4HfmHmXJqp5xNRpefu7AgAAwOAg7BtCCtmYo7utJXbd/UhGz6Rm1EbtsvvyXsuIqdNi0u23533eUjBi6rSYfN+Ded9JdqYaP39R1D14a7HLiBFTp8V569bkbb7xV34+8diqz83L27oAAAAUn7BvCOluaxl4UJbavvPNjI/vFjKQGzm9McY15f9IbCkYXlMX5/7wu8UuY9ConH3NoPhdGTF1WtQsW5jzPOUNVQM2tznemI/NzXlNAAAABg9h3xDS9p1vFmTe7raWjLvWpmbUZhRIZGPMpX9a0PkLoWPjc6dlHWHoiSZ97c4ob6gqdhlR3bQ05zoyvZtzeE1dRvcXAgAAMLgJ+4aQPSs3xPYFs/K+wy+bELHQRwePdKbjjTvuKegaZ7qaL99S7BIGjWGjKmPizTfkPM/BbZtj58rbT/k6uG1z4jkmfGlBTjVkczfn2L+6Iqc1AQAAGDzeW+wCOL061m+NV174REy48aqoblqa83xHOtOxb+2zGT+Xqr8o8djutpYTGkaMOP+iAZsPvP6txXFoS3vGdQ0lPTu60mueL1oNRzrTeZnn5N+RiP47/famcvY1UVa9POPj6Md75eJP9/p625JVMeHmeTHxpjsHnGPMx+bG67Eiq/UrZtVndTdnPn52AAAABgdh3xB0eGdXtC1ZFen1G2LS7bfndJx2/9OPZRUQJF1z58rbo23JqlNen3DzvDjnb77ea+i3c+XtGR8rPtN0t7VE6999KTrWbz32WsWs+qi84i9j/PxkHWYjju7oyiXs625riYP/8WJWXYu7X98Rux/5UdZr90ivWx0tV992yutl1amMQ+2qa6+IXXeszaqOA5ua+/3+rjvWxsiGC6Jydv8774bX1EV5Q1VWYfX4qz6T8TM9xsy7tOT/3gAAAAwFwr4hrGtja2yb+YV+g7OB7P2XpwpQ2VFHOtO9Bn0RR4OTjp+9ELV3fSdGTJ127PU3li/OOqw5k+x5bPUJQV/E0V2bHeu3RvsP157yvvTlrA9dlFMdr1z2iaLvBusrMOwJtd9+tTVx1+eKS/4sdkXhfn92fu/+AcO+iIjyc8/JOOwrq07F6MvnZllZxIRrrxf2AQAAlAB39hG77lgbr3x85oA7k3rT8dOXC1DRUYf37+33+10bW+N3s+fHgU3NcaQzHa1LrhsSQd9Auja2xo6Ff51obJJAsD/FDvqS2LNyQ+Lf7eGTJhe0lkO/fatgc4+Zd2lWgX2PEVOnDYomJQAAAORG2EdERBza0h7bZn4hWpdcl/getQObmrMOe5I0CRleUxc1yxb2O+bwzq7YNvML8ava6XYlHefQlvaMmkKUut0//kGicbmGnwMZM+/Sgs099uOzc54j1+YgAAAAFJ+wjxPsWbkhfvfZTyUK/Lq2vpj1Ogf/I9mz1U1LY+qGB6JiVn3Waw1VZRVji13CoNHd+odil3D0DsFrry/I3OUNVTG6cU6/Y5IE7GM+NjdPFQEAAFAswj5O0bWxNVHgd+i11qzXaP/xDxOPHTm9MaY8tD7qtzwdE26eF2XVqazXHSrKG6qy6sqazTpnguG170s0LpfdkCOnN8a4pplRMav+lK/K+RfH+c/878Q7B0++j3EglZ+6bMAx+/7tsQF/vuE1dYJ1AACAM5wGHfSqa2Nr7Hl8Vb+dXbteziyQOF56zfPRfUtLRoHU8Jq6mHjTnTHxpjtjf/Pj0f7jH+bUSfZMVjam77vZyqpTMXnVPyeaJ+mR7b5MXvXP8ebd/z0Op/cnGt/1wo683/NXVjl6wDHjr/x8ormODHBP5ECSNgLpz/7mxzN+5uyrbxhwTPqpn8Sh11pj4k39B47jr/pMdKw/tbsxAAAAZwZhH31KP/WTfsO+w3s7cpq/9e++FFMeWp/Vs6Mb58ToxjnRfUtL7Hlsdey6+5EzollEvoz52Nxoq/7+KT9zWXUqzlu3JvEOss5fPJNTHSOmTou6ex9OPP5IZzq2/vGlef2sUh9piHT0HfrWPXhrjJzemGiujucyb1KTb7v+6fsZjU/NqB0wND/SmY6O9Vvj0O/fjIk39T/f6MvnRln18iH19wkAAKCUOMZLnwY6Sti1MftjvD3zv7F8cU5zDK+pi+qmpfHh3/w6Jt27aMgc8R1eUxf1v3w2pm544ISvD//m1xk1meh47mcFrPJUw0ZVRuqjk/M655g/nxOpGbUnvFZWnYrK+RfH1A0PROXsaxLPlV5f3CYvB7dtzvgIb/UXrx1wzP6nH4uIZI1bho2qLGgjEQAAAArLzj6Katcda2NkwwUZBTJ9GT9/UYybszB2NM3PODAZLJIcSe0xbFRl4h1rfWm//6mcnh8MRkydFh98MvcdeQc2NeccYOfq7d+8mPEzoy+fO+CYvf/yn5/zvp8+PmAgPP7Kz+tuDQAAcIays48+na5dci1X3xatS67Ly1zDRlXGlIfWx7immXmZ73RLfaThtK2VXrfaUc3jtH17ebFLiMrZ15yyS7Hf8fMvjmGj+r6/MeLoEd7j77ZMsntx5PTGM6b5CgAAACcS9tGnfB+37M+elRvit59sjAOb8nNnWu2y+6Jy/sV5met06tj43GlZ50hnOl5bXPxwa7DYvWbFoNkNWnvXdxKPrbrycwOO6TnC26NrY2t0t7UM+FySDr8AAAAMPsI++lR5xV/2+/187/zp2tga22Z+IVqu/+yA94olUfuP3xsyd/hlqvXvv2hX37sObtscbbdn1hSjkEZMnRY1yxYOOK6sOhWjG+cMOO74I7w99v3bYwM+l6TDLwAAAIOPsI8+jZuzsN/vl597TkHWTa95Pl65+NOxfcGsSK9bnfU8w0ZVxoQbr8pjZaWhdcl1JxzrHMoObtscv5s9f9AFn2cv6LsLdo+qa68YcMzJR3h7tP9w7YDPDq+py+hIMQAAAIODBh30qmbZwgHvAhte+76IKNzRx471W6Nj/W1RVr08qq69Is6++oYYXlOX0Rzj5l4TbUtWFabAM8yRznS0/v0Xixr0HdjUPGiOy+5vfjx+/+mv5HXO9LrVsfuRH53yelnl6Bj7V1ckbkQzbFRljGua2W+TjHHzFgw4z6E3dvT6etJGJNVfvDZaNt6WaCwAAACDg7CPU6Rm1CbaWXTWB07Prp/DO7ti1x1rY9cda6Ny/sXxvlv+MXHoN7ymLsqqU4Nu59bpdKQzHXseXxVtt38/7+9Det3qeG3x8jPy/d31T/k/uttydd/BWHrN81H3YCQO/MZ+fHafYV95Q9WAHXUjkh8J7svRTr/CPgAAgDOJsI8TpGbUxnkPPzHgrr6IiIpLGiNiVcFrOl56zfORXnN51D14a+LQJPXRyafsJjv0+zcTPTts9NjEtY04/6LEY/Ohu60l9jzW9zHnw/v2RdfLWwu6k+5MDfoiIsZf9ZnoWH96g6yWq2+Lcx8dm+iuvRF/dFGf35vwpYF39fWoblqaeOzJho2qjMr5Fzv2DQAAcAYR9nFMzbKFcfaCRYmCvoiIkdMbc16zrDp1QtffpMHUa4uXx+jL5yau9WSHtrQnGjdi6rREOwPLG6qyriUb+5sfj1e/uKToQVux1484ejR41z//ryj/wPtj3LwFiXa8RRzdYVfecE/i34V82fuv6xKFff3tXh3zsbl5rKh/VVd+TtgHAABwBtGgg6iYVR/1W56O6qalGQdWFbPqs163rDoV561bE1MeWn/sq+7BWxM9e3hnV5/3keVbkkYIVZ//VKK58tFlOCKia+vmQRG0DQZt314e6TXPx6471sbvZs/PqKnLxJtPf8fZ7tY/5PR85fyLM767MhejG+foag0AAHAGEfYNYeUNVTF1wwMx5aH1WYcHlVf8ZVbP9QR9J+/Cqpx9TZz76F0DhgtJ7yzrz4FNzYnGnfM3X++3ntSM2sRHJbtf35FoHNk5vLMrXlu8PI50phONP7q7r6rAVZ1o/FWfyen5sX81cPicb0kCbwAAAAYHYd8QVFadipplC+NDP/9FzkdxszlO2FfQ12N045yo/+WzMa5pZq8hW1l1Kiav+ufE63W9sKP317e+mOj5YaMqo/6Xz0ZqxqkNSSpm1cd5Dz+RuJaO536WeOyZoLf3pNgO7+yKtx5akXj86dzdV1aderfpxcB6C6PLqlOJ76rMpySdfwEAABgc3Nk3xFTOvzhq//F7ebtfbnhNXcYX+H/ge8sG3JU3bFRl1C67L2LZ0dCj47mjwcdZ76/L6K6+7raWPo+7djz7f2P8/IG7DvfU88Enm4/Vcnjfvqj8i09mHJZ2/OyFjMYPdh98svnY0eRMd1p2t7XEWw/eE7vuWJv3unbd/Uji+yfzeXdfakZtdG1s7fN7tXd9J/Hvbm9h9Jh5l+ZSXtZGTJ0W5Q1Vp/1+QwAAADIn7BtCxjXNPBqg5dmEv/6vGYV9ZWPGZjT/yOmNWe9A3Pdvj/X5vfSa56P7lpaMjjDnUsvBbZv7DILOZNkepx5eUxcTb7qzIGFfz+6+pMerJ958Q7RcnXtn3p7w88j+vcdeG3H+RVmF6+0/PPV9GX/l53MpLycTvrQgXr8++Y5JAAAAisMx3iFk0tfuLMi8I6c35tSoo5B2ffehfr/f9p1vnqZKInbdf+9pW4uju/uKcXffiKnTjoXCI6c3ZhX0dbe1nBIMlzdU5aUDdrZOZwdgAAAAsifsG0LydXS3NzVfvSnx2N0//kHB6jhhnTUrBjx2uGflhuhuayl4LQc2NceelRsGHFdWObrgtQwVh3d2xZ7HVyUeX4zOvH35wzf//pTXknZ8PrCpObYvmBW//tCH46WqKQN+bV8wK1Eo2nNkHwAAgMFN2DeEJO0+m41MdvftWbkh0utWF6yWiKNHZttu/36isTuuu7qgtRzpTMerN/xtorGpjzQUtJahZqCdnccrRmfe3uxvfrzXY/Hj5iZrzPHqDX8bHeu39nlX5ck61m+NHU3zE40tRidgAAAAMiPsG0IKvaOu9n98t9fuub1pufq2aF1yXUHq6G5riR0L/zpx2NG1sbVgtRzpTMfvPvspjQ2K5NCW9oyC5WLv7ju4bXO8+sUlp7xeMas+0d2S6XWrs/pd61i/9Vijlf5Uzr4m8d9xAAAAikPYN4QU+sjq8Jq6eP+dyY/z7lm5IbYvmJXXmg5sao5XLvtExoFHTy1J73hLoifoK8WmHGeSN+64J/HYYu7uO7htc58h9firPpNojt2P/Cjr9fesTbYLslgdgQEAAEjmvRFRuLOdJeqdjoPTImJssevIRtt3vlmQjrw9KmdfE+Oafp7ofrqIozuKXnnhEzHhxqvi7AWLsr5X8EhnOt78n/+QU2fXjvVb45WPz4xJ3/p6jG6ck/U8EUd3WL22eHni3YU93n5VMJipw3s7+v1+z+6+ytnJjsH21pm3uy2zrs2Z2r1mRbTd/v0+f19GXz53wDm621qiY/3WrGtov/+pOOdvvj7g38HxV34+8d/vwebIvnRLROwodh0AAACF9N5zzjnnsmIXcaZ58/997ZmIKF5bzBzsW/tsHPlauqDNOiZ97c44+HLyHW2Hd3ZF25JVsevuR6Lq2iti3LwFMWLqtETPHty2OXbdf2/sW/tsxsFabw5taY/ff/orkZrx7aj+4rUx+vK5id+rI53p2P/0Y/HGHfdkfWy38983JRrX/oMnspo/qa6tLxa88+uRznS/DTQ6Nj4X1U39z7Fz5e2Jfs9eW7w8ho0emyjEHTZ67CmvvfXgPTHxpvx2sz64bXN0Pv9M7PruQzkf8z7Smc757snDO7vi9W8tHvB/BhzetzendYqp495/XTXl9v/1jWLXAQAAUEjveeedd4pdwxnnpaopz8QZGvZFRNQsWxjVTUsLukauR1jLqlNR8ecXHGtYkaqfFmVjxkbHc0c3onb9akt0/PTlvAR8A6mYVR+pC+qj/P21kaq/6ITvdW19MQ691hodP3shb8d1yxuqovzcc/r8/qHfv3la7gBM2nAlW10v7Bjw8xvovch0J9tA8w00Z5LnB5LN55fv92Eg/X32ST63Qey2C9u3f6PYRQAAABSSsC8LZ3rYV95QFR/6+S8Kvo4764BBRtgHAACUPA06hqBDW9pjf/PjBV9n2KjKOO/hJyI1o7bgawEAAAAg7Buy2n/8w8Rjj3SmY3/z4/HG8sWxfcGseGP54kivW53o2Z7Ab1zTzGxLBQAAACAhx3izcKYf4+1x/vOP9toI40hnOjp/8Ux0PPezfu+iK2+oig/c8/8kbuSwv/nxePWLS077fV9l1amYcONVUXFJYxzetzfa7vy2o8UwNDnGCwAAlDxhXxZKJewrq07FB763LMrGjI2IiI7nmqNj43MZX/Zf9+CtUTn7mkRjj3Sm4/VvLY49KzdkWm5WxjXNjJov3xLDa+pOqGHrH196JjcZALIj7AMAAEqesC8LpRL25dPUDQ8k3uEXEXFgU3O0fXt53ruIRvznTr5xc685IeQ7Xsv1n430mufzvjYwqAn7AACAkufOPvLi1Rv+NqPxI6c3xpSH1kf9lqdjXNPMKKtO5VxD5fyLo+7BW+PDv/l1VDct7TPoi4gY+1dX5LweAAAAwGAj7CMvDm1pT9y043jDa+qidtl98eHf/DrOffSumHDzvKiYVZ/o2dSM2hjXNDPOffSu+Ejrpqi79+HEx4lHXz43ozovbN8eNcsWJh4/4eZ5cf7zj8aF7dtj6oYHsupIXDGrPi5s335Kc5Oy6lS/9fQ8d/JXkvoHGpeaURtTNzwQF7Zvj/otT8ekexcNON/xX9m+FzXLFh6b4yOtm2Lqhgeicv7FfY7v6z2YuuGBPp+ZdO+iqN/y9LE1Jt27qM8Quuc96Hkfzn30rn5/ruPrz/Qz6W2e/p6bdO+i+EjrpmM/Q3/6+h07Xll1Ks599K5jP2umNQMAAHB6vbfYBVA6Dmx5OSpnZ//86MY5MbpxzrE/d7e1RPcbO04ZN3zi5H537SUxbFRlpGbUFqRRR+X8i2PiTXfGgU3NsXPl7XH2gkVx3sNPxCsfnxmHtrRnPF/Nl2854Y7DCTdelei59LrV8fZrLcf+3LHxuYzXPl55Q1Wc9/ATERGxe82KSNVfFOPnL4rD+9LRtmRVojp63otf1U7PqoadK2+PsjGVMeZjc6Pu3oejJfo/jn3ye/D2q71/3hNunhfj5y+KA5uaY89jq+Os99fFuDkLY9d3H+rzbsfutpZjY0dfPjfOe/iyAT/jnStvP+HPmXwmFbPqo7ppab9jen6O9LrVMXzS5Bg/f1G0/3Btn7/nNV+96ejP0c8dmu+/86YY3Tgndq9ZEeWTJkd109Ks7vYEAADg9BD2kTddL+f3H//Da+pyDvX6U/W5efH6xhX5n/fKz0V3W0v8/nNfisM7uyK9fkN88MnmqPzUZbFry9qM5xteUxcVs+qPhStnL+h/t1aP3Y/8KK+BTOqiqTFsVOUJ9x2e//yjMebP5/Qb9p1cR3XT0qyD1p512qq/Hx/+za+j6srP9Rv2JX0PKv/ik9Hd1hLbZn7h2GvlDff0G9x1v7HjWD2V8586urN0gM+4v/dpIId+/2b89pON8cEnm/scM7LhgjjSmY6Wq2+L8oaq+NDPfxGVs2ZG18ZT1x3XNDNGTm+M1iXX9bvu8EmT48Cm5nj9+hXvzjknKmZcIuwDAAAYpBzjJW8qZlxS7BIyMuZjcwsyb9mYsdH9xo5jO8J6Qq2yMWOynrPmqzdFxNGAZtioytyLzELqIw0RESeEa/t++niMmDot0fNl1alI1R8de+i3b+VUy+GdXXFgU/OxTtK56tr6YgyvqYsJN8+L8oaqiIiMdmH2vCe5fMYDObSlfcCA9P/btzeGjaqM8oaqSF00td+xNV++JY50pqO79Q/93pnZ/fqOGHH+RUd3rN58Q0REpNefnm7aAAAAZM7OPvKmJ8g5UwyvqYvyhqqsjtaeTul1q6Ny9jVR3lAVNV++JQ5sak7U+XjKQ+tP+PNLVVMKVWJGdaTXre7zaGyh1+7rPWj/4doY87G5MfGmO2PiTUeP6L714D2x647Md2L258L27cf++8Cm5hN2EuZD+qmfxPj5i+JDP//Ff77WSzBXOf/iY7tmpzy0Po50pmPrH1/a6+ey+5EfReXsa6Lu3oeP1V2I4+8AAADkh7CPvBnxRxcVu4SMZXu09nTa+y9PxejL58bkVf8cw2vqovXvvhRTHho47Htj+eK8H63ORs+9eWcvWBSH9++NlqtvO21rJ30Puja2xtaGyyM1ozYq/uyjUfkXn4yJN90ZXS9vzetx1e0LZh3778N7O/I2b4+O9Vvjt59sjMpZM6O6aWkc3La512CuZ5fmG8sXR9mYMVHdtDSqrr2i13Cz5qs3xZHOdLz+rcVx1gdqo7ppaYxrmtnvPX8AAAAUj7CPvCirThX0fr1CqfyLT+Z991ZExLDRY4/9d39HJJM4nN4fbz20IqqblkZ3W0vi8CnToGqgOnuaWxx/317FJY3R3dbS32Mn3JtX3bT0hPsHczHi/Ivi4Csv9jsm0/ega2NrdG1sjfQTz8SHfv6LxHfTJe0wfDruueva2BojLjj6+ey6/95+x/b87lc3Le3zCPLI6Y2xc+Xtx8K96qalcdYHMu+oDAAAwOkh7CMvUh+dXOwSsjJyemOUVacSHSs96/1HG2Ucr7fwJv1/noyJN90Z5z56V7T/+Idxzo3/7ejrOdxz1v6DJ6K6aWm0feebiZ9JXXBirYd+/+YpR5ZTM2qjZvFXY9c/fT/GX/WZiOi7Y23nv2+KiIjau74Tb9793yP1kYYYOb0x0utWJ6pn192PxNkLFkXt//hubF1/eeKf43gVs+pjeO37YvyVn49hoyoj/X+e7Hf8ye/B4b0dp+x0K6tOxXnr1sTbv3kxdj/yoyirHB1VV34uIiK6frWlz7mHjR4bFbPqI3VBfZx9dbK77E7+/entM8mHmi/f0m+X3cP79h0dt2xhlI05egdkX5/7wW2b4+wFi6LrV1ui/APvP+F5AAAABh9hH3lxpjXnON6YeZcmOpJYOfuaqJx9zQmv9XYH3K471sbIhguicvY1MbpxTkREtC65Lqd7zg5tac/4zr2JN915wp93rrz9lG6w5XUTY9SfXHaszvS61X2+F4e2tEfrkuuidtl9J9zf9tri5YnqObyz69gOxWyPgfbcwXekMx2716wYcFfmye9BX/fkdT7/TIyfv+iEz3f3mhX9dvodMXXasXq621oSfcYn3yHY22eSq3FNM48e9+6ny277/U/FuHkLorppaUQcDfT2rX2217GtX/lynPfwE8c+84PbNkf7/U/ltWYAAADy5z3vvPNOsWs447xUNeWZiBj40rQh5NxH7zoWGOXDkc507Hl8VaSf+kkc+v2bcfitrkh9dPKxXVT5PDK8v/nx+P2nv9LvmJN3ZPXo71hmWXUqUh+dnPXRzZ7nu17YccrOw4pZ9X3uCut57mT97SKrmFXf6zp9STr+5HE9tWW6o628oSrKzz0nInrfnXeyvt6D/p49/pmBPrPUjNooG1sREcl25x1f//Gy2dnX32d//FpJjx8f3tOZqIaB1j1D3HZh+/ZvFLsIAACAQhL2ZUHYd6r6LU/nLYBLr1sdry1e3m+QVLNs4bFdSbk60pmOX9VOz8tcwKAm7AMAAEresGIXwJmvvKEqr0Ffy9W3DbhjrG3Jqnhj+eK8rDlsVGVUzr84L3MBAAAAFJOwj5ylLpqal3mOdKYT3/8WcfRuvAObmvOydsWl/yUv8wAAAAAUk7CPnOUrKHv9W4sT3xnXo+3bycPB/oz52Ny8zAMAAABQTMI+cpaqvyjnObrbWrLqztqxfmvsb3485/WH19RFeUNVzvMAAAAAFJOwj0Gh9e++lPWzr3/tH/JSQ2/dUgEAAADOJMI+ctb9+o6cnj+wqTk61m/N+vlDW9ojvW51TjVERBze25HzHAAAAADFJOwjZ68tXp5To4x83Lv32uLlcaQznfXzBzY1R9fG1pzrAAAAACgmYR85O7yzK7bN/EK0XP/ZjEO/9LrVOe3qO76Gtx5akdWzu9esiG0zv5BzDQAAAADFJuwjb9Jrno9tM78Qv/nTP0l8rPaNO+7J2/q77n4k8e6+I53p2L1mRfzmT/8kXr8+u5AQAAAAYLAR9pF3h7a0R8vVt8WvP/Th2Lny9uhua+l13O41K+LQlva8rZtkd9/BbZujdcl1sfWPL43Xr8/v+gAAAADFJuyjYA7v7Iq2Jatia8Pl0brkuhOO+O5es6IgO+p23f1IHNy2+YTXjnSmI71udfz2k43xysWfjj0rN8ThnV15XxsAAACg2N5b7AIYGvas3BB7Vm4o+DqHd3bF72bPj6prr4iyMWPi7VdbY9/aZ4V7AAAAwJAg7KPkHN7ZFbvuWFvsMgAAAABOO8d4AQAAAKBECPsAAAAAoEQI+wAYKl4sdgEAAACFJuzLzo5iFwBAxvYWuwAAAIBCE/Zl55liFwBAZi5s3/5MsWsAAAAoNGFfdp4pdgEAZOTxYhcAAABwOgj7snBh+/Yd4R+OAGeSu4tdAAAAwOkg7MveN4pdAACJNDvCCwAADBXCvixd2L79xYi4rdh1ANCvdETcWOwiAAAAThdhXw4ubN/+jYhYXew6AOjTje/+zxkAAIAhQdiXowvbty8MgR/AYJOOiC9c2L59VbELAQAAOJ2EfXnwbuD3lTj6j0sAiqs5Ii4T9AEAAEPRe955551i11AyXqqaMjYiFr77Na2YtQAMQY9HxN2acQAAAEOZsK9AXqqaMjkiJkfE2Ii4qIilAJSyZyIiBHwAAABHCfsAAAAAoES4sw8AAAAASoSwDwAAAABKhLAPAAAAAEqEsA8AAAAASoSwDwAAAABKhLAPAAAAAEqEsA8AAAAASoSwDwAAAABKhLAPAAAAAEqEsA8AAAAASoSwDwAAAABKhLAPAAAAAEqEsA8AAAAASoSwDwAAAABKhLAPAAAAAEqEsA8AAAAASoSwDwAAAABKhLAPAAAAAEqEsA8AAAAASoSwDwAAAABKhLAPAAAAAEqEsA8AAAAASoSwDwAAAABKhLAPAAAAAEqEsA8AAAAASoSwDwAAAABKhLAPAAAAAEqEsA8AAAAASoSwDwAAAABKhLAPAAAAAEqEsA8AAAAASoSwDwAAAABKhLAPAAAAAErE/w+yY0karNRGNwAAAABJRU5ErkJggg==";
const LETTERHEAD_FOOTER_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABPsAAAB4CAYAAACEj/dSAAA84ElEQVR4nO3df1RU550/8Hf37B+MmzgO3W4bFIM6Ld8aXWRI0yBZCJhUq7JBcT1iCD9OxROOQhRjQ5BGTRBNbQiCHnPUHn4EYw71B1mV6CZAYKOkqQyyGrtuKRB/YLrZCDcxwf/y/WN8ntw7c+9wh1+D4/t1Tk8j3BmeuXN/PM/nfp7P871vv/0WREREREREREREdPf7O383gIiIiIiIiIiIiEYGg31EREREREREREQBgsE+IiIiIiIiIiKiAMFgHxERERERERERUYBgsI+IiIiIiIiIiChAMNhHREREREREREQUIBjsIyIiIiIiIiIiChAM9hEREREREREREQUIBvuIiIiIiIiIiIgCBIN9REREREREREREAYLBPiIiIiIiIiIiogDBYB8REREREREREVGAYLCPiIiIiIiIiIgoQDDYR0REREREREREFCAY7CMiIiIiIiIiIgoQDPYREREREREREREFCAb7iIiIiIiIiIiIAgSDfURERERERERERAGCwT4iIiIiIiIiIqIAwWAfERERERERERFRgGCwj4iIiIiIiIiIKEAw2EdERERERERERBQgGOwjIiIiIiIiIiIKEAz2ERERERERERERBQgG+4iIiIiIiIiIiAIEg31EREREREREREQBgsE+IiIiIiIiIiKiAMFgHxERERERERERUYBgsI+IiIiIiIiIiChAMNhHREREREREREQUIBjsIyIiIiIiIiIiChAM9hEREREREREREQWIv/d3A4hGmsPhmARgDgDx/0RERERERERq5wH0AzjvdDr7/doSohH2vW+//dbfbSAaFofDMQfA43f+NwfAg/5rDREREREREd1lPoUr+PcBgA+cTud5fzaGaLgY7KO7ksPhCAOwDkASGNwjIiIiIiKikfMpgDoApU6ns8e/TSHyHYN9dFdxOByPA9gCIM6/LSEiIiIiIqJ7QDOALU6n8wN/N4TILAb76K7AIB8RERERERH5EYN+dNdgsI/GtTuLbZQCSPdvS4iIiIiIiIhQBWAdF/Wg8YzBPhq3HA5HEoBKAFb/toSIiIiIiIhIUgBkOJ3OOn83hEjP3/m7AUR6HA5HKYBjYKCPiIiIiIiIxhcrgGN3xq1E4w4z+2hcuTNttw6szUdERERERETjXzOA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";

// ============================================================================

// --- Exports usados por otros módulos ---
window.fmtDetalleNum = fmtDetalleNum;
window.fmtComa = fmtComa;
window.detalleCalculoTexto = detalleCalculoTexto;
window.renderTable = renderTable;
window.aplicarFiltroCalc = aplicarFiltroCalc;
window.updateAllBadges = updateAllBadges;
window.attachTableEvents = attachTableEvents;
window.renderResumen = renderResumen;
window.fechaLegible = fechaLegible;
window.LETTERHEAD_HEADER_PNG = LETTERHEAD_HEADER_PNG;
window.LETTERHEAD_FOOTER_PNG = LETTERHEAD_FOOTER_PNG;
})();
