// ============================================================================
// arranque-offline.js — arranque que NO depende de la red
// ============================================================================
// Problema real (05/10/2026, Kevin): con señal mala la app de staging se
// quedaba en el splash y después en pantalla negra. Causas verificadas en el
// código: (1) los 5 SDK de Firebase se cargaban con <script src="https://
// www.gstatic.com/..."> SÍNCRONOS en index.html — si esa petición se cuelga,
// el navegador no dispara DOMContentLoaded y initApp() nunca arranca; (2)
// initApp() esperaba esperarAutenticacion() sin tope de tiempo.
//
// Qué hace este archivo (se carga ANTES que archivo-estado-app.js):
//   1. Identidad local: recuerda la última cuenta que inició sesión y verificó
//      el correo en ESTE dispositivo (uid/correo/nombre — nunca la contraseña).
//      Con eso initApp() puede abrir la app con los datos locales si Firebase
//      Auth no contesta a tiempo, en vez de quedarse esperando a la red.
//      No abre nada nuevo: los proyectos ya viven en este dispositivo y la
//      sesión de Firebase ya persiste sola en el navegador (LOCAL).
//   2. Carga de Firebase en diferido: los 5 SDK y los 3 módulos que dependen
//      de ellos (firebase-auth.js, firestore-sync.js, firestore-storage-sync.js)
//      se inyectan acá, en orden, con reintentos. Ya no bloquean el arranque.
//      window.firebaseListo es una promesa que se resuelve cuando todo cargó
//      (nunca se rechaza: reintenta hasta lograrlo).
//   3. Panel de "primer ingreso": si nunca se inició sesión en este dispositivo
//      y no hay conexión suficiente para cargar el login, se explica qué pasa
//      en vez de dejar un splash eterno o una pantalla negra.
//   4. Estado del Service Worker: avisa una vez "Listo para usar sin conexión"
//      cuando la instalación offline quedó completa.
//
// IMPORTANTE: la versión de los SDK de Firebase vive ACÁ (FIREBASE_VERSION).
// Si algún día se sube de versión, se cambia solo en este archivo.
// ============================================================================
(function () {
"use strict";

if (window.__arranqueOfflineCargado) return;
window.__arranqueOfflineCargado = true;

// ---------------------------------------------------------------------------
// 1. Identidad local
// ---------------------------------------------------------------------------
const CLAVE_IDENTIDAD = "firestopSuite:ultimaCuenta";

function guardarIdentidadLocal(user) {
  try {
    if (!user || !user.uid) return;
    localStorage.setItem(CLAVE_IDENTIDAD, JSON.stringify({
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || "",
      guardadoEn: Date.now(),
    }));
  } catch (e) {}
}
function leerIdentidadLocal() {
  try {
    const t = localStorage.getItem(CLAVE_IDENTIDAD);
    if (!t) return null;
    const o = JSON.parse(t);
    return (o && typeof o.uid === "string" && o.uid) ? o : null;
  } catch (e) { return null; }
}
function borrarIdentidadLocal() {
  try { localStorage.removeItem(CLAVE_IDENTIDAD); } catch (e) {}
}

window.guardarIdentidadLocal = guardarIdentidadLocal;
window.leerIdentidadLocal = leerIdentidadLocal;
window.borrarIdentidadLocal = borrarIdentidadLocal;
// Para mostrar nombre/iniciales/espacio activo mientras Firebase Auth todavía
// no confirmó la sesión. NUNCA se usa para hablar con Firestore.
window.usuarioLocalCache = leerIdentidadLocal;

// Mismo cálculo que firebase-auth.js (que lo redefine al cargar): sirve para
// pintar el avatar antes de que ese módulo exista.
if (!window.iniciales) {
  window.iniciales = function (user) {
    if (user && user.displayName) {
      const partes = user.displayName.trim().split(/\s+/);
      const a = partes[0] ? partes[0][0] : "";
      const b = partes[1] ? partes[1][0] : "";
      return (a + b).toUpperCase() || "?";
    }
    return (user && user.email ? user.email.slice(0, 2) : "?").toUpperCase();
  };
}

// ---------------------------------------------------------------------------
// 2. Carga de Firebase en diferido, con reintentos
// ---------------------------------------------------------------------------
const FIREBASE_VERSION = "12.18.0";
const BASE_SDK = "https://www.gstatic.com/firebasejs/" + FIREBASE_VERSION + "/";
const SDK_BASE = BASE_SDK + "firebase-app-compat.js";
const SDK_RESTO = [
  "firebase-auth-compat.js",
  "firebase-firestore-compat.js",
  "firebase-storage-compat.js",
  "firebase-functions-compat.js",
].map((n) => BASE_SDK + n);
// Módulos propios que necesitan el objeto global `firebase`; el orden importa.
const MODULOS_FIREBASE = [
  "src/modules/firebase-auth.js",
  "src/modules/firestore-sync.js",
  "src/modules/firestore-storage-sync.js",
];

window.firebaseEstadoCarga = "cargando";

function cargarScriptUnaVez(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { try { s.remove(); } catch (e) {} reject(new Error("No cargó " + src)); };
    document.head.appendChild(s);
  });
}

