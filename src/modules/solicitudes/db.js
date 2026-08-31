import { supabase } from "../../shared/lib/supabase";

const sanitize = (s) => {
  // vehiculo se guarda como string separado por comas para compatibilidad con columna text
  const vehiculoStr = Array.isArray(s.vehiculo)
    ? s.vehiculo.join(", ")
    : (s.vehiculo || "");

  // nifCif y dirFact son campos del cliente, y fecha es un campo derivado para la UI —
  // ninguno existe como columna en solicitudes, excluirlos del insert.
  // OJO: cliente_id SÍ es columna real (vínculo al cliente), no añadirlo a esta lista.
  const { nifCif, dirFact, fotos, telCliente, emailCliente, fecha, ...rest } = s;

  const sanitized = {
    ...rest,
    vehiculo: vehiculoStr,
    precio: s.precio !== "" && s.precio != null ? Number(s.precio) : null,
    metros: s.metros !== "" && s.metros != null ? Number(s.metros) : null,
    peso:   s.peso   !== "" && s.peso   != null ? Number(s.peso)   : null,
    bultos: s.bultos !== "" && s.bultos != null ? Number(s.bultos) : null,
  };

  if (fotos && Array.isArray(fotos) && fotos.length > 0) {
    sanitized.fotos = fotos;
  }

  return sanitized;
};

// La fecha de la solicitud no viaja como columna propia en el insert; al releer
// la fila se reconstruye desde created_at para que la lista, la ficha y el PDF
// no se queden sin fecha después de recargar la página.
const fechaDeAlta = (s) =>
  s.fecha ||
  (s.created_at
    ? new Date(s.created_at).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "");

const deserializeSolicitud = (s) => ({
  ...s,
  fecha: fechaDeAlta(s),
  vehiculo: s.vehiculo ? s.vehiculo.split(", ").filter(Boolean) : [],
});

// Devuelve null cuando la carga falla, para poder distinguirlo de "no hay nada
// guardado" y no enseñar una app vacía cuando lo que pasa es que no hay red.
export const dbLoadSolicitudes = async () => {
  const { data, error } = await supabase.from("solicitudes").select("*").order("id", { ascending: false });
  if (error) { console.error(error); return null; }
  return data.map(deserializeSolicitud);
};

export const dbSaveSolicitud = async (solicitud) => {
  // numero lo asigna un trigger BEFORE INSERT en la misma transacción del insert,
  // para que un insert fallido nunca consuma un número del contador
  const { id, ...rest } = sanitize(solicitud);
  const toInsert = {
    ...rest,
    estado: solicitud.estado || "pendiente",
    fecha_ultimo_contacto: new Date().toISOString(),
    notas_seguimiento: solicitud.notas_seguimiento || [],
    avisos_activos: solicitud.avisos_activos !== undefined ? solicitud.avisos_activos : true,
  };
  const { data, error } = await supabase.from("solicitudes").insert([toInsert]).select().single();
  if (error) { console.error(error); alert("Error al guardar la solicitud: " + error.message); return null; }
  // Deserializar como en la carga: si no, el vehículo se queda como texto con
  // comas y al editar la solicitud recién creada los vehículos se fusionan en uno
  return deserializeSolicitud({ ...data, fecha: solicitud.fecha });
};

export const dbAddNota = async (id, nota) => {
  const { data: current, error: fetchError } = await supabase
    .from("solicitudes").select("notas_seguimiento").eq("id", id).single();
  if (fetchError) { console.error(fetchError); alert("Error al guardar la nota: " + fetchError.message); return null; }
  const notas = [...(current.notas_seguimiento || []), nota];
  const now = new Date().toISOString();
  const { error } = await supabase.from("solicitudes")
    .update({ notas_seguimiento: notas, fecha_ultimo_contacto: now })
    .eq("id", id);
  if (error) { console.error(error); alert("Error al guardar la nota: " + error.message); return null; }
  return { notas_seguimiento: notas, fecha_ultimo_contacto: now };
};

export const dbCambiarEstado = async (id, estado) => {
  const { error } = await supabase.from("solicitudes")
    .update({ estado, fecha_ultimo_contacto: new Date().toISOString() })
    .eq("id", id);
  if (error) { console.error(error); alert("Error al cambiar el estado: " + error.message); return false; }
  return true;
};

