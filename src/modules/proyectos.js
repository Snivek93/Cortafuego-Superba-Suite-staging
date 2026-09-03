// ============================================================================
// proyectos.js — Pantalla de Proyectos (pantalla completa, multi-proyecto,
// carpetas + orden manual/A-Z/reciente)
// ============================================================================
// Depende de funciones expuestas por archivo-estado-app.js:
// idbListarProyectos, idbBorrarProyecto, abrirProyectoExistente,
// crearYAbrirProyectoNuevo, idbGuardarMetaClave, idbLeerMetaClave,
// PROYECTO_ACTIVO_ID — y de firebase-auth.js: usuarioActual, iniciales,
// abrirEditarPerfil, cerrarSesion. El orden de <script> no importa: todo se
// usa desde manejadores de eventos, después de que los archivos ya
// terminaron de ejecutarse.
//
// Organización: las carpetas y el orden son metadatos SEPARADOS del propio
// registro de cada proyecto (viven en el store 'meta', no en 'proyectos')
// — mover un proyecto de carpeta o reordenarlo nunca toca sus datos.
(function () {

let CARPETAS = [];                          // [{ id, nombre, creadoEn }]
let CARPETA_ASIGNACIONES = {};               // { [proyectoId]: carpetaId }
let ORDEN_MANUAL = { raiz: [], porCarpeta: {} }; // { raiz: [ids...], porCarpeta: { [carpetaId]: [ids...] } }
let MODO_ORDEN = "manual";                   // "manual" | "az" | "reciente" — por defecto Manual
let CARPETA_ACTIVA_ID = null;                // null = raíz

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function formatearFechaCorta(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("es-CR", { day: "numeric", month: "short", year: "numeric" }); }
  catch (e) { return ""; }
}
function formatearFechaRelativa(iso) {
  if (!iso) return "Sin guardar aún";
  const fecha = new Date(iso);
  const hoy = new Date();
  const msPorDia = 86400000;
  const diffDias = Math.floor((new Date(hoy.toDateString()) - new Date(fecha.toDateString())) / msPorDia);
  if (diffDias === 0) return "Actualizado hoy";
  if (diffDias === 1) return "Actualizado ayer";
  if (diffDias > 1 && diffDias < 7) return `Hace ${diffDias} días`;
  return "Actualizado " + fecha.toLocaleDateString("es-CR", { day: "numeric", month: "short" });
}

// ---------------------------------------------------------------------------
// Carga / guardado de metadatos de organización
// ---------------------------------------------------------------------------
async function cargarEstadoOrganizacion() {
  try { CARPETAS = (await window.idbLeerMetaClave("carpetas")) || []; } catch (e) { CARPETAS = []; }
  try { CARPETA_ASIGNACIONES = (await window.idbLeerMetaClave("carpetaAsignaciones")) || {}; } catch (e) { CARPETA_ASIGNACIONES = {}; }
  try { ORDEN_MANUAL = (await window.idbLeerMetaClave("ordenManual")) || { raiz: [], porCarpeta: {} }; } catch (e) { ORDEN_MANUAL = { raiz: [], porCarpeta: {} }; }
  if (!ORDEN_MANUAL.porCarpeta) ORDEN_MANUAL.porCarpeta = {};
  try {
    const modoGuardado = await window.idbLeerMetaClave("modoOrden");
    MODO_ORDEN = modoGuardado || "manual";
  } catch (e) { MODO_ORDEN = "manual"; }
}
function guardarCarpetas() { window.idbGuardarMetaClave && window.idbGuardarMetaClave("carpetas", CARPETAS).catch(() => {}); }
function guardarAsignaciones() { window.idbGuardarMetaClave && window.idbGuardarMetaClave("carpetaAsignaciones", CARPETA_ASIGNACIONES).catch(() => {}); }
function guardarOrdenManual() { window.idbGuardarMetaClave && window.idbGuardarMetaClave("ordenManual", ORDEN_MANUAL).catch(() => {}); }
function guardarModoOrden() { window.idbGuardarMetaClave && window.idbGuardarMetaClave("modoOrden", MODO_ORDEN).catch(() => {}); }

// ---------------------------------------------------------------------------
// Orden
// ---------------------------------------------------------------------------
function ordenarProyectos(lista, modo, carpetaId) {
  const copia = lista.slice();
  if (modo === "az") {
    copia.sort((a, b) => (a.data.projectInfo.nombre || "").localeCompare(b.data.projectInfo.nombre || "", "es"));
  } else if (modo === "reciente") {
    copia.sort((a, b) => new Date(b.data.guardadoEn || 0) - new Date(a.data.guardadoEn || 0));
  } else {
    const claveOrden = carpetaId ? (ORDEN_MANUAL.porCarpeta[carpetaId] || []) : (ORDEN_MANUAL.raiz || []);
    const posicion = new Map(claveOrden.map((id, i) => [id, i]));
    copia.sort((a, b) => {
      const pa = posicion.has(a.id) ? posicion.get(a.id) : Infinity;
      const pb = posicion.has(b.id) ? posicion.get(b.id) : Infinity;
      if (pa !== pb) return pa - pb;
      return new Date(b.data.guardadoEn || 0) - new Date(a.data.guardadoEn || 0);
    });
  }
  return copia;
}
function ordenarCarpetas(lista, modo) {
  const copia = lista.slice();
  if (modo === "reciente") copia.sort((a, b) => new Date(b.creadoEn || 0) - new Date(a.creadoEn || 0));
  else copia.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "", "es"));
  return copia;
}

