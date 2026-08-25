// ============================================================================
// firebase-auth.js — Login con Firebase Auth (correo/contraseña)
// ============================================================================
// Usa los SDK "compat" de Firebase (cargados por <script> en index.html, NO
// por npm/import) a propósito: la app no tiene build step y esos SDK exponen
// un objeto global `firebase`, igual que cualquier otro <script> del repo.
//
// Sesión: Firebase ya persiste la sesión en el navegador por defecto (no hay
// que loguearse cada vez que se abre la app) — setPersistence(LOCAL) de abajo
// lo deja explícito en vez de confiar en el default implícito del SDK.
//
// Verificación de correo: crear cuenta NO confirma que el correo exista de
// verdad — Firebase solo valida el formato. Por eso, tras registrarse se
// manda un correo de verificación y la app NO deja pasar (no resuelve
// esperarAutenticacion) hasta que user.emailVerified sea true.
//
// "Recordar contraseña": los campos ya usan autocomplete="username" /
// "current-password" / "new-password", que es lo que hace que el navegador
// o el gestor de contraseñas (Chrome, LastPass, etc.) ofrezca guardarla y
// autocompletarla — no hace falta nada extra de nuestro lado para eso.
(function () {

const firebaseConfig = {
  apiKey: "AIzaSyBk6SpDlV4mN7_JjxM_P88hiSIebpC_640",
  authDomain: "firestop-suite-superba-staging.firebaseapp.com",
  projectId: "firestop-suite-superba-staging",
  storageBucket: "firestop-suite-superba-staging.firebasestorage.app",
  messagingSenderId: "921306049985",
  appId: "1:921306049985:web:33a24d994609d8f8949340",
};

firebase.initializeApp(firebaseConfig);
firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch((e) => {
  console.error("No se pudo fijar la persistencia de sesión:", e);
});

const MENSAJES_ERROR = {
  "auth/invalid-email": "Ese correo no es válido.",
  "auth/missing-email": "Ingresá un correo.",
  "auth/user-disabled": "Esta cuenta fue deshabilitada.",
  "auth/user-not-found": "No existe una cuenta con ese correo.",
  "auth/wrong-password": "Correo o contraseña incorrectos.",
  "auth/invalid-credential": "Correo o contraseña incorrectos.",
  "auth/email-already-in-use": "Ya existe una cuenta con ese correo. Iniciá sesión en vez de crear una nueva.",
  "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
  "auth/network-request-failed": "Sin conexión a internet. Probá de nuevo.",
  "auth/too-many-requests": "Demasiados intentos. Esperá un momento y probá de nuevo.",
};
function mensajeError(err) {
  return MENSAJES_ERROR[err && err.code] || "No se pudo completar la operación. Probá de nuevo.";
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function crearOverlaySiHaceFalta() {
  let el = document.getElementById("pantalla-login");
  if (!el) {
    el = document.createElement("div");
    el.id = "pantalla-login";
    el.className = "pantalla-login-overlay";
    el.hidden = true;
    document.body.appendChild(el);
  }
  return el;
}

function marcaHTML() {
  return `
    <div class="auth-brand">
      <div class="auth-brand-logo-wrap"><img class="auth-brand-logo" src="icons/icon-192.png" alt="Firestop Suite — Superba" width="64" height="64" /></div>
      <p class="auth-brand-title">Firestop Suite</p>
      <p class="auth-brand-sub">SUPERBA · DISTRIBUIDOR HILTI</p>
    </div>`;
}

// --- Pantalla 1: Iniciar sesión / Crear cuenta ---
function renderLogin(modo, error) {
  const overlay = crearOverlaySiHaceFalta();
  const esRegistro = modo === "registro";
  overlay.innerHTML = `
    <div class="auth-panel">
      <div class="auth-panel-stripe"></div>
      <div class="auth-panel-body">
      ${marcaHTML()}
      <div class="auth-tabs" role="tablist">
        <button type="button" class="auth-tab${esRegistro ? "" : " active"}" id="auth-tab-login" role="tab" aria-selected="${esRegistro ? "false" : "true"}">Iniciar sesión</button>
        <button type="button" class="auth-tab${esRegistro ? " active" : ""}" id="auth-tab-registro" role="tab" aria-selected="${esRegistro ? "true" : "false"}">Crear cuenta</button>
      </div>
      <p class="auth-mode-title">${esRegistro ? "Crear tu cuenta nueva" : "Ingresá con tu cuenta"}</p>
      <form id="auth-form" autocomplete="on">
        <label class="auth-field-label" for="auth-email">Correo</label>
        <input type="email" id="auth-email" name="email" placeholder="correo@superba.cr" autocomplete="username" required />
        <label class="auth-field-label" for="auth-password">Contraseña</label>
        <input type="password" id="auth-password" name="password" placeholder="Contraseña" autocomplete="${esRegistro ? "new-password" : "current-password"}" minlength="6" required />
        ${esRegistro ? `<p class="auth-hint">Mínimo 6 caracteres. Te vamos a pedir confirmar el correo antes de dejarte entrar.</p>` : ""}
        ${error ? `<p class="auth-error">${escapeHtml(error)}</p>` : ""}
        <button type="submit" class="primary auth-btn-submit" id="auth-btn-submit">${esRegistro ? "Crear cuenta" : "Iniciar sesión"}</button>
      </form>
      ${!esRegistro ? `<button type="button" class="auth-btn-link" id="auth-btn-olvide">¿Olvidaste tu contraseña?</button>` : ""}
      </div>
    </div>`;

  document.getElementById("auth-tab-login").addEventListener("click", () => { if (esRegistro) renderLogin("login", null); });
  document.getElementById("auth-tab-registro").addEventListener("click", () => { if (!esRegistro) renderLogin("registro", null); });
  const btnOlvide = document.getElementById("auth-btn-olvide");
  if (btnOlvide) btnOlvide.addEventListener("click", () => renderRecuperar(null, null));

  document.getElementById("auth-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("auth-email").value.trim();
    const password = document.getElementById("auth-password").value;
    const btn = document.getElementById("auth-btn-submit");
    btn.disabled = true;
    const textoOriginal = btn.textContent;
    btn.textContent = "Un momento…";
    try {
      if (esRegistro) {
        const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);
        try { await cred.user.sendEmailVerification(); } catch (e2) { console.error("No se pudo mandar el correo de verificación:", e2); }
        // onAuthStateChanged ve un usuario con emailVerified=false y
        // muestra la pantalla de "Verificá tu correo" sola, no hace falta
        // hacer nada más acá.
      } else {
        await firebase.auth().signInWithEmailAndPassword(email, password);
        // onAuthStateChanged decide qué pantalla sigue (verificar o entrar).
      }
    } catch (err) {
      console.error("Error de autenticación:", err);
      renderLogin(modo, mensajeError(err));
    } finally {
      btn.disabled = false;
      btn.textContent = textoOriginal;
    }
  });
}

// --- Pantalla 2: Recuperar contraseña ---
function renderRecuperar(error, info) {
  const overlay = crearOverlaySiHaceFalta();
  overlay.innerHTML = `
    <div class="auth-panel">
      <div class="auth-panel-stripe"></div>
      <div class="auth-panel-body">
      ${marcaHTML()}
      <p class="auth-mode-title">Recuperar contraseña</p>
      <form id="auth-form-recuperar">
        <label class="auth-field-label" for="auth-email-recuperar">Correo</label>
        <input type="email" id="auth-email-recuperar" placeholder="correo@superba.cr" autocomplete="username" required />
        ${error ? `<p class="auth-error">${escapeHtml(error)}</p>` : ""}
        ${info ? `<p class="auth-error auth-ok">${escapeHtml(info)}</p>` : ""}
        <button type="submit" class="primary auth-btn-submit" id="auth-btn-recuperar-enviar">Enviar enlace de recuperación</button>
      </form>
      <button type="button" class="auth-btn-link" id="auth-btn-volver-login">Volver a iniciar sesión</button>
      </div>
    </div>`;

  document.getElementById("auth-btn-volver-login").addEventListener("click", () => renderLogin("login", null));
  document.getElementById("auth-form-recuperar").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("auth-email-recuperar").value.trim();
    const btn = document.getElementById("auth-btn-recuperar-enviar");
    btn.disabled = true;
    try {
      await firebase.auth().sendPasswordResetEmail(email);
      renderRecuperar(null, "Listo, revisá ese correo (y la carpeta de spam) para el enlace de recuperación.");
    } catch (err) {
      console.error("Error al pedir recuperación de contraseña:", err);
      renderRecuperar(mensajeError(err), null);
    } finally {
      btn.disabled = false;
    }
  });
}

