import { describe, it, expect, vi } from "vitest";
import handler, { calendariosDe } from "./google-calendar.js";

describe("calendariosDe", () => {
  it("usa la lista y descarta los que no tienen dirección", () => {
    expect(calendariosDe({ google_calendarios: [{ nombre: " 14 ", url: " https://a " }, { nombre: "19", url: "" }] }))
      .toEqual([{ nombre: "14", url: "https://a" }]);
  });
  it("sin lista, la dirección única de antes", () => {
    expect(calendariosDe({ google_calendarios: [], google_ics_url: "https://b" })).toEqual([{ nombre: "Google", url: "https://b" }]);
  });
  it("sin nada, ninguno", () => {
    expect(calendariosDe({})).toEqual([]);
  });
});

const ics = (uid, titulo) =>
  `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:${uid}\r\nDTSTART;VALUE=DATE:20250101\r\nDTEND;VALUE=DATE:20250102\r\nSUMMARY:${titulo}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
const url = (n) => `https://calendar.google.com/calendar/ical/${n}%40group.calendar.google.com/private-x/basic.ics`;
const res = () => {
  const r = { setHeader() {}, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } };
  return r;
};

describe("handler con varios calendarios", () => {
  it("junta todos, marca su calendario y dice cuál falla sin perder los demás", async () => {
    vi.stubGlobal("fetch", async (u) => {
      if (u.includes("/rest/v1/config")) {
        return { ok: true, status: 200, json: async () => [{ google_calendarios: [
          { nombre: "14", url: url("c14") },
          { nombre: "19", url: url("c19") },
          { nombre: "Roto", url: url("roto") },
          { nombre: "Pública", url: "https://evil.com/calendar/ical/x" },
        ] }] };
      }
      if (u.includes("roto")) return { ok: false, status: 404 };
      // El mismo evento invitado a dos calendarios trae el mismo UID
      return { ok: true, status: 200, text: async () => ics("mismo@google.com", u.includes("c14") ? "Obra A" : "Obra B") };
    });
    const r = res();
    await handler({ headers: { authorization: "Bearer s" } }, r);
    vi.unstubAllGlobals();
    expect(r.code).toBe(200);
    expect(r.body.eventos.map((e) => `${e.calendario}:${e.titulo}`).sort()).toEqual(["14:Obra A", "19:Obra B"]);
    expect(new Set(r.body.eventos.map((e) => e.id)).size).toBe(2);
    expect(r.body.errores.map((e) => e.calendario)).toEqual(["Roto", "Pública"]);
  });
});
