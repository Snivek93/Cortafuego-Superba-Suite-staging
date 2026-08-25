// ============================================================================
// planos.js — encapsulado en IIFE (sin exponer todo a window; ver export list abajo)
// ============================================================================
// PLANOS y PLANO_SEQ se declaran fuera del IIFE a propósito (con `var`, no `let`).
// El guardado/carga de proyecto les hace reasignación directa (ej.
// `PLANOS = data.planos || []` al importar), no solo mutación -- ver la nota
// igual en ui-tabla-calculadora.js sobre por qué esto es necesario. Si quedaran
// como `let` acá adentro, esa reasignación externa crearía una copia global
// desconectada de la que este módulo sigue usando internamente.
var PLANOS = [];
var PLANO_SEQ = 1;

(function () {
// ============================================================================
// planos.js
// Planos de referencia: subir un PDF, rasterizarlo a 150dpi, verlo con pan/zoom,
// marcar el recorrido a mano alzada, y colocar pines (libres o vinculados a una
// fila de Levantamiento).
// (Parte del proyecto Calculadora Cortafuego Hilti — ver README.md para el mapa completo de módulos.)
// ============================================================================

// Resolución fija a la que se rasteriza TODO plano subido, sin importar el
// peso/tipo del PDF original — decisión tomada tras probar 3 PDFs reales de
// Kevin (ver guía de continuidad): 150dpi se ve nítido en un visor real
// (Fotos/Adobe) incluso con zoom agresivo, y es la resolución que unifica el
// comportamiento sin tener que medir y decidir caso por caso.
const PLANO_DPI = 150;

// Estado del visor (vive mientras el modal está abierto, no se guarda con el proyecto).
let PLANO_ACTIVO_ID = null;
// Capa de informe: cuando está activa, el visor trabaja sobre las marcas del
// informe de Acreditación (planoRef), no sobre las del plano real. Comparte
// imagen/dimensiones/escala del plano real.
let PLANO_CAPA_INFORME = null;
let PLANO_MODO = "mano"; // "mano" | "marcador" | "punto"
let PLANO_COLOR_MARCADOR = "#e2001a";
// Color de los pines nuevos que se coloquen — independiente del color de
// dibujo/marcador, se elige desde el mismo botón de color del riel pero solo
// cuando la herramienta activa es "punto" (ver renderVisorHerramientasYCanvas).
let PLANO_COLOR_PIN = "#e2001a";
// Paleta básica para lápiz/marcador — colores comunes en anotación de planos.
const PLANO_PALETA_COLORES = ["#e2001a", "#ff9900", "#ffe100", "#00a651", "#0072ce", "#111111"];
// Grosor seleccionable — es un multiplicador sobre el grosorFactor base de
// cada herramienta (ver TRAZO_ESTILOS), así "fino"/"medio"/"grueso" tienen
// sentido relativo tanto para el lápiz como para el marcador.
let PLANO_GROSOR = 1;
let PLANO_RECT_RELLENO = false;
let PLANO_RECT_OPACIDAD = 0.3;
// Transparencia del marcador/resaltador — reemplaza la opacidad fija que
// tenía antes (TRAZO_ESTILOS.resaltador.opacidad sigue existiendo como
// valor por defecto para trazos viejos guardados sin este campo).
let PLANO_RESALTADOR_OPACIDAD = 0.35;
const PLANO_OPACIDADES = [
  { valor: 0.15, nombre: "Muy transparente" },
  { valor: 0.3, nombre: "Transparente" },
  { valor: 0.6, nombre: "Semi-opaco" },
  { valor: 1, nombre: "Opaco" },
];
// Estado del punto A al dibujar una línea, o al calibrar/medir (necesitan 2
// toques en vez del arrastre continuo que usan lápiz/marcador/rectángulo).
let PLANO_PUNTO_A = null; // { xFrac, yFrac } o null
const PLANO_GROSORES = [
  { valor: 0.15, nombre: "Muy fino", puntoPx: 3 },
  { valor: 0.3, nombre: "Extra fino", puntoPx: 4 },
  { valor: 0.5, nombre: "Fino", puntoPx: 6 },
  { valor: 1, nombre: "Medio", puntoPx: 10 },
  { valor: 2, nombre: "Grueso", puntoPx: 14 },
];
// Color de los textos nuevos — mismo botón de color del riel, activo solo
// cuando la herramienta es "texto" (igual patrón que PLANO_COLOR_PIN).
let PLANO_COLOR_TEXTO = "#e2001a";
// Tamaño de fuente del texto, como fracción del ancho del plano (igual
// unidad que usa el editor de fotos — así el tamaño se ve consistente sin
// importar la resolución del plano rasterizado).
let PLANO_TAMANO_TEXTO = 0.02;
const PLANO_TAMANOS_TEXTO = [0.012, 0.02, 0.032, 0.048];
// Texto que se está escribiendo/editando ahora mismo: { id, xFrac, yFrac,
// esNuevo } — mientras existe, se muestra un <input> HTML flotente encima
// del SVG en esa posición (ver renderInputTextoFlotante). id: null si es
// un texto nuevo que todavía no se confirmó.
let PLANO_TEXTO_EDITANDO = null;
// Id del texto ya colocado que está seleccionado (se puede arrastrar o
// cambiarle el tamaño desde el riel).
let PLANO_TEXTO_SELECCIONADO_ID = null;
let PLANO_TEXTO_ARRASTRE = null; // { id, offXFrac, offYFrac } mientras se arrastra un texto seleccionado
// Lápiz: trazo fino, opaco — para apuntes/detalle. Marcador: trazo grueso,
// semitransparente tipo resaltador — para señalar recorridos/zonas.
const TRAZO_ESTILOS = {
  lapiz: { grosorFactor: 0.004, opacidad: 1 },
  resaltador: { grosorFactor: 0.016, opacidad: 0.35 },
};
let PLANO_ZOOM = 1;
let PLANO_PAN_X = 0;
let PLANO_PAN_Y = 0;
// Si se abrió el visor desde el formulario de una fila (botón "Vincular punto
// en plano"), acá queda el contexto — el próximo pin que se coloque se vincula
// automático a esa fila, sin preguntar "nota libre o vincular".
let PLANO_PIN_CONTEXTO = null; // { filaId, filaTipo } o null

// "galeria": cuadrícula de miniaturas de todos los planos (pantalla inicial).
// "visor": herramientas + canvas sobre un plano puntual ya seleccionado.
let PLANO_VISTA = "galeria";
// Colapso de la barra flotante de herramientas (solo aplica visualmente en
// mobile vía CSS — en desktop la barra queda fija siempre expandida).
let PLANO_TOOLS_COLLAPSED = false;
// id del plano cuyo menú "Renombrar/Borrar" está abierto en la galería, o null.
let PLANO_GALERIA_MENU_ID = null;
// "color" | "grosor" | null — cuál de los 2 flyouts del riel (color/grosor)
// está abierto. Se resetea a null al cambiar de herramienta.
let PLANO_RAIL_FLYOUT = null;

// --- Utilidades de arrastre/zoom (puntero + rueda + pellizco de 2 dedos) ---
let PLANO_DRAG_ACTIVO = false;
let PLANO_DRAG_ULTIMO_X = 0;
let PLANO_DRAG_ULTIMO_Y = 0;
let PLANO_PINCH_DIST_INICIAL = null;
let PLANO_PINCH_ZOOM_INICIAL = 1;
// Centroide del pellizco anterior — necesario para el arrastre con 2 dedos
// (ver nota en pointermove: aplicarZoomCentrado() por sí sola solo ancla el
// zoom, no traduce el movimiento del centroide en un pan).
let PLANO_PINCH_ULTIMO_CX = 0;
let PLANO_PINCH_ULTIMO_CY = 0;
const PLANO_PUNTEROS_ACTIVOS = new Map();

function esperarPdfJsListo() {
  return new Promise((resolve, reject) => {
    let intentos = 0;
    const check = () => {
      if (window.pdfjsLib) { resolve(window.pdfjsLib); return; }
      intentos++;
      if (intentos > 100) { reject(new Error("PDF.js no cargó a tiempo.")); return; }
      setTimeout(check, 50);
    };
    check();
  });
}

// Convierte un canvas a dataURL sin bloquear el hilo principal — toDataURL()
// es sincrónico y en un canvas grande (un plano a 150dpi puede ser ~30
// megapíxeles) puede tardar varios segundos trabados, lo que en el celular se
// sentiría como que la app se congeló. canvas.toBlob() es asíncrono y evita eso.
function canvasADataUrlAsync(canvas, tipo, calidad) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error("No se pudo generar la imagen del plano.")); return; }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("No se pudo leer la imagen generada."));
      reader.readAsDataURL(blob);
    }, tipo, calidad);
  });
}

// Sube un PDF, lo rasteriza a PLANO_DPI (siempre, sin excepción — ver nota
// arriba) y lo agrega a PLANOS como WebP. Devuelve el plano nuevo.
async function subirPlano(file) {
  const pdfjsLib = await esperarPdfJsListo();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
  const scale = PLANO_DPI / 72;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  await page.render({ canvasContext: ctx, viewport }).promise;
  const dataUrl = await canvasADataUrlAsync(canvas, "image/webp", 0.8);

  const nombre = (file.name || "Plano").replace(/\.pdf$/i, "");
  const plano = {
    id: PLANO_SEQ++,
    nombre,
    dataUrl,
    width: canvas.width,
    height: canvas.height,
    pines: [],
    trazos: [],
    rectangulos: [],
    lineas: [],
    textos: [], // etiquetas de texto libre sobre el plano — ver herramienta "Texto"
    cotas: [], // mediciones persistentes con la herramienta "Regla" — ver procesarMedicion()
    escala: null, // { pxPorCm: number } — se llena al calibrar (ver "Regla y calibración")
  };
  PLANOS.push(plano);
  return plano;
}

// Versión liviana de subirVariosPlanos: solo parsea y agrega a PLANOS, sin
// tocar PLANO_VISTA/PLANO_ACTIVO_ID ni el DOM del visor. Para usar desde
// otros módulos (ej. Informes de Acreditación) que quieren subir un plano
// sin abrir la pantalla completa de Planos.
async function subirVariosPlanosBasico(fileList) {
  const archivos = Array.from(fileList || []).filter(f => f.type === "application/pdf" || /\.pdf$/i.test(f.name || ""));
  const subidos = [];
  let fallidos = 0;
  for (const file of archivos) {
    try {
      subidos.push(await subirPlano(file));
      marcarCambio();
    } catch (e) {
      fallidos++;
    }
  }
  return { subidos, fallidos, totalIntentados: archivos.length };
}

// Sube uno o varios PDFs en secuencia (no en paralelo, para no pisar
// PLANO_SEQ entre sí) — usada tanto por el picker de archivos como por
// arrastrar-y-soltar en desktop.
async function subirVariosPlanos(fileList) {
  const archivos = Array.from(fileList || []).filter(f => f.type === "application/pdf" || /\.pdf$/i.test(f.name || ""));
  if (!archivos.length) {
    mostrarToast("Solo se pueden subir archivos PDF.", "error");
    return;
  }
  mostrarCargandoPlano(true);
  let ultimoPlano = null;
  let fallidos = 0;
  try {
    for (const file of archivos) {
      try {
        ultimoPlano = await subirPlano(file);
        marcarCambio();
      } catch (e) {
        fallidos++;
      }
    }
  } finally {
    mostrarCargandoPlano(false);
  }
  if (fallidos) mostrarToast(`No se pudo procesar ${fallidos} archivo(s) (¿son PDF válidos?).`, "error");
  if (archivos.length - fallidos > 1) {
    renderVisorPlanos();
  } else if (ultimoPlano) {
    abrirPlanoDesdeGaleria(ultimoPlano.id);
  } else {
    renderVisorPlanos();
  }
}

// Abre el visor de planos. opts.filaId/opts.filaTipo (opcional): si vienen,
// el visor arranca en modo "punto" listo para vincular el próximo pin
// directo a esa fila (sin preguntar nota libre vs. vincular).
// Abre el visor de planos.
// - opts.filaId/opts.filaTipo: fila YA guardada — el próximo pin se vincula
//   directo a ese _id.
// - opts.borrador + opts.onColocar: fila que todavía NO existe (se está
//   agregando, sin _id todavía) — el próximo pin no se guarda en el plano de
//   una vez; se le pasa la ubicación a onColocar(ubicacion) para que quien
//   llamó la guarde como "pendiente" y recién la vincule de verdad cuando la
//   fila se guarde y tenga un _id real.
function abrirVisorPlanos(opts) {
  opts = opts || {};
  PLANO_CAPA_INFORME = null;
  if (opts.filaId != null) {
    PLANO_PIN_CONTEXTO = { filaId: opts.filaId, filaTipo: opts.filaTipo || "penetrante" };
  } else if (opts.borrador) {
    PLANO_PIN_CONTEXTO = { borrador: true, onColocar: opts.onColocar };
  } else {
    PLANO_PIN_CONTEXTO = null;
  }
  PLANO_MODO = PLANO_PIN_CONTEXTO ? "punto" : "mano";
  // Siempre arranca en la galería de miniaturas — el usuario elige la hoja
  // ahí (ver "Cuadrícula de planos" en renderVisorPlanos). abrirVisorPlanosEnPin()
  // es la excepción que salta directo al visor de una hoja puntual.
  PLANO_VISTA = "galeria";
  PLANO_GALERIA_MENU_ID = null;
  PLANO_ACTIVO_ID = null;

  let overlay = document.getElementById("planos-visor-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "planos-visor-overlay";
    overlay.className = "planos-visor-overlay";
    document.body.appendChild(overlay);
  }
  document.body.classList.add("modal-open");
  renderVisorPlanos();
}

