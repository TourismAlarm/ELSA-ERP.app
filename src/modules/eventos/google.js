import { supabase } from "../../shared/lib/supabase";

// Eventos de los calendarios de Google de la cuenta conectada, para
// enseñarlos en el calendario del ERP en solo lectura. Los lee el servidor
// de la app (/api/google-calendar), que es quien tiene la conexión.
//
// Devuelve { eventos, error }. Sin cuenta conectada: lista vacía y sin
// error. Si falla del todo, eventos null y quien llama conserva lo
// anterior: que Google no conteste no debe vaciar el calendario. Si fallan
// solo algunos calendarios, llegan los demás y error dice cuáles.
export const dbLoadEventosGoogle = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { eventos: [], error: null };
  try {
    const r = await fetch("/api/google-calendar", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const cuerpo = await r.json().catch(() => null);
    if (!r.ok) return { eventos: null, error: cuerpo?.error || `Error ${r.status}` };
    const errores = (cuerpo?.errores || []).map((x) => `${x.calendario}: ${x.error}`);
    return { eventos: cuerpo?.eventos || [], error: errores.length ? errores.join(" · ") : null };
  } catch (e) {
    console.error(e);
    return { eventos: null, error: "Sin conexión con el servidor" };
  }
};

// Los calendarios de la cuenta de Google conectada, para enseñar en
// Configuración a qué vehículo va cada uno.
// Devuelve { calendarios } o { error }.
export const dbLoadCalendariosGoogle = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: "Sin sesión" };
  try {
    const r = await fetch("/api/google/calendarios", { headers: { Authorization: `Bearer ${session.access_token}` } });
    const cuerpo = await r.json().catch(() => null);
    if (!r.ok) return { error: cuerpo?.error || `Error ${r.status}` };
    return { calendarios: cuerpo?.calendarios || [] };
  } catch (e) {
    console.error(e);
    return { error: "Sin conexión con el servidor" };
  }
};

export { conVehiculo } from "./vehiculoGoogle";

// ---- Escribir en Google (con la cuenta conectada) ----

const conSesion = async (ruta, cuerpo) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: "Sin sesión" };
  try {
    const r = await fetch(ruta, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo || {}),
    });
    const datos = await r.json().catch(() => null);
    if (!r.ok) return { error: datos?.error || `Error ${r.status}` };
    return { datos };
  } catch (e) {
    console.error(e);
    return { error: "Sin conexión con el servidor" };
  }
};

// Lleva servicios a los calendarios de Google de sus vehículos (o los quita
// si se han borrado: eso lo decide el servidor mirando la base de datos).
// Devuelve null si todo ha ido bien, o el texto del problema.
export const dbSincronizarGoogle = async (ids) => {
  const { datos, error } = await conSesion("/api/google/sync", { servicios: ids });
  if (error) return error;
  const fallos = (datos?.resultados || []).filter((x) => !x.ok);
  return fallos.length ? fallos.map((x) => x.error).filter(Boolean)[0] || "No se ha podido escribir en Google" : null;
};

// Lleva a Google a dar permiso. Solo admin. Devuelve el error, si lo hay.
export const dbConectarGoogle = async () => {
  const { datos, error } = await conSesion("/api/google/conectar");
  if (error) return error;
  window.location.assign(datos.url);
  return null;
};

export const dbDesconectarGoogle = async () => {
  const { error } = await conSesion("/api/google/desconectar");
  return error || null;
};