// ---------------------------------------------------------------------------
// HTML de tarjetas
// ---------------------------------------------------------------------------
// candadoAjeno: nombre de la persona que tiene el proyecto tomado ahora mismo,
// o "" / null si está libre, vencido, o si el candado es propio. Se calcula en
// renderPantallaProyectos (ver candadosAjenosPorProyecto) — acá solo se pinta.
function tarjetaProyectoHTML(id, data, esBorrador, modoManual, esCompartido, candadoAjeno) {
  const nombre = esBorrador
    ? (formatearFechaCorta(data.creadoEn || data.guardadoEn) || "Borrador")
    : ((data.projectInfo && data.projectInfo.nombre) || "Sin nombre");
  let sub;
  if (esBorrador) {
    sub = "Sin nombre";
  } else {
    const cliente = data.projectInfo && data.projectInfo.cliente ? data.projectInfo.cliente : "";
    sub = [cliente, formatearFechaRelativa(data.guardadoEn)].filter(Boolean).join(" · ");
  }
  const arrastrable = modoManual && !esBorrador;
  return `
    <div class="proy-card${esBorrador ? " proy-card-borrador" : ""}" data-id="${escapeHtml(id)}" data-tipo="proyecto"
      ${arrastrable ? `draggable="true" data-drag-item="1"` : ""}>
      ${arrastrable ? `<svg class="icon proy-card-grip"><use href="#i-move"/></svg>` : ""}
      <div class="proy-card-info">
        <p class="proy-card-nombre">${escapeHtml(nombre)}${esCompartido ? `<span class="badge-manual">Compartido</span>` : ""}</p>
        <p class="proy-card-sub">${escapeHtml(sub)}</p>
        ${candadoAjeno ? `<p class="proy-card-candado"><svg class="icon"><use href="#i-lock"/></svg>${escapeHtml(candadoAjeno)} está editando</p>` : ""}
      </div>
      <div class="proy-card-right">
        ${!esBorrador ? `<button type="button" class="proy-card-compartir" data-id="${escapeHtml(id)}" title="Compartir" aria-label="Compartir"><svg class="icon"><use href="#i-share"/></svg></button>` : ""}
        ${!esBorrador ? `<button type="button" class="proy-card-mover" data-id="${escapeHtml(id)}" title="Mover a carpeta" aria-label="Mover a carpeta"><svg class="icon"><use href="#i-folder"/></svg></button>` : ""}
        <button type="button" class="proy-card-borrar" data-id="${escapeHtml(id)}" title="Borrar proyecto" aria-label="Borrar proyecto">
          <svg class="icon"><use href="#i-trash"/></svg>
        </button>
        <svg class="icon proy-card-chevron"><use href="#i-chevron-right"/></svg>
      </div>
    </div>`;
}
function tarjetaCarpetaHTML(carpeta, cantidad) {
  return `
    <div class="proy-card proy-card-carpeta" data-id="${escapeHtml(carpeta.id)}" data-tipo="carpeta">
      <svg class="icon proy-card-carpeta-icono"><use href="#i-folder"/></svg>
      <div class="proy-card-info">
        <p class="proy-card-nombre">${escapeHtml(carpeta.nombre)}</p>
      </div>
      <div class="proy-card-right">
        <span class="proy-carpeta-contador">${cantidad}</span>
        <button type="button" class="proy-card-borrar" data-id="${escapeHtml(carpeta.id)}" data-tipo="carpeta" title="Borrar carpeta" aria-label="Borrar carpeta">
          <svg class="icon"><use href="#i-trash"/></svg>
        </button>
        <svg class="icon proy-card-chevron"><use href="#i-chevron-right"/></svg>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Popup de cuenta (sin cambios de sesiones anteriores)
// ---------------------------------------------------------------------------
function popupCuentaContenidoHTML() {
  const user = window.usuarioActual ? window.usuarioActual() : null;
  if (!user) return "";
  const ini = window.iniciales ? window.iniciales(user) : "?";
  const nombre = user.displayName || "Sin nombre";
  const temaActualPref = window.temaLeerPreferencia ? window.temaLeerPreferencia() : "auto";
  const temaLabel = { auto: "Automático", light: "Claro", dark: "Oscuro" }[temaActualPref] || "Automático";
  const version = window.APP_VERSION || "1.0.0";
  return `
      <div class="proy-account-popup-head">
        <div class="proy-account-avatar">${escapeHtml(ini)}</div>
        <div class="proy-account-info">
          <p class="proy-account-name">${escapeHtml(nombre)}</p>
          <p class="proy-account-email">${escapeHtml(user.email || "")}</p>
        </div>
        <button type="button" class="proy-account-edit-btn" id="proy-btn-editar-perfil" title="Editar perfil" aria-label="Editar perfil"><svg class="icon"><use href="#i-edit"/></svg></button>
      </div>
      <button type="button" class="dropdown-item dropdown-item-sub" id="proy-btn-tema-toggle">
        <svg class="icon"><use href="#i-gear"/></svg>Tema<span class="proy-account-item-hint">${escapeHtml(temaLabel)}</span><svg class="icon icon-chevron-right"><use href="#i-chevron-right"/></svg>
      </button>
      <div class="dropdown-sub-panel" id="proy-tema-sub-panel">
        <div class="proy-tema-opciones">
          <button type="button" class="secondary btn-tema-opt" data-tema="auto">Auto</button>
          <button type="button" class="secondary btn-tema-opt" data-tema="light">Claro</button>
          <button type="button" class="secondary btn-tema-opt" data-tema="dark">Oscuro</button>
        </div>
      </div>
      <button type="button" class="dropdown-item dropdown-item-sub" id="proy-btn-acerca-toggle">
        <svg class="icon"><use href="#i-clipboard"/></svg>Acerca de<svg class="icon icon-chevron-right"><use href="#i-chevron-right"/></svg>
      </button>
      <div class="dropdown-sub-panel" id="proy-acerca-sub-panel">
        <p class="proy-acerca-texto">Firestop Suite · Superba<br>Versión ${escapeHtml(version)}<br>Ing. Kevin Soto Navarro, IC-31624<br>San José, Costa Rica</p>
      </div>
      <div class="dropdown-sep"></div>
      <div class="proy-account-logout-fila">
        <button type="button" class="proy-account-logout-link" id="proy-btn-logout">Cerrar sesión</button>
      </div>`;
}
function popupCuentaHTML() {
  if (!(window.usuarioActual && window.usuarioActual())) return "";
  return `<div class="proy-account-popup" id="proy-account-popup" hidden>${popupCuentaContenidoHTML()}</div>`;
}
function conectarBotonesPopup(popup) {
  const btnEditarPerfil = document.getElementById("proy-btn-editar-perfil");
  if (btnEditarPerfil) btnEditarPerfil.addEventListener("click", () => { popup.hidden = true; if (window.abrirEditarPerfil) window.abrirEditarPerfil(); });

  const btnTemaToggle = document.getElementById("proy-btn-tema-toggle");
  const temaSubPanel = document.getElementById("proy-tema-sub-panel");
  if (btnTemaToggle && temaSubPanel) {
    btnTemaToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      temaSubPanel.classList.toggle("open");
      btnTemaToggle.classList.toggle("open");
    });
  }
  if (window.registrarBotonesTema) window.registrarBotonesTema(popup);

  const btnAcercaToggle = document.getElementById("proy-btn-acerca-toggle");
  const acercaSubPanel = document.getElementById("proy-acerca-sub-panel");
  if (btnAcercaToggle && acercaSubPanel) {
    btnAcercaToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      acercaSubPanel.classList.toggle("open");
      btnAcercaToggle.classList.toggle("open");
    });
  }

  const btnLogout = document.getElementById("proy-btn-logout");
  if (btnLogout) btnLogout.addEventListener("click", () => {
    popup.hidden = true;
    const hacer = () => { if (window.cerrarSesion) cerrarSesion(); };
    if (window.pedirConfirmacion) pedirConfirmacion("¿Cerrar sesión?", hacer);
    else if (confirm("¿Cerrar sesión?")) hacer();
  });
}

// ---------------------------------------------------------------------------
// Modal chico: nombre de carpeta nueva / mover a carpeta
// ---------------------------------------------------------------------------
function abrirModalNuevaCarpeta(padreId) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box">
      <p style="font-weight:600;margin:0 0 12px;">Nueva carpeta</p>
      <input type="text" id="proy-nueva-carpeta-nombre" placeholder="Nombre de la carpeta" style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:var(--fs-base);margin-bottom:4px;" />
      <div class="modal-actions">
        <button class="secondary" data-act="cancel">Cancelar</button>
        <button class="primary" data-act="crear">Crear</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const input = document.getElementById("proy-nueva-carpeta-nombre");
  input.focus();
  const crear = async () => {
    const nombre = input.value.trim();
    if (!nombre) return;
    const id = "c_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
    CARPETAS.push({ id, nombre, creadoEn: new Date().toISOString(), padreId: padreId || null });
    guardarCarpetas();
    overlay.remove();
    renderPantallaProyectos(!!window.PROYECTO_ACTIVO_ID);
  };
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") crear(); });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay || e.target.dataset.act === "cancel") { overlay.remove(); return; }
    if (e.target.dataset.act === "crear") crear();
  });
}
function abrirModalMoverACarpeta(proyectoId) {
  const opciones = [{ label: "Sin carpeta", act: "sin-carpeta", clase: "secondary" }];
  CARPETAS.filter(c => !c.padreId).forEach(padre => {
    opciones.push({ label: padre.nombre, act: "carpeta:" + padre.id, clase: "secondary" });
    CARPETAS.filter(c => c.padreId === padre.id).forEach(hijo => {
      opciones.push({ label: "\u00A0\u00A0↳ " + hijo.nombre, act: "carpeta:" + hijo.id, clase: "secondary" });
    });
  });
  opciones.push({ label: "Cancelar", act: "cancelar", clase: "secondary" });
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  const botones = opciones.map(o => `<button class="${o.clase}" data-act="${o.act}">${escapeHtml(o.label)}</button>`).join("");
  overlay.innerHTML = `
    <div class="modal-box">
      <p style="font-weight:600;margin:0 0 12px;">Mover a carpeta</p>
      <div class="modal-actions" style="flex-direction:column;align-items:stretch;">${botones}</div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) { overlay.remove(); return; }
    const act = e.target.dataset.act;
    if (!act) return;
    overlay.remove();
    if (act === "cancelar") return;
    if (act === "sin-carpeta") delete CARPETA_ASIGNACIONES[proyectoId];
    else if (act.startsWith("carpeta:")) CARPETA_ASIGNACIONES[proyectoId] = act.slice(8);
    guardarAsignaciones();
    renderPantallaProyectos(!!window.PROYECTO_ACTIVO_ID);
  });
}

