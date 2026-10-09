import { describe, it, expect, vi, beforeAll } from "vitest";

beforeAll(() => {
  process.env.GOOGLE_CLIENT_ID = "cid";
  process.env.GOOGLE_CLIENT_SECRET = "secreto";
});

const cargar = async () => import("./googleApi.js");

describe("state firmado", () => {
  it("vale el bueno y caduca a los 15 minutos", async () => {
    const { crearState, leerState } = await cargar();
    const t = 1_000_000;
    const s = crearState("u-1", t);
    expect(leerState(s, t + 60_000)).toBe("u-1");
    expect(leerState(s, t + 16 * 60_000)).toBeNull();
  });
  it("no vale uno manipulado", async () => {
    const { crearState, leerState } = await cargar();
    const s = crearState("u-1", 5);
    expect(leerState(s.replace("u-1", "u-2"), 10)).toBeNull();
    expect(leerState("basura", 10)).toBeNull();
  });
});

describe("calendarios y eventos", () => {
  const calendarios = [
    { id: "gruaselsa@gmail.com", nombre: "Grues Elsa", primario: true },
    { id: "c24@group", nombre: "24" },
    { id: "c24jib@group", nombre: "24 + JIB" },
    { id: "c14@group", nombre: "14" },
  ];

  it("cada vehículo a su calendario; sin calendario propio o sin vehículo, al principal", async () => {
    const { calendariosDestino } = await cargar();
    const nombres = (s) => calendariosDestino(s, calendarios).map((c) => c.nombre);
    expect(nombres({ vehiculo: "24, 14" })).toEqual(["24", "14"]);
    expect(nombres({ vehiculo: "24+JIB" })).toEqual(["24 + JIB"]);
    expect(nombres({ vehiculo: "19" })).toEqual(["Grues Elsa"]);
    expect(nombres({ vehiculo: "" })).toEqual(["Grues Elsa"]);
  });

  it("id de evento fijo por servicio, válido para Google", async () => {
    const { idEventoServicio } = await cargar();
    const id = idEventoServicio("0F8FAD5B-D9CB-469F-A165-70867728950E");
    expect(id).toBe("elsa0f8fad5bd9cb469fa16570867728950e");
    expect(/^[0-9a-v]{5,1024}$/.test(id)).toBe(true);
  });

  it("servicio con hora y sin hora", async () => {
    const { eventoDeServicio } = await cargar();
    const con = eventoDeServicio({ id: "a", cliente: "Pérez", fecha_servicio: "2026-10-09", hora_inicio: "08:30:00", vehiculo: "24", estado: "realizado" });
    expect(con.summary).toBe("✓ Pérez");
    expect(con.start).toEqual({ dateTime: "2026-10-09T08:30:00", timeZone: "Europe/Madrid" });
    expect(con.end).toEqual({ dateTime: "2026-10-09T09:30:00", timeZone: "Europe/Madrid" });
    const sin = eventoDeServicio({ id: "b", fecha_servicio: "2026-12-31" });
    expect(sin.start).toEqual({ date: "2026-12-31" });
    expect(sin.end).toEqual({ date: "2027-01-01" });
  });
});

describe("escribirEvento", () => {
  it("si no existe, lo crea", async () => {
    const { escribirEvento } = await cargar();
    const llamadas = [];
    vi.stubGlobal("fetch", async (url, o) => {
      llamadas.push(o.method);
      return { ok: o.method === "POST", status: o.method === "PUT" ? 404 : 200, json: async () => ({}) };
    });
    await escribirEvento("t", "c@x", { id: "elsa1" });
    vi.unstubAllGlobals();
    expect(llamadas).toEqual(["PUT", "POST"]);
  });
  it("si Google no deja, da un error claro", async () => {
    const { escribirEvento } = await cargar();
    vi.stubGlobal("fetch", async () => ({ ok: false, status: 403, json: async () => ({ error: { message: "Forbidden" } }) }));
    await expect(escribirEvento("t", "c@x", { id: "elsa1" })).rejects.toThrow(/Forbidden.*permiso/);
    vi.unstubAllGlobals();
  });
});
