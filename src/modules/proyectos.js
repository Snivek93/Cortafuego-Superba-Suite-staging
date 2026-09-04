// ============================================================================
// proyectos.js — Pantalla de Proyectos (pantalla completa, multi-proyecto,
// carpetas + orden manual/A-Z/reciente)
// ============================================================================
// Depende de funciones expuestas por archivo-estado-app.js:
// idbListarProyectos, idbBorrarProyecto, abrirProyectoExistente,
// crearYAbrirProyectoNuevo, idbGuardarMetaClave, idbLeerMetaClave,
// PROYECTO_ACTIVO_ID — y de firebase-auth.js: usuarioActual, iniciales,
// abrirEditarPerfil, cerrarSesion.
(function () {

let CARPETAS = [];
let CARPETA_ASIGNACIONES = {};
let ORDEN_MANUAL = { raiz: [], porCarpeta: {} };
let MODO_ORDEN = "manual";
let CARPETA_ACTIVA_ID = null;
let ESPACIOS = [];
let ESPACIO_ACTIVO_ID = null;
let INVITACIONES_ESPACIO = [];

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

async function cargarEstadoOrganizacion() {
  try { CARPETAS = (await window.idbLeerMetaClave("carpetas")) || []; } catch (e) { CARPETAS = []; }
  try { CARPETA_ASIGNACIONES = (await window.idbLeerMetaClave("carpetaAsignaciones")) || {}; } catch (e) { CARPETA_ASIGNACIONES = {}; }
  try { ORDEN_MANUAL = (await window.idbLeerMetaClave("ordenManual")) || { raiz: [], porCarpeta: {} }; } catch (e) { ORDEN_MANUAL = { raiz: [], porCarpeta: {} }; }
  if (!ORDEN_MANUAL.porCarpeta) ORDEN_MANUAL.porCarpeta = {};
  try {
    const modoGuardado = await window.idbLeerMetaClave("modoOrden");
    MODO_ORDEN = modoGuardado || "manual";
  } catch (e) { MODO_ORDEN = "manual"; }

  const user = window.usuarioActual ? window.usuarioActual() : null;
  ESPACIOS = [];
  if (user && window.fsListarMisEspacios) {
    try { ESPACIOS = await window.fsListarMisEspacios(user.uid); } catch (e) { ESPACIOS = []; }
  }
  try {
    const espacioGuardado = await window.idbLeerMetaClave("espacioActivoId");
    ESPACIO_ACTIVO_ID = espacioGuardado || null;
  } catch (e) { ESPACIO_ACTIVO_ID = null; }
  if (ESPACIO_ACTIVO_ID && !ESPACIOS.find((e) => e.id === ESPACIO_ACTIVO_ID)) ESPACIO_ACTIVO_ID = null;
  INVITACIONES_ESPACIO = [];
  if (user && user.email && window.fsListarInvitacionesPendientes) {
    try { INVITACIONES_ESPACIO = await window.fsListarInvitacionesPendientes(user.email); } catch (e) { INVITACIONES_ESPACIO = []; }
  }
}
function guardarCarpetas() { window.idbGuardarMetaClave && window.idbGuardarMetaClave("carpetas", CARPETAS).catch(() => {}); }
function guardarAsignaciones() { window.idbGuardarMetaClave && window.idbGuardarMetaClave("carpetaAsignaciones", CARPETA_ASIGNACIONES).catch(() => {}); }
function guardarOrdenManual() { window.idbGuardarMetaClave && window.idbGuardarMetaClave("ordenManual", ORDEN_MANUAL).catch(() => {}); }
function guardarModoOrden() { window.idbGuardarMetaClave && window.idbGuardarMetaClave("modoOrden", MODO_ORDEN).catch(() => {}); }
function guardarEspacioActivo() { window.idbGuardarMetaClave && window.idbGuardarMetaClave("espacioActivoId", ESPACIO_ACTIVO_ID).catch(() => {}); }

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

function tarjetaProyectoHTML(id, data, esBorrador, modoManual, esCompartido, candadoAjeno, esDueno, soloLectura) {
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
        <p class="proy-card-nombre">${escapeHtml(nombre)}${soloLectura ? `<span class="badge-manual">Solo lectura</span>` : (esCompartido ? `<span class="badge-manual">Compartido</span>` : "")}</p>
        <p class="proy-card-sub">${escapeHtml(sub)}</p>
        ${candadoAjeno ? `<p class="proy-card-candado"><svg class="icon"><use href="#i-lock"/></svg>${escapeHtml(candadoAjeno)} está editando</p>` : ""}
      </div>
      <div class="proy-card-right">
        ${!esBorrador ? `<button type="button" class="proy-card-compartir" data-id="${escapeHtml(id)}" title="Compartir" aria-label="Compartir"><svg class="icon"><use href="#i-share"/></svg></button>` : ""}
        ${!esBorrador ? `<button type="button" class="proy-card-mover" data-id="${escapeHtml(id)}" title="Mover a carpeta" aria-label="Mover a carpeta"><svg class="icon"><use href="#i-folder"/></svg></button>` : ""}
        ${(!esBorrador && esDueno) ? `<button type="button" class="proy-card-mover-espacio" data-id="${escapeHtml(id)}" ${candadoAjeno ? "disabled" : ""} title="${candadoAjeno ? "Bloqueado: alguien lo está editando" : "Mover de espacio"}" aria-label="Mover de espacio"><svg class="icon"><use href="#i-share"/></svg></button>` : ""}
        <button type="button" class="proy-card-borrar" data-id="${escapeHtml(id)}" data-propio="${esCompartido ? "0" : "1"}" title="Borrar proyecto" aria-label="Borrar proyecto">
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

function abrirModalCrearEspacio() {
  const user = window.usuarioActual ? window.usuarioActual() : null;
  if (!user || !window.fsCrearEspacio) {
    if (window.mostrarToast) mostrarToast("Espacios todavía no está disponible en esta versión.", "error");
    return;
  }
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box">
      <p style="font-weight:600;margin:0 0 4px;">Crear espacio</p>
      <p style="font-size:var(--fs-sm);color:var(--text-muted);margin:0 0 12px;">Todos los que invites van a ver todos los proyectos de este espacio.</p>
      <input type="text" id="proy-crear-espacio-nombre" placeholder="Superba SC" style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:var(--fs-base);margin-bottom:4px;" />
      <p class="auth-error" id="proy-crear-espacio-error" style="display:none;"></p>
      <div class="modal-actions">
        <button class="secondary" data-act="cancel">Cancelar</button>
        <button class="primary" data-act="crear">Crear</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const input = document.getElementById("proy-crear-espacio-nombre");
  input.focus();
  const crear = async () => {
    const nombre = input.value.trim();
    const errorEl = document.getElementById("proy-crear-espacio-error");
    if (!nombre) {
      errorEl.textContent = "Ingresá un nombre.";
      errorEl.style.display = "block";
      return;
    }
    const btn = overlay.querySelector('[data-act="crear"]');
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = "Un momento…";
    try {
      const id = await window.fsCrearEspacio(nombre, user.uid);
      ESPACIOS.push({ id, nombre, miembrosUids: [user.uid], creadoPor: user.uid });
      ESPACIO_ACTIVO_ID = id;
      guardarEspacioActivo();
      overlay.remove();
      renderPantallaProyectos(!!window.PROYECTO_ACTIVO_ID);
    } catch (e) {
      errorEl.textContent = e && e.message ? e.message : "No se pudo crear. Revisá tu conexión y probá de nuevo.";
      errorEl.style.display = "block";
      btn.disabled = false;
      btn.textContent = original;
    }
  };
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") crear(); });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay || e.target.dataset.act === "cancel") { overlay.remove(); return; }
    if (e.target.dataset.act === "crear") crear();
  });
}

function abrirModalInvitarEspacio(espacioId, nombreEspacio) {
  const user = window.usuarioActual ? window.usuarioActual() : null;
  if (!user || !window.fsInvitarAEspacio) {
    if (window.mostrarToast) mostrarToast("Invitar todavía no está disponible en esta versión.", "error");
    return;
  }
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box">
      <p style="font-weight:600;margin:0 0 4px;">Invitar a ${escapeHtml(nombreEspacio || "espacio")}</p>
      <p style="font-size:var(--fs-sm);color:var(--text-muted);margin:0 0 12px;">La persona necesita cuenta en Firestop Suite con este correo.</p>
      <input type="email" id="proy-invitar-espacio-email" placeholder="correo@superba.cr" style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:var(--fs-base);margin-bottom:4px;" />
      <p class="auth-error" id="proy-invitar-espacio-error" style="display:none;"></p>
      <div class="modal-actions">
        <button class="secondary" data-act="cancel">Cerrar</button>
        <button class="primary" data-act="invitar">Invitar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const input = document.getElementById("proy-invitar-espacio-email");
  input.focus();
  const invitar = async () => {
    const email = input.value.trim().toLowerCase();
    const errorEl = document.getElementById("proy-invitar-espacio-error");
    if (!email || !email.includes("@")) {
      errorEl.textContent = "Ingresá un correo válido.";
      errorEl.style.display = "block";
      return;
    }
    const btn = overlay.querySelector('[data-act="invitar"]');
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = "Un momento…";
    try {
      await window.fsInvitarAEspacio(espacioId, nombreEspacio || "", email, user.email || "");
      overlay.remove();
      if (window.mostrarToast) mostrarToast(`Invitación enviada a ${email}.`);
    } catch (e) {
      errorEl.textContent = e && e.message ? e.message : "No se pudo invitar. Revisá tu conexión y probá de nuevo.";
      errorEl.style.display = "block";
      btn.disabled = false;
      btn.textContent = original;
    }
  };
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") invitar(); });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay || e.target.dataset.act === "cancel") { overlay.remove(); return; }
    if (e.target.dataset.act === "invitar") invitar();
  });
}

