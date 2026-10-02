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
let MODO_ORDEN = "reciente";
// Texto del buscador y estado del bloque "Borradores" (sobreviven a los redibujos de la lista).
let BUSQUEDA_TEXTO = "";
let BORRADORES_ABIERTO = false;
let CARPETA_ACTIVA_ID = null;
// ---- Carpetas sincronizadas (fase 2): CARPETAS y CARPETA_ASIGNACIONES son las del contexto activo
// (el espacio de trabajo elegido, o "Propio" = la cuenta de cada persona).
let CTX_CARPETAS = { tipo: "local", id: null, clave: "u" };
let CARPETAS_FIRMA_REMOTA = "";
let ESCRITURAS_CARPETAS_EN_CURSO = 0;
let UNSUB_CARPETAS = null;
let CTX_ESCUCHADO = "";
let LEGACY_CARPETAS = { carpetas: [], asign: {} };
let MIGRACION_PENDIENTE = false;
let MIGRACION_MOSTRANDO = false;
let IDS_PROYECTOS_CTX = [];
let REFRESCO_CARPETAS_TIMER = null;
let ESPACIOS = [];
let ESPACIO_ACTIVO_ID = null;
let INVITACIONES_ESPACIO = [];
let ULTIMO_PERMITIR_CERRAR = false; // recordado para poder re-renderizar en vivo sin perder este dato (ver actualizarInvitacionesEspacioEnVivo)
// Cache local (IndexedDB) de "a qué espacio pertenece cada proyecto" —
// permite que el filtrado por espacio activo funcione incluso sin
// conexión, usando el último dato confirmado. Ver cargarEstadoOrganizacion().
let ESPACIO_POR_PROYECTO_LOCAL = {};

// Ids de proyectos que se están borrando en la nube. Mientras la limpieza sigue en segundo
// plano, la lista no los vuelve a mostrar aunque Firestore todavía los devuelva.
const PROYECTOS_BORRANDO = new Set();
// Protección contra doble toque en "Proyecto nuevo" y en "Abrir archivo".
let CREANDO_PROYECTO = false;
let ULTIMA_APERTURA_ARCHIVO_MS = 0;
// Los clics "fuera" que cierran los menús se registran UNA sola vez. Antes se registraba uno
// nuevo en cada redibujo de la lista (ordenar, borrar, sincronizar...) y nunca se quitaban:
// se acumulaban y la pantalla se iba poniendo más lenta con el uso.
let CLICK_GLOBAL_LIGADO = false;
function ligarClickGlobalUnaVez() {
  if (CLICK_GLOBAL_LIGADO) return;
  CLICK_GLOBAL_LIGADO = true;
  document.addEventListener("click", () => {
    const menuFab = document.getElementById("proy-fab-menu"); if (menuFab) menuFab.classList.remove("open");
    const dropEsp = document.getElementById("proy-espacio-dropdown"); if (dropEsp) dropEsp.classList.remove("open");
    const popupCuenta = document.getElementById("proy-account-popup"); if (popupCuenta) popupCuenta.hidden = true;
    cerrarMenuFlotante();
  });
}

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
async function cargarEstadoOrganizacion(soloLocal, prefetch) {
  // Carpetas guardadas SOLO en este dispositivo (antes de la sincronización): se ofrecen una vez para subirlas.
  try { LEGACY_CARPETAS.carpetas = (await window.idbLeerMetaClave("carpetas")) || []; } catch (e) { LEGACY_CARPETAS.carpetas = []; }
  try { LEGACY_CARPETAS.asign = (await window.idbLeerMetaClave("carpetaAsignaciones")) || {}; } catch (e) { LEGACY_CARPETAS.asign = {}; }
  try { ORDEN_MANUAL = (await window.idbLeerMetaClave("ordenManual")) || { raiz: [], porCarpeta: {} }; } catch (e) { ORDEN_MANUAL = { raiz: [], porCarpeta: {} }; }
  if (!ORDEN_MANUAL.porCarpeta) ORDEN_MANUAL.porCarpeta = {};
  try {
    const modoGuardado = await window.idbLeerMetaClave("modoOrden");
    // "Manual" se eliminó: quien lo tenía guardado pasa a "Reciente".
    MODO_ORDEN = (modoGuardado === "az" || modoGuardado === "reciente") ? modoGuardado : "reciente";
  } catch (e) { MODO_ORDEN = "reciente"; }

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
  // La consulta de invitaciones sale junto con la de espacios (antes esperaba a que terminara la otra).
  let promesaInvitaciones = null;
  if (!soloLocal && user && user.email && window.fsListarInvitacionesPendientes) {
    promesaInvitaciones = Promise.resolve().then(() => window.fsListarInvitacionesPendientes(user.email));
  }
  if (!soloLocal) {
    ESPACIOS = [];
    if (user && window.fsListarMisEspacios) {
      try { ESPACIOS = await window.fsListarMisEspacios(user.uid); guardarCacheEspacios(user); }
      catch (e) { ESPACIOS = await leerCacheEspacios(user); }   // sin conexión: la última lista conocida
    }
  } else if (!ESPACIOS.length && user) {
    ESPACIOS = await leerCacheEspacios(user);   // primer pintado: ya se sabe en qué espacio estaba
  }
  try {
    const espacioGuardado = await window.idbLeerMetaClave("espacioActivoId");
    ESPACIO_ACTIVO_ID = espacioGuardado || null;
  } catch (e) { ESPACIO_ACTIVO_ID = null; }
  if (ESPACIO_ACTIVO_ID && !ESPACIOS.find((e) => e.id === ESPACIO_ACTIVO_ID)) ESPACIO_ACTIVO_ID = null;
  if (!soloLocal) {
    INVITACIONES_ESPACIO = [];
    if (promesaInvitaciones) {
      try { INVITACIONES_ESPACIO = await promesaInvitaciones; } catch (e) { INVITACIONES_ESPACIO = []; }
    }
  }
  await cargarCarpetasDelContexto(soloLocal, prefetch);
}
function guardarCarpetas() { guardarCacheCarpetas(); }
function guardarAsignaciones() { guardarCacheCarpetas(); }
function guardarEspacioPorProyectoLocal() { window.idbGuardarMetaClave && window.idbGuardarMetaClave("espacioPorProyecto", ESPACIO_POR_PROYECTO_LOCAL).catch(() => {}); }
function guardarOrdenManual() { window.idbGuardarMetaClave && window.idbGuardarMetaClave("ordenManual", ORDEN_MANUAL).catch(() => {}); }
function guardarModoOrden() { window.idbGuardarMetaClave && window.idbGuardarMetaClave("modoOrden", MODO_ORDEN).catch(() => {}); }
function guardarEspacioActivo() { window.idbGuardarMetaClave && window.idbGuardarMetaClave("espacioActivoId", ESPACIO_ACTIVO_ID).catch(() => {}); }

// ============================================================================
// Pantalla de Proyectos — rediseño (fase 1): buscador, Recientes, carpetas por cliente,
// etiquetas de estado y menú ⋯ por proyecto con permisos.
// ============================================================================
// Íconos propios de esta pantalla. El resto de la app usa el sprite de index.html; estos se
// agregan solos al abrir la pantalla (así no hace falta tocar index.html).
const ICONOS_PROYECTOS_SVG = '<svg id="proy-iconos-extra" xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">'
  + '<symbol id="i-px-dots" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.7" fill="currentColor"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/><circle cx="12" cy="19" r="1.7" fill="currentColor"/></symbol>'
  + '<symbol id="i-px-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M16 16l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></symbol>'
  + '<symbol id="i-px-eye" viewBox="0 0 24 24"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.8" fill="none" stroke="currentColor" stroke-width="1.8"/></symbol>'
  + '<symbol id="i-px-users" viewBox="0 0 24 24"><circle cx="9" cy="8.5" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3 19c0-3.3 2.7-5.2 6-5.2s6 1.9 6 5.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M16.5 5.8a3 3 0 010 5.4M18.5 14.2c1.6.7 2.5 2 2.5 4.1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></symbol>'
  + '<symbol id="i-px-lock" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 11V8a4 4 0 018 0v3" fill="none" stroke="currentColor" stroke-width="1.8"/></symbol>'
  + '<symbol id="i-px-cloud-off" viewBox="0 0 24 24"><path d="M3 3l18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M8.5 6.4A5.5 5.5 0 0117.6 9H18a3.5 3.5 0 012.6 5.8M6 18h11M5.5 9.7A4 4 0 006 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></symbol>'
  + '<symbol id="i-px-file" viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M14 3v5h5M9 13h6M9 17h6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></symbol>'
  + '<symbol id="i-px-chevron-up" viewBox="0 0 24 24"><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></symbol>'
  + '<symbol id="i-px-pencil" viewBox="0 0 24 24"><path d="M4 20h4L19 9a2.1 2.1 0 00-3-3L5 17z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M14.5 7.5l3 3" fill="none" stroke="currentColor" stroke-width="1.8"/></symbol>'
  + '<symbol id="i-px-switch" viewBox="0 0 24 24"><path d="M4 8h15M15 4l4 4-4 4M20 16H5M9 12l-4 4 4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>'
  + '<symbol id="i-px-user-check" viewBox="0 0 24 24"><circle cx="9" cy="8.5" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3 19c0-3.3 2.7-5.2 6-5.2 1.6 0 3 .5 4 1.3M15 17.5l2 2 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>'
  + '<symbol id="i-px-trash" viewBox="0 0 24 24"><path d="M4 7h16M10 7V4.5h4V7M6.5 7l1 12.5h9L17.5 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>'
  + '<symbol id="i-px-folder" viewBox="0 0 24 24"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></symbol>'
  + '<symbol id="i-px-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></symbol>'
  + '</svg>';
function asegurarIconosProyectos() {
  if (document.getElementById("proy-iconos-extra")) return;
  const cont = document.createElement("div");
  cont.innerHTML = ICONOS_PROYECTOS_SVG;
  document.body.appendChild(cont.firstChild);
}
function icoPx(nombre, clase) {
  return '<svg class="icon' + (clase ? " " + clase : "") + '" aria-hidden="true"><use href="#i-px-' + nombre + '"/></svg>';
}
function normalizarBusqueda(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

// ---- Menú flotante ⋯ (uno solo para toda la pantalla; se posiciona junto al botón que lo abrió)
function cerrarMenuFlotante() {
  const m = document.getElementById("proy-menu-flotante");
  if (m) m.remove();
}
function abrirMenuFlotante(btn, items) {
  cerrarMenuFlotante();
  const overlay = document.getElementById("pantalla-proyectos");
  if (!overlay || !items.length) return;
  const menu = document.createElement("div");
  menu.id = "proy-menu-flotante";
  menu.className = "proy-menu";
  menu.setAttribute("role", "menu");
  menu.innerHTML = items.map((it) => it.sep
    ? '<div class="proy-menu-sep"></div>'
    : '<button type="button" role="menuitem" class="proy-menu-item' + (it.peligro ? " peligro" : "") + '" data-i="' + it.i + '"' + (it.deshabilitado ? " disabled" : "") + '>' + icoPx(it.icono) + '<span>' + escapeHtml(it.texto) + '</span></button>').join("");
  menu.style.visibility = "hidden";
  // Va en <body> (no dentro de la pantalla): así sobrevive a los redibujos de la lista (por ejemplo cuando
  // llegan datos de la nube mientras el menú está abierto).
  document.body.appendChild(menu);
  const r = btn.getBoundingClientRect();
  const w = menu.offsetWidth, h = menu.offsetHeight;
  let left = Math.min(window.innerWidth - w - 8, Math.max(8, r.right - w));
  let top = r.bottom + 4;
  if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 4);
  menu.style.left = left + "px"; menu.style.top = top + "px"; menu.style.visibility = "visible";
  menu.addEventListener("click", (e) => {
    e.stopPropagation();
    const b = e.target.closest(".proy-menu-item");
    if (!b || b.disabled) return;
    const it = items.find((x) => String(x.i) === b.getAttribute("data-i"));
    cerrarMenuFlotante();
    if (it && it.accion) it.accion();
  });
}

