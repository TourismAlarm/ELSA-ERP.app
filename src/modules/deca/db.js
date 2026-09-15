import { supabase } from "../../shared/lib/supabase";
import { faltanDatosDeca } from "./validar";
import { BUCKET_DECA } from "./pdf";

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

  // El módulo del PDF (jsPDF + qrcode) solo se carga al emitir
  const { generarPdfDeca } = await import("./pdf");
  const { id, pdfPath, url, datos, blob } = await generarPdfDeca(servicio, cliente, config);

  const { error: errorSubida } = await supabase.storage
    .from(BUCKET_DECA)
    .upload(pdfPath, blob, { contentType: "application/pdf", upsert: true });
  if (errorSubida) {
    console.error(errorSubida);
    return { deca: null, error: { message: "No se ha podido subir el PDF del DeCA: " + errorSubida.message } };
  }

  // numero (DECA-XXX) lo asigna el trigger de la base de datos: no se envía
  const { data, error } = await supabase
    .from("deca")
    .insert([{ id, servicio_id: servicio.id ?? null, pdf_path: pdfPath, url, datos }])
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
