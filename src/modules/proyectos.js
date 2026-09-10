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
// Cache local (IndexedDB) de "a qué espacio pertenece cada proyecto" —
// permite que el filtrado por espacio activo funcione incluso sin
// conexión, usando el último dato confirmado. Ver cargarEstadoOrganizacion().
let ESPACIO_POR_PROYECTO_LOCAL = {};

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

// soloLocal=true: pase instantáneo (solo IndexedDB, nada de Firestore) para
// que mostrarPantallaProyectos() pueda pintar la pantalla sin esperar red.
// Con soloLocal, ESPACIOS/INVITACIONES_ESPACIO se dejan como estén (lo que
// haya quedado de la última sincronización real) en vez de vaciarlos a []
// — así el selector de espacio no parpadea a "Propio" por un instante.
async function cargarEstadoOrganizacion(soloLocal) {
  try { CARPETAS = (await window.idbLeerMetaClave("carpetas")) || []; } catch (e) { CARPETAS = []; }
  try { CARPETA_ASIGNACIONES = (await window.idbLeerMetaClave("carpetaAsignaciones")) || {}; } catch (e) { CARPETA_ASIGNACIONES = {}; }
  try { ORDEN_MANUAL = (await window.idbLeerMetaClave("ordenManual")) || { raiz: [], porCarpeta: {} }; } catch (e) { ORDEN_MANUAL = { raiz: [], porCarpeta: {} }; }
  if (!ORDEN_MANUAL.porCarpeta) ORDEN_MANUAL.porCarpeta = {};
  try {
    const modoGuardado = await window.idbLeerMetaClave("modoOrden");
    MODO_ORDEN = modoGuardado || "manual";
  } catch (e) { MODO_ORDEN = "manual"; }

  // Cache local de "a qué espacio pertenece cada proyecto" — SIN esto, el
  // filtrado por espacio activo en la Pantalla de Proyectos no tenía forma
  // de funcionar offline: espacioIdConocido se calculaba de cero en cada
  // render a partir de 3 llamadas a Firestore, así que en el pase local
  // (sin red) TODOS los proyectos quedaban sin espacio conocido, y con un
  // espacio compartido activo el filtro los excluía a todos — la lista se
  // veía vacía aunque los proyectos estuvieran perfectos en el dispositivo.
  // Kevin, 08/09/2026: "si no tengo conexión, ¿me van a salir los
  // proyectos que he abierto alguna vez [en un espacio compartido]?".
  // Se actualiza cada vez que Firestore confirma el espacio real de un
  // proyecto (ver los 3 bloques remotos más abajo) y sirve de mejor-dato-
  // disponible mientras tanto.
  try { ESPACIO_POR_PROYECTO_LOCAL = (await window.idbLeerMetaClave("espacioPorProyecto")) || {}; } catch (e) { ESPACIO_POR_PROYECTO_LOCAL = {}; }

  const user = window.usuarioActual ? window.usuarioActual() : null;
  if (!soloLocal) {
    ESPACIOS = [];
    if (user && window.fsListarMisEspacios) {
      try { ESPACIOS = await window.fsListarMisEspacios(user.uid); } catch (e) { ESPACIOS = []; }
    }
  }
  try {
    const espacioGuardado = await window.idbLeerMetaClave("espacioActivoId");
    ESPACIO_ACTIVO_ID = espacioGuardado || null;
  } catch (e) { ESPACIO_ACTIVO_ID = null; }
  if (ESPACIO_ACTIVO_ID && !ESPACIOS.find((e) => e.id === ESPACIO_ACTIVO_ID)) ESPACIO_ACTIVO_ID = null;
  if (!soloLocal) {
    INVITACIONES_ESPACIO = [];
    if (user && user.email && window.fsListarInvitacionesPendientes) {
      try { INVITACIONES_ESPACIO = await window.fsListarInvitacionesPendientes(user.email); } catch (e) { INVITACIONES_ESPACIO = []; }
    }
  }
}
function guardarCarpetas() { window.idbGuardarMetaClave && window.idbGuardarMetaClave("carpetas", CARPETAS).catch(() => {}); }
function guardarAsignaciones() { window.idbGuardarMetaClave && window.idbGuardarMetaClave("carpetaAsignaciones", CARPETA_ASIGNACIONES).catch(() => {}); }
function guardarEspacioPorProyectoLocal() { window.idbGuardarMetaClave && window.idbGuardarMetaClave("espacioPorProyecto", ESPACIO_POR_PROYECTO_LOCAL).catch(() => {}); }
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