// ---- Renombrar carpeta (modal)
function abrirModalRenombrarCarpeta(carpetaId) {
  const carpeta = CARPETAS.find((c) => c.id === carpetaId);
  if (!carpeta) return;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box">
      <p style="font-weight:600;margin:0 0 12px;">Renombrar carpeta</p>
      <input type="text" id="proy-renombrar-carpeta-nombre" value="${escapeHtml(carpeta.nombre)}" style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1px solid var(--border);border-radius:8px;font-size:var(--fs-md);background:var(--surface-raised);color:var(--ink);margin-bottom:14px;" />
      <div class="modal-actions">
        <button class="secondary" data-act="cancel">Cancelar</button>
        <button class="primary" data-act="guardar">Guardar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const input = document.getElementById("proy-renombrar-carpeta-nombre");
  input.focus(); input.select();
  const guardar = () => {
    const nombre = input.value.trim();
    if (!nombre) return;
    accionRenombrarCarpeta(carpetaId, nombre);
    overlay.remove();
    renderPantallaProyectos(!!window.PROYECTO_ACTIVO_ID);
  };
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") guardar(); });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay || e.target.dataset.act === "cancel") { overlay.remove(); return; }
    if (e.target.dataset.act === "guardar") guardar();
  });
}

// ---- Etiquetas de estado de un proyecto
// ctx: { user, enNube:Set, nubeCompleta:boolean, docs:{}, espacios:[] , candados:{}, permisos:{} }
function permisosDeProyecto(id, ctx) {
  const doc = ctx.docs[id] || null;
  const uid = ctx.user ? ctx.user.uid : null;
  if (!doc) {
    // Sin dato remoto (solo local, o todavía no llegó la nube): se trata como propio.
    return { doc: null, esDueno: true, esDuenoEspacio: false, puedeEditar: ctx.permisos[id] !== false };
  }
  const esDueno = !!uid && doc.ownerId === uid;
  const esp = doc.espacioId ? ctx.espacios.find((e) => e.id === doc.espacioId) : null;
  const esDuenoEspacio = !!(uid && esp && esp.creadoPor === uid);
  const esEditor = !!uid && Array.isArray(doc.editoresUids) && doc.editoresUids.includes(uid);
  return { doc, esDueno, esDuenoEspacio, puedeEditar: esDueno || esEditor || esDuenoEspacio };
}
function chipsProyectoHTML(id, ctx) {
  const p = permisosDeProyecto(id, ctx);
  const chips = [];
  const esp = p.doc && p.doc.espacioId ? ctx.espacios.find((e) => e.id === p.doc.espacioId) : null;
  const hayOtros = !!(p.doc && ((Array.isArray(p.doc.editoresUids) && p.doc.editoresUids.length > 0) || (esp && Array.isArray(esp.miembrosUids) && esp.miembrosUids.length > 1) || !p.esDueno));
  if (hayOtros) chips.push('<span class="proy-chip ok">' + icoPx("users") + 'Compartido</span>');
  if (p.doc && !p.puedeEditar) chips.push('<span class="proy-chip info">' + icoPx("eye") + 'Solo lectura</span>');
  if (ctx.candados[id]) chips.push('<span class="proy-chip warn">' + icoPx("lock") + escapeHtml(ctx.candados[id]) + ' está editando</span>');
  if (ctx.zombis && ctx.zombis.has(id)) chips.push('<span class="proy-chip warn">' + icoPx("cloud-off") + 'Ya no está en la nube</span>');
  else if (ctx.user && ctx.nubeCompleta && !ctx.enNube.has(id) && !(ctx.sincronizados && ctx.sincronizados.has(id))) chips.push('<span class="proy-chip neutro">' + icoPx("cloud-off") + 'Solo en este teléfono</span>');
  return chips.length ? '<div class="proy-chips">' + chips.join("") + '</div>' : "";
}

function tarjetaProyectoNuevaHTML(id, data, ctx, opciones) {
  opciones = opciones || {};
  const nombre = (data.projectInfo && data.projectInfo.nombre) || "Sin nombre";
  const cliente = data.projectInfo && data.projectInfo.cliente ? data.projectInfo.cliente : "";
  const carpetaId = carpetaDe(id);
  const carpeta = carpetaId ? CARPETAS.find((c) => c.id === carpetaId) : null;
  const sub = opciones.mostrarCarpeta
    ? [carpeta ? carpeta.nombre : "Sin carpeta", formatearFechaRelativa(data.guardadoEn)].join(" · ")
    : [cliente, formatearFechaRelativa(data.guardadoEn)].filter(Boolean).join(" · ");
  const buscar = normalizarBusqueda(nombre + " " + cliente + " " + (carpeta ? carpeta.nombre : ""));
  return `
    <div class="proy-card proy-card-nueva" data-id="${escapeHtml(id)}" data-tipo="proyecto" data-buscar="${escapeHtml(buscar)}">
      <div class="proy-card-info">
        <p class="proy-card-nombre">${escapeHtml(nombre)}</p>
        <p class="proy-card-sub">${escapeHtml(sub)}</p>
        ${chipsProyectoHTML(id, ctx)}
      </div>
      <button type="button" class="proy-card-menu-btn" data-id="${escapeHtml(id)}" data-tipo="proyecto" aria-label="Más opciones" aria-haspopup="menu">${icoPx("dots")}</button>
    </div>`;
}
function filaBorradorHTML(id, data) {
  const nombre = formatearFechaCorta(data.creadoEn || data.guardadoEn) || "Borrador";
  return `
    <div class="proy-card proy-card-nueva proy-card-borrador" data-id="${escapeHtml(id)}" data-tipo="proyecto">
      <div class="proy-card-info">
        <p class="proy-card-nombre">${escapeHtml(nombre)}</p>
        <p class="proy-card-sub">Sin nombre</p>
      </div>
      <button type="button" class="proy-card-menu-btn" data-id="${escapeHtml(id)}" data-tipo="borrador" aria-label="Más opciones" aria-haspopup="menu">${icoPx("dots")}</button>
    </div>`;
}
function filaCarpetaHTML(carpeta, cantidad) {
  return `
    <div class="proy-carpeta-fila" data-id="${escapeHtml(carpeta.id)}" data-tipo="carpeta" data-buscar="${escapeHtml(normalizarBusqueda(carpeta.nombre))}">
      <div class="proy-carpeta-tile"><svg class="icon"><use href="#i-folder"/></svg></div>
      <div class="proy-carpeta-nombre">${escapeHtml(carpeta.nombre)}</div>
      <div class="proy-carpeta-cant">${cantidad}</div>
      <button type="button" class="proy-card-menu-btn" data-id="${escapeHtml(carpeta.id)}" data-tipo="carpeta" aria-label="Más opciones" aria-haspopup="menu">${icoPx("dots")}</button>
      <svg class="icon proy-carpeta-chevron" aria-hidden="true"><use href="#i-chevron-right"/></svg>
    </div>`;
}

// ============================================================================
// Carpetas sincronizadas (fase 2)
// ----------------------------------------------------------------------------
// Dónde viven: en el propio documento del espacio de trabajo (espacios/{id}) o, en "Propio", en el
// documento de la persona (usuarios/{uid}). Dos mapas:
//   carpetas:           { [carpetaId]: { nombre, padreId, creadoPor, creadoEn } }
//   carpetaDeProyecto:  { [proyectoId]: carpetaId }
// El documento del espacio ya se lee cada vez que se carga la lista, así que las carpetas llegan sin
// lecturas extra. Los cambios se escriben por campo (carpetas.<id>.nombre, etc.), no el mapa completo,
// así dos personas editando carpetas a la vez no se pisan. Mover un proyecto de carpeta NO toca el
// documento del proyecto (no choca con el candado de edición).
// Quién puede qué: crear, renombrar y mover, cualquier miembro. Borrar una carpeta: la persona dueña del
// espacio o quien la creó (se aplica en la app).
// ============================================================================
const BORRAR_CAMPO = "__borrar__";
// Copia local de la lista de espacios: sin ella, si la nube no responde (sin señal en obra), la app olvidaba
// el espacio activo y caía a "Propio" — y con eso también perdía sus carpetas y sus proyectos.
async function guardarCacheEspacios(user) {
  if (!user || !window.idbGuardarMetaClave) return;
  const liviano = ESPACIOS.map((e) => ({ id: e.id, nombre: e.nombre, miembrosUids: e.miembrosUids || [], creadoPor: e.creadoPor || "", carpetas: e.carpetas || {}, carpetaDeProyecto: e.carpetaDeProyecto || {} }));
  try { await window.idbGuardarMetaClave("espaciosCache:" + user.uid, liviano); } catch (e) {}
}
async function leerCacheEspacios(user) {
  if (!user || !window.idbLeerMetaClave) return [];
  try { const c = await window.idbLeerMetaClave("espaciosCache:" + user.uid); return Array.isArray(c) ? c : []; } catch (e) { return []; }
}
function usuarioCarpetas() { return window.usuarioActual ? window.usuarioActual() : null; }
function contextoCarpetas() {
  const user = usuarioCarpetas();
  if (ESPACIO_ACTIVO_ID) return { tipo: "espacio", id: ESPACIO_ACTIVO_ID, clave: "e:" + ESPACIO_ACTIVO_ID };
  if (user) return { tipo: "usuario", id: user.uid, clave: "u" };
  return { tipo: "local", id: null, clave: "u" };
}
function firmaCarpetas(carpetas, asign) {
  const cs = carpetas.slice().sort((a, b) => (a.id < b.id ? -1 : 1)).map((c) => [c.id, c.nombre || "", c.padreId || null, c.creadoPor || "", c.creadoEn || ""]);
  const as = Object.keys(asign || {}).sort().map((k) => [k, asign[k]]);
  return JSON.stringify([cs, as]);
}
function carpetasDesdeMapa(mapa) {
  return Object.keys(mapa || {}).map((id) => {
    const c = mapa[id] || {};
    return { id, nombre: c.nombre || "", padreId: c.padreId || null, creadoPor: c.creadoPor || "", creadoEn: c.creadoEn || "" };
  });
}
function cargarDatosContenedor(datos) {
  CARPETAS = carpetasDesdeMapa(datos && datos.carpetas);
  CARPETA_ASIGNACIONES = Object.assign({}, (datos && datos.carpetaDeProyecto) || {});
  CARPETAS_FIRMA_REMOTA = firmaCarpetas(CARPETAS, CARPETA_ASIGNACIONES);
}
function guardarCacheCarpetas() {
  if (!window.idbGuardarMetaClave) return;
  window.idbGuardarMetaClave("carpetasCtx:" + CTX_CARPETAS.clave, { carpetas: CARPETAS, asign: CARPETA_ASIGNACIONES }).catch(() => {});
}
// Carpeta a la que pertenece un proyecto, o null si no tiene o si esa carpeta ya no existe.
function carpetaDe(proyectoId) {
  const c = CARPETA_ASIGNACIONES[proyectoId];
  return (c && CARPETAS.some((x) => x.id === c)) ? c : null;
}
function esDuenoDelEspacioActivo() {
  const user = usuarioCarpetas();
  if (!ESPACIO_ACTIVO_ID || !user) return false;
  const e = ESPACIOS.find((x) => x.id === ESPACIO_ACTIVO_ID);
  return !!(e && e.creadoPor === user.uid);
}
function puedeBorrarCarpeta(carpeta) {
  if (CTX_CARPETAS.tipo !== "espacio") return true;
  const user = usuarioCarpetas();
  return esDuenoDelEspacioActivo() || (!!user && !!carpeta && carpeta.creadoPor === user.uid);
}

