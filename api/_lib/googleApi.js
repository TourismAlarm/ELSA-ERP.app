// Escribir en Google Calendar: conexión de la cuenta (OAuth) y eventos.
//
// La cuenta se conecta una vez desde Configuración. Google devuelve un
// «refresh token» que se guarda en public.google_conexion (solo la lee el
// servidor) y con el que se piden tokens de acceso de una hora cuando hace
// falta escribir.
//
// Cada servicio del ERP es UN evento en el calendario de Google de cada uno
// de sus vehículos, siempre con el mismo id: «elsa» + el uuid del servicio
// sin guiones. Así no hace falta guardar qué evento corresponde a qué
// servicio, volver a enviar un servicio lo actualiza en vez de duplicarlo, y
// el lector del iCal reconoce los que escribió el ERP para no enseñarlos dos
// veces.

import { createHmac, timingSafeEqual } from "node:crypto";
import { admin } from "./supabase.js";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const ZONA = "Europe/Madrid";

export const SCOPES = ["openid", "email", "https://www.googleapis.com/auth/calendar.events"];

export const googleConfigurado = () => Boolean(CLIENT_ID && CLIENT_SECRET);

// La dirección de vuelta tiene que ser EXACTAMENTE la registrada en Google
// Cloud, así que se fija con GOOGLE_REDIRECT_URI o se saca del dominio.
export const redirectUri = (req) =>
  process.env.GOOGLE_REDIRECT_URI || `https://${req.headers["x-forwarded-host"] || req.headers.host}/api/google/callback`;

// ------------------------------------------------------------- OAuth

// El «state» que va y vuelve de Google: quién lo pidió y cuándo, firmado con
// el secreto de la app para que nadie pueda fabricar uno.
const firma = (texto) => createHmac("sha256", CLIENT_SECRET).update(texto).digest("base64url");

export const crearState = (usuarioId, ahora = Date.now()) => {
  const base = `${usuarioId}.${ahora}`;
  return `${base}.${firma(base)}`;
};

// Devuelve el id del usuario si el state es bueno y tiene menos de 15 min
export const leerState = (state, ahora = Date.now()) => {
  const partes = String(state || "").split(".");
  if (partes.length !== 3) return null;
  const [usuarioId, ts, sig] = partes;
  const esperada = Buffer.from(firma(`${usuarioId}.${ts}`));
  const recibida = Buffer.from(sig);
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null;
  if (!(ahora - Number(ts) >= 0 && ahora - Number(ts) < 15 * 60 * 1000)) return null;
  return usuarioId;
};

export const urlConsentimiento = (req, state) => {
  const p = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri(req),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    // Siempre pide el permiso: si no, Google no vuelve a dar refresh token
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
};

const pedirToken = async (campos) => {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, ...campos }),
  });
  const cuerpo = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(cuerpo.error_description || cuerpo.error || `Google ha respondido ${r.status}`);
    e.codigo = cuerpo.error;
    throw e;
  }
  return cuerpo;
};

// Cambia el código de vuelta por los tokens. Devuelve { refreshToken, cuenta }.
export const canjearCodigo = async (req, code) => {
  const t = await pedirToken({ code, grant_type: "authorization_code", redirect_uri: redirectUri(req) });
  if (!t.refresh_token) throw new Error("Google no ha dado permiso permanente. Vuelve a conectar.");
  let cuenta = null;
  try {
    // El id_token llega directo de Google por HTTPS: basta con leerlo
    cuenta = JSON.parse(Buffer.from(t.id_token.split(".")[1], "base64url").toString()).email || null;
  } catch { /* sin correo: se enseña "conectada" sin más */ }
  return { refreshToken: t.refresh_token, cuenta };
};

export const revocar = (token) =>
  fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: "POST" }).catch(() => null);

// ------------------------------------------------------------ conexión

export const leerConexion = async () => {
  const r = await admin("google_conexion?select=*&id=eq.1");
  if (!r.ok) throw new Error(`No se ha podido leer la conexión con Google (${r.status})`);
  return (await r.json())[0] || null;
};

// Token de acceso, guardado mientras dure en esta instancia del servidor
let cache = { refresh: null, token: null, caduca: 0 };
export const tokenAcceso = async (refreshToken) => {
  if (cache.refresh === refreshToken && cache.caduca > Date.now() + 60_000) return cache.token;
  try {
    const t = await pedirToken({ refresh_token: refreshToken, grant_type: "refresh_token" });
    cache = { refresh: refreshToken, token: t.access_token, caduca: Date.now() + (t.expires_in || 3600) * 1000 };
    return t.access_token;
  } catch (e) {
    if (e.codigo === "invalid_grant") {
      throw new Error("La conexión con Google ha caducado o se ha quitado. Vuelve a conectar la cuenta en Configuración.");
    }
    throw e;
  }
};

// -------------------------------------------------------------- eventos

// id del evento de Google de un servicio (base32hex: 0-9 y a-v; el hex cabe)
export const idEventoServicio = (servicioId) => "elsa" + String(servicioId).toLowerCase().replace(/-/g, "");


