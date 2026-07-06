import { jsPDF } from "jspdf";
import { ADMIN_EMAIL } from "../../shared/lib/constants";

const formatFecha = (f) =>
  f ? new Date(f).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

const formatFechaHora = (f) =>
  f ? new Date(f).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

const buildAlbaranDoc = (a, config) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, margin = 18;
  let y = 0;

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

  // Cabecera empresa
  doc.setFillColor(20, 20, 20);
  doc.rect(0, 0, W, 42, "F");
  if (config.logo) {
    try {
      const fmt = config.logo.startsWith("data:image/png") ? "PNG" : "JPEG";
      doc.addImage(config.logo, fmt, margin, 8, 28, 28);
    } catch {}
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

  y = 54;
  doc.setTextColor(20, 20, 20); doc.setFontSize(22); doc.setFont("helvetica", "bold");
  doc.text("ALBARÁN DE TRABAJO", margin, y);
  doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 100, 100);
  doc.text(`Nº ${a.numero}`, W - margin, y - 6, { align: "right" });
  doc.text(`Fecha: ${formatFecha(a.fecha)}`, W - margin, y + 1, { align: "right" });
  y += 10;

  doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.5);
  doc.line(margin, y, W - margin, y);
  y += 10;

  // Cliente
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(margin, y, W - margin * 2, 20, 2, 2, "F");
  doc.setTextColor(100, 100, 100); doc.setFontSize(7); doc.setFont("helvetica", "bold");
  doc.text("CLIENTE", margin + 5, y + 7);
  doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(20, 20, 20);
  doc.text(a.cliente || "—", margin + 5, y + 15);
  y += 28;

  // Descripción
  if (a.descripcion) {
    doc.setTextColor(100, 100, 100); doc.setFontSize(7); doc.setFont("helvetica", "bold");
    doc.text("DESCRIPCIÓN", margin, y);
    y += 5;
    doc.setDrawColor(20, 20, 20); doc.setLineWidth(1);
    doc.line(margin, y, margin + 40, y); doc.setLineWidth(0.5);
    y += 7;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(30, 30, 30);
    const descLines = doc.splitTextToSize(a.descripcion, W - margin * 2);
    doc.text(descLines, margin, y);
    y += descLines.length * 5.5 + 8;
  }

  // Tabla de líneas
  const lineas = (a.lineas || []).filter((l) => l && (l.concepto || l.cantidad || l.observaciones));
  if (lineas.length > 0) {
    const colConcepto = margin, colCantidad = margin + 92, colObs = margin + 118;
    const tableW = W - margin * 2;

    checkPage(20);
    doc.setFillColor(20, 20, 20);
    doc.rect(margin, y, tableW, 9, "F");
    doc.setTextColor(255, 255, 255); doc.setFontSize(7); doc.setFont("helvetica", "bold");
    doc.text("CONCEPTO", colConcepto + 3, y + 6);
    doc.text("CANTIDAD", colCantidad + 3, y + 6);
    doc.text("OBSERVACIONES", colObs + 3, y + 6);
    y += 9;

    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(30, 30, 30);
    lineas.forEach((l, i) => {
      const conceptoLines = doc.splitTextToSize(String(l.concepto || "—"), 86);
      const obsLines = doc.splitTextToSize(String(l.observaciones || ""), tableW - 118 - 6);
      const rowH = Math.max(conceptoLines.length, obsLines.length || 1) * 5 + 5;
      checkPage(rowH);
      if (i % 2 === 1) {
        doc.setFillColor(245, 245, 245);
        doc.rect(margin, y, tableW, rowH, "F");
      }
      doc.setTextColor(30, 30, 30);
      doc.text(conceptoLines, colConcepto + 3, y + 6);
      doc.text(String(l.cantidad ?? ""), colCantidad + 3, y + 6);
      if (obsLines.length) doc.text(obsLines, colObs + 3, y + 6);
      y += rowH;
    });
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, W - margin, y);
    y += 10;
  }

  // Firma
  checkPage(55);
  doc.setTextColor(100, 100, 100); doc.setFontSize(7); doc.setFont("helvetica", "bold");
  doc.text("FIRMA DEL CLIENTE", margin, y);
  y += 4;
  if (a.firma) {
    doc.setDrawColor(220, 220, 220);
    doc.roundedRect(margin, y, 80, 35, 2, 2, "S");
    try { doc.addImage(a.firma, "PNG", margin + 5, y + 2.5, 70, 30); } catch {}
    y += 41;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(30, 30, 30);
    doc.text(`Firmado por: ${a.firmado_por || "—"}`, margin, y);
    if (a.firmado_en) {
      y += 5;
      doc.setFontSize(8); doc.setTextColor(100, 100, 100);
      doc.text(formatFechaHora(a.firmado_en), margin, y);
    }
  } else {
    doc.setDrawColor(180, 180, 180);
    doc.roundedRect(margin, y, 80, 35, 2, 2, "S");
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(150, 150, 150);
    doc.text("Pendiente de firma", margin + 40, y + 19, { align: "center" });
    y += 41;
  }

  footer();
  return doc;
};

export const generateAlbaranPDF = (a, config) => {
  buildAlbaranDoc(a, config).save(`Albaran_${a.numero}.pdf`);
};

// Envía el albarán por email con el PDF adjunto usando la hoja de compartir
// del sistema (iOS/Android). Si el navegador no soporta compartir archivos,
// descarga el PDF y abre el correo para adjuntarlo a mano.
export const shareAlbaranPDF = async (a, config) => {
  const doc = buildAlbaranDoc(a, config);
  const nombreArchivo = `Albaran_${a.numero}.pdf`;
  const blob = doc.output("blob");
  const file = new File([blob], nombreArchivo, { type: "application/pdf" });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: `Albarán ${a.numero}`,
        text: `Albarán ${a.numero} – ${a.cliente || "Sin nombre"}`,
      });
      return;
    } catch (err) {
      if (err.name === "AbortError") return; // el usuario canceló la hoja de compartir
      console.error(err);
    }
  }

  doc.save(nombreArchivo);
  const body = [
    `Adjunto el albarán ${a.numero}${a.cliente ? ` de ${a.cliente}` : ""}.`,
    ``,
    `(El PDF ${nombreArchivo} se acaba de descargar — adjúntalo a este correo.)`,
  ].join("\n");
  window.open(
    `mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(`Albarán ${a.numero} – ${a.cliente || "Sin nombre"}`)}&body=${encodeURIComponent(body)}`,
    "_blank"
  );
};