function firestoreDisponibleCarpetas() { return typeof firebase !== "undefined" && !!firebase && typeof firebase.firestore === "function"; }
function refContenedorCarpetas(ctx) {
  const d = firebase.firestore();
  return ctx.tipo === "espacio" ? d.collection("espacios").doc(ctx.id) : d.collection("usuarios").doc(ctx.id);
}
function aObjetoAnidado(cambios) {
  const raiz = {};
  Object.keys(cambios).forEach((ruta) => {
    const partes = ruta.split(".");
    let n = raiz;
    partes.slice(0, -1).forEach((p) => { n[p] = n[p] || {}; n = n[p]; });
    n[partes[partes.length - 1]] = cambios[ruta] === BORRAR_CAMPO ? firebase.firestore.FieldValue.delete() : cambios[ruta];
  });
  return raiz;
}
async function escribirCarpetasRemoto(ctx, cambios) {
  if (ctx.tipo === "local" || !firestoreDisponibleCarpetas()) return false;
  const ref = refContenedorCarpetas(ctx);
  const upd = {};
  Object.keys(cambios).forEach((r) => { upd[r] = cambios[r] === BORRAR_CAMPO ? firebase.firestore.FieldValue.delete() : cambios[r]; });
  try {
    await ref.update(upd);
  } catch (e) {
    // El documento de la persona se crea con la primera carpeta; el del espacio ya existe siempre.
    const noExiste = !!e && (e.code === "not-found" || /not[- ]found|No document to update/i.test(String(e.message || "")));
    if (ctx.tipo === "usuario" && noExiste) await ref.set(aObjetoAnidado(cambios), { merge: true });
    else throw e;
  }
  return true;
}
async function leerCarpetasUsuario(uid) {
  if (!firestoreDisponibleCarpetas()) throw new Error("Firestore no disponible");
  const snap = await firebase.firestore().collection("usuarios").doc(uid).get();
  return snap.exists ? snap.data() : {};
}

// Escribe en la nube SIN hacer esperar a la pantalla: el cambio ya se ve en el dispositivo. Mientras haya
// escrituras en curso no se pisa el estado local con lo que diga la nube (todavía no las incluye).
function sincronizarCarpetas(cambios) {
  const ctx = CTX_CARPETAS;
  ESCRITURAS_CARPETAS_EN_CURSO++;
  let ok = false;
  escribirCarpetasRemoto(ctx, cambios).then(() => { ok = true; }).catch((err) => {
    console.error("No se pudo guardar el cambio de carpetas en la nube:", err);
    if (window.mostrarToast) mostrarToast("No se pudo guardar el cambio de carpetas en la nube. Revisá tu conexión.", "error");
  }).then(() => {
    ESCRITURAS_CARPETAS_EN_CURSO = Math.max(0, ESCRITURAS_CARPETAS_EN_CURSO - 1);
    if (ESCRITURAS_CARPETAS_EN_CURSO === 0) {
      if (ok && CTX_CARPETAS.clave === ctx.clave) CARPETAS_FIRMA_REMOTA = firmaCarpetas(CARPETAS, CARPETA_ASIGNACIONES);
      programarRefrescoCarpetas(ok ? 800 : 200);
    }
  });
}
function programarRefrescoCarpetas(ms) {
  clearTimeout(REFRESCO_CARPETAS_TIMER);
  REFRESCO_CARPETAS_TIMER = setTimeout(() => {
    const ov = document.getElementById("pantalla-proyectos");
    if (ov && !ov.hidden) renderPantallaProyectos(ULTIMO_PERMITIR_CERRAR, false);
  }, ms);
}

function accionCrearCarpeta(nombre, padreId) {
  const user = usuarioCarpetas();
  const id = "c_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
  const carpeta = { id, nombre, padreId: padreId || null, creadoPor: user ? user.uid : "", creadoEn: new Date().toISOString() };
  CARPETAS.push(carpeta);
  guardarCacheCarpetas();
  sincronizarCarpetas({ ["carpetas." + id]: { nombre: carpeta.nombre, padreId: carpeta.padreId, creadoPor: carpeta.creadoPor, creadoEn: carpeta.creadoEn } });
  return id;
}
function accionRenombrarCarpeta(id, nombre) {
  const c = CARPETAS.find((x) => x.id === id);
  if (!c) return;
  c.nombre = nombre;
  guardarCacheCarpetas();
  sincronizarCarpetas({ ["carpetas." + id + ".nombre"]: nombre });
}
function accionBorrarCarpeta(id) {
  const cambios = { ["carpetas." + id]: BORRAR_CAMPO };
  CARPETAS.forEach((c) => { if (c.padreId === id) cambios["carpetas." + c.id + ".padreId"] = null; });
  Object.keys(CARPETA_ASIGNACIONES).forEach((pid) => { if (CARPETA_ASIGNACIONES[pid] === id) cambios["carpetaDeProyecto." + pid] = BORRAR_CAMPO; });
  CARPETAS = CARPETAS.filter((c) => c.id !== id).map((c) => c.padreId === id ? Object.assign({}, c, { padreId: null }) : c);
  Object.keys(CARPETA_ASIGNACIONES).forEach((pid) => { if (CARPETA_ASIGNACIONES[pid] === id) delete CARPETA_ASIGNACIONES[pid]; });
  delete ORDEN_MANUAL.porCarpeta[id];
  guardarOrdenManual();
  guardarCacheCarpetas();
  sincronizarCarpetas(cambios);
}
// carpetaId = null → "Sin carpeta"
function accionMoverProyecto(proyectoId, carpetaId) {
  if (carpetaId) {
    CARPETA_ASIGNACIONES[proyectoId] = carpetaId;
    sincronizarCarpetas({ ["carpetaDeProyecto." + proyectoId]: carpetaId });
  } else {
    if (!(proyectoId in CARPETA_ASIGNACIONES)) return;
    delete CARPETA_ASIGNACIONES[proyectoId];
    sincronizarCarpetas({ ["carpetaDeProyecto." + proyectoId]: BORRAR_CAMPO });
  }
  guardarCacheCarpetas();
}

// Carga las carpetas del contexto activo: primero la copia local (instantánea y sirve sin conexión) y,
// con conexión, lo que dice la nube (que manda).
async function cargarCarpetasDelContexto(soloLocal, prefetch) {
  const nuevo = contextoCarpetas();
  const cambioCtx = nuevo.clave !== CTX_CARPETAS.clave;
  CTX_CARPETAS = nuevo;
  if (cambioCtx) { CARPETAS_FIRMA_REMOTA = ""; PAPELERA = []; }
  if (cambioCtx || ESCRITURAS_CARPETAS_EN_CURSO === 0) {
    let cache = null;
    try { cache = await window.idbLeerMetaClave("carpetasCtx:" + CTX_CARPETAS.clave); } catch (e) { cache = null; }
    CARPETAS = cache && Array.isArray(cache.carpetas) ? cache.carpetas : [];
    CARPETA_ASIGNACIONES = cache && cache.asign ? cache.asign : {};
  }
  MIGRACION_PENDIENTE = false;
  if (soloLocal || ESCRITURAS_CARPETAS_EN_CURSO > 0 || CTX_CARPETAS.tipo === "local") return;
  let datos = null;
  try {
    if (CTX_CARPETAS.tipo === "espacio") {
      const e = ESPACIOS.find((x) => x.id === CTX_CARPETAS.id);
      datos = e ? { carpetas: e.carpetas, carpetaDeProyecto: e.carpetaDeProyecto } : null;
    } else if (prefetch && prefetch.carpetasUsuario) {
      const r = await prefetch.carpetasUsuario;
      if (!r.ok) throw r.error;
      datos = r.valor;
    } else {
      datos = await leerCarpetasUsuario(CTX_CARPETAS.id);
    }
  } catch (e) {
    console.error("No se pudieron traer las carpetas de la nube (se usa la copia de este dispositivo)", e);
    datos = null;
  }
  if (!datos) return;
  cargarDatosContenedor(datos);
  guardarCacheCarpetas();
  if (CARPETAS.length === 0 && LEGACY_CARPETAS.carpetas.length > 0) {
    let marca = null;
    try { marca = await window.idbLeerMetaClave("migracionCarpetas:" + CTX_CARPETAS.clave); } catch (e) { marca = null; }
    if (!marca) MIGRACION_PENDIENTE = true;
  }
}

// Escucha en vivo los cambios de carpetas hechos por otras personas (u otro dispositivo mío).
function detenerListenerCarpetas() {
  if (UNSUB_CARPETAS) { try { UNSUB_CARPETAS(); } catch (e) {} }
  UNSUB_CARPETAS = null; CTX_ESCUCHADO = "";
}
function asegurarListenerCarpetas() {
  const ctx = CTX_CARPETAS;
  if (ctx.tipo === "local" || !firestoreDisponibleCarpetas()) { detenerListenerCarpetas(); return; }
  if (CTX_ESCUCHADO === ctx.clave && UNSUB_CARPETAS) return;
  detenerListenerCarpetas();
  CTX_ESCUCHADO = ctx.clave;
  try {
    UNSUB_CARPETAS = refContenedorCarpetas(ctx).onSnapshot((snap) => {
      if (CTX_ESCUCHADO !== ctx.clave) return;
      if (snap.metadata && snap.metadata.hasPendingWrites) return;
      if (ESCRITURAS_CARPETAS_EN_CURSO > 0) return;
      const d = snap.exists ? snap.data() : {};
      if (firmaCarpetas(carpetasDesdeMapa(d.carpetas), d.carpetaDeProyecto || {}) === CARPETAS_FIRMA_REMOTA) return;
      cargarDatosContenedor(d);
      guardarCacheCarpetas();
      programarRefrescoCarpetas(250);
    }, (err) => console.error("Error escuchando las carpetas en vivo", err));
  } catch (e) {
    console.error("No se pudo escuchar las carpetas en vivo", e);
    UNSUB_CARPETAS = null; CTX_ESCUCHADO = "";
  }
}

