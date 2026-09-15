// El DeCA: documento electrónico de control administrativo, obligatorio desde
// el 5 de octubre de 2026 antes de iniciar un transporte público de
// mercancías. Contenido según el artículo 6 de la Orden FOM/2861/2012.
//
// EL ORDEN IMPORTA. La norma exige que el PDF lleve dentro un QR que apunte a
// la URL pública del propio PDF, y esa URL no existe hasta que se sube al
// bucket. Así que primero se decide el identificador y la ruta, con eso se
// construye la URL, con la URL se genera el QR, y solo entonces se monta el
// documento con el QR ya dentro. Quien lo sube tiene que hacerlo EXACTAMENTE
// en pdfPath, o el QR apuntará a un fichero que no existe.
//
// jsPDF y qrcode se cargan con import() al generar, no en el arranque: pesan
// y solo hacen falta cuando alguien emite un DeCA.
//
// La cabecera con logo y la paginación están copiadas de albaranes/pdf.js a
// propósito: unificarlas en un módulo común queda para después del 5 de
// octubre.

export const BUCKET_DECA = "deca-docs";

const TITULO = "DOCUMENTO ELECTRÓNICO DE CONTROL ADMINISTRATIVO (DeCA)";
const LEYENDA_QR = "Documento verificable en línea";

const formatFecha = (f) =>
  f ? new Date(f).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

const formatFechaHora = (f) =>
  f ? new Date(f).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const texto = (v) => (v === null || v === undefined ? "" : String(v).trim());
const kg = (p) => (texto(p) ? `${Number(p).toLocaleString("es-ES")} kg` : "—");

// La copia congelada de todo lo que sale en el papel. Se guarda en la tabla
// tal cual: si mañana cambian el NIF de config o la dirección del cliente, el
// DeCA de hace tres meses tiene que seguir diciendo lo que decía al emitirlo.
// Sin notas_internas: son de maniobra y no salen de la empresa.
const congelarDatos = (servicio, cliente, config, { id, url, emitidoEn }) => ({
  id,
  url,
  emitido_en: emitidoEn,
  transportista: {
    nombre: texto(config.nombre),
    nif: texto(config.nif),
    direccion: texto(config.direccion),
    autorizacion_transporte: texto(config.autorizacion_transporte),
  },
  cargador: {
    nombre: texto(cliente?.nombre || servicio.cliente),
    nifCif: texto(cliente?.nifCif || servicio.nifCif),
    dirFact: texto(cliente?.dirFact || servicio.dirFact),
  },
  servicio: {
    id: servicio.id ?? null,
    numero: texto(servicio.numero),
    fecha_servicio: texto(servicio.fecha_servicio),
    origen: texto(servicio.origen),
    destino: texto(servicio.destino),
    naturaleza_mercancia: texto(servicio.naturaleza_mercancia),
    peso: texto(servicio.peso) ? Number(servicio.peso) : null,
    bultos: texto(servicio.bultos) ? Number(servicio.bultos) : null,
    matricula_tractora: texto(servicio.matricula_tractora),
    matricula_remolque: texto(servicio.matricula_remolque),
    autorizacion_especial: texto(servicio.autorizacion_especial),
    observaciones: texto(servicio.descripcion),
  },
});

