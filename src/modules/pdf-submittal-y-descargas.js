// ============================================================================
// pdf-submittal-y-descargas.js — encapsulado en IIFE (sin exponer todo a window; ver export list abajo)
// ============================================================================
(function () {
function sanitizarNombreArchivo(nombre) {
  return (nombre || "archivo").replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim().slice(0, 120) || "archivo";
}

function extraerIdDrive(url) {
  const m = String(url || "").match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}
function urlDescargaDirecta(url) {
  const id = extraerIdDrive(url);
  return id ? `https://drive.google.com/uc?export=download&id=${id}` : url;
}

async function intentarObtenerBytesPDF(url) {
  if (/drive\.google\.com/.test(String(url || ""))) return null;
  try {
    const resp = await fetch(urlDescargaDirecta(url), { mode: "cors" });
    if (!resp.ok) return null;
    const buf = await resp.arrayBuffer();
    const bytes = new Uint8Array(buf);
    if (bytes.length < 5) return null;
    const firma = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4]);
    if (firma !== "%PDF-") return null;
    return bytes;
  } catch (e) {
    return null;
  }
}

async function descargarArchivosMultiples(items, etiqueta) {
  if (!items || items.length === 0) { mostrarToast("No hay archivos para descargar.", "error"); return; }

  if (window.showDirectoryPicker) {
    let dirHandle;
    try {
      dirHandle = await window.showDirectoryPicker();
    } catch (e) {
      return;
    }
    let ok = 0, fallidos = 0;
    const usados = new Set();
    for (const it of items) {
      let nombreArchivo = sanitizarNombreArchivo(it.nombre) + ".pdf";
      let n = 2;
      while (usados.has(nombreArchivo)) { nombreArchivo = sanitizarNombreArchivo(it.nombre) + ` (${n++}).pdf`; }
      usados.add(nombreArchivo);

      const bytes = await intentarObtenerBytesPDF(it.url);
      if (bytes) {
        try {
          const fileHandle = await dirHandle.getFileHandle(nombreArchivo, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(bytes);
          await writable.close();
          ok++;
          continue;
        } catch (e) { }
      }
      fallidos++;
      window.open(it.url, "_blank");
    }
    mostrarToast(
      `${etiqueta}: ${ok} de ${items.length} archivo(s) guardados en la carpeta elegida.` +
      (fallidos ? ` ${fallidos} no se pudieron descargar automáticamente (se abrieron en pestañas nuevas para guardarlos a mano).` : ""),
      fallidos === items.length ? "error" : undefined
    );
  } else {
    mostrarToast(`Tu navegador no permite elegir una carpeta para varios archivos a la vez — se van a abrir ${items.length} pestaña(s), una por archivo, para guardarlos manualmente. Si tu navegador bloquea las ventanas emergentes, permitilas para este sitio.`);
    items.forEach((it, i) => setTimeout(() => window.open(it.url, "_blank"), i * 400));
  }
}

function descargarSistemasUL() {
  const computed = computeAllRows().filter(tieneDatosMinimos);
  const resumen = computeResumen(computed, CONFIG.C17, {
    FS_ONE_MAX: CONFIG.UMB_FS, CP606: CONFIG.UMB_CP606, CFS_SIL_GG: CONFIG.UMB_SILGG
  });
  if (resumen.normativas.length === 0) { mostrarToast("Todavía no hay normativa determinada para descargar.", "error"); return; }
  const items = resumen.normativas.filter(n => n.link).map(n => ({ nombre: n.norma, url: n.link }));
  descargarArchivosMultiples(items, "Sistemas UL");
}

function descargarFichasTecnicas() {
  const computed = computeAllRows().filter(tieneDatosMinimos);
  const resumen = computeResumen(computed, CONFIG.C17, {
    FS_ONE_MAX: CONFIG.UMB_FS, CP606: CONFIG.UMB_CP606, CFS_SIL_GG: CONFIG.UMB_SILGG
  });
  if (resumen.fichasTecnicas.length === 0) { mostrarToast("Todavía no hay fichas técnicas para descargar.", "error"); return; }
  const items = resumen.fichasTecnicas.filter(f => f.link).map(f => ({ nombre: f.nombre, url: f.link }));
  descargarArchivosMultiples(items, "Fichas técnicas");
}

function construirIndicePDF(titulo, filas, columnas, links) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const marginL = 40;
  const safe = dibujarLetterheadPDF(doc, titulo);
  let y = safe.top;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  doc.text(`Proyecto: ${PROJECT_INFO.nombre || "—"}    Cliente: ${PROJECT_INFO.cliente || "—"}    Fecha: ${fechaLegible(PROJECT_INFO.fecha) || "—"}`, marginL, y);
  y += 16;
  if (links) {
    doc.setFontSize(8.5);
    doc.setTextColor(120, 120, 120);
    doc.text("Toque una fila para abrir el documento original (útil cuando el archivo está en Google Drive y no se pudo incorporar más abajo).", marginL, y, { maxWidth: 520 });
  }
  y += 14;
  doc.autoTable({
    startY: y,
    margin: { left: marginL, right: marginL, top: safe.top, bottom: 792 - safe.bottom },
    head: [columnas],
    body: filas,
    styles: { fontSize: 9, cellPadding: 5, textColor: links ? [30, 90, 200] : [20, 20, 20] },
    headStyles: { fillColor: [26, 26, 26], textColor: 255 },
    didDrawPage: () => dibujarLetterheadPDF(doc, titulo),
  });
  return new Uint8Array(doc.output("arraybuffer"));
}

