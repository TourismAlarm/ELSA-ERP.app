// Genera el fichero iCal (RFC 5545) con los servicios y eventos del ERP, el
// que Google Calendar se suscribe con «Añadir calendario → Desde URL».
//
// Las horas de la app son de Madrid sin zona («09:00»), así que se escriben
// con TZID=Europe/Madrid y la definición de esa zona va dentro del fichero:
// así Google las coloca bien también en el cambio de hora.

const TZID = "Europe/Madrid";

const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  `TZID:${TZID}`,
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

// Texto de una propiedad: \ ; , y saltos de línea se escapan
export const escapar = (t) =>
  String(t ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");

// Las líneas no pueden pasar de 75 octetos: se parten y la continuación
// empieza por un espacio. Se cuenta en bytes UTF-8 y sin partir un carácter
// (los emojis y las tildes ocupan varios).
export const plegar = (linea) => {
  const enc = new TextEncoder();
  if (enc.encode(linea).length <= 75) return linea;
  const partes = [];
  let actual = "";
  let bytes = 0;
  for (const ch of linea) {
    const n = enc.encode(ch).length;
    const max = partes.length === 0 ? 75 : 74; // la continuación lleva el espacio
    if (bytes + n > max) {
      partes.push(actual);
      actual = "";
      bytes = 0;
    }
    actual += ch;
    bytes += n;
  }
  partes.push(actual);
  return partes.join("\r\n ");
};

const fechaICS = (iso) => iso.replace(/-/g, "");                       // 2026-10-08 -> 20261008
const horaICS = (h) => h.slice(0, 5).replace(":", "") + "00";           // 09:30:00 -> 093000

const diaSiguiente = (iso) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

const sellar = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); // 20261008T101500Z

const sumarUnaHora = (h) => {
  const [hh, mm] = h.split(":").map(Number);
  const t = Math.min(hh * 60 + mm + 60, 23 * 60 + 59);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

// Inicio y fin de un VEVENT. Con hora, en la zona de Madrid (sin fin: una
// hora; fin anterior al inicio: también una hora). Sin hora, de todo el día;
// en iCal el último día es exclusivo, así que se suma uno.
const tiempos = ({ fecha, fecha_fin, hora_inicio, hora_fin, todo_el_dia }) => {
  if (hora_inicio && !todo_el_dia) {
    const fin = hora_fin && hora_fin.slice(0, 5) > hora_inicio.slice(0, 5) ? hora_fin : sumarUnaHora(hora_inicio);
    return [
      `DTSTART;TZID=${TZID}:${fechaICS(fecha)}T${horaICS(hora_inicio)}`,
      `DTEND;TZID=${TZID}:${fechaICS(fecha)}T${horaICS(fin)}`,
    ];
  }
  const ultimo = fecha_fin && fecha_fin > fecha ? fecha_fin : fecha;
  return [
    `DTSTART;VALUE=DATE:${fechaICS(fecha)}`,
    `DTEND;VALUE=DATE:${fechaICS(diaSiguiente(ultimo))}`,
  ];
};

const vehiculosDe = (v) => (Array.isArray(v) ? v : String(v || "").split(",")).map((x) => x.trim()).filter(Boolean);

export const veventServicio = (s, ahora) => {
  const camiones = vehiculosDe(s.vehiculo);
  const titulo = [
    (s.estado || "abierto") === "realizado" ? "✓" : null,
    `🚛 ${camiones.length ? camiones.join(", ") : "Sin camión"}`,
    "·",
    s.cliente || "Sin nombre",
  ].filter(Boolean).join(" ");
  const ruta = [s.origen, s.destino].filter(Boolean).join(" → ");
  const descripcion = [s.numero ? `Servicio ${s.numero}` : null, ruta || null, s.descripcion || null]
    .filter(Boolean).join("\n");
  return [
    "BEGIN:VEVENT",
    `UID:servicio-${s.id}@elsa-erp`,
    `DTSTAMP:${sellar(ahora)}`,
    ...(s.updated_at ? [`LAST-MODIFIED:${sellar(new Date(s.updated_at))}`] : []),
    ...tiempos(s),
    `SUMMARY:${escapar(titulo)}`,
    ...(descripcion ? [`DESCRIPTION:${escapar(descripcion)}`] : []),
    ...(s.origen ? [`LOCATION:${escapar(s.origen)}`] : []),
    "END:VEVENT",
  ];
};

export const veventEvento = (e, ahora) => [
  "BEGIN:VEVENT",
  `UID:evento-${e.id}@elsa-erp`,
  `DTSTAMP:${sellar(ahora)}`,
  ...(e.updated_at ? [`LAST-MODIFIED:${sellar(new Date(e.updated_at))}`] : []),
  ...tiempos(e),
  `SUMMARY:${escapar(e.titulo || "Evento")}`,
  ...(e.notas ? [`DESCRIPTION:${escapar(e.notas)}`] : []),
  "END:VEVENT",
];

export const generarICS = ({ servicios = [], eventos = [] }, { nombre = "ELSA ERP", ahora = new Date() } = {}) => {
  const lineas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ELSA ERP//Calendario//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapar(nombre)}`,
    `X-WR-TIMEZONE:${TZID}`,
    // Pista para los clientes que la respetan; Google decide su propio ritmo
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    ...VTIMEZONE,
    ...servicios.filter((s) => s.fecha).flatMap((s) => veventServicio(s, ahora)),
    ...eventos.filter((e) => e.fecha).flatMap((e) => veventEvento(e, ahora)),
    "END:VCALENDAR",
  ];
  return lineas.map(plegar).join("\r\n") + "\r\n";
};