// Espera para reintentar: backoff corto, y si no hay red se queda esperando a
// que vuelva (evento online) con un reintento de seguridad cada 30 s.
function esperarParaReintentar(intento) {
  const ms = navigator.onLine === false ? 30000 : Math.min(30000, 1500 * Math.pow(2, intento));
  return new Promise((resolve) => {
    let terminado = false;
    const fin = () => {
      if (terminado) return;
      terminado = true;
      window.removeEventListener("online", fin);
      resolve();
    };
    setTimeout(fin, ms);
    window.addEventListener("online", fin);
  });
}

// Un script que falló NO llegó a ejecutarse, así que reintentarlo no lo duplica.
// A propósito NO hay tope de tiempo con segunda inyección: si el primer pedido
// llegara tarde, el SDK se ejecutaría dos veces. Un pedido colgado termina
// fallando solo en el navegador, y el botón "Reintentar" recarga la página.
async function cargarConReintentos(src) {
  for (let intento = 0; ; intento++) {
    try { await cargarScriptUnaVez(src); return; }
    catch (e) { await esperarParaReintentar(intento); }
  }
}

async function cargarFirebase() {
  // firebase-app va primero; los demás SDK solo dependen de él y entre sí no.
  await cargarConReintentos(SDK_BASE);
  await Promise.all(SDK_RESTO.map(cargarConReintentos));
  // Los módulos propios van uno por uno: ejecutarlos fuera de orden o dos veces
  // (initializeApp repetido) rompería el login.
  for (const ruta of MODULOS_FIREBASE) await cargarConReintentos(ruta);
  window.firebaseEstadoCarga = "listo";
}

// Si este archivo se ejecutara con Firebase ya presente (versión vieja de
// index.html con los <script> síncronos), no se vuelve a cargar nada.
if (typeof window.firebase !== "undefined" && window.esperarAutenticacion) {
  window.firebaseEstadoCarga = "listo";
  window.firebaseListo = Promise.resolve();
} else {
  window.firebaseListo = cargarFirebase().catch((e) => { console.error("Carga de Firebase:", e); });
}

// ---------------------------------------------------------------------------
// 3. Panel de "primer ingreso" (sin cuenta guardada y sin red suficiente)
// ---------------------------------------------------------------------------
// Reusa el mismo overlay y las mismas clases del login (#pantalla-login), que ya
// se ven durante el arranque. Cuando firebase-auth.js cargue y pinte el login
// real, reemplaza este contenido solo.
function textosPanel() {
  const sinRed = navigator.onLine === false;
  return {
    titulo: sinRed ? "Sin conexión" : "Conectando…",
    texto: (sinRed
      ? "Este dispositivo todavía no tiene una sesión iniciada y no hay conexión."
      : "Este dispositivo todavía no tiene una sesión iniciada y la señal está muy débil.")
      + " La primera vez hace falta conexión estable para iniciar sesión: conectate a Wi-Fi o buscá mejor señal. Esta pantalla se actualiza sola cuando haya conexión. Después de ese primer ingreso, la app funciona sin conexión.",
  };
}

