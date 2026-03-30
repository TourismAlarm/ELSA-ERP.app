import { jsPDF } from "jspdf";

export const generatePDF = (s, config) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, margin = 18;
  let y = 0;

  doc.setFillColor(20, 20, 20);
  doc.rect(0, 0, W, 42, "F");

  if (config.logo) {
    try {
      const fmt = config.logo.startsWith("data:image/png") ? "PNG" : "JPEG";
      doc.addImage(config.logo, fmt, margin, 8, 28, 28);
    } catch {}
    doc.setTextColor(255,255,255); doc.setFontSize(16); doc.setFont("helvetica","bold");
    doc.text(config.nombre || "Mi Empresa", margin + 34, 22);
    doc.setFontSize(8); doc.setFont("helvetica","normal"); doc.setTextColor(180,180,180);
    doc.text([config.tel, config.email, config.direccion].filter(Boolean).join("  ·  "), margin + 34, 29);
  } else {
    doc.setTextColor(255,255,255); doc.setFontSize(18); doc.setFont("helvetica","bold");
    doc.text(config.nombre || "Mi Empresa", margin, 22);
    doc.setFontSize(8); doc.setFont("helvetica","normal"); doc.setTextColor(180,180,180);
    doc.text([config.tel, config.email, config.direccion].filter(Boolean).join("  ·  "), margin, 30);
  }

  y = 54;
  doc.setTextColor(20,20,20); doc.setFontSize(22); doc.setFont("helvetica","bold");
  doc.text("SOLICITUD DE SERVICIO", margin, y);
  doc.setFontSize(10); doc.setFont("helvetica","normal"); doc.setTextColor(100,100,100);
  doc.text(`Nº ${s.numero}`, W - margin, y - 6, { align: "right" });
  doc.text(`Fecha: ${s.fecha}`, W - margin, y + 1, { align: "right" });
  y += 10;

  doc.setDrawColor(220,220,220); doc.setLineWidth(0.5);
  doc.line(margin, y, W - margin, y);
  y += 10;

  const clienteH = s.telCliente ? 32 : 26;
  doc.setFillColor(245,245,245);
  doc.roundedRect(margin, y, W - margin * 2, clienteH, 2, 2, "F");
  doc.setTextColor(100,100,100); doc.setFontSize(7); doc.setFont("helvetica","bold");
  doc.text("DATOS DEL CLIENTE", margin + 5, y + 7);
  doc.setFont("helvetica","normal"); doc.setFontSize(11); doc.setTextColor(20,20,20);
  doc.text(s.cliente || "—", margin + 5, y + 15);
  if (s.telCliente) { doc.setFontSize(9); doc.setTextColor(80,80,80); doc.text(`Tel: ${s.telCliente}`, margin + 5, y + 22); }
  y += clienteH + 10;

  if (s.origen || s.destino) {
    const colW = (W - margin * 2 - 6) / 2;
    if (s.origen) {
      doc.setFillColor(245,245,245); doc.roundedRect(margin, y, colW, 22, 2, 2, "F");
      doc.setTextColor(100,100,100); doc.setFontSize(7); doc.setFont("helvetica","bold");
      doc.text("ORIGEN (A)", margin + 5, y + 7);
      doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(20,20,20);
      doc.text(doc.splitTextToSize(s.origen, colW - 10)[0] || "", margin + 5, y + 15);
    }
    if (s.destino) {
      const x2 = margin + colW + 6;
      doc.setFillColor(245,245,245); doc.roundedRect(x2, y, colW, 22, 2, 2, "F");
      doc.setTextColor(100,100,100); doc.setFontSize(7); doc.setFont("helvetica","bold");
      doc.text("DESTINO (B)", x2 + 5, y + 7);
      doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(20,20,20);
      doc.text(doc.splitTextToSize(s.destino, colW - 10)[0] || "", x2 + 5, y + 15);
    }
    y += 30;
  } else if (s.direccion) {
    doc.setFillColor(245,245,245); doc.roundedRect(margin, y, W - margin * 2, 22, 2, 2, "F");
    doc.setTextColor(100,100,100); doc.setFontSize(7); doc.setFont("helvetica","bold");
    doc.text("DIRECCIÓN DEL SERVICIO", margin + 5, y + 7);
    doc.setFont("helvetica","normal"); doc.setFontSize(10); doc.setTextColor(20,20,20);
    doc.text(s.direccion, margin + 5, y + 15);
    y += 30;
  }

  const badges = [s.vehiculo, (s.tipoTrabajo || s.tipo) ? (s.tipoTrabajo || s.tipo).toUpperCase() : null].filter(Boolean);
  if (badges.length) {
    let bx = margin;
    badges.forEach((badge) => {
      const bw = Math.max(40, Math.min(80, badge.length * 2.4 + 16));
      doc.setFillColor(20,20,20); doc.roundedRect(bx, y, bw, 14, 2, 2, "F");
      doc.setTextColor(255,255,255); doc.setFontSize(8); doc.setFont("helvetica","bold");
      doc.text(badge, bx + bw / 2, y + 9, { align: "center" });
      bx += bw + 6;
    });
    y += 22;
  }

  const cargaItems = [
    s.metros ? `Metros de descarga: ${s.metros} m` : null,
    s.peso   ? `Peso: ${s.peso} kg` : null,
    s.bultos ? `Nº de bultos: ${s.bultos}` : null,
  ].filter(Boolean);
  if (cargaItems.length) {
    const boxH = 14 + cargaItems.length * 7;
    doc.setFillColor(245,245,245); doc.roundedRect(margin, y, W - margin * 2, boxH, 2, 2, "F");
    doc.setTextColor(100,100,100); doc.setFontSize(7); doc.setFont("helvetica","bold");
    doc.text("DATOS DE CARGA", margin + 5, y + 7);
    doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(20,20,20);
    cargaItems.forEach((item, i) => doc.text(item, margin + 5, y + 14 + i * 7));
    y += boxH + 8;
  }

  doc.setTextColor(100,100,100); doc.setFontSize(7); doc.setFont("helvetica","bold");
  doc.text("DESCRIPCIÓN DEL SERVICIO", margin, y);
  y += 5;
  doc.setDrawColor(20,20,20); doc.setLineWidth(1);
  doc.line(margin, y, margin + 40, y); doc.setLineWidth(0.5);
  y += 8;
  doc.setFont("helvetica","normal"); doc.setFontSize(10); doc.setTextColor(30,30,30);
  const descLines = doc.splitTextToSize(s.descripcion || "—", W - margin * 2);
  doc.text(descLines, margin, y);
  y += descLines.length * 6 + 10;

  if (s.precio) {
    doc.setFillColor(20,20,20); doc.roundedRect(W - margin - 70, y, 70, 26, 2, 2, "F");
    doc.setTextColor(150,150,150); doc.setFontSize(7); doc.setFont("helvetica","bold");
    doc.text("PRECIO ESTIMADO", W - margin - 35, y + 8, { align: "center" });
    doc.setTextColor(255,255,255); doc.setFontSize(16);
    doc.text(`${Number(s.precio).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €`, W - margin - 35, y + 19, { align: "center" });
    y += 36;
  }

  doc.setFillColor(20,20,20); doc.rect(0, 282, W, 15, "F");
  doc.setTextColor(150,150,150); doc.setFontSize(7); doc.setFont("helvetica","normal");
  doc.text([config.nombre, config.tel, config.email, config.direccion].filter(Boolean).join("  ·  "), W / 2, 291, { align: "center" });

  doc.save(`Solicitud_${s.numero}.pdf`);
};
