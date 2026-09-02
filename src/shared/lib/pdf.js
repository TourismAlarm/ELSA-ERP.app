import { jsPDF } from "jspdf";
import { textoDe, lineasObservaciones } from "./textos";

// Los documentos que se envían al cliente: el presupuesto y la hoja del
// servicio. Los dos copian el formato del presupuesto que la empresa venía
// mandando a mano, para que no desentonen: mismo encabezado, misma tabla de
// documento, mismos bloques y los mismos textos fijos del pie. Solo cambia lo
// de en medio, así que la plantilla es una sola y cada documento pone su
// contenido.

const W = 210, H = 297;
const MARGEN = 16;          // margen exterior de la hoja
const CAJA_X = 30;          // el cuerpo va metido hacia dentro, como el original
const CAJA_DER = W - MARGEN;
const TEXTO_X = CAJA_X + 4;
const ANCHO_TEXTO = CAJA_DER - TEXTO_X - 4;

// Hueco del logo arriba a la derecha, donde el original no pone nada. El logo
// se mete dentro respetando su proporción, así que uno apaisado usa todo el
// ancho y uno cuadrado se queda en 30x30.
const LOGO = { x: CAJA_DER - 54, y: 8, ancho: 54, alto: 30 };

const NEGRO = [20, 20, 20];
const GRIS = [110, 110, 110];
const LINEA = [190, 190, 190];

// useGrouping "always": en es-ES los números de cuatro cifras no llevan punto
// por defecto y el presupuesto de siempre pone "2.778 €"
export const eur = (n) =>
  `${Number(n).toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2, useGrouping: "always" })} €`;

// dd/mm/aaaa a partir de un "2026-06-17"; si no lo parece, se deja tal cual
const fechaES = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || "");
};

const hhmm = (h) => (h ? String(h).slice(0, 5) : "");

// La dirección de una sola línea se parte por la última coma, que es donde
// suele estar el código postal: "C/ Josep Castella 10, 08301 Mataró"
const partirDireccion = (dir) => {
  const t = (dir || "").trim();
  if (!t) return [];
  const i = t.lastIndexOf(",");
  return i > 0 ? [t.slice(0, i).trim(), t.slice(i + 1).trim()] : [t];
};

const vehiculosDe = (d) => {
  const arr = Array.isArray(d.vehiculo) ? d.vehiculo : (d.vehiculo ? [d.vehiculo] : []);
  return arr.filter(Boolean);
};

// El logo, lo más grande que quepa en su hueco sin deformarse
const pintarLogo = (doc, logo) => {
  if (!logo) return;
  try {
    const fmt = logo.startsWith("data:image/png") ? "PNG" : "JPEG";
    let { ancho, alto } = LOGO;
    // Si no se puede leer el tamaño real se usa el hueco entero, que es lo que
    // se hacía antes: peor un logo algo estirado que ningún logo
    try {
      const props = doc.getImageProperties(logo);
      if (props?.width && props?.height) {
        const escala = Math.min(LOGO.ancho / props.width, LOGO.alto / props.height);
        ancho = props.width * escala;
        alto = props.height * escala;
      }
    } catch { /* sin propiedades: se usa el hueco entero */ }
    // Pegado a la derecha y centrado en vertical dentro del hueco
    doc.addImage(logo, fmt, LOGO.x + (LOGO.ancho - ancho), LOGO.y + (LOGO.alto - alto) / 2, ancho, alto, undefined, "FAST");
  } catch (e) {
    console.error("No se ha podido pintar el logo en el PDF:", e);
  }
};