function abrirModalInvitacionesPendientes() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  const filas = INVITACIONES_ESPACIO.length
    ? INVITACIONES_ESPACIO.map((inv) => `
        <div class="invitacion-espacio-fila">
          <div><p class="invitacion-espacio-nombre">${escapeHtml(inv.nombreEspacio || "Espacio")}</p><p class="invitacion-espacio-sub">Invitado por ${escapeHtml(inv.invitadoPor || "")}</p></div>
        </div>`).join("")
    : `<p style="font-size:var(--fs-sm);color:var(--text-muted);">No tenés invitaciones pendientes.</p>`;
  overlay.innerHTML = `
    <div class="modal-box">
      <p style="font-weight:600;margin:0 0 12px;">Invitaciones pendientes</p>
      ${filas}
      <p class="auth-error" id="proy-invitaciones-error" style="display:none;"></p>
      <div class="modal-actions">
        <button class="secondary" data-act="cancel">Cerrar</button>
        ${INVITACIONES_ESPACIO.length ? `<button class="primary" data-act="unirme">Unirme a todas</button>` : ""}
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", async (e) => {
    if (e.target === overlay || e.target.dataset.act === "cancel") { overlay.remove(); return; }
    if (e.target.dataset.act === "unirme") {
      const btn = e.target;
      btn.disabled = true;
      const original = btn.textContent;
      btn.textContent = "Un momento…";
      try {
        await window.fsAceptarInvitacionesEspacio();
        overlay.remove();
        await cargarEstadoOrganizacion();
        renderPantallaProyectos(!!window.PROYECTO_ACTIVO_ID);
        if (window.mostrarToast) mostrarToast("Listo, ya sos parte del espacio.");
      } catch (err) {
        const errorEl = document.getElementById("proy-invitaciones-error");
        errorEl.textContent = err && err.message ? err.message : "No se pudo unir. Probá de nuevo.";
        errorEl.style.display = "block";
        btn.disabled = false;
        btn.textContent = original;
      }
    }
  });
}

function abrirModalMoverDeEspacio(proyectoId) {
  if (!window.fsMoverProyectoDeEspacio) {
    if (window.mostrarToast) mostrarToast("Mover de espacio todavía no está disponible en esta versión.", "error");
    return;
  }
  const opciones = [{ label: "Propio", act: "espacio:" }];
  ESPACIOS.forEach((e) => opciones.push({ label: e.nombre || "Sin nombre", act: "espacio:" + e.id }));
  opciones.push({ label: "Cancelar", act: "cancelar" });
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  const botones = opciones.map((o) => `<button class="secondary" data-act="${o.act}">${escapeHtml(o.label)}</button>`).join("");
  overlay.innerHTML = `
    <div class="modal-box">
      <p style="font-weight:600;margin:0 0 12px;">Mover de espacio</p>
      <div class="modal-actions" style="flex-direction:column;align-items:stretch;">${botones}</div>
      <p class="auth-error" id="proy-mover-espacio-error" style="display:none;margin-top:8px;"></p>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", async (e) => {
    if (e.target === overlay) { overlay.remove(); return; }
    const act = e.target.dataset.act;
    if (!act) return;
    if (act === "cancelar") { overlay.remove(); return; }
    if (!act.startsWith("espacio:")) return;
    const nuevoEspacioId = act.slice(8) || null;
    e.target.disabled = true;
    try {
      await window.fsMoverProyectoDeEspacio(proyectoId, nuevoEspacioId);
      overlay.remove();
      renderPantallaProyectos(!!window.PROYECTO_ACTIVO_ID);
    } catch (err) {
      const errorEl = document.getElementById("proy-mover-espacio-error");
      errorEl.textContent = err && err.message ? err.message : "No se pudo mover. Probá de nuevo.";
      errorEl.style.display = "block";
      e.target.disabled = false;
    }
  });
}

