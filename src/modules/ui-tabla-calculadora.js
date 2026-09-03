// ============================================================================
// ui-tabla-calculadora.js — encapsulado en IIFE (sin exponer todo a window; ver export list abajo)
// ============================================================================
// OJO: ROWS, ROW_SEQ, ROWS_J, ROW_J_SEQ, ACTIVE_TAB, MANUAL_ITEM_SEQ y MANUAL_ITEMS
// se declaran FUERA del IIFE a propósito (con `var`, no `let`). Varios otros módulos
// les hacen REASIGNACIÓN directa (ej. `ROWS = data.filas.map(...)`, no solo mutación
// como `.push()`), y si quedaran como `let` dentro del IIFE de este archivo, esa
// reasignación externa crearía una copia global desconectada de la que este módulo
// sigue usando internamente (ej. `nuevaFila()` usando un ROW_SEQ viejo, generando
// _id duplicados). No agregar más variables acá salvo que de verdad las reasigne
// otro módulo — mutación in-place (`.push`, `.filter` guardado de vuelta sí cuenta
// como reasignación) desde otro archivo es la señal de que hace falta este patrón.
var ROWS = [];
var ROW_SEQ = 1;
var ROWS_J = [];
var ROW_J_SEQ = 1;
var ACTIVE_TAB = "levantamiento-tab";
var MANUAL_ITEM_SEQ = 1;
var MANUAL_ITEMS = [];