// --- Pantalla 3: Verificá tu correo (gate obligatorio tras crear cuenta) ---
function renderVerificar(user, mensaje) {
  const overlay = crearOverlaySiHaceFalta();
  overlay.innerHTML = `
    <div class="auth-panel">
      <div class="auth-panel-stripe"></div>
      <div class="auth-panel-body">
      ${marcaHTML()}
      <p class="auth-mode-title">Verificá tu correo</p>
      <p class="auth-verificar-texto">Te mandamos un enlace de confirmación a<br><strong>${escapeHtml(user.email || "")}</strong>.<br>Abrilo y después volvé acá.</p>
      ${mensaje ? `<p class="auth-error${mensaje.ok ? " auth-ok" : ""}">${escapeHtml(mensaje.texto)}</p>` : ""}
      <button type="button" class="primary auth-btn-submit" id="auth-btn-ya-verifique">Ya verifiqué, continuar</button>
      <button type="button" class="auth-btn-link" id="auth-btn-reenviar">Reenviar correo de verificación</button>
      <button type="button" class="auth-btn-link" id="auth-btn-otra-cuenta">Usar otra cuenta</button>
      </div>
    </div>`;

  document.getElementById("auth-btn-ya-verifique").addEventListener("click", async () => {
    const btn = document.getElementById("auth-btn-ya-verifique");
    btn.disabled = true;
    try {
      await user.reload();
      const actual = firebase.auth().currentUser;
      if (actual && actual.emailVerified) {
        resolverConUsuario(actual);
      } else {
        renderVerificar(user, { ok: false, texto: "Todavía no aparece verificado. Revisá la bandeja de entrada (y spam)." });
      }
    } catch (e) {
      renderVerificar(user, { ok: false, texto: "No se pudo comprobar ahora. Probá de nuevo." });
    } finally {
      btn.disabled = false;
    }
  });
  document.getElementById("auth-btn-reenviar").addEventListener("click", async () => {
    const btn = document.getElementById("auth-btn-reenviar");
    btn.disabled = true;
    try {
      await user.sendEmailVerification();
      renderVerificar(user, { ok: true, texto: "Correo reenviado." });
    } catch (e) {
      renderVerificar(user, { ok: false, texto: mensajeError(e) });
    } finally {
      btn.disabled = false;
    }
  });
  document.getElementById("auth-btn-otra-cuenta").addEventListener("click", () => {
    firebase.auth().signOut();
  });
}