function abrirModalRenombrarEspacio(espacioId, nombreActual) {
  if (!window.fsRenombrarEspacio) {
    if (window.mostrarToast) mostrarToast("Renombrar todavía no está disponible en esta versión.", "error");
    return;
  }
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box">
      <p style="font-weight:600;margin:0 0 12px;">Renombrar espacio</p>
      <input type="text" id="proy-renombrar-espacio-nombre" value="${escapeHtml(nombreActual || "")}" style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:var(--fs-base);margin-bottom:4px;" />
      <p class="auth-error" id="proy-renombrar-espacio-error" style="display:none;"></p>
      <div class="modal-actions">
        <button class="secondary" data-act="cancel">Cancelar</button>
        <button class="primary" data-act="guardar">Guardar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const input = document.getElementById("proy-renombrar-espacio-nombre");
  input.focus();
  input.select();
  const guardar = async () => {
    const nombre = input.value.trim();
    const errorEl = document.getElementById("proy-renombrar-espacio-error");
    if (!nombre) {
      errorEl.textContent = "Ingresá un nombre.";
      errorEl.style.display = "block";
      return;
    }
    const btn = overlay.querySelector('[data-act="guardar"]');
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = "Un momento…";
    try {
      await window.fsRenombrarEspacio(espacioId, nombre);
      const e = ESPACIOS.find((x) => x.id === espacioId);
      if (e) e.nombre = nombre;
      overlay.remove();
      renderPantallaProyectos(!!window.PROYECTO_ACTIVO_ID);
    } catch (e) {
      errorEl.textContent = e && e.message ? e.message : "No se pudo renombrar. Revisá tu conexión y probá de nuevo.";
      errorEl.style.display = "block";
      btn.disabled = false;
      btn.textContent = original;
    }
  };
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") guardar(); });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay || e.target.dataset.act === "cancel") { overlay.remove(); return; }
    if (e.target.dataset.act === "guardar") guardar();
  });
}

