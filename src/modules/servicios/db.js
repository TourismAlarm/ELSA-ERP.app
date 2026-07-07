import { supabase } from "../../shared/lib/supabase";

const sanitize = (s) => {
  // vehiculo se guarda como string separado por comas para compatibilidad con columna text
  const vehiculoStr = Array.isArray(s.vehiculo)
    ? s.vehiculo.join(", ")
    : (s.vehiculo || "");

  // nifCif, dirFact, telCliente y emailCliente son campos del cliente —
  // no existen como columnas en servicios, excluirlos del insert.
  // recurso_id se retira (fusionado en vehiculo/equipo); no persistirlo.
  const { nifCif, dirFact, fotos, telCliente, emailCliente, recurso_id, ...rest } = s;

  const sanitized = {
    ...rest,
    vehiculo: vehiculoStr,
    precio: s.precio !== "" && s.precio != null ? Number(s.precio) : null,
    fecha_servicio: s.fecha_servicio || null,
    hora_inicio: s.hora_inicio || null,
    hora_fin: s.hora_fin || null,
  };

  if (fotos && Array.isArray(fotos) && fotos.length > 0) {
    sanitized.fotos = fotos;
  }

  return sanitized;
};

const deserializeServicio = (s) => ({
  ...s,
  vehiculo: s.vehiculo ? s.vehiculo.split(", ").filter(Boolean) : [],
});

export const dbLoadServicios = async () => {
  const { data, error } = await supabase.from("servicios").select("*").order("created_at", { ascending: false });
  if (error) { console.error(error); return []; }
  return data.map(deserializeServicio);
};

export const dbSaveServicio = async (servicio) => {
  // numero lo asigna un trigger de la base de datos en el propio insert — no enviarlo
  const { id, numero, created_at, updated_at, ...rest } = sanitize(servicio);
  const toInsert = {
    ...rest,
    estado: servicio.estado || "abierto",
    notas: servicio.notas || [],
  };
  const { data, error } = await supabase.from("servicios").insert([toInsert]).select().single();
  if (error) { console.error(error); alert("Error al guardar el servicio: " + error.message); return null; }
  return deserializeServicio(data);
};

export const dbUpdateServicio = async (servicio) => {
  const { id, numero, created_at, updated_at, ...campos } = sanitize(servicio);
  const { error } = await supabase.from("servicios").update(campos).eq("id", servicio.id);
  if (error) { console.error(error); alert("Error al guardar el servicio: " + error.message); }
};

export const dbDeleteServicio = async (id) => {
  const { error } = await supabase.from("servicios").delete().eq("id", id);
  if (error) { console.error(error); alert("Error al borrar el servicio: " + error.message); return false; }
  return true;
};

export const dbCambiarEstadoServicio = async (id, estado) => {
  const { error } = await supabase.from("servicios").update({ estado }).eq("id", id);
  if (error) console.error(error);
};

export const dbAddNotaServicio = async (id, nota) => {
  const { data: current, error: fetchError } = await supabase
    .from("servicios").select("notas").eq("id", id).single();
  if (fetchError) { console.error(fetchError); return null; }
  const notas = [...(current.notas || []), nota];
  const { error } = await supabase.from("servicios").update({ notas }).eq("id", id);
  if (error) { console.error(error); return null; }
  return { notas };
};
