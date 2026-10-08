// GET /api/calendario?token=…  →  fichero iCal con los servicios y eventos.
//
// Es el enlace que se pega en Google Calendar («Añadir calendario → Desde
// URL»). Google no manda sesión, así que el único control es el token, que
// comprueba la base de datos (calendario_publico). Con un token que no vale
// se responde 404, sin decir si el enlace existió alguna vez.
import { rest } from "./_lib/supabase.js";
import { generarICS } from "./_lib/ics.js";

export default async function handler(req, res) {
  const token = String(req.query?.token || "");
  if (token.length < 32) {
    res.status(404).send("No encontrado");
    return;
  }
  try {
    const r = await rest("rpc/calendario_publico", { method: "POST", body: JSON.stringify({ p_token: token }) });
    if (!r.ok) {
      console.error("calendario_publico", r.status, await r.text());
      res.status(502).send("No se ha podido leer el calendario");
      return;
    }
    const datos = await r.json();
    if (!datos) {
      res.status(404).send("No encontrado");
      return;
    }
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", 'inline; filename="elsa-erp.ics"');
    // Que ninguna caché intermedia guarde un calendario con datos de clientes
    res.setHeader("Cache-Control", "private, no-store");
    res.status(200).send(generarICS(datos));
  } catch (e) {
    console.error(e);
    res.status(500).send("Error al generar el calendario");
  }
}
