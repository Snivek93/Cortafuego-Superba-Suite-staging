/**
 * sw.js — Service Worker de la Calculadora Cortafuego Hilti.
 *
 * Qué hace: guarda una copia local (offline) de la app para que abra rápido
 * y funcione aunque no haya internet — incluso si nunca hubo buena señal
 * después de la primera instalación.
 *
 * Estrategia por tipo de archivo:
 * - HTML / CSS / JS propios de la app (lo que cambia seguido): "red primero,
 *   con tope de tiempo". Con internet BUENA se pide la versión más nueva y se
 *   muestra esa. Si la red tarda más de FETCH_TIMEOUT_MS (conexión mala), se
 *   usa la copia guardada de inmediato — y el pedido lento NO se tira: si
 *   termina de llegar más tarde, igual se guarda para la próxima. NO hace falta
 *   subir CACHE_VERSION cada vez que se edita un archivo.
 * - MODO RED MALA: si un pedido a la red se acaba de agotar o fallar (últimos
 *   RED_MALA_VENTANA_MS), el resto de los archivos de la app se sirven DIRECTO
 *   de la copia guardada, sin esperar otro tope de 4 s por cada módulo. Antes,
 *   con señal floja, cada uno de los ~30 módulos esperaba su propio tope.
 * - SDK de Firebase (https://www.gstatic.com/firebasejs/<versión>/...): CACHÉ
 *   PRIMERO. Cada URL lleva la versión, o sea que su contenido nunca cambia.
 *   Antes iban siempre por la red y, al ser <script> síncronos, una petición
 *   colgada impedía que la app arrancara.
 * - Todo lo demás del mismo origen (vendor/, icons/, .mjs): "caché primero"
 *   con actualización en segundo plano.
 * - Cross-origin (Firestore, fotos de Storage, etc.): NUNCA se intercepta.
 *
 * Instalación TOLERANTE: antes se usaba cache.addAll(), que es todo-o-nada: con
 * un solo archivo que no bajara por la señal, la instalación entera fallaba y
 * la app no quedaba disponible offline. Ahora cada archivo se baja por
 * separado (con tope de tiempo) y lo que falte se completa después: cuando la
 * app lo pide (mensaje PEDIR_ESTADO), cuando vuelve la conexión, o al usarlo.
 * Las cachés de versiones anteriores solo se borran cuando la nueva quedó
 * COMPLETA, para no dejar al dispositivo sin una copia utilizable.
 *
 * Mensajes hacia la app: SW_LISTO (primera instalación), SW_ACTUALIZADO (hay
 * versión nueva completa), SW_ESTADO { completo, faltan } (respuesta a
 * PEDIR_ESTADO).
 *
 * CACHE_VERSION solo hay que subirla cuando cambia la LISTA de archivos
 * (se agrega o se saca un archivo de ARCHIVOS_PRECACHE) — no por ediciones
 * normales de contenido.
 */
const CACHE_VERSION = "v1.0.76";
const PREFIJO_CACHE = "cortafuego-hilti-";
const CACHE_NAME = `${PREFIJO_CACHE}${CACHE_VERSION}`;

// Con señal mala pero presente (3G intermitente en obra), un fetch() sin
// límite de tiempo puede quedar "colgado" sin fallar nunca. Con este tope, si
// la red no contesta a tiempo se usa la copia guardada de inmediato. Bug real
// reportado por Kevin (26/08/2026): la app no abrió en campo con 3G malo.
const FETCH_TIMEOUT_MS = 4000;
// Después de una falla/espera agotada de la red, durante este tiempo los
// archivos de la app salen directo de la copia guardada (ver MODO RED MALA).
const RED_MALA_VENTANA_MS = 45000;
// Tope por archivo al instalar / completar la precache, y tope de espera de
// toda la instalación (lo que no alcance a bajar se completa después).
const PRECACHE_TIMEOUT_MS = 25000;
const PRECACHE_INSTALL_MAX_MS = 45000;
const PRECACHE_CONCURRENCIA = 6;

