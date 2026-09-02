import { jsPDF } from "jspdf";
import { textoDe, lineasObservaciones } from "./textos";

// El presupuesto que se envía al cliente. Copia el formato del que la empresa
// venía mandando a mano, para que el de la aplicación no desentone: mismo
// encabezado, misma tabla de documento, mismos bloques de IMPORT, FORMA DE
// PAGAMENT y OBSERVACIONS, y los mismos textos fijos del pie.

const W = 210, H = 297;
const MARGEN = 16;          // margen exterior de la hoja
const CAJA_X = 30;          // el cuerpo va metido hacia dentro, como el original
const CAJA_DER = W - MARGEN;
const TEXTO_X = CAJA_X + 4;
const ANCHO_TEXTO = CAJA_DER - TEXTO_X - 4;

// Alto reservado al pie fijo (conformidad, firmas y aviso legal)
const PIE = 62;

const NEGRO = [20, 20, 20];
const GRIS = [110, 110, 110];
const LINEA = [190, 190, 190];

// useGrouping "always": en es-ES los números de cuatro cifras no llevan punto
// por defecto y el presupuesto de siempre pone "2.778 €"
const eur = (n) =>
  `${Number(n).toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2, useGrouping: "always" })} €`;

// dd/mm/aaaa a partir de un "2026-06-17"; si no lo parece, se deja tal cual
const fechaES = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || "");
};

// La dirección de una sola línea se parte por la última coma, que es donde
// suele estar el código postal: "C/ Josep Castella 10, 08301 Mataró"
const partirDireccion = (dir) => {
  const t = (dir || "").trim();
  if (!t) return [];
  const i = t.lastIndexOf(",");
  return i > 0 ? [t.slice(0, i).trim(), t.slice(i + 1).trim()] : [t];
};

