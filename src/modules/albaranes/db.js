import { supabase, cargarTodas } from "../../shared/lib/supabase";

// Campos que solo escribe la base de datos (firma, congelación y anulación):
// la app nunca los manda, ni aunque vengan en el objeto que se está editando.
const SOLO_SERVIDOR = [
  "contenido_firmado", "huella_sha256", "firmado_por_usuario", "firmado_en",
  "anulado", "anulado_en", "anulado_por", "motivo_anulacion",
  "pdf_path", "pdf_sha256", "pdf_guardado_en",
];

const sanitize = (a) => {
  // nifCif, dirFact, telCliente y emailCliente SÍ son columnas desde la
  // migración 20260929190000: lo escrito en el albarán se guarda y manda
  // sobre la ficha del cliente.
  const { fotos, ...rest } = a;
  for (const campo of SOLO_SERVIDOR) delete rest[campo];

  const sanitized = {
    ...rest,
    fecha: a.fecha || null,
    lineas: Array.isArray(a.lineas) ? a.lineas : [],
  };

  // Un array vacío también se guarda: si no, al quitar la última foto la
  // columna seguía apuntando a un fichero ya borrado
  if (Array.isArray(fotos)) sanitized.fotos = fotos;

  return sanitized;
};

// Los errores de la base de datos (firmado que no se puede tocar, falta de
// permisos...) ya vienen redactados para la persona que usa la app
const mensaje = (error) =>
  /row-level security/i.test(error.message)
    ? "No tienes permiso para esta operación."
    : error.message;

// null cuando la carga falla, para distinguirlo de "no hay albaranes"
export const dbLoadAlbaranes = async () => cargarTodas("albaranes", { orden: "created_at", ascendente: false });

export const dbSaveAlbaran = async (albaran) => {
  // numero lo asigna el trigger BEFORE INSERT desde el contador persistente,
  // en la misma transacción: un insert fallido no consume ni salta números
  const { id, numero, created_at, updated_at, ...rest } = sanitize(albaran);
  const toInsert = {
    ...rest,
    estado: albaran.estado || "borrador",
  };
  const { data, error } = await supabase.from("albaranes").insert([toInsert]).select().single();
  if (error) { console.error(error); alert("Error al guardar el albarán: " + mensaje(error)); return null; }
  return data;
};

export const dbUpdateAlbaran = async (albaran) => {
  const { id, numero, created_at, updated_at, ...campos } = sanitize(albaran);
  const { error } = await supabase.from("albaranes").update(campos).eq("id", albaran.id);
  if (error) { console.error(error); alert("Error al guardar el albarán: " + mensaje(error)); return false; }
  return true;
};

// Desvincula del servicio los albaranes que apuntan a él (no los borra).
// Necesario antes de borrar un servicio: la FK albaranes.servicio_id lo impide.
export const dbDesvincularAlbaranesDeServicio = async (servicioId) => {
  const { error } = await supabase.from("albaranes").update({ servicio_id: null }).eq("servicio_id", servicioId);
  if (error) { console.error(error); alert("Error al desvincular los albaranes: " + error.message); return false; }
  return true;
};

export const dbDeleteAlbaran = async (id) => {
  const { error } = await supabase.from("albaranes").delete().eq("id", id);
  if (error) { console.error(error); alert("No se ha podido borrar el albarán: " + mensaje(error)); return false; }
  return true;
};

// Firma y cierra el servicio vinculado en una sola operación de la base de
// datos: o se hacen las dos cosas o ninguna. La hora de firma la pone el
// servidor y el contenido queda congelado con su huella. Devuelve la fila
// completa del albarán ya firmado, o null si ha fallado.
export const dbFirmarAlbaran = async (id, firmaBase64, firmadoPor) => {
  const { data, error } = await supabase.rpc("firmar_albaran", {
    p_id: id, p_firma: firmaBase64, p_firmado_por: firmadoPor,
  });
  if (error) { console.error(error); alert("Error al guardar la firma: " + mensaje(error)); return null; }
  return data;
};

// Genera el albarán de un servicio: guarda las horas reales, marca el
// servicio como realizado y crea el albarán, todo junto. Si el servicio ya
// tenía un albarán vigente devuelve ese (pulsar dos veces no duplica).
export const dbEmitirAlbaranDeServicio = async (servicioId, horaInicio, horaFin) => {
  const { data, error } = await supabase.rpc("emitir_albaran_de_servicio", {
    p_servicio_id: servicioId, p_hora_inicio: horaInicio || null, p_hora_fin: horaFin || null,
  });
  if (error) { console.error(error); alert("No se ha podido generar el albarán: " + mensaje(error)); return null; }
  return data;
};

// Anula un albarán firmado. Solo admin; el motivo es obligatorio y queda
// registrado con quién y cuándo. Un anulado no se borra ni se reactiva.
export const dbAnularAlbaran = async (id, motivo) => {
  const { data, error } = await supabase.rpc("anular_albaran", { p_id: id, p_motivo: motivo });
  if (error) { console.error(error); alert("No se ha podido anular el albarán: " + mensaje(error)); return null; }
  return data;
};

// ---- PDF emitido -----------------------------------------------------------
// Al firmar se guarda el PDF exacto que se entrega, en un bucket privado. La
// base de datos solo deja subirlo una vez y solo para un albarán firmado, y
// nadie puede sobrescribirlo ni borrarlo desde la app.
const BUCKET_PDF = "albaranes-firmados";

const sha256Hex = async (blob) => {
  const hash = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
};

// Sube el PDF y lo registra en el albarán. Devuelve { pdf_path, pdf_sha256,
// pdf_guardado_en } o null. Sin alert: si falla, el albarán sigue firmado y
// la ficha muestra «PDF pendiente» con un botón para reintentar.
export const dbGuardarPdfEmitido = async (albaran, blob) => {
  // Nombre con marca de tiempo: si un intento anterior subió el fichero pero
  // no llegó a registrarlo, el reintento no choca con él
  const path = `${albaran.id}/${albaran.numero || "albaran"}-${Date.now()}.pdf`;
  const pdf_sha256 = await sha256Hex(blob);

  const { error: errorSubida } = await supabase.storage.from(BUCKET_PDF)
    .upload(path, blob, { contentType: "application/pdf", upsert: false });
  if (errorSubida) { console.error("Subida del PDF emitido:", errorSubida); return null; }

  const { data, error } = await supabase.from("albaranes")
    .update({ pdf_path: path, pdf_sha256 })
    .eq("id", albaran.id)
    .select("pdf_path, pdf_sha256, pdf_guardado_en")
    .single();
  if (error) { console.error("Registro del PDF emitido:", error); return null; }
  return data;
};

// Descarga el PDF emitido tal cual se guardó y comprueba que su huella sigue
// siendo la registrada. Devuelve el Blob, o null si no se puede.
export const dbDescargarPdfEmitido = async (albaran) => {
  const { data, error } = await supabase.storage.from(BUCKET_PDF).download(albaran.pdf_path);
  if (error) { console.error(error); alert("No se ha podido descargar el PDF emitido: " + error.message); return null; }
  const blob = data.type === "application/pdf" ? data : new Blob([data], { type: "application/pdf" });
  if (albaran.pdf_sha256 && await sha256Hex(blob) !== albaran.pdf_sha256) {
    alert("Atención: el PDF guardado no coincide con la huella registrada al firmar. Avisa a administración.");
  }
  return blob;
};
