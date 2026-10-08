// GET /api/google-calendar  →  eventos de los calendarios de Google, en JSON.
//
// El navegador no puede descargar el iCal de Google directamente (Google no
// lo permite desde otra web), así que lo descarga este servidor. Las
// direcciones no viajan en la petición: se leen de la configuración con la
// sesión de quien pregunta, así que solo un usuario activo de la app puede
// usarlo y no sirve para pedir cualquier otra URL.
//
// Puede haber varios calendarios (en Google hay uno por vehículo). Se piden
// todos a la vez; si uno falla, los demás salen igual y se dice cuál falló.
// Cada evento lleva el nombre de su calendario, que la app cruza con los
// vehículos para darle su color.
import { rest } from "./_lib/supabase.js";
import { leerGoogleICS, urlGoogleValida, calendariosDe } from "./_lib/google.js";

export { calendariosDe };

// Ventana para los eventos que se repiten (los sueltos van todos)
const ANOS_ATRAS = 3;
const ANOS_ADELANTE = 2;
// Por debajo del límite de tiempo de las funciones de Vercel (10 s en el plan
// básico): mejor perder un calendario lento que la respuesta entera
const ESPERA_MAX_MS = 8000;

const leerUno = async ({ nombre, url }, i, ventana) => {
  if (!urlGoogleValida(url)) {
    return { error: "no es una dirección iCal de Google Calendar" };
  }
  const g = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(ESPERA_MAX_MS) });
  if (!g.ok) {
    return { error: g.status === 404 ? "Google no la encuentra (¿se ha restablecido la dirección secreta?)" : `Google ha respondido ${g.status}` };
  }
  const eventos = leerGoogleICS(await g.text(), { ...ventana, prefijo: String(i) })
    .map((e) => ({ ...e, calendario: nombre }));
  return { eventos };
};

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  const sesion = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!sesion) {
    res.status(401).json({ error: "Falta la sesión" });
    return;
  }
  try {
    const r = await rest("config?select=*&id=eq.1", { token: sesion });
    if (r.status === 401) { res.status(401).json({ error: "Sesión caducada" }); return; }
    if (!r.ok) { res.status(502).json({ error: "No se ha podido leer la configuración" }); return; }
    const calendarios = calendariosDe((await r.json())?.[0]);
    if (calendarios.length === 0) { res.status(200).json({ eventos: [], errores: [], configurado: false }); return; }

    const ahora = new Date();
    const desde = new Date(ahora); desde.setFullYear(ahora.getFullYear() - ANOS_ATRAS);
    const hasta = new Date(ahora); hasta.setFullYear(ahora.getFullYear() + ANOS_ADELANTE);

    const resultados = await Promise.allSettled(calendarios.map((c, i) => leerUno(c, i, { desde, hasta })));
    const eventos = [];
    const errores = [];
    resultados.forEach((x, i) => {
      const nombre = calendarios[i].nombre;
      if (x.status === "rejected") {
        console.error(nombre, x.reason);
        errores.push({ calendario: nombre, error: x.reason?.name === "TimeoutError" ? "Google tarda demasiado en contestar" : "no se ha podido leer" });
      } else if (x.value.error) {
        errores.push({ calendario: nombre, error: x.value.error });
      } else {
        eventos.push(...x.value.eventos);
      }
    });
    res.status(200).json({ eventos, errores, configurado: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "No se han podido leer los calendarios de Google" });
  }
}