function iniciales(user) {
  if (user && user.displayName) {
    const partes = user.displayName.trim().split(/\s+/);
    const a = partes[0] ? partes[0][0] : "";
    const b = partes[1] ? partes[1][0] : "";
    return (a + b).toUpperCase() || "?";
  }
  return (user && user.email ? user.email.slice(0, 2) : "?").toUpperCase();
}

// Rellena la ficha de cuenta dondequiera que se muestre (modal de
// Configuración por ahora; la Pantalla de Proyectos arma su propio popup
// leyendo usuarioActual()/iniciales() directo cuando se abre).
function actualizarUICuenta() {
  const user = firebase.auth().currentUser;
  if (!user) return;
  const avatar = document.getElementById("cfg-cuenta-avatar");
  const nombre = document.getElementById("cfg-cuenta-nombre");
  const email = document.getElementById("cfg-cuenta-email");
  if (avatar) avatar.textContent = iniciales(user);
  if (nombre) nombre.textContent = user.displayName || "Sin nombre";
  if (email) email.textContent = user.email || "";
}

// --- Editar perfil (nombre y apellido, vía updateProfile de Firebase) ---
function abrirEditarPerfil() {
  const user = firebase.auth().currentUser;
  if (!user) return;
  const partesActuales = (user.displayName || "").trim().split(/\s+/);
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box">
      <p style="font-weight:600;margin:0 0 12px;">Editar perfil</p>
      <label class="auth-field-label" for="perfil-nombre">Nombre</label>
      <input type="text" id="perfil-nombre" value="${escapeHtml(partesActuales[0] || "")}" style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:var(--fs-base);margin-bottom:10px;" />
      <label class="auth-field-label" for="perfil-apellido">Apellido</label>
      <input type="text" id="perfil-apellido" value="${escapeHtml(partesActuales.slice(1).join(" ") || "")}" style="width:100%;box-sizing:border-box;height:40px;padding:0 12px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:var(--fs-base);margin-bottom:4px;" />
      <p class="auth-error" id="perfil-error" style="display:none;"></p>
      <div class="modal-actions">
        <button class="secondary" data-act="cancel">Cancelar</button>
        <button class="primary" data-act="guardar">Guardar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", async (e) => {
    if (e.target === overlay || e.target.dataset.act === "cancel") { overlay.remove(); return; }
    if (e.target.dataset.act === "guardar") {
      const nombre = document.getElementById("perfil-nombre").value.trim();
      const apellido = document.getElementById("perfil-apellido").value.trim();
      const errorEl = document.getElementById("perfil-error");
      if (!nombre) {
        errorEl.textContent = "Ingresá al menos el nombre.";
        errorEl.style.display = "block";
        return;
      }
      const btn = e.target;
      btn.disabled = true;
      try {
        await user.updateProfile({ displayName: apellido ? `${nombre} ${apellido}` : nombre });
        actualizarUICuenta();
        if (window.actualizarCuentaProyectos) window.actualizarCuentaProyectos();
        overlay.remove();
        if (window.mostrarToast) mostrarToast("Perfil actualizado.");
      } catch (err) {
        errorEl.textContent = mensajeError(err);
        errorEl.style.display = "block";
        btn.disabled = false;
      }
    }
  });
}

