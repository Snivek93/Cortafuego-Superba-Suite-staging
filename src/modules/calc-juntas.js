// ============================================================================
// calc-juntas.js — encapsulado en IIFE (sin exponer todo a window; ver export list abajo)
// ============================================================================
(function () {
// ============================================================================
// calc-juntas.js
// Motor de cálculo de Juntas — helpers de combinaciones disponibles y cálculo de sellador/lana para juntas.
// (Parte del proyecto Calculadora Cortafuego Hilti — ver README.md para el mapa completo de módulos.)
// ============================================================================

// JUNTAS — helpers de combinaciones disponibles y motor de cálculo
// ============================================================================
function juntasDisponibles() {
  return Array.from(new Set(JUNTAS_TABLE.map(r => r.j)));
}
// Cada Tipo pertenece a un único valor de Junta (Vertical/Horizontal), así que
// no hace falta preguntarlo aparte: se deriva del Tipo elegido.
function juntaParaTipo(tipo) {
  const fila = JUNTAS_TABLE.find(r => r.t === tipo);
  return fila ? fila.j : null;
}
function todosLosTipos() {
  const vistos = new Set();
  const out = [];
  JUNTAS_TABLE.forEach(r => {
    if (!vistos.has(r.t)) { vistos.add(r.t); out.push({ tipo: r.t, junta: r.j }); }
  });
  return out;
}
function tiposParaJunta(junta) {
  return Array.from(new Set(JUNTAS_TABLE.filter(r => r.j === junta).map(r => r.t)));
}
function barrerasParaTipo(junta, tipo) {
  return Array.from(new Set(JUNTAS_TABLE.filter(r => r.j === junta && r.t === tipo).map(r => r.b)));
}
function posicionesParaCombo(junta, tipo, barreras) {
  return Array.from(new Set(JUNTAS_TABLE.filter(r => r.j === junta && r.t === tipo && r.b === barreras).map(r => r.p)));
}
function productosParaCombo(junta, tipo, barreras, posicion) {
  return Array.from(new Set(JUNTAS_TABLE.filter(r => r.j === junta && r.t === tipo && r.b === barreras && r.p === posicion).map(r => r.prod)));
}
// La combinación Horizontal/Pared-Entrepiso/Panel de yeso-Concreto es la única
// donde, en vez de un selector de Posición normal, se pregunta explícitamente
// Solo superior / Solo inferior / Superior e Inferior (y en ese último caso se
// suman los dos cálculos).
function esComboSuperiorInferior(junta, tipo, barreras) {
  return junta === "Horizontal" && tipo === "Pared - Entrepiso" && barreras === "Panel de yeso - Concreto";
}
// Espesor de pared: se pide para toda junta que no sea Muro Cortina, tipo
// Entrepiso - Entrepiso, o tipo Pared - Entrepiso en posición Lateral.
function usaEspesorPared(tipo, posicion) {
  if (tipo === "Muro Cortina" || tipo === "Entrepiso - Entrepiso") return false;
  if (tipo === "Pared - Entrepiso" && posicion === "Lateral") return false;
  return true;
}
function espesorParedPorDefecto(barreras) {
  return /panel de yeso/i.test(barreras || "") ? CONFIG.C14 : CONFIG.C13;
}
// Busca la fila de JUNTAS_TABLE que aplica según el ancho de junta (en pulgadas).
function filaJunta(junta, tipo, barreras, posicion, producto, anchoIn) {
  const candidatos = JUNTAS_TABLE.filter(r => r.j === junta && r.t === tipo && r.b === barreras && r.p === posicion && r.prod === producto);
  if (candidatos.length === 0) return null;
  let match = candidatos.find(r => anchoIn >= r.min && anchoIn <= r.max);
  if (!match) match = candidatos.reduce((a, b) => Math.abs(a.max - anchoIn) < Math.abs(b.max - anchoIn) ? a : b);
  return match;
}

// Calcula el volumen de sellador (cm3) para una sola posición/fila de la tabla,
// dado longitud/ancho/traslape ya en cm y espesor de producto en cm.
function volumenSelladorJunta(fila, producto, longitudCm, anchoCm, ladosMult) {
  const espesorCm = fila.esp * 2.54;
  const traslapeCm = fila.tras * 2.54;
  let vol;
  if (anchoCm > 0) {
    vol = longitudCm * (anchoCm + 2 * traslapeCm) * espesorCm;
  } else if (producto === "CFS SP WB") {
    vol = traslapeCm * 2 * espesorCm * longitudCm;
  } else {
    // FS ONE MAX, CP 606, CFS SIL GG con junta topada (ancho = 0)
    vol = 0.783 * Math.pow(espesorCm, 2) * longitudCm;
  }
  return vol * ladosMult;
}

// Calcula todos los valores de una fila de Levantamiento Juntas: volumen/área de
// sellador y de lana mineral, normativa aplicable, etc. row.* ya vienen en cm.
function computeJuntaRow(row) {
  const junta = row.junta, tipo = row.tipo, barreras = row.barreras, producto = row.producto;
  const longitudCm = n(row.longitud), anchoCm = n(row.ancho);
  const anchoIn = anchoCm / 2.54;
  const ladosMult = row.lados === "Ambos lados" ? 2 : 1;
  const superiorInferior = esComboSuperiorInferior(junta, tipo, barreras);

  let posicionesCalc = [];
  if (superiorInferior) {
    if (row.posicionPI === "Solo superior") posicionesCalc = ["Superior"];
    else if (row.posicionPI === "Solo inferior") posicionesCalc = ["Inferior"];
    else posicionesCalc = ["Superior", "Inferior"]; // Superior e Inferior
  } else {
    posicionesCalc = [row.posicion];
  }

  let volumenSellador = 0;
  let sistemasUsados = [];
  let filasUsadas = [];
  posicionesCalc.forEach(pos => {
    const fila = filaJunta(junta, tipo, barreras, pos, producto, anchoIn);
    if (!fila) return;
    filasUsadas.push(fila);
    sistemasUsados.push({ norma: fila.sis, link: fila.link, posicion: pos });
    volumenSellador += volumenSelladorJunta(fila, producto, longitudCm, anchoCm, ladosMult);
  });

  // Lana mineral (opcional, según checkbox calcularLana)
  let lanaVolumenCm3 = 0, lanaAreaCm2 = 0;
  const esAreaLana = tipo === "Muro Cortina" || tipo === "Entrepiso - Entrepiso" || (tipo === "Pared - Entrepiso" && row.posicion === "Lateral");
  if (row.calcularLana && filasUsadas.length > 0) {
    const compresion = filasUsadas[0].comp; // compresión es igual para todas las filas de una misma combinación
    if (tipo === "Muro Cortina") {
      lanaAreaCm2 = longitudCm * n(row.anchoLana) * (1 + compresion);
    } else if (esAreaLana) {
      lanaAreaCm2 = longitudCm * anchoCm * (1 + compresion);
    } else {
      const espesorParedCm = n(row.espesorPared);
      if (superiorInferior) {
        // Superior e Inferior: se calcula y suma el volumen para cada posición usada
        posicionesCalc.forEach(() => {
          lanaVolumenCm3 += espesorParedCm < 10
            ? longitudCm * anchoCm * (1 + compresion)
            : longitudCm * anchoCm * espesorParedCm * (1 + compresion);
        });
      } else {
        lanaVolumenCm3 = espesorParedCm < 10
          ? longitudCm * anchoCm * (1 + compresion)
          : longitudCm * anchoCm * espesorParedCm * (1 + compresion);
      }
    }
  }

  return {
    volumenSellador, lanaVolumenCm3, lanaAreaCm2,
    sistemasUsados, superiorInferior,
    espesorProductoIn: filasUsadas.length > 0 ? filasUsadas[0].esp : null,
    espesorCm: filasUsadas.length > 0 ? filasUsadas[0].esp * 2.54 : null,
    traslapeCm: filasUsadas.length > 0 ? filasUsadas[0].tras * 2.54 : null,
  };
}
function computeSingleJuntaRow(row) {
  return Object.assign({}, row, computeJuntaRow(row));
}
function computeAllJuntaRows() {
  return ROWS_J.map(computeSingleJuntaRow);
}
function tieneDatosMinimosJunta(row) {
  return !!(row.junta && row.tipo && row.barreras && (row.posicion || row.posicionPI) && row.producto && n(row.longitud) > 0);
}

// Cuantifica los materiales de todas las filas de Juntas para el Resumen.
// Devuelve items en el mismo formato que computeResumen() de penetrantes,
// más el volumen/área de lana (para sumarlos con el total de penetrantes).
function computeResumenJuntas(computedJuntaRows, waste, umbrales) {
  const w = 1 + n(waste);
  const items = [];
  const UMB = umbrales || { FS_ONE_MAX: 17, CP606: 17, CFS_SIL_GG: 17 };
  const addItemJ = (tipo, producto, codigo, cantidadRaw, divisor, presentacion) => {
    if (cantidadRaw <= 0) return;
    const cant = roundup((cantidadRaw * w) / divisor, 0);
    if (cant > 0) items.push({ tipo, producto, codigo, presentacion, cantidad: cant });
  };
  // Misma regla que Penetrantes: si el sobrante de cartuchos llega al umbral
  // (17 por defecto), conviene comprar una cubeta en vez de tantos cartuchos.
  const addComboJ = (tipo, producto, codigoCartucho, codigoCubeta, volumeRaw, mlCartucho, mlCubeta, presCartucho, presCubeta, umbral) => {
    if (volumeRaw <= 0) return;
    const vol = volumeRaw * w;
    let cubetas = Math.floor(vol / mlCubeta + 1e-9);
    let remainder = vol - cubetas * mlCubeta;
    let cartuchos = remainder <= 1e-9 ? 0 : roundup(remainder / mlCartucho, 0);
    if (cartuchos >= umbral) { cubetas += 1; cartuchos = 0; }
    if (cubetas > 0) items.push({ tipo, producto, codigo: codigoCubeta, presentacion: presCubeta, cantidad: cubetas });
    if (cartuchos > 0) items.push({ tipo, producto, codigo: codigoCartucho, presentacion: presCartucho, cantidad: cartuchos });
  };

  let volFS = 0, volCP606 = 0, volSilGG = 0, volSPWB = 0;
  let lanaVolTotal = 0, lanaAreaTotal = 0;
  const normaMap = new Map(); // norma -> { link, zonas:Set, producto, tipo, barreras, posicion }

  computedJuntaRows.filter(tieneDatosMinimosJunta).forEach(r => {
    const cant = n(r.cantidad) || 1;
    if (r.producto === "FS ONE MAX") volFS += r.volumenSellador * cant;
    else if (r.producto === "CP 606") volCP606 += r.volumenSellador * cant;
    else if (r.producto === "CFS SIL GG") volSilGG += r.volumenSellador * cant;
    else if (r.producto === "CFS SP WB") volSPWB += r.volumenSellador * cant;
    lanaVolTotal += r.lanaVolumenCm3 * cant;
    lanaAreaTotal += r.lanaAreaCm2 * cant;
    (r.sistemasUsados || []).forEach(s => {
      if (!normaMap.has(s.norma)) normaMap.set(s.norma, { link: s.link, zonas: new Set(), producto: r.producto, tipo: r.tipo, barreras: r.barreras, posicion: s.posicion, usaLana: false });
      const entry = normaMap.get(s.norma);
      entry.zonas.add(`${r.A || "-"}${r.B ? " · Nivel " + r.B : ""}`);
      // Igual que con la cinta CP 648-E en Penetrantes: si esta junta también
      // calculó lana mineral, hay que dejarlo reflejado en el producto usado,
      // si no queda "invisible" en la tabla de aplicaciones y en los informes.
      if (r.calcularLana && (n(r.lanaVolumenCm3) > 0 || n(r.lanaAreaCm2) > 0)) entry.usaLana = true;
    });
  });

  // FS ONE MAX, CP 606 y CFS SIL GG se exponen crudos (con el desperdicio de
  // juntas ya aplicado) para que el Resumen los combine con los de Penetrantes
  // antes de decidir cartucho/cubeta — así no se cuentan dos veces por separado.
  // CFS SP WB solo existe en presentación cubeta (5 gal), no hay cartucho que convertir.
  addItemJ("SELLADOR JUNTAS", "CFS SP WB", "#00430811", volSPWB, 18900, "Cubeta 5 gal");

  // Lana: volumen (cm3) sobre el volumen de una lana, área (cm2) sobre 122x61 —
  // ambas se combinan al final en el Resumen con la lana de penetrantes.
  const lanaVolUnidades = lanaVolTotal > 0 ? roundup((lanaVolTotal * w) / (122 * 61 * 10), 0) : 0;
  const lanaAreaUnidades = lanaAreaTotal > 0 ? roundup((lanaAreaTotal * w) / (122 * 61), 0) : 0;

  const normativas = Array.from(normaMap.entries()).map(([norma, e]) => {
    const posTxt = (e.posicion && e.posicion !== "-") ? e.posicion.replace(/^Sistema /, "") : "";
    const aplicacion = `Junta ${e.tipo}${posTxt ? " · " + posTxt : ""} (${barrerasLabelCorto(e.barreras)})`;
    const productoHilti = e.usaLana ? `${e.producto} + Lana Mineral` : e.producto;
    return { norma, link: e.link, productoHilti, zonas: Array.from(e.zonas).join(", "), aplicacion };
  }).sort((a, b) => a.norma.localeCompare(b.norma));

  return {
    items, lanaUnidades: lanaVolUnidades + lanaAreaUnidades, normativas,
    volumenesCrudos: { "FS ONE MAX": volFS * w, "CP 606": volCP606 * w, "CFS SIL GG": volSilGG * w }
  };
}

// Ficha técnica de cada producto de sellador de juntas (reutiliza el mismo
// catálogo PRODUCTO_FICHAS que ya usan los penetrantes).
const FICHA_KEY_JUNTAS = {
  "FS ONE MAX": "Pasta FS ONE MAX",
  "CP 606": "Sellador CP 606",
  "CFS SIL GG": "Sellador CFS-S SIL GG",
  "CFS SP WB": "Sellador CFS SP WB",
};
function fichaJuntaProducto(producto) {
  const key = FICHA_KEY_JUNTAS[producto];
  const f = key ? PRODUCTO_FICHAS[key] : null;
  return (f && f.link1) ? { nombre: f.nombre1, link: f.link1 } : null;
}

// Combina el Resumen de Juntas (items, lana, normativa y fichas técnicas) con
// el Resumen de Penetrantes ya calculado. Se usa tanto en pantalla como en el
// PDF para no repetir la lógica ni que se desincronicen.
// Quantifica un producto que existe en cartucho y cubeta, según el modo
// elegido (auto = 17 cartuchos convierte a cubeta extra; cartuchos = siempre
// cartucho; cubetas = cualquier remanente redondea a una cubeta más).
function addComboConModo(items, cfg, volFinal, modo) {
  if (volFinal <= 0) return;
  let cubetas = 0, cartuchos = 0;
  if (modo === "cartuchos") {
    cartuchos = roundup(volFinal / cfg.mlCartucho, 0);
  } else if (modo === "cubetas") {
    cubetas = Math.floor(volFinal / cfg.mlCubeta + 1e-9);
    const remainder = volFinal - cubetas * cfg.mlCubeta;
    if (remainder > 1e-9) cubetas += 1;
  } else {
    cubetas = Math.floor(volFinal / cfg.mlCubeta + 1e-9);
    const remainder = volFinal - cubetas * cfg.mlCubeta;
    cartuchos = remainder <= 1e-9 ? 0 : roundup(remainder / cfg.mlCartucho, 0);
    if (cartuchos >= cfg.umbral) { cubetas += 1; cartuchos = 0; }
  }
  if (cubetas > 0) items.push({ tipo: cfg.tipo, producto: cfg.producto, codigo: cfg.codigoCubeta, presentacion: cfg.presCubeta, cantidad: cubetas });
  if (cartuchos > 0) items.push({ tipo: cfg.tipo, producto: cfg.producto, codigo: cfg.codigoCartucho, presentacion: cfg.presCartucho, cantidad: cartuchos });
}

function mezclarResumenJuntas(resumen, computedJ) {
  const resumenJ = computeResumenJuntas(computedJ, CONFIG.C17_JUNTAS, {
    FS_ONE_MAX: CONFIG.UMB_FS, CP606: CONFIG.UMB_CP606, CFS_SIL_GG: CONFIG.UMB_SILGG
  });

  // FS ONE MAX, CP 606 y CFS SIL GG: se suma el volumen de Penetrantes + Juntas
  // (cada uno con su propio desperdicio ya aplicado) antes de decidir la
  // presentación, para no comprar cartuchos/cubetas de más contando por separado.
  const PRODUCTOS_COMBO = [
    { producto: "FS ONE MAX", tipo: "PASTA", codigoCartucho: "#02101532", codigoCubeta: "#02101533", mlCartucho: 592, mlCubeta: 18900, presCartucho: "Cartucho 20 oz", presCubeta: "Cubeta 19 L", umbral: CONFIG.UMB_FS },
    { producto: "CP 606", tipo: "SELLADOR JUNTAS", codigoCartucho: "#00209634", codigoCubeta: "#00269636", mlCartucho: 580, mlCubeta: 18900, presCartucho: "Cartucho 580 ml", presCubeta: "Cubeta 19 L", umbral: CONFIG.UMB_CP606 },
    { producto: "CFS SIL GG", tipo: "SELLADOR JUNTAS", codigoCartucho: "#02076882", codigoCubeta: "#02076883", mlCartucho: 600, mlCubeta: 18900, presCartucho: "Cartucho 600 ml", presCubeta: "Cubeta 19 L", umbral: CONFIG.UMB_SILGG },
  ];
  PRODUCTOS_COMBO.forEach(cfg => {
    const volTotal = (resumen.volumenesCrudos && resumen.volumenesCrudos[cfg.producto] || 0) + (resumenJ.volumenesCrudos && resumenJ.volumenesCrudos[cfg.producto] || 0);
    const modo = RESUMEN_MODO_PRODUCTO[cfg.producto] || "auto";
    addComboConModo(resumen.items, cfg, volTotal, modo);
  });

  resumenJ.items.forEach(it => resumen.items.push(Object.assign({}, it, { producto: it.producto + " (Juntas)" })));
  if (resumenJ.lanaUnidades > 0) {
    const lanaItem = resumen.items.find(it => it.producto === "LANA MINERAL");
    if (lanaItem) lanaItem.cantidad += resumenJ.lanaUnidades;
    else resumen.items.push({ tipo: "LANA", producto: "LANA MINERAL (Juntas)", codigo: CODIGOS_JUNTAS.LANA, presentacion: "Plancha 122x61x10 cm", cantidad: resumenJ.lanaUnidades });
  }
  resumenJ.normativas.forEach(nrm => resumen.normativas.push({ aplicacion: nrm.aplicacion, norma: nrm.norma, link: nrm.link, productoHilti: nrm.productoHilti, zonas: nrm.zonas }));

  // Fichas técnicas: se agregan las de los productos de sellador realmente
  // usados en Juntas (y la de Lana Mineral si corresponde), sin duplicar por link.
  const fichaMap = new Map(resumen.fichasTecnicas.map(f => [f.link, f]));
  const productosUsados = new Set(computedJ.filter(tieneDatosMinimosJunta).map(r => r.producto));
  productosUsados.forEach(p => {
    const f = fichaJuntaProducto(p);
    if (f && f.link && !fichaMap.has(f.link)) fichaMap.set(f.link, f);
  });
  if (resumenJ.lanaUnidades > 0) {
    const fl = PRODUCTO_FICHAS["Lana Mineral 4 pcf"];
    if (fl && fl.link1 && !fichaMap.has(fl.link1)) fichaMap.set(fl.link1, { nombre: fl.nombre1, link: fl.link1 });
  }
  resumen.fichasTecnicas = Array.from(fichaMap.values()).sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));

  return resumen;
}