function cerrarVisorPlanos() {
  const overlay = document.getElementById("planos-visor-overlay");
  if (overlay) overlay.remove();
  document.body.classList.remove("modal-open");
  PLANO_PIN_CONTEXTO = null;
  if (PLANO_CAPA_INFORME && PLANO_CAPA_INFORME.onCerrar) PLANO_CAPA_INFORME.onCerrar();
  PLANO_CAPA_INFORME = null;
}

// Devuelve el plano "de trabajo": en modo capa de informe es un objeto virtual
// que tiene la imagen/dimensiones/escala del plano real pero los arrays de
// anotación del informe (misma referencia → las mutaciones se propagan solas).
function planoActivo() {
  const real = PLANOS.find(p => p.id === PLANO_ACTIVO_ID) || null;
  if (!real || !PLANO_CAPA_INFORME) return real;
  const ref = PLANO_CAPA_INFORME.planoRef;
  return {
    id: real.id,
    nombre: real.nombre,
    dataUrl: real.dataUrl,
    width: real.width,
    height: real.height,
    escala: real.escala,
    pines: ref.pines,
    trazos: ref.trazos,
    rectangulos: ref.rectangulos,
    lineas: ref.lineas,
    cotas: ref.cotas,
    textos: ref.textos || (ref.textos = []),
  };
}

// Abre el visor en modo "capa de informe": misma imagen y calibración del
// plano real, pero con trazos/pines/etc. propios del informe (aislados de
// Levantamiento). planoRef es el objeto mutable en INFORMES_ACREDITACION.
// Se abre directo en ese plano (salta la galería).
function abrirVisorPlanosConCapaInforme(planoId, planoRef, onCerrar) {
  const real = PLANOS.find(p => p.id === planoId);
  if (!real) { if (window.mostrarToast) mostrarToast("El plano no está cargado en esta sesión.", "error"); return; }
  planoRef.pines = planoRef.pines || [];
  planoRef.trazos = planoRef.trazos || [];
  planoRef.rectangulos = planoRef.rectangulos || [];
  planoRef.lineas = planoRef.lineas || [];
  planoRef.cotas = planoRef.cotas || [];
  PLANO_CAPA_INFORME = { planoId, planoRef, onCerrar: onCerrar || null };
  PLANO_PIN_CONTEXTO = null;
  PLANO_MODO = "mano";
  PLANO_VISTA = "visor";
  PLANO_GALERIA_MENU_ID = null;
  PLANO_UNDO_STACK = [];
  PLANO_REDO_STACK = [];
  PLANO_ACTIVO_ID = planoId;
  PLANO_ZOOM = calcularZoomAjustado(real);
  const pan = calcularPanCentrado(real, PLANO_ZOOM);
  PLANO_PAN_X = pan.x; PLANO_PAN_Y = pan.y;

  let overlay = document.getElementById("planos-visor-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "planos-visor-overlay";
    overlay.className = "planos-visor-overlay";
    document.body.appendChild(overlay);
  }
  document.body.classList.add("modal-open");
  renderVisorPlanos();
}

// Selecciona un plano desde la cuadrícula de galería y pasa al visor de
// herramientas sobre esa hoja, con el zoom inicial "ajustar a pantalla".
function abrirPlanoDesdeGaleria(id) {
  PLANO_ACTIVO_ID = id;
  const p = planoActivo();
  if (!p) return;
  PLANO_ZOOM = calcularZoomAjustado(p);
  const pan = calcularPanCentrado(p, PLANO_ZOOM);
  PLANO_PAN_X = pan.x; PLANO_PAN_Y = pan.y;
  PLANO_VISTA = "visor";
  renderVisorPlanos();
}

