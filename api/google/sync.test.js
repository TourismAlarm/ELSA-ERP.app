import { describe, it, expect, vi, beforeAll } from "vitest";

beforeAll(() => {
  process.env.VITE_SUPABASE_URL = "https://db.test";
  process.env.VITE_SUPABASE_ANON_KEY = "anon";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "servicio";
  process.env.GOOGLE_CLIENT_ID = "cid";
  process.env.GOOGLE_CLIENT_SECRET = "secreto";
});

const ID_VIVO = "11111111-1111-4111-8111-111111111111";
const ID_BORRADO = "22222222-2222-4222-8222-222222222222";
const cal = (id) => `https://calendar.google.com/calendar/ical/${encodeURIComponent(id)}/private-abc/basic.ics`;

const res = () => {
  const r = { setHeader() {}, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } };
  return r;
};

const montarFetch = ({ activo = true } = {}) => {
  const google = [];
  vi.stubGlobal("fetch", async (url, o = {}) => {
    const u = String(url);
    const ok = (datos) => ({ ok: true, status: 200, json: async () => datos });
    if (u.endsWith("/auth/v1/user")) return o.headers.Authorization === "Bearer sesion" ? ok({ id: "u1" }) : { ok: false, status: 401 };
    if (u.includes("/rpc/es_usuario_activo")) return ok(activo);
    if (u.includes("/rpc/es_admin")) return ok(false);
    if (u.includes("/rest/v1/google_conexion")) { expect(o.headers.apikey).toBe("servicio"); return ok([{ refresh_token: "rt" }]); }
    if (u.includes("/rest/v1/config")) return ok([{ vehicles: [{ nombre: "24" }, { nombre: "14" }], google_calendarios: [
      { nombre: "General", url: cal("gruaselsa@gmail.com") },
      { nombre: "24", url: cal("c24@group") },
      { nombre: "14", url: cal("c14@group") },
    ] }]);
    if (u.includes("/rest/v1/servicios")) return ok([{ id: ID_VIVO, cliente: "Pérez", vehiculo: "24", fecha_servicio: "2026-10-09", hora_inicio: "09:00:00" }]);
    if (u.startsWith("https://oauth2.googleapis.com/token")) return ok({ access_token: "at", expires_in: 3600 });
    if (u.startsWith("https://www.googleapis.com/calendar/v3/")) {
      const cal = decodeURIComponent(u.split("/calendars/")[1].split("/")[0]);
      google.push(`${o.method} ${cal} ${u.split("/events/")[1] || "(nuevo)"}`);
      return { ok: true, status: o.method === "DELETE" ? 204 : 200, json: async () => ({}) };
    }
    throw new Error("fetch inesperado " + u);
  });
  return google;
};

describe("POST /api/google/sync", () => {
  it("sin sesión de usuario activo, nada", async () => {
    const { default: handler } = await import("./sync.js");
    montarFetch({ activo: false });
    const r = res();
    await handler({ method: "POST", headers: { authorization: "Bearer sesion" }, body: { servicios: [ID_VIVO] } }, r);
    vi.unstubAllGlobals();
    expect(r.code).toBe(401);
  });

  it("el que existe va a su calendario y sale de los demás; el borrado sale de todos", async () => {
    const { default: handler } = await import("./sync.js");
    const google = montarFetch();
    const r = res();
    await handler({ method: "POST", headers: { authorization: "Bearer sesion", host: "app.test" }, body: { servicios: [ID_VIVO, ID_BORRADO, "no-es-uuid"] } }, r);
    vi.unstubAllGlobals();
    expect(r.code).toBe(200);
    expect(r.body.resultados).toEqual([
      { id: ID_VIVO, ok: true, calendarios: ["24"] },
      { id: ID_BORRADO, ok: true, calendarios: [] },
    ]);
    const vivo = "elsa11111111111141118111111111111111";
    const borrado = "elsa22222222222242228222222222222222";
    expect(google.sort()).toEqual([
      `DELETE c14@group ${borrado}`,
      `DELETE c14@group ${vivo}`,
      `DELETE c24@group ${borrado}`,
      `DELETE gruaselsa@gmail.com ${borrado}`,
      `DELETE gruaselsa@gmail.com ${vivo}`,
      `PUT c24@group ${vivo}`,
    ].sort());
  });
});