function computeAllRows() {
  return ROWS.map(r => {
    const full = Object.assign({}, r, { K: kFromL(r.L) });
    const res = computeRow(full, CONFIG);
    return Object.assign({}, full, res);
  });
}

function selectHtml(id, opts, value, onchange, deshabilitados, fullDisabled) {
  return `<select data-id="${id}" data-field="${onchange}" class="cell-input" ${fullDisabled ? "disabled" : ""}>` +
    opts.map(o => `<option value="${escapeHtml(o)}" ${o === value ? "selected" : ""} ${deshabilitados && deshabilitados.includes(o) ? "disabled" : ""}>${escapeHtml(o)}</option>`).join("") +
    `</select>`;
}
function numHtml(id, field, value, visible, step, disabled) {
  if (!visible) return `<span class="dash">—</span>`;
  return `<input type="number" inputmode="decimal" step="${step || 'any'}" data-id="${id}" data-field="${field}" class="cell-input" value="${value === "" ? "" : value}" ${disabled ? "disabled" : ""}>`;
}

// Variante para campos en pulgadas donde además del decimal (0.5) se acepta
// escribir la fracción directo (1/2) — el parseo ya existe (parseFraccion),
// acá solo se habilita poder escribir el "/" (un input type=number lo bloquea).
function numFraccionHtml(id, field, value, visible, disabled) {
  if (!visible) return `<span class="dash">—</span>`;
  const display = (value === "" || value === null || value === undefined || isNaN(value)) ? "" : formatFraccionInput(value);
  return `<input type="text" inputmode="decimal" data-id="${id}" data-field="${field}" data-fraccion="1" class="cell-input" value="${escapeHtml(display)}" placeholder="Ej. 1/2 o 0.5" ${disabled ? "disabled" : ""}>`;
}
function textHtml(id, field, value) {
  return `<input type="text" data-id="${id}" data-field="${field}" class="cell-input" value="${escapeHtml(value)}">`;
}
function escapeHtml(s) {
  return String(s === undefined || s === null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Solo para MOSTRAR "Tipo"/"Producto" en la tabla de Cuantificación (pantalla y
// PDF) — nunca tocar los valores guardados/usados internamente (comparaciones
// como it.producto === "LANA MINERAL" siguen intactas).
function tituloCase(s) {
  if (!s) return s;
  return String(s).replace(/\S+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}
// "Tipo" siempre es una categoría genérica (LANA, CINTA, COLLARÍN...) — se
// puede pasar a Título sin excepción. "Producto" en cambio casi siempre es un
// código de producto Hilti (CP 648-E, CFS-BL...) que debe quedar tal cual; la
// única excepción real es "LANA MINERAL", que sí es un nombre descriptivo.
function tituloCaseProducto(s) {
  if (s === "LANA MINERAL") return "Lana Mineral";
  return s;
}

function camposRequeridos(L) {
  const usaDimAB = ["Ducto Rectangular", "Ducto Rectangular Aislado", "Ducto Redondo", "Ducto Redondo Aislado",
    "Viga W", "Viga Canal", "Viga Tubo Rectangular", "Caja Electromecánica UL",
    "Bandeja de Cables", "Pasante Múltiple", "Vacío"].includes(L);
  const esCaja = L === "Caja Electromecánica UL";
  return {
    D: !usaDimAB,
    F: usaDimAB,
    G: usaDimAB,
    H: esCaja,
  };
}

function tieneDatosMinimos(row) {
  // Caso especial "Vacío": puede ser rectangular (DIM.A/DIM.B) o redondo
  // (DIÁM., guardado en D con F/G en blanco — ver agregarDesdeLevantamiento()
  // y el cálculo de U en computeRow()). camposRequeridos() no distingue el
  // modo porque solo conoce el tipo (L), no el modo elegido en Levantamiento
  // — se infiere acá por la forma del dato: si F está vacío, es redondo.
  // Bug reportado por Kevin (10/08/2026): antes esto exigía F/G siempre
  // para "Vacío", así que las filas redondas quedaban invisibles en
  // estadísticas, Resumen y todos los PDF aunque sí se agregaban a ROWS.
  if (row.L === TIPO_VACIO) {
    const esRedondo = row.F === "" || row.F === null;
    if (esRedondo) return !(row.D === "" || row.D === null || n(row.D) <= 0);
    return !(row.F === "" || row.F === null || n(row.F) <= 0) && !(row.G === "" || row.G === null || n(row.G) <= 0);
  }
  // Mismo problema puede pasar con "Ducto Redondo"/"Ducto Redondo Aislado":
  // agregarDesdeLevantamiento() SIEMPRE guarda el diámetro en F/G (en cm,
  // ver diametroLibreActivo ahí), nunca en D — pero es fácil que una
  // importación externa (texto libre, .fss armado a mano, etc.) ponga el
  // diámetro en D por ser lo que usan todos los demás tipos de tubería.
  // Se acepta cualquiera de los dos formatos acá para no perder esas filas
  // en silencio (encontrado 26/08/2026 armando un levantamiento de Kevin).
  if (row.L === TIPO_DUCTO_RED || row.L === TIPO_DUCTO_RED_AISL) {
    const tieneFG = !(row.F === "" || row.F === null || n(row.F) <= 0) && !(row.G === "" || row.G === null || n(row.G) <= 0);
    const tieneD = !(row.D === "" || row.D === null || n(row.D) <= 0);
    return tieneFG || tieneD;
  }
  const req = camposRequeridos(row.L);
  if (req.D && (row.D === "" || row.D === null || n(row.D) <= 0)) return false;
  if (req.F && (row.F === "" || row.F === null || n(row.F) <= 0)) return false;
  if (req.G && (row.G === "" || row.G === null || n(row.G) <= 0)) return false;
  if (req.H && (row.H === "" || row.H === null || n(row.H) <= 0)) return false;
  return true;
}

function badgeForQ(row) {
  if (!tieneDatosMinimos(row)) return `<span class="dash">— (falta info)</span>`;
  const q = row.Qtext;
  if (!q || q === "-") return `<span class="dash">—</span>`;
  const isError = [ERR_MATERIAL, ERR_JUICIO, MSG_CAMBIAR_1, MSG_CAMBIAR_2, ERR_COMBUSTIBLE_SELLADOR, "Revisar diámetro del cable!"].includes(q);
  const cls = isError ? "badge badge-error" : "badge badge-ok";
  if (row.Qlink && !isError) {
    return `<a href="${escapeHtml(row.Qlink)}" target="_blank" rel="noopener" class="${cls}">${escapeHtml(q)}</a>`;
  }
  return `<span class="${cls}">${escapeHtml(q)}</span>`;
}

function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }

function formatFraccionPulgadas(v) {
  if (v === "" || v === null || v === undefined || isNaN(v)) return "";
  const num = parseFloat(v);
  if (num === 0) return "0\"";
  const neg = num < 0;
  const abs = Math.abs(num);
  const whole = Math.floor(abs);
  const frac = abs - whole;
  if (frac < 0.001) return (neg ? "-" : "") + whole + "\"";
  const denominators = [2, 4, 8, 16, 32];
  for (const d of denominators) {
    const numer = Math.round(frac * d);
    if (Math.abs(frac - numer / d) < 0.004) {
      if (numer === 0) return (neg ? "-" : "") + whole + "\"";
      const g = gcd(numer, d);
      const rn = numer / g, rd = d / g;
      const wholePart = whole > 0 ? whole + " " : "";
      return (neg ? "-" : "") + wholePart + rn + "/" + rd + "\"";
    }
  }
  return (neg ? "-" : "") + abs.toFixed(3) + "\""; // no calzó en una fracción común
}
// Espesor de sellador/espuma (V) para mostrar en tablas de Levantamiento y
// PDFs: casi todos los materiales lo guardan en pulgadas (formatFraccionPulgadas).
// Espuma CP 620 lo guarda en cm (E_ESPUMA, propio de cada sistema UL) — para
// que la columna se vea igual que el resto, acá se convierte a pulgadas y se
// redondea a 1/4" más cercano (12,1cm → 4-3/4", 14cm → 5-1/2"), ya que el
// valor guardado en cm ya viene con un solo decimal, no exacto al milímetro.
// Kevin, 10/08/2026.
function formatEspesorPenetrante(producto, v) {
  if (v === "-" || v === undefined || v === null || v === "") return "—";
  if (producto === MAT_ESPUMA) {
    const pulgadas = Math.round((Number(v) / 2.54) * 4) / 4;
    return formatFraccionPulgadas(pulgadas);
  }
  return formatFraccionPulgadas(v);
}
// Igual que formatFraccionPulgadas pero sin la comilla final — para el valor
// que se muestra/edita dentro de un input (la comilla ahí solo estorbaría al
// volver a escribir/parsear).
function formatFraccionInput(v) {
  return formatFraccionPulgadas(v).replace(/"$/, "");
}

function rowIndexOf(id) {
  return ROWS.findIndex(r => r._id === id);
}

function computeSingleRow(row) {
  const full = Object.assign({}, row, { K: kFromL(row.L) });
  const res = computeRow(full, CONFIG);
  return Object.assign({}, full, res);
}

// ============================================================================

// --- Exports usados por otros módulos ---
window.juntasDisponibles = juntasDisponibles;
window.juntaParaTipo = juntaParaTipo;
window.todosLosTipos = todosLosTipos;
window.tiposParaJunta = tiposParaJunta;
window.barrerasParaTipo = barrerasParaTipo;
window.posicionesParaCombo = posicionesParaCombo;
window.productosParaCombo = productosParaCombo;
window.esComboSuperiorInferior = esComboSuperiorInferior;
window.usaEspesorPared = usaEspesorPared;
window.espesorParedPorDefecto = espesorParedPorDefecto;
window.computeJuntaRow = computeJuntaRow;
window.computeSingleJuntaRow = computeSingleJuntaRow;
window.computeAllJuntaRows = computeAllJuntaRows;
window.tieneDatosMinimosJunta = tieneDatosMinimosJunta;
window.mezclarResumenJuntas = mezclarResumenJuntas;
window.computeAllRows = computeAllRows;
window.selectHtml = selectHtml;
window.numHtml = numHtml;
window.numFraccionHtml = numFraccionHtml;
window.textHtml = textHtml;
window.escapeHtml = escapeHtml;
window.tituloCase = tituloCase;
window.tituloCaseProducto = tituloCaseProducto;
window.camposRequeridos = camposRequeridos;
window.tieneDatosMinimos = tieneDatosMinimos;
window.badgeForQ = badgeForQ;
window.formatFraccionPulgadas = formatFraccionPulgadas;
window.formatEspesorPenetrante = formatEspesorPenetrante;
window.formatFraccionInput = formatFraccionInput;
window.rowIndexOf = rowIndexOf;
window.computeSingleRow = computeSingleRow;
})();