const generatePDF = (s, config = {}) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pagina = { n: 1 };

  const fuente = (estilo, tam, color = NEGRO) => {
    doc.setFont("helvetica", estilo);
    doc.setFontSize(tam);
    doc.setTextColor(...color);
  };

  // ---------------------------------------------------------------- cabecera
  const cabecera = () => {
    if (config.logo) {
      try {
        const fmt = config.logo.startsWith("data:image/png") ? "PNG" : "JPEG";
        // El logo va arriba a la derecha, donde el original no pone nada
        doc.addImage(config.logo, fmt, CAJA_DER - 32, 11, 32, 22, undefined, "FAST");
      } catch (e) {
        console.error("No se ha podido pintar el logo en el PDF:", e);
      }
    }

    fuente("bold", 11);
    doc.text(config.nombre || "", MARGEN, 17);
    fuente("normal", 9.5, [60, 60, 60]);
    partirDireccion(config.direccion).forEach((linea, i) => doc.text(linea, MARGEN, 23 + i * 5));

    // Bloque de contratación: teléfonos a la izquierda, email y web a la derecha
    fuente("bold", 8.5);
    doc.text("CONTRACTACIO:", MARGEN, 37);
    const tel = textoDe(config, "contractacion");
    if (tel) doc.text(tel, MARGEN, 42);

    const xEtiq = 118, xValor = 134;
    if (config.email) {
      fuente("bold", 8.5); doc.text("E-mail:", xEtiq, 42);
      fuente("normal", 8.5); doc.text(config.email, xValor, 42);
    }
    const web = textoDe(config, "web");
    if (web) {
      fuente("bold", 8.5); doc.text("Web:", xEtiq, 47);
      doc.text(web, xValor, 47);
    }

    // ------------------------------------------------------------- cliente
    const datos = [s.nifCif, s.dirFact, s.telCliente].filter(Boolean);
    fuente("bold", 10);
    // En el documento va siempre el nombre fiscal, nunca el comercial. Un
    // nombre largo se parte en dos líneas antes que quedarse a medias.
    const nombre = doc.splitTextToSize(s.cliente || "—", 84).slice(0, 2);
    const alto = 7 + nombre.length * 5 + datos.length * 5;
    doc.setDrawColor(...LINEA); doc.setLineWidth(0.3);
    doc.rect(MARGEN, 54, 92, alto);
    doc.text(nombre, MARGEN + 4, 60.5);
    fuente("normal", 8, GRIS);
    datos.forEach((d, i) =>
      doc.text(doc.splitTextToSize(d, 84)[0], MARGEN + 4, 60.5 + nombre.length * 5 + i * 5));

    // --------------------------------------------- tabla del documento
    const cols = [
      { etiq: "DOCUMENTO", valor: "PRESUPUESTO", x: 115, w: 30 },
      { etiq: "NÚMERO",    valor: s.numero || "—", x: 145, w: 20 },
      { etiq: "PÁGINA",    valor: String(pagina.n), x: 165, w: 10 },
      // La fecha necesita su hueco: con menos se parte en dos líneas
      { etiq: "FECHA",     valor: fechaES(s.fecha), x: 175, w: 19 },
    ];
    const yTabla = 76;
    doc.setFillColor(240, 240, 240);
    doc.rect(115, yTabla, CAJA_DER - 115, 7, "F");
    doc.setDrawColor(...LINEA);
    doc.rect(115, yTabla, CAJA_DER - 115, 14);
    cols.forEach((c, i) => {
      if (i) doc.line(c.x, yTabla, c.x, yTabla + 14);
      fuente("bold", 7);
      doc.text(c.etiq, c.x + c.w / 2, yTabla + 4.8, { align: "center" });
      fuente("bold", 8);
      doc.text(c.valor, c.x + c.w / 2, yTabla + 11.5, { align: "center", maxWidth: c.w - 2 });
    });
    doc.line(115, yTabla + 7, CAJA_DER, yTabla + 7);

    return yTabla + 14 + 12;
  };

  // ------------------------------------------------------------------- pie
  // El aviso legal va en todas las hojas; las firmas solo en la última, que
  // firmar la primera de cuatro no querría decir nada
  const pieDePagina = (ultima) => {
    if (ultima) {
      let y = H - PIE + 10;

      fuente("bold", 8, [40, 40, 40]);
      const conf = doc.splitTextToSize(textoDe(config, "conformidad"), ANCHO_TEXTO);
      doc.text(conf, TEXTO_X, y);
      y += conf.length * 4 + 8;

      // Las dos firmas, cada una con su raya
      fuente("bold", 8);
      doc.text(config.nombre || "", TEXTO_X, y);
      doc.text("CONFORME CLIENTE", TEXTO_X + 82, y);
      doc.setDrawColor(...LINEA); doc.setLineWidth(0.3);
      doc.line(TEXTO_X, y + 14, TEXTO_X + 70, y + 14);
      doc.line(TEXTO_X + 82, y + 14, TEXTO_X + 152, y + 14);
    }

    // Aviso legal, pegado al borde y en cuerpo pequeño, como en el original
    fuente("normal", 5.6, [120, 120, 120]);
    const legal = doc.splitTextToSize(textoDe(config, "legal"), W - 10);
    doc.text(legal, 5, H - 12);
  };

  // Cada bloque comprueba que cabe; si no, abre una hoja nueva con su
  // encabezado, en vez de escribir encima del pie
  const cabe = (alto, y) => {
    if (y + alto <= H - PIE) return y;
    pieDePagina(false);
    doc.addPage();
    pagina.n += 1;
    return cabecera();
  };

  const titulo = (texto, y) => {
    const ny = cabe(12, y);
    fuente("bold", 8.5);
    doc.text(texto, TEXTO_X, ny);
    return ny + 6;
  };

  const parrafo = (texto, y, estilo = "bold") => {
    fuente(estilo, 8.5);
    const lineas = doc.splitTextToSize(texto, ANCHO_TEXTO);
    let ny = y;
    lineas.forEach((linea) => {
      ny = cabe(5, ny);
      fuente(estilo, 8.5);
      doc.text(linea, TEXTO_X, ny);
      ny += 4.5;
    });
    return ny;
  };

  // ----------------------------------------------------------------- cuerpo
  let y = cabecera();

  y = titulo("DESCRIPCIÓ DEL SERVEI", y);
  y = parrafo(s.descripcion?.trim() || "—", y);

  // Lo que en el presupuesto de siempre se escribía a mano dentro de la
  // descripción, aquí ya está en campos aparte: se añade debajo si lo hay
  const extras = [
    s.origen && `Origen: ${s.origen}`,
    s.destino && `Destí: ${s.destino}`,
    !s.origen && !s.destino && s.direccion && `Adreça: ${s.direccion}`,
    s.metros && `Metres de descàrrega: ${s.metros} m`,
    s.peso && `Pes: ${s.peso} kg`,
    s.bultos && `Bultos: ${s.bultos}`,
  ].filter(Boolean);
  const equipos = (Array.isArray(s.vehiculo) ? s.vehiculo : [s.vehiculo]).filter(Boolean);
  if (equipos.length) extras.push(`Equip: ${equipos.join(", ")}`);
  if (extras.length) {
    y += 2;
    extras.forEach((e) => { y = parrafo(e, y, "normal"); });
  }

  y += 6;
  if (s.precio !== "" && s.precio !== null && s.precio !== undefined && !Number.isNaN(Number(s.precio))) {
    y = cabe(10, y);
    fuente("bold", 9);
    doc.text(`IMPORT   . . . . . . . . . . . . . . . .    ${eur(s.precio)}`, TEXTO_X, y);
    y += 10;
  }

  const formaPago = (s.formaPago || "").trim() || textoDe(config, "formaPago");
  if (formaPago) {
    y = cabe(8, y);
    fuente("bold", 8.5);
    doc.text(`FORMA DE PAGAMENT:   ${formaPago}`, TEXTO_X, y);
    y += 12;
  }

  const observaciones = lineasObservaciones(
    (s.observaciones || "").trim() || textoDe(config, "observaciones")
  );
  if (observaciones.length) {
    y = titulo("OBSERVACIONS", y);
    observaciones.forEach((linea) => { y = parrafo(linea, y); });
  }

  pieDePagina(true);
  doc.save(`Presupuesto_${s.numero || "sin_numero"}.pdf`);
};

export { generatePDF };
export default generatePDF;
