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
  const { data: numero, error: rpcError } = await supabase.rpc("next_solicitud_numero");
  if (rpcError) { console.error(rpcError); return null; }

  const { id, ...rest } = sanitize(solicitud);
  const toInsert = {
    ...rest,
    numero,
    estado: solicitud.estado || "pendiente",
    fecha_ultimo_contacto: new Date().toISOString(),
    notas_seguimiento: solicitud.notas_seguimiento || [],
    avisos_activos: solicitud.avisos_activos !== undefined ? solicitud.avisos_activos : true,
  };
  const { data, error } = await supabase.from("solicitudes").insert([toInsert]).select().single();
  if (error) { console.error(error); return null; }
  return data;
};

export const dbAddNota = async (id, nota) => {
  const { data: current, error: fetchError } = await supabase
    .from("solicitudes").select("notas_seguimiento").eq("id", id).single();
  if (fetchError) { console.error(fetchError); return null; }
  const notas = [...(current.notas_seguimiento || []), nota];
  const now = new Date().toISOString();
  const { error } = await supabase.from("solicitudes")
    .update({ notas_seguimiento: notas, fecha_ultimo_contacto: now })
    .eq("id", id);
  if (error) { console.error(error); return null; }
  return { notas_seguimiento: notas, fecha_ultimo_contacto: now };
};

export const dbCambiarEstado = async (id, estado) => {
  const { error } = await supabase.from("solicitudes")
    .update({ estado, fecha_ultimo_contacto: new Date().toISOString() })
    .eq("id", id);
  if (error) console.error(error);
};

export const dbToggleAvisos = async (id, valor) => {
  const { error } = await supabase.from("solicitudes").update({ avisos_activos: valor }).eq("id", id);
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

export const dbUpdateCliente = async (cliente) => {
  const { error } = await supabase.from("clientes")
    .update({ nombre: cliente.nombre, nifCif: cliente.nifCif || "", dirFact: cliente.dirFact || "", tel: cliente.tel, email: cliente.email })
    .eq("id", cliente.id);
  if (error) console.error(error);
};

export const dbDeleteCliente = async (id) => {
  const { error } = await supabase.from("clientes").delete().eq("id", id);
  if (error) console.error(error);
};


export const dbLoadClientes = async () => {
  const { data, error } = await supabase.from("clientes").select("*").order("nombre");
  if (error) { console.error(error); return []; }
  return data;
};

export const dbSaveCliente = async (cliente) => {
  const { data, error } = await supabase.from("clientes").insert([cliente]).select().single();
  if (error) { console.error(error); return null; }
  return data;
};