// Una sola vez por contexto: ofrece subir las carpetas que esta persona ya tenía guardadas en el teléfono.
function ofrecerMigracionCarpetas() {
  if (!MIGRACION_PENDIENTE || MIGRACION_MOSTRANDO) return;
  MIGRACION_MOSTRANDO = true;
  const clave = CTX_CARPETAS.clave;
  const esEspacio = CTX_CARPETAS.tipo === "espacio";
  const esp = esEspacio ? ESPACIOS.find((x) => x.id === CTX_CARPETAS.id) : null;
  const destino = esEspacio ? "el espacio «" + ((esp && esp.nombre) || "este espacio") + "»" : "tu cuenta";
  const n = LEGACY_CARPETAS.carpetas.length;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box">
      <p style="font-weight:600;margin:0 0 10px;">Carpetas guardadas en este teléfono</p>
      <p style="margin:0 0 14px;font-size:var(--fs-sm);color:var(--text-secondary);line-height:1.45;">Tenés ${n} carpeta${n === 1 ? "" : "s"} que solo existen en este teléfono. ¿Querés subirlas a ${escapeHtml(destino)} para verlas en todos tus dispositivos${esEspacio ? " y que todo el equipo las vea" : ""}?</p>
      <div class="modal-actions" style="flex-direction:column;align-items:stretch;">
        <button class="primary" data-act="subir">Subir mis carpetas</button>
        <button class="secondary" data-act="no">No, empezar sin carpetas</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const cerrar = () => { overlay.remove(); MIGRACION_MOSTRANDO = false; };
  overlay.addEventListener("click", async (e) => {
    if (e.target === overlay) { cerrar(); return; }   // se cierra sin decidir: se vuelve a preguntar
    const act = e.target.dataset.act;
    if (!act) return;
    cerrar();
    MIGRACION_PENDIENTE = false;
    if (act === "subir") subirCarpetasLegacy();
    try { await window.idbGuardarMetaClave("migracionCarpetas:" + clave, act === "subir" ? "hecho" : "omitido"); } catch (err) {}
    if (act === "subir") renderPantallaProyectos(ULTIMO_PERMITIR_CERRAR, true);
  });
}
function subirCarpetasLegacy() {
  const user = usuarioCarpetas();
  const idsDelContexto = new Set(IDS_PROYECTOS_CTX);
  const validas = LEGACY_CARPETAS.carpetas.filter((c) => c && c.id && c.nombre);
  const cambios = {};
  validas.forEach((c) => {
    const carpeta = { id: c.id, nombre: c.nombre, padreId: c.padreId || null, creadoPor: user ? user.uid : "", creadoEn: c.creadoEn || new Date().toISOString() };
    CARPETAS.push(carpeta);
    cambios["carpetas." + c.id] = { nombre: carpeta.nombre, padreId: carpeta.padreId, creadoPor: carpeta.creadoPor, creadoEn: carpeta.creadoEn };
  });
  // Solo las asignaciones de proyectos que pertenecen a este contexto (las demás son de otro espacio).
  Object.keys(LEGACY_CARPETAS.asign).forEach((pid) => {
    const cid = LEGACY_CARPETAS.asign[pid];
    if (idsDelContexto.has(pid) && validas.some((c) => c.id === cid)) {
      CARPETA_ASIGNACIONES[pid] = cid;
      cambios["carpetaDeProyecto." + pid] = cid;
    }
  });
  if (!Object.keys(cambios).length) return;
  guardarCacheCarpetas();
  sincronizarCarpetas(cambios);
}

// ============================================================================
// Papelera y renombrado (fase 3)
// ----------------------------------------------------------------------------
// Eliminar un proyecto que está en la nube NO lo borra: lo manda a la papelera (campos eliminadoEn,
// eliminadoPor y eliminadoPorNombre en el documento liviano). Desaparece de la lista de todas las personas
// y se puede restaurar durante 30 días. Pasado ese plazo —o con "Eliminar definitivamente"— se borra de
// verdad (documentos y fotos). Pueden mandar a la papelera y restaurar: la persona dueña del proyecto, quien
// tiene permiso de edición y la dueña del espacio. Pueden borrar definitivamente: la dueña del proyecto y la
// dueña del espacio (las reglas de Firestore lo exigen).
// ============================================================================
const DIAS_PAPELERA = 30;
let PAPELERA = [];
const PURGANDO = new Set();
const PURGA_FALLIDA = new Set();
function marcaDeTiempoMs(v) {
  if (!v) return 0;
  if (typeof v.toMillis === "function") return v.toMillis();
  const t = new Date(v).getTime();
  return isNaN(t) ? 0 : t;
}
function diasDesde(ms) { return Math.floor((Date.now() - ms) / 86400000); }
function esErrorDePermiso(err) { return !!err && (err.code === "permission-denied" || /permission|insufficient/i.test(String(err.message || ""))); }
function dbProyecto(id) { return firebase.firestore().collection("proyectos").doc(id); }
async function enviarAPapelera(id) {
  const user = usuarioCarpetas();
  await dbProyecto(id).update({
    eliminadoEn: firebase.firestore.FieldValue.serverTimestamp(),
    eliminadoPor: user ? user.uid : "",
    eliminadoPorNombre: user ? (user.displayName || user.email || "") : "",
  });
}
async function restaurarDePapelera(id) {
  const borrar = firebase.firestore.FieldValue.delete;
  await dbProyecto(id).update({ eliminadoEn: borrar(), eliminadoPor: borrar(), eliminadoPorNombre: borrar() });
}
// Borra de verdad: primero se anotan las claves de las fotos (están en el documento pesado), luego se
// borran los documentos y por último las fotos de Storage (que no se pueden listar, solo borrar por clave).
async function purgarProyectoDeNube(id) {
  let claves = [];
  try {
    const v = window.fsDescargarUltimaVersion ? await window.fsDescargarUltimaVersion(id) : null;
    claves = Object.keys((v && v.imagenesUrls) || {});
  } catch (e) { claves = []; }
  await window.fsBorrarProyectoDeNube(id);
  if (window.fsBorrarFotosDeProyecto) await window.fsBorrarFotosDeProyecto(id, claves);
}
function purgarEnSegundoPlano(ids) {
  const pendientes = ids.filter((id) => !PURGANDO.has(id) && !PURGA_FALLIDA.has(id));
  if (!pendientes.length) return;
  pendientes.forEach((id) => PURGANDO.add(id));
  (async () => {
    for (const id of pendientes) {
      try { await purgarProyectoDeNube(id); }
      catch (e) { PURGA_FALLIDA.add(id); console.error("No se pudo borrar definitivamente " + id, e); }
      finally { PURGANDO.delete(id); }
    }
    programarRefrescoCarpetas(300);
  })();
}

async function versionLocalSincronizada(id) {
  try { const v = await window.idbLeerMetaClave("fsVersionLocal:" + id); return (v === undefined) ? null : v; } catch (e) { return null; }
}
// Cambia el nombre también DENTRO del contenido del proyecto en la nube: si solo se cambiara el campo
// liviano, el siguiente autoguardado de cualquier dispositivo lo volvería a pisar con el nombre viejo.
async function renombrarProyectoEnNube(id, nuevoNombre) {
  const d = firebase.firestore();
  const user = usuarioCarpetas();
  const ref = d.collection("proyectos").doc(id);
  const contRef = ref.collection("contenido").doc("data");
  return d.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { ok: false, motivo: "no-existe" };
    const dato = snap.data();
    if (dato.candado && dato.candado.uid && user && dato.candado.uid !== user.uid && !(window.candadoEstaVencido && window.candadoEstaVencido(dato.candado))) {
      return { ok: false, motivo: "candado", por: dato.candado.nombre || "otra persona" };
    }
    const embebido = Object.prototype.hasOwnProperty.call(dato, "payloadJson");
    const contSnap = embebido ? null : await tx.get(contRef);
    const payloadViejo = embebido ? dato.payloadJson : (contSnap && contSnap.exists ? contSnap.data().payloadJson : null);
    const versionAntes = dato.versionSync || 0;
    const versionNueva = versionAntes + 1;
    let payloadNuevo = payloadViejo;
    if (payloadViejo) {
      const obj = JSON.parse(payloadViejo);
      obj.projectInfo = Object.assign({}, obj.projectInfo, { nombre: nuevoNombre });
      payloadNuevo = JSON.stringify(obj);
    }
    const ahora = firebase.firestore.FieldValue.serverTimestamp();
    if (embebido) {
      tx.update(ref, { nombre: nuevoNombre, payloadJson: payloadNuevo, versionSync: versionNueva, actualizadoEn: ahora });
    } else {
      if (payloadNuevo) tx.update(contRef, { payloadJson: payloadNuevo, versionSync: versionNueva });
      tx.update(ref, { nombre: nuevoNombre, versionSync: versionNueva, actualizadoEn: ahora });
    }
    return { ok: true, versionAntes, versionNueva };
  });
}
async function renombrarProyectoLocal(id, nuevoNombre) {
  if (!window.idbLeerProyecto) return false;
  let data = null;
  try { data = await window.idbLeerProyecto(id); } catch (e) { data = null; }
  if (!data) return false;
  data.projectInfo = Object.assign({}, data.projectInfo, { nombre: nuevoNombre });
  data.guardadoEn = new Date().toISOString();
  await window.idbGuardarProyecto(id, data);
  if (id === window.PROYECTO_ACTIVO_ID && typeof PROJECT_INFO !== "undefined" && PROJECT_INFO) PROJECT_INFO.nombre = nuevoNombre;
  return true;
}
async function ejecutarRenombrarProyecto(id, nuevoNombre, deNube) {
  let remoto = null;
  if (deNube) {
    if (!navigator.onLine || !firestoreDisponibleCarpetas()) return { ok: false, motivo: "sin-conexion" };
    try { remoto = await renombrarProyectoEnNube(id, nuevoNombre); }
    catch (e) {
      console.error("No se pudo renombrar el proyecto en la nube", e);
      return { ok: false, motivo: esErrorDePermiso(e) ? "permiso" : "error" };
    }
    if (!remoto.ok) return remoto;
  }
  const local = await renombrarProyectoLocal(id, nuevoNombre);
  if (remoto && remoto.ok) {
    // Este dispositivo ya tiene el nombre nuevo: se anota la versión nueva para que no lo tome por un cambio ajeno.
    const vLocal = await versionLocalSincronizada(id);
    if (vLocal !== null && vLocal === remoto.versionAntes) { try { await window.idbGuardarMetaClave("fsVersionLocal:" + id, remoto.versionNueva); } catch (e) {} }
    if (id === window.PROYECTO_ACTIVO_ID && typeof PROYECTO_ACTIVO_FS_VERSION !== "undefined" && PROYECTO_ACTIVO_FS_VERSION === remoto.versionAntes) PROYECTO_ACTIVO_FS_VERSION = remoto.versionNueva;
  }
  return { ok: true, local };
}
function abrirModalRenombrarProyecto(id, nombreActual, deNube) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box">
      <p style="font-weight:600;margin:0 0 12px;">Renombrar proyecto</p>
      <input type="text" id="proy-renombrar-proyecto-nombre" value="${escapeHtml(nombreActual)}" style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1px solid var(--border);border-radius:8px;font-size:var(--fs-md);background:var(--surface-raised);color:var(--ink);margin-bottom:14px;" />
      <div class="modal-actions">
        <button class="secondary" data-act="cancel">Cancelar</button>
        <button class="primary" data-act="guardar">Guardar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const input = document.getElementById("proy-renombrar-proyecto-nombre");
  const btnGuardar = overlay.querySelector('[data-act="guardar"]');
  input.focus(); input.select();
  let guardando = false;
  const guardar = async () => {
    const nombre = input.value.trim();
    if (guardando || !nombre) return;
    if (nombre === nombreActual) { overlay.remove(); return; }
    guardando = true; btnGuardar.disabled = true; btnGuardar.textContent = "Guardando…";
    const r = await ejecutarRenombrarProyecto(id, nombre, deNube);
    if (!r.ok) {
      guardando = false; btnGuardar.disabled = false; btnGuardar.textContent = "Guardar";
      const msg = r.motivo === "candado" ? (r.por + " está editando este proyecto. Intentá de nuevo cuando termine.")
        : r.motivo === "sin-conexion" ? "Para renombrar un proyecto compartido necesitás conexión."
        : r.motivo === "permiso" ? "No tenés permiso para renombrar este proyecto."
        : r.motivo === "no-existe" ? "Este proyecto ya no está en la nube."
        : "No se pudo renombrar. Intentá de nuevo.";
      if (window.mostrarToast) mostrarToast(msg, "error");
      return;
    }
    overlay.remove();
    if (window.mostrarToast) mostrarToast("Proyecto renombrado.");
    renderPantallaProyectos(ULTIMO_PERMITIR_CERRAR, false);
  };
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") guardar(); });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay || e.target.dataset.act === "cancel") { if (!guardando) overlay.remove(); return; }
    if (e.target.dataset.act === "guardar") guardar();
  });
}