// Construye el documento: encabezado, pie y las ayudas para ir escribiendo el
// cuerpo sin pisar el pie ni salirse de la hoja.
const plantilla = ({ doc, config, documento, numero, fecha, cliente, conFirmas }) => {
  const pagina = { n: 1 };
  // Alto reservado al pie: con firmas hace falta bastante más sitio
  const PIE = conFirmas ? 62 : 24;

  const fuente = (estilo, tam, color = NEGRO) => {
    doc.setFont("helvetica", estilo);
    doc.setFontSize(tam);
    doc.setTextColor(...color);
  };

  const cabecera = () => {
    pintarLogo(doc, config.logo);

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

    // Ficha del cliente
    const datos = [cliente.nifCif, cliente.dirFact, cliente.tel].filter(Boolean);
    fuente("bold", 10);
    // En el documento va siempre el nombre fiscal, nunca el comercial. Un
    // nombre largo se parte en dos líneas antes que quedarse a medias.
    const nombre = doc.splitTextToSize(cliente.nombre || "—", 84).slice(0, 2);
    const alto = 7 + nombre.length * 5 + datos.length * 5;
    doc.setDrawColor(...LINEA); doc.setLineWidth(0.3);
    doc.rect(MARGEN, 54, 92, alto);
    doc.text(nombre, MARGEN + 4, 60.5);
    fuente("normal", 8, GRIS);
    datos.forEach((d, i) =>
      doc.text(doc.splitTextToSize(d, 84)[0], MARGEN + 4, 60.5 + nombre.length * 5 + i * 5));

    // Tabla del documento
    const cols = [
      { etiq: "DOCUMENTO", valor: documento, x: 115, w: 30 },
      { etiq: "NÚMERO",    valor: numero || "—", x: 145, w: 20 },
      { etiq: "PÁGINA",    valor: String(pagina.n), x: 165, w: 10 },
      // La fecha necesita su hueco: con menos se parte en dos líneas
      { etiq: "FECHA",     valor: fechaES(fecha), x: 175, w: 19 },
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

  // El aviso legal va en todas las hojas; las firmas solo en la última, que
  // firmar la primera de cuatro no querría decir nada
  const pieDePagina = (ultima) => {
    if (conFirmas && ultima) {
      let y = H - PIE + 10;

      fuente("bold", 8, [40, 40, 40]);
      const conf = doc.splitTextToSize(textoDe(config, "conformidad"), ANCHO_TEXTO);
      doc.text(conf, TEXTO_X, y);
      y += conf.length * 4 + 8;

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

  const linea = (texto, y, tam = 8.5) => {
    const ny = cabe(8, y);
    fuente("bold", tam);
    doc.text(texto, TEXTO_X, ny);
    return ny + 8;
  };

  return { fuente, cabecera, pieDePagina, cabe, titulo, parrafo, linea };
};

// Lo que en el presupuesto de siempre se escribía a mano dentro de la
// descripción, aquí ya está en campos aparte: se añade debajo si lo hay
const extrasDe = (d) => {
  const extras = [
    d.origen && `Origen: ${d.origen}`,
    d.destino && `Destí: ${d.destino}`,
    !d.origen && !d.destino && d.direccion && `Adreça: ${d.direccion}`,
    d.metros && `Metres de descàrrega: ${d.metros} m`,
    d.peso && `Pes: ${d.peso} kg`,
    d.bultos && `Bultos: ${d.bultos}`,
  ].filter(Boolean);
  const equipos = vehiculosDe(d);
  if (equipos.length) extras.push(`Equip: ${equipos.join(", ")}`);
  return extras;
};

// La única observación que sigue valiendo en una hoja de trabajo
const IVA_APARTE = "*A aquest import s'incrementarà l'IVA corresponent.";

const tienePrecio = (p) => p !== "" && p !== null && p !== undefined && !Number.isNaN(Number(p));

// --------------------------------------------------------------- presupuesto
export const generatePDF = (s, config = {}) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const t = plantilla({
    doc, config,
    documento: "PRESUPUESTO",
    numero: s.numero,
    fecha: s.fecha,
    cliente: { nombre: s.cliente, nifCif: s.nifCif, dirFact: s.dirFact, tel: s.telCliente },
    conFirmas: true,
  });

  let y = t.cabecera();
  y = t.titulo("DESCRIPCIÓ DEL SERVEI", y);
  y = t.parrafo(s.descripcion?.trim() || "—", y);

  const extras = extrasDe(s);
  if (extras.length) {
    y += 2;
    extras.forEach((e) => { y = t.parrafo(e, y, "normal"); });
  }

  y += 6;
  if (tienePrecio(s.precio)) {
    y = t.linea(`IMPORT   . . . . . . . . . . . . . . . .    ${eur(s.precio)}`, y, 9);
    y += 2;
  }

  const formaPago = (s.formaPago || "").trim() || textoDe(config, "formaPago");
  if (formaPago) y = t.linea(`FORMA DE PAGAMENT:   ${formaPago}`, y) + 4;

  const observaciones = lineasObservaciones(
    (s.observaciones || "").trim() || textoDe(config, "observaciones")
  );
  if (observaciones.length) {
    y = t.titulo("OBSERVACIONS", y);
    observaciones.forEach((l) => { y = t.parrafo(l, y); });
  }

  t.pieDePagina(true);
  doc.save(`Presupuesto_${s.numero || "sin_numero"}.pdf`);
};

// ------------------------------------------------------------------ servicio
// La hoja del trabajo, para mandársela al cliente: cuándo se hace, con qué
// equipo y de dónde a dónde. Sin el texto de "devuélvanos esto firmado", que
// es del presupuesto y aquí no pinta nada.
export const generateServicioPDF = (s, config = {}) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const t = plantilla({
    doc, config,
    documento: "SERVICIO",
    numero: s.numero,
    fecha: s.fecha_servicio,
    cliente: { nombre: s.cliente, nifCif: s.nifCif, dirFact: s.dirFact, tel: s.telCliente },
    conFirmas: false,
  });

  let y = t.cabecera();

  // Cuándo: lo primero que mira quien recibe la hoja
  const dia = fechaES(s.fecha_servicio);
  const ini = hhmm(s.hora_inicio), fin = hhmm(s.hora_fin);
  const horas = ini && fin ? `${ini} - ${fin}` : ini ? `a partir de les ${ini}` : "";
  if (dia || horas) {
    y = t.titulo("DIA I HORA", y);
    y = t.linea([dia, horas].filter(Boolean).join("   ·   "), y, 11);
    y += 2;
  }

  y = t.titulo("DESCRIPCIÓ DEL SERVEI", y);
  y = t.parrafo(s.descripcion?.trim() || "—", y);

  const extras = extrasDe(s);
  if (extras.length) {
    y += 2;
    extras.forEach((e) => { y = t.parrafo(e, y, "normal"); });
  }

  if (tienePrecio(s.precio)) {
    y += 6;
    y = t.linea(`IMPORT   . . . . . . . . . . . . . . . .    ${eur(s.precio)}`, y, 9);
  }

  // Las observaciones de fábrica son del presupuesto ("Pressupost orientatiu",
  // "en espera de saber les mides") y en una hoja de trabajo ya cerrada no
  // pintan nada. Si la empresa ha escrito las suyas se ponen; si no, solo la
  // del IVA, y únicamente cuando hay importe.
  const propias = lineasObservaciones((config.observaciones || "").trim());
  const observaciones = propias.length
    ? propias
    : (tienePrecio(s.precio) ? [IVA_APARTE] : []);
  if (observaciones.length) {
    y += 4;
    y = t.titulo("OBSERVACIONS", y);
    observaciones.forEach((l) => { y = t.parrafo(l, y); });
  }

  t.pieDePagina(true);
  doc.save(`Servicio_${s.numero || "sin_numero"}.pdf`);
};

export default generatePDF;