function abrirModalMiembrosEspacio(espacioId, nombreEspacio) {
  if (!window.fsListarMiembrosEspacio) {
    if (window.mostrarToast) mostrarToast("Ver miembros todavía no está disponible en esta versión.", "error");
    return;
  }
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box">
      <p style="font-weight:600;margin:0 0 12px;">Miembros de ${escapeHtml(nombreEspacio || "espacio")}</p>
      <div id="proy-miembros-lista"><p style="font-size:var(--fs-sm);color:var(--text-muted);">Cargando…</p></div>
      <div class="modal-actions">
        <button class="secondary" data-act="cancel">Cerrar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay || e.target.dataset.act === "cancel") overlay.remove();
  });
  window.fsListarMiembrosEspacio(espacioId).then((miembros) => {
    const cont = document.getElementById("proy-miembros-lista");
    if (!cont) return; // el modal ya se cerró antes de que llegara la respuesta
    if (!miembros.length) {
      cont.innerHTML = `<p style="font-size:var(--fs-sm);color:var(--text-muted);">No se encontraron miembros.</p>`;
      return;
    }
    cont.innerHTML = miembros.map((m) => `
      <div class="invitacion-espacio-fila">
        <div>
          <p class="invitacion-espacio-nombre">${escapeHtml(m.nombre || m.email || "Sin nombre")}${m.esCreador ? `<span class="badge-manual">Creador</span>` : ""}</p>
          ${m.nombre && m.email ? `<p class="invitacion-espacio-sub">${escapeHtml(m.email)}</p>` : ""}
        </div>
      </div>`).join("");
  }).catch((e) => {
    const cont = document.getElementById("proy-miembros-lista");
    if (cont) cont.innerHTML = `<p class="auth-error">No se pudo cargar: ${escapeHtml(e && e.message ? e.message : "revisá tu conexión.")}</p>`;
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
  const btnMiembros = ESPACIO_ACTIVO_ID
    ? `<button type="button" class="dropdown-item" id="proy-btn-ver-miembros"><svg class="icon"><use href="#i-eye"/></svg>Ver miembros</button>`
    : "";
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
      ${btnMiembros}
      ${btnInvitar}
      ${btnRenombrar}
      ${btnBorrarOSalir}
    </div>`;
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

// Actualiza SOLO lo que se ve en la tarjeta de la lista (nombre, cliente,
// fecha) usando los campos livianos que las 3 consultas de listado YA
// traen — nunca descarga el contenido completo (fotos incluidas) solo
// por mostrar la lista. Esa es la idea original: cualquier cuenta del
// espacio ve que el proyecto existe, pero el contenido real solo se
// descarga cuando de verdad se abre (ver abrirProyectoExistente() en
// archivo-estado-app.js, que ahora sabe manejar ese momento).
// Si el proyecto nunca se abrió en este dispositivo, arma una entrada
// "vitrina" (marcada con _sinDescargar) solo para que aparezca en la
// lista — sin guardarla en IndexedDB, porque no hay contenido real
// todavía. Si ya existía localmente, solo se refrescan nombre/cliente/
// fecha para que la tarjeta no mienta; el contenido real (lo que se usa
// al trabajar dentro del proyecto) no se toca acá.
// Kevin, 08/09/2026: "la idea original era: se ven los 10 proyectos del
// espacio, pero no se descargan hasta que se abren".
function actualizarMetadataListadoSiHaceFalta(doc, lista) {
  const id = doc.id;
  // El proyecto activamente abierto en ESTE dispositivo ahora mismo no se
  // toca acá — su propia sincronización la maneja detectarSiEsCompartido()
  // al abrirlo.
  if (window.PROYECTO_ACTIVO_ID === id) return;
  if (!doc.tieneContenido && !doc.nombre) return; // de verdad no hay nada que mostrar todavía
  let guardadoEnISO = null;
  if (doc.actualizadoEn) {
    guardadoEnISO = (typeof doc.actualizadoEn.toDate === "function") ? doc.actualizadoEn.toDate().toISOString() : doc.actualizadoEn;
  }
  const idx = lista.findIndex((p) => p.id === id);
  if (idx === -1) {
    lista.push({
      id,
      data: {
        projectInfo: { nombre: doc.nombre || "", cliente: doc.cliente || "" },
        guardadoEn: guardadoEnISO,
        creadoEn: guardadoEnISO,
        _sinDescargar: true,
      },
    });
  } else {
    const actual = lista[idx].data;
    if (actual && !actual._sinDescargar) {
      lista[idx] = {
        id,
        data: Object.assign({}, actual, {
          projectInfo: Object.assign({}, actual.projectInfo, {
            nombre: doc.nombre || (actual.projectInfo && actual.projectInfo.nombre) || "",
            cliente: doc.cliente || (actual.projectInfo && actual.projectInfo.cliente) || "",
          }),
          guardadoEn: guardadoEnISO || actual.guardadoEn,
        }),
      };
    }
  }
}

async function renderPantallaProyectos(permitirCerrar, soloLocal) {
  const overlay = crearOverlaySiHaceFalta();
  await cargarEstadoOrganizacion(soloLocal);

  let lista = [];
  try {
    // El índice liviano (solo nombre/cliente/fecha) evita leer el
    // contenido completo de cada proyecto guardado localmente — antes,
    // idbListarProyectos() cargaba TODAS las fotos de TODOS los proyectos
    // del dispositivo solo para armar esta lista. Fallback al método
    // viejo si por algún motivo el índice no está disponible todavía
    // (versión de archivo-estado-app.js desactualizada).
    lista = window.idbListarIndiceProyectos ? await window.idbListarIndiceProyectos() : await window.idbListarProyectos();
  } catch (e) { lista = []; }

  const idsCompartidos = new Set();
  const candadosAjenosPorProyecto = {};
  const user = window.usuarioActual ? window.usuarioActual() : null;
  // Arranca con lo último conocido localmente (funciona incluso offline);
  // los 3 bloques remotos de abajo lo actualizan con el dato real cuando
  // hay conexión.
  const espacioIdConocido = Object.assign({}, ESPACIO_POR_PROYECTO_LOCAL);
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

  if (!soloLocal && user && window.fsListarProyectosCompartidosConmigo) {
    try {
      if (window.invitacionesResueltas) {
        await Promise.race([
          window.invitacionesResueltas(),
          new Promise((r) => setTimeout(r, 4000)),
        ]);
      }
      const remotos = await window.fsListarProyectosCompartidosConmigo(user.uid);
      for (const remoto of remotos) {
        idsCompartidos.add(remoto.id);
        espacioIdConocido[remoto.id] = remoto.espacioId || null;
        ESPACIO_POR_PROYECTO_LOCAL[remoto.id] = remoto.espacioId || null;
        permisoEdicionConocido[remoto.id] = true; // llegó acá vía editoresUids array-contains: por definición puede editar
        registrarCandadoAjeno(remoto);
        actualizarMetadataListadoSiHaceFalta(remoto, lista);
      }
    } catch (e) {
      // Antes este catch estaba vacío — si esta consulta fallaba por
      // CUALQUIER motivo (permiso, red, lo que sea), un proyecto entero
      // podía desaparecer de la lista sin dejar ningún rastro, ni para
      // Kevin ni para nadie revisando después. Kevin, 08/09/2026: "no
      // podemos seguir asumiendo que todo es caché".
      console.error("No se pudieron traer los proyectos compartidos conmigo (editoresUids)", e);
    }
  }

  if (!soloLocal && user && window.fsListarMisProyectosCompartidos) {
    try {
      const mios = await window.fsListarMisProyectosCompartidos(user.uid);
      for (const doc of mios) {
        registrarCandadoAjeno(doc);
        espacioIdConocido[doc.id] = doc.espacioId || null;
        ESPACIO_POR_PROYECTO_LOCAL[doc.id] = doc.espacioId || null;
        permisoEdicionConocido[doc.id] = true;
        actualizarMetadataListadoSiHaceFalta(doc, lista);
      }
    } catch (e) {
      console.error("No se pudieron traer mis proyectos (ownerId)", e);
    }
  }

  if (!soloLocal && ESPACIO_ACTIVO_ID && window.fsListarProyectosDeEspacio) {
    try {
      const deEspacio = await window.fsListarProyectosDeEspacio(ESPACIO_ACTIVO_ID);
      for (const doc of deEspacio) {
        espacioIdConocido[doc.id] = ESPACIO_ACTIVO_ID;
        ESPACIO_POR_PROYECTO_LOCAL[doc.id] = ESPACIO_ACTIVO_ID;
        registrarCandadoAjeno(doc);
        const esDuenoDeEste = !!(user && doc.ownerId === user.uid);
        if (!esDuenoDeEste) idsCompartidos.add(doc.id);
        permisoEdicionConocido[doc.id] = esDuenoDeEste || (Array.isArray(doc.editoresUids) && !!user && doc.editoresUids.includes(user.uid));
        actualizarMetadataListadoSiHaceFalta(doc, lista);
      }
    } catch (e) {
      console.error("No se pudieron traer los proyectos del espacio activo (" + ESPACIO_ACTIVO_ID + ")", e);
    }
  }

  if (!soloLocal) guardarEspacioPorProyectoLocal();

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
  // Mientras soloLocal=true (pase instantáneo) todavía no sabemos si hay
  // proyectos compartidos/de espacio por llegar de Firestore — mostrar
  // "Todavía no tenés proyectos" en ese momento es mentirle al usuario por
  // unos segundos. Kevin, 08/09/2026: "sale vacío y a los segundos aparecen
  // los proyectos [...] se ve extraño". En vez de eso, un esqueleto de
  // carga; el mensaje real de "vacío" solo se muestra en el pase remoto
  // (soloLocal=false), cuando ya se confirmó que de verdad no hay nada.
  const vacio = (!hayAlgoQueMostrar && !borradores.length)
    ? (soloLocal
        ? `<div class="proy-cargando-spinner-wrap" aria-hidden="true"><div class="proy-cargando-spinner"></div><span>Cargando proyectos…</span></div>`
        : `<div class="proy-vacio"><svg class="icon proy-vacio-icono"><use href="#i-folder"/></svg><p>Todavía no tenés proyectos.<br>Creá el primero con el botón de abajo.</p></div>`)
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
      <div class="proy-body-full-inner">
        ${breadcrumb}
        ${seccionProyectos}
        ${btnNuevaCarpeta}
        ${seccionBorradores}
        ${vacio}
      </div>
    </div>
    <div class="proy-fab-wrap">
      <div class="proy-fab-menu" id="proy-fab-menu">
        <button type="button" class="proy-fab-menu-item" id="proy-fab-menu-nuevo"><svg class="icon"><use href="#i-plus"/></svg>Proyecto nuevo</button>
        <button type="button" class="proy-fab-menu-item" id="proy-fab-menu-abrir"><svg class="icon"><use href="#i-upload"/></svg>Abrir archivo</button>
      </div>
      <button type="button" class="proy-fab" id="proy-btn-nuevo" aria-label="Nuevo proyecto o abrir archivo"><svg class="icon"><use href="#i-plus"/></svg></button>
      <input type="file" id="proy-fab-input-abrir" accept=".fss,.json,application/json,application/octet-stream,text/plain" style="display:none" />
    </div>`;

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

  const proyFabBtn = document.getElementById("proy-btn-nuevo");
  const proyFabMenu = document.getElementById("proy-fab-menu");
  const proyFabInput = document.getElementById("proy-fab-input-abrir");
  if (proyFabBtn && proyFabMenu) {
    proyFabBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const dEsp = document.getElementById("proy-espacio-dropdown");
      const pop = document.getElementById("proy-account-popup");
      if (dEsp) dEsp.classList.remove("open");
      if (pop) pop.hidden = true;
      proyFabMenu.classList.toggle("open");
    });
    proyFabMenu.addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("click", () => proyFabMenu.classList.remove("open"));
    const btnFabNuevo = document.getElementById("proy-fab-menu-nuevo");
    if (btnFabNuevo) btnFabNuevo.addEventListener("click", async () => {
      proyFabMenu.classList.remove("open");
      const nuevoId = await window.crearYAbrirProyectoNuevo();
      if (CARPETA_ACTIVA_ID && nuevoId) {
        CARPETA_ASIGNACIONES[nuevoId] = CARPETA_ACTIVA_ID;
        guardarAsignaciones();
      }
      ocultarPantallaProyectos();
    });
    const btnFabAbrir = document.getElementById("proy-fab-menu-abrir");
    if (btnFabAbrir && proyFabInput) {
      btnFabAbrir.addEventListener("click", () => {
        proyFabMenu.classList.remove("open");
        proyFabInput.click();
      });
      proyFabInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        e.target.value = "";
        if (!file) return;
        if (window.importarProyectoJSON) window.importarProyectoJSON(file);
        ocultarPantallaProyectos();
      });
    }
  }

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
        // Cierra el menú con una transición corta ANTES de cambiar de
        // espacio, en vez de dejarlo desaparecer de golpe como efecto
        // secundario de reconstruir toda la pantalla (que antes pasaba
        // desapercibido porque el render tardaba, y ahora que es
        // instantáneo se nota como un "corte"). Transición inline, no
        // toca la clase .dropdown-panel compartida con otros menús.
        // Kevin, 08/09/2026: "se cierra de golpe".
        dropdownEspacio.style.transition = "opacity .15s ease, transform .15s ease";
        dropdownEspacio.style.opacity = "0";
        dropdownEspacio.style.transform = "translateY(-6px) scale(0.98)";
        setTimeout(() => {
          ESPACIO_ACTIVO_ID = nuevoId;
          guardarEspacioActivo();
          CARPETA_ACTIVA_ID = null;
          // Antes llamaba a renderPantallaProyectos(permitirCerrar) SIN el
          // segundo parámetro — eso activa el camino completo (soloLocal
          // undefined = false), esperando 4+ llamadas a Firestore (espacios,
          // invitaciones, y las 3 consultas de proyectos) ANTES de repintar
          // nada. Mismo patrón que ya usamos para la apertura inicial de
          // Proyectos: repintar YA con lo local, sincronizar después.
          // Kevin, 08/09/2026: "cambiar entre espacios se siente con lag".
          renderPantallaProyectos(permitirCerrar, true).then(() => {
            sincronizarProyectosRemotosYActualizar(permitirCerrar);
          });
        }, 150);
      });
    });
    const btnCrearEspacio = document.getElementById("proy-btn-crear-espacio");
    if (btnCrearEspacio) btnCrearEspacio.addEventListener("click", () => { dropdownEspacio.classList.remove("open"); abrirModalCrearEspacio(); });
    const btnInvitaciones = document.getElementById("proy-btn-invitaciones-espacio");
    if (btnInvitaciones) btnInvitaciones.addEventListener("click", () => { dropdownEspacio.classList.remove("open"); abrirModalInvitacionesPendientes(); });
    const btnVerMiembros = document.getElementById("proy-btn-ver-miembros");
    if (btnVerMiembros) btnVerMiembros.addEventListener("click", () => {
      dropdownEspacio.classList.remove("open");
      const activo = ESPACIOS.find((e) => e.id === ESPACIO_ACTIVO_ID);
      abrirModalMiembrosEspacio(ESPACIO_ACTIVO_ID, activo && activo.nombre);
    });
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

