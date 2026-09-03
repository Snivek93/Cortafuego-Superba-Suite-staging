// ============================================================================
// ui-comun-y-cuantificacion.js — encapsulado en IIFE (sin exponer todo a window; ver export list abajo)
// ============================================================================
(function () {
function mostrarToast(mensaje, tipo) {
  let box = document.getElementById("toast-box");
  if (!box) {
    box = document.createElement("div");
    box.id = "toast-box";
    document.body.appendChild(box);
  }
  const el = document.createElement("div");
  el.className = "toast " + (tipo === "error" ? "toast-error" : "toast-ok");
  el.textContent = mensaje;
  box.appendChild(el);
  setTimeout(() => { el.classList.add("toast-out"); setTimeout(() => el.remove(), 300); }, 4200);
}

function mostrarToastProgreso(mensaje) {
  let box = document.getElementById("toast-box");
  if (!box) {
    box = document.createElement("div");
    box.id = "toast-box";
    document.body.appendChild(box);
  }
  const el = document.createElement("div");
  el.className = "toast toast-progreso";
  const spinner = document.createElement("span");
  spinner.className = "toast-spinner";
  el.appendChild(spinner);
  const texto = document.createElement("span");
  texto.textContent = mensaje;
  el.appendChild(texto);
  box.appendChild(el);
  return el;
}
function ocultarToastProgreso(el) {
  if (!el) return;
  el.classList.add("toast-out");
  setTimeout(() => el.remove(), 300);
}

function opcionesCatalogoProductoManual() {
  return PRODUCTOS.map((p, i) => `<option value="${i}">${escapeHtml(p.nombre.trim())} — ${escapeHtml(p.presentacion)}</option>`).join("");
}

function abrirModalAgregarManual() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box modal-box-wide">
      <h3 style="margin:0 0 4px;">Agregar producto manual</h3>
      <p style="margin:0 0 16px; font-size:var(--fs-sm); color:var(--text-muted);">Se suma a la Cuantificación de Materiales sin pasar por el cálculo de filas — útil para pedidos aparte o material adicional que ya sabés que hace falta.</p>
      <div class="lev-field" style="margin-bottom:12px;">
        <label>Producto</label>
        <select id="manual-producto-select">
          ${opcionesCatalogoProductoManual()}
          <option value="otro">Otro (escribir a mano)</option>
        </select>
      </div>
      <div id="manual-producto-otro-campos" style="display:none;">
        <div class="lev-field" style="margin-bottom:12px;">
          <label>Producto</label>
          <input type="text" id="manual-otro-producto" placeholder="Ej. CP 675">
        </div>
        <div class="lev-field" style="margin-bottom:12px;">
          <label>Presentación</label>
          <input type="text" id="manual-otro-presentacion" placeholder="Ej. Caja 12 unidades">
        </div>
        <div class="lev-field" style="margin-bottom:12px;">
          <label>Código (opcional)</label>
          <input type="text" id="manual-otro-codigo" placeholder="Ej. #00000000">
        </div>
      </div>
      <div class="lev-field" style="margin-bottom:4px; max-width:140px;">
        <label>Cantidad</label>
        <input type="number" inputmode="numeric" min="1" step="1" id="manual-cantidad" value="1">
      </div>
      <div class="modal-actions" style="margin-top:16px;">
        <button class="secondary" data-act="cancel">Cancelar</button>
        <button class="primary" data-act="ok">Agregar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const selectEl = overlay.querySelector("#manual-producto-select");
  const otroCampos = overlay.querySelector("#manual-producto-otro-campos");
  selectEl.addEventListener("change", () => {
    otroCampos.style.display = selectEl.value === "otro" ? "block" : "none";
  });

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay || e.target.dataset.act === "cancel") { overlay.remove(); return; }
    if (e.target.dataset.act === "ok") {
      const cantidad = parseInt(overlay.querySelector("#manual-cantidad").value, 10);
      if (!cantidad || cantidad < 1) { mostrarToast("Ingresá una cantidad válida.", "error"); return; }
      let entry;
      if (selectEl.value === "otro") {
        const producto = overlay.querySelector("#manual-otro-producto").value.trim();
        if (!producto) { mostrarToast("Ingresá el nombre del producto.", "error"); return; }
        entry = {
          tipo: "MANUAL", producto,
          presentacion: overlay.querySelector("#manual-otro-presentacion").value.trim() || "-",
          codigo: overlay.querySelector("#manual-otro-codigo").value.trim() || "-",
          cantidad,
        };
      } else {
        const p = PRODUCTOS[Number(selectEl.value)];
        entry = { tipo: p.tipo.trim(), producto: p.nombre.trim(), presentacion: p.presentacion, codigo: "#" + p.articulo, cantidad };
      }
      entry._id = MANUAL_ITEM_SEQ++;
      MANUAL_ITEMS.push(entry);
      overlay.remove();
      renderResumen();
      marcarCambio();
      mostrarToast("Producto agregado a Cuantificación de Materiales.");
    }
  });
}

function quitarItemManual(id) {
  quitarItemsManuales([id]);
}

// Quita una o varias entradas manuales de golpe — una fila del Resumen puede
// juntar más de un agregado a mano del mismo producto.
function quitarItemsManuales(ids) {
  const set = new Set((Array.isArray(ids) ? ids : [ids]).map(Number).filter(v => !isNaN(v)));
  if (!set.size) return;
  MANUAL_ITEMS = MANUAL_ITEMS.filter(m => !set.has(Number(m._id)));
  renderResumen();
  marcarCambio();
}

function pedirConfirmacion(mensaje, onConfirm) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box">
      <p>${escapeHtml(mensaje)}</p>
      <div class="modal-actions">
        <button class="secondary" data-act="cancel">Cancelar</button>
        <button class="primary" data-act="ok">Continuar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay || e.target.dataset.act === "cancel") { overlay.remove(); return; }
    if (e.target.dataset.act === "ok") { overlay.remove(); onConfirm(); }
  });
}

window.mostrarToast = mostrarToast;
window.mostrarToastProgreso = mostrarToastProgreso;
window.ocultarToastProgreso = ocultarToastProgreso;
window.abrirModalAgregarManual = abrirModalAgregarManual;
window.quitarItemManual = quitarItemManual;
window.quitarItemsManuales = quitarItemsManuales;
window.pedirConfirmacion = pedirConfirmacion;
})();