function loginRealVisible() {
  const ov = document.getElementById("pantalla-login");
  return !!(ov && !ov.hidden && ov.classList.contains("auth-visible")
    && ov.querySelector("#auth-form, #auth-form-recuperar, #auth-btn-ya-verifique"));
}

function mostrarPanelPrimerIngreso() {
  if (loginRealVisible()) return;
  let overlay = document.getElementById("pantalla-login");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "pantalla-login";
    overlay.className = "pantalla-login-overlay";
    overlay.hidden = true;
    document.body.appendChild(overlay);
  }
  const t = textosPanel();
  overlay.innerHTML = `
    <div class="auth-panel">
      <div class="auth-panel-stripe"></div>
      <div class="auth-panel-body">
        <div class="auth-brand">
          <div class="auth-brand-logo-wrap"><img class="auth-brand-logo" src="icons/icon-192.png" alt="" width="64" height="64" /></div>
          <p class="auth-brand-title">Firestop Suite</p>
          <p class="auth-brand-sub">SUPERBA · DISTRIBUIDOR HILTI</p>
        </div>
        <p class="auth-mode-title" id="conexion-titulo"></p>
        <p class="auth-verificar-texto" id="conexion-texto"></p>
        <button type="button" class="primary auth-btn-submit" id="conexion-reintentar">Reintentar</button>
      </div>
    </div>`;
  document.getElementById("conexion-titulo").textContent = t.titulo;
  document.getElementById("conexion-texto").textContent = t.texto;
  document.getElementById("conexion-reintentar").addEventListener("click", () => { location.reload(); });
  overlay.hidden = false;
  overlay.offsetHeight; // forzar reflow para que la transición corra
  overlay.classList.add("auth-visible");
}

function quitarPanelPrimerIngreso() {
  const overlay = document.getElementById("pantalla-login");
  if (!overlay || !overlay.querySelector("#conexion-reintentar")) return;
  overlay.classList.remove("auth-visible");
  overlay.hidden = true;
  overlay.innerHTML = "";
}

function refrescarTextosPanel() {
  const titulo = document.getElementById("conexion-titulo");
  const texto = document.getElementById("conexion-texto");
  if (!titulo || !texto) return;
  const t = textosPanel();
  titulo.textContent = t.titulo;
  texto.textContent = t.texto;
}
window.addEventListener("online", refrescarTextosPanel);
window.addEventListener("offline", refrescarTextosPanel);

window.mostrarPanelPrimerIngreso = mostrarPanelPrimerIngreso;
window.quitarPanelPrimerIngreso = quitarPanelPrimerIngreso;

// ---------------------------------------------------------------------------
// 4. Estado del Service Worker: "Listo para usar sin conexión"
// ---------------------------------------------------------------------------
const CLAVE_OFFLINE_LISTO = "firestopSuite:offlineListoAvisado";

function manejarEstadoSW(datos) {
  if (!datos || !datos.completo) return;
  let yaAvisado = null;
  try { yaAvisado = localStorage.getItem(CLAVE_OFFLINE_LISTO); } catch (e) {}
  try { localStorage.setItem(CLAVE_OFFLINE_LISTO, String(datos.version || "1")); } catch (e) {}
  // Solo se avisa la primera vez que queda completo en este dispositivo; las
  // actualizaciones posteriores no repiten el aviso.
  if (yaAvisado === null && window.mostrarToast) {
    window.mostrarToast("Listo para usar sin conexión.");
  }
}

function pedirEstadoSW() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.ready.then((reg) => {
    if (reg && reg.active) reg.active.postMessage({ tipo: "PEDIR_ESTADO" });
  }).catch(() => {});
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (ev) => {
    const d = ev && ev.data;
    if (d && (d.tipo === "SW_LISTO" || d.tipo === "SW_ESTADO")) manejarEstadoSW(d);
  });
  window.addEventListener("load", () => { setTimeout(pedirEstadoSW, 6000); });
  // Al volver la conexión, el SW completa lo que le faltara y vuelve a informar.
  window.addEventListener("online", () => { setTimeout(pedirEstadoSW, 1500); });
}

})();