// Pase instantáneo: renderiza solo con lo que ya hay en IndexedDB (sin
// esperar red) para que el overlay aparezca al toque. Kevin, 08/09/2026:
// "el botón de home dura tanto en suceder que uno no sabe si le dio click".
// La causa real: renderPantallaProyectos() esperaba fsListarMisEspacios,
// fsListarInvitacionesPendientes y hasta 3 llamadas más a Firestore ANTES
// de mostrar nada — con conexión de obra eso son varios segundos a ciegas.
// Ahora se muestra ya mismo con lo local, y lo remoto llega después sin
// bloquear (ver sincronizarProyectosRemotosYActualizar debajo).
async function mostrarPantallaProyectos() {
  if (window.soltarCandadoActivoSiHaceFalta) {
    window.soltarCandadoActivoSiHaceFalta();
  }
  const hayProyectoAbierto = !!window.PROYECTO_ACTIVO_ID;
  await renderPantallaProyectos(hayProyectoAbierto, true);
  const overlay = document.getElementById("pantalla-proyectos");
  overlay.hidden = false;
  overlay.offsetHeight;
  overlay.classList.add("proy-visible");
  if (window.ocultarVistaProyecto) window.ocultarVistaProyecto();
  sincronizarProyectosRemotosYActualizar(hayProyectoAbierto);
}