function mostrarOverlay() {
  const overlay = crearOverlaySiHaceFalta();
  overlay.hidden = false;
  overlay.offsetHeight; // forzar reflow para que la transición corra
  overlay.classList.add("auth-visible");
}
function ocultarOverlay() {
  const overlay = document.getElementById("pantalla-login");
  if (!overlay) return;
  overlay.classList.remove("auth-visible");
  setTimeout(() => { overlay.hidden = true; }, 200);
}

// Se resuelve una sola vez, la primera vez que hay un usuario logueado Y
// verificado. initApp() espera esta promesa antes de arrancar el flujo
// normal de proyectos.
let _resolverEsperaAuth = null;
const _promesaAuth = new Promise((resolve) => { _resolverEsperaAuth = resolve; });
let _yaResolvido = false;

function resolverConUsuario(user) {
  ocultarOverlay();
  if (!_yaResolvido) { _yaResolvido = true; _resolverEsperaAuth(user); }
}

firebase.auth().onAuthStateChanged((user) => {
  if (user && user.emailVerified) {
    resolverConUsuario(user);
  } else if (user && !user.emailVerified) {
    renderVerificar(user, null);
    mostrarOverlay();
    if (_yaResolvido) window.location.reload();
  } else {
    renderLogin("login", null);
    mostrarOverlay();
    // Si el usuario cierra sesión DESPUÉS de que la app ya había arrancado,
    // lo más simple y seguro es recargar: initApp vuelve a correr desde
    // cero y queda esperando un nuevo login, sin arrastrar estado a medias
    // del usuario anterior.
    if (_yaResolvido) {
      window.location.reload();
    }
  }
});

function esperarAutenticacion() {
  return _promesaAuth;
}
function cerrarSesion() {
  firebase.auth().signOut().catch((e) => console.error("Error al cerrar sesión:", e));
}
function usuarioActual() {
  return firebase.auth().currentUser;
}

window.esperarAutenticacion = esperarAutenticacion;
window.cerrarSesion = cerrarSesion;
window.usuarioActual = usuarioActual;
window.iniciales = iniciales;
window.actualizarUICuenta = actualizarUICuenta;
window.abrirEditarPerfil = abrirEditarPerfil;

})();
