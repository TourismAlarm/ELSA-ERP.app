import { supabase } from "../../shared/lib/supabase";

const sanitize = (v) => {
  const { fotos, ...rest } = v;

  const sanitized = {
    ...rest,
    itv_vencimiento: v.itv_vencimiento || null,
    seguro_vencimiento: v.seguro_vencimiento || null,
    activo: v.activo !== undefined ? v.activo : true,
    vencimientos: Array.isArray(v.vencimientos) ? v.vencimientos : [],
  };

  if (fotos && Array.isArray(fotos) && fotos.length > 0) {
    sanitized.fotos = fotos;
  }

  return sanitized;
};

export const dbLoadVehiculos = async () => {
  const { data, error } = await supabase.from("vehiculos").select("*").order("nombre");
  if (error) { console.error(error); return []; }
  return data;
};

export const dbSaveVehiculo = async (vehiculo) => {
  const { id, created_at, updated_at, ...rest } = sanitize(vehiculo);
  const { data, error } = await supabase.from("vehiculos").insert([rest]).select().single();
  if (error) { console.error(error); alert("Error al guardar el vehículo: " + error.message); return null; }
  return data;
};

export const dbUpdateVehiculo = async (vehiculo) => {
  const { id, created_at, updated_at, ...campos } = sanitize(vehiculo);
  const { error } = await supabase.from("vehiculos").update(campos).eq("id", vehiculo.id);
  if (error) { console.error(error); alert("Error al guardar el vehículo: " + error.message); }
};

export const dbDeleteVehiculo = async (id) => {
  const { error } = await supabase.from("vehiculos").delete().eq("id", id);
  if (error) console.error(error);
};

// ---- Mantenimientos y reparaciones ----

export const dbLoadMantenimientos = async (vehiculoId) => {
  const { data, error } = await supabase
    .from("mantenimientos").select("*")
    .eq("vehiculo_id", vehiculoId)
    .order("fecha", { ascending: false });
  if (error) { console.error(error); return []; }
  return data;
};

export const dbSaveMantenimiento = async (m) => {
  const toInsert = {
    ...m,
    fecha: m.fecha || null,
    coste: m.coste !== "" && m.coste != null ? Number(m.coste) : null,
    km:    m.km    !== "" && m.km    != null ? Number(m.km)    : null,
  };
  const { data, error } = await supabase.from("mantenimientos").insert([toInsert]).select().single();
  if (error) { console.error(error); alert("Error al guardar el mantenimiento: " + error.message); return null; }
  return data;
};

export const dbDeleteMantenimiento = async (id) => {
  const { error } = await supabase.from("mantenimientos").delete().eq("id", id);
  if (error) console.error(error);
};