// Manda a la papelera un proyecto que está en la nube (para todas las personas que lo comparten).
function moverAPapelera(id) {
  const mensaje = "¿Mover este proyecto a la papelera? Desaparece para todas las personas que lo comparten. Se puede restaurar durante " + DIAS_PAPELERA + " días.";
  const hacer = async () => {
    const user = usuarioCarpetas();
    if (!user || !navigator.onLine || !firestoreDisponibleCarpetas()) {
      if (window.mostrarToast) mostrarToast("Para eliminar un proyecto compartido necesitás conexión.", "error");
      return;
    }
    PROYECTOS_BORRANDO.add(id);
    document.querySelectorAll('#pantalla-proyectos .proy-card[data-id="' + id.replace(/"/g, "") + '"]').forEach((el) => el.remove());
    try {
      await enviarAPapelera(id);
    } catch (err) {
      PROYECTOS_BORRANDO.delete(id);
      console.error("No se pudo mover el proyecto a la papelera", err);
      if (window.mostrarToast) {
        mostrarToast(esErrorDePermiso(err)
          ? "No se pudo eliminar: no tenés permiso, o alguien lo está editando ahora mismo."
          : "No se pudo eliminar el proyecto. Revisá tu conexión.", "error");
      }
      renderPantallaProyectos(ULTIMO_PERMITIR_CERRAR, false);
      return;
    }
    const eraActivo = (id === window.PROYECTO_ACTIVO_ID);
    if (eraActivo) {
      window.PROYECTO_ACTIVO_ID = null;
      if (typeof ROWS !== "undefined") { ROWS = []; ROWS_J = []; MANUAL_ITEMS = []; PLANOS = []; INFORMES_ACREDITACION = []; }
    }
    // La copia de este dispositivo ya no hace falta (al restaurar se vuelve a bajar de la nube).
    try { await window.idbBorrarProyecto(id); } catch (err) { console.error("No se pudo borrar la copia local:", err); }
    try { await window.idbGuardarMetaClave("fsVersionLocal:" + id, null); } catch (err) {}
    accionMoverProyecto(id, null);
    PROYECTOS_BORRANDO.delete(id);
    if (window.mostrarToast) mostrarToast("Proyecto movido a la papelera. Podés restaurarlo durante " + DIAS_PAPELERA + " días.");
    renderPantallaProyectos(eraActivo ? false : ULTIMO_PERMITIR_CERRAR, false);
  };
  if (window.pedirConfirmacion) pedirConfirmacion(mensaje, hacer);
  else if (confirm(mensaje)) hacer();
}

function abrirModalPapelera() {
  const user = usuarioCarpetas();
  const items = PAPELERA.filter((i) => i.puedeRestaurar || i.puedePurgar).sort((a, b) => b.eliminadoMs - a.eliminadoMs);
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  const fila = (i) => {
    const dias = diasDesde(i.eliminadoMs);
    const quedan = Math.max(0, DIAS_PAPELERA - dias);
    const quien = (user && i.porUid === user.uid) ? "vos" : (i.por || "otra persona");
    const cuando = dias <= 0 ? "hoy" : (dias === 1 ? "ayer" : "hace " + dias + " días");
    return `<div data-fila="${escapeHtml(i.id)}" style="padding:10px 0;border-top:1px solid var(--border);">
      <div style="font-weight:600;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(i.nombre)}</div>
      <div style="font-size:var(--fs-xs);color:var(--text-muted);margin:2px 0 8px;">Eliminado por ${escapeHtml(quien)} · ${cuando} · se borra definitivamente en ${quedan} ${quedan === 1 ? "día" : "días"}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${i.puedeRestaurar ? `<button class="secondary" data-act="restaurar" data-id="${escapeHtml(i.id)}">Restaurar</button>` : ""}
        ${i.puedePurgar ? `<button class="secondary" data-act="purgar" data-id="${escapeHtml(i.id)}" style="color:var(--peligro-t);">Eliminar definitivamente</button>` : ""}
      </div></div>`;
  };
  const hayPurgables = items.some((i) => i.puedePurgar);
  overlay.innerHTML = `
    <div class="modal-box" style="max-width:440px;width:calc(100% - 32px);">
      <p style="font-weight:600;margin:0 0 4px;">Papelera</p>
      <p style="margin:0 0 10px;font-size:var(--fs-xs);color:var(--text-muted);">Los proyectos eliminados se borran definitivamente a los ${DIAS_PAPELERA} días.</p>
      <div id="proy-papelera-lista" style="max-height:55vh;overflow:auto;">${items.map(fila).join("")}</div>
      <div class="modal-actions" style="margin-top:12px;">
        ${hayPurgables ? '<button class="secondary" data-act="vaciar" style="color:var(--peligro-t);">Vaciar papelera</button>' : ""}
        <button class="primary" data-act="cerrar">Cerrar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const quitarFila = (id) => {
    PAPELERA = PAPELERA.filter((x) => x.id !== id);
    const f = overlay.querySelector('[data-fila="' + id.replace(/"/g, "") + '"]'); if (f) f.remove();
    if (!overlay.querySelector("[data-fila]")) overlay.remove();
  };
  const avisoError = (txt) => { if (window.mostrarToast) mostrarToast(txt, "error"); };
  overlay.addEventListener("click", async (e) => {
    if (e.target === overlay || e.target.dataset.act === "cerrar") { overlay.remove(); return; }
    const act = e.target.dataset.act, id = e.target.dataset.id;
    if (!act) return;
    if (act === "restaurar") {
      e.target.disabled = true;
      try {
        await restaurarDePapelera(id);
        quitarFila(id);
        if (window.mostrarToast) mostrarToast("Proyecto restaurado.");
        renderPantallaProyectos(ULTIMO_PERMITIR_CERRAR, false);
      } catch (err) {
        console.error("No se pudo restaurar", err); e.target.disabled = false;
        avisoError(esErrorDePermiso(err) ? "No se pudo restaurar: no tenés permiso, o alguien lo está editando." : "No se pudo restaurar. Revisá tu conexión.");
      }
    } else if (act === "purgar") {
      const hacer = async () => {
        e.target.disabled = true;
        try { await purgarProyectoDeNube(id); quitarFila(id); renderPantallaProyectos(ULTIMO_PERMITIR_CERRAR, false); }
        catch (err) { console.error("No se pudo borrar definitivamente", err); e.target.disabled = false; avisoError("No se pudo borrar definitivamente. Revisá tu conexión o tus permisos."); }
      };
      const msg = "¿Eliminar definitivamente este proyecto? No se puede deshacer.";
      if (window.pedirConfirmacion) pedirConfirmacion(msg, hacer); else if (confirm(msg)) hacer();
    } else if (act === "vaciar") {
      const hacer = async () => {
        const ids = items.filter((i) => i.puedePurgar).map((i) => i.id);
        e.target.disabled = true;
        let fallaron = 0;
        for (const id2 of ids) { try { await purgarProyectoDeNube(id2); quitarFila(id2); } catch (err) { fallaron++; console.error("No se pudo borrar " + id2, err); } }
        if (fallaron) avisoError("No se pudieron borrar " + fallaron + " proyecto(s). Revisá tu conexión o tus permisos.");
        else if (window.mostrarToast) mostrarToast("Papelera vaciada.");
        renderPantallaProyectos(ULTIMO_PERMITIR_CERRAR, false);
      };
      const msg = "¿Vaciar la papelera? Se borran definitivamente los proyectos que tenés permiso de eliminar. No se puede deshacer.";
      if (window.pedirConfirmacion) pedirConfirmacion(msg, hacer); else if (confirm(msg)) hacer();
    }
  });
}

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
    accionCrearCarpeta(nombre, padreId);
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
    if (act === "sin-carpeta") accionMoverProyecto(proyectoId, null);
    else if (act.startsWith("carpeta:")) accionMoverProyecto(proyectoId, act.slice(8));
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

// Permite al DUEÑO de un proyecto (dentro de un espacio compartido) dar o
// quitar acceso de EDICIÓN a otros miembros del mismo espacio, uno por uno
// — antes esta infraestructura (fsCompartirProyecto/fsQuitarAcceso) existía
// del todo pero sin ningún botón que la usara desde que Espacios de Trabajo
// reemplazó el "compartir individual" de antes. Kevin, 08/09/2026: "no
// tengo una opción para... darle permiso a [x] a poder editar en alguno".
// Se elige de la lista de miembros del espacio (ya sabemos quién está ahí,
// vía fsListarMiembrosEspacio) — no hace falta escribir el correo a mano.
function abrirModalPermisosProyecto(proyectoId, nombreProyecto, espacioId) {
  if (!window.fsListarMiembrosEspacio || !window.fsCompartirProyecto || !window.fsQuitarAcceso || !window.fsObtenerEditoresProyecto) {
    if (window.mostrarToast) mostrarToast("Permisos de edición todavía no está disponible en esta versión.", "error");
    return;
  }
  const user = window.usuarioActual ? window.usuarioActual() : null;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box">
      <p style="font-weight:600;margin:0 0 4px;">Permisos de edición</p>
      <p style="font-size:var(--fs-sm);color:var(--text-muted);margin:0 0 12px;">${escapeHtml(nombreProyecto || "este proyecto")}</p>
      <div id="proy-permisos-lista"><p style="font-size:var(--fs-sm);color:var(--text-muted);">Cargando…</p></div>
      <div class="modal-actions">
        <button class="secondary" data-act="cancel">Cerrar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay || e.target.dataset.act === "cancel") { overlay.remove(); return; }
    const chk = e.target.closest("[data-permiso-uid]");
    if (!chk) return;
    const uid = chk.getAttribute("data-permiso-uid");
    const email = chk.getAttribute("data-permiso-email");
    const nombreMiembro = chk.getAttribute("data-permiso-nombre") || email;
    if (chk.checked) {
      chk.disabled = true;
      window.fsCompartirProyecto(proyectoId, nombreProyecto, email, "editor", user && user.email)
        .then(() => { if (window.mostrarToast) mostrarToast(`Invitación enviada — se activa apenas ${nombreMiembro} entre a la app.`); })
        .catch((err) => { chk.checked = false; if (window.mostrarToast) mostrarToast("No se pudo invitar: " + (err && err.message ? err.message : "probá de nuevo."), "error"); })
        .finally(() => { chk.disabled = false; });
    } else {
      chk.disabled = true;
      window.fsQuitarAcceso(proyectoId, uid)
        .then(() => { if (window.mostrarToast) mostrarToast(`Acceso de edición quitado a ${nombreMiembro}.`); })
        .catch((err) => { chk.checked = true; if (window.mostrarToast) mostrarToast("No se pudo quitar el acceso: " + (err && err.message ? err.message : "probá de nuevo."), "error"); })
        .finally(() => { chk.disabled = false; });
    }
  });
  Promise.all([
    window.fsListarMiembrosEspacio(espacioId),
    window.fsObtenerEditoresProyecto(proyectoId),
  ]).then(([miembros, editoresUids]) => {
    const cont = document.getElementById("proy-permisos-lista");
    if (!cont) return; // el modal ya se cerró antes de que llegara la respuesta
    const otros = miembros.filter((m) => !user || m.uid !== user.uid);
    if (!otros.length) {
      cont.innerHTML = `<p style="font-size:var(--fs-sm);color:var(--text-muted);">No hay más miembros en este espacio todavía.</p>`;
      return;
    }
    cont.innerHTML = otros.map((m) => `
      <div class="invitacion-espacio-fila">
        <div>
          <p class="invitacion-espacio-nombre">${escapeHtml(m.nombre || m.email || "Sin nombre")}</p>
          ${m.nombre && m.email ? `<p class="invitacion-espacio-sub">${escapeHtml(m.email)}</p>` : ""}
        </div>
        <label class="acr-checkbox-label" style="margin:0;white-space:nowrap">
          <input type="checkbox" data-permiso-uid="${escapeHtml(m.uid)}" data-permiso-email="${escapeHtml(m.email)}" data-permiso-nombre="${escapeHtml(m.nombre || m.email)}" ${editoresUids.includes(m.uid) ? "checked" : ""}>
          Puede editar
        </label>
      </div>`).join("");
  }).catch((e) => {
    const cont = document.getElementById("proy-permisos-lista");
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
      // Ya no está en este espacio: su carpeta de acá deja de aplicar (en el espacio nuevo arranca sin carpeta).
      accionMoverProyecto(proyectoId, null);
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

// Se llama desde el listener en vivo de invitaciones (ver
// escucharInvitacionesEnVivo en firebase-auth.js) cuando llega una
// invitación a un ESPACIO nueva mientras la app ya está abierta. Solo
// actualiza el dato en memoria y, si la Pantalla de Proyectos está abierta
// en este momento, la repinta (soloLocal=true, sin red) para que el badge
// aparezca al toque — unirse al espacio sigue siendo una acción manual
// ("Unirme a todas"), esto solo hace que la persona SEPA que ya está
// esperando, sin tener que recargar. Kevin, 08/09/2026.
function actualizarInvitacionesEspacioEnVivo(pendientes) {
  INVITACIONES_ESPACIO = pendientes || [];
  const overlay = document.getElementById("pantalla-proyectos");
  if (overlay && !overlay.hidden) {
    renderPantallaProyectos(ULTIMO_PERMITIR_CERRAR, true);
  }
}
window.actualizarInvitacionesEspacioEnVivo = actualizarInvitacionesEspacioEnVivo;

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
  if (PROYECTOS_BORRANDO.has(id)) return;
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
    // doc.nombre puede venir vacío en un proyecto REAL (tieneContenido:
    // true) si es de antes de que fsSubirCambios empezara a mantener el
    // nombre actualizado en el documento liviano, y esta es la PRIMERA
    // vez que este dispositivo lo ve (sin nombre cacheado localmente al
    // cual recurrir como respaldo). Sin este placeholder, un proyecto así
    // se clasifica como "borrador" — y los borradores se ESCONDEN por
    // completo dentro de un espacio compartido, así que el proyecto
    // desaparecía en cualquier dispositivo que nunca lo hubiera abierto
    // antes, aunque existiera perfectamente en Firestore. Kevin,
    // 08/09/2026: "en la desktop no sale Tibas, en todos los demás sí" —
    // esa desktop era la única que nunca lo había abierto localmente.
    const nombreVitrina = doc.nombre || (doc.tieneContenido ? "(Sin nombre — abrir para corregir)" : "");
    lista.push({
      id,
      data: {
        projectInfo: { nombre: nombreVitrina, cliente: doc.cliente || "" },
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

// Borra un proyecto o una carpeta. Para proyectos el borrado es optimista: la tarjeta desaparece YA y
// la limpieza (este dispositivo y la nube) sigue por detrás.
function borrarProyectoOCarpeta(id, esCarpeta, esPropio, modo) {
  const hacerBorrado = async () => {
    if (esCarpeta) {
      const carpeta = CARPETAS.find((c) => c.id === id);
      if (!carpeta || !puedeBorrarCarpeta(carpeta)) {
        if (window.mostrarToast) mostrarToast("Solo quien creó la carpeta o la persona dueña del espacio puede borrarla.", "error");
        return;
      }
      if (CARPETA_ACTIVA_ID === id) CARPETA_ACTIVA_ID = carpeta.padreId || null;
      accionBorrarCarpeta(id);
      renderPantallaProyectos(ULTIMO_PERMITIR_CERRAR, true);
      return;
    }
    PROYECTOS_BORRANDO.add(id);
    document.querySelectorAll('#pantalla-proyectos .proy-card[data-id="' + id.replace(/"/g, "") + '"]').forEach((el) => el.remove());
    const eraActivo = (id === window.PROYECTO_ACTIVO_ID);
    if (eraActivo) {
      // Se suelta de inmediato: así ningún autoguardado ni sincronización pendiente puede volver a
      // crear este proyecto mientras se limpia.
      window.PROYECTO_ACTIVO_ID = null;
      if (typeof ROWS !== "undefined") {
        ROWS = []; ROWS_J = []; MANUAL_ITEMS = []; PLANOS = []; INFORMES_ACREDITACION = [];
      }
    }
    try { await window.idbBorrarProyecto(id); } catch (err) { console.error("No se pudo borrar el proyecto:", err); }
    accionMoverProyecto(id, null);
    const user = window.usuarioActual ? window.usuarioActual() : null;
    const terminarLimpieza = () => {
      PROYECTOS_BORRANDO.delete(id);
      const ov = document.getElementById("pantalla-proyectos");
      if (ov && !ov.hidden) renderPantallaProyectos(ULTIMO_PERMITIR_CERRAR);
    };
    if (user && modo !== "local" && modo !== "zombi") {
      (async () => {
        try {
          if (window.fsBorrarProyectoDeNube) await window.fsBorrarProyectoDeNube(id);
          if (window.fsBorrarFotosDeProyecto) await window.fsBorrarFotosDeProyecto(id);
        } catch (err) {
          console.error("No se pudo borrar en la nube:", err);
          if (window.mostrarToast) mostrarToast("Se borró en este dispositivo. Revisá tu conexión: puede tardar en desaparecer de la nube.", "error");
        }
        terminarLimpieza();
      })();
    } else {
      terminarLimpieza();
    }
    if (eraActivo) renderPantallaProyectos(false);
  };
  const mensaje = esCarpeta
    ? "¿Borrar esta carpeta? Los proyectos y subcarpetas que tenga adentro NO se borran, vuelven a la lista general."
    : (modo === "zombi" ? "¿Quitar este proyecto de este teléfono? Ya no está en la nube, así que no se puede recuperar desde otro lado."
      : modo === "local" ? "¿Borrar este proyecto? Solo existe en este teléfono (no está en la nube). No se puede deshacer."
      : "¿Borrar este proyecto? Se borra también de la nube y de todos tus dispositivos. No se puede deshacer.");
  if (window.pedirConfirmacion) pedirConfirmacion(mensaje, hacerBorrado);
  else if (confirm(mensaje)) hacerBorrado();
}

async function renderPantallaProyectos(permitirCerrar, soloLocal) {
  ULTIMO_PERMITIR_CERRAR = permitirCerrar;
  ligarClickGlobalUnaVez();
  cerrarMenuFlotante();
  const overlay = crearOverlaySiHaceFalta();
  // Las consultas a Firestore salen TODAS A LA VEZ, antes de leer el estado local. Antes iban
  // una detrás de otra (unos 1,3 s sumadas en una compu con buena señal; mucho más en celular).
  // Cada una devuelve { ok, valor | error } para que un fallo se siga registrando igual que antes
  // sin tumbar a las demás.
  const userPre = (!soloLocal && window.usuarioActual) ? window.usuarioActual() : null;
  let prefetch = null;
  if (userPre) {
    let espacioPre = null;
    try { espacioPre = (await window.idbLeerMetaClave("espacioActivoId")) || null; } catch (e) { espacioPre = null; }
    const intentar = (fn) => (async () => { try { return { ok: true, valor: await fn() }; } catch (e) { return { ok: false, error: e }; } })();
    prefetch = {
      espacioId: espacioPre,
      conmigo: window.fsListarProyectosCompartidosConmigo ? intentar(async () => {
        if (window.invitacionesResueltas) {
          await Promise.race([window.invitacionesResueltas(), new Promise((r) => setTimeout(r, 4000))]);
        }
        return window.fsListarProyectosCompartidosConmigo(userPre.uid);
      }) : null,
      mios: window.fsListarMisProyectosCompartidos ? intentar(() => window.fsListarMisProyectosCompartidos(userPre.uid)) : null,
      deEspacio: (espacioPre && window.fsListarProyectosDeEspacio) ? intentar(() => window.fsListarProyectosDeEspacio(espacioPre)) : null,
      // Carpetas de "Propio" (documento de la persona): sale junto con las demás consultas.
      carpetasUsuario: (!espacioPre && firestoreDisponibleCarpetas()) ? intentar(() => leerCarpetasUsuario(userPre.uid)) : null,
    };
  }
  await cargarEstadoOrganizacion(soloLocal, prefetch);

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
  lista = lista.filter((p) => !PROYECTOS_BORRANDO.has(p.id));

  const idsCompartidos = new Set();
  // Qué proyectos existen en la nube y sus datos (dueño, editores, espacio): sirven para las etiquetas
  // (Compartido / Solo lectura / Solo en este teléfono) y para decidir qué opciones muestra el menú ⋯.
  const docsRemotos = {};
  const idsEnNube = new Set();

  const candadosAjenosPorProyecto = {};
  const user = window.usuarioActual ? window.usuarioActual() : null;
  // Arranca con lo último conocido localmente (funciona incluso offline);
  // los 3 bloques remotos de abajo lo actualizan con el dato real cuando
  // hay conexión.
  const espacioIdConocido = Object.assign({}, ESPACIO_POR_PROYECTO_LOCAL);
  // Solo se afirma "Solo en este teléfono" si las consultas a la nube se hicieron TODAS y salieron bien.
  let nubeCompleta = !soloLocal && !!user && !!prefetch && !!prefetch.conmigo && !!prefetch.mios
    && (!ESPACIO_ACTIVO_ID || (!!window.fsListarProyectosDeEspacio && !!prefetch.deEspacio && prefetch.espacioId === ESPACIO_ACTIVO_ID));
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

  if (!soloLocal && user && prefetch && prefetch.conmigo) {
    try {
      const resConmigo = await prefetch.conmigo;
      if (!resConmigo.ok) throw resConmigo.error;
      const remotos = resConmigo.valor;
      for (const remoto of remotos) {
        docsRemotos[remoto.id] = remoto; idsEnNube.add(remoto.id);
        if (remoto.eliminadoEn) continue;   // en la papelera: no va a la lista
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
      nubeCompleta = false;
      console.error("No se pudieron traer los proyectos compartidos conmigo (editoresUids)", e);
    }
  }

  if (!soloLocal && user && prefetch && prefetch.mios) {
    try {
      const resMios = await prefetch.mios;
      if (!resMios.ok) throw resMios.error;
      const mios = resMios.valor;
      for (const doc of mios) {
        docsRemotos[doc.id] = doc; idsEnNube.add(doc.id);
        if (doc.eliminadoEn) continue;   // en la papelera: no va a la lista
        registrarCandadoAjeno(doc);
        espacioIdConocido[doc.id] = doc.espacioId || null;
        ESPACIO_POR_PROYECTO_LOCAL[doc.id] = doc.espacioId || null;
        permisoEdicionConocido[doc.id] = true;
        actualizarMetadataListadoSiHaceFalta(doc, lista);
      }
    } catch (e) {
      nubeCompleta = false;
      console.error("No se pudieron traer mis proyectos (ownerId)", e);
    }
  }

  if (!soloLocal && ESPACIO_ACTIVO_ID && window.fsListarProyectosDeEspacio) {
    try {
      // Si el espacio activo es el mismo que se pidió por adelantado, se reusa esa consulta;
      // si cambió (o no había), se pide ahora como antes.
      let deEspacio;
      if (prefetch && prefetch.deEspacio && prefetch.espacioId === ESPACIO_ACTIVO_ID) {
        const resEsp = await prefetch.deEspacio;
        if (!resEsp.ok) throw resEsp.error;
        deEspacio = resEsp.valor;
      } else {
        deEspacio = await window.fsListarProyectosDeEspacio(ESPACIO_ACTIVO_ID);
      }
      for (const doc of deEspacio) {
        docsRemotos[doc.id] = doc; idsEnNube.add(doc.id);
        if (doc.eliminadoEn) continue;   // en la papelera: no va a la lista
        espacioIdConocido[doc.id] = ESPACIO_ACTIVO_ID;
        ESPACIO_POR_PROYECTO_LOCAL[doc.id] = ESPACIO_ACTIVO_ID;
        registrarCandadoAjeno(doc);
        const esDuenoDeEste = !!(user && doc.ownerId === user.uid);
        if (!esDuenoDeEste) idsCompartidos.add(doc.id);
        // La persona dueña del espacio puede editar TODO lo que hay en él.
        const espDoc = ESPACIOS.find((x) => x.id === ESPACIO_ACTIVO_ID);
        const esDuenoDelEspacio = !!(user && espDoc && espDoc.creadoPor === user.uid);
        permisoEdicionConocido[doc.id] = esDuenoDeEste || esDuenoDelEspacio || (Array.isArray(doc.editoresUids) && !!user && doc.editoresUids.includes(user.uid));
        actualizarMetadataListadoSiHaceFalta(doc, lista);
      }
    } catch (e) {
      nubeCompleta = false;
      console.error("No se pudieron traer los proyectos del espacio activo (" + ESPACIO_ACTIVO_ID + ")", e);
    }
  }

  if (!soloLocal) guardarEspacioPorProyectoLocal();

  // Papelera: proyectos que alguien mandó a la papelera (de este espacio o de Propio). También se esconden
  // las copias que este dispositivo todavía tenga de ellos. En el pase local (sin datos de la nube) se
  // conserva la papelera del pase anterior para que no parpadee.
  if (!soloLocal) {
    const ctxPerm = { user, docs: docsRemotos, espacios: ESPACIOS, permisos: permisoEdicionConocido };
    PAPELERA = Object.values(docsRemotos)
      .filter((d) => d.eliminadoEn && (ESPACIO_ACTIVO_ID ? d.espacioId === ESPACIO_ACTIVO_ID : !d.espacioId))
      .map((d) => {
        const p = permisosDeProyecto(d.id, ctxPerm);
        return { id: d.id, nombre: d.nombre || "(sin nombre)", eliminadoMs: marcaDeTiempoMs(d.eliminadoEn), por: d.eliminadoPorNombre || "", porUid: d.eliminadoPor || "", puedeRestaurar: p.puedeEditar, puedePurgar: p.esDueno || p.esDuenoEspacio };
      });
    lista = lista.filter((p) => !(docsRemotos[p.id] && docsRemotos[p.id].eliminadoEn));
    // Pasados los 30 días se borran solos (los hace el primer dispositivo con permiso que abra la lista).
    if (nubeCompleta) purgarEnSegundoPlano(PAPELERA.filter((i) => i.puedePurgar && diasDesde(i.eliminadoMs) >= DIAS_PAPELERA).map((i) => i.id));
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

  IDS_PROYECTOS_CTX = conNombre.map((p) => p.id);
  const proyectosVisibles = CARPETA_ACTIVA_ID
    ? conNombre.filter(p => carpetaDe(p.id) === CARPETA_ACTIVA_ID)
    : conNombre.filter(p => !carpetaDe(p.id));
  const proyectosOrdenados = ordenarProyectos(proyectosVisibles, MODO_ORDEN, CARPETA_ACTIVA_ID);

  const carpetasVisibles = CARPETAS.filter(c => (c.padreId || null) === CARPETA_ACTIVA_ID);
  const carpetasOrdenadas = ordenarCarpetas(carpetasVisibles, MODO_ORDEN);
  borradores.sort((a, b) => new Date(b.data.creadoEn || b.data.guardadoEn || 0) - new Date(a.data.creadoEn || a.data.guardadoEn || 0));

  const nombreEspacioActivo = ESPACIO_ACTIVO_ID
    ? ((ESPACIOS.find((e) => e.id === ESPACIO_ACTIVO_ID) || {}).nombre || "Espacio")
    : "Propio";
  const breadcrumb = carpetaActiva
    ? `<button type="button" class="proy-breadcrumb" id="proy-btn-volver-carpeta"><svg class="icon"><use href="#i-arrow-left"/></svg>${escapeHtml(carpetaActiva.nombre)}</button>`
    : "";

  asegurarIconosProyectos();
  // Si el buscador tenía foco o texto, se conserva a través del redibujo (la lista se vuelve a pintar
  // cuando llegan los datos de la nube).
  const buscadorPrevio = document.getElementById("proy-buscador");
  const buscadorTeniaFoco = !!buscadorPrevio && document.activeElement === buscadorPrevio;
  const buscadorCaret = buscadorPrevio ? buscadorPrevio.selectionStart : null;
  if (buscadorPrevio) BUSQUEDA_TEXTO = buscadorPrevio.value;

  // "Sincronizado antes" = este dispositivo llegó a sincronizar el proyecto con la nube. Si ya no está en
  // la nube, lo borró otra persona (o ya no tengo acceso): es una copia suelta que no debe volver a subirse.
  const sincronizados = new Set();
  await Promise.all(conNombre.concat(borradores).map(async (p) => { if ((await versionLocalSincronizada(p.id)) !== null) sincronizados.add(p.id); }));
  const zombis = new Set();
  if (nubeCompleta) conNombre.forEach((p) => { if (sincronizados.has(p.id) && !idsEnNube.has(p.id)) zombis.add(p.id); });
  const ctxLista = { user, enNube: idsEnNube, nubeCompleta, docs: docsRemotos, espacios: ESPACIOS, candados: candadosAjenosPorProyecto, permisos: permisoEdicionConocido, sincronizados, zombis };

  const controlOrden = `
    <div class="proy-orden-control">
      <button type="button" class="proy-orden-btn${MODO_ORDEN === "az" ? " active" : ""}" data-orden="az">A-Z</button>
      <button type="button" class="proy-orden-btn${MODO_ORDEN === "reciente" ? " active" : ""}" data-orden="reciente">Reciente</button>
    </div>`;

  const hayAlgoQueMostrar = carpetasOrdenadas.length || proyectosOrdenados.length;
  // "Nueva carpeta" vive arriba, a la derecha, en la misma fila que A-Z / Reciente (con la lista
  // vacía no hay selector de orden: queda sola a la derecha). En pantallas angostas el texto se
  // acorta a "Carpeta" (ver styles.css).
  const btnNuevaCarpeta = puedeCrearSubcarpeta
    ? `<button type="button" class="proy-btn-nueva-carpeta proy-btn-nueva-carpeta-arriba" id="proy-btn-nueva-carpeta" aria-label="Nueva carpeta"><svg class="icon"><use href="#i-plus"/></svg><span class="proy-nc-largo">Nueva carpeta</span><span class="proy-nc-corto">Carpeta</span></button>`
    : "";
  const filaControles = (hayAlgoQueMostrar || btnNuevaCarpeta)
    ? `<div class="proy-orden-fila${hayAlgoQueMostrar ? "" : " proy-orden-fila-solo-boton"}">${hayAlgoQueMostrar ? controlOrden : ""}${btnNuevaCarpeta}</div>`
    : "";

  const enRaiz = !CARPETA_ACTIVA_ID;
  const buscadorHTML = (enRaiz && conNombre.length)
    ? `<div class="proy-buscador">${icoPx("search")}<input type="search" id="proy-buscador" placeholder="Buscar proyecto o cliente" autocomplete="off" value="${escapeHtml(BUSQUEDA_TEXTO)}" /><button type="button" id="proy-buscador-limpiar" class="proy-buscador-limpiar" aria-label="Borrar búsqueda"${BUSQUEDA_TEXTO ? "" : " hidden"}>${icoPx("x")}</button></div>`
    : "";
  // Recientes: los últimos 3 por fecha de actualización (de todo el espacio, estén o no en carpetas).
  // Solo se muestran cuando aportan algo: hay proyectos metidos en carpetas o hay más de 3.
  const recientes = ordenarProyectos(conNombre, "reciente", null).slice(0, 3);
  const hayProyectosEnCarpetas = conNombre.some((p) => carpetaDe(p.id));
  const mostrarRecientes = enRaiz && recientes.length > 0 && (hayProyectosEnCarpetas || conNombre.length > 3);
  const seccionRecientes = mostrarRecientes
    ? `<p class="proy-sec-label">Recientes</p><div class="proy-lista">${recientes.map((p) => tarjetaProyectoNuevaHTML(p.id, p.data, ctxLista, { mostrarCarpeta: true })).join("")}</div>`
    : "";
  const seccionCarpetas = carpetasOrdenadas.length
    ? `<p class="proy-sec-label">${carpetaActiva ? "Subcarpetas" : "Carpetas"}</p><div class="proy-grupo">${carpetasOrdenadas.map((c) => filaCarpetaHTML(c, conNombre.filter((p) => CARPETA_ASIGNACIONES[p.id] === c.id).length)).join("")}</div>`
    : "";
  const etiquetaProyectos = carpetaActiva ? "Proyectos" : ((carpetasOrdenadas.length || mostrarRecientes) ? "Sin carpeta" : "Tus proyectos");
  const seccionProyectos = proyectosOrdenados.length
    ? `<p class="proy-sec-label">${etiquetaProyectos}</p><div class="proy-lista" id="proy-lista-principal">${proyectosOrdenados.map((p) => tarjetaProyectoNuevaHTML(p.id, p.data, ctxLista)).join("")}</div>`
    : "";
  const seccionBorradores = (enRaiz && borradores.length)
    ? `<details class="proy-borradores" id="proy-borradores"${BORRADORES_ABIERTO ? " open" : ""}><summary>${icoPx("file")}<span>${borradores.length === 1 ? "1 borrador sin nombre" : borradores.length + " borradores sin nombre"}</span><svg class="icon proy-borradores-flecha" aria-hidden="true"><use href="#i-chevron-down"/></svg></summary><div class="proy-lista proy-borradores-lista">${borradores.map((p) => filaBorradorHTML(p.id, p.data)).join("")}</div></details>`
    : "";
  // Resultados de búsqueda: todos los proyectos con nombre del espacio, en una lista plana. Se
  // muestran/ocultan al escribir, sin volver a dibujar la pantalla.
  const resultadosBusqueda = (enRaiz && conNombre.length)
    ? `<div id="proy-resultados" hidden><div class="proy-lista">${ordenarProyectos(conNombre, MODO_ORDEN, null).map((p) => tarjetaProyectoNuevaHTML(p.id, p.data, ctxLista, { mostrarCarpeta: true })).join("")}</div><p class="proy-sin-resultados" id="proy-sin-resultados" hidden>No hay proyectos que coincidan.</p></div>`
    : "";
  // Mientras soloLocal=true (pase instantáneo) todavía no sabemos si hay proyectos compartidos/de
  // espacio por llegar de Firestore — mostrar "Todavía no tenés proyectos" en ese momento es mentirle
  // al usuario por unos segundos. En vez de eso, un esqueleto de carga; el mensaje real de "vacío" solo
  // se muestra en el pase remoto (soloLocal=false), cuando ya se confirmó que de verdad no hay nada.
  const vacio = (!hayAlgoQueMostrar && !borradores.length)
    ? (soloLocal
        ? `<div class="proy-cargando-spinner-wrap" aria-hidden="true"><div class="proy-cargando-spinner"></div><span>Cargando proyectos…</span></div>`
        : `<div class="proy-vacio"><svg class="icon proy-vacio-icono"><use href="#i-folder"/></svg><p>Todavía no tenés proyectos.<br>Creá el primero con el botón de abajo.</p></div>`)
    : "";
  const accionablesPapelera = PAPELERA.filter((i) => i.puedeRestaurar || i.puedePurgar);
  const seccionPapelera = (enRaiz && accionablesPapelera.length)
    ? `<button type="button" id="proy-papelera-btn" style="display:flex;align-items:center;gap:8px;width:100%;max-width:560px;margin-top:10px;border:1px dashed var(--border);border-radius:12px;padding:11px 12px;font-size:var(--fs-sm);color:var(--text-secondary);cursor:pointer;background:transparent;font-family:inherit;text-align:left;">${icoPx("trash")}<span style="flex:1;">Papelera · ${accionablesPapelera.length}</span><svg class="icon" aria-hidden="true"><use href="#i-chevron-right"/></svg></button>`
    : "";
  const cuerpoHTML = `${buscadorHTML}<div id="proy-vista-normal">${filaControles}${seccionRecientes}${seccionCarpetas}${seccionProyectos}${seccionBorradores}${seccionPapelera}${vacio}</div>${resultadosBusqueda}`;

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
        ${cuerpoHTML}
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

  // --- Buscador
  const inputBuscar = document.getElementById("proy-buscador");
  const vistaNormal = document.getElementById("proy-vista-normal");
  const vistaResultados = document.getElementById("proy-resultados");
  const btnLimpiarBusqueda = document.getElementById("proy-buscador-limpiar");
  const aplicarBusqueda = () => {
    BUSQUEDA_TEXTO = inputBuscar ? inputBuscar.value : "";
    if (btnLimpiarBusqueda) btnLimpiarBusqueda.hidden = !BUSQUEDA_TEXTO;
    if (!vistaResultados || !vistaNormal) return;
    const palabras = normalizarBusqueda(BUSQUEDA_TEXTO).split(/\s+/).filter(Boolean);
    if (!palabras.length) { vistaResultados.hidden = true; vistaNormal.hidden = false; return; }
    vistaNormal.hidden = true; vistaResultados.hidden = false;
    let visibles = 0;
    vistaResultados.querySelectorAll(".proy-card").forEach((c) => {
      const hay = c.getAttribute("data-buscar") || "";
      const ok = palabras.every((w) => hay.includes(w));
      c.hidden = !ok; if (ok) visibles++;
    });
    const sin = document.getElementById("proy-sin-resultados"); if (sin) sin.hidden = visibles > 0;
  };
  if (inputBuscar) {
    inputBuscar.addEventListener("input", aplicarBusqueda);
    if (btnLimpiarBusqueda) btnLimpiarBusqueda.addEventListener("click", () => { inputBuscar.value = ""; aplicarBusqueda(); inputBuscar.focus(); });
    aplicarBusqueda();
    if (buscadorTeniaFoco) { inputBuscar.focus(); try { inputBuscar.setSelectionRange(buscadorCaret, buscadorCaret); } catch (e) {} }
  }

  // --- Abrir proyecto / entrar a carpeta
  overlay.querySelectorAll('.proy-card[data-tipo="proyecto"]').forEach((card) => {
    card.addEventListener("click", async (e) => {
      if (e.target.closest(".proy-card-menu-btn")) return;
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
  overlay.querySelectorAll(".proy-carpeta-fila").forEach((fila) => {
    fila.addEventListener("click", (e) => {
      if (e.target.closest(".proy-card-menu-btn")) return;
      CARPETA_ACTIVA_ID = fila.getAttribute("data-id");
      renderPantallaProyectos(permitirCerrar);
    });
  });

  // --- Menú ⋯ (las opciones dependen del permiso de cada persona sobre cada proyecto)
  const construirItemsMenu = (id, tipo) => {
    const items = []; let n = 0;
    if (tipo === "carpeta") {
      items.push({ i: n++, icono: "pencil", texto: "Renombrar", accion: () => abrirModalRenombrarCarpeta(id) });
      // Borrar: solo quien creó la carpeta o la persona dueña del espacio.
      if (puedeBorrarCarpeta(CARPETAS.find((c) => c.id === id))) {
        items.push({ sep: true });
        items.push({ i: n++, icono: "trash", texto: "Eliminar carpeta", peligro: true, accion: () => borrarProyectoOCarpeta(id, true, true) });
      }
      return items;
    }
    if (tipo === "borrador") {
      // Un borrador que nunca llegó a la nube se borra solo de este teléfono (antes intentaba borrarlo también
      // de la nube, fallaba y avisaba "revisá tu conexión" sin que hubiera ningún problema).
      const soloAqui = ctxLista.nubeCompleta && !ctxLista.docs[id] && !ctxLista.sincronizados.has(id);
      items.push({ i: n++, icono: "trash", texto: "Eliminar", peligro: true, accion: () => borrarProyectoOCarpeta(id, false, true, soloAqui ? "local" : undefined) });
      return items;
    }
    const perm = permisosDeProyecto(id, ctxLista);
    const entrada = lista.find((x) => x.id === id);
    const nombre = (entrada && entrada.data && entrada.data.projectInfo && entrada.data.projectInfo.nombre) || "";
    const espacioDe = espacioIdConocido[id] || "";
    const zombi = ctxLista.zombis.has(id);
    const deNube = !zombi && (!!ctxLista.docs[id] || ctxLista.sincronizados.has(id));
    const ocupado = !!candadosAjenosPorProyecto[id];
    items.push({ i: n++, icono: "folder", texto: "Mover a carpeta", accion: () => abrirModalMoverACarpeta(id) });
    if (zombi) {
      // Ya no está en la nube: solo se puede quitar de este teléfono (o abrir y hacer una copia editable).
      items.push({ sep: true });
      items.push({ i: n++, icono: "trash", texto: "Quitar de este teléfono", peligro: true, accion: () => borrarProyectoOCarpeta(id, false, true, "zombi") });
      return items;
    }
    // Renombrar y eliminar: quien tiene permiso de edición (dueña del proyecto, editores y dueña del espacio).
    if (perm.puedeEditar) {
      items.push({ i: n++, icono: "pencil", texto: ocupado ? "Renombrar (alguien lo está editando)" : "Renombrar", deshabilitado: ocupado, accion: () => abrirModalRenombrarProyecto(id, nombre, deNube) });
    }
    if (perm.esDueno) {
      items.push({ i: n++, icono: "switch", texto: ocupado ? "Mover de espacio (alguien lo está editando)" : "Mover de espacio de trabajo", deshabilitado: ocupado, accion: () => abrirModalMoverDeEspacio(id) });
    }
    if ((perm.esDueno || perm.esDuenoEspacio) && espacioDe) {
      items.push({ i: n++, icono: "user-check", texto: "Permisos", accion: () => abrirModalPermisosProyecto(id, nombre, espacioDe) });
    }
    // Nadie puede "quitar de su lista" un proyecto ajeno: si algo se elimina, es para todas las personas.
    // En la nube va a la papelera; si solo existe en este teléfono se borra de verdad.
    if (perm.puedeEditar) {
      items.push({ sep: true });
      items.push({ i: n++, icono: "trash", texto: ocupado ? "Eliminar (alguien lo está editando)" : (deNube ? "Mover a la papelera" : "Eliminar"), peligro: true, deshabilitado: ocupado,
        accion: () => (deNube ? moverAPapelera(id) : borrarProyectoOCarpeta(id, false, true, "local")) });
    }
    return items;
  };
  overlay.querySelectorAll(".proy-card-menu-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-id"), tipo = btn.getAttribute("data-tipo");
      const abierto = document.getElementById("proy-menu-flotante");
      const mismo = !!abierto && abierto.getAttribute("data-de") === id + ":" + tipo;
      cerrarMenuFlotante();
      if (mismo) return;
      abrirMenuFlotante(btn, construirItemsMenu(id, tipo));
      const m = document.getElementById("proy-menu-flotante");
      if (m) m.setAttribute("data-de", id + ":" + tipo);
    });
  });
  const cuerpoScroll = overlay.querySelector(".proy-body-full");
  if (cuerpoScroll) cuerpoScroll.addEventListener("scroll", cerrarMenuFlotante, { passive: true });

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
  const btnPapelera = document.getElementById("proy-papelera-btn");
  if (btnPapelera) btnPapelera.addEventListener("click", abrirModalPapelera);
  const detBorradores = document.getElementById("proy-borradores");
  if (detBorradores) detBorradores.addEventListener("toggle", () => { BORRADORES_ABIERTO = detBorradores.open; });

  if (!soloLocal && !overlay.hidden) {
    asegurarListenerCarpetas();
    ofrecerMigracionCarpetas();
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
    const btnFabNuevo = document.getElementById("proy-fab-menu-nuevo");
    if (btnFabNuevo) btnFabNuevo.addEventListener("click", async () => {
      proyFabMenu.classList.remove("open");
      // Doble toque: si ya se está creando uno, el segundo toque no crea otro (antes salían dos
      // proyectos vacíos idénticos en Borradores).
      if (CREANDO_PROYECTO) return;
      CREANDO_PROYECTO = true;
      try {
        const nuevoId = await window.crearYAbrirProyectoNuevo();
        if (CARPETA_ACTIVA_ID && nuevoId) {
          accionMoverProyecto(nuevoId, CARPETA_ACTIVA_ID);
        }
        ocultarPantallaProyectos();
      } finally {
        CREANDO_PROYECTO = false;
      }
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
        // Dos aperturas casi seguidas (doble toque) no importan el archivo dos veces.
        const ahoraMs = Date.now();
        if (ahoraMs - ULTIMA_APERTURA_ARCHIVO_MS < 2500) return;
        ULTIMA_APERTURA_ARCHIVO_MS = ahoraMs;
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
    conectarBotonesPopup(popup);
  }
}

function ocultarPantallaProyectos() {
  const overlay = document.getElementById("pantalla-proyectos");
  if (!overlay) return;
  detenerListenerCarpetas();
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
// ¿Soy la persona dueña del espacio al que pertenece este proyecto? La dueña del espacio puede
// editar TODO lo que hay en él, aunque el proyecto sea de otra persona. Se usa al abrir un proyecto
// (archivo-estado-app.js). Si no se puede saber (el proyecto nunca se vio en una lista con conexión),
// responde false: se abre en solo lectura, que es lo seguro.
window.soyDuenoDelEspacioDelProyecto = async function (proyectoId) {
  const user = window.usuarioActual ? window.usuarioActual() : null;
  if (!user || !proyectoId) return false;
  let espacioId = ESPACIO_POR_PROYECTO_LOCAL[proyectoId];
  if (espacioId === undefined && window.idbLeerMetaClave) {
    try {
      const guardado = (await window.idbLeerMetaClave("espacioPorProyecto")) || {};
      espacioId = guardado[proyectoId];
    } catch (e) { espacioId = undefined; }
  }
  if (!espacioId) return false;
  let espacios = ESPACIOS;
  if ((!espacios || !espacios.find((e) => e.id === espacioId)) && window.fsListarMisEspacios) {
    try { espacios = await window.fsListarMisEspacios(user.uid); } catch (e) { return false; }
  }
  const esp = (espacios || []).find((e) => e.id === espacioId);
  return !!(esp && esp.creadoPor === user.uid);
};
window.registrarEspacioLocalDeProyectoNuevo = function (id, espacioId) {
  if (!id) return;
  ESPACIO_POR_PROYECTO_LOCAL[id] = espacioId || null;
  guardarEspacioPorProyectoLocal();
};

})();