function construirIndiceInternoPDF(titulo, filas, columnas, opciones) {
  const opts = Object.assign({ colLink: 0, columnStyles: {} }, opciones);
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const marginL = 40;
  const safe = dibujarLetterheadPDF(doc, titulo);
  let y = safe.top;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  doc.text(`Proyecto: ${PROJECT_INFO.nombre || "—"}    Cliente: ${PROJECT_INFO.cliente || "—"}    Fecha: ${fechaLegible(PROJECT_INFO.fecha) || "—"}`, marginL, y);
  y += 16;
  doc.setFontSize(8.5);
  doc.setTextColor(120, 120, 120);
  doc.text("Toque una fila para saltar directo al documento, más abajo en este mismo PDF.", marginL, y, { maxWidth: 520 });
  y += 14;

  const rects = [];
  const paginaPorFila = [];
  doc.autoTable({
    startY: y,
    margin: { left: marginL, right: marginL, top: safe.top, bottom: 792 - safe.bottom },
    head: [columnas],
    body: filas,
    styles: { fontSize: 9, cellPadding: { top: 7, bottom: 7, left: 8, right: 8 }, textColor: [20, 20, 20], lineColor: [232, 232, 232], lineWidth: 0.5 },
    headStyles: { fillColor: [26, 26, 26], textColor: 255, fontStyle: "bold", fontSize: 8.5 },
    alternateRowStyles: { fillColor: [248, 248, 249] },
    columnStyles: Object.assign({ [opts.colLink]: { fontStyle: "bold" } }, opts.columnStyles),
    didDrawPage: () => dibujarLetterheadPDF(doc, titulo),
    didDrawCell: (data) => {
      if (data.section === "body" && data.column.index === opts.colLink) {
        rects[data.row.index] = { x: data.cell.x, y: data.cell.y, width: data.cell.width, height: data.cell.height };
        paginaPorFila[data.row.index] = doc.internal.getCurrentPageInfo().pageNumber - 1;
      }
    },
  });
  return { bytes: new Uint8Array(doc.output("arraybuffer")), rects, paginaPorFila };
}

const CERTIFICADO_FM_URL = "https://productdata.hilti.com/APQ_HC_RAW/ASSET_DOC_LOC_1545898.pdf";

