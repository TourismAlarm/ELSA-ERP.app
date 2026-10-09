// GET /api/google/calendarios  →  los calendarios de la cuenta conectada,
// para enseñar en Configuración a qué vehículo va cada uno.
import { quienEs } from "../_lib/supabase.js";
import { leerConexion, tokenAcceso, listarCalendarios } from "../_lib/googleApi.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  const yo = await quienEs(req);
  if (!yo?.activo) { res.status(401).json({ error: "Sin sesión" }); return; }
  try {
    const conexion = await leerConexion();
    if (!conexion) { res.status(200).json({ conectado: false, calendarios: [] }); return; }
    const calendarios = await listarCalendarios(await tokenAcceso(conexion.refresh_token));
    res.status(200).json({ conectado: true, calendarios });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: e.message });
  }
}
