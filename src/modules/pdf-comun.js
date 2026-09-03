// ============================================================================
// pdf-comun.js — encapsulado en IIFE (sin exponer todo a window; ver export list abajo)
// ============================================================================
(function () {
// ============================================================================
// pdf-comun.js
// Letterhead PDF — fondo de hoja membretada Superba (logo + banda + pie de página), reutilizado por todos los PDF.
// (Parte del proyecto Calculadora Cortafuego Hilti — ver README.md para el mapa completo de módulos.)
// ============================================================================

// Letterhead PDF -- dibuja el fondo de hoja membretada SUPERBA (logo + banda +
// pie de pagina con contacto) en la pagina actual. Devuelve el rango vertical
// seguro para contenido: { top, bottom } en puntos (formato carta, 612x792).
// ============================================================================
const HILTI_LOGO_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAc4AAABtCAIAAACnexYTAAAFAklEQVR42u3cTWgcVQDA8TezedlssrWYVG0sNhDqQa2IIIKgFy+CIHiwN0FEaE9FPWhb/EJBKt6kN0+K1ouevCnUa6FFeynVQ21pNUZbm9K6zWYz3VkvBkrNwY+87Uz6+x23MPPezNv/TpLuy87u3rdwYH8eZ0IYBADWTBaKTrbptu3nv89dDIDUpBZAagGkFgCpBZBaAKkFQGoBpBYAqQWQWgCpBUBqAaQWQGoBkFoAqQVAagGkFkBqAZBaAKkFkFoA1sZI4uNnKQ8+qPa1zRIff3BTnnF93DsquN7SLraUqS2KXphPd/hmuD3EVlWDm5XFmSLZ0WMI+fXTH8IZp0OMQ5tjCKEZZ4Z/f8tioQgdnbuxYmjncera5R2Kbi+cS9mTqRAnapjaogj3bHzgm2Nx8x1JDv/rbz8+9GQx93OIY9Xs7MYX92zZ+3Ki6V/86tD8G2/1j/6wsjiysjgzuffNO197tdFOslwWDn4x/8br5enLK7X964x37X870UVcOPjFT8/uyOPWod66otjw1NOzX34idjfW6V27Ln/4WR4nV+5LN9s0ee/Xh8Yf3J7kfMtXf3jsieLI8XQ9Sfu72qudK7U7ci0GWS51V3+9k+pxrL/aXPrdXr8ON+LfveeWF5XuBuuXf3upMbjULZcWV/untTjhci/1nPxZDKhYabvd9TcpqQWQWgCpBUBqAaQWQGoBkFoAqQVAagGk9p+wCRNQdSO1Hn0ZFvOiUc2xDYolywuofWqLufkQOmVl97u72rW8gHqntrVt9v7e2UoPsZGHhl+FAzV/qg2jI+4fUAseuwCkFkBqAZBaAKkFkFoApBZAagGQWqBqGu2JMNIKlf3O/X/iC1dwjTix/O2Js8+/VHaq8j4ve7143+ymF55rbZtNcfzFY8fPffxpeWoubzarcx96h4/lYfqaF/pSC+vK4PdLFz/6oFJDasUdgz8WU6V8aXHp8NHekW8q9uP2dIjx2iddqYWkhr4fcRzNw0x15l8WF5J3bcN4CO08TlXqI2+drWOppbqKEGJxpr7j/9ujWfU/aQZWndRycxmd3Xrr4880JjfWdPxlr7f83Ylibv5/1xaphWTajzzcPvR5fcff71z55d33F957Jw8znhbxn70gzVNtp9Pv9lwHpBZAagGkFgCpBZBaAKkFQGoBpBaAFXX+ttjy1UoPr5GHhk8yoM6p7Z48dfLuR8swX9kR3rJz5+ZX9iTaYxSQ2iGJW6Z7c3/kYUMFx1aG+TDSsryA2qc2hJCH8RBHq7eXRxaKkMUxywtYiVXt2TMJkFoAqXUJAKQWQGoBkFoAqQWQWgCkFkBqAZBagLqndqQ9Ubsj12KQ+djqe9nk7XaiMzZWm0uj1WzU4UbcEHFyag2Plm0YT7aWxutwOfvZxlY+Np5oY9LGaDP1BLKzu/ctHNifx5m130ygKHopNzlshttDbFV1D4SsLM4U6d7GIeTXT38IZ5wOMQ5tjuuhtiGsxTsrK4sLReikHGc7j1PV3k4kC0W3F86l7MlUiBMJht3JNt22/fz3KXf2irEZZlJe/UGFF8cgjzOJPyivm/5wzjjkOa4Dg7VYS1PNMFX5cSYeXhxL35OUP+Pe3Pdvnc39ZjijteQ61JI/iwFILYDUAiC1AFILILUASC2A1AIgtQBSCyC1AEgtgNQCSC0AUgsgtQBILYDUAkgtAFILILUAUguA1ALUxJ9DOT50bN035AAAAABJRU5ErkJggg==";

function dibujarLetterheadPDF(doc, tituloDoc) {
  // Franjas recortadas del membretado (no la hoja completa) para mantener el
  // PDF liviano: header 1275x260px -> 612x125pt; footer 1275x120px -> 612x58pt.
  doc.addImage(LETTERHEAD_HEADER_PNG, "PNG", 0, 0, 612, 125, undefined, "FAST");
  doc.addImage(LETTERHEAD_FOOTER_PNG, "PNG", 0, 734, 612, 58, undefined, "FAST");

  // Logo Hilti real, dentro de la banda gris (x: 214-612, y: 66-85 pt),
  // alineado a la derecha, antes del margen.
  const logoW = 70, logoH = logoW * (109 / 462);
  const logoX = 552 - logoW, logoY = 66 + (19 - logoH) / 2;
  doc.addImage(HILTI_LOGO_PNG, "PNG", logoX, logoY, logoW, logoH, undefined, "FAST");

  // Título: arranca después del logo SUPERBA (que termina ~x=214) y termina
  // antes del logo Hilti, con auto-ajuste de tamaño si el texto es largo,
  // para que siempre quede en una sola línea dentro de la banda gris.
  const tituloX = 226, tituloMaxWidth = logoX - 14 - tituloX;
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  let tFontSize = 13;
  if (tituloDoc) {
    doc.setFontSize(tFontSize);
    while (tFontSize > 8 && doc.getTextWidth(tituloDoc) > tituloMaxWidth) {
      tFontSize -= 0.5;
      doc.setFontSize(tFontSize);
    }
  }
  doc.text(tituloDoc || "", tituloX, 80);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(20, 20, 20);
  return { top: 140, bottom: 735 };
}

function dibujarNumeroPaginaPDF(doc, pagina, total) {
  doc.setFontSize(8);
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "normal");
  doc.text("Página " + pagina + " de " + total, 600, 778, { align: "right" });
  doc.setTextColor(20, 20, 20);
}

// Texto de "Dimensión" para una fila de penetrante en el PDF, reutilizado por
// las tablas de Levantamiento (detallado) y Levantamiento Resumido. Replica
// la misma lógica que la vista en pantalla (renderTablaAgrupadaHTML /
// renderTablaResumidaPenetrantesHTML): dimensión base + espesor de
// aislamiento si aplica, más el diámetro total (tubo + 2× aislamiento)
// cuando la fila usa diámetro simple (campo D en pulgadas).
function dimensionPenetrantePDF(r) {
  const esRedondoLibre = levUsaDiametroLibre(r.L) && r.F !== "";
  const esAisl = n(r.E) > 0;
  let dimBase;
  if (r.D !== "") dimBase = formatFraccionPulgadas(r.D);
  else if (esRedondoLibre) dimBase = `⌀${formatFraccionPulgadas(n(r.F) / 2.54)}`;
  else if (r.F !== "") dimBase = `${r.F}×${r.G}${r.H !== "" ? "×" + r.H : ""} cm`;
  else dimBase = "—";

  let texto = dimBase;
  if (esAisl) {
    texto += `\n+${formatFraccionPulgadas(r.E)} aisl`;
    if (r.D !== "") {
      const diametroTotal = n(r.D) + 2 * n(r.E);
      texto += `\nØ total ${formatFraccionPulgadas(diametroTotal)}`;
    }
  }
  return texto;
}

function construirReportePDF(opciones) {
  const opts = Object.assign({ levantamiento: true, levantamientoResumido: false, resumen: true }, opciones);
  const computed = computeAllRows().filter(tieneDatosMinimos);
  const resumen = computeResumen(computed, CONFIG.C17, {
    FS_ONE_MAX: CONFIG.UMB_FS, CP606: CONFIG.UMB_CP606, CFS_SIL_GG: CONFIG.UMB_SILGG
  });
  const computedJ_pdf = computeAllJuntaRows().filter(tieneDatosMinimosJunta);
  mezclarResumenJuntas(resumen, computedJ_pdf);

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const marginL = 40;
  const marginR = 40;
  const espacioEntreTablas = 34;

  const tituloReporte = !opts.resumen && opts.levantamientoResumido ? "Levantamiento Resumido — Penetrantes y Juntas"
    : !opts.resumen ? "Levantamiento — Penetrantes y Juntas"
    : !opts.levantamiento && !opts.levantamientoResumido ? "Resumen de Materiales y Normativa"
    : "Informe Sellos Cortafuego";

  const safe = dibujarLetterheadPDF(doc, tituloReporte);
  let y = safe.top;
  const tableMargin = { left: marginL, right: marginR, top: safe.top, bottom: 792 - safe.bottom };
  // didDrawPage SOLO repinta el membretado — nunca dibuja títulos. En esta
  // versión de jsPDF-AutoTable, el valor de d.settings.startY que llega al
  // hook no es confiable para posicionar texto (se probó con un PDF real:
  // en tablas que continúan en una página nueva, ese valor no corresponde
  // al tope de la tabla, sino a la fila donde el motor decidió invocar el
  // hook, dando títulos flotando a mitad de tabla). Por eso el título de
  // cada sección se dibuja aparte, como texto plano y secuencial, siempre
  // ANTES de llamar a autoTable — así queda garantizado que aparece una
  // sola vez y en el lugar correcto, sin depender del hook para nada.
  const dibujarCabeceraPagina = (d) => {
    dibujarLetterheadPDF(doc, tituloReporte);
  };

  // Altura de fila aproximada de autoTable para este documento, calibrada
  // contra PDFs reales generados con esta misma configuración de fuente:
  // altura ≈ cellPadding×2 + fontSize×1.15 (+8% de margen de seguridad).
  const alturaFilaAprox = (fontSize, cellPadding) => (cellPadding * 2 + fontSize * 1.15) * 1.08;
  const alturaTablaAprox = (numFilas, fontSize, cellPadding) =>
    alturaFilaAprox(fontSize, cellPadding) * (Math.max(numFilas, 1) + 1); // +1 por el encabezado

  // Si el título + la tabla estimada no entran en lo que queda de página,
  // salta a una nueva página ANTES de dibujar nada de esta sección — así
  // el título y su tabla siempre arrancan juntos. pageBreak:"avoid" en cada
  // autoTable queda como red de seguridad adicional por si esta estimación
  // se quedara corta.
  const alturaTitulo = 22;
  const asegurarEspacio = (alturaEstimadaTabla) => {
    if (y + alturaTitulo + alturaEstimadaTabla > safe.bottom) {
      doc.addPage();
      dibujarCabeceraPagina();
      y = safe.top;
    }
  };
  const dibujarTituloSeccion = (texto) => {
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "bold");
    doc.text(texto, marginL, y);
    doc.setFont("helvetica", "normal");
    y += alturaTitulo;
  };

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  doc.text(`Proyecto: ${PROJECT_INFO.nombre || "—"}    Cliente: ${PROJECT_INFO.cliente || "—"}    Fecha: ${fechaLegible(PROJECT_INFO.fecha) || "—"}`, marginL, y);
  y += 20;

  if (opts.resumen && resumen.alertas.length > 0) {
    doc.setTextColor(180, 0, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Filas que requieren atención:", marginL, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(20, 20, 20);
    resumen.alertas.forEach(a => {
      const linea = `${a.zona || "(sin zona)"} ${a.nivel ? "· Nivel " + a.nivel : ""}: ${a.mensaje}`;
      doc.text(linea, marginL, y, { maxWidth: 520 });
      y += 13;
    });
    y += 6;
  }

  // Levantamiento: detalle fila por fila, tal como se registró.
  // Cada subsección (Penetrantes / Juntas) solo se dibuja si tiene datos —
  // si un proyecto no tiene juntas, por ejemplo, no aparece ni el título.
  if (opts.levantamiento) {
    if (computed.length > 0) {
      asegurarEspacio(alturaTablaAprox(computed.length, 8, 4));
      dibujarTituloSeccion("Levantamiento — Penetrantes");
      doc.autoTable({
        startY: y,
        margin: tableMargin,
        pageBreak: "avoid",
        head: [["Zona", "Nivel", "Cant.", "Penetrante", "Dimensión", "Anular", "Barrera", "Producto", "Espesor", "Vueltas Cinta", "F Rating", "Nota"]],
        body: computed.map(r => {
          const esCinta = r.P === MAT_CINTA_CON || r.P === MAT_CINTA_SIN;
          const vueltas = esCinta ? vueltasCintaPenetrante(r) : null;
          return [
            r.A || "-", r.B || "-", String(r.C), TIPO_LABEL_CORTO[r.L] || r.L,
            dimensionPenetrantePDF(r),
            formatFraccionPulgadas(r.I), `${r.M}${r.MEM ? " (membrana)" : ""} / ${r.N}`,
            r.P || "—",
            formatEspesorPenetrante(r.P, r.V),
            vueltas !== null ? vueltas : "—", r.O, r.R || "",
          ];
        }),
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [26, 26, 26], textColor: 255 },
        didDrawPage: dibujarCabeceraPagina,
      });
      y = doc.lastAutoTable.finalY + espacioEntreTablas;
    }

    if (computedJ_pdf.length > 0) {
      asegurarEspacio(alturaTablaAprox(computedJ_pdf.length, 8, 4));
      dibujarTituloSeccion("Levantamiento — Juntas");
      doc.autoTable({
        startY: y,
        margin: tableMargin,
        pageBreak: "avoid",
        head: [["Zona", "Nivel", "Cant.", "Junta", "Barreras", "Producto", "Longitud (cm)", "Ancho (cm)", "Espesor", "Nota"]],
        body: computedJ_pdf.map(r => [
              r.A || "-", r.B || "-", String(r.cantidad),
              juntaLabelCorta(r, r.superiorInferior), barrerasLabelCorto(r.barreras), r.producto,
              String(r.longitud), String(r.ancho),
              r.espesorProductoIn !== null && r.espesorProductoIn !== undefined ? formatFraccionPulgadas(r.espesorProductoIn) : "—",
              r.nota || "-",
          ]),
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [26, 26, 26], textColor: 255 },
        didDrawPage: dibujarCabeceraPagina,
      });
      y = doc.lastAutoTable.finalY + espacioEntreTablas;
    }
  }

  // Levantamiento resumido: penetrantes agrupados por características
  // (tipo, dimensión, anular, producto, barrera y material — sin F Rating),
  // con cantidad total por grupo. Juntas se muestra igual que en el
  // detallado, ya que hoy no tiene una vista agrupada propia.
  // Cada subsección (Penetrantes / Juntas) solo se dibuja si tiene datos —
  // si un proyecto no tiene juntas, por ejemplo, no aparece ni el título.
  if (opts.levantamientoResumido) {
    const gruposPen = agruparPenetrantesPorCaracteristicas();
    const gruposJ = agruparJuntasPorCaracteristicas();

    if (gruposPen.length > 0) {
      // Reserva solo título + 1 fila: esta tabla puede ser muy larga (decenas
      // de grupos) y nunca entra completa en una sola página. Si acá se
      // reservara el alto estimado de la tabla completa, la sección entera
      // saltaría a la página siguiente dejando la portada en blanco.
      // pageBreak:"auto" ya se encarga de paginar el resto de las filas solo.
      asegurarEspacio(alturaTablaAprox(1, 8, 4));
      dibujarTituloSeccion("Levantamiento Resumido — Penetrantes");
      doc.autoTable({
        startY: y,
        margin: tableMargin,
        pageBreak: "auto",
        head: [["Cant. Total", "Penetrante", "Dimensión", "Anular", "Barrera", "Producto"]],
        body: gruposPen.map(({ rep: r, cantidad }) => [
          String(cantidad), TIPO_LABEL_CORTO[r.L] || r.L, dimensionPenetrantePDF(r),
          levOcultaAnular(r.L) ? "—" : formatFraccionPulgadas(r.I),
          `${r.M} / ${r.N}`, PROD_LABEL[r.P] || r.P || "—",
        ]),
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [26, 26, 26], textColor: 255 },
        didDrawPage: dibujarCabeceraPagina,
      });
      y = doc.lastAutoTable.finalY + espacioEntreTablas;
    }

    if (gruposJ.length > 0) {
      asegurarEspacio(alturaTablaAprox(gruposJ.length, 8, 4));
      dibujarTituloSeccion("Levantamiento Resumido — Juntas");
      doc.autoTable({
        startY: y,
        margin: tableMargin,
        pageBreak: "avoid",
        head: [["Junta", "Barreras", "Producto", "Longitud Total (cm)", "Ancho (cm)"]],
        body: gruposJ.map(({ rep: r, longitudTotal }) => {
          const filaSintetica = Object.assign({}, r, { longitud: longitudTotal, cantidad: 1 });
          const f = computeJuntaRow(filaSintetica);
          return [
            juntaLabelCorta(r, f.superiorInferior), barrerasLabelCorto(r.barreras), r.producto,
            String(Math.round(longitudTotal)),
            String(r.ancho),
          ];
        }),
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [26, 26, 26], textColor: 255 },
        didDrawPage: dibujarCabeceraPagina,
      });
      y = doc.lastAutoTable.finalY + espacioEntreTablas;
    }
  }

  if (opts.resumen) {
    const itemsConManualesPdf = combinarItemsConManuales(resumen.items);
    asegurarEspacio(alturaTablaAprox(itemsConManualesPdf.length, 8, 4));
    dibujarTituloSeccion("Cuantificación de Materiales Hilti");
    doc.autoTable({
      startY: y,
      margin: tableMargin,
      pageBreak: "avoid",
      head: [["Código", "Cantidad", "Producto", "Presentación", "Tipo"]],
      body: itemsConManualesPdf.length
        ? itemsConManualesPdf.map(it => [it.codigo, String(it.cantidad), tituloCaseProducto(it.producto) + (it.manual ? " (manual)" : (Number(it.manualExtra) > 0 ? " (incluye " + it.manualExtra + " manual)" : "")), it.presentacion, tituloCase(it.tipo)])
        : [["Sin materiales calculados", "", "", "", ""]],
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [26, 26, 26], textColor: 255 },
      columnStyles: { 1: { halign: "right" } },
      didDrawPage: dibujarCabeceraPagina,
    });
    y = doc.lastAutoTable.finalY + espacioEntreTablas;

    asegurarEspacio(alturaTablaAprox(resumen.normativas.length, 8, 4));
    dibujarTituloSeccion("Normativa Aplicable del Proyecto (Sistemas UL)");
    doc.autoTable({
      startY: y,
      margin: tableMargin,
      pageBreak: "avoid",
      head: [["Aplicación", "Sistema UL", "Producto Hilti", "Zona(s)"]],
      body: resumen.normativas.length
        ? resumen.normativas.map(nrm => [nrm.aplicacion || "-", nrm.norma, nrm.productoHilti, nrm.zonas || "-"])
        : [["Sin normativa determinada", "", "", ""]],
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [26, 26, 26], textColor: 255 },
      didDrawPage: dibujarCabeceraPagina,
    });
  }

  // Numeración final de páginas ("Página X de N") ahora que se sabe el total
  const totalPaginas = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPaginas; p++) {
    doc.setPage(p);
    dibujarNumeroPaginaPDF(doc, p, totalPaginas);
  }

  return doc;
}

