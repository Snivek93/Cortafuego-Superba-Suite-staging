// ============================================================================
// proyectos.js — Pantalla de Proyectos (selección/creación/borrado, multi-proyecto)
// ============================================================================
// Depende de funciones expuestas por archivo-estado-app.js:
// idbListarProyectos, idbBorrarProyecto, abrirProyectoExistente,
// crearYAbrirProyectoNuevo, PROYECTO_ACTIVO_ID. El orden de <script> no
// importa: todo se usa desde manejadores de eventos, después de que ambos
// archivos ya terminaron de ejecutarse.
(function () {

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function formatearFechaCorta(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("es-CR", { day: "numeric", month: "short", year: "numeric" }); }
  catch (e) { return ""; }
}
function formatearFechaHora(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString("es-CR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch (e) { return ""; }
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
    const fecha = formatearFechaHora(data.guardadoEn);
    sub = [cliente, fecha].filter(Boolean).join(" · ") || "Sin guardar aún";
  }
  return `
    <div class="proy-card${esBorrador ? " proy-card-borrador" : ""}" data-id="${escapeHtml(id)}">
      <div class="proy-card-info">
        <p class="proy-card-nombre">${escapeHtml(nombre)}</p>
        <p class="proy-card-sub">${escapeHtml(sub)}</p>
      </div>
      <button type="button" class="proy-card-borrar" data-id="${escapeHtml(id)}" title="Borrar proyecto" aria-label="Borrar proyecto">
        <svg class="icon"><use href="#i-trash"/></svg>
      </button>
    </div>`;
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
    ? `<p class="proy-vacio">Todavía no tenés proyectos. Creá el primero.</p>`
    : "";

  const usuario = window.usuarioActual ? window.usuarioActual() : null;

  overlay.innerHTML = `
    <div class="proy-panel">
      <div class="proy-header">
        <div class="proy-header-brand">
          <span class="proy-header-mark"><svg class="icon"><use href="#i-folder"/></svg></span>
          <span class="proy-header-title">Proyectos</span>
        </div>
        ${permitirCerrar ? `<button type="button" class="secondary proy-btn-cerrar" id="proy-btn-cerrar" title="Cerrar" aria-label="Cerrar"><svg class="icon"><use href="#i-close"/></svg></button>` : ""}
      </div>
      ${usuario ? `
      <div class="proy-cuenta">
        <span class="proy-cuenta-email" title="${escapeHtml(usuario.email || "")}">${escapeHtml(usuario.email || "")}</span>
        <button type="button" class="proy-btn-logout" id="proy-btn-logout">Cerrar sesión</button>
      </div>` : ""}
      <div class="proy-body">
        ${seccionProyectos}
        ${seccionBorradores}
        ${vacio}
      </div>
      <button type="button" class="primary proy-btn-nuevo" id="proy-btn-nuevo"><svg class="icon"><use href="#i-plus"/></svg>Nuevo proyecto</button>
    </div>`;

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
          // Se borró el proyecto que estaba abierto: no queda nada válido al
          // que volver con "Cerrar", así que se limpia el estado en memoria
          // y se re-renderiza sin esa opción.
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

  const btnLogout = document.getElementById("proy-btn-logout");
  if (btnLogout) btnLogout.addEventListener("click", () => {
    const hacer = () => { if (window.cerrarSesion) cerrarSesion(); };
    if (window.pedirConfirmacion) pedirConfirmacion("¿Cerrar sesión?", hacer);
    else if (confirm("¿Cerrar sesión?")) hacer();
  });

  document.getElementById("proy-btn-nuevo").addEventListener("click", async () => {
    await window.crearYAbrirProyectoNuevo();
    ocultarPantallaProyectos();
  });
}

function ocultarPantallaProyectos() {
  const overlay = document.getElementById("pantalla-proyectos");
  if (overlay) overlay.hidden = true;
}

async function mostrarPantallaProyectos() {
  const hayProyectoAbierto = !!window.PROYECTO_ACTIVO_ID;
  await renderPantallaProyectos(hayProyectoAbierto);
  const overlay = document.getElementById("pantalla-proyectos");
  overlay.hidden = false;
}

window.mostrarPantallaProyectos = mostrarPantallaProyectos;
window.ocultarPantallaProyectos = ocultarPantallaProyectos;

})();
