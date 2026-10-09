// POST /api/google/conectar  →  { url } a la que llevar al navegador para
// dar permiso en Google. Solo administración.
import { quienEs, hayClaveServicio } from "../_lib/supabase.js";
import { googleConfigurado, crearState, urlConsentimiento } from "../_lib/googleApi.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.status(405).json({ error: "Método no permitido" }); return; }
  if (!googleConfigurado()) {
    res.status(503).json({ error: "Falta configurar GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en Vercel." });
    return;
  }
  if (!hayClaveServicio()) {
    res.status(503).json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY en Vercel para este entorno." });
    return;
  }
  const yo = await quienEs(req);
  if (!yo?.admin) { res.status(403).json({ error: "Solo administración puede conectar la cuenta de Google." }); return; }
  res.status(200).json({ url: urlConsentimiento(req, crearState(yo.id)) });
}