// ---------------------------------------------------------------------------
// Compartir (Fase 3) — crea/asegura el documento del proyecto en Firestore
// (si es la primera vez que se comparte) e invita por correo. Requiere
// conexión — sin señal simplemente avisa y no rompe nada local.
// ---------------------------------------------------------------------------
function abrirModalCompartir(proyectoId, nombreProyecto) {
  if (!window.fsCompartirProyecto || !window.fsAsegurarProyecto) {
    if (window.mostrarToast) mostrarToast("Compartir todavía no está disponible en esta versión.", "error");
    return;
  }
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box">
      <p style="font-weight:600;margin:0 0 2px;">Compartir "${escapeHtml(nombreProyecto || "proyecto")}"</p>
      <p style="font-size:13px;color:var(--text-muted, #888);margin:0 0 12px;">Se invita por correo. Si la persona todavía no tiene cuenta, va a quedar pendiente hasta que cree una con ese mismo correo.</p>
      <input type="email" id="proy-compartir-email" placeholder="correo@superba.cr" style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:var(--fs-base);margin-bottom:4px;" />
      <p class="auth-error" id="proy-compartir-error" style="display:none;"></p>
      <div class="modal-actions">
        <button class="secondary" data-act="cancel">Cancelar</button>
        <button class="primary" data-act="compartir">Compartir</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const input = document.getElementById("proy-compartir-email");
  input.focus();

  const hacerCompartir = async () => {
    const email = input.value.trim().toLowerCase();
    const errorEl = document.getElementById("proy-compartir-error");
    if (!email || !email.includes("@")) {
      errorEl.textContent = "Ingresá un correo válido.";
      errorEl.style.display = "block";
      return;
    }
    const user = window.usuarioActual ? window.usuarioActual() : null;
    if (!user) { errorEl.textContent = "No se pudo identificar tu cuenta."; errorEl.style.display = "block"; return; }
    if (email === (user.email || "").toLowerCase()) {
      errorEl.textContent = "Ese es tu propio correo.";
      errorEl.style.display = "block";
      return;
    }
    const btn = overlay.querySelector('[data-act="compartir"]');
    btn.disabled = true;
    const textoOriginal = btn.textContent;
    btn.textContent = "Un momento…";
    try {
      await window.fsAsegurarProyecto(proyectoId, { nombre: nombreProyecto, ownerId: user.uid, ownerEmail: user.email || "" });
      await window.fsCompartirProyecto(proyectoId, nombreProyecto, email, "editor", user.email || "");
      overlay.remove();
      if (window.mostrarToast) mostrarToast(`Invitación enviada a ${email}. Va a ver el proyecto en su próximo inicio de sesión.`);
    } catch (e) {
      errorEl.textContent = e && e.message ? e.message : "No se pudo compartir. Revisá tu conexión y probá de nuevo.";
      errorEl.style.display = "block";
      btn.disabled = false;
      btn.textContent = textoOriginal;
    }
  };
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") hacerCompartir(); });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay || e.target.dataset.act === "cancel") { overlay.remove(); return; }
    if (e.target.dataset.act === "compartir") hacerCompartir();
  });
}

