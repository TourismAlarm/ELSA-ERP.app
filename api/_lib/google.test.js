import { describe, it, expect } from "vitest";
import { leerGoogleICS, urlGoogleValida } from "./google.js";

const ICS = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//Google Inc//Google Calendar 70.9054//EN",
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Madrid",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
  // Con hora, en UTC: 07:30Z en octubre es 09:30 en Madrid
  "BEGIN:VEVENT",
  "UID:uno@google.com",
  "DTSTART:20231016T073000Z",
  "DTEND:20231016T093000Z",
  "SUMMARY:Grúa Pérez\\, Reus",
  "LOCATION:Reus",
  "END:VEVENT",
  // Todo el día, tres días
  "BEGIN:VEVENT",
  "UID:dos@google.com",
  "DTSTART;VALUE=DATE:20240805",
  "DTEND;VALUE=DATE:20240808",
  "SUMMARY:Vacaciones",
  "END:VEVENT",
  // Cancelado: no sale
  "BEGIN:VEVENT",
  "UID:tres@google.com",
  "DTSTART:20240101T100000Z",
  "DTEND:20240101T110000Z",
  "STATUS:CANCELLED",
  "SUMMARY:No",
  "END:VEVENT",
  // Semanal con zona, 3 veces; la segunda se movió a las 11:00
  "BEGIN:VEVENT",
  "UID:serie@google.com",
  "DTSTART;TZID=Europe/Madrid:20260105T080000",
  "DTEND;TZID=Europe/Madrid:20260105T090000",
  "RRULE:FREQ=WEEKLY;COUNT=3",
  "SUMMARY:Revisión semanal",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:serie@google.com",
  "RECURRENCE-ID;TZID=Europe/Madrid:20260112T080000",
  "DTSTART;TZID=Europe/Madrid:20260112T110000",
  "DTEND;TZID=Europe/Madrid:20260112T120000",
  "SUMMARY:Revisión semanal (movida)",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

describe("leerGoogleICS", () => {
  const eventos = leerGoogleICS(ICS, { desde: new Date("2020-01-01"), hasta: new Date("2030-01-01") });

  it("pasa las horas a Madrid", () => {
    const e = eventos.find((x) => x.titulo === "Grúa Pérez, Reus");
    expect(e).toMatchObject({ fecha: "2023-10-16", hora_inicio: "09:30", hora_fin: "11:30", todo_el_dia: false, ubicacion: "Reus", externo: "google" });
  });

  it("todo el día con el último día incluido", () => {
    const e = eventos.find((x) => x.titulo === "Vacaciones");
    expect(e).toMatchObject({ fecha: "2024-08-05", fecha_fin: "2024-08-07", todo_el_dia: true, hora_inicio: null });
  });

  it("descarta los cancelados", () => {
    expect(eventos.some((x) => x.titulo === "No")).toBe(false);
  });

  it("despliega las repeticiones y aplica la que se movió", () => {
    const serie = eventos.filter((x) => x.titulo.startsWith("Revisión semanal"));
    expect(serie.map((x) => `${x.fecha} ${x.hora_inicio}`)).toEqual(["2026-01-05 08:00", "2026-01-12 11:00", "2026-01-19 08:00"]);
    expect(new Set(serie.map((x) => x.id)).size).toBe(3);
  });
});

describe("urlGoogleValida", () => {
  it("solo direcciones iCal de Google por https", () => {
    expect(urlGoogleValida("https://calendar.google.com/calendar/ical/x%40gmail.com/private-abc/basic.ics")).toBe(true);
    expect(urlGoogleValida("http://calendar.google.com/calendar/ical/x/basic.ics")).toBe(false);
    expect(urlGoogleValida("https://evil.com/calendar/ical/x/basic.ics")).toBe(false);
    expect(urlGoogleValida("https://calendar.google.com.evil.com/calendar/ical/x")).toBe(false);
    expect(urlGoogleValida("no es una url")).toBe(false);
  });
});

describe("eventos escritos por el ERP", () => {
  it("no se leen otra vez desde Google", () => {
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0",
      "BEGIN:VEVENT", "UID:elsa0f8fad5bd9cb469fa16570867728950e@google.com", "DTSTART;VALUE=DATE:20261009", "SUMMARY:Del ERP", "END:VEVENT",
      "BEGIN:VEVENT", "UID:otro@google.com", "DTSTART;VALUE=DATE:20261009", "SUMMARY:De Google", "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    expect(leerGoogleICS(ics).map((e) => e.titulo)).toEqual(["De Google"]);
  });
});
