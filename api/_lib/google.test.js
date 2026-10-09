import { describe, it, expect } from "vitest";
import { eventoDeGoogle, esEventoDelERP } from "./google.js";

const cal = { id: "c24@group", nombre: "24" };

describe("eventoDeGoogle", () => {
  it("con hora: la pasa a Madrid y lleva su calendario", () => {
    const e = eventoDeGoogle({ id: "a1", summary: "Grúa Pérez", location: "Reus", start: { dateTime: "2023-10-16T07:30:00Z" }, end: { dateTime: "2023-10-16T09:30:00Z" } }, cal);
    expect(e).toMatchObject({ id: "google-c24@group-a1", calendario: "24", fecha: "2023-10-16", hora_inicio: "09:30", hora_fin: "11:30", todo_el_dia: false, ubicacion: "Reus", externo: "google" });
  });

  it("con zona propia (hora de Madrid en invierno)", () => {
    const e = eventoDeGoogle({ id: "a2", start: { dateTime: "2026-01-05T08:00:00+01:00" }, end: { dateTime: "2026-01-05T09:00:00+01:00" } }, cal);
    expect(e).toMatchObject({ fecha: "2026-01-05", hora_inicio: "08:00", hora_fin: "09:00", titulo: "(sin título)" });
  });

  it("todo el día, con el último día incluido", () => {
    const e = eventoDeGoogle({ id: "b", summary: "Vacaciones", start: { date: "2024-08-05" }, end: { date: "2024-08-08" } }, cal);
    expect(e).toMatchObject({ fecha: "2024-08-05", fecha_fin: "2024-08-07", todo_el_dia: true, hora_inicio: null });
  });

  it("de un día para otro: se marca como de varios días", () => {
    const e = eventoDeGoogle({ id: "c", start: { dateTime: "2026-03-10T20:00:00+01:00" }, end: { dateTime: "2026-03-11T02:00:00+01:00" } }, cal);
    expect(e).toMatchObject({ fecha: "2026-03-10", fecha_fin: "2026-03-11", hora_inicio: "20:00", hora_fin: "23:59" });
  });

  it("fuera los cancelados y los que escribió el ERP", () => {
    expect(eventoDeGoogle({ id: "d", status: "cancelled", start: { date: "2026-01-01" } }, cal)).toBeNull();
    expect(eventoDeGoogle({ id: "elsa0f8fad5bd9cb469fa16570867728950e", start: { date: "2026-01-01" } }, cal)).toBeNull();
    expect(esEventoDelERP("elsa0f8fad5bd9cb469fa16570867728950e")).toBe(true);
    expect(esEventoDelERP("otro123")).toBe(false);
  });
});