const CERTIFICADOS_UL_POR_PRODUCTO = [
  { patron: /fs.?one.?max/i, url: "https://productdata.hilti.com/APQ_HC_RAW/ASSET_DOC_LOC_4181516.pdf", nombre: "FS ONE MAX Intumescent Sealant" },
  { patron: /con\s+collar/i, url: "https://productdata.hilti.com/APQ_HC_RAW/ASSET_DOC_LOC_1545909.pdf", nombre: "CP 648-ER Collar de Retención" },
  { patron: /cp\s*606/i, url: "https://productdata.hilti.com/APQ_HC_RAW/ASSET_DOC_LOC_1545907.pdf", nombre: "CP 606 Flexible Firestop Sealant" },
  { patron: /sil\s*gg/i, url: "https://productdata.hilti.com/APQ_HC_RAW/ASSET_DOC_LOC_4507731.pdf", nombre: "CFS SIL GG Sealant" },
  { patron: /sp\s*wb/i, url: "https://productdata.hilti.com/APQ_HC_RAW/ASSET_DOC_LOC_1545929.pdf", nombre: "CFS SP WB Firestop Joint Spray" },
  { patron: /almohadilla|cfs-?bl/i, url: "https://productdata.hilti.com/APQ_HC_RAW/ASSET_DOC_LOC_1545934.pdf", nombre: "CFS-BL Firestop Block" },
  { patron: /espuma|cp\s*620/i, url: "https://productdata.hilti.com/APQ_HC_RAW/ASSET_DOC_LOC_1545925.pdf", nombre: "CP 620 Firestop Foam" },
  { patron: /putty|cp\s*617/i, url: "https://productdata.hilti.com/APQ_HC_RAW/ASSET_DOC_LOC_1545930.pdf", nombre: "CP 617 Firestop Putty Pad" },
  { patron: /msl/i, url: "https://productdata.hilti.com/APQ_HC_RAW/ASSET_DOC_LOC_17479311.pdf", nombre: "CFS-MSL Firestop Device" },
  { patron: /manga|cp\s*653/i, url: "https://productdata.hilti.com/APQ_HC_RAW/ASSET_DOC_LOC_1545926.pdf", nombre: "CP 653 Speed Sleeve" },
  { patron: /collar[ií]n|cp\s*643|cp\s*644/i, url: "https://productdata.hilti.com/APQ_HC_RAW/ASSET_DOC_LOC_1545922.pdf", nombre: "CP 643N/644 Collarín" },
  { patron: /mortero|cp\s*637/i, url: "https://productdata.hilti.com/APQ_HC_RAW/ASSET_DOC_LOC_1545908.pdf", nombre: "CP 637 Mortero" },
];

function obtenerCertificadosAplicables(computedRows, computedJRows) {
  const nombresUsados = new Set();
  (computedRows || []).forEach(r => { if (r.P) nombresUsados.add(r.P); });
  (computedJRows || []).forEach(r => { if (r.producto) nombresUsados.add(r.producto); });
  const encontrados = [];
  CERTIFICADOS_UL_POR_PRODUCTO.forEach(({ patron, url, nombre }) => {
    const aplica = Array.from(nombresUsados).some(n => patron.test(n));
    if (aplica && !encontrados.some(e => e.url === url)) encontrados.push({ url, nombre });
  });
  return encontrados;
}

function categorizarNormativas(normas) {
  const juntas = normas.filter(n => /^junta/i.test(n.aplicacion || ""));
  const resto = normas.filter(n => !/^junta/i.test(n.aplicacion || ""));
  const paredLiviana = resto.filter(n => /pared liviana/i.test(n.aplicacion || ""));
  const concreto = resto.filter(n => /concreto/i.test(n.aplicacion || ""));
  return { paredLiviana, concreto, juntas };
}

function stripAplicacionSufijo(aplicacion) {
  return (aplicacion || "")
    .replace(/\s+en\s+(losa\s+o\s+pared\s+de\s+concreto|pared\s+o\s+losa\s+de\s+concreto|pared\s+de\s+concreto|losa\s+de\s+concreto|pared\s+liviana)\.?$/i, "")
    .trim();
}

