// GET /api/google-calendar  →  eventos del calendario de Google, en JSON.
//
// El navegador no puede descargar el iCal de Google directamente (Google no
// lo permite desde otra web), así que lo descarga este servidor. La
// dirección no viaja en la petición: se lee de la configuración con la
// sesión de quien pregunta, así que solo un usuario activo de la app puede
// usarlo y no sirve para pedir cualquier otra URL.
import { rest } from "./_lib/supabase.js";
import { leerGoogleICS, urlGoogleValida } from "./_lib/google.js";

// Ventana para los eventos que se repiten (los sueltos van todos)
const ANOS_ATRAS = 3;
const ANOS_ADELANTE = 2;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  const sesion = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!sesion) {
    res.status(401).json({ error: "Falta la sesión" });
    return;
  }
  try {
    const r = await rest("config?select=google_ics_url&id=eq.1", { token: sesion });
    if (r.status === 401) { res.status(401).json({ error: "Sesión caducada" }); return; }
    if (!r.ok) { res.status(502).json({ error: "No se ha podido leer la configuración" }); return; }
    const url = (await r.json())?.[0]?.google_ics_url;
    if (!url) { res.status(200).json({ eventos: [], configurado: false }); return; }
    if (!urlGoogleValida(url)) {
      res.status(400).json({ error: "La dirección guardada no es una dirección iCal de Google Calendar" });
      return;
    }

    const g = await fetch(url, { redirect: "error" });
    if (!g.ok) {
      res.status(502).json({ error: `Google ha respondido ${g.status}. Revisa la dirección secreta en Configuración.` });
      return;
    }
    const ahora = new Date();
    const desde = new Date(ahora); desde.setFullYear(ahora.getFullYear() - ANOS_ATRAS);
    const hasta = new Date(ahora); hasta.setFullYear(ahora.getFullYear() + ANOS_ADELANTE);
    const eventos = leerGoogleICS(await g.text(), { desde, hasta });
    res.status(200).json({ eventos, configurado: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "No se ha podido leer el calendario de Google" });
  }
}
