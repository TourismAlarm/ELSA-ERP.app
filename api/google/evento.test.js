import { describe, it, expect, vi, beforeAll } from "vitest";

beforeAll(() => {
  process.env.VITE_SUPABASE_URL = "https://db.test";
  process.env.VITE_SUPABASE_ANON_KEY = "anon";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "servicio";
  process.env.GOOGLE_CLIENT_ID = "cid";
  process.env.GOOGLE_CLIENT_SECRET = "secreto";
});

const res = () => {
  const r = { setHeader() {}, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } };
  return r;
};

const montar = () => {
  const google = [];
  vi.stubGlobal("fetch", async (url, o = {}) => {
    const u = String(url);
    const ok = (d) => ({ ok: true, status: 200, json: async () => d });
    if (u.endsWith("/auth/v1/user")) return ok({ id: "u1" });
    if (u.includes("/rpc/es_usuario_activo")) return ok(true);
    if (u.includes("/rpc/es_admin")) return ok(false);
    if (u.includes("/rest/v1/google_conexion")) return ok([{ refresh_token: "rt" }]);
    if (u.startsWith("https://oauth2.googleapis.com/token")) return ok({ access_token: "at", expires_in: 3600 });
    if (u.includes("/users/me/calendarList")) return ok({ items: [{ id: "c24", summary: "24" }] });
    if (u.includes("/calendars/c24/events/ev1")) {
      google.push(`${o.method} ${o.body || ""}`);
      if (o.method === "GET") return ok({ id: "ev1", start: { dateTime: "2026-10-09T09:00:00+02:00" }, end: { dateTime: "2026-10-09T10:00:00+02:00" } });
      if (o.method === "PATCH") return ok({ id: "ev1", summary: "Obra", ...JSON.parse(o.body) , start: { dateTime: "2026-10-10T08:00:00+02:00" }, end: { dateTime: "2026-10-10T09:00:00+02:00" } });
      return { ok: true, status: 204, json: async () => ({}) };
    }
    throw new Error("fetch inesperado " + u);
  });
  return google;
};

const pedir = async (body) => {
  const { default: handler } = await import("./evento.js");
  const r = res();
  await handler({ method: "POST", headers: { authorization: "Bearer s" }, body }, r);
  return r;
};

describe("POST /api/google/evento", () => {
  it("mover: lee el evento y lo cambia con el mismo largo", async () => {
    const google = montar();
    const r = await pedir({ accion: "mover", calendarioId: "c24", eventoId: "ev1", fecha: "2026-10-10", hora_inicio: "08:00" });
    vi.unstubAllGlobals();
    expect(r.code).toBe(200);
    expect(google[0]).toBe("GET ");
    expect(JSON.parse(google[1].slice(6))).toEqual({
      start: { dateTime: "2026-10-10T08:00:00", timeZone: "Europe/Madrid" },
      end: { dateTime: "2026-10-10T09:00:00", timeZone: "Europe/Madrid" },
    });
    expect(r.body.evento).toMatchObject({ fecha: "2026-10-10", hora_inicio: "08:00", calendario: "24" });
  });

  it("no toca calendarios ajenos ni los servicios del ERP", async () => {
    montar();
    const ajeno = await pedir({ accion: "borrar", calendarioId: "otro", eventoId: "ev1" });
    const delErp = await pedir({ accion: "borrar", calendarioId: "c24", eventoId: "elsa0f8fad5bd9cb469fa16570867728950e" });
    vi.unstubAllGlobals();
    expect(ajeno.code).toBe(403);
    expect(delErp.code).toBe(400);
  });

  it("borrar", async () => {
    const google = montar();
    const r = await pedir({ accion: "borrar", calendarioId: "c24", eventoId: "ev1" });
    vi.unstubAllGlobals();
    expect(r.code).toBe(200);
    expect(google).toEqual(["DELETE "]);
  });
});