// Lista de planos ordenada alfabéticamente por nombre — se usa en todos los
// lugares donde se enumeran/listan planos (selector de hoja, etc.), sin
// reordenar el array PLANOS real (no hace falta, y evita mover referencias).
function planosOrdenados() {
  return PLANOS.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

// Calcula el zoom inicial para que el plano completo entre en pantalla (menos
// el alto aproximado de la barra superior + la barra de herramientas), en vez
// de arrancar siempre al 100% (que para un plano de varios miles de píxeles
// de ancho es solo una esquina).
function calcularZoomAjustado(plano) {
  const ALTO_BARRAS_APROX = 110;
  const availW = Math.max(200, window.innerWidth - 20);
  const availH = Math.max(200, window.innerHeight - ALTO_BARRAS_APROX);
  const z = Math.min(availW / plano.width, availH / plano.height);
  return Math.max(0.05, Math.min(z, 3));
}

// Centra el plano en pantalla al zoom dado — si el plano no llena el ancho
// completo del área disponible (o el alto), reparte el espacio sobrante en
// vez de dejarlo pegado a la esquina superior izquierda.
function calcularPanCentrado(plano, zoom) {
  const ALTO_BARRAS_APROX = 110;
  const availW = Math.max(200, window.innerWidth - 20);
  const availH = Math.max(200, window.innerHeight - ALTO_BARRAS_APROX);
  const contentW = plano.width * zoom;
  const contentH = plano.height * zoom;
  return {
    x: Math.max(0, (availW - contentW) / 2),
    y: Math.max(0, (availH - contentH) / 2),
  };
}

const PLANO_ZOOM_MAX = 8;

// Ajusta el zoom manteniendo fijo el punto de la imagen que está bajo
// (clientX, clientY) — así el zoom "crece desde donde está el dedo/cursor"
// en vez de siempre hacia la esquina superior izquierda.
function aplicarZoomCentrado(nuevoZoom, clientX, clientY) {
  const wrap = document.getElementById("planos-canvas-wrap");
  const plano = planoActivo();
  if (!wrap || !plano) { PLANO_ZOOM = nuevoZoom; return; }
  const zoomMin = Math.min(0.05, calcularZoomAjustado(plano));
  nuevoZoom = Math.max(zoomMin, Math.min(PLANO_ZOOM_MAX, nuevoZoom));
  const rect = wrap.getBoundingClientRect();
  const screenX = clientX - rect.left;
  const screenY = clientY - rect.top;
  const contentX = (screenX - PLANO_PAN_X) / PLANO_ZOOM;
  const contentY = (screenY - PLANO_PAN_Y) / PLANO_ZOOM;
  PLANO_ZOOM = nuevoZoom;
  PLANO_PAN_X = screenX - contentX * PLANO_ZOOM;
  PLANO_PAN_Y = screenY - contentY * PLANO_ZOOM;
}

function centroDelWrap() {
  const wrap = document.getElementById("planos-canvas-wrap");
  if (!wrap) return { x: 0, y: 0 };
  const rect = wrap.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

// Pantalla de carga simple mientras se rasteriza un PDF — el paso de codificar
// la imagen final puede tardar varios segundos en un plano grande (ver nota en
// canvasADataUrlAsync), así que sin esto el celular parecería trabado.
function mostrarCargandoPlano(mostrar) {
  const overlay = document.getElementById("planos-visor-overlay");
  if (!overlay) return;
  let cargando = document.getElementById("planos-cargando");
  if (mostrar) {
    if (!cargando) {
      cargando = document.createElement("div");
      cargando.id = "planos-cargando";
      cargando.className = "planos-cargando";
      cargando.innerHTML = `<div class="planos-spinner"></div><p>Procesando plano… puede tardar varios segundos</p>`;
      overlay.appendChild(cargando);
    }
  } else if (cargando) {
    cargando.remove();
  }
}

// Cursor por herramienta — que el puntero del mouse muestre la herramienta
// activa en vez de siempre la manita, para saber de un vistazo qué modo está
// puesto sin mirar la barra. "Mano"/formas usan cursores nativos del navegador
// (grab/crosshair, sin costo y con soporte garantizado); lápiz/marcador/
// borrador usan un ícono chico armado a mano (blanco con contorno negro, para
// que se vea tanto sobre el plano claro como sobre el fondo gris del visor).
function cursorSVG(pathD, hotspotX, hotspotY, viewBox) {
  const vb = viewBox || "0 0 24 24";
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='26' height='26' viewBox='${vb}'>` +
    `<g fill='none' stroke='white' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'>${pathD}</g>` +
    `<g fill='none' stroke='black' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'>${pathD}</g>` +
    `</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hotspotX} ${hotspotY}`;
}
const PLANO_CURSORES = {
  lapiz: cursorSVG('<path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>', 3, 22) + ", crosshair",
  resaltador: cursorSVG('<path d="M14.5 3.5a2 2 0 0 1 2.83 0l3.17 3.17a2 2 0 0 1 0 2.83L9.5 20.5H3v-6.5Z"/>', 3, 22) + ", crosshair",
  borrador: cursorSVG('<g transform="rotate(-12 12 12.5)"><rect x="4" y="8" width="16" height="9" rx="2.5"/></g>', 12, 13) + ", crosshair",
};
function cursorParaModo(modo) {
  if (modo === "mano") return "grab";
  if (PLANO_CURSORES[modo]) return PLANO_CURSORES[modo];
  // rectángulo, línea, pin, calibrar, regla: cursor nativo de precisión.
  return "crosshair";
}

// Cuadrícula de miniaturas — pantalla inicial del módulo de Planos. Cada
// tarjeta es un plano subido (con botón editar → renombrar/borrar) más una
// tarjeta final para subir uno nuevo (la subida SOLO vive acá, ver item 11).
function renderGaleriaPlanos() {
  const ordenados = planosOrdenados();
  return `
    <div class="planos-galeria-wrap" id="planos-galeria-wrap">
      <div class="planos-galeria-drop-hint" id="planos-galeria-drop-hint">Soltá el o los PDF acá para subirlos</div>
      ${!ordenados.length ? `<p class="planos-galeria-vacio-msg">Todavía no subiste ningún plano — subí el primero para empezar a marcarlo.</p>` : ""}
      <div class="planos-galeria-grid">
        ${ordenados.map(p => `
          <div class="planos-galeria-card">
            <button type="button" class="planos-galeria-card-btn" data-planos-abrir="${p.id}">
              <img src="${p.dataUrl}" alt="${escapeHtml(p.nombre)}" draggable="false">
            </button>
            <div class="planos-galeria-card-footer">
              <span class="planos-galeria-card-nombre">${escapeHtml(p.nombre)}</span>
              <button type="button" class="planos-galeria-card-editar" data-planos-editar="${p.id}" aria-label="Editar plano" title="Renombrar o borrar plano">
                <svg class="icon"><use href="#i-edit"/></svg>
              </button>
            </div>
            ${PLANO_GALERIA_MENU_ID === p.id ? `
              <div class="planos-galeria-menu">
                <button type="button" data-planos-menu-renombrar="${p.id}"><svg class="icon"><use href="#i-edit"/></svg>Renombrar</button>
                <button type="button" data-planos-menu-borrar="${p.id}" class="planos-galeria-menu-borrar"><svg class="icon"><use href="#i-trash"/></svg>Borrar</button>
              </div>
            ` : ""}
          </div>
        `).join("")}
        <label class="planos-galeria-card planos-galeria-card-nueva" for="planos-input-subir-galeria">
          <span class="planos-galeria-card-nueva-icono"><svg class="icon"><use href="#i-upload"/></svg></span>
          <span>Subir plano (PDF)</span>
          <input type="file" accept="application/pdf" id="planos-input-subir-galeria" class="lev-foto-input-oculto" multiple>
        </label>
      </div>
    </div>
  `;
}

function renderVisorPlanos() {
  const overlay = document.getElementById("planos-visor-overlay");
  if (!overlay) return;
  const plano = planoActivo();
  const enVisor = PLANO_VISTA === "visor" && plano;
  const enCapaInforme = !!PLANO_CAPA_INFORME;

  overlay.innerHTML = `
    <div class="planos-visor-topbar">
      <button type="button" id="planos-btn-cerrar" class="lev-exit-btn"><svg class="icon"><use href="#i-arrow-left"/></svg>${enVisor && !enCapaInforme ? "Planos" : "Cerrar"}</button>
      ${enVisor ? (enCapaInforme ? `
        <span class="planos-visor-title">Plano del informe <span style="font-weight:400;opacity:0.7">· ${escapeHtml(plano.nombre)}</span></span>
      ` : `
        <select id="planos-select-hoja" class="planos-select-hoja">
          ${planosOrdenados().map(p => `<option value="${p.id}" ${p.id === PLANO_ACTIVO_ID ? "selected" : ""}>${escapeHtml(p.nombre)}</option>`).join("")}
        </select>
        <button type="button" id="planos-btn-renombrar" class="planos-btn-icono" aria-label="Renombrar plano" title="Renombrar plano"><svg class="icon"><use href="#i-edit"/></svg></button>
        <button type="button" id="planos-btn-compartir" class="planos-btn-icono" aria-label="Compartir plano" title="Compartir plano"><svg class="icon"><use href="#i-share"/></svg></button>
      `) : `<span class="planos-visor-title">Planos</span>`}
    </div>
    ${!enVisor ? renderGaleriaPlanos() : renderVisorHerramientasYCanvas(plano)}
  `;

  attachVisorPlanosEvents(overlay);
  const wrapCursor = document.getElementById("planos-canvas-wrap");
  if (wrapCursor) wrapCursor.style.cursor = cursorParaModo(PLANO_MODO);
}

// Rail de herramientas + barra secundaria (hints/zoom) + canvas — separado de
// renderVisorPlanos() para que el template principal no quede gigante.
function renderInputTextoFlotante(plano) {
  if (!PLANO_TEXTO_EDITANDO) return "";
  const e = PLANO_TEXTO_EDITANDO;
  const t = (plano.textos || []).find((x) => x.id === e.id);
  const tamano = t ? (t.tamano || PLANO_TAMANO_TEXTO) : PLANO_TAMANO_TEXTO;
  const tamanoPx = Math.max(plano.width, plano.height) * tamano;
  const color = t ? t.color : PLANO_COLOR_TEXTO;
  const x = e.xFrac * plano.width, y = e.yFrac * plano.height;
  return `
    <input type="text" id="planos-texto-input-flotante" class="planos-texto-input-flotante"
      style="left:${x}px; top:${y}px; font-size:${tamanoPx}px; color:${color};"
      value="${escapeHtml(e.textoActual || "")}" placeholder="Escribí...">`;
}
function confirmarTextoFlotante() {
  const e = PLANO_TEXTO_EDITANDO;
  if (!e) return;
  const plano = planoActivo();
  const texto = (e.textoActual || "").trim();
  if (!plano) { PLANO_TEXTO_EDITANDO = null; renderVisorPlanos(); return; }
  if (!plano.textos) plano.textos = [];
  if (e.id == null) {
    // Texto nuevo: solo se guarda si tiene contenido.
    if (texto) {
      const nuevo = { id: Date.now() + Math.random(), xFrac: e.xFrac, yFrac: e.yFrac, texto, color: PLANO_COLOR_TEXTO, tamano: PLANO_TAMANO_TEXTO };
      PLANO_UNDO_STACK.push(snapshotPlano(plano));
      if (PLANO_UNDO_STACK.length > 25) PLANO_UNDO_STACK.shift();
      PLANO_REDO_STACK = [];
      plano.textos.push(nuevo);
      marcarCambio();
    }
  } else {
    const t = plano.textos.find((x) => x.id === e.id);
    if (t) {
      if (texto) {
        PLANO_UNDO_STACK.push(snapshotPlano(plano));
        if (PLANO_UNDO_STACK.length > 25) PLANO_UNDO_STACK.shift();
        PLANO_REDO_STACK = [];
        t.texto = texto;
        marcarCambio();
      } else {
        // Se vació el texto al editar: se borra el elemento.
        PLANO_UNDO_STACK.push(snapshotPlano(plano));
        if (PLANO_UNDO_STACK.length > 25) PLANO_UNDO_STACK.shift();
        PLANO_REDO_STACK = [];
        plano.textos = plano.textos.filter((x) => x.id !== e.id);
        PLANO_TEXTO_SELECCIONADO_ID = null;
        marcarCambio();
      }
    }
  }
  PLANO_TEXTO_EDITANDO = null;
  renderVisorPlanos();
}
function tamanoTextoSeleccionado() {
  const plano = planoActivo();
  if (!plano || PLANO_TEXTO_SELECCIONADO_ID == null) return PLANO_TAMANO_TEXTO;
  const t = (plano.textos || []).find((x) => x.id === PLANO_TEXTO_SELECCIONADO_ID);
  return t ? (t.tamano || PLANO_TAMANO_TEXTO) : PLANO_TAMANO_TEXTO;
}
function renderVisorHerramientasYCanvas(plano) {
  const grosorActual = PLANO_GROSORES.find(g => g.valor === PLANO_GROSOR) || PLANO_GROSORES[3];
  const hint = PLANO_PIN_CONTEXTO ? "Tocá el plano para ubicar esta fila"
    : PLANO_MODO === "calibrar" ? (plano.escala ? "Tocá 2 puntos para volver a calibrar" : "Tocá 2 puntos de distancia conocida")
    : PLANO_MODO === "regla" ? (plano.escala ? "Tocá 2 puntos para medir" : "Primero calibrá la escala de este plano")
    : null;
  // El botón de color edita el color de los PINES cuando esa es la herramienta
  // activa, y el color de dibujo/cota en cualquier otro caso — un solo botón,
  // significado contextual (ver item 10 pedido por Kevin).
  const colorActual = PLANO_MODO === "punto" ? PLANO_COLOR_PIN : PLANO_MODO === "texto" ? PLANO_COLOR_TEXTO : PLANO_COLOR_MARCADOR;

  return `
      <div class="planos-tools-rail ${PLANO_TOOLS_COLLAPSED ? "planos-tools-collapsed" : ""}" id="planos-tools-rail">
        <div class="planos-tools-list">
          <button type="button" class="planos-modo-btn ${PLANO_MODO === "mano" ? "planos-modo-active" : ""}" data-planos-modo="mano" title="Mover"><svg class="icon"><use href="#i-move"/></svg></button>
          <button type="button" class="planos-modo-btn ${PLANO_MODO === "lapiz" ? "planos-modo-active" : ""}" data-planos-modo="lapiz" title="Lápiz (apuntes)"><svg class="icon"><use href="#i-edit"/></svg></button>
          <button type="button" class="planos-modo-btn ${PLANO_MODO === "resaltador" ? "planos-modo-active" : ""}" data-planos-modo="resaltador" title="Marcador"><svg class="icon"><use href="#i-highlighter"/></svg></button>
          <button type="button" class="planos-modo-btn ${PLANO_MODO === "rectangulo" ? "planos-modo-active" : ""}" data-planos-modo="rectangulo" title="Recuadro"><svg class="icon"><use href="#i-rectangle"/></svg></button>
          <button type="button" class="planos-modo-btn ${PLANO_MODO === "linea" ? "planos-modo-active" : ""}" data-planos-modo="linea" title="Línea recta"><svg class="icon"><use href="#i-line"/></svg></button>
          <button type="button" class="planos-modo-btn ${PLANO_MODO === "punto" ? "planos-modo-active" : ""}" data-planos-modo="punto" title="Pin"><svg class="icon"><use href="#i-pin"/></svg></button>
          <button type="button" class="planos-modo-btn ${PLANO_MODO === "texto" ? "planos-modo-active" : ""}" data-planos-modo="texto" title="Texto"><svg class="icon"><use href="#i-list"/></svg></button>
          <button type="button" class="planos-modo-btn ${PLANO_MODO === "calibrar" ? "planos-modo-active" : ""}" data-planos-modo="calibrar" title="Calibrar escala"><svg class="icon"><use href="#i-compass-tool"/></svg></button>
          <button type="button" class="planos-modo-btn ${PLANO_MODO === "regla" ? "planos-modo-active" : ""}" data-planos-modo="regla" title="Medir"><svg class="icon"><use href="#i-ruler"/></svg></button>
          <button type="button" class="planos-modo-btn ${PLANO_MODO === "borrador" ? "planos-modo-active" : ""}" data-planos-modo="borrador" title="Borrador (toca un trazo para quitarlo)"><svg class="icon"><use href="#i-eraser"/></svg></button>
          <div class="planos-rail-divider"></div>
          <div class="planos-rail-flyout-wrap">
            <button type="button" id="planos-rail-color-btn" class="planos-modo-btn planos-rail-swatch-btn" title="Color">
              <span class="planos-rail-color-dot" style="background:${colorActual};"></span>
            </button>
            ${PLANO_RAIL_FLYOUT === "color" ? `
              <div class="planos-rail-flyout ${PLANO_MODO === "rectangulo" ? "planos-rail-flyout-vertical" : ""}" id="planos-color-flyout">
                <div class="planos-color-group">
                  ${PLANO_PALETA_COLORES.map(c => `<button type="button" class="planos-color-swatch ${c === colorActual ? "planos-color-activo" : ""}" data-planos-color="${c}" style="background:${c};" aria-label="Color ${c}"></button>`).join("")}
                </div>
                ${PLANO_MODO === "rectangulo" ? `
                  <label class="planos-relleno-check">
                    <input type="checkbox" id="planos-relleno-check" ${PLANO_RECT_RELLENO ? "checked" : ""}>
                    Relleno
                  </label>
                  ${PLANO_RECT_RELLENO ? `
                    <div class="planos-grosor-group">
                      ${PLANO_OPACIDADES.map(o => `<button type="button" class="planos-grosor-btn ${o.valor === PLANO_RECT_OPACIDAD ? "planos-grosor-activo" : ""}" data-planos-opacidad="${o.valor}" title="${o.nombre}"><span style="opacity:${o.valor};background:currentColor;width:14px;height:14px;border-radius:3px;"></span></button>`).join("")}
                    </div>
                  ` : ""}
                ` : ""}
              </div>
            ` : ""}
          </div>
          <div class="planos-rail-flyout-wrap">
            ${PLANO_MODO === "texto" ? `
            <button type="button" id="planos-rail-tamano-texto-btn" class="planos-modo-btn planos-rail-swatch-btn" title="Tamaño de texto">
              <span class="planos-rail-tamano-texto-preview">A</span>
            </button>
            ${PLANO_RAIL_FLYOUT === "tamanoTexto" ? `
              <div class="planos-rail-flyout planos-rail-flyout-vertical" id="planos-tamano-texto-flyout">
                <div class="planos-grosor-group">
                  ${PLANO_TAMANOS_TEXTO.map((t, i) => `<button type="button" class="planos-grosor-btn ${t === (PLANO_TEXTO_SELECCIONADO_ID != null ? tamanoTextoSeleccionado() : PLANO_TAMANO_TEXTO) ? "planos-grosor-activo" : ""}" data-planos-tamano-texto="${t}" aria-label="Tamaño ${i + 1}"><span style="font-size:${10 + i * 5}px; font-weight:700;">A</span></button>`).join("")}
                </div>
              </div>
            ` : ""}
            ` : `
            <button type="button" id="planos-rail-grosor-btn" class="planos-modo-btn planos-rail-swatch-btn" title="Grosor">
              <span class="planos-rail-grosor-linea" style="height:${Math.max(2, Math.round(grosorActual.puntoPx * 0.45))}px;"></span>
            </button>
            ${PLANO_RAIL_FLYOUT === "grosor" ? `
              <div class="planos-rail-flyout planos-rail-flyout-vertical" id="planos-grosor-flyout">
                <div class="planos-grosor-group">
                  ${PLANO_GROSORES.map(g => `<button type="button" class="planos-grosor-btn ${g.valor === PLANO_GROSOR ? "planos-grosor-activo" : ""}" data-planos-grosor="${g.valor}" aria-label="${g.nombre}" title="${g.nombre}"><span style="width:22px; height:${Math.max(2, Math.round(g.puntoPx * 0.45))}px; border-radius:2px;"></span></button>`).join("")}
                </div>
                ${PLANO_MODO === "resaltador" ? `
                  <span class="planos-rail-flyout-label">Transparencia</span>
                  <div class="planos-grosor-group">
                    ${PLANO_OPACIDADES.map(o => `<button type="button" class="planos-grosor-btn ${o.valor === PLANO_RESALTADOR_OPACIDAD ? "planos-grosor-activo" : ""}" data-planos-opacidad-marcador="${o.valor}" title="${o.nombre}"><span style="opacity:${o.valor};background:currentColor;width:14px;height:14px;border-radius:3px;"></span></button>`).join("")}
                  </div>
                ` : ""}
              </div>
            ` : ""}
            `}
          </div>
          <div class="planos-rail-divider"></div>
          <button type="button" id="planos-btn-rehacer" class="planos-modo-btn" aria-label="Rehacer" title="Rehacer (deshacer el último Deshacer)"><svg class="icon"><use href="#i-redo"/></svg></button>
          ${PLANO_MODO === "texto" && PLANO_TEXTO_SELECCIONADO_ID != null ? `
          <button type="button" id="planos-btn-borrar-texto" class="planos-modo-btn" aria-label="Borrar texto seleccionado" title="Borrar texto seleccionado"><svg class="icon"><use href="#i-trash"/></svg></button>
          ` : ""}
          <button type="button" id="planos-btn-deshacer" class="planos-modo-btn" aria-label="Deshacer" title="Deshacer última acción en el plano"><svg class="icon"><use href="#i-undo"/></svg></button>
        </div>
        <button type="button" id="planos-tools-toggle" class="planos-tools-toggle" aria-label="Mostrar/ocultar herramientas" title="Mostrar/ocultar herramientas">
          <svg class="icon"><use href="#i-chevron-down"/></svg>
        </button>
      </div>
      ${hint ? `
        <div class="planos-toolbar">
          <span class="planos-vinculo-hint">${hint}</span>
        </div>
      ` : ""}
      <div class="planos-canvas-wrap" id="planos-canvas-wrap">
        <div class="planos-zoom-pill">
          <button type="button" id="planos-zoom-menos" aria-label="Alejar">−</button>
          <button type="button" id="planos-zoom-mas" aria-label="Acercar">+</button>
        </div>
        <div class="planos-canvas-inner" id="planos-canvas-inner" style="transform: translate(${PLANO_PAN_X}px, ${PLANO_PAN_Y}px) scale(${PLANO_ZOOM});">
          <img src="${plano.dataUrl}" class="planos-img" id="planos-img" draggable="false" alt="${escapeHtml(plano.nombre)}">
          <svg class="planos-svg-overlay" id="planos-svg-overlay" viewBox="0 0 ${plano.width} ${plano.height}" preserveAspectRatio="none">
            ${(plano.rectangulos || []).map(r => {
              const grosor = r.grosor || 1;
              return `<rect x="${r.xFrac * plano.width}" y="${r.yFrac * plano.height}" width="${r.wFrac * plano.width}" height="${r.hFrac * plano.height}" fill="${r.relleno ? r.color : "none"}" fill-opacity="${r.relleno ? r.opacidadRelleno : 0}" stroke="${r.color}" stroke-width="${Math.max(plano.width, plano.height) * 0.004 * grosor}" data-planos-forma-id="${r.id}" data-planos-forma-tipo="rectangulo"/>`;
            }).join("")}
            ${(plano.lineas || []).map(l => {
              const grosor = l.grosor || 1;
              return `<line x1="${l.x1Frac * plano.width}" y1="${l.y1Frac * plano.height}" x2="${l.x2Frac * plano.width}" y2="${l.y2Frac * plano.height}" stroke="${l.color}" stroke-width="${Math.max(plano.width, plano.height) * 0.005 * grosor}" stroke-linecap="round" data-planos-forma-id="${l.id}" data-planos-forma-tipo="linea"/>`;
            }).join("")}
            ${(plano.trazos || []).map(t => {
              const estilo = TRAZO_ESTILOS[t.tipo] || TRAZO_ESTILOS.lapiz;
              const grosor = t.grosor || 1;
              return `<polyline points="${t.puntos.map(pt => `${pt.xFrac * plano.width},${pt.yFrac * plano.height}`).join(" ")}" fill="none" stroke="${t.color}" stroke-opacity="${t.opacidad != null ? t.opacidad : estilo.opacidad}" stroke-width="${Math.max(plano.width, plano.height) * estilo.grosorFactor * grosor}" stroke-linecap="round" stroke-linejoin="round"/>`;
            }).join("")}
            ${(plano.cotas || []).map(c => svgCota(plano, c)).join("")}
            ${(plano.textos || []).filter(t => !PLANO_TEXTO_EDITANDO || t.id !== PLANO_TEXTO_EDITANDO.id).map(t => {
              const tamanoPx = Math.max(plano.width, plano.height) * (t.tamano || PLANO_TAMANO_TEXTO);
              const seleccionado = t.id === PLANO_TEXTO_SELECCIONADO_ID;
              const x = t.xFrac * plano.width, y = t.yFrac * plano.height;
              return `<text x="${x}" y="${y}" font-size="${tamanoPx}" font-weight="700" font-family="Arial, sans-serif" fill="${t.color}" stroke="rgba(0,0,0,0.65)" stroke-width="${Math.max(2, tamanoPx * 0.1)}" paint-order="stroke" dominant-baseline="middle" data-planos-texto-id="${t.id}" style="cursor:pointer;${seleccionado ? "outline:1px dashed white;" : ""}">${escapeHtml(t.texto)}</text>`;
            }).join("")}
          </svg>
          ${renderInputTextoFlotante(plano)}
          <div class="planos-pines-layer">
            ${(plano.pines || []).map((pin, i) => `
              <button type="button" class="planos-pin" data-planos-pin-id="${pin.id}" style="left:${pin.xFrac * 100}%; top:${pin.yFrac * 100}%; background:${pin.color || "#e2001a"};" title="${escapeHtml(pin.nota || (pin.filaId != null ? "Vinculado a fila" : "Nota"))}"><span>${i + 1}</span></button>
            `).join("")}
          </div>
        </div>
      </div>
  `;
}

// Dibuja una "cota" (línea de medición con formato de dimensión): línea
// principal + pequeñas marcas perpendiculares en cada extremo + el texto de
// la distancia centrado, con un fondo para que se lea sobre cualquier plano.
// Tamaños chicos a propósito (ver grosorLineaFina) — antes quedaban enormes.
function svgCota(plano, c) {
  const maxDim = Math.max(plano.width, plano.height);
  const grosor = grosorLineaFina(plano);
  const x1 = c.x1Frac * plano.width, y1 = c.y1Frac * plano.height;
  const x2 = c.x2Frac * plano.width, y2 = c.y2Frac * plano.height;
  const dx = x2 - x1, dy = y2 - y1;
  const largo = Math.hypot(dx, dy) || 1;
  // Vector perpendicular unitario, para las marcas de extremo tipo cota de plano.
  const px = -dy / largo, py = dx / largo;
  const marca = maxDim * 0.005;
  const mx1a = x1 - px * marca / 2, my1a = y1 - py * marca / 2, mx1b = x1 + px * marca / 2, my1b = y1 + py * marca / 2;
  const mx2a = x2 - px * marca / 2, my2a = y2 - py * marca / 2, mx2b = x2 + px * marca / 2, my2b = y2 + py * marca / 2;
  const midX = (x1 + x2) / 2, midY = (y1 + y2) / 2;
  const fontSize = maxDim * 0.0055;
  const texto = escapeHtml(textoCota(plano, c));
  const anchoTexto = texto.length * fontSize * 0.62 + fontSize * 0.6;
  let angulo = Math.atan2(dy, dx) * 180 / Math.PI;
  if (angulo > 90 || angulo < -90) angulo += 180; // que el texto nunca quede boca abajo
  const color = c.color || "#111111";
  return `
    <g data-planos-forma-id="${c.id}" data-planos-forma-tipo="cotas">
      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${grosor}"/>
      <line x1="${mx1a}" y1="${my1a}" x2="${mx1b}" y2="${my1b}" stroke="${color}" stroke-width="${grosor}"/>
      <line x1="${mx2a}" y1="${my2a}" x2="${mx2b}" y2="${my2b}" stroke="${color}" stroke-width="${grosor}"/>
      <g transform="translate(${midX} ${midY}) rotate(${angulo})">
        <rect x="${-anchoTexto / 2}" y="${-fontSize * 0.85}" width="${anchoTexto}" height="${fontSize * 1.35}" fill="white" fill-opacity="0.85"/>
        <text x="0" y="0" font-size="${fontSize}" fill="${color}" text-anchor="middle" dominant-baseline="middle" font-weight="600">${texto}</text>
      </g>
    </g>`;
}

// Grosor delgado y fijo (no depende del selector de grosor del lápiz) para
// las líneas de Calibrar/Regla/Cota — sesión anterior las dejó "Extra fino"
// (factor 0.3) y seguían viéndose gruesas; ahora usan directamente el mínimo
// de la escala ("Muy fino", factor 0.15).
function grosorLineaFina(plano) {
  return Math.max(plano.width, plano.height) * 0.004 * 0.15;
}

function attachVisorPlanosEvents(overlay) {
  // El botón "Cerrar"/"← Planos" del topbar hace dos cosas distintas según la
  // vista: si estamos viendo un plano puntual, vuelve a la galería; si ya
  // estamos en la galería, cierra el módulo entero.
  const btnCerrar = document.getElementById("planos-btn-cerrar");
  if (btnCerrar) btnCerrar.addEventListener("click", () => {
    if (PLANO_VISTA === "visor" && !PLANO_CAPA_INFORME) {
      PLANO_VISTA = "galeria";
      PLANO_GALERIA_MENU_ID = null;
      renderVisorPlanos();
    } else {
      cerrarVisorPlanos();
    }
  });

  const selectHoja = document.getElementById("planos-select-hoja");
  if (selectHoja) selectHoja.addEventListener("change", () => {
    PLANO_ACTIVO_ID = parseInt(selectHoja.value, 10);
    const p = planoActivo();
    PLANO_ZOOM = p ? calcularZoomAjustado(p) : 1;
    const pan = p ? calcularPanCentrado(p, PLANO_ZOOM) : { x: 0, y: 0 };
    PLANO_PAN_X = pan.x; PLANO_PAN_Y = pan.y;
    renderVisorPlanos();
  });
  const btnRenombrar = document.getElementById("planos-btn-renombrar");
  if (btnRenombrar) btnRenombrar.addEventListener("click", () => {
    const plano = planoActivo();
    if (!plano) return;
    const nuevoNombre = prompt("Nombre del plano:", plano.nombre);
    if (nuevoNombre && nuevoNombre.trim()) {
      plano.nombre = nuevoNombre.trim();
      marcarCambio();
      renderVisorPlanos();
    }
  });
  const btnCompartir = document.getElementById("planos-btn-compartir");
  if (btnCompartir) btnCompartir.addEventListener("click", compartirPlanoActual);

  const toolsToggle = document.getElementById("planos-tools-toggle");
  if (toolsToggle) toolsToggle.addEventListener("click", () => {
    PLANO_TOOLS_COLLAPSED = !PLANO_TOOLS_COLLAPSED;
    PLANO_RAIL_FLYOUT = null;
    renderVisorPlanos();
  });

  // --- Cuadrícula de galería: abrir un plano, y menú Renombrar/Borrar ---
  document.querySelectorAll("[data-planos-abrir]").forEach(btn => {
    btn.addEventListener("click", () => abrirPlanoDesdeGaleria(parseInt(btn.dataset.planosAbrir, 10)));
  });
  document.querySelectorAll("[data-planos-editar]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.planosEditar, 10);
      PLANO_GALERIA_MENU_ID = PLANO_GALERIA_MENU_ID === id ? null : id;
      renderVisorPlanos();
    });
  });
  document.querySelectorAll("[data-planos-menu-renombrar]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const p = PLANOS.find(pl => pl.id === parseInt(btn.dataset.planosMenuRenombrar, 10));
      if (!p) return;
      const nuevoNombre = prompt("Nombre del plano:", p.nombre);
      if (nuevoNombre && nuevoNombre.trim()) { p.nombre = nuevoNombre.trim(); marcarCambio(); }
      PLANO_GALERIA_MENU_ID = null;
      renderVisorPlanos();
    });
  });
  document.querySelectorAll("[data-planos-menu-borrar]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.planosMenuBorrar, 10);
      const p = PLANOS.find(pl => pl.id === id);
      if (!p) return;
      if (confirm(`¿Borrar el plano "${p.nombre}"? Se van a perder sus marcas, pines y cotas.`)) {
        PLANOS = PLANOS.filter(pl => pl.id !== id);
        marcarCambio();
      }
      PLANO_GALERIA_MENU_ID = null;
      renderVisorPlanos();
    });
  });
  // Cerrar el menú "Renombrar/Borrar" de la galería y los flyouts de
  // color/grosor del riel al tocar afuera — se agrega una sola vez sobre el
  // overlay persistente (no en cada render, para no acumular).
  if (!overlay.dataset.planosClickFueraBind) {
    overlay.dataset.planosClickFueraBind = "1";
    overlay.addEventListener("click", (e) => {
      if (PLANO_GALERIA_MENU_ID != null && !e.target.closest(".planos-galeria-menu") && !e.target.closest("[data-planos-editar]")) {
        PLANO_GALERIA_MENU_ID = null;
        renderVisorPlanos();
      }
      if (PLANO_RAIL_FLYOUT != null && !e.target.closest(".planos-rail-flyout") && !e.target.closest(".planos-rail-swatch-btn")) {
        PLANO_RAIL_FLYOUT = null;
        renderVisorPlanos();
      }
    });
  }

  ["planos-input-subir-galeria"].forEach(id => {
    const input = document.getElementById(id);
    if (!input) return;
    input.addEventListener("change", async () => {
      if (!input.files || !input.files.length) return;
      await subirVariosPlanos(input.files);
      input.value = "";
    });
  });

  // Arrastrar y soltar (desktop) — sobre toda la galería, no solo la
  // tarjeta de "Subir plano". En touch estos eventos simplemente no se
  // disparan, no hace falta distinguir dispositivo.
  const galeriaWrap = document.getElementById("planos-galeria-wrap");
  if (galeriaWrap) {
    let dragCounter = 0;
    galeriaWrap.addEventListener("dragenter", (e) => {
      e.preventDefault();
      dragCounter++;
      galeriaWrap.classList.add("planos-galeria-dragover");
    });
    galeriaWrap.addEventListener("dragover", (e) => e.preventDefault());
    galeriaWrap.addEventListener("dragleave", () => {
      dragCounter = Math.max(0, dragCounter - 1);
      if (dragCounter === 0) galeriaWrap.classList.remove("planos-galeria-dragover");
    });
    galeriaWrap.addEventListener("drop", async (e) => {
      e.preventDefault();
      dragCounter = 0;
      galeriaWrap.classList.remove("planos-galeria-dragover");
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
        await subirVariosPlanos(e.dataTransfer.files);
      }
    });
  }

  document.querySelectorAll("[data-planos-modo]").forEach(btn => {
    btn.addEventListener("click", () => {
      PLANO_MODO = btn.dataset.planosModo;
      PLANO_RAIL_FLYOUT = null; // cambiar de herramienta cierra cualquier flyout de color/grosor abierto
      if (PLANO_MODO !== "texto") { PLANO_TEXTO_SELECCIONADO_ID = null; PLANO_TEXTO_EDITANDO = null; }
      renderVisorPlanos();
    });
  });
  const railColorBtn = document.getElementById("planos-rail-color-btn");
  if (railColorBtn) railColorBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    PLANO_RAIL_FLYOUT = PLANO_RAIL_FLYOUT === "color" ? null : "color";
    renderVisorPlanos();
  });
  const railGrosorBtn = document.getElementById("planos-rail-grosor-btn");
  if (railGrosorBtn) railGrosorBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    PLANO_RAIL_FLYOUT = PLANO_RAIL_FLYOUT === "grosor" ? null : "grosor";
    renderVisorPlanos();
  });
  const railTamanoTextoBtn = document.getElementById("planos-rail-tamano-texto-btn");
  if (railTamanoTextoBtn) railTamanoTextoBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    PLANO_RAIL_FLYOUT = PLANO_RAIL_FLYOUT === "tamanoTexto" ? null : "tamanoTexto";
    renderVisorPlanos();
  });
  document.querySelectorAll("[data-planos-tamano-texto]").forEach(btn => {
    btn.addEventListener("click", () => {
      const val = parseFloat(btn.dataset.planosTamanoTexto);
      PLANO_TAMANO_TEXTO = val;
      if (PLANO_TEXTO_SELECCIONADO_ID != null) {
        const plano = planoActivo();
        const t = plano && (plano.textos || []).find((x) => x.id === PLANO_TEXTO_SELECCIONADO_ID);
        if (t) { t.tamano = val; marcarCambio(); }
      }
      PLANO_RAIL_FLYOUT = null;
      renderVisorPlanos();
    });
  });
  document.querySelectorAll("[data-planos-color]").forEach(btn => {
    btn.addEventListener("click", () => {
      // El botón de color es el mismo para dibujo, pines y texto — pinta uno
      // u otro estado según qué herramienta esté activa en ese momento (ver
      // colorActual en renderVisorHerramientasYCanvas).
      if (PLANO_MODO === "punto") {
        PLANO_COLOR_PIN = btn.dataset.planosColor;
      } else if (PLANO_MODO === "texto") {
        PLANO_COLOR_TEXTO = btn.dataset.planosColor;
        if (PLANO_TEXTO_SELECCIONADO_ID != null) {
          const plano = planoActivo();
          const t = plano && (plano.textos || []).find((x) => x.id === PLANO_TEXTO_SELECCIONADO_ID);
          if (t) { t.color = btn.dataset.planosColor; marcarCambio(); }
        }
      } else {
        PLANO_COLOR_MARCADOR = btn.dataset.planosColor;
      }
      renderVisorPlanos();
    });
  });
  document.querySelectorAll("[data-planos-grosor]").forEach(btn => {
    btn.addEventListener("click", () => {
      PLANO_GROSOR = parseFloat(btn.dataset.planosGrosor);
      renderVisorPlanos();
    });
  });
  const rellenoCheck = document.getElementById("planos-relleno-check");
  if (rellenoCheck) rellenoCheck.addEventListener("change", () => {
    PLANO_RECT_RELLENO = rellenoCheck.checked;
    renderVisorPlanos();
  });
  document.querySelectorAll("[data-planos-opacidad]").forEach(btn => {
    btn.addEventListener("click", () => {
      PLANO_RECT_OPACIDAD = parseFloat(btn.dataset.planosOpacidad);
      renderVisorPlanos();
    });
  });
  document.querySelectorAll("[data-planos-opacidad-marcador]").forEach(btn => {
    btn.addEventListener("click", () => {
      PLANO_RESALTADOR_OPACIDAD = parseFloat(btn.dataset.planosOpacidadMarcador);
      renderVisorPlanos();
    });
  });
  const btnDeshacer = document.getElementById("planos-btn-deshacer");
  if (btnDeshacer) btnDeshacer.addEventListener("click", planoDeshacer);
  const btnRehacer = document.getElementById("planos-btn-rehacer");
  if (btnRehacer) btnRehacer.addEventListener("click", planoRehacer);
  const btnBorrarTexto = document.getElementById("planos-btn-borrar-texto");
  if (btnBorrarTexto) btnBorrarTexto.addEventListener("click", () => {
    const plano = planoActivo();
    if (!plano || PLANO_TEXTO_SELECCIONADO_ID == null) return;
    PLANO_UNDO_STACK.push(snapshotPlano(plano));
    if (PLANO_UNDO_STACK.length > 25) PLANO_UNDO_STACK.shift();
    PLANO_REDO_STACK = [];
    plano.textos = (plano.textos || []).filter((t) => t.id !== PLANO_TEXTO_SELECCIONADO_ID);
    PLANO_TEXTO_SELECCIONADO_ID = null;
    marcarCambio();
    renderVisorPlanos();
  });

  const inputTextoFlotante = document.getElementById("planos-texto-input-flotante");
  if (inputTextoFlotante) {
    inputTextoFlotante.focus();
    const val = inputTextoFlotante.value; inputTextoFlotante.value = ""; inputTextoFlotante.value = val; // cursor al final
    inputTextoFlotante.addEventListener("input", () => {
      if (PLANO_TEXTO_EDITANDO) PLANO_TEXTO_EDITANDO.textoActual = inputTextoFlotante.value;
    });
    inputTextoFlotante.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter") { evt.preventDefault(); confirmarTextoFlotante(); }
      else if (evt.key === "Escape") { evt.preventDefault(); PLANO_TEXTO_EDITANDO = null; renderVisorPlanos(); }
    });
    inputTextoFlotante.addEventListener("blur", () => { if (PLANO_TEXTO_EDITANDO) confirmarTextoFlotante(); });
  }


  const zoomMenos = document.getElementById("planos-zoom-menos");
  if (zoomMenos) zoomMenos.addEventListener("click", () => {
    const c = centroDelWrap();
    aplicarZoomCentrado(PLANO_ZOOM - 0.25, c.x, c.y);
    renderVisorPlanos();
  });
  const zoomMas = document.getElementById("planos-zoom-mas");
  if (zoomMas) zoomMas.addEventListener("click", () => {
    const c = centroDelWrap();
    aplicarZoomCentrado(PLANO_ZOOM + 0.25, c.x, c.y);
    renderVisorPlanos();
  });
  const zoomReset = document.getElementById("planos-zoom-reset");
  if (zoomReset) zoomReset.addEventListener("click", () => {
    const p = planoActivo();
    PLANO_ZOOM = p ? calcularZoomAjustado(p) : 1;
    const panR = p ? calcularPanCentrado(p, PLANO_ZOOM) : { x: 0, y: 0 };
    PLANO_PAN_X = panR.x; PLANO_PAN_Y = panR.y;
    renderVisorPlanos();
  });

  const wrap = document.getElementById("planos-canvas-wrap");
  const inner = document.getElementById("planos-canvas-inner");
  if (wrap && inner) {
    wrap.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.10 : -0.10;
      aplicarZoomCentrado(PLANO_ZOOM + delta, e.clientX, e.clientY);
      inner.style.transform = `translate(${PLANO_PAN_X}px, ${PLANO_PAN_Y}px) scale(${PLANO_ZOOM})`;
      const zoomLabel = document.getElementById("planos-zoom-reset");
      if (zoomLabel) zoomLabel.textContent = Math.round(PLANO_ZOOM * 100) + "%";
    }, { passive: false });

    wrap.addEventListener("pointerdown", (e) => {
      PLANO_PUNTEROS_ACTIVOS.set(e.pointerId, { x: e.clientX, y: e.clientY });
      // Botón central del mouse: mover el plano sin importar qué herramienta
      // esté activa (lápiz, marcador, pin, borrador) — atajo universal, igual
      // que en la mayoría de apps de diseño.
      if (e.button === 1) {
        e.preventDefault();
        PLANO_DRAG_ACTIVO = true;
        PLANO_TRAZO_EN_CURSO = null;
        PLANO_DRAG_ULTIMO_X = e.clientX; PLANO_DRAG_ULTIMO_Y = e.clientY;
        wrap.style.cursor = "grabbing";
        return;
      }
      if (PLANO_PUNTEROS_ACTIVOS.size === 2) {
        // Pasar a pellizco de 2 dedos cancela cualquier trazo/forma que
        // hubiera quedado a medio dibujar con el primer dedo — antes de este
        // fix quedaba un <rect>/<line> fantasma pegado al SVG.
        const pts = Array.from(PLANO_PUNTEROS_ACTIVOS.values());
        PLANO_PINCH_DIST_INICIAL = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        PLANO_PINCH_ZOOM_INICIAL = PLANO_ZOOM;
        PLANO_PINCH_ULTIMO_CX = (pts[0].x + pts[1].x) / 2;
        PLANO_PINCH_ULTIMO_CY = (pts[0].y + pts[1].y) / 2;
        PLANO_DRAG_ACTIVO = false;
        PLANO_TRAZO_EN_CURSO = null;
        if (PLANO_FORMA_EN_CURSO) {
          PLANO_FORMA_EN_CURSO.elemento.remove();
          PLANO_FORMA_EN_CURSO = null;
          ocultarLupa();
        }
      } else if (PLANO_MODO === "mano" && PLANO_PUNTEROS_ACTIVOS.size === 1) {
        PLANO_DRAG_ACTIVO = true;
        PLANO_DRAG_ULTIMO_X = e.clientX; PLANO_DRAG_ULTIMO_Y = e.clientY;
        wrap.style.cursor = "grabbing";
      } else if ((PLANO_MODO === "lapiz" || PLANO_MODO === "resaltador") && PLANO_PUNTEROS_ACTIVOS.size === 1) {
        iniciarTrazo(e);
      } else if ((PLANO_MODO === "rectangulo" || PLANO_MODO === "linea" || PLANO_MODO === "calibrar" || PLANO_MODO === "regla") && PLANO_PUNTEROS_ACTIVOS.size === 1) {
        iniciarForma(e, PLANO_MODO);
      } else if (PLANO_MODO === "borrador" && PLANO_PUNTEROS_ACTIVOS.size === 1) {
        borrarCercaDe(e);
      }
    });
    wrap.addEventListener("pointermove", (e) => {
      if (!PLANO_PUNTEROS_ACTIVOS.has(e.pointerId)) return;
      PLANO_PUNTEROS_ACTIVOS.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (PLANO_PUNTEROS_ACTIVOS.size === 2 && PLANO_PINCH_DIST_INICIAL) {
        const pts = Array.from(PLANO_PUNTEROS_ACTIVOS.values());
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const cx = (pts[0].x + pts[1].x) / 2, cy = (pts[0].y + pts[1].y) / 2;
        // Arrastre con 2 dedos: mueve el pan según cuánto se movió el
        // centroide del pellizco (aplicarZoomCentrado por sí sola NO hace
        // esto — solo ancla el zoom al punto dado, ver nota arriba). Esto
        // funciona en cualquier herramienta activa, no solo en modo "Mano".
        PLANO_PAN_X += (cx - PLANO_PINCH_ULTIMO_CX);
        PLANO_PAN_Y += (cy - PLANO_PINCH_ULTIMO_CY);
        aplicarZoomCentrado(PLANO_PINCH_ZOOM_INICIAL * (dist / PLANO_PINCH_DIST_INICIAL), cx, cy);
        PLANO_PINCH_ULTIMO_CX = cx; PLANO_PINCH_ULTIMO_CY = cy;
        inner.style.transform = `translate(${PLANO_PAN_X}px, ${PLANO_PAN_Y}px) scale(${PLANO_ZOOM})`;
        return;
      }
      if (PLANO_DRAG_ACTIVO) {
        const dx = e.clientX - PLANO_DRAG_ULTIMO_X;
        const dy = e.clientY - PLANO_DRAG_ULTIMO_Y;
        PLANO_PAN_X += dx; PLANO_PAN_Y += dy;
        PLANO_DRAG_ULTIMO_X = e.clientX; PLANO_DRAG_ULTIMO_Y = e.clientY;
        inner.style.transform = `translate(${PLANO_PAN_X}px, ${PLANO_PAN_Y}px) scale(${PLANO_ZOOM})`;
      }
      if (PLANO_TRAZO_EN_CURSO) {
        continuarTrazo(e);
      }
      if (PLANO_FORMA_EN_CURSO) {
        continuarForma(e);
      }
      if (PLANO_TEXTO_ARRASTRE) {
        const img = document.getElementById("planos-img");
        if (img) {
          const rect = img.getBoundingClientRect();
          const xFrac = (e.clientX - rect.left) / rect.width - PLANO_TEXTO_ARRASTRE.offXFrac;
          const yFrac = (e.clientY - rect.top) / rect.height - PLANO_TEXTO_ARRASTRE.offYFrac;
          const plano = planoActivo();
          const t = plano && (plano.textos || []).find((x) => x.id === PLANO_TEXTO_ARRASTRE.id);
          if (t) {
            const nx = Math.max(0, Math.min(1, xFrac)), ny = Math.max(0, Math.min(1, yFrac));
            if (Math.abs(nx - t.xFrac) > 0.002 || Math.abs(ny - t.yFrac) > 0.002) PLANO_TEXTO_ARRASTRE.seMovio = true;
            t.xFrac = nx;
            t.yFrac = ny;
            const textoEl = document.querySelector(`[data-planos-texto-id="${t.id}"]`);
            if (textoEl) { textoEl.setAttribute("x", t.xFrac * plano.width); textoEl.setAttribute("y", t.yFrac * plano.height); }
          }
        }
      }
      if (PLANO_MODO === "borrador" && PLANO_PUNTEROS_ACTIVOS.size === 1 && !PLANO_DRAG_ACTIVO) {
        borrarCercaDe(e);
      }
    });
    const soltarPuntero = (e) => {
      PLANO_PUNTEROS_ACTIVOS.delete(e.pointerId);
      if (PLANO_PUNTEROS_ACTIVOS.size < 2) PLANO_PINCH_DIST_INICIAL = null;
      if (PLANO_TRAZO_EN_CURSO) finalizarTrazo();
      if (PLANO_FORMA_EN_CURSO) finalizarForma(e);
      if (PLANO_TEXTO_ARRASTRE) {
        const arr = PLANO_TEXTO_ARRASTRE;
        PLANO_TEXTO_ARRASTRE = null;
        if (!arr.seMovio && arr.yaEstabaSeleccionado) {
          // Tap simple sobre un texto que ya estaba seleccionado: abrir edición.
          // El undo que se apiló en pointerdown para el posible arrastre se
          // descarta (deshacer) porque no hubo cambio real que registrar.
          PLANO_UNDO_STACK.pop();
          const plano = planoActivo();
          const t = plano && (plano.textos || []).find((x) => x.id === arr.id);
          if (t) PLANO_TEXTO_EDITANDO = { id: arr.id, xFrac: t.xFrac, yFrac: t.yFrac, textoActual: t.texto };
        } else {
          marcarCambio();
        }
        renderVisorPlanos();
      }
      if (PLANO_PUNTEROS_ACTIVOS.size === 0) {
        PLANO_DRAG_ACTIVO = false;
        wrap.style.cursor = cursorParaModo(PLANO_MODO);
        const zoomLabel = document.getElementById("planos-zoom-reset");
        if (zoomLabel) zoomLabel.textContent = Math.round(PLANO_ZOOM * 100) + "%";
      }
    };
    wrap.addEventListener("pointerup", soltarPuntero);
    wrap.addEventListener("pointercancel", soltarPuntero);
    wrap.addEventListener("pointerleave", soltarPuntero);

    // Click simple (no arrastre) en modo "punto": coloca un pin en esa posición.
    const img = document.getElementById("planos-img");
    if (img) img.addEventListener("click", (e) => {
      if (PLANO_MODO === "punto") {
        const rect = img.getBoundingClientRect();
        const xFrac = (e.clientX - rect.left) / rect.width;
        const yFrac = (e.clientY - rect.top) / rect.height;
        colocarPin(xFrac, yFrac);
        return;
      }
      if (PLANO_MODO === "texto") {
        if (PLANO_TEXTO_EDITANDO) return; // ya hay uno en edición, no crear otro encima
        PLANO_TEXTO_SELECCIONADO_ID = null;
        const rect = img.getBoundingClientRect();
        const xFrac = (e.clientX - rect.left) / rect.width;
        const yFrac = (e.clientY - rect.top) / rect.height;
        PLANO_TEXTO_EDITANDO = { id: null, xFrac, yFrac, textoActual: "" };
        renderVisorPlanos();
      }
    });
  }

  // Tocar un texto ya colocado (en modo texto): lo selecciona y prepara el
  // arrastre. Si al soltar no hubo movimiento real Y el texto YA estaba
  // seleccionado desde antes de este toque, se interpreta como "tap para
  // editar" (mismo patrón que apps de diseño: 1er toque selecciona, 2do
  // toque sobre lo ya seleccionado edita). No se usa dblclick del navegador
  // porque el pointerdown ya dispara un re-render que reemplaza el nodo DOM,
  // y el navegador nunca vería el segundo click como parte del mismo elemento.
  document.querySelectorAll("[data-planos-texto-id]").forEach(el => {
    el.addEventListener("pointerdown", (e) => {
      if (PLANO_MODO !== "texto" || PLANO_TEXTO_EDITANDO) return;
      e.stopPropagation();
      const id = Number(el.getAttribute("data-planos-texto-id"));
      const plano = planoActivo();
      const t = plano && (plano.textos || []).find((x) => x.id === id);
      if (!t) return;
      const yaEstabaSeleccionado = PLANO_TEXTO_SELECCIONADO_ID === id;
      PLANO_TEXTO_SELECCIONADO_ID = id;
      PLANO_UNDO_STACK.push(snapshotPlano(plano));
      if (PLANO_UNDO_STACK.length > 25) PLANO_UNDO_STACK.shift();
      PLANO_REDO_STACK = [];
      PLANO_PUNTEROS_ACTIVOS.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const rectImg = document.getElementById("planos-img").getBoundingClientRect();
      const xFracToque = (e.clientX - rectImg.left) / rectImg.width;
      const yFracToque = (e.clientY - rectImg.top) / rectImg.height;
      PLANO_TEXTO_ARRASTRE = { id, offXFrac: xFracToque - t.xFrac, offYFrac: yFracToque - t.yFrac, seMovio: false, yaEstabaSeleccionado };
      renderVisorPlanos();
    });
  });

  // Tocar un pin ya colocado ofrece quitarlo (no importa el modo activo —
  // siempre se puede borrar un pin tocándolo directo).
  document.querySelectorAll("[data-planos-pin-id]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const pin = pinBtnAPin(btn);
      if (!pin) return;
      if (confirm("¿Quitar este pin del plano?")) {
        quitarPin(pin.id);
      }
    });
  });
}

