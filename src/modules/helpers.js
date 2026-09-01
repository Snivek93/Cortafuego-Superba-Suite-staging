// ============================================================================
// helpers.js — encapsulado en IIFE (sin exponer todo a window; ver export list abajo)
// ============================================================================
(function () {
// ============================================================================
// helpers.js
// Funciones genéricas de propósito general (comparar texto, redondear tipo Excel, detectar vacío) — sin dependencias, usadas por todos los demás módulos.
// (Parte del proyecto Calculadora Cortafuego Hilti — ver README.md para el mapa completo de módulos.)
// ============================================================================

// ============================================================================
// MOTOR DE CÁLCULO - Réplica fiel de la hoja CALCULADORA del Excel Hilti
// ============================================================================

function eq(a, b) {
  if (a === null || a === undefined) a = "";
  if (b === null || b === undefined) b = "";
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}
function neq(a, b) { return !eq(a, b); }
function isBlank(v) { return v === null || v === undefined || v === "" || (typeof v === "number" && isNaN(v)); }
function n(v) { const x = parseFloat(v); return isNaN(x) ? 0 : x; }
function round2(v) { return Math.round(v * 100) / 100; }

// Excel ROUNDUP: away from zero, `digits` decimal places
function roundup(x, digits = 0) {
  const f = Math.pow(10, digits);
  if (x >= 0) return Math.ceil(x * f - 1e-9) / f;
  return Math.floor(x * f + 1e-9) / f;
}
function rounddown(x, digits = 0) {
  const f = Math.pow(10, digits);
  if (x >= 0) return Math.floor(x * f + 1e-9) / f;
  return Math.ceil(x * f - 1e-9) / f;
}

// Convierte texto de fracción/decimal escrito a mano ("1/2", "1 1/4", "0.5")
// a número. Usado por el formulario de Levantamiento (diámetro/espesor
// libres) y por el filtro de detalle.
function parseFraccion(txt) {
  if (!txt) return null;
  txt = txt.trim().replace(/"$/, "");
  if (!txt) return null;
  let m = txt.match(/^(-?\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (m) {
    const whole = parseFloat(m[1]), num = parseFloat(m[2]), den = parseFloat(m[3]);
    if (den) return (whole < 0 ? -1 : 1) * (Math.abs(whole) + num / den);
  }
  m = txt.match(/^(-?\d+)\s*\/\s*(\d+)$/);
  if (m) {
    const num = parseFloat(m[1]), den = parseFloat(m[2]);
    if (den) return num / den;
  }
  const v = parseFloat(txt.replace(",", "."));
  return isNaN(v) ? null : v;
}

// Sugiere el material Hilti por defecto según el tipo de penetrante — usado
// por el formulario de Levantamiento al elegir un tipo.
function materialRecomendado(L, diamIn) {
  const map = {
    "Tubería Metal": "Pasta FS ONE MAX",
    "Tubería Metal Aislado": "Pasta FS ONE MAX",
    "Tubería Cobre Aislado HVAC": "Cinta con Collar Metálico CP 648-E/ER",
    "Tubería EMT": "Pasta FS ONE MAX",
    "Tubería Combustible (PVC, CPVC, PEX, PP-R)": (diamIn && diamIn > 2) ? "Cinta con Collar Metálico CP 648-E/ER" : "Pasta FS ONE MAX",
    "Tubería Combustible Aislada (PVC, CPVC, PEX, PP-R)": "Cinta con Collar Metálico CP 648-E/ER",
    "Bandeja de Cables": "Pasta FS ONE MAX",
    "Cable Armado": "Pasta FS ONE MAX",
    "Cables en Paso Repenetrable": 'Manga CP 653 4"',
    "Cables Sueltos": "Pasta FS ONE MAX",
    "Caja Electromecánica UL": "Putty Pad CP 617",
    "Ducto Rectangular": "Pasta FS ONE MAX",
    "Ducto Rectangular Aislado": "Pasta FS ONE MAX",
    "Ducto Redondo": "Pasta FS ONE MAX",
    "Ducto Redondo Aislado": "Pasta FS ONE MAX",
    "Pasante Múltiple": "Pasta FS ONE MAX",
    "Vacío": "Pasta FS ONE MAX",
    "Viga W": "Pasta FS ONE MAX",
    "Viga Canal": "Pasta FS ONE MAX",
    "Viga Tubo Rectangular": "Pasta FS ONE MAX",
  };
  return map[L] || OPTS_P[0];
}

// --- Exports usados por otros módulos ---
window.eq = eq;
window.neq = neq;
window.isBlank = isBlank;
window.n = n;
window.round2 = round2;
window.roundup = roundup;
window.parseFraccion = parseFraccion;
window.materialRecomendado = materialRecomendado;
})();
