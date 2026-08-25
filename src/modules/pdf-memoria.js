// ============================================================================
// pdf-memoria.js — encapsulado en IIFE (sin exponer todo a window; ver export list abajo)
// ============================================================================
(function () {
// ============================================================================
// pdf-memoria.js
// Memoria de Cálculo — fórmulas con formato tipo Word (subíndices, fracciones, símbolos), desglose geométrico por subcaso, y todas las secciones por material (Pasta, Lana, Cinta, Collar, Almohadilla CFS-BL, Juntas).
// (Parte del proyecto Calculadora Cortafuego Hilti — ver README.md para el mapa completo de módulos.)
// ============================================================================

// Memoria de Cálculo — para cada producto usado (Penetrantes y Juntas) explica
// la fórmula aplicada con un ejemplo real del proyecto, y luego tabula todos
// los cálculos de ese producto para trazabilidad completa.
// ============================================================================
// ============================================================================
// Formato "tipo Word" para fórmulas: fracciones apiladas (numerador / línea /
// denominador), variables en cursiva, y un listado "Donde: ..." debajo de
// cada fórmula (en la metodología general y en cada ejemplo, con el valor
// concreto sustituido).
// ============================================================================
// ============================================================================
// Sistema de variables y fórmulas de la Memoria de Cálculo — usa exactamente
// los mismos nombres de variable que el documento de fórmulas del cliente
// (DIÁM., DIM.A, A_NUL, A_SELLO, V_SELLO, etc.), con subíndices/superíndices
// reales en el PDF (no solo texto con guion bajo).
// ============================================================================
const MEMORIA_VARIABLES_SIMBOLO = {
  U: "Área de apertura (cm2)",
  V: "Espesor de sellador según sistema UL (cm)",
  T: "Espesor de pared o losa asumido (cm)",
  S: "N° de lados a sellar (1 ó 2)",
  C: "Cantidad de penetrantes",
  Aa: "Área cubierta por cada almohadilla (cm2, según sistema UL)",
  Rd: "Rendimiento por diámetro (unidades por pieza, según tabla UL)",
  Ac: "Área de la caja eléctrica (cm2)",
  Ap: "Área efectiva de un Putty Pad (cm2, según tamaño e instalación)",
};

// Registro único de variables "estilo documento": símbolo visual (base +
// subíndice) y su descripción — mismos nombres que definió Kevin en el Word
// de fórmulas. `key` se usa como texto plano en encabezados de tabla y como
// llave de valores de ejemplo; `v`/`sub` arman el símbolo con subíndice real
// en las fórmulas y en la lista "Donde:".
const SIM = {
  DIAM:    { key: "DIÁM.",    v: "DIÁM.", desc: "Diámetro de levantamiento (in)" },
  DIMA:    { key: "DIM.A",    v: "DIM.A", desc: "Dimensión A de levantamiento (cm)" },
  DIMB:    { key: "DIM.B",    v: "DIM.B", desc: "Dimensión B de levantamiento (cm)" },
  DATOTAL: { key: "DA_TOTAL", v: "DA", sub: "TOTAL", desc: "Dimensión A de pasante (cm)" },
  DBTOTAL: { key: "DB_TOTAL", v: "DB", sub: "TOTAL", desc: "Dimensión B de pasante (cm)" },
  ANUL:    { key: "A_NUL",    v: "A",  sub: "NUL",   desc: "Espacio anular, cuando no exista espacio anular el valor de A_NUL se sustituye por 1/2\" para considerar instalación externa tipo ochavo, anillo o volcán." },
  AISL:    { key: "A_ISL",    v: "A",  sub: "ISL",   desc: "Espesor de aislamiento, de levantamiento (in)" },
  DTOTAL:  { key: "d_total",  v: "d",  sub: "total", desc: "Diámetro total de penetrante = DIÁM. + 2×A_ISL, convertido a cm" },
  DPAS:    { key: "d_pas",    v: "d",  sub: "pas",   desc: "Diámetro de pasante (cm)" },
  APEN:    { key: "A_PEN",    v: "A",  sub: "PEN",   desc: "Área penetrante (cm2)" },
  APAS:    { key: "A_PAS",    v: "A",  sub: "PAS",   desc: "Área pasante (cm2)" },
  ADUCT:   { key: "A_DUCT",   v: "A",  sub: "DUCT",  desc: "Área de ducto (cm2)" },
  AVIGA:   { key: "A_VIGA",   v: "A",  sub: "VIGA",  desc: "Área de la viga (cm2)" },
  PVIGA:   { key: "P_VIGA",   v: "P",  sub: "VIGA",  desc: "Perímetro de viga (cm)" },
  ASELLO:  { key: "A_SELLO",  v: "A",  sub: "SELLO", desc: "Área de sello cortafuego (cm2)" },
  ESELLO:  { key: "E_SELLO",  v: "E",  sub: "SELLO", desc: "Espesor de sello cortafuego según sistema UL (cm)" },
  VSELLO:  { key: "V_SELLO",  v: "V",  sub: "SELLO", desc: "Volumen de sello cortafuego (cm3)" },
  OCUP:    { key: "%_OCUP",   v: "%",  sub: "OCUP",  desc: "Porcentaje de ocupación del pasante" },
  SLADOS:  { key: "S_LADOS",  v: "S",  sub: "LADOS", desc: "N° de lados a sellar (1 ó 2)" },
  CANT:    { key: "C_ANT",    v: "C",  sub: "ANT",   desc: "Cantidad de penetrantes" },
  DESP:    { key: "%_DESP",   v: "%",  sub: "DESP",  desc: "% de desperdicio configurado — se aplica una sola vez, sobre la suma total del proyecto, no fila por fila" },
  TESP:    { key: "T_ESP",    v: "T",  sub: "ESP",   desc: "Espesor de pared, de la configuración del proyecto (cm)" },
  LANA:    { key: "LANA MINERAL", v: "Lana Mineral" },
  NVUELTAS:{ key: "N_VUELTAS", v: "N",  sub: "VUELTAS", desc: "Número de vueltas de cinta según sistema UL" },
  LCINTA:  { key: "L_CINTA",   v: "L",  sub: "CINTA",   desc: "Longitud de cinta por diámetro, de la tabla de rendimiento (cm)" },
  LCTOTAL: { key: "L_CTOTAL",  v: "L",  sub: "CTOTAL",  desc: "Longitud total de cinta calculada por penetrante (cm)" },
  LCOLTUB: { key: "L_COLTUB",  v: "L",  sub: "COLTUB",  desc: "Longitud de collar por diámetro de tubería (cm)" },
  LCOLTOT: { key: "L_COLTOT",  v: "L",  sub: "COLTOT",  desc: "Longitud total de collar por penetrante (cm)" },
  ABL:     { key: "A_BL",      v: "A",  sub: "BL",      desc: "Área cubierta por cada ladrillo CFS-BL (cm2) — 65 o 100, según con qué lado entra el ladrillo en la pared" },
  CANTBL:  { key: "CANT_BL",   v: "CANT", sub: "BL",    desc: "Cantidad de ladrillos CFS-BL por penetrante" },
  ACAJA:   { key: "A_CAJA",    v: "A",  sub: "CAJA",    desc: "Área total de la caja eléctrica a cubrir (cm2) = cara frontal + 4 caras laterales" },
  PROF:    { key: "P_ROF",     v: "P",  sub: "ROF",     desc: "Profundidad de la caja eléctrica (cm)" },
  AEF:     { key: "A_EF",      v: "A",  sub: "EF",      desc: "Área efectiva de un Putty Pad, ya restando el traslape entre pads (cm2) — depende del tamaño (7x7\" o 9x9\")" },
  CANTPP:  { key: "CANT_PP",   v: "CANT", sub: "PP",    desc: "Cantidad de Putty Pads" },
  EESPUMA: { key: "E_ESPUMA",  v: "E",    sub: "ESPUMA", desc: "Espesor de espuma según sistema UL (cm)" },
  VESPUMA: { key: "V_ESPUMA",  v: "V",    sub: "ESPUMA", desc: "Volumen de espuma CP 620 (cm3)" },
  EMORTERO: { key: "E_MORTERO", v: "E",   sub: "MORTERO", desc: "Espesor de mortero según sistema UL (in)" },
  VMORTERO: { key: "V_MORTERO", v: "V",   sub: "MORTERO", desc: "Volumen de mortero CP 637 (cm3)" },
  CCABLES:  { key: "C_CABLES",  v: "C",   sub: "CABLES",   desc: "Cantidad de cables que caben por pieza, según diámetro (tabla de referencia Hilti)" },
  CANTPIEZA:{ key: "CANT_PIEZA",v: "CANT",sub: "PIEZA",    desc: "Cantidad de piezas — Manga CP 653 o Paso MSL, según el producto de cada fila" },
  LJUNTA:   { key: "L_JUNTA",  v: "L",    sub: "JUNTA",   desc: "Longitud de la junta (cm)" },
  ANJUNTA:  { key: "AN_JUNTA", v: "AN",   sub: "JUNTA",   desc: "Ancho medido de la junta (cm) — 0 en juntas topadas" },
  TRASLP:   { key: "T_RASLP",  v: "T",    sub: "RASLP",   desc: "Traslape del producto sobre cada borde, según sistema UL (cm)" },
  EJUNTA:   { key: "E_JUNTA",  v: "E",    sub: "JUNTA",   desc: "Espesor de producto aplicado, según sistema UL (cm)" },
  NLADO:    { key: "N_LADO",   v: "N",    sub: "LADO",    desc: "N° de lados sellados (1 ó 2)" },
  CANTJUNTA:{ key: "CANT_JUNTA",v: "CANT",sub: "JUNTA",   desc: "Cantidad de juntas" },
  EPARED:   { key: "E_PARED",  v: "E",    sub: "PARED",   desc: "Espesor de pared adyacente a la junta (cm)" },
  FCOMP:    { key: "F_COMP",   v: "F",    sub: "COMP",    desc: "Factor de compresión de la lana mineral, según sistema UL" },
  VLANA:    { key: "V_LANA",   v: "V",    sub: "LANA",    desc: "Volumen de lana mineral (cm3)" },
  ALANA:    { key: "A_LANA",   v: "A",    sub: "LANA",    desc: "Área de lana mineral (cm2) — Muro Cortina, Entrepiso-Entrepiso y Pared-Entrepiso Lateral" },
  CANTCOLL: { key: "CANT_COLLAR", v: "CANT", sub: "COLLAR", desc: "Cantidad de collarines CP 643N/644 por penetrante" },
};
// Descripciones de SIM también quedan disponibles por su `key` de texto plano,
// para que dibujarListaVariables funcione igual reciba un string o un objeto SIM.
Object.keys(SIM).forEach(k => { MEMORIA_VARIABLES_SIMBOLO[SIM[k].key] = SIM[k].desc; });

const mv = (sym) => ({ v: sym });
const mvs = (simKey) => ({ v: SIM[simKey].v, sub: SIM[simKey].sub, key: SIM[simKey].key });
const mop = (s, sup) => (sup ? { op: s, sup } : { op: s });
const mc = (s, sup) => (sup ? { c: s, sup } : { c: s });
const mfrac = (numTokens, denTokens) => ({ frac: { numTokens, denTokens } });
const mfracPi = (den) => ({ frac: { numTokens: [{ pi: true }], denTokens: [mc(den)] } });
const SQ = "2"; // exponente "al cuadrado" — se usa como mop(")", SQ) al cerrar un paréntesis

const MEMORIA_FORMULAS_PENETRANTES = {
  "Pasta FS ONE MAX": {
    resultado: "V_SELLO (cm3)",
    resultadoSim: [mvs("VSELLO")],
    tokens: [mvs("ASELLO"), mop("×"), mvs("ESELLO"), mop("×"), mvs("SLADOS"), mop("×"), mvs("CANT"), mop("×"), mop("("), mc("1"), mop("+"), mvs("DESP"), mop(")")],
    vars: [SIM.VSELLO, SIM.ASELLO, SIM.ESELLO, SIM.SLADOS, SIM.CANT, SIM.DESP],
    nota: "Si la pared es más gruesa que 12.5cm, la lana mineral de refuerzo se calcula por volumen en vez de por área (ver Lana Mineral, más abajo). El % de desperdicio se aplica una sola vez sobre el total del proyecto — más abajo se detalla el área de sello fila por fila, antes de ese ajuste.",
  },
  "Sellador CP 606": {
    resultado: "V_SELLO (cm3)",
    resultadoSim: [mvs("VSELLO")],
    tokens: [mvs("ASELLO"), mop("×"), mvs("ESELLO"), mop("×"), mvs("SLADOS"), mop("×"), mvs("CANT"), mop("×"), mop("("), mc("1"), mop("+"), mvs("DESP"), mop(")")],
    vars: [SIM.VSELLO, SIM.ASELLO, SIM.ESELLO, SIM.SLADOS, SIM.CANT, SIM.DESP],
    nota: "Si la pared es más gruesa que 12.5cm, la lana mineral de refuerzo se calcula por volumen en vez de por área (ver Lana Mineral, más abajo). El % de desperdicio se aplica una sola vez sobre el total del proyecto — más abajo se detalla el área de sello fila por fila, antes de ese ajuste.",
  },
  "Sellador CFS SIL GG": {
    resultado: "V_SELLO (cm3)",
    resultadoSim: [mvs("VSELLO")],
    tokens: [mvs("ASELLO"), mop("×"), mvs("ESELLO"), mop("×"), mvs("SLADOS"), mop("×"), mvs("CANT"), mop("×"), mop("("), mc("1"), mop("+"), mvs("DESP"), mop(")")],
    vars: [SIM.VSELLO, SIM.ASELLO, SIM.ESELLO, SIM.SLADOS, SIM.CANT, SIM.DESP],
    nota: "Si la pared es más gruesa que 12.5cm, la lana mineral de refuerzo se calcula por volumen en vez de por área (ver Lana Mineral, más abajo). El % de desperdicio se aplica una sola vez sobre el total del proyecto — más abajo se detalla el área de sello fila por fila, antes de ese ajuste.",
  },
  "Collarín CP 643N/644": {
    resultado: "CANT_COLLAR (unid.)",
    resultadoSim: [mvs("CANTCOLL")],
    tokens: [mvs("SLADOS"), mop("×"), mvs("CANT")],
    vars: [SIM.SLADOS, SIM.CANT],
    nota: "El modelo específico (CP 643N o CP 644) depende del diámetro de la tubería.",
  },
};
const MEMORIA_NOTA_CINTA = "La longitud de cinta intumescente (y de collar metálico, cuando aplica) se lee de una tabla de rendimiento por diámetro de tubería según el sistema UL, multiplicada por la cantidad de penetrantes y el N° de lados sellados. No sigue una fórmula algebraica simple — se detalla el resultado ya calculado en la tabla de abajo.";

// Clasifica una fila de penetrante en el mismo "caso" geométrico que usa
// computeRow para armar U (área de apertura) — misma lógica exacta, para que
// la Memoria de Cálculo muestre el desglose correcto según el tipo real.
function clasificarSubcasoU(r) {
  if (isBlank(r.F) && eq(r.L, TIPO_VACIO)) return "vacio_redondo";
  if (isBlank(r.F)) return "tuberia_cable";
  if (eq(r.L, TIPO_DUCTO_RECT) || eq(r.L, TIPO_DUCTO_RECT_AISL)) return "ducto_rect";
  if (eq(r.L, TIPO_DUCTO_RED) || eq(r.L, TIPO_DUCTO_RED_AISL)) return "ducto_red";
  if (eq(r.L, TIPO_VIGA_W)) return "viga_w";
  if (eq(r.L, TIPO_VIGA_CANAL)) return "viga_canal";
  if (eq(r.L, TIPO_VIGA_TUBO)) return "viga_tubo";
  return "bandeja_rect";
}

// Config por subcaso: título, la cadena de fórmulas intermedias exactamente
// como las definió el documento (una entrada por paso, en orden), y las
// columnas de la tabla con los mismos nombres.
const SIM_ANUL_CORTO = Object.assign({}, SIM.ANUL, { desc: "Espacio anular" });
const MEMORIA_SUBCASOS_U = {
  vacio_redondo: {
    titulo: "Vacío Redondo",
    formulas: [
      { resultadoSim: [mvs("ASELLO")], tokens: [mfracPi("4"), mop("×"), mop("("), mvs("DIAM"), mop(")", SQ)], vars: [SIM.DIAM] },
    ],
    columnas: [
      { key: "DIÁM.", header: "DIÁM. (in)", get: r => formatFraccionPulgadas(r.D) },
    ],
  },
  tuberia_cable: {
    titulo: "Tubería, Cable Armado y Cable Suelto",
    formulas: [
      { resultadoSim: [mvs("DTOTAL")], tokens: [mvs("DIAM"), mop("+"), mc("2"), mop("×"), mvs("AISL")], vars: [SIM.DIAM, SIM.AISL] },
      { resultadoSim: [mvs("APEN")], tokens: [mfracPi("4"), mop("×"), mop("("), mvs("DTOTAL"), mop(")", SQ)], vars: [SIM.DTOTAL] },
      { resultadoSim: [mvs("APAS")], tokens: [mfracPi("4"), mop("×"), mop("("), mvs("DTOTAL"), mop("+"), mc("2"), mop("×"), mvs("ANUL"), mop(")", SQ)], vars: [SIM.ANUL] },
      { resultadoSim: [mvs("ASELLO")], tokens: [mvs("APAS"), mop("-"), mvs("APEN")], vars: [] },
    ],
    columnas: [
      { key: "DIÁM.", header: "DIÁM. (in)", get: r => formatFraccionPulgadas(r.D) },
      { key: "A_ISL", header: "A_ISL (in)", get: r => formatFraccionPulgadas(r.E) },
      { key: "A_NUL", header: "A_NUL (in)", get: r => formatFraccionPulgadas(n(r.I) === 0 ? 0.5 : n(r.I)), getEjemplo: r => r.ANULAR_CM !== "-" ? fmtComa(r.ANULAR_CM, 2) : "-" },
      { key: "d_total", header: "d_total (cm)", get: r => r.D_TOTAL !== "-" ? fmtComa(r.D_TOTAL, 2) : "-" },
      { key: "A_PEN", header: "A_PEN (cm2)", get: r => r.A_PEN !== "-" ? fmtComa(r.A_PEN, 1) : "-" },
      { key: "A_PAS", header: "A_PAS (cm2)", get: r => r.A_PAS !== "-" ? fmtComa(r.A_PAS, 1) : "-" },
    ],
  },
  bandeja_rect: {
    titulo: "Bandeja de Cables, Pasante Múltiple y Vacío Rectangular",
    formulas: [
      { resultadoSim: [mvs("DATOTAL")], tokens: [mvs("DIMA"), mop("+"), mc("2"), mop("×"), mvs("ANUL")], vars: [SIM.DIMA] },
      { resultadoSim: [mvs("DBTOTAL")], tokens: [mvs("DIMB"), mop("+"), mc("2"), mop("×"), mvs("ANUL")], vars: [SIM.DIMB, SIM_ANUL_CORTO] },
      { resultadoSim: [mvs("ASELLO")], tokens: [mvs("DATOTAL"), mop("×"), mvs("DBTOTAL"), mop("×"), mop("("), mc("1"), mop("-"), mvs("OCUP"), mop(")")], vars: [SIM.OCUP] },
    ],
    columnas: [
      { key: "DIM.A", header: "DIM.A (cm)", get: r => fmtComa(r.F, 0) },
      { key: "DIM.B", header: "DIM.B (cm)", get: r => fmtComa(r.G, 0) },
      { key: "A_NUL", header: "A_NUL (in)", get: r => formatFraccionPulgadas(n(r.I) === 0 ? 0.5 : n(r.I)), getEjemplo: r => r.ANULAR_CM !== "-" ? fmtComa(r.ANULAR_CM, 2) : "-" },
      { key: "DA_TOTAL", header: "DA_TOTAL (cm)", get: r => r.DA_TOTAL !== "-" ? fmtComa(r.DA_TOTAL, 2) : "-" },
      { key: "DB_TOTAL", header: "DB_TOTAL (cm)", get: r => r.DB_TOTAL !== "-" ? fmtComa(r.DB_TOTAL, 2) : "-" },
      { key: "%_OCUP", header: "%_OCUP", get: r => r.J !== "" ? fmtComa(Number(r.J) * 100, 0) + "%" : "0%" },
    ],
  },
  ducto_rect: {
    titulo: "Ducto Rectangular",
    formulas: [
      { resultadoSim: [mvs("DATOTAL")], tokens: [mvs("DIMA"), mop("+"), mc("2"), mop("×"), mvs("AISL")], vars: [SIM.DIMA] },
      { resultadoSim: [mvs("DBTOTAL")], tokens: [mvs("DIMB"), mop("+"), mc("2"), mop("×"), mvs("AISL")], vars: [SIM.DIMB, SIM.AISL] },
      { resultadoSim: [mvs("ADUCT")], tokens: [mvs("DATOTAL"), mop("×"), mvs("DBTOTAL")], vars: [] },
      { resultadoSim: [mvs("APAS")], tokens: [mop("("), mvs("DATOTAL"), mop("+"), mc("2"), mop("×"), mvs("ANUL"), mop(")"), mop("×"), mop("("), mvs("DBTOTAL"), mop("+"), mc("2"), mop("×"), mvs("ANUL"), mop(")")], vars: [SIM.ANUL] },
      { resultadoSim: [mvs("ASELLO")], tokens: [mvs("APAS"), mop("-"), mvs("ADUCT")], vars: [] },
    ],
    columnas: [
      { key: "DIM.A", header: "DIM.A (cm)", get: r => fmtComa(r.F, 0) },
      { key: "DIM.B", header: "DIM.B (cm)", get: r => fmtComa(r.G, 0) },
      { key: "A_ISL", header: "A_ISL (in)", get: r => formatFraccionPulgadas(r.E) },
      { key: "A_NUL", header: "A_NUL (in)", get: r => formatFraccionPulgadas(n(r.I) === 0 ? 0.5 : n(r.I)), getEjemplo: r => r.ANULAR_CM !== "-" ? fmtComa(r.ANULAR_CM, 2) : "-" },
      { key: "DA_TOTAL", header: "DA_TOTAL (cm)", get: r => r.DA_TOTAL !== "-" ? fmtComa(r.DA_TOTAL, 2) : "-" },
      { key: "DB_TOTAL", header: "DB_TOTAL (cm)", get: r => r.DB_TOTAL !== "-" ? fmtComa(r.DB_TOTAL, 2) : "-" },
      { key: "A_DUCT", header: "A_DUCT (cm2)", get: r => r.A_DUCT !== "-" ? fmtComa(r.A_DUCT, 1) : "-" },
    ],
  },
  ducto_red: {
    titulo: "Ducto Redondo",
    formulas: [
      { resultadoSim: [mvs("DTOTAL")], tokens: [mvs("DIAM"), mop("+"), mc("2"), mop("×"), mvs("AISL")], vars: [SIM.DIAM, SIM.AISL] },
      { resultadoSim: [mvs("ADUCT")], tokens: [mfracPi("4"), mop("×"), mop("("), mvs("DTOTAL"), mop(")", SQ)], vars: [] },
      { resultadoSim: [mvs("APAS")], tokens: [mfracPi("4"), mop("×"), mop("("), mvs("DTOTAL"), mop("+"), mc("2"), mop("×"), mvs("ANUL"), mop(")", SQ)], vars: [SIM.ANUL] },
      { resultadoSim: [mvs("ASELLO")], tokens: [mvs("APAS"), mop("-"), mvs("ADUCT")], vars: [] },
    ],
    columnas: [
      { key: "DIÁM.", header: "DIÁM. (in)", get: r => formatFraccionPulgadas(r.D) },
      { key: "A_ISL", header: "A_ISL (in)", get: r => formatFraccionPulgadas(r.E) },
      { key: "A_NUL", header: "A_NUL (in)", get: r => formatFraccionPulgadas(n(r.I) === 0 ? 0.5 : n(r.I)), getEjemplo: r => r.ANULAR_CM !== "-" ? fmtComa(r.ANULAR_CM, 2) : "-" },
      { key: "d_total", header: "d_total (cm)", get: r => r.D_TOTAL !== "-" ? fmtComa(r.D_TOTAL, 2) : "-" },
      { key: "A_DUCT", header: "A_DUCT (cm2)", get: r => r.A_DUCT !== "-" ? fmtComa(r.A_DUCT, 1) : "-" },
      { key: "A_PAS", header: "A_PAS (cm2)", get: r => r.A_PAS !== "-" ? fmtComa(r.A_PAS, 1) : "-" },
    ],
  },
  viga_w: {
    titulo: "Viga W",
    formulas: [
      { resultadoSim: [mvs("PVIGA")], tokens: [mc("2"), mop("×"), mvs("DIMA"), mop("+"), mc("4"), mop("×"), mvs("DIMB")], vars: [SIM.DIMA, SIM.DIMB] },
      { resultadoSim: [mvs("ASELLO")], tokens: [mvs("PVIGA"), mop("×"), mvs("ANUL")], vars: [SIM.ANUL] },
    ],
    columnas: [
      { key: "DIM.A", header: "DIM.A (cm)", get: r => fmtComa(r.F, 0) },
      { key: "DIM.B", header: "DIM.B (cm)", get: r => fmtComa(r.G, 0) },
      { key: "A_NUL", header: "A_NUL (in)", get: r => formatFraccionPulgadas(n(r.I) === 0 ? 0.5 : n(r.I)), getEjemplo: r => r.ANULAR_CM !== "-" ? fmtComa(r.ANULAR_CM, 2) : "-" },
      { key: "P_VIGA", header: "P_VIGA (cm)", get: r => r.P_VIGA !== "-" ? fmtComa(r.P_VIGA, 1) : "-" },
    ],
  },
  viga_canal: {
    titulo: "Viga Canal",
    formulas: [
      { resultadoSim: [mvs("PVIGA")], tokens: [mc("2"), mop("×"), mop("("), mc("2"), mop("×"), mvs("DIMA"), mop("+"), mvs("DIMB"), mop(")")], vars: [SIM.DIMA, SIM.DIMB] },
      { resultadoSim: [mvs("ASELLO")], tokens: [mvs("PVIGA"), mop("×"), mvs("ANUL")], vars: [SIM.ANUL] },
    ],
    columnas: [
      { key: "DIM.A", header: "DIM.A (cm)", get: r => fmtComa(r.F, 0) },
      { key: "DIM.B", header: "DIM.B (cm)", get: r => fmtComa(r.G, 0) },
      { key: "A_NUL", header: "A_NUL (in)", get: r => formatFraccionPulgadas(n(r.I) === 0 ? 0.5 : n(r.I)), getEjemplo: r => r.ANULAR_CM !== "-" ? fmtComa(r.ANULAR_CM, 2) : "-" },
      { key: "P_VIGA", header: "P_VIGA (cm)", get: r => r.P_VIGA !== "-" ? fmtComa(r.P_VIGA, 1) : "-" },
    ],
  },
  viga_tubo: {
    titulo: "Viga Tubo Rectangular",
    formulas: [
      { resultadoSim: [mvs("AVIGA")], tokens: [mvs("DIMA"), mop("×"), mvs("DIMB")], vars: [SIM.DIMA, SIM.DIMB] },
      { resultadoSim: [mvs("APAS")], tokens: [mop("("), mvs("DIMA"), mop("+"), mc("2"), mop("×"), mvs("ANUL"), mop(")"), mop("×"), mop("("), mvs("DIMB"), mop("+"), mc("2"), mop("×"), mvs("ANUL"), mop(")")], vars: [SIM.ANUL] },
      { resultadoSim: [mvs("ASELLO")], tokens: [mvs("APAS"), mop("-"), mvs("AVIGA")], vars: [] },
    ],
    columnas: [
      { key: "DIM.A", header: "DIM.A (cm)", get: r => fmtComa(r.F, 0) },
      { key: "DIM.B", header: "DIM.B (cm)", get: r => fmtComa(r.G, 0) },
      { key: "A_NUL", header: "A_NUL (in)", get: r => formatFraccionPulgadas(n(r.I) === 0 ? 0.5 : n(r.I)), getEjemplo: r => r.ANULAR_CM !== "-" ? fmtComa(r.ANULAR_CM, 2) : "-" },
      { key: "A_VIGA", header: "A_VIGA (cm2)", get: r => r.A_VIGA !== "-" ? fmtComa(r.A_VIGA, 1) : "-" },
      { key: "A_PAS", header: "A_PAS (cm2)", get: r => r.A_PAS !== "-" ? fmtComa(r.A_PAS, 1) : "-" },
    ],
  },
};
// Materiales cuyo volumen se basa en A_SELLO (área de sello) y por lo tanto
// se benefician del desglose geométrico por subcaso, con el formato de
// variables del documento. Empezamos solo con Pasta FS ONE MAX; CP 606 y
// CFS SIL GG quedan listos para sumarse con la misma lógica más adelante.
const MEMORIA_PRODUCTOS_CON_DESGLOSE_U = ["Pasta FS ONE MAX", "Sellador CP 606", "Sellador CFS SIL GG"];
// Mismo cálculo U×V×S para los 3 — solo cambia en qué columna vive el
// resultado (Y para Pasta, AM para CP 606, AO para CFS SIL GG), porque
// calc-engine.js las mantiene separadas para no mezclar selladores.
const CAMPO_VOLUMEN_SELLO_PENETRANTE = { "Pasta FS ONE MAX": "Y", "Sellador CP 606": "AM", "Sellador CFS SIL GG": "AO" };

// Texto de resultado que muestra SOLO el volumen de sello (V_SELLO) de esta
// fila — sin mezclar Lana ni ningún otro material, que tendrán su propia
// tabla más adelante.
function resultadoVSelloTexto(row) {
  if (row.Y === "-" || row.Y === undefined || row.Y === null) return "—";
  const num = fmtDetalleNum(row.Y, 1);
  if (num === null || parseFloat(num.replace(",", "")) === 0) return "—";
  return `V_SELLO: ${num} cm3`;
}


// Dibuja una fórmula en una sola línea visual: variables en cursiva, con
// subíndices y superíndices reales (más chico, desplazado), y fracciones con
// numerador y denominador apilados (formato tipo Word). Devuelve el alto
// extra (por encima de la línea base) que ocupó, para que el llamador
// reserve espacio vertical si hay fracciones.
// ============================================================================
// Motor de fórmulas de la Memoria de Cálculo — un solo tamaño de letra para
// texto corrido y uno para fórmulas, en toda la sección, para que no salten
// tamaños distintos entre bloques.
// ============================================================================
const MC_BODY = 9.5;      // texto corrido, notas, "Donde:", bullets
const MC_FORMULA = 10.5;  // símbolos de fórmula (resultado = ... )
const MC_TITULO_MAT = 13; // título de cada material (Pasta FS ONE MAX, etc.)
const MC_TITULO_SUB = 11.5; // título de cada subcaso geométrico
const MC_TABLA = 6.5;     // texto dentro de las tablas de datos

const mpi = () => ({ pi: true });

// Mide o dibuja una línea de fórmula (variables en cursiva con subíndice real,
// π con la fuente Symbol, fracciones apiladas, exponentes como superíndice).
// Con opts.medir=true no dibuja nada — solo devuelve el ancho total, útil
// para centrar la línea antes de dibujarla.
function dibujarFormulaLinea(doc, x, yBase, tokens, fontSize, opts) {
  opts = opts || {};
  const medir = !!opts.medir;
  fontSize = fontSize || MC_FORMULA;
  const fSub = fontSize * 0.6;
  let cursorX = x;
  let alturaArriba = 0, alturaAbajo = 0; // espacio extra por fracciones/subíndices

  const anchoTexto = (txt, font, size) => {
    if (font === "symbol") doc.setFont("symbol", "normal"); else doc.setFont("helvetica", font);
    doc.setFontSize(size);
    return doc.getTextWidth(txt);
  };

  tokens.forEach(token => {
    if (token.frac) {
      const fFrac = fontSize * 0.75;
      const medidaNum = dibujarFormulaLinea(doc, 0, 0, token.frac.numTokens, fFrac, { medir: true });
      const medidaDen = dibujarFormulaLinea(doc, 0, 0, token.frac.denTokens, fFrac, { medir: true });
      const w = Math.max(medidaNum.ancho, medidaDen.ancho);
      // La línea de la fracción es un punto FIJO (barY); el numerador y el
      // denominador se alejan de ella lo que haga falta según si tienen
      // subíndice (que baja) o no — así el subíndice nunca choca con la raya.
      const barY = yBase - fontSize * 0.08;
      const margen = fontSize * 0.18;
      const baselineNum = barY - medidaNum.alturaAbajo - margen;
      const baselineDen = barY + fFrac * 0.75 + medidaDen.alturaArriba + margen;
      if (!medir) {
        dibujarFormulaLinea(doc, cursorX + (w - medidaNum.ancho) / 2, baselineNum - medidaNum.alturaArriba, token.frac.numTokens, fFrac);
        doc.setDrawColor(20, 20, 20); doc.setLineWidth(0.6);
        doc.line(cursorX, barY, cursorX + w, barY);
        dibujarFormulaLinea(doc, cursorX + (w - medidaDen.ancho) / 2, baselineDen - medidaDen.alturaArriba, token.frac.denTokens, fFrac);
        doc.setFont("helvetica", "normal"); doc.setFontSize(fontSize);
      }
      cursorX += w + fontSize * 0.7;
      alturaArriba = Math.max(alturaArriba, yBase - (baselineNum - medidaNum.alturaArriba) + fFrac * 0.85);
      alturaAbajo = Math.max(alturaAbajo, (baselineDen + medidaDen.alturaAbajo) - yBase);
      return;
    }
    if (token.pi) {
      const w = anchoTexto("p", "symbol", fontSize);
      if (!medir) { doc.setFont("symbol", "normal"); doc.setFontSize(fontSize); doc.text("p", cursorX, yBase); }
      cursorX += w;
      if (token.sub) {
        doc.setFontSize(fSub);
        const wS = doc.getTextWidth(token.sub);
        if (!medir) { doc.setFont("helvetica", "italic"); doc.text(token.sub, cursorX + 1, yBase + fSub * 0.5); }
        cursorX += wS + 1.5;
        alturaAbajo = Math.max(alturaAbajo, fSub);
      }
      cursorX += fontSize * 0.28;
      return;
    }
    const esVariable = !!token.v;
    const texto = token.op !== undefined ? token.op : (token.c !== undefined ? token.c : token.v);
    const w = anchoTexto(texto, esVariable ? "italic" : "normal", fontSize);
    if (!medir) { doc.setFont("helvetica", esVariable ? "italic" : "normal"); doc.setFontSize(fontSize); doc.text(texto, cursorX, yBase); }
    cursorX += w;
    if (token.sub) {
      doc.setFontSize(fSub);
      const wS = doc.getTextWidth(token.sub);
      if (!medir) { doc.setFont("helvetica", esVariable ? "italic" : "normal"); doc.text(token.sub, cursorX + 1, yBase + fSub * 0.5); }
      cursorX += wS + 1.5;
      alturaAbajo = Math.max(alturaAbajo, fSub);
    }
    if (token.sup) {
      doc.setFontSize(fSub);
      const wS = doc.getTextWidth(token.sup);
      if (!medir) { doc.setFont("helvetica", "normal"); doc.text(token.sup, cursorX + 1, yBase - fontSize * 0.32); }
      cursorX += wS + 1.5;
      alturaArriba = Math.max(alturaArriba, fSub);
    }
    // Espacio entre tokens — un poco más generoso alrededor de operadores.
    cursorX += token.op !== undefined ? fontSize * 0.32 : fontSize * 0.22;
  });
  if (!medir) doc.setFont("helvetica", "normal");
  return { ancho: cursorX - x, alturaArriba, alturaAbajo };
}

function formulaTieneFraccion(tokens) {
  return tokens.some(t => !!t.frac);
}

// Dibuja "resultado = fórmula" CENTRADA dentro de maxWidth y devuelve la
// posición Y siguiente (con el espaciado ya reservado, incluyendo el alto
// extra si hubo fracciones o subíndices largos).
const MC_GAP_FORMULA = 15; // espacio en blanco FIJO entre el fondo real de una línea y el inicio de la siguiente

// Dibuja UNA línea de fórmula centrada en maxWidth. El espacio en blanco que
// deja libre hasta la siguiente línea es SIEMPRE el mismo (MC_GAP_FORMULA),
// medido desde el fondo real de lo que se dibujó — no desde un desplazamiento
// fijo — para que una línea con fracción (más alta) no rompa el espaciado
// parejo con las líneas de al lado.
function dibujarLineaFormulaCentrada(doc, x, y, tokens, maxWidth) {
  doc.setTextColor(20, 20, 20);
  const medida = dibujarFormulaLinea(doc, 0, 0, tokens, MC_FORMULA, { medir: true });
  const startX = x + Math.max(0, (maxWidth - medida.ancho) / 2);
  const yBase = y + medida.alturaArriba;
  dibujarFormulaLinea(doc, startX, yBase, tokens, MC_FORMULA);
  doc.setFont("helvetica", "normal"); doc.setTextColor(20, 20, 20);
  return yBase + medida.alturaAbajo + MC_GAP_FORMULA;
}

function dibujarFormulaCompleta(doc, x, y, resultadoSim, tokens, maxWidth) {
  if (!Array.isArray(resultadoSim)) resultadoSim = [{ c: resultadoSim }];
  const completa = [].concat(resultadoSim, [{ op: "=" }], tokens);
  return dibujarLineaFormulaCentrada(doc, x, y, completa, maxWidth);
}

// Igual que dibujarFormulaCompleta, pero para el "Ejemplo de cálculo": la
// fórmula sale con los símbolos sustituidos por sus valores reales (mismo
// formato visual, solo que en vez de la letra aparece el número), y una
// segunda línea centrada abajo con "= resultado final, con unidades" — con
// el mismo espaciado fijo que cualquier otra línea de fórmula.
function sustituirTokens(tokens, valores) {
  return tokens.map(t => {
    if (t.frac) return { frac: { numTokens: sustituirTokens(t.frac.numTokens, valores), denTokens: sustituirTokens(t.frac.denTokens, valores) } };
    return (t.key && valores[t.key] !== undefined) ? { c: valores[t.key] } : t;
  });
}
function dibujarFormulaEjemplo(doc, x, y, resultadoSim, tokens, valores, valorFinalTokens, maxWidth) {
  const tokensSust = sustituirTokens(tokens, valores);
  y = dibujarFormulaCompleta(doc, x, y, resultadoSim, tokensSust, maxWidth);
  if (valorFinalTokens) {
    const linea = [].concat([{ op: "=" }], valorFinalTokens);
    y = dibujarLineaFormulaCentrada(doc, x, y, linea, maxWidth);
  }
  return y;
}

// Dibuja una nota corta (una sola línea, sin ajuste de texto) que mezcla
// texto plano con algún símbolo SIM incrustado (ej. "Si A_NUL = 0 ..."),
// para que el símbolo lleve subíndice real igual que en las fórmulas.
function dibujarNotaConSimbolo(doc, x, y, partes, fontSize) {
  doc.setFont("helvetica", "italic"); doc.setFontSize(fontSize); doc.setTextColor(120, 120, 120);
  let cursorX = x;
  const fSub = fontSize * 0.62;
  partes.forEach(p => {
    if (typeof p === "string") {
      doc.setFont("helvetica", "italic"); doc.setFontSize(fontSize);
      doc.text(p, cursorX, y);
      cursorX += doc.getTextWidth(p);
    } else {
      doc.setFont("helvetica", "italic"); doc.setFontSize(fontSize);
      doc.text(p.v, cursorX, y);
      cursorX += doc.getTextWidth(p.v);
      if (p.sub) {
        doc.setFontSize(fSub);
        doc.text(p.sub, cursorX + 0.5, y + fSub * 0.45);
        cursorX += doc.getTextWidth(p.sub) + 1.2;
      }
    }
  });
  doc.setFont("helvetica", "normal"); doc.setTextColor(20, 20, 20);
  return y + fontSize * 1.5;
}

// Lista "Donde: ..." — símbolos con subíndice real + descripción, con buen
// interlineado. `vars`: arreglo de objetos SIM {key, v, sub, desc}.
// Si una línea de descripción contiene el texto literal "A_NUL" (como en la
// nota de A_NUL sobre instalación externa), lo dibuja con subíndice real en
// vez de como texto plano.
function dibujarLineaConSimbolo(doc, x, y, linea, fontSize) {
  const idx = linea.indexOf("A_NUL");
  if (idx === -1) { doc.text(linea, x, y); return; }
  const antes = linea.slice(0, idx);
  const despues = linea.slice(idx + 5);
  let cx = x;
  doc.setFont("helvetica", "normal"); doc.setFontSize(fontSize);
  if (antes) { doc.text(antes, cx, y); cx += doc.getTextWidth(antes); }
  doc.setFont("helvetica", "italic");
  doc.text("A", cx, y);
  let wv = doc.getTextWidth("A");
  const fSub = fontSize * 0.62;
  doc.setFontSize(fSub);
  doc.text("NUL", cx + wv + 0.5, y + fSub * 0.5);
  wv += doc.getTextWidth("NUL") + 1.5;
  doc.setFontSize(fontSize);
  cx += wv;
  doc.setFont("helvetica", "normal");
  if (despues) doc.text(despues, cx, y);
}

// Versión genérica: dibuja UNA línea de texto plano, reemplazando la primera
// aparición literal de `marcador` (ej. "d_total") por el símbolo SIM
// correspondiente con subíndice real (v + sub), en vez de texto plano.
function dibujarLineaConSimboloGenerico(doc, x, y, linea, fontSize, marcador, sim) {
  const idx = linea.indexOf(marcador);
  if (idx === -1) { doc.text(linea, x, y); return; }
  const antes = linea.slice(0, idx);
  const despues = linea.slice(idx + marcador.length);
  let cx = x;
  doc.setFont("helvetica", "normal"); doc.setFontSize(fontSize);
  // +2.5pt de margen fijo: jsPDF subestima getTextWidth() cuando el texto
  // anterior contiene comillas rectas (ej. Zona "Torre A", ), por kerning
  // interno inconsistente entre medición y render — sin esto, el símbolo
  // queda pegado al texto previo. Confirmado con pruebas visuales 04/08/2026.
  if (antes) { doc.text(antes, cx, y); cx += doc.getTextWidth(antes) + 2.5; }
  doc.setFont("helvetica", "italic");
  doc.text(sim.v, cx, y);
  let wv = doc.getTextWidth(sim.v);
  const fSub = fontSize * 0.62;
  doc.setFontSize(fSub);
  doc.text(sim.sub, cx + wv + 0.5, y + fSub * 0.5);
  wv += doc.getTextWidth(sim.sub) + 1.5;
  doc.setFontSize(fontSize);
  cx += wv;
  doc.setFont("helvetica", "normal");
  if (despues) doc.text(despues, cx, y);
}

// Dibuja un párrafo completo (con ajuste de línea) reemplazando cada
// aparición literal de `marcador` por su símbolo SIM con subíndice real.
// Devuelve la nueva posición Y, con el mismo interlineado (13pt) que el
// resto de párrafos de la Memoria de Cálculo.
function dibujarParrafoConSimbolo(doc, x, y, texto, fontSize, maxWidth, marcador, sim) {
  const lineas = doc.splitTextToSize(texto, maxWidth);
  lineas.forEach((linea, i) => dibujarLineaConSimboloGenerico(doc, x, y + i * 13, linea, fontSize, marcador, sim));
  return y + lineas.length * 13;
}

// Igual que dibujarLineaConSimboloGenerico, pero soporta VARIOS marcadores
// distintos en la misma línea (ej. "d_total" y "N_VUELTAS" en el mismo texto
// de ejemplo), reemplazando cada uno por su símbolo con subíndice real.
// `marcadores`: [{marcador, sim}, ...].
function dibujarLineaConSimbolosMultiples(doc, x, y, linea, fontSize, marcadores) {
  let mejorIdx = -1, mejor = null;
  marcadores.forEach((m) => {
    const idx = linea.indexOf(m.marcador);
    if (idx !== -1 && (mejorIdx === -1 || idx < mejorIdx)) { mejorIdx = idx; mejor = m; }
  });
  if (mejorIdx === -1) { doc.text(linea, x, y); return; }
  const antes = linea.slice(0, mejorIdx);
  const despues = linea.slice(mejorIdx + mejor.marcador.length);
  let cx = x;
  doc.setFont("helvetica", "normal"); doc.setFontSize(fontSize);
  // Mismo margen fijo de +2.5pt que dibujarLineaConSimboloGenerico (ver
  // comentario ahí) — necesario acá también porque esta línea también puede
  // empezar con `Zona "..."`.
  if (antes) { doc.text(antes, cx, y); cx += doc.getTextWidth(antes) + 2.5; }
  doc.setFont("helvetica", "italic");
  doc.text(mejor.sim.v, cx, y);
  let wv = doc.getTextWidth(mejor.sim.v);
  const fSub = fontSize * 0.62;
  doc.setFontSize(fSub);
  doc.text(mejor.sim.sub, cx + wv + 0.5, y + fSub * 0.5);
  wv += doc.getTextWidth(mejor.sim.sub) + 1.5;
  doc.setFontSize(fontSize);
  cx += wv;
  doc.setFont("helvetica", "normal");
  if (despues) dibujarLineaConSimbolosMultiples(doc, cx, y, despues, fontSize, marcadores);
}
function dibujarParrafoConSimbolos(doc, x, y, texto, fontSize, maxWidth, marcadores) {
  const lineas = doc.splitTextToSize(texto, maxWidth);
  lineas.forEach((linea, i) => dibujarLineaConSimbolosMultiples(doc, x, y + i * 13, linea, fontSize, marcadores));
  return y + lineas.length * 13;
}

// Igual que dibujarLineaConSimbolosMultiples, pero mide el ancho renderizado
// sin dibujar nada (misma lógica de offsets que la versión que sí dibuja) —
// necesario para calcular cuánto espacio extra repartir entre palabras al
// justificar.
function anchoConSimbolosMultiples(doc, texto, fontSize, marcadores) {
  let mejorIdx = -1, mejor = null;
  marcadores.forEach((m) => {
    const idx = texto.indexOf(m.marcador);
    if (idx !== -1 && (mejorIdx === -1 || idx < mejorIdx)) { mejorIdx = idx; mejor = m; }
  });
  doc.setFont("helvetica", "normal"); doc.setFontSize(fontSize);
  if (mejorIdx === -1) return doc.getTextWidth(texto);
  const antes = texto.slice(0, mejorIdx);
  const despues = texto.slice(mejorIdx + mejor.marcador.length);
  let w = 0;
  if (antes) w += doc.getTextWidth(antes) + 2.5;
  doc.setFont("helvetica", "italic");
  w += doc.getTextWidth(mejor.sim.v);
  const fSub = fontSize * 0.62;
  doc.setFontSize(fSub);
  w += doc.getTextWidth(mejor.sim.sub) + 1.5;
  doc.setFontSize(fontSize);
  doc.setFont("helvetica", "normal");
  if (despues) w += anchoConSimbolosMultiples(doc, despues, fontSize, marcadores);
  return w;
}

// Igual que dibujarLineaConSimbolosMultiples, pero devuelve el ancho que
// dibujó (necesario para el justificado palabra por palabra: avanzar el
// cursor la cantidad exacta dibujada + el espacio extra calculado).
function dibujarLineaConSimbolosMultiplesAncho(doc, x, y, linea, fontSize, marcadores) {
  let mejorIdx = -1, mejor = null;
  marcadores.forEach((m) => {
    const idx = linea.indexOf(m.marcador);
    if (idx !== -1 && (mejorIdx === -1 || idx < mejorIdx)) { mejorIdx = idx; mejor = m; }
  });
  doc.setFont("helvetica", "normal"); doc.setFontSize(fontSize);
  if (mejorIdx === -1) { doc.text(linea, x, y); return doc.getTextWidth(linea); }
  const antes = linea.slice(0, mejorIdx);
  const despues = linea.slice(mejorIdx + mejor.marcador.length);
  let cx = x;
  if (antes) { doc.text(antes, cx, y); cx += doc.getTextWidth(antes) + 2.5; }
  doc.setFont("helvetica", "italic");
  doc.text(mejor.sim.v, cx, y);
  let wv = doc.getTextWidth(mejor.sim.v);
  const fSub = fontSize * 0.62;
  doc.setFontSize(fSub);
  doc.text(mejor.sim.sub, cx + wv + 0.5, y + fSub * 0.5);
  wv += doc.getTextWidth(mejor.sim.sub) + 1.5;
  doc.setFontSize(fontSize);
  cx += wv;
  doc.setFont("helvetica", "normal");
  if (despues) cx += dibujarLineaConSimbolosMultiplesAncho(doc, cx, y, despues, fontSize, marcadores);
  return cx - x;
}

// Como dibujarParrafoConSimbolos, pero justifica cada línea (excepto la
// última del párrafo, igual que {align:"justify"} en el resto de la
// Memoria) repartiendo el espacio extra entre las palabras — palabra por
// palabra, porque el texto tiene símbolos con subíndice incrustados que
// jsPDF no puede justificar de forma nativa con splitTextToSize + align.
// Usada en Collar Metálico CP 648-ER y Putty Pad CP 617 (a pedido de
// Kevin); CFS-BL y Cinta CP 648-E se dejan sin justificar por ahora.
function dibujarParrafoConSimbolosJustificado(doc, x, y, texto, fontSize, maxWidth, marcadores) {
  const lineas = doc.splitTextToSize(texto, maxWidth);
  lineas.forEach((linea, i) => {
    const esUltimaLinea = i === lineas.length - 1;
    const palabras = linea.split(" ").filter(p => p.length > 0);
    doc.setFont("helvetica", "normal"); doc.setFontSize(fontSize);
    if (esUltimaLinea || palabras.length < 2) {
      dibujarLineaConSimbolosMultiplesAncho(doc, x, y + i * 13, linea, fontSize, marcadores);
      return;
    }
    const espacioNormal = doc.getTextWidth(" ");
    const anchoPalabras = palabras.reduce((acc, p) => acc + anchoConSimbolosMultiples(doc, p, fontSize, marcadores), 0);
    const numEspacios = palabras.length - 1;
    const extra = maxWidth - (anchoPalabras + espacioNormal * numEspacios);
    const espacio = extra > 0 ? espacioNormal + extra / numEspacios : espacioNormal;
    let cx = x;
    palabras.forEach((palabra) => {
      const w = dibujarLineaConSimbolosMultiplesAncho(doc, cx, y + i * 13, palabra, fontSize, marcadores);
      cx += w + espacio;
    });
  });
  return y + lineas.length * 13;
}

function dibujarListaVariables(doc, x, y, vars, valores, maxWidth) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(MC_BODY);
  doc.setTextColor(20, 20, 20);
  doc.text("Donde:", x, y);
  y += 15;
  const fSub = MC_BODY * 0.62;
  vars.forEach(item => {
    const esObj = typeof item === "object";
    const key = esObj ? item.key : item;
    const desc = (esObj && item.desc) || MEMORIA_VARIABLES_SIMBOLO[key] || key;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(MC_BODY);
    doc.setTextColor(20, 20, 20);
    doc.text("•  ", x + 4, y);
    let cursorX = x + 4 + doc.getTextWidth("•  ");
    if (esObj) {
      doc.text(item.v, cursorX, y);
      cursorX += doc.getTextWidth(item.v);
      if (item.sub) {
        doc.setFontSize(fSub);
        doc.text(item.sub, cursorX + 0.5, y + fSub * 0.5);
        cursorX += doc.getTextWidth(item.sub) + 1.5;
        doc.setFontSize(MC_BODY);
      }
    } else {
      doc.text(key, cursorX, y);
      cursorX += doc.getTextWidth(key);
    }
    if (valores && valores[key] !== undefined) {
      const igual = ` = ${valores[key]}`;
      doc.setFont("helvetica", "italic");
      doc.text(igual, cursorX, y);
      cursorX += doc.getTextWidth(igual);
    }
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    const resto = doc.splitTextToSize("  —  " + desc, (maxWidth || 480) - (cursorX - x));
    resto.forEach((linea, i) => dibujarLineaConSimbolo(doc, cursorX, y + i * 13.5, linea, MC_BODY));
    y += 13.5 * resto.length;
  });
  doc.setTextColor(20, 20, 20);
  return y + 4;
}

// Portada de la Memoria de Cálculo — mismo estilo que la portada del
// Submittal, dibujada sobre la página actual del documento (no crea un PDF
// aparte, ya que la Memoria es un solo documento jsPDF de principio a fin).
function dibujarPortadaMemoria(doc, marginL) {
  const safe = dibujarLetterheadPDF(doc, "");
  let y = safe.top + 40;

  doc.setTextColor(226, 0, 26);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.text("MEMORIA DE CÁLCULO", marginL, y);
  y += 26;
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(15);
  doc.text("Sellos Cortafuego — Cuantificación y Fórmulas de Diseño", marginL, y);
  y += 40;

  doc.setDrawColor(226, 0, 26);
  doc.setLineWidth(1.2);
  doc.line(marginL, y, 552, y);
  y += 30;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  [
    ["Proyecto", PROJECT_INFO.nombre || "—"],
    ["Cliente", PROJECT_INFO.cliente || "—"],
    ["Fecha", fechaLegible(PROJECT_INFO.fecha) || "—"],
  ].forEach(([label, valor]) => {
    doc.setFont("helvetica", "bold");
    doc.text(label + ":", marginL, y);
    doc.setFont("helvetica", "normal");
    doc.text(valor, marginL + 90, y);
    y += 20;
  });
  y += 20;

  doc.setFontSize(10.5);
  doc.setTextColor(50, 50, 50);
  const intro = "SUPERBA S.A., cédula jurídica # 3-101-011224-27, presenta de parte del Departamento de Ingeniería la presente Memoria de Cálculo de sellos cortafuego para el proyecto indicado arriba: las fórmulas de diseño empleadas, con la nomenclatura de variables estándar, y un ejemplo de cálculo con datos reales del levantamiento para cada material Hilti utilizado.";
  doc.text(intro, marginL, y, { maxWidth: 492, lineHeightFactor: 1.4 });
  y += 90;

  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  doc.text("Este documento se agradece, y para dudas adicionales quedamos a las órdenes.", marginL, y);
  y += 40;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("Superba | La Uruca, San José, Costa Rica", marginL, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(90, 90, 90);
  doc.text("(+506) 4040-0944  ·  WhatsApp 8332-1044  ·  info@superba.co.cr", marginL, y);
}

// "» Resultado: " en negro + un símbolo SIM con subíndice real (ej. V_SELLO)
// + el resto del texto en gris, con ajuste de línea si hace falta.
function dibujarResultadoConSimbolo(doc, x, y, sim, textoResto, fontSize, maxWidth) {
  doc.setFont("helvetica", "bold"); doc.setFontSize(fontSize); doc.setTextColor(20, 20, 20);
  doc.text("» Resultado: ", x, y);
  let cursorX = x + doc.getTextWidth("» Resultado: ");
  if (sim) {
    doc.setFont("helvetica", "normal");
    doc.text(sim.v, cursorX, y);
    let wv = doc.getTextWidth(sim.v);
    if (sim.sub) {
      const fSub = fontSize * 0.62;
      doc.setFontSize(fSub);
      doc.text(sim.sub, cursorX + wv + 0.5, y + fSub * 0.5);
      wv += doc.getTextWidth(sim.sub) + 1.5;
      doc.setFontSize(fontSize);
    }
    cursorX += wv;
  }
  doc.setFont("helvetica", "normal"); doc.setTextColor(80, 80, 80);
  const lineas = doc.splitTextToSize(textoResto, maxWidth - (cursorX - x));
  doc.text(textoResto, cursorX, y, { align: "justify", maxWidth: maxWidth - (cursorX - x) });
  doc.setTextColor(20, 20, 20);
  return y + Math.max(lineas.length * 13, 13) + 20;
}

function construirMemoriaCalculoPDF() {
  const computed = computeAllRows().filter(tieneDatosMinimos);
  const computedJ = computeAllJuntaRows().filter(tieneDatosMinimosJunta);
  if (computed.length === 0 && computedJ.length === 0) return null;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const marginL = 40;
  const anchoContenido = 532;
  const titulo = "Memoria de Cálculo — Sello Cortafuego";

  dibujarPortadaMemoria(doc, marginL);
  doc.addPage();

  const safe = dibujarLetterheadPDF(doc, titulo);
  const tableMargin = { left: marginL, right: marginL, top: safe.top, bottom: 792 - safe.bottom };
  const dibujarCabecera = () => dibujarLetterheadPDF(doc, titulo);
  let y = safe.top;

  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(90, 90, 90);
  doc.text(`Proyecto: ${PROJECT_INFO.nombre || "—"}    Cliente: ${PROJECT_INFO.cliente || "—"}    Fecha: ${fechaLegible(PROJECT_INFO.fecha) || "—"}`, marginL, y);
  y += 24;

  const saltoDePaginaSiHaceFalta = (minimo) => {
    if (y > safe.bottom - minimo) { doc.addPage(); dibujarCabecera(); y = safe.top; }
  };

  // ---------------- PENETRANTES ----------------
  if (computed.length > 0) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(MC_TITULO_MAT); doc.setTextColor(20, 20, 20);
    doc.text("Metodología — Penetrantes", marginL, y); y += 22;
    doc.setFont("helvetica", "normal"); doc.setFontSize(MC_BODY); doc.setTextColor(80, 80, 80);
    const metodologia = "Para cada tipo de penetrante se verifica el producto correspondiente para realizar el sello cortafuego en base a una serie de conjuntos de montaje (Sistemas UL). A partir de esta información, se define para cada tipo de producto la metodología de cálculo definiendo: área de sellador, espesores de producto, área de cobertura, volúmenes de producto y cantidad de producto; esto según corresponda a cada tipo de producto.";
    const linesMeta = doc.splitTextToSize(metodologia, anchoContenido);
    doc.text(metodologia, marginL, y, { align: "justify", maxWidth: anchoContenido,  lineHeightFactor: 1.35  }); y += linesMeta.length * 13 + 20;
    doc.setTextColor(20, 20, 20);

    const gruposP = {};
    computed.forEach(r => { if (!r.P) return; (gruposP[r.P] = gruposP[r.P] || []).push(r); });

    // Pasta FS ONE MAX puede aparecer como material complementario aunque
    // ninguna fila la tenga elegida como material principal — por ejemplo,
    // Cinta con Collar en tubería combustible >2" (requiere un poco de pasta
    // en el sistema UL), o Almohadilla CFS-BL en bandejas (sella el
    // perímetro con pasta). Se arma por separado usando cualquier fila que
    // genere volumen de pasta real (Y > 0), no solo las que la eligieron
    // como material principal.
    const filasConPasta = computed.filter(r => n(r.Y) > 0);
    if (filasConPasta.length > 0) gruposP["Pasta FS ONE MAX"] = filasConPasta;

    const ordenProductos = Object.keys(gruposP);
    const idxPasta = ordenProductos.indexOf("Pasta FS ONE MAX");
    if (idxPasta > 0) { ordenProductos.splice(idxPasta, 1); ordenProductos.unshift("Pasta FS ONE MAX"); }

    // Cinta con/sin collar CP 648-E ya tienen su propia sección dedicada más
    // abajo ("Cinta Intumescente CP 648-E", con la tabla oficial del Word y
    // N_VUELTAS reales) — se excluyen acá para no duplicar el material con el
    // bloque genérico U/V/S (que además usaba fórmulas que no aplican a cinta).
    const PRODUCTOS_CON_SECCION_PROPIA = [MAT_CINTA_CON, MAT_CINTA_SIN, MAT_ALMOHADILLA, MAT_PUTTY, MAT_ESPUMA, MAT_MORTERO, MAT_MANGA, MAT_MSL_M, MAT_MSL_L];
    const ordenProductosFiltrado = ordenProductos.filter(p => !PRODUCTOS_CON_SECCION_PROPIA.includes(p));

    // Índice de productos: lista todo lo que va a aparecer en esta Memoria
    // (tanto los del bloque genérico como los que tienen sección propia más
    // abajo), en el mismo orden en que se van a mostrar.
    const listaProductosIndice = [...ordenProductosFiltrado];
    const filasLanaIdx = computed.some(r => n(r.lanaAreaCm2Pen) > 0 || n(r.lanaVolumenCm3Pen) > 0);
    if (filasLanaIdx) listaProductosIndice.push("Lana Mineral");
    if (computed.some(r => r.cintaLongitudPen !== "-" && r.cintaLongitudPen !== null && n(r.cintaLongitudPen) > 0)) listaProductosIndice.push("Cinta Intumescente CP 648-E");
    if (computed.some(r => r.collarLongitudPen !== "-" && r.collarLongitudPen !== null && n(r.collarLongitudPen) > 0)) listaProductosIndice.push("Collar Metálico CP 648-ER");
    if (computed.some(r => n(r.AD) > 0)) listaProductosIndice.push("Almohadilla CFS-BL");
    if (computed.some(r => n(r.AB) > 0)) listaProductosIndice.push("Putty Pad CP 617");
    if (computed.some(r => n(r.AC) > 0)) listaProductosIndice.push("Espuma CP 620");
    if (computed.some(r => n(r.AK) > 0)) listaProductosIndice.push("Mortero CP 637");
    if (computed.some(r => n(r.AE) > 0 || n(r.AF) > 0 || n(r.AG) > 0)) listaProductosIndice.push("Manga CP 653 y Paso de Cables MSL");

    doc.setFont("helvetica", "normal"); doc.setFontSize(MC_BODY); doc.setTextColor(80, 80, 80);
    doc.text("A continuación se muestra el listado de productos cortafuego Hilti presentes en el proyecto:", marginL, y);
    y += 20;
    doc.setTextColor(20, 20, 20);

    doc.autoTable({
      startY: y,
      margin: tableMargin,
      head: [["#", "Producto"]],
      body: listaProductosIndice.map((p, i) => [String(i + 1), p]),
      styles: { fontSize: MC_TABLA, cellPadding: 3.5, halign: "left" },
      columnStyles: { 0: { halign: "center", cellWidth: 30 } },
      headStyles: { fillColor: [26, 26, 26], textColor: 255, fontStyle: "normal" },
      didDrawPage: () => dibujarCabecera(),
    });
    y = doc.lastAutoTable.finalY + 26;

    ordenProductosFiltrado.forEach(producto => {
      const filas = gruposP[producto];
      const formulaDef = MEMORIA_FORMULAS_PENETRANTES[producto];
      // Todos los productos, incluida Pasta FS ONE MAX, empiezan en página
      // nueva — ahora que "Metodología — Penetrantes" cierra con la tabla de
      // índice, ya no hace falta que FS ONE MAX vaya pegado a la metodología.
      doc.addPage(); dibujarCabecera(); y = safe.top;
      doc.setFont("helvetica", "bold"); doc.setFontSize(MC_TITULO_MAT); doc.setTextColor(226, 0, 26);
      doc.text(producto, marginL, y); y += 24;
      doc.setTextColor(20, 20, 20);

      if (formulaDef) {
        y = dibujarFormulaCompleta(doc, marginL, y, formulaDef.resultadoSim || formulaDef.resultado, formulaDef.tokens, anchoContenido);
        y += 6;
        if (formulaDef.nota) {
          doc.setFont("helvetica", "italic"); doc.setFontSize(MC_BODY); doc.setTextColor(120, 120, 120);
          const lineasNota = doc.splitTextToSize(formulaDef.nota, anchoContenido);
          doc.text(formulaDef.nota, marginL, y, { align: "justify", maxWidth: anchoContenido,  lineHeightFactor: 1.35  }); y += lineasNota.length * 13 + 10;
          doc.setFont("helvetica", "normal"); doc.setTextColor(20, 20, 20);
        }
        y = dibujarListaVariables(doc, marginL, y, formulaDef.vars, null, anchoContenido);
        y += 16;
      } else {
        doc.setFont("helvetica", "normal"); doc.setFontSize(MC_BODY); doc.setTextColor(80, 80, 80);
        const lineasDesc = doc.splitTextToSize(MEMORIA_NOTA_CINTA, anchoContenido);
        doc.text(MEMORIA_NOTA_CINTA, marginL, y, { align: "justify", maxWidth: anchoContenido,  lineHeightFactor: 1.35  }); y += lineasDesc.length * 13 + 14;
        doc.setTextColor(20, 20, 20);
      }

      const usaDesgloseU = formulaDef && MEMORIA_PRODUCTOS_CON_DESGLOSE_U.includes(producto);
      const campoVol = CAMPO_VOLUMEN_SELLO_PENETRANTE[producto] || "Y";

      if (usaDesgloseU) {
        doc.setFont("helvetica", "italic"); doc.setFontSize(MC_BODY); doc.setTextColor(120, 120, 120);
        const notaU = "El área de sello se calcula distinto según la geometría del penetrante. A continuación, el desglose paso a paso de cada caso presente en este proyecto.";
        const lsNotaU = doc.splitTextToSize(notaU, anchoContenido);
        doc.text(notaU, marginL, y, { align: "justify", maxWidth: anchoContenido }); y += lsNotaU.length * 13 + 18;
        doc.setFont("helvetica", "normal"); doc.setTextColor(20, 20, 20);

        const subgrupos = {};
        filas.forEach(r => { const sc = clasificarSubcasoU(r); (subgrupos[sc] = subgrupos[sc] || []).push(r); });

        Object.keys(subgrupos).forEach(subcaso => {
          const subFilas = subgrupos[subcaso];
          const cfg = MEMORIA_SUBCASOS_U[subcaso];
          const todasLasVars = [];
          const vistas = new Set();
          cfg.formulas.forEach(f => f.vars.forEach(v => { if (!vistas.has(v.key)) { vistas.add(v.key); todasLasVars.push(v); } }));
          // Estimado generoso: título + cadena de fórmulas + "Donde:" + todo
          // el ejemplo (misma cadena sustituida + fórmula de V_SELLO + línea
          // de resultado) — hasta justo antes de la tabla, que ya maneja su
          // propio salto de página con autoTable.
          const nF = cfg.formulas.length;
          const minimoSubcaso = 230 + nF * 76 + todasLasVars.length * 26;
          saltoDePaginaSiHaceFalta(minimoSubcaso);
          doc.setFont("helvetica", "bold"); doc.setFontSize(MC_TITULO_SUB); doc.setTextColor(20, 20, 20);
          doc.text(cfg.titulo, marginL, y); y += 22;

          cfg.formulas.forEach(f => {
            y = dibujarFormulaCompleta(doc, marginL, y, f.resultadoSim, f.tokens, anchoContenido);
            if (f.nota) {
              y = dibujarNotaConSimbolo(doc, marginL, y, [mvs("ANUL"), " = 0 (no se midió espacio anular), se usa 2 × 1/2\" en su lugar."], MC_BODY - 1);
            }
          });
          y += 6;
          y = dibujarListaVariables(doc, marginL, y, todasLasVars, null, anchoContenido);
          y += 12;

          const ejS = subFilas[0];
          doc.setFont("helvetica", "bold"); doc.setFontSize(MC_BODY + 0.5); doc.setTextColor(20, 20, 20);
          doc.text("Ejemplo de cálculo", marginL, y); y += 15;
          doc.setFont("helvetica", "normal"); doc.setFontSize(MC_BODY); doc.setTextColor(80, 80, 80);
          const dimTxtS = ejS.F !== "" ? `${ejS.F}×${ejS.G} cm` : formatFraccionPulgadas(ejS.D);
          const lineaCasoS = `Zona "${ejS.A || "—"}", ${TIPO_LABEL_CORTO[ejS.L] || ejS.L}, dimensión ${dimTxtS}, espacio anular ${formatFraccionPulgadas(ejS.I)}, barrera ${ejS.M}/${ejS.N}, F Rating ${ejS.O}.`;
          const lsCasoS = doc.splitTextToSize(lineaCasoS, anchoContenido);
          doc.text(lineaCasoS, marginL, y, { align: "justify", maxWidth: anchoContenido }); y += lsCasoS.length * 13 + 16;
          doc.setTextColor(20, 20, 20);

          const valoresEjS = {};
          const unidadPorKey = { "A_SELLO": "cm2" };
          cfg.columnas.forEach(col => {
            valoresEjS[col.key] = String(col.getEjemplo ? col.getEjemplo(ejS) : col.get(ejS));
            const mUnidad = col.header.match(/\(([^)]+)\)/);
            if (mUnidad) unidadPorKey[col.key] = col.getEjemplo ? "cm" : mUnidad[1];
          });
          valoresEjS["A_SELLO"] = ejS.A_SELLO !== "-" ? fmtComa(ejS.A_SELLO, 1) : "—";
          // Algunos resultados intermedios de la cadena (ej. A_PAS en Ducto
          // Rectangular) no van en la tabla de columnas, pero sí se usan como
          // operando de la fórmula siguiente — hay que completarlos también.
          const CAMPO_POR_SIMKEY = {
            "d_total": "D_TOTAL", "A_PEN": "A_PEN", "A_PAS": "A_PAS", "A_DUCT": "A_DUCT",
            "A_VIGA": "A_VIGA", "P_VIGA": "P_VIGA", "DA_TOTAL": "DA_TOTAL", "DB_TOTAL": "DB_TOTAL",
          };
          cfg.formulas.forEach(f => {
            const key = f.resultadoSim[0].key;
            if (valoresEjS[key] !== undefined) return;
            const campo = CAMPO_POR_SIMKEY[key];
            if (campo && ejS[campo] !== undefined && ejS[campo] !== "-") {
              valoresEjS[key] = fmtComa(ejS[campo], 2);
              if (!unidadPorKey[key]) unidadPorKey[key] = /^A_/.test(key) ? "cm2" : "cm";
            }
          });

          const tokensConUnidad = (valorTexto, unidad) => {
            if (!unidad || /["%]$/.test(valorTexto)) return [mc(valorTexto)];
            if (unidad === "cm2") return [mc(valorTexto + " "), mc("cm", SQ)];
            if (unidad === "cm3") return [mc(valorTexto + " "), mc("cm", "3")];
            return [mc(valorTexto + " " + unidad)];
          };

          cfg.formulas.forEach(f => {
            const key = f.resultadoSim[0].key;
            const valorFinal = tokensConUnidad(valoresEjS[key], unidadPorKey[key]);
            y = dibujarFormulaEjemplo(doc, marginL, y, f.resultadoSim, f.tokens, valoresEjS, valorFinal, anchoContenido);
          });
          y += 6;

          // Fórmula final V_SELLO del ejemplo — A_SELLO ya calculado arriba,
          // más espesor de sellador (en cm), lados, cantidad y % desperdicio
          // de esta fila en particular.
          const vSelloTxt = ejS[campoVol] !== "-" && ejS[campoVol] !== undefined ? fmtComa(ejS[campoVol], 1) : "0,0";
          if (formulaDef) {
            const valoresVSello = Object.assign({}, valoresEjS, {
              "A_SELLO": ejS.A_SELLO !== "-" ? fmtComa(ejS.A_SELLO, 1) : "—",
              "E_SELLO": ejS.V !== "-" ? fmtComa(Number(ejS.V) * 2.54, 2) : "—",
              "S_LADOS": String(ejS.S),
              "C_ANT": String(ejS.C),
              "%_DESP": fmtComa(n(CONFIG.C17) * 100, 0) + "%",
            });
            const valorFinalVSello = tokensConUnidad(vSelloTxt, "cm3");
            y = dibujarFormulaEjemplo(doc, marginL, y, formulaDef.resultadoSim, formulaDef.tokens, valoresVSello, valorFinalVSello, anchoContenido);
            y += 6;
          }

          const restoTxtS = ejS[campoVol] !== "-" && ejS[campoVol] !== undefined ? ` = ${vSelloTxt} cm3 para ${ejS.C} penetrante(s).` : " = 0 cm3 (no aplica para esta fila).";
          y = dibujarResultadoConSimbolo(doc, marginL, y, SIM.VSELLO, restoTxtS, MC_BODY + 0.5, anchoContenido);

          const headRow = ["Zona", "Nivel", "Cant.", "Tipo", ...cfg.columnas.map(c => c.header), "A_SELLO (cm2)", "E_SELLO (in)", "S_LADOS", "V_SELLO (cm3)"];
          doc.autoTable({
            startY: y,
            margin: tableMargin,
            head: [headRow],
            body: subFilas.map(r => [
              r.A || "-", r.B || "-", String(r.C), TIPO_LABEL_CORTO[r.L] || r.L,
              ...cfg.columnas.map(c => String(c.get(r))),
              r.A_SELLO !== "-" ? fmtComa(r.A_SELLO, 1) : "-",
              r.V !== "-" ? formatFraccionPulgadas(r.V) : "-",
              r.S !== "-" ? String(r.S) : "-",
              r[campoVol] !== "-" && r[campoVol] !== undefined ? fmtComa(r[campoVol], 1) : "—",
            ]),
            styles: { fontSize: MC_TABLA, cellPadding: 2.5, halign: "center" },
            headStyles: { fillColor: [26, 26, 26], textColor: 255, fontStyle: "normal" },
            didDrawPage: () => dibujarCabecera(),
            didDrawCell: (data) => {
              if (data.section !== "head") return;
              // El texto real (headRow) ya se dibujó y determinó bien el ancho
              // de columna — acá solo lo tapamos y lo re-dibujamos con el
              // símbolo en formato de subíndice real, centrado igual que los
              // valores de la tabla, sin arriesgar que se corra a la celda vecina.
              doc.setFillColor(26, 26, 26);
              doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, "F");
              const simKey = (headRow[data.column.index].match(/^[^\s(]+/) || [headRow[data.column.index]])[0];
              const mUnidad = headRow[data.column.index].match(/\(([^)]+)\)/);
              const unidad = mUnidad ? mUnidad[1] : null;
              const sim = Object.values(SIM).find(s => s.key === simKey);
              const cy = data.cell.y + data.cell.height / 2 + 2.5;
              doc.setTextColor(255, 255, 255);
              if (sim) {
                doc.setFont("helvetica", "normal"); doc.setFontSize(MC_TABLA);
                let anchoTotal = doc.getTextWidth(sim.v);
                if (sim.sub) { doc.setFontSize(MC_TABLA * 0.65); anchoTotal += doc.getTextWidth(sim.sub) + 1; doc.setFontSize(MC_TABLA); }
                let utxt = "";
                if (unidad) { utxt = " (" + (unidad === "cm2" ? "cm2" : unidad === "cm3" ? "cm3" : unidad) + ")"; doc.setFontSize(MC_TABLA * 0.85); anchoTotal += doc.getTextWidth(utxt); doc.setFontSize(MC_TABLA); }
                let cx = data.cell.x + (data.cell.width - anchoTotal) / 2;
                doc.setFont("helvetica", "normal"); doc.setFontSize(MC_TABLA);
                doc.text(sim.v, cx, cy);
                let wv = doc.getTextWidth(sim.v);
                if (sim.sub) {
                  doc.setFontSize(MC_TABLA * 0.65);
                  doc.text(sim.sub, cx + wv + 0.6, cy + 1.6);
                  wv += doc.getTextWidth(sim.sub) + 1;
                }
                if (unidad) {
                  doc.setFontSize(MC_TABLA * 0.85);
                  doc.text(utxt, cx + wv, cy);
                }
              } else {
                doc.setFont("helvetica", "normal"); doc.setFontSize(MC_TABLA);
                const w = doc.getTextWidth(headRow[data.column.index]);
                doc.text(headRow[data.column.index], data.cell.x + (data.cell.width - w) / 2, cy);
              }
              doc.setTextColor(20, 20, 20);
            },
          });
          y = doc.lastAutoTable.finalY + 26;
        });
      } else {
        const ej = filas[0];
        doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(20, 20, 20);
        doc.text("Ejemplo de cálculo:", marginL, y); y += 12;
        doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(50, 50, 50);
        const dimTxt = ej.F !== "" ? `${ej.F}×${ej.G}${ej.H !== "" ? "×" + ej.H : ""} cm` : formatFraccionPulgadas(ej.D);
        const lineaCaso = `Zona "${ej.A || "—"}", ${TIPO_LABEL_CORTO[ej.L] || ej.L}, dimensión ${dimTxt}, espacio anular ${formatFraccionPulgadas(ej.I)}, barrera ${ej.M}/${ej.N}, F Rating ${ej.O}.`;
        const lsCaso = doc.splitTextToSize(lineaCaso, anchoContenido);
        doc.text(lineaCaso, marginL, y, { align: "justify", maxWidth: anchoContenido }); y += lsCaso.length * 11 + 4;

        if (formulaDef) {
          const valoresEj = {
            U: ej.U !== "-" ? fmtComa(ej.U, 1) + " cm2" : "—",
            V: ej.V !== "-" ? String(ej.V).replace(".", ",") + " cm" : "—",
            T: ej.T !== "-" ? String(ej.T).replace(".", ",") + " cm" : "—",
            S: ej.S !== "-" ? String(ej.S) : "—",
            C: String(ej.C),
            S_LADOS: ej.S !== "-" ? String(ej.S) : "—",
            C_ANT: String(ej.C),
          };
          const valoresRelevantes = {};
          formulaDef.vars.forEach(sym => {
            const k = typeof sym === "object" ? sym.key : sym;
            if (valoresEj[k] !== undefined) valoresRelevantes[k] = valoresEj[k];
          });
          y = dibujarListaVariables(doc, marginL, y, formulaDef.vars, valoresRelevantes, anchoContenido);
          y += 6;
        }
        doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(20, 20, 20);
        doc.text("» Resultado: ", marginL, y);
        const wRes = doc.getTextWidth("» Resultado: ");
        doc.setFont("helvetica", "normal"); doc.setTextColor(50, 50, 50);
        const lsResultado = doc.splitTextToSize(detalleCalculoTexto(ej, true), anchoContenido - wRes);
        doc.text(detalleCalculoTexto(ej, true), marginL + wRes, y, { align: "justify", maxWidth: anchoContenido - wRes });
        y += Math.max(lsResultado.length * 11, 11) + 14;
        doc.setTextColor(20, 20, 20);

        doc.autoTable({
          startY: y,
          margin: tableMargin,
          head: [["Zona", "Nivel", "Cant.", "Tipo", "Dimensión", "Anular", "T (cm)", "U (cm2)", "Resultado del cálculo"]],
          body: filas.map(r => [
            r.A || "-", r.B || "-", String(r.C), TIPO_LABEL_CORTO[r.L] || r.L,
            r.F !== "" ? `${r.F}×${r.G} cm` : formatFraccionPulgadas(r.D),
            formatFraccionPulgadas(r.I),
            r.T !== "-" ? String(r.T).replace(".", ",") : "-",
            r.U !== "-" ? fmtComa(r.U, 1) : "-",
            detalleCalculoTexto(r, true),
          ]),
          styles: { fontSize: 6.5, cellPadding: 2.5, halign: "center" },
          headStyles: { fillColor: [26, 26, 26], textColor: 255 },
          columnStyles: { 8: { cellWidth: 160, halign: "left" } },
          didDrawPage: () => dibujarCabecera(),
        });
        y = doc.lastAutoTable.finalY + 26;
      }
    });

    // ---------------- LANA MINERAL ----------------
    const filasLana = computed.filter(r => n(r.lanaAreaCm2Pen) > 0 || n(r.lanaVolumenCm3Pen) > 0);
    if (filasLana.length > 0) {
      doc.addPage(); dibujarCabecera(); y = safe.top;
      doc.setFont("helvetica", "bold"); doc.setFontSize(MC_TITULO_MAT); doc.setTextColor(226, 0, 26);
      doc.text("Lana Mineral", marginL, y); y += 24;
      doc.setTextColor(20, 20, 20);
      doc.setFont("helvetica", "normal"); doc.setFontSize(MC_BODY); doc.setTextColor(80, 80, 80);
      const introLana = "Refuerzo de lana mineral en el espacio anular — se calcula por ÁREA cuando la pared es delgada, y por VOLUMEN cuando es gruesa (más profundidad de cavidad que sellar). A_SELLO es el mismo que se calculó arriba, en Pasta FS ONE MAX. El resultado de cada fila es la cantidad de planchas SIN redondear — el % de desperdicio y el redondeo hacia arriba se aplican una sola vez, sobre la suma de todas las filas del proyecto, en Cuantificación de Materiales.";
      const lsIntro = doc.splitTextToSize(introLana, anchoContenido);
      doc.text(introLana, marginL, y, { align: "justify", maxWidth: anchoContenido,  lineHeightFactor: 1.35  }); y += lsIntro.length * 13 + 20;
      doc.setTextColor(20, 20, 20);

      const gruposLana = [
        { titulo: "Pared con grosor menor a 5\" - Cálculo por área", filas: filasLana.filter(r => !r.esVolumenLana), esVolumen: false,
          tokens: [mfrac([mvs("ASELLO")], [mc("122 × 61")]), mop("×"), mvs("CANT")],
          vars: [SIM.ASELLO, SIM.CANT] },
        { titulo: "Paredes con espesor mayor a 5\" - Cálculo por volumen", filas: filasLana.filter(r => r.esVolumenLana), esVolumen: true,
          tokens: [mfrac([mvs("ASELLO"), mop("×"), mop("("), mvs("TESP"), mop("-"), mc("2"), mop("×"), mvs("ESELLO"), mop(")")], [mc("122 × 61 × 10")]), mop("×"), mvs("CANT")],
          vars: [SIM.ASELLO, SIM.TESP, SIM.ESELLO, SIM.CANT] },
      ];

      gruposLana.forEach(grupo => {
        if (grupo.filas.length === 0) return;
        saltoDePaginaSiHaceFalta(280);
        doc.setFont("helvetica", "bold"); doc.setFontSize(MC_TITULO_SUB); doc.setTextColor(20, 20, 20);
        doc.text(grupo.titulo, marginL, y); y += 22;
        y = dibujarFormulaCompleta(doc, marginL, y, [mc("Lana Mineral")], grupo.tokens, anchoContenido);
        y += 6;
        y = dibujarListaVariables(doc, marginL, y, grupo.vars, null, anchoContenido);
        y += 16;

        const ej = grupo.filas[0];
        doc.setFont("helvetica", "bold"); doc.setFontSize(MC_BODY + 0.5); doc.setTextColor(20, 20, 20);
        doc.text("Ejemplo de cálculo", marginL, y); y += 15;
        doc.setFont("helvetica", "normal"); doc.setFontSize(MC_BODY); doc.setTextColor(80, 80, 80);
        const dimTxtL = ej.F !== "" ? `${ej.F}×${ej.G} cm` : formatFraccionPulgadas(ej.D);
        const lineaCasoL = `Zona "${ej.A || "—"}", ${TIPO_LABEL_CORTO[ej.L] || ej.L}, dimensión ${dimTxtL}, barrera ${ej.M}/${ej.N}, T_ESP = ${fmtComa(ej.T, 2)} cm, cantidad ${ej.C}.`;
        const lsCasoL = doc.splitTextToSize(lineaCasoL, anchoContenido);
        doc.text(lineaCasoL, marginL, y, { align: "justify", maxWidth: anchoContenido }); y += lsCasoL.length * 13 + 16;
        doc.setTextColor(20, 20, 20);

        const valoresL = {
          "A_SELLO": ej.A_SELLO !== "-" ? fmtComa(ej.A_SELLO, 1) : "—",
          "T_ESP": fmtComa(ej.T, 2),
          "E_SELLO": ej.V !== "-" ? fmtComa(Number(ej.V) * 2.54, 2) : "—",
          "C_ANT": String(ej.C),
        };
        const valorFinalLana = [mc(fmtComa(ej.lanaUnidPen, 2))];
        y = dibujarFormulaEjemplo(doc, marginL, y, [mc("Lana Mineral")], grupo.tokens, valoresL, valorFinalLana, anchoContenido);
        y += 16;

        const headRowL = ["Zona", "Nivel", "Cant.", "Tipo", "T_ESP (cm)", "A_SELLO (cm2)", "Área (cm2)", "Volumen (cm3)", "Lana Mineral (und)"];
        doc.autoTable({
          startY: y,
          margin: tableMargin,
          head: [headRowL],
          body: grupo.filas.map(r => [
            r.A || "-", r.B || "-", String(r.C), TIPO_LABEL_CORTO[r.L] || r.L,
            fmtComa(r.T, 2),
            r.A_SELLO !== "-" ? fmtComa(r.A_SELLO, 1) : "-",
            grupo.esVolumen ? "-" : fmtComa(r.lanaAreaCm2Pen, 1),
            grupo.esVolumen ? fmtComa(r.lanaVolumenCm3Pen, 1) : "-",
            fmtComa(r.lanaUnidPen, 2),
          ]),
          styles: { fontSize: MC_TABLA, cellPadding: 2.5, halign: "center" },
          headStyles: { fillColor: [26, 26, 26], textColor: 255, fontStyle: "normal" },
          columnStyles: { 8: { fontStyle: "bold" } },
          didDrawPage: () => dibujarCabecera(),
          didDrawCell: (data) => {
            if (data.section !== "head") return;
            doc.setFillColor(26, 26, 26);
            doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, "F");
            const simKey = (headRowL[data.column.index].match(/^[^\s(]+/) || [headRowL[data.column.index]])[0];
            const mUnidad = headRowL[data.column.index].match(/\(([^)]+)\)/);
            const unidad = mUnidad ? mUnidad[1] : null;
            const sim = Object.values(SIM).find(s => s.key === simKey);
            const cx = data.cell.x + data.cell.width / 2;
            const cy = data.cell.y + data.cell.height / 2 + 2.5;
            doc.setTextColor(255, 255, 255);
            if (sim) {
              doc.setFont("helvetica", "normal"); doc.setFontSize(MC_TABLA);
              let anchoTotal = doc.getTextWidth(sim.v);
              if (sim.sub) { doc.setFontSize(MC_TABLA * 0.65); anchoTotal += doc.getTextWidth(sim.sub) + 1; doc.setFontSize(MC_TABLA); }
              let utxt = "";
              if (unidad) { utxt = " (" + unidad + ")"; doc.setFontSize(MC_TABLA * 0.85); anchoTotal += doc.getTextWidth(utxt); doc.setFontSize(MC_TABLA); }
              let dx = cx - anchoTotal / 2;
              doc.setFont("helvetica", "normal"); doc.setFontSize(MC_TABLA);
              doc.text(sim.v, dx, cy);
              let wv = doc.getTextWidth(sim.v);
              if (sim.sub) {
                doc.setFontSize(MC_TABLA * 0.65);
                doc.text(sim.sub, dx + wv + 0.6, cy + 1.6);
                wv += doc.getTextWidth(sim.sub) + 1;
              }
              if (unidad) { doc.setFontSize(MC_TABLA * 0.85); doc.text(utxt, dx + wv, cy); }
            } else {
              doc.setFont("helvetica", "normal"); doc.setFontSize(MC_TABLA);
              const w = doc.getTextWidth(headRowL[data.column.index]);
              doc.text(headRowL[data.column.index], cx - w / 2, cy);
            }
            doc.setTextColor(20, 20, 20);
          },
        });
        y = doc.lastAutoTable.finalY + 26;
      });
    }

    // ---------------- CINTA CP 648-E ----------------
    const filasCinta = computed.filter(r => r.cintaLongitudPen !== "-" && r.cintaLongitudPen !== null && n(r.cintaLongitudPen) > 0);
    if (filasCinta.length > 0) {
      doc.addPage(); dibujarCabecera(); y = safe.top;
      doc.setFont("helvetica", "bold"); doc.setFontSize(MC_TITULO_MAT); doc.setTextColor(226, 0, 26);
      doc.text("Cinta Intumescente CP 648-E", marginL, y); y += 24;
      doc.setTextColor(20, 20, 20);
      doc.setFont("helvetica", "normal"); doc.setFontSize(MC_BODY); doc.setTextColor(80, 80, 80);
      const introCinta = "Cinta intumescente que envuelve el penetrante, con o sin collar metálico de retención CP 648-ER (el collar se detalla aparte). El diámetro total (d_total) y el N° de vueltas según el sistema UL determinan cuánta cinta se necesita — " + MEMORIA_NOTA_CINTA;
      y = dibujarParrafoConSimbolo(doc, marginL, y, introCinta, MC_BODY, anchoContenido, "d_total", SIM.DTOTAL);
      y += 20;
      doc.setTextColor(20, 20, 20);

      y = dibujarFormulaCompleta(doc, marginL, y, [mvs("DTOTAL")], [mvs("DIAM"), mop("+"), mc("2"), mop("×"), mvs("AISL")], anchoContenido);
      y += 10;
      const tokensCinta = [mvs("LCINTA"), mop("×"), mvs("SLADOS"), mop("×"), mvs("CANT"), mop("×"), mop("("), mc("1"), mop("+"), mvs("DESP"), mop(")")];
      y = dibujarFormulaCompleta(doc, marginL, y, [mvs("LCTOTAL")], tokensCinta, anchoContenido);
      y += 6;
      const SIM_DTOTAL_CINTA = Object.assign({}, SIM.DTOTAL, { desc: "Diámetro total de penetrante" });
      y = dibujarListaVariables(doc, marginL, y, [SIM_DTOTAL_CINTA, SIM.NVUELTAS, SIM.LCINTA, SIM.SLADOS, SIM.CANT, SIM.DESP], null, anchoContenido);
      y += 16;

      // Tabla de referencia OFICIAL del documento (transcrita tal cual — "x" =
      // combinación diámetro/vueltas no listada por Hilti para ese sistema UL).
      saltoDePaginaSiHaceFalta(220);
      doc.setFont("helvetica", "bold"); doc.setFontSize(MC_TITULO_SUB); doc.setTextColor(20, 20, 20);
      doc.text("Tabla de longitud de cinta requerida CP 648-E", marginL, y); y += 22;
      const headRowRef = ["d_total (in)", "1 vuelta (cm)", "2 vueltas (cm)", "3 vueltas (cm)", "4 vueltas (cm)", "6 vueltas (cm)"];
      const TABLA_CINTA_REF = [
        ["1 1/2\"", "17,1", "36,8", "59,4", "x", "x"],
        ["2\"", "21,0", "45,1", "71,8", "x", "x"],
        ["3\"", "29,8", "62,2", "96,8", "134,9", "x"],
        ["4\"", "38,1", "77,2", "120,0", "166,7", "x"],
        ["6\"", "x", "111,8", "173,0", "236,2", "x"],
        ["8\"", "x", "x", "220,3", "299,1", "x"],
        ["10\"", "x", "x", "x", "367,0", "x"],
        ["12\"", "x", "x", "x", "431,8", "x"],
        ["14\"", "x", "x", "x", "496,6", "746,83"],
      ];
      doc.autoTable({
        startY: y,
        margin: tableMargin,
        head: [headRowRef],
        body: TABLA_CINTA_REF,
        styles: { fontSize: MC_TABLA, cellPadding: 3, halign: "center" },
        headStyles: { fillColor: [26, 26, 26], textColor: 255, fontStyle: "normal" },
        didDrawPage: () => dibujarCabecera(),
        didDrawCell: (data) => {
          if (data.section !== "head" || data.column.index !== 0) return;
          doc.setFillColor(26, 26, 26);
          doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, "F");
          const cx = data.cell.x + data.cell.width / 2, cy = data.cell.y + data.cell.height / 2 + 2.5;
          doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "normal"); doc.setFontSize(MC_TABLA);
          let anchoTotal = doc.getTextWidth(SIM.DTOTAL.v);
          doc.setFontSize(MC_TABLA * 0.65); anchoTotal += doc.getTextWidth(SIM.DTOTAL.sub) + 1; doc.setFontSize(MC_TABLA);
          const utxt = " (in)"; doc.setFontSize(MC_TABLA * 0.85); anchoTotal += doc.getTextWidth(utxt); doc.setFontSize(MC_TABLA);
          let dx = cx - anchoTotal / 2;
          doc.text(SIM.DTOTAL.v, dx, cy);
          let wv = doc.getTextWidth(SIM.DTOTAL.v);
          doc.setFontSize(MC_TABLA * 0.65); doc.text(SIM.DTOTAL.sub, dx + wv + 0.6, cy + 1.6); wv += doc.getTextWidth(SIM.DTOTAL.sub) + 1;
          doc.setFontSize(MC_TABLA * 0.85); doc.text(utxt, dx + wv, cy);
          doc.setTextColor(20, 20, 20);
        },
      });
      y = doc.lastAutoTable.finalY + 26;

      const ejC = filasCinta[0];
      const LcEjC = (typeof ejC.cintaNVueltas === "number")
        ? longitudCintaPorVueltas(ejC.cintaDTotal, ejC.cintaNVueltas)
        : longitudCintaMultiTira(ejC.cintaDTotal, ejC.cintaNVueltas);
      saltoDePaginaSiHaceFalta(200);
      doc.setFont("helvetica", "bold"); doc.setFontSize(MC_BODY + 0.5); doc.setTextColor(20, 20, 20);
      doc.text("Ejemplo de cálculo", marginL, y); y += 15;
      doc.setFont("helvetica", "normal"); doc.setFontSize(MC_BODY); doc.setTextColor(80, 80, 80);
      const lineaCasoC = `Zona "${ejC.A || "—"}", ${TIPO_LABEL_CORTO[ejC.L] || ejC.L}, ${ejC.cintaConCollar ? "con" : "sin"} collar metálico, d_total = ${fmtComa(ejC.cintaDTotal, 2)}", N_VUELTAS = ${ejC.cintaNVueltas}, barrera ${ejC.M}/${ejC.N}, cantidad ${ejC.C}.`;
      y = dibujarParrafoConSimbolos(doc, marginL, y, lineaCasoC, MC_BODY, anchoContenido, [
        { marcador: "d_total", sim: SIM.DTOTAL },
        { marcador: "N_VUELTAS", sim: SIM.NVUELTAS },
      ]);
      y += 16;
      doc.setTextColor(20, 20, 20);

      const valoresC = {
        "L_CINTA": LcEjC !== null ? fmtComa(LcEjC, 2) : "—",
        "S_LADOS": String(ejC.S),
        "C_ANT": String(ejC.C),
        "%_DESP": "0",
      };
      const valorFinalC = [mc(fmtComa(ejC.cintaLongitudPen, 1))];
      y = dibujarFormulaEjemplo(doc, marginL, y, [mvs("LCTOTAL")], tokensCinta, valoresC, valorFinalC, anchoContenido);
      y += 16;

      const headRowC = ["Zona", "Nivel", "Cant.", "Tipo", "Instalación", "Barrera", "Material", "d_total (in)", "N_VUELTAS", "L_CTOTAL (cm)"];
      doc.autoTable({
        startY: y,
        margin: tableMargin,
        head: [headRowC],
        body: filasCinta.map(r => [
          r.A || "-", r.B || "-", String(r.C), TIPO_LABEL_CORTO[r.L] || r.L,
          r.cintaConCollar ? "Con collar" : "Sin collar",
          r.M || "-",
          r.N || "-",
          fmtComa(r.cintaDTotal, 2),
          String(r.cintaNVueltas),
          fmtComa(r.cintaLongitudPen, 1),
        ]),
        styles: { fontSize: MC_TABLA, cellPadding: 2.5, halign: "center" },
        headStyles: { fillColor: [26, 26, 26], textColor: 255, fontStyle: "normal" },
        columnStyles: { 9: { fontStyle: "bold" } },
        didDrawPage: () => dibujarCabecera(),
        didDrawCell: (data) => {
          if (data.section !== "head") return;
          doc.setFillColor(26, 26, 26);
          doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, "F");
          const simKey = (headRowC[data.column.index].match(/^[^\s(]+/) || [headRowC[data.column.index]])[0];
          const mUnidad = headRowC[data.column.index].match(/\(([^)]+)\)/);
          const unidad = mUnidad ? mUnidad[1] : null;
          const sim = Object.values(SIM).find(s => s.key === simKey);
          const cx = data.cell.x + data.cell.width / 2;
          const cy = data.cell.y + data.cell.height / 2 + 2.5;
          doc.setTextColor(255, 255, 255);
          if (sim) {
            doc.setFont("helvetica", "normal"); doc.setFontSize(MC_TABLA);
            let anchoTotal = doc.getTextWidth(sim.v);
            if (sim.sub) { doc.setFontSize(MC_TABLA * 0.65); anchoTotal += doc.getTextWidth(sim.sub) + 1; doc.setFontSize(MC_TABLA); }
            let utxt = "";
            if (unidad) { utxt = " (" + unidad + ")"; doc.setFontSize(MC_TABLA * 0.85); anchoTotal += doc.getTextWidth(utxt); doc.setFontSize(MC_TABLA); }
            let dx = cx - anchoTotal / 2;
            doc.setFont("helvetica", "normal"); doc.setFontSize(MC_TABLA);
            doc.text(sim.v, dx, cy);
            let wv = doc.getTextWidth(sim.v);
            if (sim.sub) {
              doc.setFontSize(MC_TABLA * 0.65);
              doc.text(sim.sub, dx + wv + 0.6, cy + 1.6);
              wv += doc.getTextWidth(sim.sub) + 1;
            }
            if (unidad) { doc.setFontSize(MC_TABLA * 0.85); doc.text(utxt, dx + wv, cy); }
          } else {
            doc.setFont("helvetica", "normal"); doc.setFontSize(MC_TABLA);
            const w = doc.getTextWidth(headRowC[data.column.index]);
            doc.text(headRowC[data.column.index], cx - w / 2, cy);
          }
          doc.setTextColor(20, 20, 20);
        },
      });
      y = doc.lastAutoTable.finalY + 26;
    }

    // ---------------- COLLAR METÁLICO CP 648-ER ----------------
    const filasCollar = computed.filter(r => r.collarLongitudPen !== "-" && r.collarLongitudPen !== null && n(r.collarLongitudPen) > 0);
    if (filasCollar.length > 0) {
      doc.addPage(); dibujarCabecera(); y = safe.top;
      doc.setFont("helvetica", "bold"); doc.setFontSize(MC_TITULO_MAT); doc.setTextColor(226, 0, 26);
      doc.text("Collar Metálico CP 648-ER", marginL, y); y += 24;
      doc.setTextColor(20, 20, 20);
      doc.setFont("helvetica", "normal"); doc.setFontSize(MC_BODY); doc.setTextColor(80, 80, 80);
      const introCollar = "Collar metálico de retención que envuelve el penetrante ya forrado en cinta CP 648-E, para instalaciones \"Cinta con Collar\". Usa el mismo diámetro total (d_total) y N° de vueltas (N_VUELTAS) que la cinta, del mismo sistema UL — el collar queda dimensionado para el diámetro que deja la tubería ya envuelta en cinta. En instalaciones multi-tira (N_VUELTAS tipo \"2x4\" o \"3x6\"), se necesita un collar SEPARADO por cada tira — el resultado ya incluye esa cantidad de collares.";
      y = dibujarParrafoConSimbolosJustificado(doc, marginL, y, introCollar, MC_BODY, anchoContenido, [
        { marcador: "d_total", sim: SIM.DTOTAL },
        { marcador: "N_VUELTAS", sim: SIM.NVUELTAS },
      ]);
      y += 20;
      doc.setTextColor(20, 20, 20);

      const tokensCollar = [mvs("LCOLTUB"), mop("×"), mvs("SLADOS"), mop("×"), mvs("CANT"), mop("×"), mop("("), mc("1"), mop("+"), mvs("DESP"), mop(")")];
      const tokensLcoltub = [mpi(), mop("×"), mop("("), mvs("DTOTAL"), mop("+"), mc("2"), mop("×"), mvs("NVUELTAS"), mop("×"), mfrac([mc("3")], [mc("16")]), mop(")"), mop("+"), mc("2\"")];
      y = dibujarFormulaCompleta(doc, marginL, y, [mvs("LCOLTUB")], tokensLcoltub, anchoContenido);
      y += 10;
      y = dibujarFormulaCompleta(doc, marginL, y, [mvs("LCOLTOT")], tokensCollar, anchoContenido);
      y += 6;
      const SIM_DTOTAL_COLLAR = Object.assign({}, SIM.DTOTAL, { desc: "Diámetro total de penetrante" });
      y = dibujarListaVariables(doc, marginL, y, [SIM_DTOTAL_COLLAR, SIM.NVUELTAS, SIM.LCOLTUB, SIM.SLADOS, SIM.CANT, SIM.DESP], null, anchoContenido);
      y += 16;

      // Preferir un ejemplo con N_VUELTAS numérico (fórmula directa, más clara)
      // sobre uno multi-tira ("2x4"/"3x6"), si el proyecto tiene ambos casos.
      const ejZ = filasCollar.find((r) => typeof r.cintaNVueltas === "number") || filasCollar[0];
      saltoDePaginaSiHaceFalta(260);
      doc.setFont("helvetica", "bold"); doc.setFontSize(MC_BODY + 0.5); doc.setTextColor(20, 20, 20);
      doc.text("Ejemplo de cálculo", marginL, y); y += 15;
      doc.setFont("helvetica", "normal"); doc.setFontSize(MC_BODY); doc.setTextColor(80, 80, 80);
      const lineaCasoZ = `Zona "${ejZ.A || "—"}", ${TIPO_LABEL_CORTO[ejZ.L] || ejZ.L}, d_total = ${fmtComa(ejZ.cintaDTotal, 2)}", N_VUELTAS = ${ejZ.cintaNVueltas}, barrera ${ejZ.M}/${ejZ.N}, cantidad ${ejZ.C}.`;
      y = dibujarParrafoConSimbolos(doc, marginL, y, lineaCasoZ, MC_BODY, anchoContenido, [
        { marcador: "d_total", sim: SIM.DTOTAL },
        { marcador: "N_VUELTAS", sim: SIM.NVUELTAS },
      ]);
      y += 16;
      doc.setTextColor(20, 20, 20);

      const nvEjZ = ejZ.cintaNVueltas;
      const esMultiTiraEj = typeof nvEjZ !== "number";
      const tirasEj = esMultiTiraEj ? Number(String(nvEjZ).split("x")[0]) : 1;
      const vueltasParaEjemplo = esMultiTiraEj ? Number(String(nvEjZ).split("x")[1]) : nvEjZ;
      // Fórmula L_COLTUB es por UN collar/tira; en multi-tira el resultado final ya se
      // muestra multiplicado por la cantidad de tiras (2 o 3), igual que en la tabla.
      const LcoltubUnitEjZ = collarLongitud(ejZ.cintaDTotal, vueltasParaEjemplo);
      const LcoltubEjZ = tirasEj * LcoltubUnitEjZ;

      const valoresLcoltubZ = {
        "d_total": fmtComa(ejZ.cintaDTotal, 2) + "\"",
        "N_VUELTAS": String(vueltasParaEjemplo),
      };
      const valorFinalLcoltubZ = esMultiTiraEj
        ? [mc(String(tirasEj)), mop("×"), mc(fmtComa(LcoltubUnitEjZ, 2)), mop("="), mc(fmtComa(LcoltubEjZ, 2))]
        : [mc(fmtComa(LcoltubEjZ, 2))];
      y = dibujarFormulaEjemplo(doc, marginL, y, [mvs("LCOLTUB")], tokensLcoltub, valoresLcoltubZ, valorFinalLcoltubZ, anchoContenido);
      y += 16;

      const valoresZ = {
        "L_COLTUB": fmtComa(LcoltubEjZ, 2),
        "S_LADOS": String(ejZ.S),
        "C_ANT": String(ejZ.C),
        "%_DESP": "0",
      };
      const valorFinalZ = [mc(fmtComa(ejZ.collarLongitudPen, 1))];
      y = dibujarFormulaEjemplo(doc, marginL, y, [mvs("LCOLTOT")], tokensCollar, valoresZ, valorFinalZ, anchoContenido);
      y += 16;

      const headRowZ = ["Zona", "Nivel", "Cant.", "Tipo", "Barrera", "Material", "d_total (in)", "N_VUELTAS", "L_COLTUB (cm)", "L_COLTOT (cm)"];
      doc.autoTable({
        startY: y,
        margin: tableMargin,
        head: [headRowZ],
        body: filasCollar.map(r => [
          r.A || "-", r.B || "-", String(r.C), TIPO_LABEL_CORTO[r.L] || r.L,
          r.M || "-", r.N || "-",
          fmtComa(r.cintaDTotal, 2),
          String(r.cintaNVueltas),
          fmtComa(r.collarLcoltubPen, 2),
          fmtComa(r.collarLongitudPen, 1),
        ]),
        styles: { fontSize: MC_TABLA, cellPadding: 2.5, halign: "center" },
        headStyles: { fillColor: [26, 26, 26], textColor: 255, fontStyle: "normal" },
        columnStyles: { 9: { fontStyle: "bold" } },
        didDrawPage: () => dibujarCabecera(),
        didDrawCell: (data) => {
          if (data.section !== "head") return;
          doc.setFillColor(26, 26, 26);
          doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, "F");
          const simKey = (headRowZ[data.column.index].match(/^[^\s(]+/) || [headRowZ[data.column.index]])[0];
          const mUnidad = headRowZ[data.column.index].match(/\(([^)]+)\)/);
          const unidad = mUnidad ? mUnidad[1] : null;
          const sim = Object.values(SIM).find(s => s.key === simKey);
          const cx = data.cell.x + data.cell.width / 2;
          const cy = data.cell.y + data.cell.height / 2 + 2.5;
          doc.setTextColor(255, 255, 255);
          if (sim) {
            doc.setFont("helvetica", "normal"); doc.setFontSize(MC_TABLA);
            let anchoTotal = doc.getTextWidth(sim.v);
            if (sim.sub) { doc.setFontSize(MC_TABLA * 0.65); anchoTotal += doc.getTextWidth(sim.sub) + 1; doc.setFontSize(MC_TABLA); }
            let utxt = "";
            if (unidad) { utxt = " (" + unidad + ")"; doc.setFontSize(MC_TABLA * 0.85); anchoTotal += doc.getTextWidth(utxt); doc.setFontSize(MC_TABLA); }
            let dx = cx - anchoTotal / 2;
            doc.setFont("helvetica", "normal"); doc.setFontSize(MC_TABLA);
            doc.text(sim.v, dx, cy);
            let wv = doc.getTextWidth(sim.v);
            if (sim.sub) {
              doc.setFontSize(MC_TABLA * 0.65);
              doc.text(sim.sub, dx + wv + 0.6, cy + 1.6);
              wv += doc.getTextWidth(sim.sub) + 1;
            }
            if (unidad) { doc.setFontSize(MC_TABLA * 0.85); doc.text(utxt, dx + wv, cy); }
          } else {
            doc.setFont("helvetica", "normal"); doc.setFontSize(MC_TABLA);
            const w = doc.getTextWidth(headRowZ[data.column.index]);
            doc.text(headRowZ[data.column.index], cx - w / 2, cy);
          }
          doc.setTextColor(20, 20, 20);
        },
      });
      y = doc.lastAutoTable.finalY + 26;
    }

    // ---------------- ALMOHADILLA CFS-BL ----------------
    const filasBL = computed.filter(r => n(r.AD) > 0);
    if (filasBL.length > 0) {
      doc.addPage(); dibujarCabecera(); y = safe.top;
      doc.setFont("helvetica", "bold"); doc.setFontSize(MC_TITULO_MAT); doc.setTextColor(226, 0, 26);
      doc.text("Almohadilla CFS-BL", marginL, y); y += 24;
      doc.setTextColor(20, 20, 20);
      doc.setFont("helvetica", "normal"); doc.setFontSize(MC_BODY); doc.setTextColor(80, 80, 80);
      const introBL = "Ladrillos de almohadilla CFS-BL que sellan aberturas rectangulares (Bandeja de Cables, Pasante Múltiple, Vacío) o circulares (Vacío redondo) — el área a cubrir (A_SELLO) se calcula distinto según la geometría, ver el desglose de cada caso más abajo. El área que cubre cada ladrillo (A_BL) depende de con qué lado entra en la pared: cuando el Material es Concreto y el penetrante es Pasante Múltiple o Bandeja de Cables con abertura grande (DA_TOTAL o DB_TOTAL mayor a 91,4cm), A_BL = 65cm² (entra por el lado de 20cm). En cualquier otro caso, A_BL = 100cm² (entra por el lado de 13cm).";
      y = dibujarParrafoConSimbolos(doc, marginL, y, introBL, MC_BODY, anchoContenido, [
        { marcador: "A_BL", sim: SIM.ABL },
        { marcador: "A_SELLO", sim: SIM.ASELLO },
        { marcador: "DA_TOTAL", sim: SIM.DATOTAL },
        { marcador: "DB_TOTAL", sim: SIM.DBTOTAL },
      ]);
      y += 20;
      doc.setTextColor(20, 20, 20);

      const tokensCantBL = [mfrac([mvs("ASELLO")], [mvs("ABL")]), mop("×"), mvs("CANT"), mop("×"), mop("("), mc("1"), mop("+"), mvs("DESP"), mop(")")];

      const gruposBL = [
        {
          titulo: "Abertura Rectangular",
          circular: false,
          filas: filasBL.filter(r => !isBlank(r.F)),
          formulasPrevias: [
            { resultadoSim: [mvs("DATOTAL")], tokens: [mvs("DIMA"), mop("+"), mc("2"), mop("×"), mvs("ANUL")], vars: [SIM.DIMA] },
            { resultadoSim: [mvs("DBTOTAL")], tokens: [mvs("DIMB"), mop("+"), mc("2"), mop("×"), mvs("ANUL")], vars: [SIM.DIMB, SIM_ANUL_CORTO] },
          ],
          tokensArea: [mvs("DATOTAL"), mop("×"), mvs("DBTOTAL"), mop("×"), mop("("), mc("1"), mop("-"), mvs("OCUP"), mop(")")],
          varsArea: [SIM.OCUP],
          columnas: [
            { header: "DIM.A (cm)", get: r => fmtComa(r.F, 0) },
            { header: "DIM.B (cm)", get: r => fmtComa(r.G, 0) },
            { header: "%_OCUP", get: r => r.J !== "" ? fmtComa(Number(r.J) * 100, 0) + "%" : "0%" },
          ],
        },
        {
          titulo: "Vacío Redondo",
          circular: true,
          filas: filasBL.filter(r => isBlank(r.F)),
          formulasPrevias: [],
          tokensArea: [mfracPi("4"), mop("×"), mop("("), mvs("DIAM"), mop(")", SQ)],
          varsArea: [SIM.DIAM],
          columnas: [
            { header: "DIÁM. (in)", get: r => formatFraccionPulgadas(r.D) },
          ],
        },
      ];

      gruposBL.forEach(grupo => {
        if (grupo.filas.length === 0) return;
        saltoDePaginaSiHaceFalta(360);
        doc.setFont("helvetica", "bold"); doc.setFontSize(MC_TITULO_SUB); doc.setTextColor(20, 20, 20);
        doc.text(grupo.titulo, marginL, y); y += 22;

        grupo.formulasPrevias.forEach(f => { y = dibujarFormulaCompleta(doc, marginL, y, f.resultadoSim, f.tokens, anchoContenido); y += 8; });
        y = dibujarFormulaCompleta(doc, marginL, y, [mvs("ASELLO")], grupo.tokensArea, anchoContenido);
        y += 10;
        y = dibujarFormulaCompleta(doc, marginL, y, [mvs("CANTBL")], tokensCantBL, anchoContenido);
        y += 6;

        const todasVarsGrupo = [];
        const vistasBL = new Set();
        grupo.formulasPrevias.forEach(f => f.vars.forEach(v => { if (!vistasBL.has(v.key)) { vistasBL.add(v.key); todasVarsGrupo.push(v); } }));
        grupo.varsArea.forEach(v => { if (!vistasBL.has(v.key)) { vistasBL.add(v.key); todasVarsGrupo.push(v); } });
        [SIM.ABL, SIM.CANT, SIM.DESP].forEach(v => { if (!vistasBL.has(v.key)) { vistasBL.add(v.key); todasVarsGrupo.push(v); } });
        y = dibujarListaVariables(doc, marginL, y, todasVarsGrupo, null, anchoContenido);
        y += 16;

        const ejB = grupo.filas[0];
        doc.setFont("helvetica", "bold"); doc.setFontSize(MC_BODY + 0.5); doc.setTextColor(20, 20, 20);
        doc.text("Ejemplo de cálculo", marginL, y); y += 15;
        doc.setFont("helvetica", "normal"); doc.setFontSize(MC_BODY); doc.setTextColor(80, 80, 80);
        const dimTxtB = grupo.circular ? formatFraccionPulgadas(ejB.D) : `${fmtComa(ejB.F, 0)}×${fmtComa(ejB.G, 0)} cm`;
        const lineaCasoB = `Zona "${ejB.A || "—"}", ${TIPO_LABEL_CORTO[ejB.L] || ejB.L}, dimensión ${dimTxtB}, barrera ${ejB.M}/${ejB.N}, cantidad ${ejB.C}.`;
        const lsCasoB = doc.splitTextToSize(lineaCasoB, anchoContenido);
        doc.text(lineaCasoB, marginL, y, { align: "justify", maxWidth: anchoContenido }); y += lsCasoB.length * 13 + 16;
        doc.setTextColor(20, 20, 20);

        const valoresB = {
          "DIM.A": fmtComa(ejB.F, 0),
          "DIM.B": fmtComa(ejB.G, 0),
          "A_NUL": ejB.ANULAR_CM !== "-" ? fmtComa(ejB.ANULAR_CM, 2) : "-",
          "DA_TOTAL": ejB.DA_TOTAL !== "-" ? fmtComa(ejB.DA_TOTAL, 2) : "-",
          "DB_TOTAL": ejB.DB_TOTAL !== "-" ? fmtComa(ejB.DB_TOTAL, 2) : "-",
          "%_OCUP": ejB.J !== "" ? fmtComa(Number(ejB.J) * 100, 0) + "%" : "0%",
          "DIÁM.": formatFraccionPulgadas(ejB.D),
          "A_SELLO": ejB.A_SELLO !== "-" ? fmtComa(ejB.A_SELLO, 1) : "—",
          "A_BL": ejB.A_BL !== undefined ? String(ejB.A_BL) : "-",
          "C_ANT": String(ejB.C),
          "%_DESP": "0",
        };

        grupo.formulasPrevias.forEach(f => {
          const key = f.resultadoSim[0].key;
          const valorFinalF = [mc(valoresB[key] + " cm")];
          y = dibujarFormulaEjemplo(doc, marginL, y, f.resultadoSim, f.tokens, valoresB, valorFinalF, anchoContenido);
          y += 6;
        });
        const valorFinalArea = [mc(valoresB["A_SELLO"] + " "), mc("cm", SQ)];
        y = dibujarFormulaEjemplo(doc, marginL, y, [mvs("ASELLO")], grupo.tokensArea, valoresB, valorFinalArea, anchoContenido);
        y += 6;
        const valorFinalCant = [mc(String(ejB.AD))];
        y = dibujarFormulaEjemplo(doc, marginL, y, [mvs("CANTBL")], tokensCantBL, valoresB, valorFinalCant, anchoContenido);
        y += 16;

        const headRowB = ["Zona", "Nivel", "Cant.", "Tipo", "Barrera", "Material", ...grupo.columnas.map(c => c.header), "A_SELLO (cm2)", "A_BL (cm2)", "CANT_BL (und)"];
        doc.autoTable({
          startY: y,
          margin: tableMargin,
          head: [headRowB],
          body: grupo.filas.map(r => [
            r.A || "-", r.B || "-", String(r.C), TIPO_LABEL_CORTO[r.L] || r.L,
            r.M || "-", r.N || "-",
            ...grupo.columnas.map(c => c.get(r)),
            r.A_SELLO !== "-" ? fmtComa(r.A_SELLO, 1) : "-",
            r.A_BL !== undefined ? String(r.A_BL) : "-",
            String(r.AD),
          ]),
          styles: { fontSize: MC_TABLA, cellPadding: 2.5, halign: "center" },
          headStyles: { fillColor: [26, 26, 26], textColor: 255, fontStyle: "normal" },
          columnStyles: { [headRowB.length - 1]: { fontStyle: "bold" } },
          didDrawPage: () => dibujarCabecera(),
          didDrawCell: (data) => {
            if (data.section !== "head") return;
            doc.setFillColor(26, 26, 26);
            doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, "F");
            const simKey = (headRowB[data.column.index].match(/^[^\s(]+/) || [headRowB[data.column.index]])[0];
            const mUnidad = headRowB[data.column.index].match(/\(([^)]+)\)/);
            const unidad = mUnidad ? mUnidad[1] : null;
            const sim = Object.values(SIM).find(s => s.key === simKey);
            const cx = data.cell.x + data.cell.width / 2;
            const cy = data.cell.y + data.cell.height / 2 + 2.5;
            doc.setTextColor(255, 255, 255);
            if (sim) {
              doc.setFont("helvetica", "normal"); doc.setFontSize(MC_TABLA);
              let anchoTotal = doc.getTextWidth(sim.v);
              if (sim.sub) { doc.setFontSize(MC_TABLA * 0.65); anchoTotal += doc.getTextWidth(sim.sub) + 1; doc.setFontSize(MC_TABLA); }
              let utxt = "";
              if (unidad) { utxt = " (" + unidad + ")"; doc.setFontSize(MC_TABLA * 0.85); anchoTotal += doc.getTextWidth(utxt); doc.setFontSize(MC_TABLA); }
              let dx = cx - anchoTotal / 2;
              doc.setFont("helvetica", "normal"); doc.setFontSize(MC_TABLA);
              doc.text(sim.v, dx, cy);
              let wv = doc.getTextWidth(sim.v);
              if (sim.sub) {
                doc.setFontSize(MC_TABLA * 0.65);
                doc.text(sim.sub, dx + wv + 0.6, cy + 1.6);
                wv += doc.getTextWidth(sim.sub) + 1;
              }
              if (unidad) { doc.setFontSize(MC_TABLA * 0.85); doc.text(utxt, dx + wv, cy); }
            } else {
              doc.setFont("helvetica", "normal"); doc.setFontSize(MC_TABLA);
              const w = doc.getTextWidth(headRowB[data.column.index]);
              doc.text(headRowB[data.column.index], cx - w / 2, cy);
            }
            doc.setTextColor(20, 20, 20);
          },
        });
        y = doc.lastAutoTable.finalY + 26;
      });
    }
  }

  // Renderer de encabezado reutilizable: dibuja el símbolo con subíndice real
  // (v + sub + unidad) en cada columna de tabla que corresponda a una variable
  // registrada en SIM, y el texto plano tal cual si no hay coincidencia.
  function renderizarCabeceraConSimbolos(headRow) {
    return (data) => {
      if (data.section !== "head") return;
      doc.setFillColor(26, 26, 26);
      doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, "F");
      const simKey = (headRow[data.column.index].match(/^[^\s(]+/) || [headRow[data.column.index]])[0];
      const mUnidad = headRow[data.column.index].match(/\(([^)]+)\)/);
      const unidad = mUnidad ? mUnidad[1] : null;
      const sim = Object.values(SIM).find(s => s.key === simKey);
      const cx = data.cell.x + data.cell.width / 2;
      const cy = data.cell.y + data.cell.height / 2 + 2.5;
      doc.setTextColor(255, 255, 255);
      if (sim) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(MC_TABLA);
        let anchoTotal = doc.getTextWidth(sim.v);
        if (sim.sub) { doc.setFontSize(MC_TABLA * 0.65); anchoTotal += doc.getTextWidth(sim.sub) + 1; doc.setFontSize(MC_TABLA); }
        let utxt = "";
        if (unidad) { utxt = " (" + unidad + ")"; doc.setFontSize(MC_TABLA * 0.85); anchoTotal += doc.getTextWidth(utxt); doc.setFontSize(MC_TABLA); }
        let dx = cx - anchoTotal / 2;
        doc.setFont("helvetica", "normal"); doc.setFontSize(MC_TABLA);
        doc.text(sim.v, dx, cy);
        let wv = doc.getTextWidth(sim.v);
        if (sim.sub) {
          doc.setFontSize(MC_TABLA * 0.65);
          doc.text(sim.sub, dx + wv + 0.6, cy + 1.6);
          wv += doc.getTextWidth(sim.sub) + 1;
        }
        if (unidad) { doc.setFontSize(MC_TABLA * 0.85); doc.text(utxt, dx + wv, cy); }
      } else {
        doc.setFont("helvetica", "normal"); doc.setFontSize(MC_TABLA);
        const w = doc.getTextWidth(headRow[data.column.index]);
        doc.text(headRow[data.column.index], cx - w / 2, cy);
      }
      doc.setTextColor(20, 20, 20);
    };
  }

  // ---------------- ESPUMA CP 620 ----------------
  {
    const filasEspuma = computed.filter(r => n(r.AC) > 0);
    if (filasEspuma.length > 0) {
      doc.addPage(); dibujarCabecera(); y = safe.top;
      doc.setFont("helvetica", "bold"); doc.setFontSize(MC_TITULO_MAT); doc.setTextColor(226, 0, 26);
      doc.text("Espuma CP 620", marginL, y); y += 24;
      doc.setTextColor(20, 20, 20);
      doc.setFont("helvetica", "normal"); doc.setFontSize(MC_BODY); doc.setTextColor(80, 80, 80);
      const introEspuma = "Espuma CP 620 que sella aberturas rectangulares (Bandeja de Cables, Pasante Múltiple, Vacío) o circulares (Vacío redondo) — el área a cubrir (A_SELLO) se calcula distinto según la geometría, ver el desglose de cada caso más abajo. A diferencia de otros materiales, el espesor de espuma (E_ESPUMA) no depende del espesor de pared o losa del proyecto — es un valor propio de cada sistema UL, definido en la base de datos.";
      y = dibujarParrafoConSimbolos(doc, marginL, y, introEspuma, MC_BODY, anchoContenido, [
        { marcador: "A_SELLO", sim: SIM.ASELLO },
        { marcador: "E_ESPUMA", sim: SIM.EESPUMA },
      ]);
      y += 20;
      doc.setTextColor(20, 20, 20);

      const tokensVEspuma = [mvs("ASELLO"), mop("×"), mvs("EESPUMA"), mop("×"), mvs("CANT")];
      const notaVEspuma = "El % de desperdicio configurado se aplica una sola vez sobre la suma total del proyecto — no fila por fila, por eso no aparece en esta fórmula.";

      const gruposEspuma = [
        {
          titulo: "Abertura Rectangular",
          circular: false,
          filas: filasEspuma.filter(r => !isBlank(r.F)),
          formulasPrevias: [
            { resultadoSim: [mvs("DATOTAL")], tokens: [mvs("DIMA"), mop("+"), mc("2"), mop("×"), mvs("ANUL")], vars: [SIM.DIMA] },
            { resultadoSim: [mvs("DBTOTAL")], tokens: [mvs("DIMB"), mop("+"), mc("2"), mop("×"), mvs("ANUL")], vars: [SIM.DIMB, SIM_ANUL_CORTO] },
          ],
          tokensArea: [mvs("DATOTAL"), mop("×"), mvs("DBTOTAL"), mop("×"), mop("("), mc("1"), mop("-"), mvs("OCUP"), mop(")")],
          varsArea: [SIM.OCUP],
          columnas: [
            { header: "DIM.A (cm)", get: r => fmtComa(r.F, 0) },
            { header: "DIM.B (cm)", get: r => fmtComa(r.G, 0) },
            { header: "%_OCUP", get: r => r.J !== "" ? fmtComa(Number(r.J) * 100, 0) + "%" : "0%" },
          ],
        },
        {
          titulo: "Vacío Redondo",
          circular: true,
          filas: filasEspuma.filter(r => isBlank(r.F)),
          formulasPrevias: [],
          tokensArea: [mfracPi("4"), mop("×"), mop("("), mvs("DIAM"), mop(")", SQ)],
          varsArea: [SIM.DIAM],
          columnas: [
            { header: "DIÁM. (in)", get: r => formatFraccionPulgadas(r.D) },
          ],
        },
      ];

      gruposEspuma.forEach(grupo => {
        if (grupo.filas.length === 0) return;
        saltoDePaginaSiHaceFalta(360);
        doc.setFont("helvetica", "bold"); doc.setFontSize(MC_TITULO_SUB); doc.setTextColor(20, 20, 20);
        doc.text(grupo.titulo, marginL, y); y += 22;

        grupo.formulasPrevias.forEach(f => { y = dibujarFormulaCompleta(doc, marginL, y, f.resultadoSim, f.tokens, anchoContenido); y += 8; });
        y = dibujarFormulaCompleta(doc, marginL, y, [mvs("ASELLO")], grupo.tokensArea, anchoContenido);
        y += 10;
        y = dibujarFormulaCompleta(doc, marginL, y, [mvs("VESPUMA")], tokensVEspuma, anchoContenido);
        y += 8;
        doc.setFont("helvetica", "italic"); doc.setFontSize(MC_BODY); doc.setTextColor(120, 120, 120);
        const lsNotaVE = doc.splitTextToSize(notaVEspuma, anchoContenido);
        doc.text(notaVEspuma, marginL, y, { align: "justify", maxWidth: anchoContenido, lineHeightFactor: 1.35 }); y += lsNotaVE.length * 13 + 10;
        doc.setFont("helvetica", "normal"); doc.setTextColor(20, 20, 20);

        const todasVarsGrupoE = [];
        const vistasEspuma = new Set();
        grupo.formulasPrevias.forEach(f => f.vars.forEach(v => { if (!vistasEspuma.has(v.key)) { vistasEspuma.add(v.key); todasVarsGrupoE.push(v); } }));
        grupo.varsArea.forEach(v => { if (!vistasEspuma.has(v.key)) { vistasEspuma.add(v.key); todasVarsGrupoE.push(v); } });
        [SIM.EESPUMA, SIM.CANT].forEach(v => { if (!vistasEspuma.has(v.key)) { vistasEspuma.add(v.key); todasVarsGrupoE.push(v); } });
        y = dibujarListaVariables(doc, marginL, y, todasVarsGrupoE, null, anchoContenido);
        y += 16;

        const ejE = grupo.filas[0];
        doc.setFont("helvetica", "bold"); doc.setFontSize(MC_BODY + 0.5); doc.setTextColor(20, 20, 20);
        doc.text("Ejemplo de cálculo", marginL, y); y += 15;
        doc.setFont("helvetica", "normal"); doc.setFontSize(MC_BODY); doc.setTextColor(80, 80, 80);
        const dimTxtE = grupo.circular ? formatFraccionPulgadas(ejE.D) : `${fmtComa(ejE.F, 0)}×${fmtComa(ejE.G, 0)} cm`;
        const lineaCasoE = `Zona "${ejE.A || "—"}", ${TIPO_LABEL_CORTO[ejE.L] || ejE.L}, dimensión ${dimTxtE}, barrera ${ejE.M}/${ejE.N}, cantidad ${ejE.C}.`;
        const lsCasoE = doc.splitTextToSize(lineaCasoE, anchoContenido);
        doc.text(lineaCasoE, marginL, y, { align: "justify", maxWidth: anchoContenido }); y += lsCasoE.length * 13 + 16;
        doc.setTextColor(20, 20, 20);

        const valoresE = {
          "DIM.A": fmtComa(ejE.F, 0),
          "DIM.B": fmtComa(ejE.G, 0),
          "A_NUL": ejE.ANULAR_CM !== "-" ? fmtComa(ejE.ANULAR_CM, 2) : "-",
          "DA_TOTAL": ejE.DA_TOTAL !== "-" ? fmtComa(ejE.DA_TOTAL, 2) : "-",
          "DB_TOTAL": ejE.DB_TOTAL !== "-" ? fmtComa(ejE.DB_TOTAL, 2) : "-",
          "%_OCUP": ejE.J !== "" ? fmtComa(Number(ejE.J) * 100, 0) + "%" : "0%",
          "DIÁM.": formatFraccionPulgadas(ejE.D),
          "A_SELLO": ejE.A_SELLO !== "-" ? fmtComa(ejE.A_SELLO, 1) : "—",
          "E_ESPUMA": ejE.V !== "-" ? fmtComa(ejE.V, 1) : "-",
          "C_ANT": String(ejE.C),
        };

        grupo.formulasPrevias.forEach(f => {
          const key = f.resultadoSim[0].key;
          const valorFinalF = [mc(valoresE[key] + " cm")];
          y = dibujarFormulaEjemplo(doc, marginL, y, f.resultadoSim, f.tokens, valoresE, valorFinalF, anchoContenido);
          y += 6;
        });
        const valorFinalAreaE = [mc(valoresE["A_SELLO"] + " "), mc("cm", SQ)];
        y = dibujarFormulaEjemplo(doc, marginL, y, [mvs("ASELLO")], grupo.tokensArea, valoresE, valorFinalAreaE, anchoContenido);
        y += 6;
        const valorFinalVE = [mc((ejE.AC !== "-" ? fmtComa(ejE.AC, 1) : "0") + " "), mc("cm", "3")];
        y = dibujarFormulaEjemplo(doc, marginL, y, [mvs("VESPUMA")], tokensVEspuma, valoresE, valorFinalVE, anchoContenido);
        y += 16;

        const headRowE = ["Zona", "Nivel", "Cant.", "Tipo", "Barrera", "Material", ...grupo.columnas.map(c => c.header), "A_SELLO (cm2)", "E_ESPUMA (cm)", "V_ESPUMA (cm3)"];
        doc.autoTable({
          startY: y,
          margin: tableMargin,
          head: [headRowE],
          body: grupo.filas.map(r => [
            r.A || "-", r.B || "-", String(r.C), TIPO_LABEL_CORTO[r.L] || r.L,
            r.M || "-", r.N || "-",
            ...grupo.columnas.map(c => c.get(r)),
            r.A_SELLO !== "-" ? fmtComa(r.A_SELLO, 1) : "-",
            r.V !== "-" ? fmtComa(r.V, 1) : "-",
            r.AC !== "-" ? fmtComa(r.AC, 1) : "-",
          ]),
          styles: { fontSize: MC_TABLA, cellPadding: 2.5, halign: "center" },
          headStyles: { fillColor: [26, 26, 26], textColor: 255, fontStyle: "normal" },
          columnStyles: { [headRowE.length - 1]: { fontStyle: "bold" } },
          didDrawPage: () => dibujarCabecera(),
          didDrawCell: renderizarCabeceraConSimbolos(headRowE),
        });
        y = doc.lastAutoTable.finalY + 26;
      });
    }
  }

  // ---------------- MORTERO CP 637 ----------------
  {
    const filasMortero = computed.filter(r => n(r.AK) > 0);
    if (filasMortero.length > 0) {
      doc.addPage(); dibujarCabecera(); y = safe.top;
      doc.setFont("helvetica", "bold"); doc.setFontSize(MC_TITULO_MAT); doc.setTextColor(226, 0, 26);
      doc.text("Mortero CP 637", marginL, y); y += 24;
      doc.setTextColor(20, 20, 20);
      doc.setFont("helvetica", "normal"); doc.setFontSize(MC_BODY); doc.setTextColor(80, 80, 80);
      const introMortero = "Mortero CP 637 que sella aberturas rectangulares (Bandeja de Cables, Pasante Múltiple, Vacío) o circulares (Vacío redondo) — el área a cubrir (A_SELLO) se calcula distinto según la geometría, ver el desglose de cada caso más abajo. Solo aplica en Concreto. El espesor de mortero (E_MORTERO) se guarda en pulgadas según el sistema UL y se convierte a cm (×2,54) para calcular el volumen.";
      y = dibujarParrafoConSimbolos(doc, marginL, y, introMortero, MC_BODY, anchoContenido, [
        { marcador: "A_SELLO", sim: SIM.ASELLO },
        { marcador: "E_MORTERO", sim: SIM.EMORTERO },
      ]);
      y += 20;
      doc.setTextColor(20, 20, 20);

      const tokensVMortero = [mvs("ASELLO"), mop("×"), mvs("EMORTERO"), mop("×"), mc("2.54"), mop("×"), mvs("CANT")];
      const notaVMortero = "El % de desperdicio configurado se aplica una sola vez sobre la suma total del proyecto — no fila por fila, por eso no aparece en esta fórmula.";

      const gruposMortero = [
        {
          titulo: "Abertura Rectangular",
          circular: false,
          filas: filasMortero.filter(r => !isBlank(r.F)),
          formulasPrevias: [
            { resultadoSim: [mvs("DATOTAL")], tokens: [mvs("DIMA"), mop("+"), mc("2"), mop("×"), mvs("ANUL")], vars: [SIM.DIMA] },
            { resultadoSim: [mvs("DBTOTAL")], tokens: [mvs("DIMB"), mop("+"), mc("2"), mop("×"), mvs("ANUL")], vars: [SIM.DIMB, SIM_ANUL_CORTO] },
          ],
          tokensArea: [mvs("DATOTAL"), mop("×"), mvs("DBTOTAL"), mop("×"), mop("("), mc("1"), mop("-"), mvs("OCUP"), mop(")")],
          varsArea: [SIM.OCUP],
          columnas: [
            { header: "DIM.A (cm)", get: r => fmtComa(r.F, 0) },
            { header: "DIM.B (cm)", get: r => fmtComa(r.G, 0) },
            { header: "%_OCUP", get: r => r.J !== "" ? fmtComa(Number(r.J) * 100, 0) + "%" : "0%" },
          ],
        },
        {
          titulo: "Vacío Redondo",
          circular: true,
          filas: filasMortero.filter(r => isBlank(r.F)),
          formulasPrevias: [],
          tokensArea: [mfracPi("4"), mop("×"), mop("("), mvs("DIAM"), mop(")", SQ)],
          varsArea: [SIM.DIAM],
          columnas: [
            { header: "DIÁM. (in)", get: r => formatFraccionPulgadas(r.D) },
          ],
        },
      ];

      gruposMortero.forEach(grupo => {
        if (grupo.filas.length === 0) return;
        saltoDePaginaSiHaceFalta(360);
        doc.setFont("helvetica", "bold"); doc.setFontSize(MC_TITULO_SUB); doc.setTextColor(20, 20, 20);
        doc.text(grupo.titulo, marginL, y); y += 22;

        grupo.formulasPrevias.forEach(f => { y = dibujarFormulaCompleta(doc, marginL, y, f.resultadoSim, f.tokens, anchoContenido); y += 8; });
        y = dibujarFormulaCompleta(doc, marginL, y, [mvs("ASELLO")], grupo.tokensArea, anchoContenido);
        y += 10;
        y = dibujarFormulaCompleta(doc, marginL, y, [mvs("VMORTERO")], tokensVMortero, anchoContenido);
        y += 8;
        doc.setFont("helvetica", "italic"); doc.setFontSize(MC_BODY); doc.setTextColor(120, 120, 120);
        const lsNotaVM = doc.splitTextToSize(notaVMortero, anchoContenido);
        doc.text(notaVMortero, marginL, y, { align: "justify", maxWidth: anchoContenido, lineHeightFactor: 1.35 }); y += lsNotaVM.length * 13 + 10;
        doc.setFont("helvetica", "normal"); doc.setTextColor(20, 20, 20);

        const todasVarsGrupoM = [];
        const vistasMortero = new Set();
        grupo.formulasPrevias.forEach(f => f.vars.forEach(v => { if (!vistasMortero.has(v.key)) { vistasMortero.add(v.key); todasVarsGrupoM.push(v); } }));
        grupo.varsArea.forEach(v => { if (!vistasMortero.has(v.key)) { vistasMortero.add(v.key); todasVarsGrupoM.push(v); } });
        [SIM.EMORTERO, SIM.CANT].forEach(v => { if (!vistasMortero.has(v.key)) { vistasMortero.add(v.key); todasVarsGrupoM.push(v); } });
        y = dibujarListaVariables(doc, marginL, y, todasVarsGrupoM, null, anchoContenido);
        y += 16;

        const ejM = grupo.filas[0];
        doc.setFont("helvetica", "bold"); doc.setFontSize(MC_BODY + 0.5); doc.setTextColor(20, 20, 20);
        doc.text("Ejemplo de cálculo", marginL, y); y += 15;
        doc.setFont("helvetica", "normal"); doc.setFontSize(MC_BODY); doc.setTextColor(80, 80, 80);
        const dimTxtM = grupo.circular ? formatFraccionPulgadas(ejM.D) : `${fmtComa(ejM.F, 0)}×${fmtComa(ejM.G, 0)} cm`;
        const lineaCasoM = `Zona "${ejM.A || "—"}", ${TIPO_LABEL_CORTO[ejM.L] || ejM.L}, dimensión ${dimTxtM}, barrera ${ejM.M}/${ejM.N}, cantidad ${ejM.C}.`;
        const lsCasoM = doc.splitTextToSize(lineaCasoM, anchoContenido);
        doc.text(lineaCasoM, marginL, y, { align: "justify", maxWidth: anchoContenido }); y += lsCasoM.length * 13 + 16;
        doc.setTextColor(20, 20, 20);

        const valoresM = {
          "DIM.A": fmtComa(ejM.F, 0),
          "DIM.B": fmtComa(ejM.G, 0),
          "A_NUL": ejM.ANULAR_CM !== "-" ? fmtComa(ejM.ANULAR_CM, 2) : "-",
          "DA_TOTAL": ejM.DA_TOTAL !== "-" ? fmtComa(ejM.DA_TOTAL, 2) : "-",
          "DB_TOTAL": ejM.DB_TOTAL !== "-" ? fmtComa(ejM.DB_TOTAL, 2) : "-",
          "%_OCUP": ejM.J !== "" ? fmtComa(Number(ejM.J) * 100, 0) + "%" : "0%",
          "DIÁM.": formatFraccionPulgadas(ejM.D),
          "A_SELLO": ejM.A_SELLO !== "-" ? fmtComa(ejM.A_SELLO, 1) : "—",
          "E_MORTERO": ejM.V !== "-" ? formatFraccionPulgadas(ejM.V) : "-",
          "C_ANT": String(ejM.C),
        };

        grupo.formulasPrevias.forEach(f => {
          const key = f.resultadoSim[0].key;
          const valorFinalF = [mc(valoresM[key] + " cm")];
          y = dibujarFormulaEjemplo(doc, marginL, y, f.resultadoSim, f.tokens, valoresM, valorFinalF, anchoContenido);
          y += 6;
        });
        const valorFinalAreaM = [mc(valoresM["A_SELLO"] + " "), mc("cm", SQ)];
        y = dibujarFormulaEjemplo(doc, marginL, y, [mvs("ASELLO")], grupo.tokensArea, valoresM, valorFinalAreaM, anchoContenido);
        y += 6;
        const valorFinalVM = [mc((ejM.AK !== "-" ? fmtComa(ejM.AK, 1) : "0") + " "), mc("cm", "3")];
        y = dibujarFormulaEjemplo(doc, marginL, y, [mvs("VMORTERO")], tokensVMortero, valoresM, valorFinalVM, anchoContenido);
        y += 16;

        const headRowM = ["Zona", "Nivel", "Cant.", "Tipo", "Barrera", "Material", ...grupo.columnas.map(c => c.header), "A_SELLO (cm2)", "E_MORTERO (in)", "V_MORTERO (cm3)"];
        doc.autoTable({
          startY: y,
          margin: tableMargin,
          head: [headRowM],
          body: grupo.filas.map(r => [
            r.A || "-", r.B || "-", String(r.C), TIPO_LABEL_CORTO[r.L] || r.L,
            r.M || "-", r.N || "-",
            ...grupo.columnas.map(c => c.get(r)),
            r.A_SELLO !== "-" ? fmtComa(r.A_SELLO, 1) : "-",
            r.V !== "-" ? formatFraccionPulgadas(r.V) : "-",
            r.AK !== "-" ? fmtComa(r.AK, 1) : "-",
          ]),
          styles: { fontSize: MC_TABLA, cellPadding: 2.5, halign: "center" },
          headStyles: { fillColor: [26, 26, 26], textColor: 255, fontStyle: "normal" },
          columnStyles: { [headRowM.length - 1]: { fontStyle: "bold" } },
          didDrawPage: () => dibujarCabecera(),
          didDrawCell: renderizarCabeceraConSimbolos(headRowM),
        });
        y = doc.lastAutoTable.finalY + 26;
      });
    }
  }

  // ---------------- MANGA CP 653 Y PASO DE CABLES MSL ----------------
  // Los 3 productos (Manga CP 653, Paso MSL M, Paso MSL L) solo aplican a
  // "Cables en Paso Repenetrable" y comparten los mismos 20 escalones de
  // diámetro de cable (la ficha Hilti trae un 20° escalón que en la práctica
  // nunca se alcanza — ver nota en calc-engine.js — por eso acá se muestran
  // solo los 19 escalones realmente usables). Se unificaron en una sola
  // sección con una tabla de referencia compartida, a pedido de Kevin
  // (10/08/2026), en vez de repetir la misma tabla 3 veces.
  {
    const DIAM_UMBRALES_REND = [0.118, 0.138, 0.157, 0.177, 0.197, 0.216, 0.236, 0.256, 0.275, 0.314, 0.354, 0.394, 0.433, 0.491, 0.59, 0.708, 0.786, 0.983, 1.179];
    const DIVISORES_MANGA = [819, 596, 451, 356, 287, 240, 199, 164, 141, 109, 85, 61, 50, 38, 26, 19, 14, 8, 7];
    const DIVISORES_MSLM = [486, 368, 280, 216, 176, 150, 117, 96, 88, 70, 54, 40, 35, 24, 15, 12, 8, 6, 2];
    const DIVISORES_MSLL = [1188, 851, 660, 522, 416, 360, 286, 240, 198, 160, 126, 104, 84, 60, 40, 28, 24, 15, 8];
    function rendimientoParaDiam(diamIn, divisores) {
      for (let i = 0; i < DIAM_UMBRALES_REND.length; i++) {
        if (diamIn <= DIAM_UMBRALES_REND[i]) return divisores[i];
      }
      return null;
    }
    function formatDecimalPulgadas(v) { return fmtComa(v, 3) + "\""; }
    function formatCmDesdeIn(v) { return fmtComa(v * 2.54, 2) + " cm"; }

    const filasManga = computed.filter(r => n(r.AE) > 0);
    const filasMslM = computed.filter(r => n(r.AF) > 0);
    const filasMslL = computed.filter(r => n(r.AG) > 0);

    if (filasManga.length > 0 || filasMslM.length > 0 || filasMslL.length > 0) {
      doc.addPage(); dibujarCabecera(); y = safe.top;
      doc.setFont("helvetica", "bold"); doc.setFontSize(MC_TITULO_MAT); doc.setTextColor(226, 0, 26);
      doc.text("Manga CP 653 y Paso de Cables MSL", marginL, y); y += 24;
      doc.setTextColor(20, 20, 20);
      doc.setFont("helvetica", "normal"); doc.setFontSize(MC_BODY); doc.setTextColor(80, 80, 80);
      const intro = "Manga CP 653 4\", Paso MSL M (3\"x4\") y Paso MSL L (6\"x4\") se usan en penetrantes de tipo \"Cables en Paso Repenetrable\". A diferencia de los demás materiales, no se calculan por área de sello — la cantidad de cables (C_CABLES) que caben por pieza depende directamente del diámetro del cable, según la tabla de referencia Hilti de abajo (compartida entre los 3 productos, cada uno con su propia columna). La cantidad final de piezas siempre se redondea hacia arriba.";
      y = dibujarParrafoConSimbolos(doc, marginL, y, intro, MC_BODY, anchoContenido, [
        { marcador: "C_CABLES", sim: SIM.CCABLES },
      ]);
      y += 20;
      doc.setTextColor(20, 20, 20);

      const tokensCant = [mfrac([mvs("CANT")], [mvs("CCABLES")])];
      y = dibujarFormulaCompleta(doc, marginL, y, [mvs("CANTPIEZA")], tokensCant, anchoContenido);
      y += 10;
      y = dibujarListaVariables(doc, marginL, y, [SIM.CANT, SIM.CCABLES], null, anchoContenido);
      y += 16;

      saltoDePaginaSiHaceFalta(300);
      doc.setFont("helvetica", "bold"); doc.setFontSize(MC_BODY + 0.5); doc.setTextColor(20, 20, 20);
      doc.text("Tabla de rendimiento por diámetro", marginL, y); y += 15;
      const headRef = ["DIÁM. (in decimal)", "DIÁM. (in fracción)", "DIÁM. (cm)", "C_CABLES (CP 653 4\")", "C_CABLES (MSL M 3x4\")", "C_CABLES (MSL L 6x4\")"];
      doc.autoTable({
        startY: y,
        margin: tableMargin,
        head: [headRef],
        body: DIAM_UMBRALES_REND.map((d, i) => [
          formatDecimalPulgadas(d),
          formatFraccionPulgadas(d),
          formatCmDesdeIn(d),
          String(DIVISORES_MANGA[i]),
          String(DIVISORES_MSLM[i]),
          String(DIVISORES_MSLL[i]),
        ]),
        styles: { fontSize: MC_TABLA - 0.5, cellPadding: 2 },
        headStyles: { fillColor: [26, 26, 26], textColor: 255, fontStyle: "normal" },
        didDrawPage: () => dibujarCabecera(),
        didDrawCell: renderizarCabeceraConSimbolos(headRef),
      });
      y = doc.lastAutoTable.finalY + 20;

      const productos = [
        { nombre: "Manga CP 653 4\"", filas: filasManga, campo: "AE", divisores: DIVISORES_MANGA },
        { nombre: "Paso MSL M (3\"x4\")", filas: filasMslM, campo: "AF", divisores: DIVISORES_MSLM },
        { nombre: "Paso MSL L (6\"x4\")", filas: filasMslL, campo: "AG", divisores: DIVISORES_MSLL },
      ];

      productos.forEach(prod => {
        if (prod.filas.length === 0) return;
        saltoDePaginaSiHaceFalta(140);
        const ej = prod.filas[0];
        doc.setFont("helvetica", "bold"); doc.setFontSize(MC_BODY + 0.5); doc.setTextColor(20, 20, 20);
        doc.text("Ejemplo de cálculo — " + prod.nombre, marginL, y); y += 15;
        doc.setFont("helvetica", "normal"); doc.setFontSize(MC_BODY); doc.setTextColor(80, 80, 80);
        const lineaCaso = `Zona "${ej.A || "—"}", diámetro ${formatFraccionPulgadas(ej.D)}, cantidad ${ej.C}.`;
        const lsCaso = doc.splitTextToSize(lineaCaso, anchoContenido);
        doc.text(lineaCaso, marginL, y, { align: "justify", maxWidth: anchoContenido }); y += lsCaso.length * 13 + 16;
        doc.setTextColor(20, 20, 20);

        const divisorEj = rendimientoParaDiam(n(ej.D), prod.divisores);
        const valores = { "C_ANT": String(ej.C), "C_CABLES": divisorEj !== null ? String(divisorEj) : "—" };
        const valorFinal = [mc(String(ej[prod.campo]))];
        y = dibujarFormulaEjemplo(doc, marginL, y, [mvs("CANTPIEZA")], tokensCant, valores, valorFinal, anchoContenido);
        y += 16;
      });

      const filasTodas = [
        ...filasManga.map(r => ({ r, nombre: "Manga CP 653 4\"", campo: "AE", divisores: DIVISORES_MANGA })),
        ...filasMslM.map(r => ({ r, nombre: "Paso MSL M", campo: "AF", divisores: DIVISORES_MSLM })),
        ...filasMslL.map(r => ({ r, nombre: "Paso MSL L", campo: "AG", divisores: DIVISORES_MSLL })),
      ];
      const headRow = ["Zona", "Nivel", "Cant.", "Producto", "DIÁM. (in)", "C_CABLES", "CANT_PIEZA (und)"];
      doc.autoTable({
        startY: y,
        margin: tableMargin,
        head: [headRow],
        body: filasTodas.map(({ r, nombre, campo, divisores }) => {
          const div = rendimientoParaDiam(n(r.D), divisores);
          return [r.A || "-", r.B || "-", String(r.C), nombre, formatFraccionPulgadas(r.D), div !== null ? String(div) : "—", String(r[campo])];
        }),
        styles: { fontSize: MC_TABLA, cellPadding: 2.5, halign: "center" },
        headStyles: { fillColor: [26, 26, 26], textColor: 255, fontStyle: "normal" },
        columnStyles: { 6: { fontStyle: "bold" } },
        didDrawPage: () => dibujarCabecera(),
        didDrawCell: renderizarCabeceraConSimbolos(headRow),
      });
      y = doc.lastAutoTable.finalY + 26;
    }
  }

  // ---------------- PUTTY PAD CP 617 ----------------
  {
    const filasPP = computed.filter(r => n(r.AB) > 0);
    if (filasPP.length > 0) {
      doc.addPage(); dibujarCabecera(); y = safe.top;
      doc.setFont("helvetica", "bold"); doc.setFontSize(MC_TITULO_MAT); doc.setTextColor(226, 0, 26);
      doc.text("Putty Pad CP 617", marginL, y); y += 24;
      doc.setTextColor(20, 20, 20);
      doc.setFont("helvetica", "normal"); doc.setFontSize(MC_BODY); doc.setTextColor(80, 80, 80);
      const introPP = "Sello de cajas electromecánicas UL embebidas en pared liviana o losa. Primero se calcula el área total de la caja a cubrir (A_CAJA): cara frontal más las 4 caras laterales. Si la caja es de tamaño estándar, con dimensiones menores a 4-11/16\"×4-11/16\"×2-1/2\" (A_CAJA <= 444,18cm2), y la instalación es por dentro, se considera 1 solo Putty Pad por caja; en caso de ser por fuera, la cantidad dependerá del área de la caja (A_CAJA) y el área efectiva que puede cubrir el Putty Pad (A_EF). Si la caja es considerada grande, con dimensiones mayores a 4-11/16\"×4-11/16\"×2-1/2\", la cantidad dependerá de la razón entre A_CAJA y A_EF, y un factor multiplicativo según el F Rating de la barrera: ×2 en 1 Hora, ×4 en 2 Horas.";
      y = dibujarParrafoConSimbolosJustificado(doc, marginL, y, introPP, MC_BODY, anchoContenido, [
        { marcador: "A_CAJA", sim: SIM.ACAJA },
        { marcador: "A_EF", sim: SIM.AEF },
      ]);
      y += 20;
      doc.setTextColor(20, 20, 20);

      // Fórmula compartida por todos los casos: área de la caja a cubrir.
      const tokensACaja = [mvs("DIMA"), mop("×"), mvs("DIMB"), mop("+"), mc("2"), mop("×"), mvs("DIMA"), mop("×"), mvs("PROF"), mop("+"), mc("2"), mop("×"), mvs("DIMB"), mop("×"), mvs("PROF")];
      y = dibujarFormulaCompleta(doc, marginL, y, [mvs("ACAJA")], tokensACaja, anchoContenido);
      y += 8;
      y = dibujarListaVariables(doc, marginL, y, [SIM.ACAJA, SIM.DIMA, SIM.DIMB, SIM.PROF], null, anchoContenido);
      y += 16;

      const UMBRAL_CAJA_PP = 444.1775;
      const filasChica = filasPP.filter(r => n(r.A_CAJA) <= UMBRAL_CAJA_PP);
      const filasGrande = filasPP.filter(r => n(r.A_CAJA) > UMBRAL_CAJA_PP);
      const headRowPP = ["Zona", "Nivel", "Cant.", "Tipo", "DIM.A (cm)", "DIM.B (cm)", "P_ROF (cm)", "A_CAJA (cm2)", "A_EF (cm2)", "Instalación", "Tipo PP", "CANT_PP (und)"];
      const filaBodyPP = r => [
        r.A || "-", r.B || "-", String(r.C), TIPO_LABEL_CORTO[r.L] || r.L,
        fmtComa(r.F, 1), fmtComa(r.G, 1), fmtComa(r.H, 1),
        fmtComa(r.A_CAJA, 1), fmtComa(r.A_EF, 1),
        r.PPINST || "-",
        n(r.PPSIZE) === 9 ? '9x9"' : '7x7"',
        fmtComa(r.AB, 2),
      ];

      // ---- Caja Chica (Dentro y Fuera juntas en una sola tabla) ----
      if (filasChica.length > 0) {
        saltoDePaginaSiHaceFalta(360);
        doc.setFont("helvetica", "bold"); doc.setFontSize(MC_TITULO_SUB); doc.setTextColor(20, 20, 20);
        doc.text('Caja tamaño estándar <= 4-11/16"×4-11/16"×2-1/2"', marginL, y); y += 22;
        doc.setTextColor(20, 20, 20);

        const tokensDentro = [mc("1"), mop("×"), mvs("CANT")];
        const tokensFuera = [mfrac([mvs("ACAJA")], [mvs("AEF")]), mop("×"), mvs("CANT")];

        doc.setFont("helvetica", "italic"); doc.setFontSize(MC_BODY - 0.5); doc.setTextColor(110, 110, 110);
        doc.text("Instalación por Dentro (1 pad fijo por caja):", marginL, y); y += 13;
        doc.setFont("helvetica", "normal"); doc.setTextColor(20, 20, 20);
        y = dibujarFormulaCompleta(doc, marginL, y, [mvs("CANTPP")], tokensDentro, anchoContenido);
        y += 12;

        doc.setFont("helvetica", "italic"); doc.setFontSize(MC_BODY - 0.5); doc.setTextColor(110, 110, 110);
        doc.text("Instalación por Fuera:", marginL, y); y += 13;
        doc.setFont("helvetica", "normal"); doc.setTextColor(20, 20, 20);
        y = dibujarFormulaCompleta(doc, marginL, y, [mvs("CANTPP")], tokensFuera, anchoContenido);
        y += 8;

        y = dibujarListaVariables(doc, marginL, y, [SIM.CANT, SIM.ACAJA, SIM.AEF], null, anchoContenido);
        y += 16;

        ["Dentro", "Fuera"].forEach(inst => {
          const filaInst = filasChica.find(r => eq(r.PPINST, inst));
          if (!filaInst) return;
          saltoDePaginaSiHaceFalta(120);
          doc.setFont("helvetica", "bold"); doc.setFontSize(MC_BODY + 0.5); doc.setTextColor(20, 20, 20);
          doc.text(`Ejemplo de cálculo — Instalación por ${inst}`, marginL, y); y += 15;
          doc.setFont("helvetica", "normal"); doc.setFontSize(MC_BODY); doc.setTextColor(80, 80, 80);
          const lineaEj = `Zona "${filaInst.A || "—"}", caja ${fmtComa(filaInst.F, 1)}×${fmtComa(filaInst.G, 1)}×${fmtComa(filaInst.H, 1)} cm, cantidad ${filaInst.C}.`;
          const lsEj = doc.splitTextToSize(lineaEj, anchoContenido);
          doc.text(lineaEj, marginL, y, { align: "justify", maxWidth: anchoContenido }); y += lsEj.length * 13 + 16;
          doc.setTextColor(20, 20, 20);

          const valEj = {
            "A_CAJA": fmtComa(filaInst.A_CAJA, 1),
            "A_EF": fmtComa(filaInst.A_EF, 1),
            "C_ANT": String(filaInst.C),
          };
          const tokensUsar = inst === "Dentro" ? tokensDentro : tokensFuera;
          const valorFinal = [mc(fmtComa(filaInst.AB, 2))];
          y = dibujarFormulaEjemplo(doc, marginL, y, [mvs("CANTPP")], tokensUsar, valEj, valorFinal, anchoContenido);
          y += 16;
        });

        doc.autoTable({
          startY: y,
          margin: tableMargin,
          head: [headRowPP],
          body: filasChica.map(filaBodyPP),
          styles: { fontSize: MC_TABLA, cellPadding: 2.5, halign: "center" },
          headStyles: { fillColor: [26, 26, 26], textColor: 255, fontStyle: "normal" },
          columnStyles: { [headRowPP.length - 1]: { fontStyle: "bold" } },
          didDrawPage: () => dibujarCabecera(),
          didDrawCell: renderizarCabeceraConSimbolos(headRowPP),
        });
        y = doc.lastAutoTable.finalY + 26;
      }

      // ---- Caja Grande ----
      if (filasGrande.length > 0) {
        saltoDePaginaSiHaceFalta(360);
        doc.setFont("helvetica", "bold"); doc.setFontSize(MC_TITULO_SUB); doc.setTextColor(20, 20, 20);
        doc.text('Caja tipo tablero > 4-11/16"×4-11/16"×2-1/2"', marginL, y); y += 22;
        doc.setTextColor(20, 20, 20);

        doc.setFont("helvetica", "normal"); doc.setFontSize(MC_BODY); doc.setTextColor(80, 80, 80);
        const notaGrande = "En caja tipo tablero la instalación (Dentro/Fuera) no cambia la fórmula — se muestra solo como referencia. El factor sí depende del F Rating de la barrera: ×2 para 1 Hora, ×4 para 2 Horas o más.";
        const lsNotaGrande = doc.splitTextToSize(notaGrande, anchoContenido);
        doc.text(notaGrande, marginL, y, { align: "justify", maxWidth: anchoContenido }); y += lsNotaGrande.length * 13 + 10;
        doc.setTextColor(20, 20, 20);

        const tokenFactor = { v: "factor", key: "factor" };
        const tokensGrande = [mfrac([mvs("ACAJA")], [mvs("AEF")]), mop("×"), tokenFactor, mop("×"), mvs("CANT")];
        y = dibujarFormulaCompleta(doc, marginL, y, [mvs("CANTPP")], tokensGrande, anchoContenido);
        y += 8;
        y = dibujarListaVariables(doc, marginL, y, [SIM.CANT, SIM.ACAJA, SIM.AEF], null, anchoContenido);
        y += 16;

        const ejG = filasGrande[0];
        saltoDePaginaSiHaceFalta(120);
        doc.setFont("helvetica", "bold"); doc.setFontSize(MC_BODY + 0.5); doc.setTextColor(20, 20, 20);
        doc.text("Ejemplo de cálculo", marginL, y); y += 15;
        doc.setFont("helvetica", "normal"); doc.setFontSize(MC_BODY); doc.setTextColor(80, 80, 80);
        const factorG = eq(ejG.O, "1 Hora") ? 2 : 4;
        const lineaEjG = `Zona "${ejG.A || "—"}", caja ${fmtComa(ejG.F, 1)}×${fmtComa(ejG.G, 1)}×${fmtComa(ejG.H, 1)} cm, barrera ${ejG.O || "-"} (factor ×${factorG}), cantidad ${ejG.C}.`;
        const lsEjG = doc.splitTextToSize(lineaEjG, anchoContenido);
        doc.text(lineaEjG, marginL, y, { align: "justify", maxWidth: anchoContenido }); y += lsEjG.length * 13 + 16;
        doc.setTextColor(20, 20, 20);

        const valEjG = {
          "A_CAJA": fmtComa(ejG.A_CAJA, 1),
          "A_EF": fmtComa(ejG.A_EF, 1),
          "factor": String(factorG),
          "C_ANT": String(ejG.C),
        };
        const valorFinalG = [mc(fmtComa(ejG.AB, 2))];
        y = dibujarFormulaEjemplo(doc, marginL, y, [mvs("CANTPP")], tokensGrande, valEjG, valorFinalG, anchoContenido);
        y += 16;

        doc.autoTable({
          startY: y,
          margin: tableMargin,
          head: [headRowPP],
          body: filasGrande.map(filaBodyPP),
          styles: { fontSize: MC_TABLA, cellPadding: 2.5, halign: "center" },
          headStyles: { fillColor: [26, 26, 26], textColor: 255, fontStyle: "normal" },
          columnStyles: { [headRowPP.length - 1]: { fontStyle: "bold" } },
          didDrawPage: () => dibujarCabecera(),
          didDrawCell: renderizarCabeceraConSimbolos(headRowPP),
        });
        y = doc.lastAutoTable.finalY + 26;
      }
    }
  }

  // ---------------- SELLADOR DE JUNTAS ----------------
  if (computedJ.length > 0) {
    // Si hubo Penetrantes, la página 2 ya tiene contenido — Juntas arranca en
    // página nueva, igual que cualquier otro material. Si el proyecto es
    // solo-Juntas (sin Penetrantes), la página 2 sigue en blanco (solo
    // encabezado + línea de proyecto) y hay que usarla en vez de saltar a una
    // página 3 vacía.
    if (computed.length > 0) { doc.addPage(); dibujarCabecera(); y = safe.top; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(MC_TITULO_MAT); doc.setTextColor(226, 0, 26);
    doc.text("Sellador de Juntas", marginL, y); y += 24;
    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "normal"); doc.setFontSize(MC_BODY); doc.setTextColor(80, 80, 80);
    const introJ = "Aplica a CP 606, CFS SIL GG, CFS SP WB y FS ONE MAX (este último solo válido en Pared - Entrepiso, Panel de yeso - Concreto). El volumen de sellador (V_SELLO) para una junta con ancho medido (AN_JUNTA) se calcula con el ancho más el traslape del producto a cada lado (T_RASLP), el espesor de producto según sistema UL (E_JUNTA), la longitud (L_JUNTA), el N° de lados sellados (N_LADO) y la cantidad de juntas (CANT_JUNTA). Para juntas topadas (AN_JUNTA = 0) se usa en su lugar una fórmula de cordón mínimo específica por producto, ver nota más abajo.";
    y = dibujarParrafoConSimbolos(doc, marginL, y, introJ, MC_BODY, anchoContenido, [
      { marcador: "V_SELLO", sim: SIM.VSELLO },
      { marcador: "AN_JUNTA", sim: SIM.ANJUNTA },
      { marcador: "T_RASLP", sim: SIM.TRASLP },
      { marcador: "E_JUNTA", sim: SIM.EJUNTA },
      { marcador: "L_JUNTA", sim: SIM.LJUNTA },
      { marcador: "N_LADO", sim: SIM.NLADO },
      { marcador: "CANT_JUNTA", sim: SIM.CANTJUNTA },
    ]);
    y += 20;
    doc.setTextColor(20, 20, 20);

    const tokensVSelloJ = [mvs("LJUNTA"), mop("×"), mop("("), mvs("ANJUNTA"), mop("+"), mc("2"), mop("×"), mvs("TRASLP"), mop(")"), mop("×"), mvs("EJUNTA"), mop("×"), mvs("NLADO"), mop("×"), mvs("CANTJUNTA")];
    y = dibujarFormulaCompleta(doc, marginL, y, [mvs("VSELLO")], tokensVSelloJ, anchoContenido);
    y += 10;
    y = dibujarListaVariables(doc, marginL, y, [SIM.VSELLO, SIM.LJUNTA, SIM.ANJUNTA, SIM.TRASLP, SIM.EJUNTA, SIM.NLADO, SIM.CANTJUNTA], null, anchoContenido);
    y += 14;

    saltoDePaginaSiHaceFalta(120);
    const notaTopada = "Junta topada (AN_JUNTA = 0) — CP 606, CFS SIL GG y FS ONE MAX: V_SELLO = 0,783 × E_JUNTA² × L_JUNTA × CANT_JUNTA. CFS SP WB: V_SELLO = T_RASLP × 2 × E_JUNTA × L_JUNTA × CANT_JUNTA.";
    y = dibujarParrafoConSimbolos(doc, marginL, y, notaTopada, MC_BODY - 0.5, anchoContenido, [
      { marcador: "AN_JUNTA", sim: SIM.ANJUNTA },
      { marcador: "V_SELLO", sim: SIM.VSELLO },
      { marcador: "E_JUNTA", sim: SIM.EJUNTA },
      { marcador: "L_JUNTA", sim: SIM.LJUNTA },
      { marcador: "CANT_JUNTA", sim: SIM.CANTJUNTA },
      { marcador: "T_RASLP", sim: SIM.TRASLP },
    ]);
    y += 22;
    doc.setTextColor(20, 20, 20);

    saltoDePaginaSiHaceFalta(180);
    doc.setFont("helvetica", "bold"); doc.setFontSize(MC_BODY + 0.5); doc.setTextColor(20, 20, 20);
    doc.text("Lana mineral (cuando aplica)", marginL, y); y += 15;
    doc.setFont("helvetica", "normal"); doc.setFontSize(MC_BODY); doc.setTextColor(80, 80, 80);
    const introLana = "Para la mayoría de combinaciones, el volumen de lana mineral (V_LANA) se calcula con la longitud, el ancho y el espesor de pared adyacente (E_PARED), afectado por el factor de compresión del sistema UL (F_COMP). En Muro Cortina, Entrepiso-Entrepiso y Pared-Entrepiso Lateral se calcula por área (A_LANA) en vez de por volumen, sin E_PARED. El resultado en cm3/cm2 se convierte luego a unidades de plancha (122×61 cm).";
    y = dibujarParrafoConSimbolos(doc, marginL, y, introLana, MC_BODY, anchoContenido, [
      { marcador: "V_LANA", sim: SIM.VLANA },
      { marcador: "E_PARED", sim: SIM.EPARED },
      { marcador: "F_COMP", sim: SIM.FCOMP },
      { marcador: "A_LANA", sim: SIM.ALANA },
    ]);
    y += 18;
    const tokensVLana = [mvs("LJUNTA"), mop("×"), mvs("ANJUNTA"), mop("×"), mvs("EPARED"), mop("×"), mop("("), mc("1"), mop("+"), mvs("FCOMP"), mop(")")];
    y = dibujarFormulaCompleta(doc, marginL, y, [mvs("VLANA")], tokensVLana, anchoContenido);
    y += 10;
    y = dibujarListaVariables(doc, marginL, y, [SIM.VLANA, SIM.LJUNTA, SIM.ANJUNTA, SIM.EPARED, SIM.FCOMP], null, anchoContenido);
    y += 20;
    doc.setTextColor(20, 20, 20);

    const gruposJ = {};
    computedJ.forEach(r => { if (!r.producto) return; (gruposJ[r.producto] = gruposJ[r.producto] || []).push(r); });

    Object.keys(gruposJ).forEach(producto => {
      const filas = gruposJ[producto];
      saltoDePaginaSiHaceFalta(220);
      doc.setFont("helvetica", "bold"); doc.setFontSize(MC_TITULO_SUB); doc.setTextColor(226, 0, 26);
      doc.text(producto, marginL, y); y += 18;

      const ej = filas[0];
      const lanaUnidEj = ej.calcularLana ? lanaUnidadesSinRedondear(ej) * ej.cantidad : 0;
      doc.setFont("helvetica", "bold"); doc.setFontSize(MC_BODY + 0.5); doc.setTextColor(20, 20, 20);
      doc.text("Ejemplo de cálculo", marginL, y); y += 15;
      doc.setFont("helvetica", "normal"); doc.setFontSize(MC_BODY); doc.setTextColor(80, 80, 80);
      const lineaCasoJ = `Zona "${ej.A || "—"}", ${juntaLabelCorta(ej, ej.superiorInferior)}, barreras ${barrerasLabelCorto(ej.barreras)}, medidas ${fmtComa(ej.longitud, 0)}×${fmtComa(ej.ancho, 0)} cm, cantidad ${ej.cantidad}.`;
      const lsCasoJ = doc.splitTextToSize(lineaCasoJ, anchoContenido);
      doc.text(lineaCasoJ, marginL, y, { align: "justify", maxWidth: anchoContenido }); y += lsCasoJ.length * 13 + 16;
      doc.setTextColor(20, 20, 20);

      const valoresEjJ = {
        "L_JUNTA": `${fmtComa(ej.longitud, 0)} cm`,
        "AN_JUNTA": `${fmtComa(ej.ancho, 0)} cm`,
        "T_RASLP": ej.traslapeCm !== null && ej.traslapeCm !== undefined ? `${fmtComa(ej.traslapeCm, 2)} cm` : "—",
        "E_JUNTA": ej.espesorCm !== null && ej.espesorCm !== undefined ? `${fmtComa(ej.espesorCm, 2)} cm` : "—",
        "N_LADO": ej.lados === "Ambos lados" ? "2" : "1",
        "CANT_JUNTA": String(ej.cantidad),
      };
      const valorFinalVJ = [mc(String(roundup(ej.volumenSellador * ej.cantidad, 0)) + " "), mc("cm", "3")];
      y = dibujarFormulaEjemplo(doc, marginL, y, [mvs("VSELLO")], tokensVSelloJ, valoresEjJ, valorFinalVJ, anchoContenido);
      y += 14;

      doc.setFont("helvetica", "italic"); doc.setFontSize(MC_BODY - 0.5); doc.setTextColor(110, 110, 110);
      const lineaLanaJ = ej.calcularLana ? `Lana mineral: ${lanaUnidEj > 0 ? fmtComa(lanaUnidEj, 2) + " unidad(es) de plancha" : "cantidad menor a 1 unidad"}.` : "Lana mineral: no aplica para esta configuración.";
      const lsLanaJ = doc.splitTextToSize(lineaLanaJ, anchoContenido);
      doc.text(lineaLanaJ, marginL, y, { align: "justify", maxWidth: anchoContenido }); y += lsLanaJ.length * 12 + 16;
      doc.setFont("helvetica", "normal"); doc.setTextColor(20, 20, 20);

      const headJ = ["Zona", "Nivel", "Cant.", "Junta", "L_JUNTA (cm)", "AN_JUNTA (cm)", "E_JUNTA (in)", "V_SELLO (cm3)", "Lana (unid.)"];
      doc.autoTable({
        startY: y,
        margin: tableMargin,
        head: [headJ],
        body: filas.map(r => {
          const lanaUnid = r.calcularLana ? lanaUnidadesSinRedondear(r) * r.cantidad : 0;
          return [
            r.A || "-", r.B || "-", String(r.cantidad),
            juntaLabelCorta(r, r.superiorInferior),
            fmtComa(r.longitud, 0), fmtComa(r.ancho, 0),
            r.espesorProductoIn !== null && r.espesorProductoIn !== undefined ? formatFraccionPulgadas(r.espesorProductoIn) : "—",
            fmtComa(roundup(r.volumenSellador * r.cantidad, 0), 0),
            r.calcularLana ? (lanaUnid > 0 ? fmtComa(lanaUnid, 2) : "—") : "No aplica",
          ];
        }),
        styles: { fontSize: MC_TABLA, cellPadding: 2.5, halign: "center" },
        headStyles: { fillColor: [26, 26, 26], textColor: 255, fontStyle: "normal" },
        columnStyles: { 7: { fontStyle: "bold" } },
        didDrawPage: () => dibujarCabecera(),
        didDrawCell: renderizarCabeceraConSimbolos(headJ),
      });
      y = doc.lastAutoTable.finalY + 26;
    });
  }

  const totalPaginas = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPaginas; p++) { doc.setPage(p); dibujarNumeroPaginaPDF(doc, p, totalPaginas); }
  return doc;
}

function descargarMemoriaCalculoPDF() {
  try {
    const doc = construirMemoriaCalculoPDF();
    if (!doc) { mostrarToast("No hay penetrantes ni juntas con datos completos para generar la memoria de cálculo.", "error"); return; }
    const nombre = (PROJECT_INFO.nombre || "proyecto").replace(/[^a-z0-9\-_ ]/gi, "").trim().replace(/\s+/g, "-") || "proyecto";
    window.compartirODescargarPDF(doc, `${nombre}-memoria-calculo.pdf`, {
      titulo: `Memoria de Cálculo — ${PROJECT_INFO.nombre || "proyecto"}`,
      texto: `Memoria de cálculo de sello cortafuego para ${PROJECT_INFO.nombre || "el proyecto"}.`,
    });
  } catch (err) {
    mostrarToast("No se pudo generar la memoria de cálculo: " + err.message, "error");
  }
}

// ============================================================================

// --- Exports usados por otros módulos ---
window.descargarMemoriaCalculoPDF = descargarMemoriaCalculoPDF;
})();