function pinBtnAPin(btn) {
  const plano = planoActivo();
  if (!plano) return null;
  const id = parseInt(btn.dataset.planosPinId, 10);
  return plano.pines.find(p => p.id === id) || null;
}

// Abre el visor ya centrado en el pin vinculado a una fila específica —
// usado desde el ícono de pin en la tabla Detallado de Levantamiento (mismo
// patrón que el ícono de fotos).
function abrirVisorPlanosEnPin(filaId, filaTipo) {
  let encontrado = null;
  for (const plano of PLANOS) {
    const pin = (plano.pines || []).find(p => p.filaId === filaId && p.filaTipo === filaTipo);
    if (pin) { encontrado = { plano, pin }; break; }
  }
  if (!encontrado) return;

  PLANO_PIN_CONTEXTO = null;
  PLANO_MODO = "mano";
  PLANO_VISTA = "visor";
  PLANO_ACTIVO_ID = encontrado.plano.id;
  PLANO_ZOOM = Math.min(Math.max(calcularZoomAjustado(encontrado.plano), 1.2), PLANO_ZOOM_MAX);

  let overlay = document.getElementById("planos-visor-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "planos-visor-overlay";
    overlay.className = "planos-visor-overlay";
    document.body.appendChild(overlay);
  }
  document.body.classList.add("modal-open");
  renderVisorPlanos();

  // Centrar el pan en el pin — se hace después de renderizar (necesita medir
  // el tamaño real del contenedor ya en el DOM).
  requestAnimationFrame(() => {
    const wrap = document.getElementById("planos-canvas-wrap");
    const inner = document.getElementById("planos-canvas-inner");
    if (!wrap || !inner) return;
    const rect = wrap.getBoundingClientRect();
    const contentX = encontrado.pin.xFrac * encontrado.plano.width;
    const contentY = encontrado.pin.yFrac * encontrado.plano.height;
    PLANO_PAN_X = rect.width / 2 - contentX * PLANO_ZOOM;
    PLANO_PAN_Y = rect.height / 2 - contentY * PLANO_ZOOM;
    inner.style.transform = `translate(${PLANO_PAN_X}px, ${PLANO_PAN_Y}px) scale(${PLANO_ZOOM})`;
  });
}