// Límite de espera para la sincronización remota de Proyectos. Sin esto,
// con internet muy lento o sin conexión, el spinner "Cargando proyectos…"
// podía girar para siempre — ninguna llamada a Firestore tenía tope de
// tiempo (solo invitacionesResueltas() tenía 4s) y los catch solo atajan
// errores, no cuelgues. Kevin, 08/09/2026: "qué pasa si el internet
// estuviera muy lento o no tuviera conexión mientras carga".
const TIMEOUT_SYNC_PROYECTOS_MS = 8000;

// Contador de "intento vigente": si se reintenta (botón o volver a abrir
// la pantalla) mientras una sincronización vieja seguía pendiente en
// segundo plano, esa vieja no debe pisar el resultado de la nueva cuando
// eventualmente conteste.
let SYNC_PROYECTOS_GENERACION = 0;

// Segunda pasada, en segundo plano: trae espacios, invitaciones y proyectos
// compartidos/del espacio desde Firestore, y vuelve a renderizar ya con eso
// mezclado. Si el usuario cerró la pantalla mientras tanto, no hace nada
// (evita reabrirla sola ni pisar contenido de otra pantalla). Si Firestore
// no contesta dentro de TIMEOUT_SYNC_PROYECTOS_MS, se deja de esperar: si
// la pantalla seguía mostrando el spinner (sin nada local que mostrar), se
// reemplaza por un aviso con botón de reintentar en vez de girar para
// siempre. Si ya había proyectos locales visibles, no se interrumpe nada
// — simplemente no llegó lo compartido por ahora.
async function sincronizarProyectosRemotosYActualizar(permitirCerrar) {
  const overlay = document.getElementById("pantalla-proyectos");
  if (!overlay || overlay.hidden) return;
  const miGeneracion = ++SYNC_PROYECTOS_GENERACION;

  let seAgotoElTiempo = false;
  const esperaConLimite = new Promise((resolve) => {
    setTimeout(() => { seAgotoElTiempo = true; resolve(); }, TIMEOUT_SYNC_PROYECTOS_MS);
  });
  const intentoRemoto = renderPantallaProyectos(permitirCerrar, false).catch(() => {});

  await Promise.race([intentoRemoto, esperaConLimite]);

  if (miGeneracion !== SYNC_PROYECTOS_GENERACION) return; // hubo un reintento más nuevo
  if (!overlay || overlay.hidden) return;
  if (seAgotoElTiempo) {
    mostrarAvisoSinConexionProyectos(overlay, permitirCerrar);
  }
  // Si intentoRemoto sigue pendiente y responde más tarde (la conexión
  // vuelve), renderPantallaProyectos() va a actualizar el overlay por su
  // cuenta cuando resuelva — no hace falta hacer nada más acá.
}