(function () {
// ============================================================================
// ui-tabla-calculadora.js
// UI: estado de filas (ROWS) y render de la tabla Calculadora + Resumen en pantalla.
// (Parte del proyecto Calculadora Cortafuego Hilti — ver README.md para el mapa completo de módulos.)
// ============================================================================

// ============================================================================
// UI: estado de filas, render de tabla CALCULADORA y RESUMEN
// ============================================================================

const CONFIG = { C13: 15, C14: 12.5, C15: 20, C17: 0.10, C17_JUNTAS: 0.10, UMB_FS: 17, UMB_CP606: 17, UMB_SILGG: 17 };
const CONFIG_DEFAULT = { C13: 15, C14: 12.5, C15: 20, C17: 0.10, C17_JUNTAS: 0.10, UMB_FS: 17, UMB_CP606: 17, UMB_SILGG: 17 };

// Modo de presentación para los 3 productos que existen en cartucho y cubeta.
// "auto" = misma regla de siempre (17 cartuchos convierte a cubeta extra).
// "cartuchos" = todo en cartuchos. "cubetas" = todo en cubetas (cualquier
// remanente redondea a 1 cubeta más).
let RESUMEN_MODO_PRODUCTO = { "FS ONE MAX": "auto", "CP 606": "auto", "CFS SIL GG": "auto" }; // solo se mutan sus propiedades desde otros módulos, nunca se reasigna -> queda bien como let+export

// Productos agregados a mano en Cuantificación (fuera del cálculo, ej. "el
// cliente ya pidió 3 manguitos CP 653 aparte"). Se guardan y exportan junto
// con el resto del proyecto.
let MODAL_MANUAL_ABIERTO = false;
let MODAL_MANUAL_PRODUCTO_SEL = "otro"; // clave "nombre|||presentacion" de PRODUCTOS, o "otro"

function itemsManualesComoResumen() {
  return MANUAL_ITEMS.map(m => ({
    tipo: m.tipo, producto: m.producto, presentacion: m.presentacion, codigo: m.codigo,
    cantidad: m.cantidad, manual: true, _manualIds: [m._id],
  }));
}

// Clave de identidad de un ítem de Cuantificación. El código de artículo manda
// cuando existe (el catálogo PRODUCTOS y el motor de cálculo escriben la misma
// presentación con distintas palabras — ej. "Plancha 122x61x10 cm" vs
// "116 cm x 61 cm x 10 cm" — pero el mismo #42010092). Sin código válido se cae
// a producto+presentación.
function claveItemResumen(it) {
  const cod = String(it.codigo == null ? "" : it.codigo).trim().toLowerCase();
  if (cod && cod !== "-" && cod !== "#") return "cod:" + cod.replace(/^#/, "");
  return "np:" + String(it.producto || "").trim().toLowerCase() + "|||" +
         String(it.presentacion || "").trim().toLowerCase();
}

// Une los productos agregados a mano con los calculados: si el producto ya
// existe en el resumen, se suma la cantidad a la misma fila y se deja anotado
// cuánto de esa cantidad vino a mano (manualExtra) para poder mostrar el aviso
// y borrar solo esa parte. Si no existe, entra como fila manual aparte.
function combinarItemsConManuales(items) {
  const base = (items || []).map(it => Object.assign({}, it));
  const idx = new Map();
  base.forEach((it, i) => {
    const k = claveItemResumen(it);
    if (!idx.has(k)) idx.set(k, i);
  });
  const sueltos = [];
  MANUAL_ITEMS.forEach(m => {
    const cant = Number(m.cantidad) || 0;
    const k = claveItemResumen(m);
    if (idx.has(k)) {
      const dst = base[idx.get(k)];
      dst.cantidad = (Number(dst.cantidad) || 0) + cant;
      dst.manualExtra = (Number(dst.manualExtra) || 0) + cant;
      dst._manualIds = (dst._manualIds || []).concat(m._id);
      return;
    }
    const j = sueltos.findIndex(s => claveItemResumen(s) === k);
    if (j >= 0) {
      sueltos[j].cantidad = (Number(sueltos[j].cantidad) || 0) + cant;
      sueltos[j]._manualIds.push(m._id);
      return;
    }
    sueltos.push({
      tipo: m.tipo, producto: m.producto, presentacion: m.presentacion, codigo: m.codigo,
      cantidad: cant, manual: true, _manualIds: [m._id],
    });
  });
  return base.concat(sueltos);
}
const PROJECT_INFO = { nombre: "", cliente: "", fecha: new Date().toISOString().slice(0, 10) };

function nuevaFila() {
  return {
    _id: ROW_SEQ++,
    A: "", B: "", C: 1, D: "", E: 0, F: "", G: "", H: "", I: 0, J: 0,
    L: OPTS_L[0], M: OPTS_M[0], N: OPTS_N[0], O: OPTS_O[0], P: OPTS_P[0], MEM: false, R: "", PPSIZE: 7, PPINST: "Fuera",
    AJ_override: null,  // override manual de talla de collarín (null = usar la automática)
    fotos: []            // array de dataURL JPEG comprimidos, fotos de evidencia de esta línea
  };
}

function kFromL(L) {
  const map = {
    "Tubería Metal": "Tubería", "Tubería Metal Aislado": "Tubería Aislada",
    "Tubería Cobre Aislado HVAC": "Tubería Aislada", "Tubería EMT": "Tubería",
    "Tubería Combustible (PVC, CPVC, PEX, PP-R)": "Tubería",
    "Tubería Combustible Aislada (PVC, CPVC, PEX, PP-R)": "Tubería Aislada",
    "Bandeja de Cables": "Bandeja", "Cable Armado": "Cable",
    "Cables en Paso Repenetrable": "Cable", "Cables Sueltos": "Cable",
    "Caja Electromecánica UL": "Caja Electromecánica UL",
    "Ducto Rectangular": "Ducto Rectangular", "Ducto Rectangular Aislado": "Ducto Rectangular",
    "Ducto Redondo": "Ducto Redondo", "Ducto Redondo Aislado": "Ducto Redondo",
    "Pasante Múltiple": "Multiple", "Vacío": "Vacio",
    "Viga W": "Viga", "Viga Canal": "Viga", "Viga Tubo Rectangular": "Viga"
  };
  return map[L] || "";
}

// Campos relevantes según el tipo de penetrante (para mostrar/ocultar inputs)
function camposVisibles(L) {
  // Todas las celdas quedan siempre editables (igual que en el Excel original);
  // esto solo se usa para saber si un campo es relevante para el resumen mínimo.
  return { D: true, E: true, F: true, G: true, H: true, J: true };
}

function fieldLabel(f) {
  const labels = {
    A: "Zona / Descripción", B: "Nivel", C: "Cantidad", D: "Diámetro (in)",
    E: "Esp. Aislamiento (in)", F: "Dimensión A (cm)", G: "Dimensión B (cm)",
    H: "Prof. Caja (cm)", I: "Espacio Anular (in)", J: "% Ocupación",
    L: "Tipo de Penetrante", M: "Tipo de Barrera", N: "Material de Barrera",
    O: "F Rating", P: "Material Hilti"
  };
  return labels[f] || f;
}

// ============================================================================

// --- Exports usados por otros módulos ---
// (ROWS/ROW_SEQ/ROWS_J/ROW_J_SEQ/ACTIVE_TAB/MANUAL_ITEM_SEQ/MANUAL_ITEMS ya son
// globales de verdad -- se declaran con `var` fuera de este IIFE, ver arriba)
window.CONFIG = CONFIG;
window.CONFIG_DEFAULT = CONFIG_DEFAULT;
window.RESUMEN_MODO_PRODUCTO = RESUMEN_MODO_PRODUCTO;
window.itemsManualesComoResumen = itemsManualesComoResumen;
window.combinarItemsConManuales = combinarItemsConManuales;
window.PROJECT_INFO = PROJECT_INFO;
window.nuevaFila = nuevaFila;
window.kFromL = kFromL;
window.camposVisibles = camposVisibles;
})();