// Orden de prioridad: primero lo mínimo para abrir la app, al final lo pesado
// (con señal floja, lo esencial queda guardado primero).
const ARCHIVOS_PRECACHE = [
  "./index.html",
  "./styles.css",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
  "./src/modules/arranque-offline.js",
  "./src/modules/helpers.js",
  "./src/modules/constantes.js",
  "./src/modules/data-ul-systems.js",
  "./src/modules/calc-engine.js",
  "./src/modules/ui-tabla-calculadora.js",
  "./src/modules/calc-juntas.js",
  "./src/modules/calc-detalle-y-filtro.js",
  "./src/modules/pdf-comun.js",
  "./src/modules/pdf-memoria.js",
  "./src/modules/pdf-submittal-y-descargas.js",
  "./src/modules/ui-levantamiento.js",
  "./src/modules/planos.js",
  "./src/modules/informes-acreditacion.js",
  "./src/modules/ui-comun-y-cuantificacion.js",
  "./src/modules/archivo-guardar-cargar.js",
  "./src/modules/excel-export-import.js",
  "./src/modules/firebase-auth.js",
  "./src/modules/firestore-sync.js",
  "./src/modules/firestore-storage-sync.js",
  "./src/modules/archivo-estado-app.js",
  "./src/modules/zip-writer.js",
  "./src/modules/proyectos.js",
  "./src/modules/tema-claro-oscuro.js",
  "./src/modules/compartir-tabla-imagen.js",
  "./vendor/jspdf.js",
  "./vendor/jspdf.plugin.autotable.js",
  "./vendor/pdf-lib.js",
  "./vendor/xlsx.js",
  "./vendor/pdf.min.mjs",
  "./vendor/pdf.worker.min.mjs",
];

// SDK de Firebase (la versión debe coincidir con FIREBASE_VERSION de
// src/modules/arranque-offline.js). Si esa versión cambia y esta lista queda
// vieja, no pasa nada grave: la versión nueva se guarda sola la primera vez que
// se carga (ver SDK_FIREBASE_RE) y esta lista solo adelanta la copia.
const SDK_FIREBASE_BASE = "https://www.gstatic.com/firebasejs/12.18.0/";
const SDK_FIREBASE_PRECACHE = [
  "firebase-app-compat.js",
  "firebase-auth-compat.js",
  "firebase-firestore-compat.js",
  "firebase-storage-compat.js",
  "firebase-functions-compat.js",
].map((n) => SDK_FIREBASE_BASE + n);
const SDK_FIREBASE_RE = /^https:\/\/www\.gstatic\.com\/firebasejs\/[0-9.]+\/firebase-[a-z-]+-compat\.js$/;

const TODO_PRECACHE = ARCHIVOS_PRECACHE.concat(SDK_FIREBASE_PRECACHE);

// Memoria del SW (se reinicia si el navegador lo duerme; no pasa nada).
let ULTIMA_FALLA_RED = 0;

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
function pausa(ms) { return new Promise((r) => setTimeout(r, ms)); }

function rechazarEn(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("Tiempo de espera agotado")), ms));
}

// fetch con tope de tiempo REAL (aborta la descarga). Solo para la precache,
// donde no hace falta que un pedido lento siga ocupando la conexión.
async function fetchConAborto(url, ms, opciones) {
  const control = new AbortController();
  const timer = setTimeout(() => control.abort(), ms);
  try {
    return await fetch(url, Object.assign({ signal: control.signal }, opciones || {}));
  } finally {
    clearTimeout(timer);
  }
}

async function ejecutarConLimite(tareas, limite) {
  let siguiente = 0;
  const trabajadores = [];
  for (let n = 0; n < Math.min(limite, tareas.length); n++) {
    trabajadores.push((async () => {
      while (siguiente < tareas.length) {
        const k = siguiente++;
        await tareas[k]();
      }
    })());
  }
  await Promise.all(trabajadores);
}