// Reemplaza el spinner de carga por un aviso real cuando se agotó el
// tiempo de espera de la red. Si para ese momento ya había proyectos
// locales visibles (el spinner ya no está en el DOM), no hace nada — no
// hay nada que avisar, el usuario ya está viendo su lista.
function mostrarAvisoSinConexionProyectos(overlay, permitirCerrar) {
  const spinnerWrap = overlay.querySelector(".proy-cargando-spinner-wrap");
  if (!spinnerWrap) return;
  spinnerWrap.outerHTML = `
    <div class="proy-vacio">
      <svg class="icon proy-vacio-icono"><use href="#i-folder"/></svg>
      <p>No se pudo conectar para revisar proyectos compartidos.<br>Si tenés proyectos guardados en este dispositivo deberían aparecer solos; si la lista sigue vacía, revisá tu conexión.</p>
      <button type="button" class="secondary" id="proy-btn-reintentar-sync" style="margin-top:10px;">Reintentar</button>
    </div>`;
  const btnReintentar = document.getElementById("proy-btn-reintentar-sync");
  if (btnReintentar) btnReintentar.addEventListener("click", () => {
    renderPantallaProyectos(permitirCerrar, true).then(() => {
      sincronizarProyectosRemotosYActualizar(permitirCerrar);
    });
  });
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
// Cierra el hueco de "proyecto creado 100% offline dentro de un espacio
// compartido no aparece en la lista agrupada hasta la primera sincronización".
// Se llama al crear un proyecto nuevo, ANTES de que exista ninguna
// confirmación de Firestore — es un valor optimista (asume que el proyecto
// queda en el espacio que estaba activo al crearlo). Cuando la sync real
// confirme el espacio (o su ausencia, o un movimiento posterior), los 3
// bloques remotos de renderPantallaProyectos() lo sobreescriben con el
// dato real sin que haga falta ningún otro cambio.
window.registrarEspacioLocalDeProyectoNuevo = function (id, espacioId) {
  if (!id) return;
  ESPACIO_POR_PROYECTO_LOCAL[id] = espacioId || null;
  guardarEspacioPorProyectoLocal();
};

})();