function confirmarBorrarEspacio(espacioId, nombre) {
  if (!window.fsBorrarEspacio) {
    if (window.mostrarToast) mostrarToast("Borrar espacio todavía no está disponible en esta versión.", "error");
    return;
  }
  const mensaje = `¿Borrar el espacio "${nombre || "Sin nombre"}"? Sus proyectos NO se borran, vuelven a "Propio" del dueño de cada uno. No se puede deshacer.`;
  const hacer = async () => {
    try {
      await window.fsBorrarEspacio(espacioId);
      ESPACIOS = ESPACIOS.filter((e) => e.id !== espacioId);
      ESPACIO_ACTIVO_ID = null;
      guardarEspacioActivo();
      renderPantallaProyectos(!!window.PROYECTO_ACTIVO_ID);
      if (window.mostrarToast) mostrarToast("Espacio borrado.");
    } catch (e) {
      if (window.mostrarToast) mostrarToast("No se pudo borrar el espacio: " + (e && e.message ? e.message : "revisá tu conexión."), "error");
    }
  };
  if (window.pedirConfirmacion) pedirConfirmacion(mensaje, hacer);
  else if (confirm(mensaje)) hacer();
}

function confirmarSalirDeEspacio(espacioId, nombre) {
  const user = window.usuarioActual ? window.usuarioActual() : null;
  if (!user || !window.fsSalirDeEspacio) {
    if (window.mostrarToast) mostrarToast("Salir de un espacio todavía no está disponible en esta versión.", "error");
    return;
  }
  const mensaje = `¿Salir de "${nombre || "Sin nombre"}"? Vas a dejar de ver sus proyectos hasta que te vuelvan a invitar.`;
  const hacer = async () => {
    try {
      await window.fsSalirDeEspacio(espacioId, user.uid);
      ESPACIOS = ESPACIOS.filter((e) => e.id !== espacioId);
      ESPACIO_ACTIVO_ID = null;
      guardarEspacioActivo();
      renderPantallaProyectos(!!window.PROYECTO_ACTIVO_ID);
      if (window.mostrarToast) mostrarToast("Saliste del espacio.");
    } catch (e) {
      if (window.mostrarToast) mostrarToast("No se pudo salir del espacio: " + (e && e.message ? e.message : "revisá tu conexión."), "error");
    }
  };
  if (window.pedirConfirmacion) pedirConfirmacion(mensaje, hacer);
  else if (confirm(mensaje)) hacer();
}