const buildDecaDoc = (jsPDF, datos, qrDataUrl, config) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, margin = 18;
  const anchoUtil = W - margin * 2;
  let y = 0;

  // --- Copiado de albaranes/pdf.js: pie y salto de página
  const footer = () => {
    doc.setFillColor(20, 20, 20); doc.rect(0, 282, W, 15, "F");
    doc.setTextColor(150, 150, 150); doc.setFontSize(7); doc.setFont("helvetica", "normal");
    doc.text([config.nombre, config.tel, config.email, config.direccion].filter(Boolean).join("  ·  "), W / 2, 291, { align: "center" });
  };

  const checkPage = (needed) => {
    if (y + needed > 275) {
      footer();
      doc.addPage();
      y = 20;
    }
  };

  // --- Copiado de albaranes/pdf.js: cabecera de empresa con logo
  doc.setFillColor(20, 20, 20);
  doc.rect(0, 0, W, 42, "F");
  if (config.logo) {
    try {
      const fmt = config.logo.startsWith("data:image/png") ? "PNG" : "JPEG";
      doc.addImage(config.logo, fmt, margin, 8, 28, 28);
    } catch (e) {
      console.error("No se ha podido pintar el logo en el PDF:", e);
    }
    doc.setTextColor(255, 255, 255); doc.setFontSize(16); doc.setFont("helvetica", "bold");
    doc.text(config.nombre || "Mi Empresa", margin + 34, 22);
    doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(180, 180, 180);
    doc.text([config.tel, config.email, config.direccion].filter(Boolean).join("  ·  "), margin + 34, 29);
  } else {
    doc.setTextColor(255, 255, 255); doc.setFontSize(18); doc.setFont("helvetica", "bold");
    doc.text(config.nombre || "Mi Empresa", margin, 22);
    doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(180, 180, 180);
    doc.text([config.tel, config.email, config.direccion].filter(Boolean).join("  ·  "), margin, 30);
  }

  // --- Título, identificador y fecha de emisión
  y = 54;
  doc.setTextColor(20, 20, 20); doc.setFontSize(13); doc.setFont("helvetica", "bold");
  const tituloLineas = doc.splitTextToSize(TITULO, anchoUtil);
  doc.text(tituloLineas, margin, y);
  y += tituloLineas.length * 6 + 2;
  // El número correlativo (DECA-XXX) lo asigna la base de datos al registrar
  // el documento, después de generar este PDF. Lo que identifica al DeCA de
  // forma única, y lo que hace verificable el QR, es este identificador.
  doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 100, 100);
  doc.text(`Nº DeCA (identificador): ${datos.id}`, margin, y);
  y += 5;
  doc.text(`Fecha de emisión: ${formatFechaHora(datos.emitido_en)}`, margin, y);
  y += 6;

  doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.5);
  doc.line(margin, y, W - margin, y);
  y += 8;

  // Cajas grises con título y líneas, como la del cliente en el albarán,
  // una al lado de la otra y de la misma altura
  const cajas = (lista) => {
    const hueco = 6;
    const w = (anchoUtil - hueco * (lista.length - 1)) / lista.length;
    const filas = lista.map(([, lineas]) => lineas.filter(Boolean));
    const alto = 8 + Math.max(...filas.map((f) => f.length)) * 5;
    checkPage(alto + 6);
    lista.forEach(([titulo], i) => {
      const x = margin + i * (w + hueco);
      doc.setFillColor(245, 245, 245);
      doc.roundedRect(x, y, w, alto, 2, 2, "F");
      doc.setTextColor(100, 100, 100); doc.setFontSize(7); doc.setFont("helvetica", "bold");
      doc.text(titulo, x + 4, y + 6);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(20, 20, 20);
      filas[i].forEach((l, j) => doc.text(doc.splitTextToSize(l, w - 8)[0], x + 4, y + 12 + j * 5));
    });
    y += alto + 6;
  };

  // Título subrayado + parejas etiqueta/valor en columnas
  const seccion = (titulo) => {
    checkPage(14);
    doc.setTextColor(100, 100, 100); doc.setFontSize(7); doc.setFont("helvetica", "bold");
    doc.text(titulo, margin, y);
    y += 4;
    doc.setDrawColor(20, 20, 20); doc.setLineWidth(1);
    doc.line(margin, y, margin + 40, y); doc.setLineWidth(0.5);
    y += 6;
  };

  // Un valor largo (la naturaleza de la mercancía, una dirección) puede
  // ocupar hasta dos líneas; la fila crece con el más largo
  const parejas = (pares, columnas = 2) => {
    const colW = anchoUtil / columnas;
    for (let i = 0; i < pares.length; i += columnas) {
      doc.setFontSize(10); doc.setFont("helvetica", "normal");
      const fila = pares.slice(i, i + columnas).map(([etiq, valor]) => [etiq, doc.splitTextToSize(valor || "—", colW - 6).slice(0, 2)]);
      const lineas = Math.max(...fila.map(([, v]) => v.length));
      const alto = 5 + lineas * 4.5 + 1.5;
      checkPage(alto);
      fila.forEach(([etiq, valor], j) => {
        const x = margin + j * colW;
        doc.setTextColor(100, 100, 100); doc.setFontSize(7); doc.setFont("helvetica", "bold");
        doc.text(etiq.toUpperCase(), x, y);
        doc.setTextColor(20, 20, 20); doc.setFontSize(10); doc.setFont("helvetica", "normal");
        doc.text(valor, x, y + 5);
      });
      y += alto;
    }
    y += 2;
  };

  const { transportista: t, cargador: c, servicio: s } = datos;

  cajas([
    ["TRANSPORTISTA EFECTIVO", [
      t.nombre,
      t.nif && `NIF: ${t.nif}`,
      t.direccion,
      t.autorizacion_transporte && `Autorización de transporte: ${t.autorizacion_transporte}`,
    ]],
    ["CARGADOR CONTRACTUAL", [
      c.nombre,
      c.nifCif && `NIF: ${c.nifCif}`,
      c.dirFact,
    ]],
  ]);

  seccion("TRANSPORTE");
  parejas([
    ["Origen", s.origen],
    ["Destino", s.destino],
    ["Fecha del transporte", formatFecha(s.fecha_servicio)],
    ["Servicio", s.numero],
  ]);

  seccion("MERCANCÍA");
  parejas([
    ["Naturaleza de la mercancía", s.naturaleza_mercancia],
    ["Peso", kg(s.peso)],
    ["Bultos", s.bultos === null ? "—" : String(s.bultos)],
  ], 3);

  seccion("VEHÍCULO");
  parejas([
    ["Matrícula tractora", s.matricula_tractora],
    ["Matrícula remolque", s.matricula_remolque],
    ["Autorización especial de circulación", s.autorizacion_especial || "No requiere"],
  ], 3);

  // Observaciones: la descripción del servicio, nunca las notas internas
  seccion("OBSERVACIONES");
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(30, 30, 30);
  const obsLines = doc.splitTextToSize(s.observaciones || "—", anchoUtil);
  checkPage(obsLines.length * 5.5 + 4);
  doc.text(obsLines, margin, y);
  y += obsLines.length * 5.5 + 8;

  // --- QR bien visible, con la leyenda y la URL en texto por si no se
  // puede escanear
  const QR = 36;
  checkPage(QR + 12);
  doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.5);
  doc.roundedRect(margin, y, anchoUtil, QR + 10, 2, 2, "S");
  doc.addImage(qrDataUrl, "PNG", margin + 5, y + 5, QR, QR);
  const xTexto = margin + 5 + QR + 8;
  const anchoTexto = anchoUtil - (xTexto - margin) - 5;
  doc.setTextColor(20, 20, 20); doc.setFontSize(11); doc.setFont("helvetica", "bold");
  doc.text(LEYENDA_QR, xTexto, y + 14);
  doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(80, 80, 80);
  doc.text(doc.splitTextToSize("Escanee el código o abra el enlace para descargar este mismo documento.", anchoTexto), xTexto, y + 21);
  doc.setFontSize(7); doc.setTextColor(100, 100, 100);
  doc.text(doc.splitTextToSize(datos.url, anchoTexto), xTexto, y + 31);
  y += QR + 10;

  footer();
  return doc;
};

// Devuelve { id, pdfPath, url, datos, blob }. Quien lo llame sube blob a
// BUCKET_DECA en pdfPath (exactamente) y guarda id, pdfPath, url y datos en
// la tabla deca.
export const generarPdfDeca = async (servicio, cliente, config = {}) => {
  // 1. Identificador único, decidido aquí y no por la base de datos
  const id = crypto.randomUUID();

  // 2. Ruta en el bucket y URL pública que tendrá el PDF una vez subido
  const pdfPath = `${id}.pdf`;
  const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/${BUCKET_DECA}/${pdfPath}`;

  // 3. El QR apunta a esa URL, la del propio documento
  const [{ jsPDF }, qrcode] = await Promise.all([import("jspdf"), import("qrcode")]);
  const QRCode = qrcode.default || qrcode;
  const qrDataUrl = await QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 1, width: 512 });

  // 4. El documento, con el QR ya dentro
  const emitidoEn = new Date().toISOString();
  const datos = congelarDatos(servicio, cliente, config, { id, url, emitidoEn });
  const doc = buildDecaDoc(jsPDF, datos, qrDataUrl, config);

  // 5. Listo para subir
  return { id, pdfPath, url, datos, blob: doc.output("blob") };
};