// Comparte el PDF con el compartir nativo del celular (WhatsApp, correo, etc.)
// si el navegador lo soporta; si no, lo descarga — mismo comportamiento que
// antes tenía el botón "Compartir" del header, pero ahora vive en cada ítem
// del menú PDF, compartiendo/descargando exactamente el PDF que se tocó.
// `fuente` puede ser un doc de jsPDF (tiene .output) o ya un Blob (pdf-lib).
async function compartirODescargarPDF(fuente, filename, opts) {
  const blob = (fuente instanceof Blob) ? fuente : fuente.output("blob");
  const titulo = (opts && opts.titulo) || filename;
  const texto = (opts && opts.texto) || "";
  try {
    const file = new File([blob], filename, { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: titulo, text: texto });
      mostrarToast("PDF compartido.");
      return;
    }
  } catch (err) {
    if (err && err.name === "AbortError") return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  mostrarToast("PDF descargado.");
}

function descargarPDF(modo) {
  try {
    const opts = modo === "levantamiento" ? { levantamiento: true, resumen: false }
      : modo === "levantamiento-resumido" ? { levantamiento: false, levantamientoResumido: true, resumen: false }
      : modo === "resumen" ? { levantamiento: false, resumen: true }
      : { levantamiento: true, resumen: true };
    const doc = construirReportePDF(opts);
    const nombre = (PROJECT_INFO.nombre || "proyecto").replace(/[^a-z0-9\-_ ]/gi, "").trim().replace(/\s+/g, "-") || "proyecto";
    const sufijo = modo === "levantamiento" ? "-levantamiento-detallado"
      : modo === "levantamiento-resumido" ? "-levantamiento-resumido"
      : modo === "resumen" ? "-resumen" : "-reporte-completo";
    const etiqueta = modo === "levantamiento" ? "Levantamiento detallado"
      : modo === "levantamiento-resumido" ? "Levantamiento resumido"
      : modo === "resumen" ? "Resumen" : "Informe completo";
    compartirODescargarPDF(doc, `${nombre}${sufijo}.pdf`, {
      titulo: `${etiqueta} — ${PROJECT_INFO.nombre || "proyecto"}`,
      texto: `${etiqueta} de sello cortafuego para ${PROJECT_INFO.nombre || "el proyecto"}.`,
    });
  } catch (err) {
    mostrarToast("No se pudo generar el PDF: " + err.message, "error");
  }
}

// ============================================================================

// --- Exports usados por otros módulos ---
window.dibujarLetterheadPDF = dibujarLetterheadPDF;
window.dibujarNumeroPaginaPDF = dibujarNumeroPaginaPDF;
window.construirReportePDF = construirReportePDF;
window.descargarPDF = descargarPDF;
window.compartirODescargarPDF = compartirODescargarPDF;
})();