const FAMILIAS_PRODUCTO_HILTI = [
  /fs.?one.?max/i, /cp\s*606/i, /sil\s*gg/i, /sp\s*wb/i, /lana\s*mineral/i,
  /putty|cp\s*617/i, /espuma|cp\s*620/i, /manga|cp\s*653/i,
  /cinta|collar[ií]n|cp\s*648/i, /almohadilla|cfs-?bl/i, /msl/i, /mortero|cp\s*637/i,
];
function familiaDeTexto(texto) {
  return FAMILIAS_PRODUCTO_HILTI.find(p => p.test(texto || "")) || null;
}
function datosFichaProducto(ficha, resumen) {
  const familia = familiaDeTexto(ficha.nombre);
  if (!familia) return { presentaciones: [], sistemas: [] };
  const presSet = new Set();
  (resumen.items || []).forEach(it => {
    const productoLimpio = (it.producto || "").replace(/\s*\(Juntas\)$/, "");
    if (familia.test(productoLimpio)) presSet.add(it.presentacion);
  });
  const sisSet = new Set();
  (resumen.normativas || []).forEach(n => { if (familia.test(n.productoHilti || "")) sisSet.add(n.norma); });
  return { presentaciones: Array.from(presSet), sistemas: Array.from(sisSet).sort() };
}

function agregarLinkInternoPDF(pdfDoc, page, rectJsPDF, paginaDestino) {
  const { PDFName } = window.PDFLib;
  const { height: alturaPagina } = page.getSize();
  const y1 = alturaPagina - (rectJsPDF.y + rectJsPDF.height);
  const y2 = alturaPagina - rectJsPDF.y;
  const annotRef = pdfDoc.context.register(
    pdfDoc.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [rectJsPDF.x, y1, rectJsPDF.x + rectJsPDF.width, y2],
      Border: [0, 0, 0],
      Dest: [paginaDestino.ref, PDFName.of("Fit")],
    })
  );
  const existing = page.node.lookup(PDFName.of("Annots"));
  if (existing) {
    existing.push(annotRef);
  } else {
    page.node.set(PDFName.of("Annots"), pdfDoc.context.obj([annotRef]));
  }
}

function crearConstructorMarcadores() {
  const items = [];
  return {
    agregar(titulo, pagina, nivel) {
      items.push({ titulo, pagina, nivel: nivel || 0 });
    },
    aplicar(pdfDoc) {
      if (items.length === 0) return;
      const { PDFName, PDFString, PDFNumber } = window.PDFLib;
      const ctx = pdfDoc.context;

      const nodos = items.map(it => ({ ...it, ref: null, first: null, last: null, next: null, prev: null, parent: null, count: 0 }));
      const pila = [];
      nodos.forEach(n => {
        while (pila.length > n.nivel) pila.pop();
        n.parent = pila.length > 0 ? pila[pila.length - 1] : null;
        pila[n.nivel] = n;
      });

      nodos.forEach(n => { n.ref = ctx.nextRef(); });

      nodos.forEach((n, i) => {
        const hermanos = nodos.filter(x => x.parent === n.parent);
        const idx = hermanos.indexOf(n);
        n.prev = idx > 0 ? hermanos[idx - 1] : null;
        n.next = idx < hermanos.length - 1 ? hermanos[idx + 1] : null;
        if (n.parent) {
          const hijos = nodos.filter(x => x.parent === n.parent);
          n.parent.first = hijos[0];
          n.parent.last = hijos[hijos.length - 1];
          n.parent.count = hijos.length;
        }
      });

      nodos.forEach(n => {
        const dict = {
          Title: PDFString.of(n.titulo),
          Dest: [n.pagina.ref, PDFName.of("Fit")],
        };
        if (n.parent) dict.Parent = n.parent.ref;
        if (n.first) dict.First = n.first.ref;
        if (n.last) dict.Last = n.last.ref;
        if (n.prev) dict.Prev = n.prev.ref;
        if (n.next) dict.Next = n.next.ref;
        if (n.count > 0) dict.Count = PDFNumber.of(n.count);
        ctx.assign(n.ref, ctx.obj(dict));
      });

      const raices = nodos.filter(n => !n.parent);
      const outlineRef = ctx.nextRef();
      const outlineDict = {
        Type: PDFName.of("Outlines"),
        Count: PDFNumber.of(raices.length),
      };
      if (raices.length > 0) {
        outlineDict.First = raices[0].ref;
        outlineDict.Last = raices[raices.length - 1].ref;
        raices.forEach(n => {
          const obj = ctx.lookup(n.ref);
          obj.set(PDFName.of("Parent"), outlineRef);
        });
      }
      ctx.assign(outlineRef, ctx.obj(outlineDict));
      pdfDoc.catalog.set(PDFName.of("Outlines"), outlineRef);
      pdfDoc.catalog.set(PDFName.of("PageMode"), PDFName.of("UseOutlines"));
    },
  };
}

