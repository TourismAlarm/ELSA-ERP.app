import { describe, it, expect } from "vitest";
import { generarICS, escapar, plegar } from "./ics.js";

const ahora = new Date("2026-10-08T10:15:00Z");

describe("generarICS", () => {
  it("servicio con hora: zona de Madrid, título con camión y cliente", () => {
    const ics = generarICS({
      servicios: [{ id: "a1", numero: "SRV-012", cliente: "García, S.L.", vehiculo: "Camión 1, Grúa 24", fecha: "2026-10-09", hora_inicio: "08:30:00", hora_fin: "12:00:00", origen: "Reus", destino: "Valls", estado: "abierto" }],
    }, { ahora });
    expect(ics).toContain("UID:servicio-a1@elsa-erp");
    expect(ics).toContain("DTSTART;TZID=Europe/Madrid:20261009T083000");
    expect(ics).toContain("DTEND;TZID=Europe/Madrid:20261009T120000");
    expect(ics).toContain("SUMMARY:🚛 Camión 1\\, Grúa 24 · García\\, S.L.");
    expect(ics).toContain("LOCATION:Reus");
    expect(ics).toContain("BEGIN:VTIMEZONE");
    expect(ics.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
  });

  it("servicio sin hora: todo el día, con el fin exclusivo", () => {
    const ics = generarICS({ servicios: [{ id: "b", cliente: "X", fecha: "2026-12-31", estado: "realizado" }] }, { ahora });
    expect(ics).toContain("DTSTART;VALUE=DATE:20261231");
    expect(ics).toContain("DTEND;VALUE=DATE:20270101");
    expect(ics).toContain("SUMMARY:✓ 🚛 Sin camión · X");
  });

  it("sin hora de fin, o fin antes del inicio: una hora", () => {
    const ics = generarICS({ servicios: [
      { id: "c", fecha: "2026-10-09", hora_inicio: "09:00" },
      { id: "d", fecha: "2026-10-09", hora_inicio: "10:00", hora_fin: "09:00" },
    ] }, { ahora });
    expect(ics).toContain("DTEND;TZID=Europe/Madrid:20261009T100000");
    expect(ics).toContain("DTEND;TZID=Europe/Madrid:20261009T110000");
  });

  it("evento de varios días", () => {
    const ics = generarICS({ eventos: [{ id: "e", titulo: "Vacaciones", fecha: "2026-08-01", fecha_fin: "2026-08-15", todo_el_dia: true }] }, { ahora });
    expect(ics).toContain("UID:evento-e@elsa-erp");
    expect(ics).toContain("DTSTART;VALUE=DATE:20260801");
    expect(ics).toContain("DTEND;VALUE=DATE:20260816");
  });
});

describe("escapar y plegar", () => {
  it("escapa los caracteres especiales", () => {
    expect(escapar("a;b,c\\d\ne")).toBe("a\\;b\\,c\\\\d\\ne");
  });
  it("parte las líneas largas sin romper caracteres", () => {
    const larga = "DESCRIPTION:" + "ñ🚛".repeat(40);
    const plegada = plegar(larga);
    const lineas = plegada.split("\r\n");
    expect(lineas.length).toBeGreaterThan(1);
    lineas.forEach((l) => expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75));
    expect(lineas.map((l, i) => (i ? l.slice(1) : l)).join("")).toBe(larga);
  });
});
