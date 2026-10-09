// GET /api/google-calendar  →  eventos de los calendarios de Google, en JSON.
//
// Con la cuenta de Google conectada (Configuración), se leen los
// calendarios propios de la cuenta (el principal y uno por vehículo) con la
// API de Google. Cada evento lleva el nombre de su calendario, que la app
// cruza con los vehículos para darle su color. Si un calendario falla, los
// demás salen igual y se dice cuál.
//
// Solo para usuarios activos de la app.
import { quienEs } from "./_lib/supabase.js";
import { leerConexion, tokenAcceso, listarCalendarios, leerEventos } from "./_lib/googleApi.js";
import { eventoDeGoogle } from "./_lib/google.js";

// Historial que se trae: 3 años atrás y 2 adelante
const ANOS_ATRAS = 3;
const ANOS_ADELANTE = 2;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  const yo = await quienEs(req);
  if (!yo?.activo) { res.status(401).json({ error: "Sin sesión" }); return; }

  try {
    const conexion = await leerConexion();
    if (!conexion) { res.status(200).json({ eventos: [], errores: [], conectado: false }); return; }
    const token = await tokenAcceso(conexion.refresh_token);
    const calendarios = await listarCalendarios(token);

    const ahora = new Date();
    const desde = new Date(ahora); desde.setFullYear(ahora.getFullYear() - ANOS_ATRAS);
    const hasta = new Date(ahora); hasta.setFullYear(ahora.getFullYear() + ANOS_ADELANTE);

    const resultados = await Promise.allSettled(calendarios.map((c) => leerEventos(token, c.id, desde, hasta)));
    const eventos = [];
    const errores = [];
    resultados.forEach((x, i) => {
      const c = calendarios[i];
      if (x.status === "rejected") {
        console.error(c.nombre, x.reason);
        errores.push({ calendario: c.nombre, error: x.reason?.name === "TimeoutError" ? "Google tarda demasiado en contestar" : x.reason?.message || "no se ha podido leer" });
      } else {
        x.value.forEach((ev) => {
          const e = eventoDeGoogle(ev, c);
          if (e) eventos.push(e);
        });
      }
    });
    res.status(200).json({ eventos, errores, conectado: true });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: e.message || "No se han podido leer los calendarios de Google" });
  }
}