function quitarPin(pinId) {
  const plano = planoActivo();
  if (!plano) return;
  planoPushUndo(plano);
  plano.pines = plano.pines.filter(p => p.id !== pinId);
  marcarCambio();
  renderVisorPlanos();
}

// Exporta todos los planos guardados como un único PDF, una hoja por página
// (imagen del plano ya rasterizado a 150dpi con sus marcas/pines dibujados
// encima). Ojo: como el plano internamente ya es raster (no vectorial), este
// PDF de salida es esa imagen metida en un contenedor PDF — no recupera la
// nitidez del PDF original que se subió.
// Calcula un tamaño de página que coincide con la proporción del plano (en
// vez del Letter fijo de antes, que dejaba mucho espacio en blanco cuando el
// plano no era proporción carta) — lado largo fijo en ~792pt (equivalente al
// lado largo de una carta) para que la impresión quede en un tamaño razonable.
// jsPDF IGNORA el orden width/height del array "format" y reordena según
// "orientation" (siempre pone el lado más largo como ancho en landscape, o
// como alto en portrait) — así que hay que pasar orientation explícito o
// termina siempre en portrait sin importar el array que le mandes.
function formatoPaginaParaPlano(plano) {
  const targetLargo = 792;
  const margin = 20, tituloH = 20;
  const aspect = plano.width / plano.height;
  let contentW, contentH;
  if (aspect >= 1) {
    contentW = targetLargo - margin * 2;
    contentH = contentW / aspect;
  } else {
    contentH = targetLargo - margin * 2 - tituloH;
    contentW = contentH * aspect;
  }
  const pageW = contentW + margin * 2;
  const pageH = contentH + margin * 2 + tituloH;
  return { format: [pageW, pageH], orientation: pageW >= pageH ? "l" : "p" };
}

