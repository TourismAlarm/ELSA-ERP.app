// Convierte los eventos de la API de Google Calendar a la misma forma que la
// tabla `eventos` del ERP (fecha, fecha_fin, hora_inicio, hora_fin,
// todo_el_dia, titulo...), para que el calendario los pinte igual.
//
// Las horas se pasan a la hora de Madrid, que es la que usa toda la app. Los
// eventos que se repiten llegan ya desplegados (singleEvents), uno por
// repetición.

const ZONA = "Europe/Madrid";

// Los eventos que escribe el propio ERP en Google (ver googleApi.js) llevan
// el id «elsa» + uuid del servicio. Ya se ven en el ERP como servicios: no
// se enseñan otra vez como evento de Google.
export const esEventoDelERP = (id) => /^elsa[0-9a-f]{32}$/i.test(String(id || ""));

// Fecha y hora de Madrid de un instante: { fecha: "2026-10-08", hora: "09:30" }
const enMadrid = (jsDate) => {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(jsDate).map((p) => [p.type, p.value])
  );
  return { fecha: `${partes.year}-${partes.month}-${partes.day}`, hora: `${partes.hour}:${partes.minute}` };
};

const diaAnterior = (iso) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

// Un evento de la API (events.list) a la forma del ERP. null si no se enseña
// (cancelado, o escrito por el propio ERP). calendario: { id, nombre }.
export const eventoDeGoogle = (ev, calendario) => {
  if (!ev || ev.status === "cancelled") return null;
  if (esEventoDelERP(ev.id)) return null;
  const base = {
    // Un mismo evento puede estar en dos calendarios (invitados): el id del
    // calendario lo distingue
    id: `google-${calendario.id}-${ev.id}`,
    externo: "google",
    tipo: "google",
    calendario: calendario.nombre,
    titulo: ev.summary || "(sin título)",
    notas: ev.description || null,
    ubicacion: ev.location || null,
    enlace: ev.htmlLink || null,
  };
  if (ev.start?.date) {
    // Todo el día: en Google el último día es exclusivo
    const fecha = ev.start.date;
    const finIncl = ev.end?.date ? diaAnterior(ev.end.date) : fecha;
    return { ...base, fecha, fecha_fin: finIncl > fecha ? finIncl : null, hora_inicio: null, hora_fin: null, todo_el_dia: true };
  }
  if (!ev.start?.dateTime) return null;
  const a = enMadrid(new Date(ev.start.dateTime));
  const b = ev.end?.dateTime ? enMadrid(new Date(ev.end.dateTime)) : null;
  // Si acaba otro día, en la rejilla se pinta hasta el final del primero
  // y se marca como de varios días
  const mismoDia = !b || b.fecha === a.fecha;
  return {
    ...base,
    fecha: a.fecha,
    fecha_fin: mismoDia ? null : (b.hora === "00:00" ? diaAnterior(b.fecha) : b.fecha),
    hora_inicio: a.hora,
    hora_fin: mismoDia ? (b ? b.hora : null) : "23:59",
    todo_el_dia: false,
  };
};
