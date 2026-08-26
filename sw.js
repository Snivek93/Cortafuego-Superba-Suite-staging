/**
 * sw.js — Service Worker de la Calculadora Cortafuego Hilti.
 *
 * Qué hace: guarda una copia local (offline) de la app para que abra rápido
 * y funcione aunque no haya internet.
 *
 * Estrategia por tipo de archivo:
 * - HTML / CSS / JS propios de la app (lo que cambia seguido): "red primero,
 *   con tope de tiempo". Cada vez que hay internet BUENA, se pide la versión
 *   más nueva directo del servidor y se muestra esa. Si no hay internet, o si
 *   la red tarda más de FETCH_TIMEOUT_MS (conexión mala/intermitente, no
 *   necesariamente caída del todo), se usa la copia guardada de inmediato en
 *   vez de quedarse esperando. Con esto, NO hace falta acordarse de subir
 *   CACHE_VERSION cada vez que se edita un archivo — el celular siempre pide
 *   la versión actual solo.
 * - Todo lo demás (vendor/, icons/ — cambia poco y pesa más): "caché primero"
 *   con actualización en segundo plano, para que abra rápido.
 *
 * CACHE_VERSION solo hay que subirla cuando cambia la LISTA de archivos
 * (se agrega o se saca un archivo de ARCHIVOS_PRECACHE) — no por ediciones
 * normales de contenido.
 */
const CACHE_VERSION = "v1.0.66";
const CACHE_NAME = `cortafuego-hilti-${CACHE_VERSION}`;

// Con señal mala pero presente (3G intermitente en obra), un fetch() sin
// límite de tiempo puede quedar "colgado" sin fallar nunca — ni resuelve ni
// dispara el .catch(). Con este tope, si la red no contesta a tiempo se usa
// la copia guardada de inmediato en vez de dejar al usuario mirando una
// pantalla en blanco. Bug real reportado por Kevin (26/08/2026): la app no
// abrió en campo con 3G malo.
const FETCH_TIMEOUT_MS = 4000;

const ARCHIVOS_PRECACHE = [
  "./index.html",
  "./styles.css",
  "./manifest.json",
  "./vendor/jspdf.js",
  "./vendor/jspdf.plugin.autotable.js",
  "./vendor/pdf-lib.js",
  "./vendor/xlsx.js",
  "./src/modules/archivo-estado-app.js",
  "./src/modules/proyectos.js",
  "./src/modules/firebase-auth.js",
  "./src/modules/archivo-guardar-cargar.js",
  "./src/modules/calc-detalle-y-filtro.js",
  "./src/modules/calc-engine.js",
  "./src/modules/calc-juntas.js",
  "./src/modules/compartir-tabla-imagen.js",
  "./src/modules/constantes.js",
  "./src/modules/data-ul-systems.js",
  "./src/modules/excel-export-import.js",
  "./src/modules/helpers.js",
  "./src/modules/importar-texto-libre.js",
  "./src/modules/informes-acreditacion.js",
  "./src/modules/pdf-comun.js",
  "./src/modules/pdf-memoria.js",
  "./src/modules/pdf-submittal-y-descargas.js",
  "./src/modules/tema-claro-oscuro.js",
  "./src/modules/ui-comun-y-cuantificacion.js",
  "./src/modules/ui-levantamiento.js",
  "./src/modules/ui-tabla-calculadora.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
];

// Instalar: descarga y guarda los archivos principales.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ARCHIVOS_PRECACHE))
  );
  self.skipWaiting();
});

// Activar: borra cachés de versiones anteriores y notifica a todos los
// clientes abiertos para que recarguen y vean la versión nueva de inmediato
// (en combinación con self.skipWaiting() arriba, que hace que el SW nuevo
// tome control sin esperar a que se cierren las pestañas).
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((nombres) =>
      Promise.all(
        nombres
          .filter((nombre) => nombre !== CACHE_NAME)
          .map((nombre) => caches.delete(nombre))
      )
    ).then(() => {
      self.clients.claim();
      return self.clients.matchAll({ type: "window" }).then((clientes) => {
        clientes.forEach((cliente) => cliente.postMessage({ tipo: "SW_ACTUALIZADO", version: CACHE_VERSION }));
      });
    })
  );
});

function esArchivoDeLaApp(request) {
  if (request.mode === "navigate") return true;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  return /\.(html|css|js)$/.test(url.pathname);
}

// fetch() normal no tiene límite de tiempo propio — con señal mala pero
// presente puede quedar colgado sin nunca resolver ni rechazar. Esto arma
// una carrera contra un timer: lo que responda primero gana.
function fetchConTimeout(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Tiempo de espera agotado")), ms);
    fetch(request, { cache: "no-store" }).then(
      (respuesta) => { clearTimeout(timer); resolve(respuesta); },
      (error) => { clearTimeout(timer); reject(error); }
    );
  });
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  if (esArchivoDeLaApp(event.request)) {
    event.respondWith(
      fetchConTimeout(event.request, FETCH_TIMEOUT_MS)
        .then((respuestaRed) => {
          if (respuestaRed && respuestaRed.status === 200) {
            const copia = respuestaRed.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia));
          }
          return respuestaRed;
        })
        .catch(() => caches.match(event.request).then((r) => r || fetch(event.request)))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((respuestaGuardada) => {
      const buscarEnRed = fetch(event.request)
        .then((respuestaRed) => {
          if (respuestaRed && respuestaRed.status === 200) {
            const copia = respuestaRed.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia));
          }
          return respuestaRed;
        })
        .catch(() => respuestaGuardada);

      return respuestaGuardada || buscarEnRed;
    })
  );
});
