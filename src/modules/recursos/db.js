import { supabase } from "../../shared/lib/supabase";

const sanitize = (r) => ({
  ...r,
  orden: r.orden !== "" && r.orden != null ? Number(r.orden) : null,
  activo: r.activo !== undefined ? r.activo : true,
});

export const dbLoadRecursos = async () => {
  const { data, error } = await supabase.from("recursos").select("*").order("orden", { ascending: true });
  if (error) { console.error(error); return []; }
  return data;
};

export const dbSaveRecurso = async (recurso) => {
  const { id, created_at, updated_at, ...rest } = sanitize(recurso);
  const { data, error } = await supabase.from("recursos").insert([rest]).select().single();
  if (error) { console.error(error); alert("Error al guardar el recurso: " + error.message); return null; }
  return data;
};

export const dbUpdateRecurso = async (recurso) => {
  const { id, created_at, updated_at, ...campos } = sanitize(recurso);
  const { error } = await supabase.from("recursos").update(campos).eq("id", recurso.id);
  if (error) { console.error(error); alert("Error al guardar el recurso: " + error.message); }
};

export const dbDeleteRecurso = async (id) => {
  const { error } = await supabase.from("recursos").delete().eq("id", id);
  if (error) console.error(error);
};
