// POST /api/google/sync  { servicios: [id, ...] }  →  lleva esos servicios a
// los calendarios de Google de sus vehículos.
//
// Lo que se hace con cada uno lo decide lo que hay en la base de datos, no
// quien llama: si el servicio existe, se escribe en los calendarios de sus
// vehículos y se quita de los demás; si ya no existe (se ha borrado), se
// quita de todos. Así, llamar de más o con un id cualquiera no hace daño.
// Cualquier usuario activo puede pedirlo (es lo que pasa al guardar).
import { quienEs, admin } from "../_lib/supabase.js";
import {
  leerConexion, tokenAcceso, listarCalendarios, calendariosDestino,
  eventoDeServicio, escribirEvento, borrarEvento, idEventoServicio,
} from "../_lib/googleApi.js";

const MAX_POR_PETICION = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.status(405).json({ error: "Método no permitido" }); return; }
  const yo = await quienEs(req);
  if (!yo?.activo) { res.status(401).json({ error: "Sin sesión" }); return; }

  const ids = [...new Set((req.body?.servicios || []).map(String))].filter((x) => UUID.test(x)).slice(0, MAX_POR_PETICION);
  if (ids.length === 0) { res.status(400).json({ error: "Faltan servicios" }); return; }

  try {
    const conexion = await leerConexion();
    if (!conexion) { res.status(200).json({ conectado: false, resultados: [] }); return; }

    const rSrv = await admin(`servicios?select=id,numero,cliente,vehiculo,origen,destino,descripcion,fecha_servicio,hora_inicio,hora_fin,estado&id=in.(${ids.join(",")})`);
    if (!rSrv.ok) throw new Error("No se han podido leer los servicios");
    const servicios = Object.fromEntries((await rSrv.json()).map((s) => [s.id, s]));
    const token = await tokenAcceso(conexion.refresh_token);
    const calendarios = await listarCalendarios(token);
    const urlApp = `https://${req.headers["x-forwarded-host"] || req.headers.host}`;

    const resultados = [];
    for (const id of ids) {
      const s = servicios[id];
      const eventoId = idEventoServicio(id);
      try {
        // Sin fecha o borrado: a ningún calendario (se quita de todos)
        const destino = s && s.fecha_servicio ? calendariosDestino(s, calendarios) : [];
        const enDestino = new Set(destino.map((c) => c.id));
        const evento = destino.length ? eventoDeServicio(s, { urlApp }) : null;
        await Promise.all(calendarios.map((c) =>
          enDestino.has(c.id) ? escribirEvento(token, c.id, evento) : borrarEvento(token, c.id, eventoId)
        ));
        resultados.push({ id, ok: true, calendarios: destino.map((c) => c.nombre) });
      } catch (e) {
        resultados.push({ id, ok: false, error: e.message });
      }
    }
    res.status(200).json({ conectado: true, resultados });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