// Busca primero en la caché de ESTA versión y, si no está, en las de versiones
// anteriores de esta misma app (solo existen mientras la nueva no esté completa).
// Nunca toca cachés de otras apps del mismo dominio.
async function buscarEnCache(peticion, ignorarQuery) {
  const opciones = ignorarQuery ? { ignoreSearch: true } : undefined;
  const actual = await caches.open(CACHE_NAME);
  const r = await actual.match(peticion, opciones);
  if (r) return r;
  const nombres = (await caches.keys()).filter((n) => n.startsWith(PREFIJO_CACHE) && n !== CACHE_NAME);
  for (const n of nombres) {
    const c = await caches.open(n);
    const x = await c.match(peticion, opciones);
    if (x) return x;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Precache tolerante
// ---------------------------------------------------------------------------
async function faltantesDePrecache() {
  const cache = await caches.open(CACHE_NAME);
  const faltan = [];
  for (const u of TODO_PRECACHE) {
    if (!(await cache.match(u))) faltan.push(u);
  }
  return faltan;
}

// Baja y guarda los archivos indicados; devuelve los que NO se lograron.
async function descargarAPrecache(urls) {
  const cache = await caches.open(CACHE_NAME);
  const fallidos = [];
  const tareas = urls.map((u) => async () => {
    try {
      const esSDK = SDK_FIREBASE_RE.test(u);
      const resp = await fetchConAborto(u, PRECACHE_TIMEOUT_MS, esSDK
        ? { mode: "cors", credentials: "omit" }
        : { cache: "reload" });
      if (!resp || !resp.ok) throw new Error("Respuesta no válida " + (resp && resp.status));
      await cache.put(u, resp);
    } catch (e) {
      fallidos.push(u);
    }
  });
  await ejecutarConLimite(tareas, PRECACHE_CONCURRENCIA);
  return fallidos;
}

// Completa lo que falte. Si queda COMPLETA, borra las cachés de versiones
// anteriores de esta app. Devuelve la lista de lo que sigue faltando.
async function completarPrecache() {
  let faltan = await faltantesDePrecache();
  if (faltan.length > 0) {
    await descargarAPrecache(faltan);
    faltan = await faltantesDePrecache();
  }
  if (faltan.length === 0) await borrarCachesViejas();
  return faltan;
}

async function borrarCachesViejas() {
  const nombres = await caches.keys();
  await Promise.all(
    nombres
      // Solo cachés de ESTA app: la Cache Storage es compartida por todo el
      // dominio (snivek93.github.io), así que borrar "todo lo que no sea mío"
      // también se llevaba las cachés de otras apps del mismo dominio.
      .filter((n) => n.startsWith(PREFIJO_CACHE) && n !== CACHE_NAME)
      .map((n) => caches.delete(n))
  );
}

async function avisarAClientes(mensaje) {
  const clientes = await self.clients.matchAll({ type: "window" });
  clientes.forEach((c) => c.postMessage(mensaje));
}

// ---------------------------------------------------------------------------
// Instalar / activar / mensajes
// ---------------------------------------------------------------------------
self.addEventListener("install", (event) => {
  // Se espera como máximo PRECACHE_INSTALL_MAX_MS; lo que falte se completa
  // después (completarPrecache) en vez de hacer fallar toda la instalación.
  event.waitUntil(
    Promise.race([
      faltantesDePrecache().then((faltan) => descargarAPrecache(faltan)),
      pausa(PRECACHE_INSTALL_MAX_MS),
    ]).catch(() => {})
  );
  self.skipWaiting();
});

// Activar: toma el control, borra versiones anteriores SOLO si la nueva está
// completa, y avisa a las pestañas abiertas.
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const faltan = await faltantesDePrecache();
    const nombres = await caches.keys();
    const hayPrevias = nombres.some((n) => n.startsWith(PREFIJO_CACHE) && n !== CACHE_NAME);
    if (faltan.length === 0) await borrarCachesViejas();
    await self.clients.claim();
    if (faltan.length === 0) {
      // Primera instalación: NO se manda a recargar (podría haber alguien
      // escribiendo el login); solo se informa que ya quedó lista offline.
      await avisarAClientes(hayPrevias
        ? { tipo: "SW_ACTUALIZADO", version: CACHE_VERSION }
        : { tipo: "SW_LISTO", version: CACHE_VERSION, completo: true });
    }
  })());
});

self.addEventListener("message", (event) => {
  const datos = event.data;
  if (!datos || datos.tipo !== "PEDIR_ESTADO") return;
  event.waitUntil((async () => {
    const faltan = await completarPrecache();
    await avisarAClientes({
      tipo: "SW_ESTADO",
      version: CACHE_VERSION,
      completo: faltan.length === 0,
      faltan: faltan.length,
    });
  })());
});

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------
function esArchivoDeLaApp(request) {
  if (request.mode === "navigate") return true;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  return /\.(html|css|js)$/.test(url.pathname);
}