// El id del calendario va dentro de su dirección iCal:
// https://calendar.google.com/calendar/ical/<id>/private-xxxx/basic.ics
export const calendarioIdDeUrl = (url) => {
  const m = /^https:\/\/calendar\.google\.com\/calendar\/ical\/([^/]+)\//.exec(String(url || "").trim());
  return m ? decodeURIComponent(m[1]) : null;
};

const clave = (t) => String(t || "").trim().toLowerCase().replace(/\s+/g, "");
const vehiculosDe = (v) => (Array.isArray(v) ? v : String(v || "").split(",")).map((x) => x.trim()).filter(Boolean);

// A qué calendarios va un servicio: el de cada uno de sus vehículos (por el
// nombre del calendario). Sin vehículo, o con uno que no tiene calendario,
// al primer calendario que no es de ningún vehículo (el general), si lo hay.
export const calendariosDestino = (servicio, calendarios, nombresVehiculo) => {
  const conId = calendarios
    .map((c) => ({ nombre: c.nombre, id: calendarioIdDeUrl(c.url) }))
    .filter((c) => c.id);
  const porNombre = Object.fromEntries(conId.map((c) => [clave(c.nombre), c]));
  const deVehiculo = new Set((nombresVehiculo || []).map(clave));
  const general = conId.find((c) => !deVehiculo.has(clave(c.nombre)));

  const destino = new Map();
  const vs = vehiculosDe(servicio.vehiculo);
  vs.forEach((v) => {
    const c = porNombre[clave(v)] || general;
    if (c) destino.set(c.id, c);
  });
  if (vs.length === 0 && general) destino.set(general.id, general);
  return { destino: [...destino.values()], todos: conId };
};

const sumarUnaHora = (h) => {
  const [hh, mm] = h.split(":").map(Number);
  const t = Math.min(hh * 60 + mm + 60, 23 * 60 + 59);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};
const diaSiguiente = (iso) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

// El servicio convertido en evento de Google
export const eventoDeServicio = (s, { urlApp } = {}) => {
  const hora = (h) => h.slice(0, 5);
  let start, end;
  if (s.hora_inicio) {
    const ini = hora(s.hora_inicio);
    const fin = s.hora_fin && hora(s.hora_fin) > ini ? hora(s.hora_fin) : sumarUnaHora(ini);
    start = { dateTime: `${s.fecha_servicio}T${ini}:00`, timeZone: ZONA };
    end = { dateTime: `${s.fecha_servicio}T${fin}:00`, timeZone: ZONA };
  } else {
    start = { date: s.fecha_servicio };
    end = { date: diaSiguiente(s.fecha_servicio) };
  }
  const vs = vehiculosDe(s.vehiculo);
  const ruta = [s.origen, s.destino].filter(Boolean).join(" → ");
  const descripcion = [
    s.numero ? `Servicio ${s.numero}` : null,
    vs.length ? `🚛 ${vs.join(", ")}` : "🚛 Sin camión",
    ruta || null,
    s.descripcion || null,
    urlApp ? `\nCreado desde el ERP: los cambios se hacen allí (${urlApp}).` : "\nCreado desde el ERP: los cambios se hacen allí.",
  ].filter(Boolean).join("\n");
  return {
    id: idEventoServicio(s.id),
    status: "confirmed",
    summary: `${(s.estado || "abierto") === "realizado" ? "✓ " : ""}${s.cliente || "Sin nombre"}`,
    description: descripcion,
    location: s.origen || undefined,
    start,
    end,
    extendedProperties: { private: { elsaServicio: String(s.id) } },
  };
};

// Llamada a la API de Calendar. Devuelve la respuesta tal cual.
const api = (token, metodo, ruta, cuerpo) =>
  fetch(`https://www.googleapis.com/calendar/v3/${ruta}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    signal: AbortSignal.timeout(8000),
  });

const errorDe = async (r) => {
  const c = await r.json().catch(() => ({}));
  const m = c?.error?.message || `Google ha respondido ${r.status}`;
  if (r.status === 403 || r.status === 404) return `${m} (¿el calendario es de otra cuenta o no tiene permiso de escritura?)`;
  return m;
};

// Crea o actualiza el evento en un calendario. Primero se actualiza (vale
// también para uno que se borró antes: vuelve a estar confirmado); si no
// existe, se crea con su id.
export const escribirEvento = async (token, calendarioId, evento) => {
  const ruta = `calendars/${encodeURIComponent(calendarioId)}/events/${evento.id}`;
  let r = await api(token, "PUT", ruta, evento);
  if (r.status === 404 || r.status === 410) {
    r = await api(token, "POST", `calendars/${encodeURIComponent(calendarioId)}/events`, evento);
    if (r.status === 409) r = await api(token, "PUT", ruta, evento);
  }
  if (!r.ok) throw new Error(await errorDe(r));
};

// Borra el evento de un servicio de un calendario. Si no estaba, nada.
export const borrarEvento = async (token, calendarioId, eventoId) => {
  const r = await api(token, "DELETE", `calendars/${encodeURIComponent(calendarioId)}/events/${eventoId}`);
  if (!r.ok && r.status !== 404 && r.status !== 410) throw new Error(await errorDe(r));
};
