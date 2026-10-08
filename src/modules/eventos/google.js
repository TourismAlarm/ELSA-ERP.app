import { supabase } from "../../shared/lib/supabase";

// Eventos de Google Calendar para enseñarlos en el calendario del ERP, en
// solo lectura. Los descarga el servidor de la app (/api/google-calendar)
// porque el navegador no puede bajar el iCal de Google directamente.
//
// Devuelve { eventos, error }. Sin dirección configurada: lista vacía y sin
// error. Si falla, error con el motivo y quien llama conserva lo anterior:
// que Google no conteste no debe vaciar el calendario.
export const dbLoadEventosGoogle = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { eventos: [], error: null };
  try {
    const r = await fetch("/api/google-calendar", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const cuerpo = await r.json().catch(() => null);
    if (!r.ok) return { eventos: null, error: cuerpo?.error || `Error ${r.status}` };
    return { eventos: cuerpo?.eventos || [], error: null };
  } catch (e) {
    console.error(e);
    return { eventos: null, error: "Sin conexión con el servidor" };
  }
};

// El enlace iCal del ERP para suscribirse desde Google Calendar
export const urlCalendarioERP = (token) =>
  token ? `${window.location.origin}/api/calendario?token=${token}` : null;

// Genera (o cambia) el token del enlace. Solo admin. Cambiarlo deja sin
// servicio el enlace anterior. Devuelve el token nuevo o null.
export const dbRegenerarTokenCalendario = async () => {
  const { data, error } = await supabase.rpc("regenerar_token_calendario");
  if (error) { console.error(error); alert("No se ha podido generar el enlace: " + error.message); return null; }
  return data;
};
