import { supabase } from "../../shared/lib/supabase";

const sanitize = (v) => ({
  ...v,
  itv_vencimiento: v.itv_vencimiento || null,
  seguro_vencimiento: v.seguro_vencimiento || null,
  activo: v.activo !== undefined ? v.activo : true,
});

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
