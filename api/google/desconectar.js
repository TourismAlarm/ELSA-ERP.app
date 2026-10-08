// POST /api/google/desconectar  →  quita la conexión con Google (y retira el
// permiso en Google). Los eventos ya escritos se quedan en Google.
// Solo administración.
import { quienEs, admin } from "../_lib/supabase.js";
import { leerConexion, revocar } from "../_lib/googleApi.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.status(405).json({ error: "Método no permitido" }); return; }
  const yo = await quienEs(req);
  if (!yo?.admin) { res.status(403).json({ error: "Solo administración puede desconectar la cuenta de Google." }); return; }
  try {
    const c = await leerConexion();
    if (c?.refresh_token) await revocar(c.refresh_token);
    await admin("google_conexion?id=eq.1", { method: "DELETE" });
    await admin("config?id=eq.1", { method: "PATCH", body: JSON.stringify({ google_cuenta: null }) });
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
