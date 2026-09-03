// ============================================================================
// calc-engine.js — encapsulado en IIFE (sin exponer todo a window; ver export list abajo)
// ============================================================================
(function () {
// ============================================================================
// calc-engine.js
// Motor de cálculo — réplica de la hoja CALCULADORA del Excel Hilti: computeRow, computeResumen, y las funciones de apoyo (dbKey/dbLookup, longitud de cinta y collar).
// (Parte del proyecto Calculadora Cortafuego Hilti — ver README.md para el mapa completo de módulos.)
// ============================================================================

function dbKey(N, L, M, AP, P) {
  const s = (v) => (v === null || v === undefined) ? "" : String(v);
  return `${s(N)}${s(L)}${s(M)}${s(AP)}${s(P)}`;
}
// devuelve [espesor, norma1, link1, norma2, link2, norma3, link3, norma4, link4, norma5, link5]
function dbLookup(key) {
  return MAIN_TABLE[key] || null;
}
function dbNormaLink(key, band) {
  // band: 1..5 -> offsets (norma,link) = (3,4)/(5,6)/(7,8)/(9,10)/(11,12) => index in array (0-based, array starts at J=offset2)
  // array index0=J(espesor), idx1=K idx2=L idx3=M idx4=N idx5=O idx6=P idx7=Q idx8=R idx9=S idx10=T
  const row = dbLookup(key);
  if (!row) return null;
  const map = { 1: [1, 2], 2: [3, 4], 3: [5, 6], 4: [7, 8], 5: [9, 10] };
  const [ni, li] = map[band];
  const norma = row[ni], link = row[li];
  if (isBlank(norma)) return null;
  return { norma, link };
}
function dbEspesor(key) {
  const row = dbLookup(key);
  if (!row) return null;
  return row[0];
}

function pvcLookup(diamCode, table) {
  // table: array of [diametro, cinta, collar]; diamCode matches col C (diametro)
  const arr = table === "no_aislada" ? PVC_TABLES.pvc_no_aislada : PVC_TABLES.pvc_aislada;
  for (const r of arr) {
    if (n(r[0]) === n(diamCode)) return r; // [diametro, cinta_cm, collar_cm]
  }
  return null;
}

// Longitud de collar (cm): circunferencia del tubo YA envuelto en cinta (diámetro
// inflado por 2 x vueltas x 3/16") + traslape fijo de la ceja del collar (~2").
// Fórmula validada contra los valores ya confirmados de la tabla (diam 3,4,6,8 —
// reproduce esos valores exactos), usada para separar concreto (menos vueltas) de
// gypsum en diám 2.5"/3" donde antes se usaba una sola tabla sin distinguir pared.
// Ver GUIA-CONTINUIDAD 6.2 y confirmación de Kevin sobre traslape ~2" fijo.
function collarLongitud(diamPulg, nVueltas) {
  const dInflado = diamPulg + 2 * nVueltas * (3 / 16);
  return 3.14 * dInflado * 2.54 + 2 * 2.54;
}

// ============================================================================
// Tabla OFICIAL de longitud de cinta intumescente CP 648-E (cm), tomada tal
// cual del documento "Fórmulas Cálculos Sellos Cortafuego" (Word de Kevin),
// por diámetro total de penetrante (in) y N° de vueltas de cinta según el
// sistema UL correspondiente (1 a 4 vueltas). null = combinación no listada
// por Hilti para ese diámetro (muy pocas vueltas para un tubo grande, o
// viceversa).
//
// La fila de 14" a 4 vueltas NO viene en el documento (que llega hasta 12") —
// es una extrapolación lineal pedida por Kevin, usando los dos últimos puntos
// conocidos de la columna de 4 vueltas: 10"->367.0cm y 12"->431.8cm.
//   pendiente = (431.8 - 367.0) / (12 - 10) = 32.4 cm por pulgada
//   14" = 431.8 + 32.4*2 = 496.6 cm
// ============================================================================
const TABLA_LONGITUD_CINTA_648E = [
  // [diam_in, 1 vuelta, 2 vueltas, 3 vueltas, 4 vueltas]
  [1.5, 17.1, 36.8, 59.4, null],
  [2, 21.0, 45.1, 71.8, null],
  [3, 29.8, 62.2, 96.8, 134.9],
  [4, 38.1, 77.2, 120.0, 166.7],
  [6, null, 111.8, 173.0, 236.2],
  [8, null, null, 220.3, 299.1],
  [10, null, null, null, 367.0],
  [12, null, null, null, 431.8],
  // 13" y 14" a 4, 5 y 6 vueltas: NO vienen en el documento de Kevin (llega hasta
  // 12" y 4 vueltas). Necesarios para el caso "3x6" (3 tiras de 6 vueltas) que
  // arroja la tabla de vueltas para tubería combustible aislada en ese rango de
  // diámetro. Kevin confirmó 04/08/2026 el método de extrapolación:
  //   1) v4 se extrapola linealmente igual que arriba (pendiente 32.4cm/in entre
  //      10" y 12"): 13"->464.2cm, 14"->496.6cm.
  //   2) La vuelta k-ésima se modela geométricamente igual que collarLongitud():
  //      cada vuelta envuelve un diámetro que ya creció 2×(k-1)×3/16" por las
  //      vueltas anteriores (mismo espesor de cinta 3/16" que ya usa el collar).
  //      wrap_k(d) = 3.14 × (d + 2×(k-1)×3/16) × 2.54
  //      v5 = v4 + wrap_5(d)   ;   v6 = v5 + wrap_6(d)
  //   13": wrap5=115.65, v5=579.85, wrap6=118.64, v6=698.48
  //   14": wrap5=123.62, v5=620.22, wrap6=126.61, v6=746.83
  [13, null, null, null, 464.2, 579.85, 698.48],
  [14, null, null, null, 496.6, 620.22, 746.83],
];

// Longitud de la vuelta k-ésima (cm), modelo geométrico consistente con
// collarLongitud(): cada vuelta envuelve un diámetro que ya creció por el
// espesor de la(s) vuelta(s) anterior(es) — 3/16" por vuelta, igual que el
// collar. Se usa SOLO para extender la tabla oficial más allá de 4 vueltas
// (casos "3x6"), nunca para reemplazar un valor que sí viene en el documento.
function longitudVueltaExtra(diamIn, kEsima) {
  return 3.14 * (diamIn + 2 * (kEsima - 1) * (3 / 16)) * 2.54;
}

// Longitud total de cinta (cm) para instalaciones multi-tira tipo "2x4" o "3x6"
// (N tiras de M vueltas cada una): N × longitud de una tira de M vueltas.
function longitudCintaMultiTira(diamIn, codigoTiras) {
  const [tiras, vueltasPorTira] = codigoTiras.split("x").map(Number);
  const Lc = longitudCintaPorVueltas(diamIn, vueltasPorTira);
  return Lc !== null ? tiras * Lc : null;
}

// Longitud total de collar (cm) para instalaciones multi-tira tipo "2x4" o
// "3x6": un collar SEPARADO por cada tira (confirmado por Kevin 04/08/2026),
// cada uno dimensionado para el diámetro base del penetrante con las vueltas
// de esa tira — N tiras × collarLongitud(diamIn, vueltas de esa tira).
function longitudCollarMultiTira(diamIn, codigoTiras) {
  const [tiras, vueltasPorTira] = codigoTiras.split("x").map(Number);
  return tiras * collarLongitud(diamIn, vueltasPorTira);
}

// Longitud de cinta (cm) para un N° de vueltas EXACTO (1-4), interpolando o
// extrapolando linealmente en diámetro contra los puntos conocidos de esa
// columna en TABLA_LONGITUD_CINTA_648E. Devuelve null si esa columna de
// vueltas no tiene ningún dato (no debería pasar para 1-4).
function longitudCintaPorVueltas(diamIn, nVueltas) {
  const col = nVueltas; // columnas 1..4 corresponden a índices 1..4 de cada fila
  const puntos = TABLA_LONGITUD_CINTA_648E
    .filter((r) => r[col] !== null && r[col] !== undefined)
    .map((r) => [r[0], r[col]])
    .sort((a, b) => a[0] - b[0]);
  if (puntos.length === 0) return null;
  if (puntos.length === 1) return puntos[0][1];
  if (diamIn <= puntos[0][0]) {
    const [d1, v1] = puntos[0], [d2, v2] = puntos[1];
    return v1 + ((diamIn - d1) / (d2 - d1)) * (v2 - v1);
  }
  if (diamIn >= puntos[puntos.length - 1][0]) {
    const [d1, v1] = puntos[puntos.length - 2], [d2, v2] = puntos[puntos.length - 1];
    return v1 + ((diamIn - d1) / (d2 - d1)) * (v2 - v1);
  }
  let i = 0;
  while (diamIn > puntos[i + 1][0]) i++;
  const [d1, v1] = puntos[i], [d2, v2] = puntos[i + 1];
  return v1 + ((diamIn - d1) / (d2 - d1)) * (v2 - v1);
}

// ---------------------------------------------------------------------------
// computeRow: replica columnas S..AP para una fila de datos
// input = {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P}  (según encabezados del Excel)
// config = {C13,C14,C15} espesores de pared/entrepiso
// ---------------------------------------------------------------------------
function computeRow(row, config) {
  const { C, D, E, F, G, H, I, J, K, L, M, N, O, P, MEM, PPINST, PPSIZE } = row;
  const out = {};
  // Propagar campos de identificación al out — la normativa y la UI los necesitan
  // desde las computed rows sin tener que cruzar con ROWS originales.
  out._id = row._id;
  out.P = P;
  out.L = L;
  out.M = M;
  out.N = N;
  out.A = row.A;
  out.B = row.B;
  // Propagar AJ_override al out para que sumIfAJ lo vea en las filas computadas
  out.AJ_override = row.AJ_override || null;

  // AP: Espacio anular check
  const AP = (n(C) === 0) ? "-" : (n(I) === 0 ? 0 : "Otro");
  out.AP = AP;

  // T: espesor de pared/losa asumido
  let T;
  if (eq(N, "Panel de Yeso") && eq(M, "Pared")) T = config.C14;
  else if (eq(N, "Concreto") && eq(M, "Pared")) T = config.C13;
  else if (eq(N, "Concreto") && eq(M, "Entrepiso")) T = config.C15;
  else T = "-";
  out.T = T;

  // S: cantidad de lados (Membrana en pared = 1 lado, igual que Entrepiso)
  const S = (n(C) === 0) ? "-" : ((eq(M, "Entrepiso") || (eq(M, "Pared") && MEM)) ? 1 : 2);
  out.S = S;

  // U: área de apertura (cm2) — desglosado en variables con nombre (D_TOTAL,
  // A_PEN, A_PAS, A_DUCT, A_VIGA, P_VIGA, DA_TOTAL, DB_TOTAL, ANULAR_CM) para
  // que la Memoria de Cálculo pueda mostrar cada paso de la fórmula. Es una
  // pura descomposición: el valor final de U es idéntico a como se calculaba
  // antes, solo con nombres a las variables intermedias.
  let U, D_TOTAL = "-", A_PEN = "-", A_PAS = "-", A_DUCT = "-", A_VIGA = "-", P_VIGA = "-", DA_TOTAL = "-", DB_TOTAL = "-", ANULAR_CM = "-";
  if (n(C) === 0) {
    U = "-";
  } else if (isBlank(F) && eq(L, TIPO_VACIO)) {
    // Vacío redondo: es un agujero vacío, no una tubería — el área a sellar es
    // el círculo completo, sin sumar espacio anular ni restar área de "pasante"
    // (no hay nada adentro). Fórmula del Word (05/08/2026): A_SELLO = π/4 × DIÁM.²
    // — reemplaza la aproximación anterior (circunscribir el círculo en un
    // cuadrado de lado = diámetro), que además tenía un bug: el diámetro
    // elegido en Levantamiento nunca se leía y quedaba en 0.
    D_TOTAL = n(D) * 2.54;
    U = 3.14 / 4 * Math.pow(D_TOTAL, 2);
  } else if (isBlank(F)) {
    ANULAR_CM = n(I) === 0 ? 1.27 : n(I) * 2.54;
    D_TOTAL = (n(D) + 2 * n(E)) * 2.54;
    A_PEN = 3.14 / 4 * Math.pow(D_TOTAL, 2);
    A_PAS = 3.14 / 4 * Math.pow(D_TOTAL + ANULAR_CM * 2, 2);
    U = A_PAS - A_PEN;
  } else if ((eq(L, TIPO_DUCTO_RECT) || eq(L, TIPO_DUCTO_RED) || eq(L, TIPO_DUCTO_RECT_AISL) || eq(L, TIPO_DUCTO_RED_AISL)) && n(I) === 0) {
    ANULAR_CM = 1.27;
    DA_TOTAL = n(F) + 2 * n(E) * 2.54;
    DB_TOTAL = n(G) + 2 * n(E) * 2.54;
    A_DUCT = DA_TOTAL * DB_TOTAL;
    A_PAS = (DA_TOTAL + 2 * ANULAR_CM) * (DB_TOTAL + 2 * ANULAR_CM);
    U = A_PAS - A_DUCT;
  } else if (eq(L, TIPO_DUCTO_RECT) || eq(L, TIPO_DUCTO_RED) || eq(L, TIPO_DUCTO_RECT_AISL) || eq(L, TIPO_DUCTO_RED_AISL)) {
    ANULAR_CM = n(I) * 2.54;
    DA_TOTAL = n(F) + 2 * n(E) * 2.54;
    DB_TOTAL = n(G) + 2 * n(E) * 2.54;
    A_DUCT = DA_TOTAL * DB_TOTAL;
    A_PAS = (DA_TOTAL + 2 * ANULAR_CM) * (DB_TOTAL + 2 * ANULAR_CM);
    U = A_PAS - A_DUCT;
  } else if (eq(L, TIPO_VIGA_W) && n(I) === 0) {
    ANULAR_CM = 1.27;
    P_VIGA = 2 * n(F) + 4 * n(G);
    U = P_VIGA * ANULAR_CM;
  } else if (eq(L, TIPO_VIGA_W)) {
    ANULAR_CM = n(I) * 2.54;
    P_VIGA = 2 * n(F) + 4 * n(G);
    U = P_VIGA * ANULAR_CM;
  } else if (eq(L, TIPO_VIGA_CANAL) && n(I) === 0) {
    ANULAR_CM = 1.27;
    P_VIGA = 2 * n(F) + 1 * n(G);
    U = P_VIGA * ANULAR_CM;
  } else if (eq(L, TIPO_VIGA_CANAL)) {
    ANULAR_CM = n(I) * 2.54;
    P_VIGA = 2 * n(F) + 1 * n(G);
    U = P_VIGA * ANULAR_CM;
  } else if (eq(L, TIPO_VIGA_TUBO) && n(I) === 0) {
    ANULAR_CM = 1.27;
    A_VIGA = n(F) * n(G);
    A_PAS = (n(F) + 2 * ANULAR_CM) * (n(G) + 2 * ANULAR_CM);
    U = A_PAS - A_VIGA;
  } else if (eq(L, TIPO_VIGA_TUBO)) {
    ANULAR_CM = n(I) * 2.54;
    A_VIGA = n(F) * n(G);
    A_PAS = (n(F) + 2 * ANULAR_CM) * (n(G) + 2 * ANULAR_CM);
    U = A_PAS - A_VIGA;
  } else {
    ANULAR_CM = n(I) * 2.54;
    DA_TOTAL = n(F) + 2 * ANULAR_CM;
    DB_TOTAL = n(G) + 2 * ANULAR_CM;
    U = DA_TOTAL * DB_TOTAL * (1 - n(J));
  }
  out.A_SELLO = U; // valor por unidad (antes de ×C_ANT), tal como lo define el documento de fórmulas
  if (U !== "-") U = U * n(C);
  out.U = U;
  out.D_TOTAL = D_TOTAL; out.A_PEN = A_PEN; out.A_PAS = A_PAS; out.A_DUCT = A_DUCT;
  out.A_VIGA = A_VIGA; out.P_VIGA = P_VIGA; out.DA_TOTAL = DA_TOTAL; out.DB_TOTAL = DB_TOTAL; out.ANULAR_CM = ANULAR_CM;

  // Q: NORMATIVA
  const key = dbKey(N, L, M, AP, P);
  // band 1..5 -> [norma_index, link_index] en el array MAIN_TABLE[key] (0-based, arranca en J)
  const BAND_IDX = { 1: [1, 2], 2: [3, 4], 3: [5, 6], 4: [7, 8], 5: [9, 10] };
  function hy(band) {
    const row2 = dbLookup(key);
    if (!row2) return ERR_MATERIAL;
    const [ni, li] = BAND_IDX[band];
    const norma = row2[ni], link = row2[li];
    if (isBlank(norma) || isBlank(link)) return ERR_MATERIAL;
    return { text: norma, link };
  }
  let Q;
  if (eq(L, TIPO_CABLE_REPEN) && n(D) > 3.5 / 2.54) {
    Q = "Revisar diámetro del cable!";
  } else if ((n(F) * n(G) + 2 * n(F) * n(H) + 2 * n(G) * n(H)) > 941.9336 && eq(L, TIPO_CAJA_UL)) {
    Q = hy(2);
  } else if (eq(P, MAT_COLLARIN) && n(D) <= 2 && eq(L, TIPO_TUB_COMB)) {
    // PVC sin aislar ≤2": el collarín no aplica, hay que usar Pasta u otro.
    // Para PVC aislado y Cobre HVAC aislado el collarín sí aplica desde 1.5".
    Q = MSG_CAMBIAR_1;
  } else if (eq(P, MAT_COLLARIN) && n(D) > 10) {
    // Collarín no existe en talla >10" — aplica a todos los tipos de tubería.
    Q = ERR_MATERIAL;
  } else if (eq(L, TIPO_TUB_COBRE_HVAC) && eq(P, MAT_COLLARIN)) {
    // Cobre HVAC aislado con collarín: aplica para cualquier diámetro hasta 10".
    // La restricción >10" la maneja la rama MAT_COLLARIN && D>10 más abajo.
    if (n(D) <= 7 / 8 && n(E) <= 1 / 2) Q = hy(1);
    else Q = hy(2);
  } else if (eq(L, TIPO_TUB_COBRE_HVAC) && (eq(P, MAT_CINTA_CON) || eq(P, MAT_CINTA_SIN))) {
    if (n(D) <= 7 / 8 && n(E) <= 1 / 2) Q = hy(1);
    else Q = hy(2);
  } else if (eq(L, TIPO_TUB_METAL) && (eq(P, MAT_CINTA_CON) || eq(P, MAT_CINTA_SIN))) {
    Q = MSG_CAMBIAR_1;
  } else if ((eq(L, TIPO_TUB_COMB) || eq(L, TIPO_TUB_COMB_AISL)) && (eq(P, MAT_CP606) || eq(P, MAT_CFS_SIL_GG))) {
    Q = ERR_COMBUSTIBLE_SELLADOR;
  } else if ((n(D) + 2 * n(E)) > 14 && (eq(L, TIPO_TUB_COMB) || eq(L, TIPO_TUB_COMB_AISL))) {
    Q = ERR_JUICIO;
  } else if (n(D) <= 0.1 && eq(L, TIPO_TUB_COMB_AISL) && (eq(P, MAT_CINTA_CON) || eq(P, MAT_CINTA_SIN))) {
    Q = MSG_CAMBIAR_2;
  } else if (n(D) <= 2 && eq(L, TIPO_TUB_COMB) && (eq(P, MAT_CINTA_CON) || eq(P, MAT_CINTA_SIN))) {
    Q = MSG_CAMBIAR_2;
  } else if (isBlank(C)) {
    Q = "-";
  } else if (eq(M, "Entrepiso") && eq(N, "Panel de Yeso")) {
    Q = ERR_JUICIO;
  } else if (isBlank(P)) {
    Q = "-";
  } else if (eq(L, TIPO_TUB_COMB) && n(D) > 2 && (eq(P, MAT_PASTA) || eq(P, MAT_CP606) || eq(P, MAT_CFS_SIL_GG))) {
    Q = ERR_MATERIAL;
  } else if (eq(L, TIPO_TUB_COMB_AISL) && eq(N, "Concreto") && eq(P, MAT_PASTA) && (n(D) + 2 * n(E)) > 2) {
    Q = ERR_MATERIAL;
  } else if (eq(L, TIPO_TUB_COMB_AISL) && eq(N, "Panel de Yeso") && eq(P, MAT_PASTA) && (n(D) + 2 * n(E)) > 1.5) {
    Q = ERR_MATERIAL;
  } else if ((eq(L, TIPO_TUB_COMB) || eq(L, TIPO_TUB_COMB_AISL)) && (eq(P, MAT_CINTA_CON) || eq(P, MAT_CINTA_SIN))) {
    if (n(D) <= 4 && n(E) <= 1) Q = hy(1);
    else if ((n(D) + 2 * n(E)) <= 6) Q = hy(2);
    else if ((n(D) + 2 * n(E)) <= 8) Q = hy(3);
    else if ((n(D) + 2 * n(E)) <= 12) Q = hy(4);
    else if ((n(D) + 2 * n(E)) <= 14) Q = hy(5);
    else Q = ERR_JUICIO;
  } else {
    if (eq(K, TIPO_DUCTO_RED)) Q = hy(2);
    else Q = hy(1);
  }
  out.Q = Q;
  const Qtext = (typeof Q === "object" && Q) ? Q.text : Q;
  out.Qtext = Qtext;
  out.Qlink = (typeof Q === "object" && Q) ? Q.link : null;

  // V: espesor de sellador / espesor de espuma (según Base de datos, col
  // espesor=offset2=idx0) — para Espuma CP 620 este valor es el espesor de
  // espuma (E_ESPUMA) definido por sistema UL, no el espesor de pared/losa
  // del proyecto (T). Antes había una rama especial que sustituía por T;
  // se retiró el 10/08/2026 a pedido de Kevin — cada sistema UL ahora trae
  // su propio E_ESPUMA en la base de datos.
  let V;
  const dbEsp = dbEspesor(key);
  V = (dbEsp === null || dbEsp === undefined) ? "-" : dbEsp;
  out.V = V;

  // Lana mineral: si la pared es delgada (T ≤ 12.5cm) se calcula por ÁREA
  // (como antes, sin multiplicador); si es gruesa (T > 12.5cm) se calcula
  // por VOLUMEN (área × profundidad de cavidad, no simplemente ×2) — mismo
  // criterio que ya usa Juntas para lanaAreaCm2/lanaVolumenCm3.
  const esParedGruesa = eq(M, "Pared") && T !== "-" && n(T) > 12.5;
  let aplicaLana = false;
  if ((eq(P, MAT_CINTA_CON) || eq(P, MAT_CINTA_SIN)) && n(I) !== 0) {
    aplicaLana = true;
  } else if (eq(P, MAT_COLLARIN) && n(I) !== 0 && neq(Qtext, ERR_MATERIAL) && Qtext !== MSG_CAMBIAR_1) {
    // Collarín con espacio anular: el aislamiento del tubo requiere lana mineral
    // para rellenar el espacio, igual que la pasta con espacio anular.
    aplicaLana = true;
  } else if ((eq(P, MAT_PASTA) || eq(P, MAT_CP606) || eq(P, MAT_CFS_SIL_GG)) &&
             neq(Qtext, ERR_MATERIAL) && Qtext !== ERR_COMBUSTIBLE_SELLADOR) {
    // CP 606 y CFS SIL GG son selladores igual que la pasta: si hay espacio
    // anular (o es gaveta/vacío/bandeja, donde el relleno es obligatorio) la
    // lana mineral se calcula exactamente igual que con FS ONE MAX — incluida
    // la rama de pared gruesa por volumen. Antes esto vivía aparte en AL/AN,
    // solo por área y sin cubrir las gavetas sin espacio anular (bug real
    // reportado por Kevin 03/09/2026).
    if (eq(L, TIPO_VACIO) || eq(L, TIPO_PASANTE_MULT) || eq(L, TIPO_BANDEJA)) aplicaLana = true;
    else aplicaLana = n(I) !== 0;
  }
  let lanaAreaCm2Pen = 0, lanaVolumenCm3Pen = 0;
  if (aplicaLana) {
    if (esParedGruesa && V !== "-") {
      lanaVolumenCm3Pen = n(U) * Math.max(0, n(T) - 2 * n(V) * 2.54);
    } else {
      lanaAreaCm2Pen = n(U);
    }
  }
  out.lanaAreaCm2Pen = lanaAreaCm2Pen;
  out.lanaVolumenCm3Pen = lanaVolumenCm3Pen;
  out.esVolumenLana = lanaVolumenCm3Pen > 0;
  // Cantidad de lana SIN redondear, fila por fila (ej. 0.15, 1.54) — el
  // redondeo y el % de desperdicio se aplican una sola vez, sobre la suma
  // de todas las filas, en Cuantificación de Materiales — no acá.
  out.lanaUnidPen = lanaVolumenCm3Pen > 0 ? lanaVolumenCm3Pen / (122 * 61 * 10)
    : (lanaAreaCm2Pen > 0 ? lanaAreaCm2Pen / (122 * 61) : 0);
  // X: se mantiene por compatibilidad (memoria de cálculo / detalle en
  // pantalla) — representa el que esté activo de los dos anteriores.
  const X = lanaVolumenCm3Pen > 0 ? lanaVolumenCm3Pen : (lanaAreaCm2Pen > 0 ? lanaAreaCm2Pen : "-");
  out.X = X;

  // Y: volumen de sellador (cm3) para pasta/cinta/collarin
  let Y;
  if ((eq(P, MAT_CINTA_CON) || eq(P, MAT_CINTA_SIN)) &&
      (eq(L, TIPO_TUB_COBRE_HVAC) || eq(L, TIPO_TUB_COMB) || eq(L, TIPO_TUB_COMB_AISL)) && n(I) === 0) {
    Y = "-";
  } else if (eq(P, MAT_ALMOHADILLA)) {
    Y = 2 * 3.14 * Math.sqrt((n(J) * n(F) * n(G)) / 3.14) * 1.27 * 1.27 * 3 * n(C);
  } else if ((eq(P, MAT_PASTA) || eq(P, MAT_CINTA_SIN) || eq(P, MAT_CINTA_CON) || eq(P, MAT_COLLARIN)) && neq(Qtext, ERR_MATERIAL)) {
    if (n(C) === 0 || V === "-") Y = "-";
    else Y = n(U) * (n(V) * 2.54) * n(S);
  } else {
    Y = "-";
  }
  out.Y = Y;

  // Z: longitud de collar metálico (cm) [solo Cinta con Collar]
  // Fórmula única del Word: L_COLTUB = pi*(d_total+2*N_VUELTAS*3/16")+2" (ya
  // implementada en collarLongitud()), usando el mismo N_VUELTAS real de
  // vueltasCintaPenetrante() que ya se usa para la cinta y para mostrar
  // N_VUELTAS en la Memoria — reemplaza las ramas viejas por diámetro/tipo
  // que quedaban desincronizadas para diámetros grandes (ej. 6" aislada daba
  // 129,79cm en vez de 123,81cm). Multi-tira ("2x4"/"3x6"): un collar
  // SEPARADO por cada tira, confirmado por Kevin 04/08/2026.
  let Z;
  // L_COLTUB: longitud de collar por diámetro de tubería, sin ×S_LADOS×C_ANT — para mostrar el
  // paso intermedio en Memoria de Cálculo. En multi-tira ("2x4"/"3x6") YA incluye el multiplicador
  // de tiras (2 o 3), por pedido de Kevin 05/08/2026, así L_COLTOT = L_COLTUB × S_LADOS × C_ANT ×
  // (1+%DESP) queda consistente también para esos casos (antes L_COLTUB solo era 1 tira y el
  // multiplicador de tiras quedaba "escondido" dentro de Z, sin verse en la Memoria).
  let LcoltubZ = "-";
  if (neq(P, MAT_CINTA_CON)) Z = "-";
  else if (Qtext === MSG_CAMBIAR_1 || Qtext === MSG_CAMBIAR_2 || Qtext === ERR_JUICIO) Z = "-";
  else if (n(D) <= 0.1 && neq(L, TIPO_TUB_COBRE_HVAC)) Z = "-";
  else {
    const dTotalZ = n(D) + 2 * n(E);
    const nvZ = vueltasCintaPenetrante(row);
    if (nvZ === null) Z = "-";
    else if (typeof nvZ === "number") LcoltubZ = collarLongitud(dTotalZ, nvZ);
    else LcoltubZ = longitudCollarMultiTira(dTotalZ, nvZ);
    Z = (nvZ === null) ? "-" : LcoltubZ * n(C) * n(S);
  }
  out.Z = Z;
  out.collarLcoltubPen = LcoltubZ;


  // AA: longitud de cinta metálica (cm) [Cinta con Collar]
  let AA;
  if (neq(P, MAT_CINTA_CON)) AA = "-";
  else if (Qtext === MSG_CAMBIAR_1 || Qtext === MSG_CAMBIAR_2 || Qtext === ERR_JUICIO) AA = "-";
  else if (n(D) <= 0.1 && eq(L, TIPO_TUB_COMB_AISL) && (eq(P, MAT_CINTA_CON) || eq(P, MAT_CINTA_SIN))) AA = "-";
  else if (n(D) <= 2 && neq(L, TIPO_TUB_COBRE_HVAC) && neq(L, TIPO_TUB_COMB_AISL)) AA = "-";
  else if (eq(L, TIPO_TUB_COBRE_HVAC) && eq(P, MAT_CINTA_CON)) {
    if (n(D) <= 7 / 8 && n(E) <= 1 / 2) AA = (3.14 * (n(D) + 2 * n(E)) * 2.54 + 3.5) * n(S) * n(C);
    else AA = (3.14 * (n(D) + 2 * n(E)) * 2.54 + 3.14 * ((n(D) + 2 * n(E)) + 2 * (3 / 16)) * 2.54 + 3.5) * n(S) * n(C);
  } else if (eq(P, MAT_CINTA_CON) && neq(Qtext, ERR_MATERIAL)) {
    if (eq(L, TIPO_TUB_COMB_AISL) && neq(Qtext, ERR_MATERIAL)) {
      if (n(D) <= 2 && n(E) <= 1) AA = (3.14 * (n(D) + 2 * n(E)) * 2.54 + 2.5 * 2.54) * n(C) * n(S);
      else if (n(D) <= 4 && n(E) <= 1) AA = (3.14 * (n(D) + 2 * n(E) + 2 * (3 / 16)) * 2.54 + 3.14 * (n(D) + 2 * n(E) + 4 * (3 / 16)) * 2.54 + 3.14 * (n(D) + 2 * n(E) + 6 * (3 / 16)) * 2.54 + 3 * 2.54) * n(C) * n(S);
      else {
        // Diámetro grande: usar la tabla OFICIAL de longitud de cinta (Word) según
        // el N° de vueltas real de la tabla de vueltas ya validada (misma que se usa
        // para mostrar N_VUELTAS en la Memoria de Cálculo). Confirmado por Kevin
        // 04/08/2026: corrige el desfase que había en 8" (220cm viejo vs 299cm real).
        const nv = vueltasCintaPenetrante(row);
        const dTotal = n(D) + 2 * n(E);
        const Lc = (typeof nv === "number") ? longitudCintaPorVueltas(dTotal, nv) : longitudCintaMultiTira(dTotal, nv);
        AA = Lc !== null ? Lc * n(C) * n(S) : "-";
      }
    } else if (eq(L, TIPO_TUB_COMB) && neq(Qtext, ERR_MATERIAL)) {
      const nv = vueltasCintaPenetrante(row);
      const Lc = (typeof nv === "number") ? longitudCintaPorVueltas(n(D), nv) : longitudCintaMultiTira(n(D), nv);
      AA = Lc !== null ? Lc * n(C) * n(S) : "-";
    } else AA = "-";
  } else AA = "-";
  out.AA = AA;

  // AB: cantidad Putty Pads
  // Umbral: caja de 4-11/16" x 4-11/16" x 2-1/2" (444.1775 cm2) — por debajo de esto,
  // la instalación puede ser "por fuera" (cálculo sin redondear por fila, se redondea
  // solo el total del proyecto) o "por dentro" (fijo 1 por caja). Por encima del umbral
  // se mantiene la lógica original de multiplicador según F Rating.
  const UMBRAL_CAJA_CM2 = 444.1775;
  const AREA_EFECTIVA_7 = 272.5801; // (7"-0.5" traslape)^2 en cm2
  const AREA_EFECTIVA_9 = 466.1281; // (9"-0.5" traslape)^2 en cm2
  let AB;
  if (neq(P, MAT_PUTTY)) AB = "-";
  else if (isBlank(H) || n(H) === 0) AB = "-";
  else {
    const areaCaja = n(F) * n(G) + 2 * n(F) * n(H) + 2 * n(G) * n(H);
    const areaEfectiva = (n(PPSIZE) === 9) ? AREA_EFECTIVA_9 : AREA_EFECTIVA_7;
    out.A_CAJA = areaCaja;
    out.A_EF = areaEfectiva;
    if (areaCaja <= UMBRAL_CAJA_CM2) {
      if (eq(PPINST, "Dentro")) {
        AB = 1 * n(C); // instalación por dentro: siempre 1 pad por caja (pieza única doblada adentro)
      } else {
        // "por fuera": mínimo 1 pad por caja aunque la caja sea más chica que
        // el área efectiva de un solo Putty Pad (no se puede instalar una
        // fracción de pad) — sin redondear por fila más allá de ese mínimo,
        // se redondea el total del proyecto.
        const razon = Math.max(1, areaCaja / areaEfectiva);
        AB = razon * n(C);
      }
    } else {
      const mult = eq(O, "1 Hora") ? 2 : 4;
      const razonGrande = Math.max(1, areaCaja / areaEfectiva); // mismo mínimo de 1 pad por caja
      AB = razonGrande * mult * n(C); // caja grande: tampoco se redondea por fila, solo el total del proyecto
    }
  }
  out.AB = AB;

  // AC: volumen espuma CP620 (cm3)
  let AC;
  if (eq(P, MAT_ESPUMA) && neq(Qtext, ERR_MATERIAL)) {
    AC = (n(C) === 0) ? "-" : n(U) * n(V);
  } else AC = "-";
  out.AC = AC;

  // AD: cantidad almohadillas CFS-BL — A_BL (área cubierta por cada ladrillo) depende
  // de la orientación con la que el ladrillo entra en la pared, y esa orientación la
  // define el tamaño de la abertura, NO el código de sistema UL (mapeo viejo, menos
  // robusto, reemplazado 05/08/2026 según Word + Excel de sistemas UL actualizados):
  // Concreto + (Pasante Múltiple o Bandeja de Cables) con abertura grande
  // (DA_TOTAL o DB_TOTAL > 91.4cm) -> ladrillo entra por el lado de 20cm, queda
  // expuesto 13x5=65cm2. Cualquier otro caso -> entra por el lado de 13cm, queda
  // expuesto 20x5=100cm2 (incluye Vacío redondo, que siempre usa 100).
  let AD;
  if (neq(P, MAT_ALMOHADILLA)) AD = "-";
  else if (neq(Qtext, ERR_MATERIAL)) {
    const aberturaGrande = (DA_TOTAL !== "-" && n(DA_TOTAL) > 91.4) || (DB_TOTAL !== "-" && n(DB_TOTAL) > 91.4);
    const A_BL = (eq(N, "Concreto") && (eq(L, TIPO_PASANTE_MULT) || eq(L, TIPO_BANDEJA)) && aberturaGrande) ? 65 : 100;
    AD = roundup(n(U) / A_BL, 0);
    out.A_BL = A_BL;
  } else AD = "-";
  out.AD = AD;

  // Tabla de rendimiento por diámetro (usada en AE/AF/AG)
  function yieldByDiam(divisors) {
    const d = n(D);
    const thresholds = [0.118,0.138,0.157,0.177,0.197,0.216,0.236,0.256,0.275,0.314,0.354,0.394,0.433,0.491,0.59,0.708,0.786,0.983,1.179,0.1375];
    for (let i = 0; i < thresholds.length; i++) {
      if (d <= thresholds[i]) return n(C) / divisors[i];
    }
    return null;
  }
  // AE: Manga CP 653
  let AE;
  try {
    if (eq(P, MAT_MANGA) && neq(Qtext, ERR_MATERIAL)) {
      const v = yieldByDiam([819,596,451,356,287,240,199,164,141,109,85,61,50,38,26,19,14,8,7,3]);
      AE = v === null ? "-" : roundup(v, 0);
    } else AE = "-";
  } catch (e) { AE = "-"; }
  out.AE = AE;

  // AF: Paso de cables MSL M
  let AF;
  try {
    if (n(D) === 0) AF = "-";
    else if (eq(P, MAT_MSL_M) && neq(Qtext, ERR_MATERIAL)) {
      const v = yieldByDiam([486,368,280,216,176,150,117,96,88,70,54,40,35,24,15,12,8,6,2,2]);
      AF = v === null ? "-" : roundup(v, 0);
    } else AF = "-";
  } catch (e) { AF = "-"; }
  out.AF = AF;

  // AG: Paso de cables MSL L
  let AG;
  try {
    if (n(D) === 0) AG = "-";
    else if (eq(P, MAT_MSL_L) && neq(Qtext, ERR_MATERIAL)) {
      const v = yieldByDiam([1188,851,660,522,416,360,286,240,198,160,126,104,84,60,40,28,24,15,8,6]);
      AG = v === null ? "-" : roundup(v, 0);
    } else AG = "-";
  } catch (e) { AG = "-"; }
  out.AG = AG;

  // AH: longitud cinta sin collar (cm)
  let AH;
  if (neq(P, MAT_CINTA_SIN)) AH = "-";
  else if (Qtext === ERR_JUICIO) AH = "-";
  else if (eq(L, TIPO_TUB_COMB_AISL) && eq(P, MAT_CINTA_CON)) AH = "-";
  else if (n(D) <= 0.1 && eq(L, TIPO_TUB_COMB_AISL)) AH = "-";
  else if (eq(L, TIPO_TUB_COMB_AISL) && eq(P, MAT_CINTA_SIN) && neq(Qtext, ERR_MATERIAL)) {
    if (n(D) <= 2 && n(E) <= 1) AH = 3.14 * (n(D) + 2 * n(E)) * 2.54 + 2.5 * 2.54;
    else if (n(D) <= 4 && n(E) <= 1) AH = 3.14 * (n(D) + 2 * n(E) + 2 * (3 / 16)) * 2.54 + 3.14 * (n(D) + 2 * n(E) + 4 * (3 / 16)) * 2.54 + 3.14 * (n(D) + 2 * n(E) + 6 * (3 / 16)) * 2.54 + 3 * 2.54;
    else if ((n(D) + 2 * n(E)) > 6) {
      // Mismo fix que AA: usar la tabla oficial de longitud de cinta según N° de
      // vueltas real, en vez de la tabla vieja PVC_TABLES desincronizada.
      const nv = vueltasCintaPenetrante(row);
      const dTotal = n(D) + 2 * n(E);
      const Lc = (typeof nv === "number") ? longitudCintaPorVueltas(dTotal, nv) : longitudCintaMultiTira(dTotal, nv);
      AH = Lc !== null ? Lc * n(C) * n(S) : "-";
    } else AH = "-";
  } else if (n(D) <= 2 && neq(L, TIPO_TUB_COBRE_HVAC)) {
    AH = "-";
  } else if (eq(L, TIPO_TUB_COBRE_HVAC) && eq(P, MAT_CINTA_SIN)) {
    if (n(D) <= 7 / 8 && n(E) <= 1 / 2) AH = (3.14 * (n(D) + 2 * n(E)) * 2.54 + 3.5) * n(C) * n(S);
    else AH = (3.14 * (n(D) + 2 * n(E)) * 2.54 + 3.14 * ((n(D) + 2 * n(E)) + 2 * (3 / 16)) * 2.54 + 3.5) * n(C) * n(S);
  } else if (eq(P, MAT_CINTA_SIN) && neq(Qtext, ERR_MATERIAL)) {
    // Mismo fix que AA (no aislada): usar la tabla oficial + tabla de vueltas.
    const nv = vueltasCintaPenetrante(row);
    const Lc = (typeof nv === "number") ? longitudCintaPorVueltas(n(D), nv) : longitudCintaMultiTira(n(D), nv);
    AH = Lc !== null ? Lc * n(C) * n(S) : "-";
  } else AH = "-";
  out.AH = AH;

  // Campos auxiliares para la Memoria de Cálculo de Cinta CP 648-E (con o sin
  // collar, son mutuamente excluyentes según el material P elegido en la fila).
  // dTotal: mismo diámetro total que usa vueltasCintaPenetrante (D+2E para
  // aislada/cobre HVAC, D para no aislada). nVueltas: número de vueltas real
  // (o código "AxB" para instalación multi-tira). cintaLongitudPen: el valor
  // final ya multiplicado por S_LADOS y C_ANT (AA o AH, el que aplique).
  const cintaAplica = eq(P, MAT_CINTA_CON) || eq(P, MAT_CINTA_SIN);
  out.cintaDTotal = cintaAplica ? n(D) + 2 * n(E) : null;
  out.cintaNVueltas = cintaAplica ? vueltasCintaPenetrante(row) : null;
  out.cintaLongitudPen = eq(P, MAT_CINTA_CON) ? AA : (eq(P, MAT_CINTA_SIN) ? AH : "-");
  out.cintaConCollar = eq(P, MAT_CINTA_CON);
  // Collar CP 648-ER: mismo dTotal/nVueltas que la cinta (comparten sistema
  // UL), solo existe cuando el material elegido es "Cinta CON collar".
  out.collarLongitudPen = eq(P, MAT_CINTA_CON) ? Z : "-";

  // AI: cantidad de collarines CP 643N/644
  const AI = (eq(P, MAT_COLLARIN) && neq(Qtext, ERR_MATERIAL) && Qtext !== MSG_CAMBIAR_1) ? n(S) * n(C) : "-";
  out.AI = AI;

  // AJ: referencia de tamaño de collarín — se elige según el OD total (D + 2×E),
  // igual que la cinta: D es el diámetro de la tubería y E el espesor del aislamiento.
  let AJ;
  if (Qtext === ERR_MATERIAL) AJ = "-";
  else if (eq(P, MAT_COLLARIN)) {
    const od = n(D) + 2 * n(E); // OD total = tubería + aislamiento a cada lado
    if (od > 0 && od < 2.0) AJ = "CP 643N 1.5";
    else if (od >= 2.0 && od <= 2.5) AJ = "CP 643N 2";
    else if (od > 2.5 && od <= 3.5) AJ = "CP 643N 3";
    else if (od > 3.5 && od <= 4.5) AJ = "CP 643N 4";
    else if (od > 4.5 && od <= 6.625) AJ = "CP 643N 6";
    else if (od > 6.625 && od <= 8.625) AJ = "CP 644 8";
    else if (od > 8.625 && od <= 10.75) AJ = "CP 644 10";
    else AJ = "-";
  } else AJ = "-";
  out.AJ = AJ;

  // AK: volumen mortero CP637 (cm3)
  const AK = (eq(P, MAT_MORTERO) && neq(Qtext, ERR_MATERIAL)) ? n(U) * n(V) * 2.54 : "-";
  out.AK = AK;

  // AM: sellador CP 606 (volumen). La lana de CP 606 ya NO se calcula acá
  // (antes era AL, solo por área): ahora entra por lanaAreaCm2Pen /
  // lanaVolumenCm3Pen, con las mismas reglas que FS ONE MAX.
  let AM;
  if (eq(P, MAT_CP606) && neq(Qtext, ERR_MATERIAL) && Qtext !== ERR_COMBUSTIBLE_SELLADOR) {
    AM = (n(C) === 0) ? "-" : n(U) * (n(V) * 2.54) * n(S);
  } else AM = "-";
  out.AM = AM;

  // AO: sellador CFS SIL GG (volumen). Ídem AM: la lana ya no sale de acá.
  let AO;
  if (eq(P, MAT_CFS_SIL_GG) && neq(Qtext, ERR_MATERIAL) && Qtext !== ERR_COMBUSTIBLE_SELLADOR) {
    AO = (n(C) === 0) ? "-" : n(U) * (n(V) * 2.54) * n(S);
  } else AO = "-";
  out.AO = AO;

  return out;
}

// ============================================================================
// RESUMEN: cuantificación de materiales + normativa aplicable del proyecto
// ============================================================================
function sumField(rows, field) {
  return rows.reduce((acc, r) => acc + (r[field] === "-" || isBlank(r[field]) ? 0 : n(r[field])), 0);
}
function sumFieldSi(rows, field, filtroFn) {
  return rows.reduce((acc, r) => acc + ((filtroFn(r) && r[field] !== "-" && !isBlank(r[field])) ? n(r[field]) : 0), 0);
}
function sumIfAJ(rows, code) {
  // Usa AJ_override si está definido (override manual de talla desde el Resumen),
  // si no usa el AJ calculado automáticamente por el motor.
  return rows.reduce((acc, r) => {
    const talla = r.AJ_override || r.AJ;
    return acc + ((talla === code && r.AI !== "-") ? n(r.AI) : 0);
  }, 0);
}

function computeResumen(computedRows, waste, umbrales) {
  const w = 1 + n(waste);
  const S = (f) => sumField(computedRows, f);
  const items = [];
  const UMB = Object.assign({ FS_ONE_MAX: 17, CP606: 17, CFS_SIL_GG: 17 }, umbrales || {});

  const addItem = (tipo, producto, codigo, cantidadRaw, divisor, presentacion) => {
    if (cantidadRaw <= 0) return;
    const cant = roundup((cantidadRaw * w) / divisor, 0);
    if (cant > 0) items.push({ tipo, producto, codigo, presentacion, cantidad: cant });
  };

  // Combinación cubeta + cartuchos sueltos: se compran cubetas completas por cada
  // "salto" de volumen, y el remanente en cartuchos — salvo que ese remanente ya
  // alcance o supere el umbral de cartuchos que cuesta igual que 1 cubeta, en cuyo
  // caso conviene otra cubeta completa (mismo precio, más producto).
  const addCombo = (tipo, producto, codigoCartucho, codigoCubeta, volumeRaw, mlCartucho, mlCubeta, presCartucho, presCubeta, umbral) => {
    if (volumeRaw <= 0) return;
    const vol = volumeRaw * w;
    let cubetas = Math.floor(vol / mlCubeta + 1e-9);
    let remainder = vol - cubetas * mlCubeta;
    let cartuchos = remainder <= 1e-9 ? 0 : roundup(remainder / mlCartucho, 0);
    if (cartuchos >= umbral) {
      cubetas += 1;
      cartuchos = 0;
    }
    if (cubetas > 0) items.push({ tipo, producto, codigo: codigoCubeta, presentacion: presCubeta, cantidad: cubetas });
    if (cartuchos > 0) items.push({ tipo, producto, codigo: codigoCartucho, presentacion: presCartucho, cantidad: cartuchos });
  };

  // Pasta FS ONE MAX — el volumen crudo se expone (volumenesCrudos) para que
  // el Resumen final lo combine con el de Juntas antes de decidir cartucho/cubeta.
  const volY = S("Y");

  // Lana mineral: la parte de pared delgada se calcula por ÁREA (como antes)
  // y la de pared gruesa por VOLUMEN — cada una se redondea por separado
  // (distinto divisor: plancha completa vs. solo su área) y se suman, igual
  // criterio que ya se usa para Juntas.
  const areaLanaTotal = S("lanaAreaCm2Pen");
  const volLanaTotal = S("lanaVolumenCm3Pen");
  const lanaAreaUnid = areaLanaTotal > 0 ? roundup((areaLanaTotal * w) / (122 * 61), 0) : 0;
  const lanaVolUnid = volLanaTotal > 0 ? roundup((volLanaTotal * w) / (122 * 61 * 10), 0) : 0;
  const lanaTotalUnid = lanaAreaUnid + lanaVolUnid;
  if (lanaTotalUnid > 0) items.push({ tipo: "LANA", producto: "LANA MINERAL", codigo: "#42010092", presentacion: "Plancha 122x61x10 cm", cantidad: lanaTotalUnid });

  // Espuma CP620
  addItem("ESPUMA", "CP 620", "#00338725", S("AC"), 1900, "Cartucho");

  // Sellador CP606 y CFS SIL GG — igual que FS ONE MAX, se exponen crudos.
  const volCP606 = S("AM");
  const volSilGG = S("AO");

  // Collarines por tamaño
  const collarSizes = [
    ["CP 643N 1.5", "CP 643N 1.5\"", "#00304325"],
    ["CP 643N 2", "CP 643N 2\"", "#00304326"],
    ["CP 643N 3", "CP 643N 3\"", "#00304328"],
    ["CP 643N 4", "CP 643N 4\"", "#00304329"],
    ["CP 643N 6", "CP 643N 6\"", "#00304331"],
    ["CP 644 8", "CP 644 8\"", "#00304341"],
    ["CP 644 10", "CP 644 10\"", "#00304344"],
  ];
  for (const [code, label, art] of collarSizes) {
    const qty = sumIfAJ(computedRows, code);
    // Los collarines se cuentan exactamente (sin factor de desperdicio) —
    // son unidades discretas que se instalan 1:1 por penetrante.
    if (qty > 0) {
      const cant = roundup(qty, 0);
      if (cant > 0) items.push({ tipo: "COLLARÍN", producto: label, codigo: art, presentacion: "Unidad", cantidad: cant, _collarCode: code });
    }
  }

  // Putty pad
  const volPutty7 = sumFieldSi(computedRows, "AB", r => n(r.PPSIZE) !== 9);
  const volPutty9 = sumFieldSi(computedRows, "AB", r => n(r.PPSIZE) === 9);
  addItem("HOJA DE MASILLA", 'Putty Pad CP 617 (7x7")', "#02467821", volPutty7, 1, "Unidad");
  addItem("HOJA DE MASILLA", 'Putty Pad CP 617 (9x9")', "#02466996", volPutty9, 1, "Unidad");
  // Paso de cables MSL M + marco
  addItem("PASO DE CABLES", "CFS-MSL M", "#02237060", S("AF"), 1, "Unidad");
  addItem("MARCO DE PASO", "CFS-MSL P M", "#02345762", S("AF"), 1, "Unidad");
  // Paso de cables MSL L + marco
  addItem("PASO DE CABLES", "CFS-MSL L", "#02237061", S("AG"), 1, "Unidad");
  addItem("MARCO DE PASO", "CFS-MSL P L", "#02345763", S("AG"), 1, "Unidad");
  // Cinta CP648-E (con collar + sin collar)
  addItem("CINTA", "CP 648-E", "#00304309", S("AA") + S("AH"), 1000, "Rollo 1-3/4\" x 33'");
  // Collar CP648-ER
  addItem("COLLAR", "CP 648-ER", "#00283225", S("Z"), 7.62 * 100, "Rollo 1-3/4\" x 25'");
  // Mortero CP637
  addItem("MORTERO", "CP 637", "#00340645", S("AK"), 14748.4, "Cubeta 30 lb");
  // Almohadilla CFS-BL
  addItem("ALMOHADILLA", "CFS-BL", "#02030020", S("AD"), 1, "Ladrillo 20x13x5cm");
  // Manga CP653
  addItem("MANGA", 'CP 653 4"', "#02097883", S("AE"), 1, "Unidad");

  // Normativa aplicable: distintas combinaciones norma+producto+enlace usadas en el proyecto
  const normaMap = new Map();
  for (const r of computedRows) {
    if (!r.Qtext) continue;
    if ([ERR_MATERIAL, ERR_JUICIO, "-", MSG_CAMBIAR_1, MSG_CAMBIAR_2, ERR_COMBUSTIBLE_SELLADOR, "Revisar diámetro del cable!"].includes(r.Qtext)) continue;
    const mkey = r.Qtext;
    if (!normaMap.has(mkey)) normaMap.set(mkey, { norma: r.Qtext, link: r.Qlink, materiales: new Set(), zonas: new Set(), usaLana: false });
    const entry = normaMap.get(mkey);
    if (r.P) entry.materiales.add(r.P);
    // Cinta CP 648-E (con o sin collar): si hay espacio anular real, además del
    // wrap se rellena el anillo con Pasta FS ONE MAX (columna Y) — hay que
    // dejarlo registrado como material usado, si no queda "invisible" en la
    // tabla de aplicaciones y en los informes.
    if ((eq(r.P, MAT_CINTA_CON) || eq(r.P, MAT_CINTA_SIN)) && n(r.Y) > 0) entry.materiales.add(MAT_PASTA);
    if (r.A || r.B) entry.zonas.add(`${r.A || "-"}${r.B ? " · Nivel " + r.B : ""}`);
    else entry.zonas.add("-");
    if (n(r.X) > 0) entry.usaLana = true; // hubo relleno de lana real en el proyecto
    // Collarín con espacio anular: Y > 0 implica que se usa pasta + lana
    if (r.P === MAT_COLLARIN && n(r.Y) > 0) entry.usaLana = true;
  }
  const normativas = Array.from(normaMap.values()).map(e => {
    const info = NORMA_APLICACION[e.norma];
    // Si todos los materiales que usan este sistema UL son Collarín CP 643N/644,
    // mostrar el producto y ficha del collarín aunque el texto de NORMA_APLICACION
    // diga "Cinta CP648-E + Collar CP648-ER" (comparten el mismo sistema UL).
    const soloCollar = e.materiales.size > 0 && Array.from(e.materiales).every(m => m === MAT_COLLARIN);
    let productoHilti;
    let fichas = [];
    if (soloCollar) {
      // Base: el collarín como producto principal
      productoHilti = "Collarín CP643N o CP644";
      const fichaCollar = PRODUCTO_FICHAS["Collarín CP643N o CP444"];
      if (fichaCollar && fichaCollar.nombre1) fichas.push({ nombre: fichaCollar.nombre1, link: fichaCollar.link1 });
      // Si hay espacio anular (usaLana), también se usa Pasta FS ONE MAX + Lana Mineral
      if (e.usaLana) {
        productoHilti += " + Pasta FS ONE MAX + Lana Mineral";
        const fichaPasta = PRODUCTO_FICHAS["Pasta FS ONE MAX"];
        if (fichaPasta && fichaPasta.link1 && !fichas.some(f => f.link === fichaPasta.link1))
          fichas.push({ nombre: fichaPasta.nombre1, link: fichaPasta.link1 });
        const fichaLana = PRODUCTO_FICHAS["Lana Mineral 4 pcf"];
        if (fichaLana && fichaLana.link1 && !fichas.some(f => f.link === fichaLana.link1))
          fichas.push({ nombre: fichaLana.nombre1, link: fichaLana.link1 });
      }
    } else {
      productoHilti = (info ? info.producto : "") || Array.from(e.materiales).join(", ");
      const ficha = (info && info.producto) ? PRODUCTO_FICHAS[info.producto] : null;
      if (ficha && ficha.nombre1) fichas.push({ nombre: ficha.nombre1, link: ficha.link1 });
      if (ficha && ficha.nombre2) fichas.push({ nombre: ficha.nombre2, link: ficha.link2 });
    }

    // Verificar que todo material realmente seleccionado en el proyecto quede
    // reflejado en "Producto Hilti" — no solo el texto genérico de NORMA_APLICACION.
    // Si ya es solo collarín, este bloque se omite (ya está bien manejado arriba).
    if (!soloCollar) {
      e.materiales.forEach(mat => {
        const patron = FAMILIA_POR_MATERIAL[mat];
        if (!patron) return; // materiales ya bien representados por el texto estático (cintas, manga, MSL...)
        if (patron.test(productoHilti)) return; // ya está mencionado
        productoHilti = productoHilti ? `${productoHilti} + ${mat}` : mat;
        const claveFicha = FICHA_ALIAS[mat] || mat;
        const fichaExtra = PRODUCTO_FICHAS[claveFicha];
        if (fichaExtra) {
          if (fichaExtra.nombre1 && !fichas.some(f => f.nombre === fichaExtra.nombre1)) fichas.push({ nombre: fichaExtra.nombre1, link: fichaExtra.link1 });
          if (fichaExtra.nombre2 && !fichas.some(f => f.nombre === fichaExtra.nombre2)) fichas.push({ nombre: fichaExtra.nombre2, link: fichaExtra.link2 });
        }
      });
    }

    // Si en el proyecto sí se usó lana mineral (espacio anular real) pero no quedó
    // mencionada, se agrega aparte (igual que con los demás materiales).
    if (e.usaLana && !/lana/i.test(productoHilti)) {
      productoHilti = productoHilti ? `${productoHilti} + Lana Mineral` : "Lana Mineral";
    }
    if (e.usaLana && !fichas.some(f => /lana/i.test(f.nombre || ""))) {
      const fichaLana = PRODUCTO_FICHAS["Lana Mineral 4 pcf"];
      if (fichaLana && fichaLana.nombre1) fichas.push({ nombre: fichaLana.nombre1, link: fichaLana.link1 });
    }
    return {
      norma: e.norma, link: e.link,
      aplicacion: info ? info.aplicacion : "",
      productoHilti,
      materiales: Array.from(e.materiales).join(", "),
      zonas: Array.from(e.zonas).join(", "),
      fichas,
    };
  }).sort((a, b) => a.norma.localeCompare(b.norma));

  // Conjunto de fichas técnicas distintas usadas en el proyecto (para descarga aparte).
  // Se alimenta de dos fuentes:
  //   1) Las fichas ya resueltas en cada normativa (ruta habitual).
  //   2) Los ítems del resumen que tienen ficha en PRODUCTO_FICHAS pero que
  //      quizás no aparecieron via normativa (collarines, cinta, mortero, etc.)
  //      — garantiza que todo lo del cuadro de materiales tenga su ficha.
  // Mapa tipo de ítem → clave en PRODUCTO_FICHAS (para tipos con una sola ficha)
  const FICHA_POR_TIPO = {
    "COLLARÍN": "Collarín CP643N o CP444",
    "CINTA": 'Cinta CP648-E 1 3/4"',
    "COLLAR": 'Cinta CP648-E 1 3/4" + Collar de retención CP 648-ER',
    "MORTERO": "Mortero CP 637",
    "ALMOHADILLA": "Almohadilla CFS-BL",
    "ESPUMA": "Espuma CP 620",
    "HOJA DE MASILLA": "Putty Pad CP 617",
    "PASO DE CABLES": "Paso de cables CFS-MSL",
    "MARCO DE PASO": "Paso de cables CFS-MSL",
    "MANGA": 'Manga CP 653 4"',
    "LANA": "Lana Mineral 4 pcf",
  };
  // Para PASTA y SELLADOR JUNTAS hay varios productos distintos — se mapea por producto
  const FICHA_POR_PRODUCTO = {
    "FS ONE MAX":  "Pasta FS ONE MAX",
    "CP 606":      "Sellador CP 606",
    "CFS SIL GG":  "Sellador CFS-S SIL GG",
    "CFS SP WB":   "Sellador CFS SP WB",
  };
  const fichasMap = new Map();
  normativas.forEach(nrm => {
    nrm.fichas.forEach(f => {
      if (f && f.link && !fichasMap.has(f.link)) fichasMap.set(f.link, { nombre: f.nombre, link: f.link });
    });
  });
  // Agregar fichas de los ítems del resumen que no vinieron por normativa
  items.forEach(it => {
    // Buscar primero por tipo (collarín, cinta, lana, etc.)
    const claveT = FICHA_POR_TIPO[it.tipo];
    if (claveT) {
      const fd = PRODUCTO_FICHAS[claveT];
      if (fd) {
        if (fd.link1 && !fichasMap.has(fd.link1)) fichasMap.set(fd.link1, { nombre: fd.nombre1, link: fd.link1 });
        if (fd.link2 && fd.nombre2 && !fichasMap.has(fd.link2)) fichasMap.set(fd.link2, { nombre: fd.nombre2, link: fd.link2 });
      }
    }
    // Buscar también por nombre de producto (pasta, selladores)
    const claveP = FICHA_POR_PRODUCTO[it.producto];
    if (claveP) {
      const fd = PRODUCTO_FICHAS[claveP];
      if (fd) {
        if (fd.link1 && !fichasMap.has(fd.link1)) fichasMap.set(fd.link1, { nombre: fd.nombre1, link: fd.link1 });
        if (fd.link2 && fd.nombre2 && !fichasMap.has(fd.link2)) fichasMap.set(fd.link2, { nombre: fd.nombre2, link: fd.link2 });
      }
    }
  });
  // Lana mineral — si aparece en ítems de materiales, garantizar su ficha
  if (items.some(it => it.tipo === "LANA")) {
    const fd = PRODUCTO_FICHAS["Lana Mineral 4 pcf"];
    if (fd && fd.link1 && !fichasMap.has(fd.link1)) fichasMap.set(fd.link1, { nombre: fd.nombre1, link: fd.link1 });
  }
  const fichasTecnicas = Array.from(fichasMap.values()).sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));

  // Alertas: filas con mensajes de error/aviso
  const alertas = [];
  for (const r of computedRows) {
    if ([ERR_MATERIAL, ERR_JUICIO, MSG_CAMBIAR_1, MSG_CAMBIAR_2, ERR_COMBUSTIBLE_SELLADOR, "Revisar diámetro del cable!"].includes(r.Qtext)) {
      alertas.push({ zona: r.A, nivel: r.B, mensaje: r.Qtext });
    }
  }

  return { items, normativas, alertas, fichasTecnicas, volumenesCrudos: { "FS ONE MAX": volY * w, "CP 606": volCP606 * w, "CFS SIL GG": volSilGG * w } };
}

// --- Exports usados por otros módulos ---
window.dbKey = dbKey;
window.collarLongitud = collarLongitud;
window.longitudCintaMultiTira = longitudCintaMultiTira;
window.longitudCintaPorVueltas = longitudCintaPorVueltas;
window.computeRow = computeRow;
window.computeResumen = computeResumen;
})();