// ---------------------------------------------------------------------------
// Arrastrar para reordenar (mouse: dragstart/dragover/drop; táctil: pointer
// con long-press 350ms) — mismo patrón que ya usa Informes de Acreditación
// para reordenar fotos, adaptado a lista vertical (eje Y en vez de X).
// ---------------------------------------------------------------------------
function ligarDragReordenarProyectos(lista, carpetaId) {
  if (!lista || lista.dataset.proyDragBind) return;
  lista.dataset.proyDragBind = "1";
  let idArrastrado = null;

  function guardarNuevoOrden() {
    const ids = Array.from(lista.querySelectorAll('.proy-card[data-tipo="proyecto"]')).map(el => el.getAttribute("data-id"));
    if (carpetaId) ORDEN_MANUAL.porCarpeta[carpetaId] = ids;
    else ORDEN_MANUAL.raiz = ids;
    guardarOrdenManual();
  }
  function limpiarIndicadores() {
    lista.querySelectorAll(".proy-drop-antes, .proy-drop-despues").forEach((el) => el.classList.remove("proy-drop-antes", "proy-drop-despues"));
  }
  function moverEnDOM(idMovido, idDestino, antes) {
    const origen = lista.querySelector(`.proy-card[data-id="${idMovido}"]`);
    const destino = lista.querySelector(`.proy-card[data-id="${idDestino}"]`);
    if (!origen || !destino || origen === destino) return;
    if (antes) destino.before(origen); else destino.after(origen);
    guardarNuevoOrden();
  }

  lista.addEventListener("dragstart", (evt) => {
    const item = evt.target.closest("[data-drag-item]");
    if (!item) return;
    idArrastrado = item.getAttribute("data-id");
    item.classList.add("proy-card-arrastrando");
    evt.dataTransfer.effectAllowed = "move";
    try { evt.dataTransfer.setData("text/plain", idArrastrado); } catch (e) {}
  });
  lista.addEventListener("dragend", (evt) => {
    const item = evt.target.closest("[data-drag-item]");
    if (item) item.classList.remove("proy-card-arrastrando");
    limpiarIndicadores();
    idArrastrado = null;
  });
  lista.addEventListener("dragover", (evt) => {
    const item = evt.target.closest('.proy-card[data-tipo="proyecto"]');
    if (!item || idArrastrado == null) return;
    evt.preventDefault();
    const rect = item.getBoundingClientRect();
    const antes = evt.clientY < rect.top + rect.height / 2;
    limpiarIndicadores();
    item.classList.add(antes ? "proy-drop-antes" : "proy-drop-despues");
  });
  lista.addEventListener("drop", (evt) => {
    const item = evt.target.closest('.proy-card[data-tipo="proyecto"]');
    if (!item || idArrastrado == null) return;
    evt.preventDefault();
    const rect = item.getBoundingClientRect();
    const antes = evt.clientY < rect.top + rect.height / 2;
    const idDestino = item.getAttribute("data-id");
    moverEnDOM(idArrastrado, idDestino, antes);
    limpiarIndicadores();
  });

  // Fallback táctil: mantener presionado el asa (350ms) y arrastrar el dedo.
  let touchId = null, touchTimer = null;
  lista.addEventListener("pointerdown", (evt) => {
    if (evt.pointerType !== "touch") return;
    const item = evt.target.closest("[data-drag-item]");
    if (!item || !evt.target.closest(".proy-card-grip")) return;
    touchTimer = setTimeout(() => {
      touchId = item.getAttribute("data-id");
      item.classList.add("proy-card-arrastrando");
      if (navigator.vibrate) navigator.vibrate(15);
    }, 350);
  });
  lista.addEventListener("pointermove", (evt) => {
    if (evt.pointerType !== "touch" || touchId == null) return;
    evt.preventDefault();
    const el = document.elementFromPoint(evt.clientX, evt.clientY);
    const item = el && el.closest('.proy-card[data-tipo="proyecto"]');
    limpiarIndicadores();
    if (item && item.getAttribute("data-id") !== touchId) {
      const rect = item.getBoundingClientRect();
      const antes = evt.clientY < rect.top + rect.height / 2;
      item.classList.add(antes ? "proy-drop-antes" : "proy-drop-despues");
    }
  }, { passive: false });
  lista.addEventListener("pointerup", (evt) => {
    clearTimeout(touchTimer);
    if (evt.pointerType !== "touch" || touchId == null) { touchId = null; return; }
    const el = document.elementFromPoint(evt.clientX, evt.clientY);
    const item = el && el.closest('.proy-card[data-tipo="proyecto"]');
    lista.querySelectorAll(".proy-card-arrastrando").forEach((n) => n.classList.remove("proy-card-arrastrando"));
    limpiarIndicadores();
    if (item) {
      const idDestino = item.getAttribute("data-id");
      if (idDestino !== touchId) {
        const rect = item.getBoundingClientRect();
        const antes = evt.clientY < rect.top + rect.height / 2;
        moverEnDOM(touchId, idDestino, antes);
      }
    }
    touchId = null;
  });
  lista.addEventListener("pointercancel", () => {
    clearTimeout(touchTimer);
    touchId = null;
    lista.querySelectorAll(".proy-card-arrastrando").forEach((n) => n.classList.remove("proy-card-arrastrando"));
  });
}