async function agregarNumeracionFinalPDF(pdfDoc) {
  const font = await pdfDoc.embedFont(window.PDFLib.StandardFonts.Helvetica);
  const paginas = pdfDoc.getPages();
  const total = paginas.length;
  paginas.forEach((pagina, i) => {
    const { width } = pagina.getSize();
    const texto = `Página ${i + 1} de ${total}`;
    const anchoTexto = font.widthOfTextAtSize(texto, 8);
    pagina.drawText(texto, {
      x: width - anchoTexto - 24, y: 16, size: 8, font,
      color: window.PDFLib.rgb(0.45, 0.45, 0.45),
    });
  });
}

async function descargarSubmittal() {
  try {
    await descargarSubmittalInterno();
  } catch (err) {
    mostrarToast("No se pudo generar el Submittal: " + err.message, "error");
  }
}

function construirPortadaSubmittalPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const marginL = 60;
  const safe = dibujarLetterheadPDF(doc, "");
  let y = safe.top + 40;

  doc.setTextColor(226, 0, 26);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.text("SUBMITTAL", marginL, y);
  y += 26;
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(15);
  doc.text("Sellos Cortafuego — Fichas Técnicas y Sistemas UL", marginL, y);
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
  const intro = "SUPERBA S.A., cédula jurídica # 3-101-011224-27, y con más de 53 años de experiencia en el mercado, tiene el agrado de presentar de parte del Departamento de Ingeniería el presente Submittal de sellos cortafuego para el proyecto indicado arriba, con las fichas técnicas de los productos Hilti especificados y los sistemas UL 1479 aplicables según el levantamiento realizado en obra.";
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

  return new Uint8Array(doc.output("arraybuffer"));
}