async function exportarPlanosPDF() {
  if (!PLANOS.length) {
    mostrarToast("No hay planos subidos todavía.", "error");
    return;
  }
  const { jsPDF } = window.jspdf;
  let doc = null;
  for (let i = 0; i < PLANOS.length; i++) {
    const plano = PLANOS[i];
    const { format, orientation } = formatoPaginaParaPlano(plano);
    if (i === 0) {
      doc = new jsPDF({ unit: "pt", format, orientation });
    } else {
      doc.addPage(format, orientation);
    }
    await dibujarPlanoEnPaginaPdf(doc, plano);
  }
  const nombre = (PROJECT_INFO.nombre || "proyecto").replace(/[^a-z0-9\-_ ]/gi, "").trim().replace(/\s+/g, "-") || "proyecto";
  await window.compartirODescargarPDF(doc, `${nombre}-planos.pdf`, {
    titulo: `Planos — ${PROJECT_INFO.nombre || "proyecto"}`,
    texto: `Planos de sello cortafuego para ${PROJECT_INFO.nombre || "el proyecto"}.`,
  });
}

// Dibuja un plano (título + imagen con marcas) en la página actual de un
// documento jsPDF ya creado — factorizado para reutilizarlo tanto en
// "Exportar todos" (exportarPlanosPDF) como en "Compartir" (un solo plano).
async function dibujarPlanoEnPaginaPdf(doc, plano) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 20;
  const maxW = pageW - margin * 2;
  const maxH = pageH - margin * 2 - 20; // deja espacio para el título
  const escala = Math.min(maxW / plano.width, maxH / plano.height);
  const w = plano.width * escala;
  const h = plano.height * escala;
  const x = (pageW - w) / 2;
  const y = margin + 20;
  doc.setFontSize(11);
  doc.text(plano.nombre, margin, margin + 10);
  const imgConMarcas = await dibujarPlanoConMarcasCanvas(plano);
  doc.addImage(imgConMarcas, "JPEG", x, y, w, h);
}

// Comparte (o descarga, si el navegador no soporta compartir archivos) un PDF
// de una página con el plano activo y todas sus marcas — mismo patrón que
// compartirTablaMaterialesImagen() en compartir-tabla-imagen.js, pero en PDF
// en vez de JPG (Kevin lo pidió así para que se comparta como documento).
async function compartirPlanoActual() {
  const plano = planoActivo();
  if (!plano) return;
  let blob;
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", ...formatoPaginaParaPlano(plano) });
    await dibujarPlanoEnPaginaPdf(doc, plano);
    blob = doc.output("blob");
  } catch (e) {
    mostrarToast("No se pudo generar el PDF del plano.", "error");
    return;
  }
  const nombreArchivo = (plano.nombre || "plano").replace(/[^a-z0-9\-_ ]/gi, "").trim().replace(/\s+/g, "-") || "plano";
  const archivo = `${nombreArchivo}.pdf`;
  const file = new File([blob], archivo, { type: "application/pdf" });

  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: plano.nombre, text: `Plano: ${plano.nombre}` });
      mostrarToast("Plano compartido.");
      return;
    }
  } catch (err) {
    if (err && err.name === "AbortError") return;
    // si falla, seguimos con la descarga de respaldo
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = archivo;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  mostrarToast("Este navegador no permite compartir directo — se descargó el PDF.");
}