// ---------------------------------------------------------------------------
// Render principal
// ---------------------------------------------------------------------------
function crearOverlaySiHaceFalta() {
  let el = document.getElementById("pantalla-proyectos");
  if (!el) {
    el = document.createElement("div");
    el.id = "pantalla-proyectos";
    el.className = "pantalla-proyectos-overlay";
    el.hidden = true;
    document.body.appendChild(el);
  }
  return el;
}

async function renderPantallaProyectos(permitirCerrar) {
  const overlay = crearOverlaySiHaceFalta();
  await cargarEstadoOrganizacion();

  let lista = [];
  try { lista = await window.idbListarProyectos(); } catch (e) { lista = []; }

  // Fase 3: proyectos donde soy editor (alguien más me los compartió). Los
  // que todavía no tengo localmente se traen y guardan en IndexedDB ahora
  // mismo (primera vez) — los que ya tengo localmente NO se pisan acá, para
  // no perder ediciones locales por encima de lo que hay en Firestore; ese
  // caso ya lo cubre la detección de conflicto al guardar/sincronizar.
  const idsCompartidos = new Set();
  // Mapa {proyectoId: nombre} de quién tiene tomado cada proyecto AHORA MISMO,
  // según lo que dijo Firestore en el momento de armar esta pantalla. A
  // propósito NO se escucha en vivo (nada de fsEscucharCandado por tarjeta):
  // el dato ya viene incluido en las consultas de abajo sin costo extra, y el
  // momento que de verdad importa —abrir el proyecto— vuelve a consultar el
  // candado igual vía fsTomarCandado. El badge es un aviso previo, no la
  // protección; la protección es el candado mismo.
  const candadosAjenosPorProyecto = {};
  const user = window.usuarioActual ? window.usuarioActual() : null;

  function registrarCandadoAjeno(doc) {
    const c = doc && doc.candado;
    if (!c || !c.uid) return;                         // libre
    if (user && c.uid === user.uid) return;           // lo tengo yo: no es aviso
    if (window.candadoEstaVencido && window.candadoEstaVencido(c)) return; // pestaña muerta
    candadosAjenosPorProyecto[doc.id] = c.nombre || "Otra persona";
  }

  if (user && window.fsListarProyectosCompartidosConmigo) {
    try {
      const remotos = await window.fsListarProyectosCompartidosConmigo(user.uid);
      const idsLocales = new Set(lista.map((p) => p.id));
      for (const remoto of remotos) {
        idsCompartidos.add(remoto.id);
        registrarCandadoAjeno(remoto);
        if (idsLocales.has(remoto.id)) continue;
        if (!remoto.payloadJson) continue; // el dueño todavía no guardó nada sincronizable
        try {
          let jsonConImagenes = remoto.payloadJson;
          if (remoto.imagenesUrls && Object.keys(remoto.imagenesUrls).length > 0 && window.fsDescargarImagenesComoJson && window.reinsertarImagenesGrandes) {
            try {
              const imagenesJson = await window.fsDescargarImagenesComoJson(remoto.imagenesUrls);
              jsonConImagenes = window.reinsertarImagenesGrandes(remoto.payloadJson, imagenesJson);
            } catch (e2) {
              console.error("No se pudieron bajar las fotos del proyecto compartido", remoto.id, e2);
            }
          }
          const data = JSON.parse(jsonConImagenes);
          data.id = remoto.id;
          data.guardadoEn = data.guardadoEn || new Date().toISOString();
          data.creadoEn = data.creadoEn || data.guardadoEn;
          await window.idbGuardarProyecto(remoto.id, data);
          // Deja anotada la versión con la que quedó esta copia — evita
          // que detectarSiEsCompartido la vuelva a bajar de una al abrirla
          // por primera vez (ver claveVersionLocal en archivo-estado-app.js).
          if (window.idbGuardarMetaClave) {
            try { await window.idbGuardarMetaClave("fsVersionLocal:" + remoto.id, remoto.version); } catch (e3) {}
          }
          lista.push({ id: remoto.id, data });
        } catch (e) {
          console.error("No se pudo traer el proyecto compartido", remoto.id, e);
        }
      }
    } catch (e) {
      // Sin señal, o simplemente nadie te compartió nada — se sigue normal
      // con lo que ya hay localmente.
    }
  }

  // Mis propios proyectos que YO compartí con alguien: el owner no está en
  // editoresUids, así que la consulta de arriba no los trae. Bloque aparte y
  // con su propio try para que una falla acá no tumbe la lista de compartidos
  // conmigo (ni al revés). Estos ya están en IndexedDB — solo se lee el
  // candado, no se materializa nada.
  if (user && window.fsListarMisProyectosCompartidos) {
    try {
      const mios = await window.fsListarMisProyectosCompartidos(user.uid);
      // Ojo: NO se agregan a idsCompartidos. El badge "Compartido" hoy
      // significa "alguien me compartió esto a mí"; marcarlos acá le
      // cambiaría el significado a "este proyecto está compartido con
      // alguien", que es otra cosa y no se pidió. Solo se lee el candado.
      for (const doc of mios) registrarCandadoAjeno(doc);
    } catch (e) {
      // Sin señal o reglas que no permiten la consulta por ownerId: la
      // pantalla funciona igual, solo sin badge en mis propios proyectos.
    }
  }

  const conNombre = [];
  const borradores = [];
  lista.forEach(({ id, data }) => {
    const tieneNombre = data && data.projectInfo && data.projectInfo.nombre && data.projectInfo.nombre.trim();
    (tieneNombre ? conNombre : borradores).push({ id, data });
  });

  // Si la carpeta activa ya no existe (borrada en otra sesión/dispositivo), volver a raíz.
  if (CARPETA_ACTIVA_ID && !CARPETAS.find(c => c.id === CARPETA_ACTIVA_ID)) CARPETA_ACTIVA_ID = null;
  const carpetaActiva = CARPETA_ACTIVA_ID ? CARPETAS.find(c => c.id === CARPETA_ACTIVA_ID) : null;
  const nivelActual = carpetaActiva ? (carpetaActiva.padreId ? 2 : 1) : 0; // 0 = raíz
  const puedeCrearSubcarpeta = nivelActual < 2; // tope de 2 niveles: adentro de una subcarpeta ya no se puede crear otra

  const proyectosVisibles = CARPETA_ACTIVA_ID
    ? conNombre.filter(p => CARPETA_ASIGNACIONES[p.id] === CARPETA_ACTIVA_ID)
    : conNombre.filter(p => !CARPETA_ASIGNACIONES[p.id]);
  const proyectosOrdenados = ordenarProyectos(proyectosVisibles, MODO_ORDEN, CARPETA_ACTIVA_ID);
  const modoManual = MODO_ORDEN === "manual";

  // Subcarpetas del nivel actual: las que tienen como padre la carpeta activa
  // (en la raíz, CARPETA_ACTIVA_ID es null, así que esto trae las de padreId null).
  const carpetasVisibles = CARPETAS.filter(c => (c.padreId || null) === CARPETA_ACTIVA_ID);
  const carpetasOrdenadas = ordenarCarpetas(carpetasVisibles, MODO_ORDEN);
  borradores.sort((a, b) => new Date(b.data.creadoEn || b.data.guardadoEn || 0) - new Date(a.data.creadoEn || a.data.guardadoEn || 0));

  const breadcrumb = carpetaActiva
    ? `<button type="button" class="proy-breadcrumb" id="proy-btn-volver-carpeta"><svg class="icon"><use href="#i-arrow-left"/></svg>${escapeHtml(carpetaActiva.nombre)}</button>`
    : "";

  const controlOrden = `
    <div class="proy-orden-control">
      <button type="button" class="proy-orden-btn${MODO_ORDEN === "az" ? " active" : ""}" data-orden="az">A-Z</button>
      <button type="button" class="proy-orden-btn${MODO_ORDEN === "reciente" ? " active" : ""}" data-orden="reciente">Reciente</button>
      <button type="button" class="proy-orden-btn${MODO_ORDEN === "manual" ? " active" : ""}" data-orden="manual">Manual</button>
    </div>`;

  const hayAlgoQueMostrar = carpetasOrdenadas.length || proyectosOrdenados.length;
  const seccionProyectos = hayAlgoQueMostrar
    ? `<p class="proy-section-title">${carpetaActiva ? escapeHtml(carpetaActiva.nombre) : "Tus proyectos"}</p>
       ${controlOrden}
       <div class="proy-lista" id="proy-lista-principal">
         ${carpetasOrdenadas.map(c => tarjetaCarpetaHTML(c, conNombre.filter(p => CARPETA_ASIGNACIONES[p.id] === c.id).length)).join("")}
         ${proyectosOrdenados.map(p => tarjetaProyectoHTML(p.id, p.data, false, modoManual, idsCompartidos.has(p.id), candadosAjenosPorProyecto[p.id])).join("")}
       </div>`
    : "";
  const btnNuevaCarpeta = puedeCrearSubcarpeta
    ? `<button type="button" class="proy-btn-nueva-carpeta" id="proy-btn-nueva-carpeta"><svg class="icon"><use href="#i-plus"/></svg>Nueva carpeta</button>`
    : "";
  const seccionBorradores = (!CARPETA_ACTIVA_ID && borradores.length)
    ? `<p class="proy-section-title">Borradores</p><div class="proy-lista">${borradores.map(p => tarjetaProyectoHTML(p.id, p.data, true, false)).join("")}</div>`
    : "";
  const vacio = (!hayAlgoQueMostrar && !borradores.length)
    ? `<div class="proy-vacio"><svg class="icon proy-vacio-icono"><use href="#i-folder"/></svg><p>Todavía no tenés proyectos.<br>Creá el primero con el botón de abajo.</p></div>`
    : "";

  overlay.innerHTML = `
    <div class="proy-header-full">
      <div class="proy-header-full-left">
        ${permitirCerrar
          ? `<button type="button" class="proy-header-icon-btn" id="proy-btn-cerrar" title="Volver" aria-label="Volver"><svg class="icon"><use href="#i-arrow-left"/></svg></button>`
          : `<div class="proy-header-mark-full"><img class="proy-header-mark-logo" src="icons/icon-192.png" alt="Firestop Suite" width="24" height="24" /></div>`}
        <div>
          <p class="proy-header-full-title">Proyectos</p>
          <p class="proy-header-full-sub">Firestop Suite · Superba</p>
        </div>
      </div>
      <button type="button" class="proy-avatar-btn" id="proy-btn-avatar" aria-label="Cuenta">${escapeHtml(window.iniciales && window.usuarioActual ? window.iniciales(window.usuarioActual()) : "?")}</button>
      ${popupCuentaHTML()}
    </div>
    <div class="proy-body-full">
      ${breadcrumb}
      ${seccionProyectos}
      ${btnNuevaCarpeta}
      ${seccionBorradores}
      ${vacio}
    </div>
    <button type="button" class="proy-fab" id="proy-btn-nuevo" aria-label="Nuevo proyecto"><svg class="icon"><use href="#i-plus"/></svg></button>`;

  // --- Tarjetas: click para abrir (proyecto) o navegar (carpeta) ---
  overlay.querySelectorAll('.proy-card[data-tipo="proyecto"]').forEach((card) => {
    card.addEventListener("click", async (e) => {
      if (e.target.closest(".proy-card-borrar") || e.target.closest(".proy-card-mover") || e.target.closest(".proy-card-grip")) return;
      const id = card.getAttribute("data-id");
      const ok = await window.abrirProyectoExistente(id);
      if (ok) {
        ocultarPantallaProyectos();
      } else {
        if (window.mostrarToast) mostrarToast("No se pudo abrir ese proyecto.", "error");
        renderPantallaProyectos(permitirCerrar);
      }
    });
  });
  overlay.querySelectorAll('.proy-card[data-tipo="carpeta"]').forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest(".proy-card-borrar")) return;
      CARPETA_ACTIVA_ID = card.getAttribute("data-id");
      renderPantallaProyectos(permitirCerrar);
    });
  });

  // --- Borrar proyecto o carpeta ---
  overlay.querySelectorAll(".proy-card-borrar").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      const esCarpeta = btn.getAttribute("data-tipo") === "carpeta";
      const hacerBorrado = async () => {
        if (esCarpeta) {
          CARPETAS = CARPETAS
            .filter(c => c.id !== id)
            .map(c => c.padreId === id ? Object.assign({}, c, { padreId: null }) : c);
          Object.keys(CARPETA_ASIGNACIONES).forEach(pid => { if (CARPETA_ASIGNACIONES[pid] === id) delete CARPETA_ASIGNACIONES[pid]; });
          delete ORDEN_MANUAL.porCarpeta[id];
          guardarCarpetas(); guardarAsignaciones(); guardarOrdenManual();
          renderPantallaProyectos(permitirCerrar);
          return;
        }
        try { await window.idbBorrarProyecto(id); } catch (err) { console.error("No se pudo borrar el proyecto:", err); }
        delete CARPETA_ASIGNACIONES[id];
        guardarAsignaciones();
        if (id === window.PROYECTO_ACTIVO_ID) {
          window.PROYECTO_ACTIVO_ID = null;
          if (typeof ROWS !== "undefined") {
            ROWS = []; ROWS_J = []; MANUAL_ITEMS = []; PLANOS = []; INFORMES_ACREDITACION = [];
          }
          renderPantallaProyectos(false);
        } else {
          renderPantallaProyectos(permitirCerrar);
        }
      };
      const mensaje = esCarpeta ? "¿Borrar esta carpeta? Los proyectos y subcarpetas que tenga adentro NO se borran, vuelven a la lista general." : "¿Borrar este proyecto? No se puede deshacer.";
      if (window.pedirConfirmacion) pedirConfirmacion(mensaje, hacerBorrado);
      else if (confirm(mensaje)) hacerBorrado();
    });
  });

  // --- Mover a carpeta ---
  overlay.querySelectorAll(".proy-card-mover").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      abrirModalMoverACarpeta(btn.getAttribute("data-id"));
    });
  });

  // --- Compartir ---
  overlay.querySelectorAll(".proy-card-compartir").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      const proyecto = conNombre.find((p) => p.id === id);
      const nombreProyecto = proyecto && proyecto.data.projectInfo ? proyecto.data.projectInfo.nombre : "";
      abrirModalCompartir(id, nombreProyecto);
    });
  });

  // --- Control de orden ---
  overlay.querySelectorAll(".proy-orden-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      MODO_ORDEN = btn.getAttribute("data-orden");
      guardarModoOrden();
      renderPantallaProyectos(permitirCerrar);
    });
  });

  // --- Nueva carpeta / breadcrumb ---
  const btnNuevaCarpetaEl = document.getElementById("proy-btn-nueva-carpeta");
  if (btnNuevaCarpetaEl) btnNuevaCarpetaEl.addEventListener("click", () => abrirModalNuevaCarpeta(CARPETA_ACTIVA_ID));
  const btnVolverCarpeta = document.getElementById("proy-btn-volver-carpeta");
  if (btnVolverCarpeta) btnVolverCarpeta.addEventListener("click", () => {
    CARPETA_ACTIVA_ID = carpetaActiva ? (carpetaActiva.padreId || null) : null;
    renderPantallaProyectos(permitirCerrar);
  });

  // --- Arrastrar para reordenar (solo en modo Manual) ---
  if (modoManual) {
    const listaPrincipal = document.getElementById("proy-lista-principal");
    if (listaPrincipal) ligarDragReordenarProyectos(listaPrincipal, CARPETA_ACTIVA_ID);
  }

  const btnCerrar = document.getElementById("proy-btn-cerrar");
  if (btnCerrar) btnCerrar.addEventListener("click", ocultarPantallaProyectos);

  document.getElementById("proy-btn-nuevo").addEventListener("click", async () => {
    const nuevoId = await window.crearYAbrirProyectoNuevo();
    if (CARPETA_ACTIVA_ID && nuevoId) {
      CARPETA_ASIGNACIONES[nuevoId] = CARPETA_ACTIVA_ID;
      guardarAsignaciones();
    }
    ocultarPantallaProyectos();
  });

  // --- Popup de cuenta ---
  const btnAvatar = document.getElementById("proy-btn-avatar");
  const popup = document.getElementById("proy-account-popup");
  if (btnAvatar && popup) {
    btnAvatar.addEventListener("click", (e) => {
      e.stopPropagation();
      popup.hidden = !popup.hidden;
    });
    popup.addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("click", () => { popup.hidden = true; });
    conectarBotonesPopup(popup);
  }
}

