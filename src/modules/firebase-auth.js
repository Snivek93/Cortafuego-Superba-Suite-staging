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

function renderLogin(modo, error) {
  const overlay = crearOverlaySiHaceFalta();
  const esRegistro = modo === "registro";
  overlay.innerHTML = `
    <div class="auth-panel">
      <div class="auth-brand">
        <img class="auth-brand-logo" src="icons/icon-192.png" alt="Firestop Suite — Superba" width="56" height="56" />
        <p class="auth-brand-title">Firestop Suite</p>
        <p class="auth-brand-sub">SUPERBA · DISTRIBUIDOR HILTI</p>
      </div>
      <div class="auth-tabs" role="tablist">
        <button type="button" class="auth-tab${esRegistro ? "" : " active"}" id="auth-tab-login" role="tab" aria-selected="${esRegistro ? "false" : "true"}">Iniciar sesión</button>
        <button type="button" class="auth-tab${esRegistro ? " active" : ""}" id="auth-tab-registro" role="tab" aria-selected="${esRegistro ? "true" : "false"}">Crear cuenta</button>
      </div>
      <p class="auth-mode-title">${esRegistro ? "Crear tu cuenta nueva" : "Ingresá con tu cuenta"}</p>
      <form id="auth-form" autocomplete="on">
        <input type="email" id="auth-email" name="email" placeholder="correo@superba.cr" autocomplete="username" required />
        <input type="password" id="auth-password" name="password" placeholder="Contraseña" autocomplete="${esRegistro ? "new-password" : "current-password"}" minlength="6" required />
        ${esRegistro ? `<p class="auth-hint">Mínimo 6 caracteres.</p>` : ""}
        ${error ? `<p class="auth-error">${escapeHtml(error)}</p>` : ""}
        <button type="submit" class="primary auth-btn-submit" id="auth-btn-submit">${esRegistro ? "Crear cuenta" : "Iniciar sesión"}</button>
      </form>
    </div>`;

  document.getElementById("auth-tab-login").addEventListener("click", () => { if (esRegistro) renderLogin("login", null); });
  document.getElementById("auth-tab-registro").addEventListener("click", () => { if (!esRegistro) renderLogin("registro", null); });

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
        await firebase.auth().createUserWithEmailAndPassword(email, password);
      } else {
        await firebase.auth().signInWithEmailAndPassword(email, password);
      }
      // onAuthStateChanged (más abajo) se encarga de ocultar el overlay y
      // resolver la promesa de arranque — no hace falta hacer nada más acá.
    } catch (err) {
      console.error("Error de autenticación:", err);
      renderLogin(modo, mensajeError(err));
    } finally {
      btn.disabled = false;
      btn.textContent = textoOriginal;
    }
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function mostrarPantallaLogin() {
  renderLogin("login", null);
  crearOverlaySiHaceFalta().hidden = false;
}
function ocultarPantallaLogin() {
  const overlay = document.getElementById("pantalla-login");
  if (overlay) overlay.hidden = true;
}

// Se resuelve una sola vez, la primera vez que hay un usuario logueado
// (ya sea porque la sesión venía persistida, o porque el usuario acaba de
// loguearse/crear cuenta en el formulario). initApp() espera esta promesa
// antes de arrancar el flujo normal de proyectos.
let _resolverEsperaAuth = null;
const _promesaAuth = new Promise((resolve) => { _resolverEsperaAuth = resolve; });
let _yaResolvido = false;

firebase.auth().onAuthStateChanged((user) => {
  if (user) {
    ocultarPantallaLogin();
    if (!_yaResolvido) { _yaResolvido = true; _resolverEsperaAuth(user); }
  } else {
    mostrarPantallaLogin();
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

})();