function dropdownEspacioHTML() {
  const user = window.usuarioActual ? window.usuarioActual() : null;
  if (!user) return "";
  const itemPropio = `<button type="button" class="dropdown-item${!ESPACIO_ACTIVO_ID ? " dropdown-item-activo" : ""}" data-espacio-id="">
      <svg class="icon"><use href="#i-home"/></svg>Propio${!ESPACIO_ACTIVO_ID ? `<svg class="icon icon-check"><use href="#i-check"/></svg>` : ""}
    </button>`;
  const itemsEspacios = ESPACIOS.map((e) => `<button type="button" class="dropdown-item${ESPACIO_ACTIVO_ID === e.id ? " dropdown-item-activo" : ""}" data-espacio-id="${escapeHtml(e.id)}">
      <svg class="icon"><use href="#i-share"/></svg>${escapeHtml(e.nombre || "Sin nombre")}${ESPACIO_ACTIVO_ID === e.id ? `<svg class="icon icon-check"><use href="#i-check"/></svg>` : ""}
    </button>`).join("");
  const badgeInvitaciones = INVITACIONES_ESPACIO.length ? `<span class="badge-invitacion">${INVITACIONES_ESPACIO.length}</span>` : "";
  const espacioActivo = ESPACIO_ACTIVO_ID ? ESPACIOS.find((e) => e.id === ESPACIO_ACTIVO_ID) : null;
  const esCreadorDelActivo = !!(espacioActivo && espacioActivo.creadoPor === user.uid);
  const btnInvitar = ESPACIO_ACTIVO_ID
    ? `<button type="button" class="dropdown-item" id="proy-btn-invitar-espacio"><svg class="icon"><use href="#i-share"/></svg>Invitar a este espacio</button>`
    : "";
  const btnRenombrar = ESPACIO_ACTIVO_ID
    ? `<button type="button" class="dropdown-item" id="proy-btn-renombrar-espacio"><svg class="icon"><use href="#i-edit"/></svg>Renombrar espacio</button>`
    : "";
  const btnBorrarOSalir = !ESPACIO_ACTIVO_ID ? "" : (esCreadorDelActivo
    ? `<button type="button" class="dropdown-item" id="proy-btn-borrar-espacio"><svg class="icon"><use href="#i-trash"/></svg>Borrar espacio</button>`
    : `<button type="button" class="dropdown-item" id="proy-btn-salir-espacio"><svg class="icon"><use href="#i-close"/></svg>Salir del espacio</button>`);
  return `<div class="dropdown-panel" id="proy-espacio-dropdown">
      <p class="dropdown-section-title">Tus espacios</p>
      ${itemPropio}
      ${itemsEspacios}
      <div class="dropdown-sep"></div>
      <button type="button" class="dropdown-item" id="proy-btn-crear-espacio"><svg class="icon"><use href="#i-plus"/></svg>Crear espacio</button>
      <button type="button" class="dropdown-item" id="proy-btn-invitaciones-espacio"><svg class="icon"><use href="#i-clipboard-list"/></svg>Invitaciones pendientes${badgeInvitaciones}</button>
      ${btnInvitar}
      ${btnRenombrar}
      ${btnBorrarOSalir}
    </div>`;
}

