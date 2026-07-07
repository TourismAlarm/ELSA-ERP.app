import { supabase } from "../../shared/lib/supabase";

const sanitize = (a) => {
  // nifCif, dirFact, telCliente y emailCliente son campos del cliente —
  // no existen como columnas en albaranes, excluirlos del insert
  const { nifCif, dirFact, fotos, telCliente, emailCliente, ...rest } = a;

  const sanitized = {
    ...rest,
    fecha: a.fecha || null,
    lineas: Array.isArray(a.lineas) ? a.lineas : [],
  };

  if (fotos && Array.isArray(fotos) && fotos.length > 0) {
    sanitized.fotos = fotos;
  }

  return sanitized;
};

export const dbLoadAlbaranes = async () => {
  const { data, error } = await supabase.from("albaranes").select("*").order("created_at", { ascending: false });
  if (error) { console.error(error); return []; }
  return data;
};

export const dbSaveAlbaran = async (albaran) => {
  // numero lo asigna el trigger BEFORE INSERT desde el contador persistente,
  // en la misma transacción: un insert fallido no consume ni salta números
  const { id, numero, created_at, updated_at, ...rest } = sanitize(albaran);
  const toInsert = {
    ...rest,
    estado: albaran.estado || "borrador",
  };
  const { data, error } = await supabase.from("albaranes").insert([toInsert]).select().single();
  if (error) { console.error(error); alert("Error al guardar el albarán: " + error.message); return null; }
  return data;
};

export const dbUpdateAlbaran = async (albaran) => {
  const { id, numero, created_at, updated_at, ...campos } = sanitize(albaran);
  const { error } = await supabase.from("albaranes").update(campos).eq("id", albaran.id);
  if (error) { console.error(error); alert("Error al guardar el albarán: " + error.message); }
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
  if (error) console.error(error);
};

export const dbFirmarAlbaran = async (id, firmaBase64, firmadoPor) => {
  const firmado_en = new Date().toISOString();
  const { error } = await supabase.from("albaranes")
    .update({ firma: firmaBase64, firmado_por: firmadoPor, firmado_en, estado: "firmado" })
    .eq("id", id);
  if (error) { console.error(error); alert("Error al guardar la firma: " + error.message); return null; }
  return { firma: firmaBase64, firmado_por: firmadoPor, firmado_en, estado: "firmado" };
};
