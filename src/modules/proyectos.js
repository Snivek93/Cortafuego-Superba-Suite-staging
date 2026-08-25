// ============================================================================
// proyectos.js — Pantalla de Proyectos (pantalla completa, multi-proyecto)
// ============================================================================
// Depende de funciones expuestas por archivo-estado-app.js:
// idbListarProyectos, idbBorrarProyecto, abrirProyectoExistente,
// crearYAbrirProyectoNuevo, PROYECTO_ACTIVO_ID — y de firebase-auth.js:
// usuarioActual, iniciales, abrirEditarPerfil, cerrarSesion. El orden de
// <script> no importa: todo se usa desde manejadores de eventos, después de
// que los archivos ya terminaron de ejecutarse.
(function () {

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

function tarjetaHTML(id, data, esBorrador) {
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
  return `
    <div class="proy-card${esBorrador ? " proy-card-borrador" : ""}" data-id="${escapeHtml(id)}">
      <div class="proy-card-info">
        <p class="proy-card-nombre">${escapeHtml(nombre)}</p>
        <p class="proy-card-sub">${escapeHtml(sub)}</p>
      </div>
      <div class="proy-card-right">
        <button type="button" class="proy-card-borrar" data-id="${escapeHtml(id)}" title="Borrar proyecto" aria-label="Borrar proyecto">
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
  const temaActual = window.temaLeerPreferencia ? window.temaLeerPreferencia() : "auto";
  const temaLabel = { auto: "Automático", light: "Claro", dark: "Oscuro" }[temaActual] || "Automático";
  return `
      <div class="proy-account-popup-head">
        <div class="proy-account-avatar">${escapeHtml(ini)}</div>
        <div class="proy-account-info">
          <p class="proy-account-name">${escapeHtml(nombre)}</p>
          <p class="proy-account-email">${escapeHtml(user.email || "")}</p>
        </div>
      </div>
      <button type="button" class="proy-account-item" id="proy-btn-editar-perfil"><svg class="icon"><use href="#i-edit"/></svg>Editar perfil</button>
      <button type="button" class="proy-account-item" id="proy-btn-tema"><svg class="icon"><use href="#i-gear"/></svg>Tema<span class="proy-account-item-hint">${escapeHtml(temaLabel)} ›</span></button>
      <button type="button" class="proy-account-item" id="proy-btn-acerca-de"><svg class="icon"><use href="#i-clipboard"/></svg>Acerca de</button>
      <div class="dropdown-sep"></div>
      <button type="button" class="proy-account-item proy-account-item-danger" id="proy-btn-logout"><svg class="icon"><use href="#i-close"/></svg>Cerrar sesión</button>`;
}
function popupCuentaHTML() {
  if (!(window.usuarioActual && window.usuarioActual())) return "";
  return `<div class="proy-account-popup" id="proy-account-popup" hidden>${popupCuentaContenidoHTML()}</div>`;
}

function conectarBotonesPopup(popup) {
  const btnEditarPerfil = document.getElementById("proy-btn-editar-perfil");
  if (btnEditarPerfil) btnEditarPerfil.addEventListener("click", () => { popup.hidden = true; if (window.abrirEditarPerfil) window.abrirEditarPerfil(); });
  const btnTema = document.getElementById("proy-btn-tema");
  if (btnTema) btnTema.addEventListener("click", () => { popup.hidden = true; if (window.abrirConfig) window.abrirConfig(); });
  const btnAcercaDe = document.getElementById("proy-btn-acerca-de");
  if (btnAcercaDe) btnAcercaDe.addEventListener("click", () => { popup.hidden = true; if (window.abrirConfig) window.abrirConfig(); });
  const btnLogout = document.getElementById("proy-btn-logout");
  if (btnLogout) btnLogout.addEventListener("click", () => {
    popup.hidden = true;
    const hacer = () => { if (window.cerrarSesion) cerrarSesion(); };
    if (window.pedirConfirmacion) pedirConfirmacion("¿Cerrar sesión?", hacer);
    else if (confirm("¿Cerrar sesión?")) hacer();
  });
}

async function renderPantallaProyectos(permitirCerrar) {
  const overlay = crearOverlaySiHaceFalta();
  let lista = [];
  try { lista = await window.idbListarProyectos(); } catch (e) { lista = []; }

  const proyectos = [];
  const borradores = [];
  lista.forEach(({ id, data }) => {
    const tieneNombre = data && data.projectInfo && data.projectInfo.nombre && data.projectInfo.nombre.trim();
    (tieneNombre ? proyectos : borradores).push({ id, data });
  });
  proyectos.sort((a, b) => new Date(b.data.guardadoEn || 0) - new Date(a.data.guardadoEn || 0));
  borradores.sort((a, b) => new Date(b.data.creadoEn || b.data.guardadoEn || 0) - new Date(a.data.creadoEn || a.data.guardadoEn || 0));

  const seccionProyectos = proyectos.length
    ? `<p class="proy-section-title">Tus proyectos</p><div class="proy-lista">${proyectos.map(p => tarjetaHTML(p.id, p.data, false)).join("")}</div>`
    : "";
  const seccionBorradores = borradores.length
    ? `<p class="proy-section-title">Borradores</p><div class="proy-lista">${borradores.map(p => tarjetaHTML(p.id, p.data, true)).join("")}</div>`
    : "";
  const vacio = (!proyectos.length && !borradores.length)
    ? `<div class="proy-vacio"><svg class="icon proy-vacio-icono"><use href="#i-building-crane"/></svg><p>Todavía no tenés proyectos.<br>Creá el primero con el botón de abajo.</p></div>`
    : "";

  overlay.innerHTML = `
    <div class="proy-header-full">
      <div class="proy-header-full-left">
        ${permitirCerrar
          ? `<button type="button" class="proy-header-icon-btn" id="proy-btn-cerrar" title="Volver" aria-label="Volver"><svg class="icon"><use href="#i-arrow-left"/></svg></button>`
          : `<div class="proy-header-mark-full"><svg class="icon"><use href="#i-building-crane"/></svg></div>`}
        <div>
          <p class="proy-header-full-title">Proyectos</p>
          <p class="proy-header-full-sub">Firestop Suite · Superba</p>
        </div>
      </div>
      <button type="button" class="proy-avatar-btn" id="proy-btn-avatar" aria-label="Cuenta">${escapeHtml(window.iniciales && window.usuarioActual ? window.iniciales(window.usuarioActual()) : "?")}</button>
      ${popupCuentaHTML()}
    </div>
    <div class="proy-body-full">
      ${seccionProyectos}
      ${seccionBorradores}
      ${vacio}
    </div>
    <button type="button" class="proy-fab" id="proy-btn-nuevo" aria-label="Nuevo proyecto"><svg class="icon"><use href="#i-plus"/></svg></button>`;

  overlay.querySelectorAll(".proy-card").forEach((card) => {
    card.addEventListener("click", async (e) => {
      if (e.target.closest(".proy-card-borrar")) return;
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

  overlay.querySelectorAll(".proy-card-borrar").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      const hacerBorrado = async () => {
        try { await window.idbBorrarProyecto(id); } catch (err) { console.error("No se pudo borrar el proyecto:", err); }
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
      if (window.pedirConfirmacion) {
        pedirConfirmacion("¿Borrar este proyecto? No se puede deshacer.", hacerBorrado);
      } else if (confirm("¿Borrar este proyecto? No se puede deshacer.")) {
        hacerBorrado();
      }
    });
  });

  const btnCerrar = document.getElementById("proy-btn-cerrar");
  if (btnCerrar) btnCerrar.addEventListener("click", ocultarPantallaProyectos);

  document.getElementById("proy-btn-nuevo").addEventListener("click", async () => {
    await window.crearYAbrirProyectoNuevo();
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
  const hayProyectoAbierto = !!window.PROYECTO_ACTIVO_ID;
  await renderPantallaProyectos(hayProyectoAbierto);
  const overlay = document.getElementById("pantalla-proyectos");
  overlay.hidden = false;
  // Forzar reflow para que la transición de entrada corra (si se agrega la
  // clase en el mismo frame que se quita [hidden], el navegador la agrupa
  // con el estado inicial y no anima nada).
  overlay.offsetHeight;
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