function abrirModalCompartir(proyectoId, nombreProyecto, clienteProyecto, fechaProyecto) {
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
      await window.fsAsegurarProyecto(proyectoId, { nombre: nombreProyecto, cliente: clienteProyecto, fecha: fechaProyecto, ownerId: user.uid, ownerEmail: user.email || "" });
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

  const idsCompartidos = new Set();
  const candadosAjenosPorProyecto = {};
  const user = window.usuarioActual ? window.usuarioActual() : null;
  const espacioIdConocido = {};
  // {proyectoId: boolean} — true si YO puedo editar (dueño o editoresUids).
  // Ver un proyecto por pertenecer a un espacio NO da permiso de edición
  // por sí solo — eso lo decide el dueño del proyecto puntualmente (ver
  // detectarSiEsCompartido en archivo-estado-app.js, misma regla).
  const permisoEdicionConocido = {};

  function registrarCandadoAjeno(doc) {
    const c = doc && doc.candado;
    if (!c || !c.uid) return;
    if (user && c.uid === user.uid) return;
    if (window.candadoEstaVencido && window.candadoEstaVencido(c)) return;
    candadosAjenosPorProyecto[doc.id] = c.nombre || "Otra persona";
  }

  if (user && window.fsListarProyectosCompartidosConmigo) {
    try {
      if (window.invitacionesResueltas) {
        await Promise.race([
          window.invitacionesResueltas(),
          new Promise((r) => setTimeout(r, 4000)),
        ]);
      }
      const remotos = await window.fsListarProyectosCompartidosConmigo(user.uid);
      const idsLocales = new Set(lista.map((p) => p.id));
      for (const remoto of remotos) {
        idsCompartidos.add(remoto.id);
        espacioIdConocido[remoto.id] = remoto.espacioId || null;
        permisoEdicionConocido[remoto.id] = true; // llegó acá vía editoresUids array-contains: por definición puede editar
        registrarCandadoAjeno(remoto);
        if (idsLocales.has(remoto.id)) continue;
        if (!remoto.payloadJson) continue;
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
          if (window.idbGuardarMetaClave) {
            try { await window.idbGuardarMetaClave("fsVersionLocal:" + remoto.id, remoto.version); } catch (e3) {}
          }
          lista.push({ id: remoto.id, data });
        } catch (e) {
          console.error("No se pudo traer el proyecto compartido", remoto.id, e);
        }
      }
    } catch (e) {
    }
  }

  if (user && window.fsListarMisProyectosCompartidos) {
    try {
      const mios = await window.fsListarMisProyectosCompartidos(user.uid);
      for (const doc of mios) { registrarCandadoAjeno(doc); espacioIdConocido[doc.id] = doc.espacioId || null; permisoEdicionConocido[doc.id] = true; }
    } catch (e) {
    }
  }

  if (ESPACIO_ACTIVO_ID && window.fsListarProyectosDeEspacio) {
    try {
      const deEspacio = await window.fsListarProyectosDeEspacio(ESPACIO_ACTIVO_ID);
      const idsLocalesEspacio = new Set(lista.map((p) => p.id));
      for (const doc of deEspacio) {
        espacioIdConocido[doc.id] = ESPACIO_ACTIVO_ID;
        registrarCandadoAjeno(doc);
        const esDuenoDeEste = !!(user && doc.ownerId === user.uid);
        if (!esDuenoDeEste) idsCompartidos.add(doc.id);
        permisoEdicionConocido[doc.id] = esDuenoDeEste || (Array.isArray(doc.editoresUids) && !!user && doc.editoresUids.includes(user.uid));
        if (idsLocalesEspacio.has(doc.id)) continue;
        if (!doc.payloadJson) continue;
        try {
          let jsonConImagenes = doc.payloadJson;
          if (doc.imagenesUrls && Object.keys(doc.imagenesUrls).length > 0 && window.fsDescargarImagenesComoJson && window.reinsertarImagenesGrandes) {
            try {
              const imagenesJson = await window.fsDescargarImagenesComoJson(doc.imagenesUrls);
              jsonConImagenes = window.reinsertarImagenesGrandes(doc.payloadJson, imagenesJson);
            } catch (e2) {
              console.error("No se pudieron bajar las fotos de un proyecto del espacio", doc.id, e2);
            }
          }
          const data = JSON.parse(jsonConImagenes);
          data.id = doc.id;
          data.guardadoEn = data.guardadoEn || new Date().toISOString();
          data.creadoEn = data.creadoEn || data.guardadoEn;
          await window.idbGuardarProyecto(doc.id, data);
          if (window.idbGuardarMetaClave) {
            try { await window.idbGuardarMetaClave("fsVersionLocal:" + doc.id, doc.version); } catch (e3) {}
          }
          lista.push({ id: doc.id, data });
        } catch (e) {
          console.error("No se pudo traer un proyecto del espacio", doc.id, e);
        }
      }
    } catch (e) {
    }
  }

  const conNombreTodos = [];
  const borradoresTodos = [];
  lista.forEach(({ id, data }) => {
    const tieneNombre = data && data.projectInfo && data.projectInfo.nombre && data.projectInfo.nombre.trim();
    (tieneNombre ? conNombreTodos : borradoresTodos).push({ id, data });
  });
  const conNombre = ESPACIO_ACTIVO_ID
    ? conNombreTodos.filter((p) => espacioIdConocido[p.id] === ESPACIO_ACTIVO_ID)
    : conNombreTodos.filter((p) => (espacioIdConocido[p.id] || null) === null);
  const borradores = ESPACIO_ACTIVO_ID ? [] : borradoresTodos;

  if (CARPETA_ACTIVA_ID && !CARPETAS.find(c => c.id === CARPETA_ACTIVA_ID)) CARPETA_ACTIVA_ID = null;
  const carpetaActiva = CARPETA_ACTIVA_ID ? CARPETAS.find(c => c.id === CARPETA_ACTIVA_ID) : null;
  const nivelActual = carpetaActiva ? (carpetaActiva.padreId ? 2 : 1) : 0;
  const puedeCrearSubcarpeta = nivelActual < 2;

  const proyectosVisibles = CARPETA_ACTIVA_ID
    ? conNombre.filter(p => CARPETA_ASIGNACIONES[p.id] === CARPETA_ACTIVA_ID)
    : conNombre.filter(p => !CARPETA_ASIGNACIONES[p.id]);
  const proyectosOrdenados = ordenarProyectos(proyectosVisibles, MODO_ORDEN, CARPETA_ACTIVA_ID);
  const modoManual = MODO_ORDEN === "manual";

  const carpetasVisibles = CARPETAS.filter(c => (c.padreId || null) === CARPETA_ACTIVA_ID);
  const carpetasOrdenadas = ordenarCarpetas(carpetasVisibles, MODO_ORDEN);
  borradores.sort((a, b) => new Date(b.data.creadoEn || b.data.guardadoEn || 0) - new Date(a.data.creadoEn || a.data.guardadoEn || 0));

  const nombreEspacioActivo = ESPACIO_ACTIVO_ID
    ? ((ESPACIOS.find((e) => e.id === ESPACIO_ACTIVO_ID) || {}).nombre || "Espacio")
    : "Propio";
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
         ${proyectosOrdenados.map(p => tarjetaProyectoHTML(p.id, p.data, false, modoManual, idsCompartidos.has(p.id), candadosAjenosPorProyecto[p.id], !idsCompartidos.has(p.id), permisoEdicionConocido[p.id] === false)).join("")}
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
        <button type="button" class="espacio-selector-btn" id="proy-btn-espacio-selector" aria-label="Cambiar espacio">
          <div>
            <p class="proy-header-full-title">${escapeHtml(nombreEspacioActivo)}<svg class="icon icon-chevron-down"><use href="#i-chevron-down"/></svg></p>
            <p class="proy-header-full-sub">Firestop Suite · Superba</p>
          </div>
        </button>
      </div>
      <button type="button" class="proy-avatar-btn" id="proy-btn-avatar" aria-label="Cuenta">${escapeHtml(window.iniciales && window.usuarioActual ? window.iniciales(window.usuarioActual()) : "?")}</button>
      ${dropdownEspacioHTML()}
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

  overlay.querySelectorAll(".proy-card-borrar").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      const esCarpeta = btn.getAttribute("data-tipo") === "carpeta";
      const esPropio = btn.getAttribute("data-propio") !== "0";
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
        const user = window.usuarioActual ? window.usuarioActual() : null;
        if (user) {
          try {
            if (esPropio) {
              if (window.fsBorrarProyectoDeNube) await window.fsBorrarProyectoDeNube(id);
              if (window.fsBorrarFotosDeProyecto) await window.fsBorrarFotosDeProyecto(id);
            } else {
              if (window.fsQuitarAcceso) await window.fsQuitarAcceso(id, user.uid);
            }
          } catch (err) {
            console.error("No se pudo borrar/quitar acceso en la nube:", err);
            if (window.mostrarToast) mostrarToast("Se borró en este dispositivo. Revisá tu conexión: puede tardar en desaparecer de la nube.", "error");
          }
        }
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
      const mensaje = esCarpeta
        ? "¿Borrar esta carpeta? Los proyectos y subcarpetas que tenga adentro NO se borran, vuelven a la lista general."
        : (esPropio
            ? "¿Borrar este proyecto? Se borra también de la nube y de todos tus dispositivos. No se puede deshacer."
            : "Vas a dejar de ver este proyecto (lo compartieron con vos). La persona dueña lo conserva. ¿Continuar?");
      if (window.pedirConfirmacion) pedirConfirmacion(mensaje, hacerBorrado);
      else if (confirm(mensaje)) hacerBorrado();
    });
  });

  overlay.querySelectorAll(".proy-card-mover").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      abrirModalMoverACarpeta(btn.getAttribute("data-id"));
    });
  });

  overlay.querySelectorAll(".proy-card-mover-espacio").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (btn.disabled) return;
      abrirModalMoverDeEspacio(btn.getAttribute("data-id"));
    });
  });

  overlay.querySelectorAll(".proy-card-compartir").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      const proyecto = conNombre.find((p) => p.id === id);
      const info = proyecto && proyecto.data.projectInfo;
      abrirModalCompartir(id, info && info.nombre, info && info.cliente, info && info.fecha);
    });
  });

  overlay.querySelectorAll(".proy-orden-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      MODO_ORDEN = btn.getAttribute("data-orden");
      guardarModoOrden();
      renderPantallaProyectos(permitirCerrar);
    });
  });

  const btnNuevaCarpetaEl = document.getElementById("proy-btn-nueva-carpeta");
  if (btnNuevaCarpetaEl) btnNuevaCarpetaEl.addEventListener("click", () => abrirModalNuevaCarpeta(CARPETA_ACTIVA_ID));
  const btnVolverCarpeta = document.getElementById("proy-btn-volver-carpeta");
  if (btnVolverCarpeta) btnVolverCarpeta.addEventListener("click", () => {
    CARPETA_ACTIVA_ID = carpetaActiva ? (carpetaActiva.padreId || null) : null;
    renderPantallaProyectos(permitirCerrar);
  });

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

  const btnEspacioSelector = document.getElementById("proy-btn-espacio-selector");
  const dropdownEspacio = document.getElementById("proy-espacio-dropdown");
  if (btnEspacioSelector && dropdownEspacio) {
    btnEspacioSelector.addEventListener("click", (e) => {
      e.stopPropagation();
      const yaAbierto = dropdownEspacio.classList.contains("open");
      document.querySelectorAll(".dropdown-panel.open").forEach((p) => p.classList.remove("open"));
      if (!yaAbierto) {
        const r = btnEspacioSelector.getBoundingClientRect();
        dropdownEspacio.style.left = r.left + "px";
        dropdownEspacio.style.top = (r.bottom + 6) + "px";
        dropdownEspacio.classList.add("open");
      }
    });
    dropdownEspacio.addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("click", () => { dropdownEspacio.classList.remove("open"); });
    dropdownEspacio.querySelectorAll("[data-espacio-id]").forEach((btnItem) => {
      btnItem.addEventListener("click", () => {
        const nuevoId = btnItem.getAttribute("data-espacio-id") || null;
        if (nuevoId === ESPACIO_ACTIVO_ID) { dropdownEspacio.classList.remove("open"); return; }
        ESPACIO_ACTIVO_ID = nuevoId;
        guardarEspacioActivo();
        CARPETA_ACTIVA_ID = null;
        renderPantallaProyectos(permitirCerrar);
      });
    });
    const btnCrearEspacio = document.getElementById("proy-btn-crear-espacio");
    if (btnCrearEspacio) btnCrearEspacio.addEventListener("click", () => { dropdownEspacio.classList.remove("open"); abrirModalCrearEspacio(); });
    const btnInvitaciones = document.getElementById("proy-btn-invitaciones-espacio");
    if (btnInvitaciones) btnInvitaciones.addEventListener("click", () => { dropdownEspacio.classList.remove("open"); abrirModalInvitacionesPendientes(); });
    const btnInvitarEspacio = document.getElementById("proy-btn-invitar-espacio");
    if (btnInvitarEspacio) btnInvitarEspacio.addEventListener("click", () => {
      dropdownEspacio.classList.remove("open");
      const activo = ESPACIOS.find((e) => e.id === ESPACIO_ACTIVO_ID);
      abrirModalInvitarEspacio(ESPACIO_ACTIVO_ID, activo && activo.nombre);
    });
    const btnRenombrarEspacio = document.getElementById("proy-btn-renombrar-espacio");
    if (btnRenombrarEspacio) btnRenombrarEspacio.addEventListener("click", () => {
      dropdownEspacio.classList.remove("open");
      const activo = ESPACIOS.find((e) => e.id === ESPACIO_ACTIVO_ID);
      abrirModalRenombrarEspacio(ESPACIO_ACTIVO_ID, activo && activo.nombre);
    });
    const btnBorrarEspacio = document.getElementById("proy-btn-borrar-espacio");
    if (btnBorrarEspacio) btnBorrarEspacio.addEventListener("click", () => {
      dropdownEspacio.classList.remove("open");
      const activo = ESPACIOS.find((e) => e.id === ESPACIO_ACTIVO_ID);
      confirmarBorrarEspacio(ESPACIO_ACTIVO_ID, activo && activo.nombre);
    });
    const btnSalirEspacio = document.getElementById("proy-btn-salir-espacio");
    if (btnSalirEspacio) btnSalirEspacio.addEventListener("click", () => {
      dropdownEspacio.classList.remove("open");
      const activo = ESPACIOS.find((e) => e.id === ESPACIO_ACTIVO_ID);
      confirmarSalirDeEspacio(ESPACIO_ACTIVO_ID, activo && activo.nombre);
    });
  }

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
  if (window.mostrarVistaProyecto) window.mostrarVistaProyecto();
}

async function mostrarPantallaProyectos() {
  if (window.soltarCandadoActivoSiHaceFalta) {
    window.soltarCandadoActivoSiHaceFalta();
  }
  const hayProyectoAbierto = !!window.PROYECTO_ACTIVO_ID;
  await renderPantallaProyectos(hayProyectoAbierto);
  const overlay = document.getElementById("pantalla-proyectos");
  overlay.hidden = false;
  overlay.offsetHeight;
  overlay.classList.add("proy-visible");
  if (window.ocultarVistaProyecto) window.ocultarVistaProyecto();
}

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
window.espacioActivoIdActual = function () { return ESPACIO_ACTIVO_ID; };

})();