export const dbToggleAvisos = async (id, valor) => {
  const { error } = await supabase.from("solicitudes").update({ avisos_activos: valor }).eq("id", id);
  if (error) { console.error(error); alert("Error al cambiar los avisos: " + error.message); return false; }
  return true;
};

export const dbUpdateSolicitud = async (solicitud) => {
  const { error } = await supabase.from("solicitudes").update(sanitize(solicitud)).eq("id", solicitud.id);
  if (error) { console.error(error); alert("Error al guardar la solicitud: " + error.message); return false; }
  return true;
};

export const dbDeleteSolicitud = async (id) => {
  const { error } = await supabase.from("solicitudes").delete().eq("id", id);
  if (error) { console.error(error); alert("Error al borrar la solicitud: " + error.message); return false; }
  return true;
};

// "No hay configuración todavía" y "no se ha podido cargar" llevan a pantallas
// distintas, así que se devuelven por separado: confundirlos deja guardar una
// configuración vacía encima de la buena.
export const dbLoadConfig = async () => {
  const { data, error } = await supabase.from("config").select("*").eq("id", 1).maybeSingle();
  if (error) { console.error(error); return { config: null, error: true }; }
  return { config: data, error: false };
};

export const dbSaveConfig = async (cfg) => {
  const { error } = await supabase.from("config").upsert({ id: 1, ...cfg });
  if (error) { console.error(error); alert("Error al guardar la configuración: " + error.message); return false; }
  return true;
};

export const dbUpdateCliente = async (cliente) => {
  const { error } = await supabase.from("clientes")
    .update({
      numero: (cliente.numero || "").trim() || null,
      nombre: cliente.nombre,
      nombre_comercial: cliente.nombre_comercial || "",
      nifCif: cliente.nifCif || "",
      dirFact: cliente.dirFact || "",
      cp: cliente.cp || "",
      poblacion: cliente.poblacion || "",
      provincia: cliente.provincia || "",
      tel: cliente.tel,
      movil: cliente.movil || "",
      email: cliente.email,
    })
    .eq("id", cliente.id);
  if (error) { console.error(error); alert("Error al guardar el cliente: " + error.message); return false; }
  return true;
};

export const dbDeleteCliente = async (id) => {
  const { error } = await supabase.from("clientes").delete().eq("id", id);
  if (error) { console.error(error); alert("Error al borrar el cliente: " + error.message); return false; }
  return true;
};


export const dbLoadClientes = async () => {
  const { data, error } = await supabase.from("clientes").select("*").order("nombre");
  if (error) { console.error(error); return null; }
  return data;
};

// Alta masiva desde el importador. Se inserta por lotes para no mandar
// cientos de filas en una sola petición, y se cuenta lo que entra de verdad:
// si un lote falla, los demás siguen y el resumen dice cuántos han quedado
// fuera, en vez de dar por bueno todo el fichero.
export const dbImportarClientes = async (clientes, onProgreso) => {
  const TAMANO_LOTE = 50;
  const creados = [];
  let fallidos = 0;

  for (let i = 0; i < clientes.length; i += TAMANO_LOTE) {
    const lote = clientes.slice(i, i + TAMANO_LOTE);
    const { data, error } = await supabase.from("clientes").insert(lote.map(paraGuardar)).select();
    if (error) { console.error(error); fallidos += lote.length; }
    else creados.push(...(data || []));
    if (onProgreso) onProgreso(Math.min(i + TAMANO_LOTE, clientes.length), clientes.length);
  }

  if (fallidos > 0) {
    alert(`Se han importado ${creados.length} clientes, pero ${fallidos} no se han podido guardar. Revisa la lista y vuelve a importar solo los que falten.`);
  }
  return { creados, fallidos };
};

// El número vacío se manda como null para que el trigger de la base de datos
// asigne el siguiente libre; si viene puesto, se respeta.
const paraGuardar = (c) => ({ ...c, numero: (c.numero || "").trim() || null });

export const dbSaveCliente = async (cliente) => {
  const { data, error } = await supabase.from("clientes").insert([paraGuardar(cliente)]).select().single();
  if (error) { console.error(error); alert("Error al guardar el cliente: " + error.message); return null; }
  return data;
};
