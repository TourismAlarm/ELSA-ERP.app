// Lee el iCal de un calendario de Google y lo convierte en eventos con la
// misma forma que la tabla `eventos` del ERP (fecha, fecha_fin, hora_inicio,
// hora_fin, todo_el_dia, titulo...), para que el calendario los pinte igual.
//
// Las horas se pasan a la hora de Madrid, que es la que usa toda la app. Los
// eventos que se repiten se despliegan en cada repetición dentro de una
// ventana de fechas; los sueltos se devuelven todos, con el historial entero.

import ICAL from "ical.js";

const ZONA = "Europe/Madrid";
const MAX_REPETICIONES = 2000; // freno por si una regla no termina nunca

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

const isoDeFecha = (t) =>
  `${t.year}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`;

const diaAnterior = (iso) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

// Un intervalo [inicio, fin) de ICAL.Time a la forma del ERP
const aEvento = (ev, inicio, fin, sufijo, prefijo) => {
  const base = {
    id: `google-${prefijo ? `${prefijo}-` : ""}${ev.uid}${sufijo ? `-${sufijo}` : ""}`,
    externo: "google",
    tipo: "google",
    titulo: ev.summary || "(sin título)",
    notas: ev.description || null,
    ubicacion: ev.location || null,
  };
  if (inicio.isDate) {
    // Todo el día: en iCal el último día es exclusivo
    const fecha = isoDeFecha(inicio);
    const finIncl = fin ? diaAnterior(isoDeFecha(fin)) : fecha;
    return { ...base, fecha, fecha_fin: finIncl > fecha ? finIncl : null, hora_inicio: null, hora_fin: null, todo_el_dia: true };
  }
  const a = enMadrid(inicio.toJSDate());
  const b = fin ? enMadrid(fin.toJSDate()) : null;
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

// desde / hasta: Date. Solo afectan a los eventos que se repiten.
// prefijo: distingue los id cuando se juntan varios calendarios (un mismo
// evento al que se invita a dos calendarios trae el mismo UID en los dos).
export const leerGoogleICS = (texto, { desde, hasta, prefijo } = {}) => {
  const comp = new ICAL.Component(ICAL.parse(texto));
  // Registra las zonas horarias que trae el fichero para convertir bien
  comp.getAllSubcomponents("vtimezone").forEach((tz) => ICAL.TimezoneService.register(tz));

  const vevents = comp.getAllSubcomponents("vevent");
  // Las repeticiones modificadas (RECURRENCE-ID) se aplican a su serie
  const excepciones = new Map();
  vevents.forEach((v) => {
    if (v.hasProperty("recurrence-id")) {
      const uid = v.getFirstPropertyValue("uid");
      if (!excepciones.has(uid)) excepciones.set(uid, []);
      excepciones.get(uid).push(v);
    }
  });

  const tDesde = desde ? ICAL.Time.fromJSDate(desde, true) : null;
  const tHasta = hasta ? ICAL.Time.fromJSDate(hasta, true) : null;
  const salida = [];

  vevents.forEach((v) => {
    if (v.hasProperty("recurrence-id")) return; // se procesan con su serie
    if ((v.getFirstPropertyValue("status") || "").toUpperCase() === "CANCELLED") return;
    const ev = new ICAL.Event(v);
    (excepciones.get(ev.uid) || []).forEach((x) => ev.relateException(x));

    if (!ev.isRecurring()) {
      salida.push(aEvento(ev, ev.startDate, ev.endDate, null, prefijo));
      return;
    }

    const it = ev.iterator();
    let n = 0;
    for (let t = it.next(); t && n < MAX_REPETICIONES; t = it.next()) {
      if (tHasta && t.compare(tHasta) > 0) break;
      n++;
      const det = ev.getOccurrenceDetails(t);
      if (tDesde && det.endDate.compare(tDesde) < 0) continue;
      const item = det.item; // la serie o su excepción
      if ((item.component.getFirstPropertyValue("status") || "").toUpperCase() === "CANCELLED") continue;
      salida.push(aEvento(item, det.startDate, det.endDate, isoDeFecha(det.startDate) + (det.startDate.isDate ? "" : `T${det.startDate.hour}${det.startDate.minute}`), prefijo));
    }
  });

  return salida.sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora_inicio || "").localeCompare(b.hora_inicio || ""));
};

// Solo se descargan direcciones iCal de Google: el servidor no debe servir
// para pedir cualquier URL en nombre de quien la escriba
export const urlGoogleValida = (url) => {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "calendar.google.com" && u.pathname.startsWith("/calendar/ical/");
  } catch {
    return false;
  }
};