// Dibuja el plano + sus trazos/pines en un canvas temporal (para que el PDF
// exportado los incluya, no solo la imagen pelada) y devuelve el dataURL.
function dibujarPlanoConMarcasCanvas(plano) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error("No se pudo cargar la imagen del plano."));
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = plano.width;
      canvas.height = plano.height;
      const ctx = canvas.getContext("2d");
      // Fondo blanco opaco antes de dibujar: el plano rasterizado puede tener
      // zonas transparentes, y JPEG (a diferencia de WebP) no soporta canal
      // alfa — sin esto, esas zonas saldrían negras en el PDF final.
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      (plano.rectangulos || []).forEach(r => {
        const x = r.xFrac * plano.width, y = r.yFrac * plano.height;
        const w = r.wFrac * plano.width, h = r.hFrac * plano.height;
        if (r.relleno) {
          ctx.globalAlpha = r.opacidadRelleno;
          ctx.fillStyle = r.color;
          ctx.fillRect(x, y, w, h);
          ctx.globalAlpha = 1;
        }
        ctx.strokeStyle = r.color;
        ctx.lineWidth = Math.max(plano.width, plano.height) * 0.004 * (r.grosor || 1);
        ctx.strokeRect(x, y, w, h);
      });
      (plano.lineas || []).forEach(l => {
        ctx.strokeStyle = l.color;
        ctx.lineWidth = Math.max(plano.width, plano.height) * 0.005 * (l.grosor || 1);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(l.x1Frac * plano.width, l.y1Frac * plano.height);
        ctx.lineTo(l.x2Frac * plano.width, l.y2Frac * plano.height);
        ctx.stroke();
      });
      (plano.trazos || []).forEach(t => {
        const estilo = TRAZO_ESTILOS[t.tipo] || TRAZO_ESTILOS.lapiz;
        ctx.strokeStyle = t.color;
        ctx.globalAlpha = t.opacidad != null ? t.opacidad : estilo.opacidad;
        ctx.lineWidth = Math.max(plano.width, plano.height) * estilo.grosorFactor * (t.grosor || 1);
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.beginPath();
        t.puntos.forEach((p, i) => {
          const px = p.xFrac * plano.width, py = p.yFrac * plano.height;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
      (plano.cotas || []).forEach(c => {
        const maxDim = Math.max(plano.width, plano.height);
        const grosor = maxDim * 0.004 * 0.15;
        const x1 = c.x1Frac * plano.width, y1 = c.y1Frac * plano.height;
        const x2 = c.x2Frac * plano.width, y2 = c.y2Frac * plano.height;
        const dx = x2 - x1, dy = y2 - y1;
        const largo = Math.hypot(dx, dy) || 1;
        const px2 = -dy / largo, py2 = dx / largo;
        const marca = maxDim * 0.005;
        ctx.strokeStyle = c.color || "#111111";
        ctx.lineWidth = grosor;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x1 - px2 * marca / 2, y1 - py2 * marca / 2); ctx.lineTo(x1 + px2 * marca / 2, y1 + py2 * marca / 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x2 - px2 * marca / 2, y2 - py2 * marca / 2); ctx.lineTo(x2 + px2 * marca / 2, y2 + py2 * marca / 2); ctx.stroke();
        const midX = (x1 + x2) / 2, midY = (y1 + y2) / 2;
        const fontSize = maxDim * 0.0055;
        ctx.font = `600 ${fontSize}px sans-serif`;
        const texto = textoCota(plano, c);
        const anchoTexto = ctx.measureText(texto).width + fontSize * 0.6;
        ctx.save();
        ctx.translate(midX, midY);
        let angulo = Math.atan2(dy, dx);
        if (angulo > Math.PI / 2 || angulo < -Math.PI / 2) angulo += Math.PI;
        ctx.rotate(angulo);
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fillRect(-anchoTexto / 2, -fontSize * 0.85, anchoTexto, fontSize * 1.35);
        ctx.fillStyle = c.color || "#111111";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(texto, 0, 0);
        ctx.restore();
      });
      (plano.textos || []).forEach(t => {
        const tamanoPx = Math.max(plano.width, plano.height) * (t.tamano || PLANO_TAMANO_TEXTO);
        const x = t.xFrac * plano.width, y = t.yFrac * plano.height;
        ctx.font = `700 ${tamanoPx}px Arial, sans-serif`;
        ctx.textBaseline = "middle";
        ctx.lineJoin = "round"; ctx.miterLimit = 2;
        ctx.strokeStyle = "rgba(0,0,0,0.65)";
        ctx.lineWidth = Math.max(2, tamanoPx * 0.1);
        ctx.strokeText(t.texto, x, y);
        ctx.fillStyle = t.color;
        ctx.fillText(t.texto, x, y);
      });
      // Pin con forma de "gota" (círculo + cola apuntando al punto exacto),
      // replicando el pin de la app en vez del círculo genérico de antes —
      // y bastante más chico (antes quedaba desproporcionado en el PDF).
      (plano.pines || []).forEach((pin, i) => {
        const tipX = pin.xFrac * plano.width, tipY = pin.yFrac * plano.height;
        const r = Math.max(plano.width, plano.height) * 0.0035;
        const cabezaY = tipY - r * 1.7;
        ctx.fillStyle = pin.color || "#e2001a";
        ctx.beginPath();
        ctx.moveTo(tipX - r * 0.55, cabezaY + r * 0.7);
        ctx.lineTo(tipX + r * 0.55, cabezaY + r * 0.7);
        ctx.lineTo(tipX, tipY);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath(); ctx.arc(tipX, cabezaY, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = r * 0.16;
        ctx.beginPath(); ctx.arc(tipX, cabezaY, r, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "white";
        ctx.font = `700 ${r}px sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(String(i + 1), tipX, cabezaY);
      });
      canvasADataUrlAsync(canvas, "image/jpeg", 0.85).then(resolve).catch(reject);
    };
    img.src = plano.dataUrl;
  });
}


// --- Marcador (dibujo libre) — se dibuja en vivo sobre un <polyline> propio,
// manipulando el SVG directamente (sin re-render completo por cada punto, que
// sería lento); recién al soltar se guarda el trazo completo en plano.trazos.
let PLANO_TRAZO_EN_CURSO = null; // { puntos: [{xFrac,yFrac}], elemento: <polyline> }

function fraccionDesdeEvento(e) {
  const img = document.getElementById("planos-img");
  if (!img) return null;
  const rect = img.getBoundingClientRect();
  return { xFrac: (e.clientX - rect.left) / rect.width, yFrac: (e.clientY - rect.top) / rect.height };
}

// --- Lupa de precisión para Calibrar/Regla — muestra un círculo con el plano
// ampliado 3x y una mira "+" en el centro, para tocar el punto exacto sin que
// el dedo lo tape. Se sigue del dedo mientras se arrastra el punto B.
const PLANO_LUPA_ZOOM = 3;
const PLANO_LUPA_PX = 130;
function actualizarLupa(clientX, clientY, plano, frac) {
  const img = document.getElementById("planos-img");
  if (!img || !plano || !frac) return;
  let lupa = document.getElementById("planos-lupa");
  if (!lupa) {
    lupa = document.createElement("div");
    lupa.id = "planos-lupa";
    lupa.className = "planos-lupa";
    lupa.innerHTML = `<canvas id="planos-lupa-canvas" width="${PLANO_LUPA_PX}" height="${PLANO_LUPA_PX}"></canvas><div class="planos-lupa-cruz"></div>`;
    document.body.appendChild(lupa);
  }
  // Se posiciona arriba y centrada respecto al dedo/cursor, para no taparlo.
  lupa.style.left = (clientX - PLANO_LUPA_PX / 2) + "px";
  lupa.style.top = (clientY - PLANO_LUPA_PX - 34) + "px";
  const canvas = document.getElementById("planos-lupa-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, PLANO_LUPA_PX, PLANO_LUPA_PX);
  ctx.save();
  ctx.beginPath();
  ctx.arc(PLANO_LUPA_PX / 2, PLANO_LUPA_PX / 2, PLANO_LUPA_PX / 2, 0, Math.PI * 2);
  ctx.clip();
  const srcSize = PLANO_LUPA_PX / PLANO_LUPA_ZOOM;
  const sx = frac.xFrac * plano.width - srcSize / 2;
  const sy = frac.yFrac * plano.height - srcSize / 2;
  try {
    ctx.drawImage(img, sx, sy, srcSize, srcSize, 0, 0, PLANO_LUPA_PX, PLANO_LUPA_PX);
  } catch (err) { /* fuera de rango en el borde del plano — no pasa nada, queda en blanco */ }
  ctx.restore();
}
function ocultarLupa() {
  const lupa = document.getElementById("planos-lupa");
  if (lupa) lupa.remove();
}

// --- Rectángulo / Línea / Calibrar / Regla — todas usan el mismo gesto de
// arrastre (tocar en el punto A, arrastrar hasta el punto B, soltar), con
// una vista previa en vivo mientras se arrastra.
let PLANO_FORMA_EN_CURSO = null;

function iniciarForma(e, tipo) {
  const frac = fraccionDesdeEvento(e);
  const plano = planoActivo();
  const svg = document.getElementById("planos-svg-overlay");
  if (!frac || !plano || !svg) return;
  let el;
  if (tipo === "rectangulo") {
    el = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    el.setAttribute("stroke", PLANO_COLOR_MARCADOR);
    el.setAttribute("stroke-width", String(Math.max(plano.width, plano.height) * 0.004 * PLANO_GROSOR));
    el.setAttribute("fill", PLANO_RECT_RELLENO ? PLANO_COLOR_MARCADOR : "none");
    if (PLANO_RECT_RELLENO) el.setAttribute("fill-opacity", String(PLANO_RECT_OPACIDAD));
  } else {
    // "linea" respeta el grosor elegido (igual que se guarda al final —
    // antes la previsualización quedaba siempre gruesa sin importar el
    // grosor seleccionado). "calibrar"/"regla" siempre finas, ver grosorLineaFina().
    el = document.createElementNS("http://www.w3.org/2000/svg", "line");
    el.setAttribute("stroke", tipo === "calibrar" ? "#5856D6" : tipo === "regla" ? "#34C759" : PLANO_COLOR_MARCADOR);
    const anchoLinea = tipo === "linea"
      ? Math.max(plano.width, plano.height) * 0.005 * PLANO_GROSOR
      : grosorLineaFina(plano);
    el.setAttribute("stroke-width", String(anchoLinea));
    el.setAttribute("stroke-linecap", "round");
    if (tipo === "calibrar" || tipo === "regla") el.setAttribute("stroke-dasharray", String(anchoLinea * 2.5) + "," + String(anchoLinea * 1.6));
  }
  svg.appendChild(el);
  PLANO_FORMA_EN_CURSO = { tipo, inicio: frac, elemento: el, plano };
  actualizarForma(frac);
  if (tipo === "calibrar" || tipo === "regla") actualizarLupa(e.clientX, e.clientY, plano, frac);
}

function actualizarForma(fracActual) {
  if (!PLANO_FORMA_EN_CURSO) return;
  const { tipo, inicio, elemento, plano } = PLANO_FORMA_EN_CURSO;
  if (tipo === "rectangulo") {
    const x0 = Math.min(inicio.xFrac, fracActual.xFrac) * plano.width;
    const y0 = Math.min(inicio.yFrac, fracActual.yFrac) * plano.height;
    const w = Math.abs(fracActual.xFrac - inicio.xFrac) * plano.width;
    const h = Math.abs(fracActual.yFrac - inicio.yFrac) * plano.height;
    elemento.setAttribute("x", x0); elemento.setAttribute("y", y0);
    elemento.setAttribute("width", w); elemento.setAttribute("height", h);
  } else {
    elemento.setAttribute("x1", inicio.xFrac * plano.width);
    elemento.setAttribute("y1", inicio.yFrac * plano.height);
    elemento.setAttribute("x2", fracActual.xFrac * plano.width);
    elemento.setAttribute("y2", fracActual.yFrac * plano.height);
  }
}

function continuarForma(e) {
  const frac = fraccionDesdeEvento(e);
  if (!frac || !PLANO_FORMA_EN_CURSO) return;
  actualizarForma(frac);
  if (PLANO_FORMA_EN_CURSO.tipo === "calibrar" || PLANO_FORMA_EN_CURSO.tipo === "regla") {
    actualizarLupa(e.clientX, e.clientY, PLANO_FORMA_EN_CURSO.plano, frac);
  }
}

function finalizarForma(e) {
  if (!PLANO_FORMA_EN_CURSO) return;
  const { tipo, inicio, elemento, plano } = PLANO_FORMA_EN_CURSO;
  const fin = fraccionDesdeEvento(e) || inicio;
  elemento.remove();
  ocultarLupa();
  const distFrac = Math.hypot(fin.xFrac - inicio.xFrac, fin.yFrac - inicio.yFrac);
  PLANO_FORMA_EN_CURSO = null;
  if (distFrac < 0.006) { renderVisorPlanos(); return; } // gesto muy chico, probable toque accidental

  if (tipo === "rectangulo") {
    planoPushUndo(plano);
    plano.rectangulos.push({
      id: Date.now(),
      xFrac: Math.min(inicio.xFrac, fin.xFrac), yFrac: Math.min(inicio.yFrac, fin.yFrac),
      wFrac: Math.abs(fin.xFrac - inicio.xFrac), hFrac: Math.abs(fin.yFrac - inicio.yFrac),
      color: PLANO_COLOR_MARCADOR, grosor: PLANO_GROSOR,
      relleno: PLANO_RECT_RELLENO, opacidadRelleno: PLANO_RECT_OPACIDAD,
    });
    marcarCambio();
    renderVisorPlanos();
  } else if (tipo === "linea") {
    planoPushUndo(plano);
    plano.lineas.push({
      id: Date.now(),
      x1Frac: inicio.xFrac, y1Frac: inicio.yFrac, x2Frac: fin.xFrac, y2Frac: fin.yFrac,
      color: PLANO_COLOR_MARCADOR, grosor: PLANO_GROSOR,
    });
    marcarCambio();
    renderVisorPlanos();
  } else if (tipo === "calibrar") {
    procesarCalibracion(plano, inicio, fin);
  } else if (tipo === "regla") {
    procesarMedicion(plano, inicio, fin);
  }
}

function distanciaPx(plano, a, b) {
  const dx = (b.xFrac - a.xFrac) * plano.width;
  const dy = (b.yFrac - a.yFrac) * plano.height;
  return Math.hypot(dx, dy);
}

// Acepta "3.5m", "3,5 m", "250cm", "250" (asume metros si no se indica unidad).
function parsearDistancia(texto) {
  const t = texto.trim().toLowerCase().replace(",", ".");
  const m = t.match(/^([\d.]+)\s*(m|cm)?$/);
  if (!m) return null;
  const valor = parseFloat(m[1]);
  if (isNaN(valor) || valor <= 0) return null;
  const unidad = m[2] || "m";
  const cm = unidad === "cm" ? valor : valor * 100;
  return { cm, original: texto.trim() + (m[2] ? "" : " m") };
}

function procesarCalibracion(plano, a, b) {
  // Recalibrar un plano ya calibrado recalcula automáticamente todas las
  // cotas existentes (ver textoCota() — leen plano.escala en vivo, no un
  // texto congelado), así que conviene confirmar antes de pisar la escala.
  if (plano.escala && !confirm("Este plano ya tiene una escala calibrada. ¿Querés reemplazarla? Las cotas que ya mediste se van a recalcular con la nueva escala.")) {
    renderVisorPlanos();
    return;
  }
  const px = distanciaPx(plano, a, b);
  const respuesta = prompt("Distancia real entre esos 2 puntos (ej: 3.5m o 250cm):", "");
  if (!respuesta) { renderVisorPlanos(); return; }
  const parsed = parsearDistancia(respuesta);
  if (!parsed) {
    mostrarToast("No se entendió la distancia. Usá algo como 3.5m o 250cm.", "error");
    renderVisorPlanos();
    return;
  }
  planoPushUndo(plano);
  plano.escala = { pxPorCm: px / parsed.cm };
  marcarCambio();
  mostrarToast(`Escala calibrada: ${parsed.original}`);
  renderVisorPlanos();
}

// Texto de una cota calculado EN VIVO a partir de sus coordenadas y la
// escala actual del plano — a propósito no se guarda como texto fijo, así
// que si el plano se vuelve a calibrar todas las cotas ya dibujadas
// muestran la distancia recalculada automáticamente (item 5 pedido por Kevin).
function textoCota(plano, c) {
  if (!plano.escala) return "?";
  const px = distanciaPx(plano, { xFrac: c.x1Frac, yFrac: c.y1Frac }, { xFrac: c.x2Frac, yFrac: c.y2Frac });
  const cm = px / plano.escala.pxPorCm;
  return cm >= 100 ? `${(cm / 100).toFixed(2)} m` : `${cm.toFixed(0)} cm`;
}

// Medir deja una "cota" persistente sobre el plano (línea + marcas de
// extremo + texto de la distancia), no solo un toast que desaparece —
// así queda documentada la medición como en un plano real.
function procesarMedicion(plano, a, b) {
  if (!plano.escala) {
    mostrarToast("Este plano todavía no tiene escala calibrada — usá \"Calibrar\" primero.", "error");
    renderVisorPlanos();
    return;
  }
  planoPushUndo(plano);
  plano.cotas = plano.cotas || [];
  const cota = { id: Date.now(), x1Frac: a.xFrac, y1Frac: a.yFrac, x2Frac: b.xFrac, y2Frac: b.yFrac, color: PLANO_COLOR_MARCADOR };
  plano.cotas.push(cota);
  marcarCambio();
  mostrarToast(`Distancia: ${textoCota(plano, cota)}`);
  renderVisorPlanos();
}

function iniciarTrazo(e) {
  const frac = fraccionDesdeEvento(e);
  const plano = planoActivo();
  const svg = document.getElementById("planos-svg-overlay");
  if (!frac || !plano || !svg) return;
  const tipo = PLANO_MODO === "resaltador" ? "resaltador" : "lapiz";
  const estilo = TRAZO_ESTILOS[tipo];
  const el = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  el.setAttribute("fill", "none");
  el.setAttribute("stroke", PLANO_COLOR_MARCADOR);
  el.setAttribute("stroke-opacity", String(tipo === "resaltador" ? PLANO_RESALTADOR_OPACIDAD : estilo.opacidad));
  el.setAttribute("stroke-width", String(Math.max(plano.width, plano.height) * estilo.grosorFactor * PLANO_GROSOR));
  el.setAttribute("stroke-linecap", "round");
  el.setAttribute("stroke-linejoin", "round");
  svg.appendChild(el);
  PLANO_TRAZO_EN_CURSO = { puntos: [frac], elemento: el, plano, tipo, grosor: PLANO_GROSOR };
  actualizarPuntosSvg();
}
function continuarTrazo(e) {
  const frac = fraccionDesdeEvento(e);
  if (!frac || !PLANO_TRAZO_EN_CURSO) return;
  PLANO_TRAZO_EN_CURSO.puntos.push(frac);
  actualizarPuntosSvg();
}
function actualizarPuntosSvg() {
  const { puntos, elemento, plano } = PLANO_TRAZO_EN_CURSO;
  const attr = puntos.map(p => `${p.xFrac * plano.width},${p.yFrac * plano.height}`).join(" ");
  elemento.setAttribute("points", attr);
}
function finalizarTrazo() {
  if (!PLANO_TRAZO_EN_CURSO) return;
  const { puntos, plano, tipo, grosor } = PLANO_TRAZO_EN_CURSO;
  if (puntos.length > 1) {
    planoPushUndo(plano);
    const nuevoTrazo = { color: PLANO_COLOR_MARCADOR, tipo, grosor, puntos };
    // La transparencia del marcador queda fija en el trazo al crearlo (no
    // "vive" como la de las cotas) — si después cambiás la opacidad en el
    // riel, los trazos ya dibujados no se mueven, solo los nuevos.
    if (tipo === "resaltador") nuevoTrazo.opacidad = PLANO_RESALTADOR_OPACIDAD;
    plano.trazos.push(nuevoTrazo);
    marcarCambio();
  }
  PLANO_TRAZO_EN_CURSO = null;
}

// --- Deshacer/rehacer local del plano (pines + trazos de la hoja activa) —
// pila aparte del "deshacer" general de la app, para no mezclar acciones de
// dibujo con acciones de filas/tabla.
let PLANO_UNDO_STACK = [];
let PLANO_REDO_STACK = [];

function snapshotPlano(plano) {
  return {
    planoId: plano.id,
    pines: JSON.parse(JSON.stringify(plano.pines)),
    trazos: JSON.parse(JSON.stringify(plano.trazos)),
    rectangulos: JSON.parse(JSON.stringify(plano.rectangulos || [])),
    lineas: JSON.parse(JSON.stringify(plano.lineas || [])),
    cotas: JSON.parse(JSON.stringify(plano.cotas || [])),
    textos: JSON.parse(JSON.stringify(plano.textos || [])),
  };
}

function planoPushUndo(plano) {
  PLANO_UNDO_STACK.push(snapshotPlano(plano));
  if (PLANO_UNDO_STACK.length > 25) PLANO_UNDO_STACK.shift();
  // Cualquier acción nueva invalida el historial de "rehacer" — igual que en
  // cualquier editor (Word, Photoshop, etc.): no tiene sentido rehacer algo
  // viejo si mientras tanto ya dibujaste otra cosa distinta.
  PLANO_REDO_STACK = [];
}

// Aplica un snapshot restaurado — en modo capa escribe en planoRef;
// en modo normal escribe en el plano real.
function aplicarSnapshotPlano(snap) {
  if (PLANO_CAPA_INFORME) {
    const ref = PLANO_CAPA_INFORME.planoRef;
    ref.pines = snap.pines;
    ref.trazos = snap.trazos;
    ref.rectangulos = snap.rectangulos || [];
    ref.lineas = snap.lineas || [];
    ref.cotas = snap.cotas || [];
    ref.textos = snap.textos || [];
    marcarCambio();
    return true;
  }
  const plano = PLANOS.find(p => p.id === snap.planoId);
  if (!plano) return false;
  plano.pines = snap.pines;
  plano.trazos = snap.trazos;
  plano.rectangulos = snap.rectangulos || [];
  plano.lineas = snap.lineas || [];
  plano.cotas = snap.cotas || [];
  plano.textos = snap.textos || [];
  marcarCambio();
  return true;
}

function planoDeshacer() {
  const snap = PLANO_UNDO_STACK.pop();
  if (!snap) { mostrarToast("No hay nada para deshacer en el plano."); return; }
  const actual = planoActivo();
  if (actual) {
    PLANO_REDO_STACK.push(snapshotPlano(actual)); // estado actual, antes de deshacer, para poder rehacer
    if (PLANO_REDO_STACK.length > 25) PLANO_REDO_STACK.shift();
  }
  aplicarSnapshotPlano(snap);
  renderVisorPlanos();
}

function planoRehacer() {
  const snap = PLANO_REDO_STACK.pop();
  if (!snap) { mostrarToast("No hay nada para rehacer en el plano."); return; }
  const actual = planoActivo();
  if (actual) {
    PLANO_UNDO_STACK.push(snapshotPlano(actual)); // estado actual, antes de rehacer, para poder volver a deshacer
    if (PLANO_UNDO_STACK.length > 25) PLANO_UNDO_STACK.shift();
  }
  aplicarSnapshotPlano(snap);
  renderVisorPlanos();
}

// Modo "Borrador": tocar/arrastrar cerca de un trazo lo borra (el trazo
// entero, no un pedacito — más simple y predecible que borrar por tramos).
function distanciaPuntoASegmento(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const largo2 = dx * dx + dy * dy;
  let t = largo2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / largo2;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx, cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

// Borrador: busca el elemento más cercano al toque entre trazos, líneas y
// rectángulos (bordes), y borra ese — sea cual sea el tipo.
function borrarCercaDe(e) {
  const plano = planoActivo();
  const frac = fraccionDesdeEvento(e);
  if (!plano || !frac) return;
  const px = frac.xFrac * plano.width, py = frac.yFrac * plano.height;
  const umbral = Math.max(plano.width, plano.height) * 0.015;
  let mejor = null; // { tipo, idx, dist }

  (plano.trazos || []).forEach((t, i) => {
    t.puntos.forEach(p => {
      const d = Math.hypot(p.xFrac * plano.width - px, p.yFrac * plano.height - py);
      if (!mejor || d < mejor.dist) mejor = { tipo: "trazos", idx: i, dist: d };
    });
  });
  (plano.lineas || []).forEach((l, i) => {
    const d = distanciaPuntoASegmento(px, py, l.x1Frac * plano.width, l.y1Frac * plano.height, l.x2Frac * plano.width, l.y2Frac * plano.height);
    if (!mejor || d < mejor.dist) mejor = { tipo: "lineas", idx: i, dist: d };
  });
  (plano.rectangulos || []).forEach((r, i) => {
    const x0 = r.xFrac * plano.width, y0 = r.yFrac * plano.height;
    const x1 = x0 + r.wFrac * plano.width, y1 = y0 + r.hFrac * plano.height;
    const bordes = [
      distanciaPuntoASegmento(px, py, x0, y0, x1, y0),
      distanciaPuntoASegmento(px, py, x1, y0, x1, y1),
      distanciaPuntoASegmento(px, py, x1, y1, x0, y1),
      distanciaPuntoASegmento(px, py, x0, y1, x0, y0),
    ];
    const d = Math.min(...bordes);
    if (!mejor || d < mejor.dist) mejor = { tipo: "rectangulos", idx: i, dist: d };
  });
  (plano.cotas || []).forEach((c, i) => {
    const d = distanciaPuntoASegmento(px, py, c.x1Frac * plano.width, c.y1Frac * plano.height, c.x2Frac * plano.width, c.y2Frac * plano.height);
    if (!mejor || d < mejor.dist) mejor = { tipo: "cotas", idx: i, dist: d };
  });

  if (mejor && mejor.dist <= umbral) {
    planoPushUndo(plano);
    plano[mejor.tipo].splice(mejor.idx, 1);
    marcarCambio();
    renderVisorPlanos();
  }
}

function colocarPin(xFrac, yFrac) {
  const plano = planoActivo();
  if (!plano) return;

  // Modo borrador: la fila todavía no existe (se está agregando). No se
  // guarda el pin todavía — se le pasa la ubicación a quien abrió el visor
  // para que la guarde como pendiente y la vincule recién al guardar la fila.
  if (PLANO_PIN_CONTEXTO && PLANO_PIN_CONTEXTO.borrador) {
    if (typeof PLANO_PIN_CONTEXTO.onColocar === "function") {
      PLANO_PIN_CONTEXTO.onColocar({ planoId: plano.id, planoNombre: plano.nombre, xFrac, yFrac });
    }
    mostrarToast("Ubicación guardada — se vincula al guardar la fila.");
    cerrarVisorPlanos();
    return;
  }

  const pin = {
    id: Date.now(),
    xFrac, yFrac,
    filaId: PLANO_PIN_CONTEXTO ? PLANO_PIN_CONTEXTO.filaId : null,
    filaTipo: PLANO_PIN_CONTEXTO ? PLANO_PIN_CONTEXTO.filaTipo : null,
    nota: "",
    color: PLANO_COLOR_PIN,
  };
  // Si esta fila ya tenía un pin vinculado en algún plano (modo "Modificar" —
  // reubicar), se quita el viejo antes de poner el nuevo, para no dejar dos
  // pines apuntando a la misma fila.
  if (pin.filaId != null) {
    for (const p of PLANOS) {
      p.pines = (p.pines || []).filter(existente => !(existente.filaId === pin.filaId && existente.filaTipo === pin.filaTipo));
    }
  }
  planoPushUndo(plano);
  plano.pines.push(pin);
  marcarCambio();
  if (PLANO_PIN_CONTEXTO) {
    mostrarToast("Pin vinculado a la fila.");
    cerrarVisorPlanos();
  } else {
    renderVisorPlanos();
  }
}

// Crea de verdad un pin ya vinculado a una fila real (se usa al confirmar un
// pin "pendiente" en el momento en que la fila se guarda y recibe su _id).
function confirmarPinPendiente(pendiente, filaId, filaTipo) {
  const plano = PLANOS.find(p => p.id === pendiente.planoId);
  if (!plano) return;
  plano.pines.push({ id: Date.now(), xFrac: pendiente.xFrac, yFrac: pendiente.yFrac, filaId, filaTipo, nota: "" });
  marcarCambio();
}

// --- Exports usados por otros módulos ---
window.abrirVisorPlanos = abrirVisorPlanos;
window.subirVariosPlanos = subirVariosPlanos;
window.subirVariosPlanosBasico = subirVariosPlanosBasico;
window.abrirVisorPlanosConCapaInforme = abrirVisorPlanosConCapaInforme;
window.abrirVisorPlanosEnPin = abrirVisorPlanosEnPin;
window.exportarPlanosPDF = exportarPlanosPDF;
window.confirmarPinPendiente = confirmarPinPendiente;
window.dibujarPlanoConMarcasCanvas = dibujarPlanoConMarcasCanvas;
})();