// vendor/, icons/ y cualquier otro archivo propio (no html/css/js) — "caché
// primero". SIEMPRE del mismo origen: nunca debe atrapar pedidos a otro
// dominio (ej. fotos de un proyecto compartido en Firebase Storage; bug real:
// una foto editada se seguía sirviendo vieja).
function esRecursoPropioNoJs(request) {
  return new URL(request.url).origin === self.location.origin;
}

function respuestaSinConexion(request) {
  if (request.mode === "navigate") {
    return new Response(
      "<!doctype html><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
      + "<title>Sin conexión</title><body style=\"font-family:sans-serif;padding:24px\">"
      + "<h2>Sin conexión</h2><p>Esta es la primera vez que se abre la app en este dispositivo y todavía no hay conexión suficiente para descargarla. "
      + "Conectate a Wi-Fi o buscá mejor señal y recargá la página.</p></body>",
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
  return new Response("Sin conexión", { status: 503, statusText: "Sin conexión", headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

async function responderArchivoDeLaApp(event) {
  const request = event.request;
  const esNavegacion = request.mode === "navigate";

  // MODO RED MALA: la red acaba de fallar o de agotar su tope → directo a la
  // copia guardada, sin esperar otro tope por cada archivo.
  if (Date.now() - ULTIMA_FALLA_RED < RED_MALA_VENTANA_MS) {
    const guardada = (await buscarEnCache(request, esNavegacion)) || (esNavegacion ? await buscarEnCache("./index.html") : null);
    if (guardada) return guardada;
  }

  // Red primero. El pedido NO se cancela si pasa el tope: si termina llegando,
  // se guarda igual para la próxima vez.
  const intento = fetch(request, { cache: "no-store" }).then(async (respuesta) => {
    if (respuesta && respuesta.status === 200) {
      const copia = respuesta.clone();
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, copia);
    }
    return respuesta;
  });

  try {
    const respuesta = await Promise.race([intento, rechazarEn(FETCH_TIMEOUT_MS)]);
    if (respuesta && respuesta.status >= 500) {
      const guardada = await buscarEnCache(request, esNavegacion);
      if (guardada) return guardada;
    }
    return respuesta;
  } catch (e) {
    ULTIMA_FALLA_RED = Date.now();
    // Que el pedido lento siga su curso (y se guarde si llega) sin dejar un
    // rechazo sin atender, y sin que el SW se duerma antes de terminarlo.
    const seguir = intento.catch(() => {});
    event.waitUntil(seguir);

    let guardada = await buscarEnCache(request, esNavegacion);
    if (!guardada && esNavegacion) guardada = await buscarEnCache("./index.html");
    if (guardada) return guardada;

    // No hay copia: la red es lo único que hay; se espera lo que haga falta.
    try { return await intento; } catch (e2) { return respuestaSinConexion(request); }
  }
}

// SDK de Firebase: URL con versión = contenido inmutable → caché primero.
async function responderSDKFirebase(event) {
  const url = event.request.url;
  const guardada = await buscarEnCache(url);
  if (guardada) return guardada;
  const respuesta = await fetch(url, { mode: "cors", credentials: "omit" });
  if (respuesta && respuesta.ok) {
    const copia = respuesta.clone();
    event.waitUntil(caches.open(CACHE_NAME).then((c) => c.put(url, copia)).catch(() => {}));
  }
  return respuesta;
}

async function responderRecursoPropio(event) {
  const request = event.request;
  const guardada = await buscarEnCache(request);
  const buscarEnRed = fetch(request)
    .then(async (respuestaRed) => {
      if (respuestaRed && respuestaRed.status === 200) {
        const copia = respuestaRed.clone();
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, copia);
      }
      return respuestaRed;
    })
    .catch(() => guardada || respuestaSinConexion(request));
  event.waitUntil(buscarEnRed.catch(() => {}));
  return guardada || buscarEnRed;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  if (SDK_FIREBASE_RE.test(request.url)) {
    event.respondWith(responderSDKFirebase(event));
    return;
  }

  if (esArchivoDeLaApp(request)) {
    event.respondWith(responderArchivoDeLaApp(event));
    return;
  }

  // Cross-origin (fotos de Firebase Storage, Firestore, cualquier otro
  // dominio) — nunca se intercepta. El código de sync ya tiene su propia caché
  // consciente de contenido; cachearlo acá solo serviría versiones viejas.
  if (!esRecursoPropioNoJs(request)) return;

  event.respondWith(responderRecursoPropio(event));
});

