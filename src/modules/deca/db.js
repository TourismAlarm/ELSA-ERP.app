import { supabase } from "../../shared/lib/supabase";
import { BUCKET_DECA } from "../../shared/lib/constants";
import { faltanDatosDeca } from "./validar";

export { faltanDatosDeca } from "./validar";

// Emite un DeCA: genera el PDF con su QR, lo sube al bucket público y lo
// registra en la tabla. Devuelve { deca, error }: con deca la fila recién
// creada, o con error { message, faltan } cuando no se ha emitido.
//
// El orden es el que exige la norma y no se puede cambiar: el QR del PDF
// apunta a la URL del propio fichero, así que la ruta se decide antes de
// generar el documento y la subida tiene que ir EXACTAMENTE a esa ruta.
// Si la subida falla no se registra nada: un DeCA en la tabla sin PDF
// detrás sería un documento que dice ser verificable y no lo es.
export const dbEmitirDeca = async (servicio, cliente, config) => {
  const faltan = faltanDatosDeca(servicio, cliente, config);
  if (faltan.length > 0) {
    return { deca: null, error: { message: `Faltan datos obligatorios del DeCA: ${faltan.join(", ")}`, faltan } };
  }

  // El módulo del PDF (jsPDF + qrcode) solo se carga al emitir: este
  // import() es la única vía por la que se carga
  const { generarPdfDeca } = await import("./pdf");
  let generado;
  try {
    generado = await generarPdfDeca(servicio, cliente, config);
  } catch (e) {
    console.error(e);
    return { deca: null, error: { message: e.message || "No se ha podido generar el DeCA" } };
  }
  const { id, numero, pdfPath, url, datos, blob } = generado;

  const { error: errorSubida } = await supabase.storage
    .from(BUCKET_DECA)
    .upload(pdfPath, blob, { contentType: "application/pdf", upsert: true });
  if (errorSubida) {
    console.error(errorSubida);
    return { deca: null, error: { message: "No se ha podido subir el PDF del DeCA: " + errorSubida.message } };
  }

  // numero se reservó al generar el PDF y es el que va impreso: se envía tal
  // cual, y el trigger lo respeta porque solo asigna cuando llega vacío
  const { data, error } = await supabase
    .from("deca")
    .insert([{ id, numero, servicio_id: servicio.id ?? null, pdf_path: pdfPath, url, datos }])
    .select()
    .single();
  if (error) {
    console.error(error);
    // Que no quede un PDF público huérfano que nadie podrá encontrar ni anular
    await supabase.storage.from(BUCKET_DECA).remove([pdfPath]);
    return { deca: null, error: { message: "No se ha podido registrar el DeCA: " + error.message } };
  }
  return { deca: data, error: null };
};

// Los servicios que ya tienen algún DeCA vigente (no anulado), como Set de
// servicio_id. Se carga una vez con el resto de datos y se compara en memoria:
// pedir los DeCA servicio por servicio para pintar una marca en la lista y el
// calendario sería una consulta por tarjeta. null cuando la carga falla.
export const dbLoadServiciosConDeca = async () => {
  const { data, error } = await supabase
    .from("deca")
    .select("servicio_id")
    .not("servicio_id", "is", null)
    .or("anulado.is.null,anulado.eq.false");
  if (error) { console.error(error); return null; }
  return new Set((data || []).map((d) => d.servicio_id));
};

// Un servicio marcado como requiere_deca, abierto y sin DeCA es un trabajo
// que no puede salir legalmente: es lo que la lista y el calendario señalan
export const servicioSinDeca = (s, serviciosConDeca) =>
  !!s.requiere_deca && (s.estado || "abierto") === "abierto" && !serviciosConDeca?.has(s.id);

// Los DeCA de un servicio, el más nuevo primero. null cuando la carga falla,
// para distinguirlo de "no tiene ninguno".
export const dbLoadDecaDeServicio = async (servicioId) => {
  const { data, error } = await supabase
    .from("deca")
    .select("*")
    .eq("servicio_id", servicioId)
    .order("creado_en", { ascending: false });
  if (error) { console.error(error); return null; }
  return data || [];
};