async function descargarSubmittalInterno() {
  const computed = computeAllRows().filter(tieneDatosMinimos);
  const computedJ = computeAllJuntaRows().filter(tieneDatosMinimosJunta);
  const resumen = computeResumen(computed, CONFIG.C17, {
    FS_ONE_MAX: CONFIG.UMB_FS, CP606: CONFIG.UMB_CP606, CFS_SIL_GG: CONFIG.UMB_SILGG
  });
  mezclarResumenJuntas(resumen, computedJ);

  const fichas = resumen.fichasTecnicas.filter(f => f.link);
  const normasTodas = resumen.normativas.filter(n => n.link);
  const { paredLiviana: normasParedLiviana, concreto: normasConcreto, juntas: normasJuntas } = categorizarNormativas(normasTodas);
  const certificados = obtenerCertificadosAplicables(computed, computedJ);

  if (fichas.length === 0 && normasTodas.length === 0) {
    mostrarToast("Todavía no hay fichas técnicas ni normativa para armar el Submittal.", "error");
    return;
  }

  const toastProgreso = mostrarToastProgreso("Armando el Submittal... esto puede tardar unos segundos.");
  try {

  const PDFLib = window.PDFLib;
  const master = await PDFLib.PDFDocument.create();
  let fallidos = 0;

  async function copiarOAviso(bytes, tituloAviso, linkExterno) {
    if (bytes) {
      try {
        const src = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
        return await master.copyPages(src, src.getPageIndices());
      } catch (e) { }
    }
    fallidos++;
    const avisoBytes = construirIndicePDF(tituloAviso, [["No se pudo incorporar automáticamente — toque para abrir"]], ["Documento"], [linkExterno]);
    const avisoDoc = await PDFLib.PDFDocument.load(avisoBytes);
    return await master.copyPages(avisoDoc, avisoDoc.getPageIndices());
  }

  async function copiarSistemas(lista) {
    const out = [];
    for (const n of lista) {
      const bytes = await intentarObtenerBytesPDF(n.link);
      out.push(await copiarOAviso(bytes, `Sistema no disponible — ${n.norma}`, n.link));
    }
    return out;
  }

  const portadaSrc = await PDFLib.PDFDocument.load(construirPortadaSubmittalPDF());
  const portadaPaginas = await master.copyPages(portadaSrc, portadaSrc.getPageIndices());

  const fichaPaginas = [];
  for (const f of fichas) {
    const bytes = await intentarObtenerBytesPDF(f.link);
    fichaPaginas.push(await copiarOAviso(bytes, `Ficha no disponible — ${f.nombre || ""}`, f.link));
  }

  const fmBytes = await intentarObtenerBytesPDF(CERTIFICADO_FM_URL);
  const fmPaginas = await copiarOAviso(fmBytes, "Certificado FM no disponible", CERTIFICADO_FM_URL);

  const certPaginas = [];
  for (const c of certificados) {
    const bytes = await intentarObtenerBytesPDF(c.url);
    certPaginas.push(await copiarOAviso(bytes, `Certificado no disponible — ${c.nombre}`, c.url));
  }

  const paginasParedLiviana = await copiarSistemas(normasParedLiviana);
  const paginasConcreto = await copiarSistemas(normasConcreto);
  const paginasJuntas = await copiarSistemas(normasJuntas);

  async function construirIndiceConRefs(titulo, columnas, filasSrc, mapaFila, opciones) {
    if (filasSrc.length === 0) return null;
    const filas = filasSrc.map(mapaFila);
    const idx = construirIndiceInternoPDF(titulo, filas, columnas, opciones);
    const src = await PDFLib.PDFDocument.load(idx.bytes);
    const paginas = await master.copyPages(src, src.getPageIndices());
    return { paginas, rects: idx.rects, paginaPorFila: idx.paginaPorFila };
  }
  const anchoSistemasCols = { columnStyles: { 0: { cellWidth: 76 }, 1: { cellWidth: "auto" }, 2: { cellWidth: 150 } } };
  const anchoFichasCols = { columnStyles: { 0: { cellWidth: 190 }, 1: { cellWidth: 130 }, 2: { cellWidth: "auto" } } };

  const idxFichas = await construirIndiceConRefs("Índice — Fichas Técnicas", ["Producto", "Presentación", "Sistemas UL del proyecto"], fichas, f => {
    const { presentaciones, sistemas } = datosFichaProducto(f, resumen);
    return [f.nombre || "Ficha técnica", presentaciones.join(", ") || "-", sistemas.join(", ") || "-"];
  }, anchoFichasCols);
  const idxParedLiviana = await construirIndiceConRefs("Sistemas UL — Pared Liviana (Penetrantes)", ["Sistema UL", "Aplicación", "Producto Hilti"], normasParedLiviana, n => [n.norma, stripAplicacionSufijo(n.aplicacion) || "-", n.productoHilti || "-"], anchoSistemasCols);
  const idxConcreto = await construirIndiceConRefs("Sistemas UL — Concreto (Penetrantes)", ["Sistema UL", "Aplicación", "Producto Hilti"], normasConcreto, n => [n.norma, stripAplicacionSufijo(n.aplicacion) || "-", n.productoHilti || "-"], anchoSistemasCols);
  const idxJuntas = await construirIndiceConRefs("Sistemas UL — Juntas", ["Sistema UL", "Aplicación", "Producto Hilti"], normasJuntas, n => [n.norma, n.aplicacion || "-", n.productoHilti || "-"], anchoSistemasCols);

  let cursor = 0;
  const insertar = (paginas) => { (paginas || []).forEach(p => { master.insertPage(cursor, p); cursor++; }); };
  insertar(portadaPaginas);
  if (idxFichas) insertar(idxFichas.paginas);
  fichaPaginas.forEach(insertar);
  insertar(fmPaginas);
  certPaginas.forEach(insertar);
  if (idxParedLiviana) insertar(idxParedLiviana.paginas);
  if (idxConcreto) insertar(idxConcreto.paginas);
  if (idxJuntas) insertar(idxJuntas.paginas);
  paginasParedLiviana.forEach(insertar);
  paginasConcreto.forEach(insertar);
  paginasJuntas.forEach(insertar);

  function agregarLinksIndice(idxInfo, filasSrc, paginasPorFila) {
    if (!idxInfo) return;
    filasSrc.forEach((_, i) => {
      const rect = idxInfo.rects[i];
      const paginaFisica = idxInfo.paginas[idxInfo.paginaPorFila[i]];
      const paginaDestino = paginasPorFila[i] && paginasPorFila[i][0];
      if (rect && paginaFisica && paginaDestino) agregarLinkInternoPDF(master, paginaFisica, rect, paginaDestino);
    });
  }
  agregarLinksIndice(idxFichas, fichas, fichaPaginas);
  agregarLinksIndice(idxParedLiviana, normasParedLiviana, paginasParedLiviana);
  agregarLinksIndice(idxConcreto, normasConcreto, paginasConcreto);
  agregarLinksIndice(idxJuntas, normasJuntas, paginasJuntas);

  const marcadores = crearConstructorMarcadores();
  marcadores.agregar("Portada", portadaPaginas[0], 0);
  if (idxFichas) {
    marcadores.agregar("Tabla de Fichas Técnicas", idxFichas.paginas[0], 0);
    fichas.forEach((f, i) => { if (fichaPaginas[i][0]) marcadores.agregar(f.nombre || "Ficha técnica", fichaPaginas[i][0], 1); });
  }
  marcadores.agregar("Certificado FM", fmPaginas[0], 0);
  if (certPaginas.length > 0) {
    marcadores.agregar("Certificados UL", certPaginas[0][0], 0);
    certificados.forEach((c, i) => { if (certPaginas[i][0]) marcadores.agregar(c.nombre, certPaginas[i][0], 1); });
  }
  if (idxParedLiviana) {
    marcadores.agregar("Sistemas UL - Pared Liviana", idxParedLiviana.paginas[0], 0);
    normasParedLiviana.forEach((n, i) => { if (paginasParedLiviana[i][0]) marcadores.agregar(n.norma, paginasParedLiviana[i][0], 1); });
  }
  if (idxConcreto) {
    marcadores.agregar("Sistemas UL - Concreto", idxConcreto.paginas[0], 0);
    normasConcreto.forEach((n, i) => { if (paginasConcreto[i][0]) marcadores.agregar(n.norma, paginasConcreto[i][0], 1); });
  }
  if (idxJuntas) {
    marcadores.agregar("Sistemas UL - Juntas", idxJuntas.paginas[0], 0);
    normasJuntas.forEach((n, i) => { if (paginasJuntas[i][0]) marcadores.agregar(n.norma, paginasJuntas[i][0], 1); });
  }
  marcadores.aplicar(master);

  await agregarNumeracionFinalPDF(master);

  const finalBytes = await master.save();
  const blob = new Blob([finalBytes], { type: "application/pdf" });
  const nombre = (PROJECT_INFO.nombre || "proyecto").replace(/[^a-z0-9\-_ ]/gi, "").trim().replace(/\s+/g, "-") || "proyecto";
  await window.compartirODescargarPDF(blob, `${nombre}-submittal.pdf`, {
    titulo: `Submittal — ${PROJECT_INFO.nombre || "proyecto"}`,
    texto: `Submittal de sello cortafuego para ${PROJECT_INFO.nombre || "el proyecto"}.`,
  });

  mostrarToast(
    fallidos === 0
      ? "Submittal generado con todos los documentos incluidos, con marcadores y links internos."
      : `Submittal generado. ${fallidos} documento(s) (alojados en Google Drive) no se pudieron incrustar automáticamente por CORS — quedaron como página de aviso con link externo para abrir con un toque.`
  );
  } finally {
    ocultarToastProgreso(toastProgreso);
  }
}
const APP_VERSION = "1.0.0";
window.APP_VERSION = APP_VERSION;

window.descargarSistemasUL = descargarSistemasUL;
window.descargarFichasTecnicas = descargarFichasTecnicas;
window.descargarSubmittal = descargarSubmittal;
})();