function ocultarPantallaProyectos() {
  const overlay = document.getElementById("pantalla-proyectos");
  if (!overlay) return;
  overlay.classList.remove("proy-visible");
  setTimeout(() => { overlay.hidden = true; }, 200);
}

async function mostrarPantallaProyectos() {
  // Salir a la lista de Proyectos cuenta como "cerrar" el proyecto que se
  // estaba editando — antes esto NO pasaba (solo se soltaba el candado al
  // abrir OTRO proyecto puntual), así que alguien que volvía a la lista sin
  // abrir nada más se quedaba con el candado pegado, y para el resto de la
  // organización el proyecto seguía viéndose "en edición" indefinidamente
  // (hasta el timeout de 5 min). Bug real reportado por Kevin.
  if (window.soltarCandadoActivoSiHaceFalta) {
    try { await window.soltarCandadoActivoSiHaceFalta(); } catch (e) { /* best-effort */ }
  }
  const hayProyectoAbierto = !!window.PROYECTO_ACTIVO_ID;
  await renderPantallaProyectos(hayProyectoAbierto);
  const overlay = document.getElementById("pantalla-proyectos");
  overlay.hidden = false;
  overlay.offsetHeight; // forzar reflow para que la transición de entrada corra
  overlay.classList.add("proy-visible");
}

// Refresca solo el popup de cuenta (llamado desde firebase-auth.js tras
// editar el perfil), sin re-renderizar toda la lista de proyectos. Actualiza
// el innerHTML del MISMO nodo (nunca outerHTML) para no invalidar el
// listener del botón de avatar, que sigue apuntando a este elemento.
function actualizarCuentaProyectos() {
  const overlay = document.getElementById("pantalla-proyectos");
  if (!overlay || overlay.hidden) return;
  const avatarBtn = document.getElementById("proy-btn-avatar");
  const popup = document.getElementById("proy-account-popup");
  if (avatarBtn && window.usuarioActual && window.iniciales) {
    avatarBtn.textContent = window.iniciales(window.usuarioActual());
  }
  if (popup) {
    popup.innerHTML = popupCuentaContenidoHTML();
    conectarBotonesPopup(popup);
  }
}

window.mostrarPantallaProyectos = mostrarPantallaProyectos;
window.ocultarPantallaProyectos = ocultarPantallaProyectos;
window.actualizarCuentaProyectos = actualizarCuentaProyectos;

})();
