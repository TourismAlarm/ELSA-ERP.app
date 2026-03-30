import { supabase } from "../supabase";

const sanitize = (s) => ({
  ...s,
  precio: s.precio !== "" && s.precio != null ? Number(s.precio) : null,
  metros: s.metros !== "" && s.metros != null ? Number(s.metros) : null,
  peso:   s.peso   !== "" && s.peso   != null ? Number(s.peso)   : null,
  bultos: s.bultos !== "" && s.bultos != null ? Number(s.bultos) : null,
});

export const dbLoadSolicitudes = async () => {
  const { data, error } = await supabase.from("solicitudes").select("*").order("id", { ascending: false });
  if (error) { console.error(error); return []; }
  return data;
};

export const dbSaveSolicitud = async (solicitud) => {
  const { error } = await supabase.from("solicitudes").insert([sanitize(solicitud)]);
  if (error) console.error(error);
};

export const dbUpdateSolicitud = async (solicitud) => {
  const { error } = await supabase.from("solicitudes").update(sanitize(solicitud)).eq("id", solicitud.id);
  if (error) console.error(error);
};

export const dbDeleteSolicitud = async (id) => {
  const { error } = await supabase.from("solicitudes").delete().eq("id", id);
  if (error) console.error(error);
};

export const dbLoadConfig = async () => {
  const { data, error } = await supabase.from("config").select("*").eq("id", 1).maybeSingle();
  if (error) { console.error(error); return null; }
  return data;
};

export const dbSaveConfig = async (cfg) => {
  const { error } = await supabase.from("config").upsert({ id: 1, ...cfg });
  if (error) console.error(error);
};
