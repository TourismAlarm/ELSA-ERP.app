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

describe("GET /api/google-calendar", () => {
  it("lee todos los calendarios de la cuenta y dice cuál falla sin perder los demás", async () => {
    const { default: handler } = await import("./google-calendar.js");
    vi.stubGlobal("fetch", async (url, o = {}) => {
      const u = String(url);
      const ok = (d) => ({ ok: true, status: 200, json: async () => d });
      if (u.endsWith("/auth/v1/user")) return ok({ id: "u1" });
      if (u.includes("/rpc/es_usuario_activo")) return ok(true);
      if (u.includes("/rpc/es_admin")) return ok(false);
      if (u.includes("/rest/v1/google_conexion")) return ok([{ refresh_token: "rt" }]);
      if (u.startsWith("https://oauth2.googleapis.com/token")) return ok({ access_token: "at", expires_in: 3600 });
      if (u.includes("/users/me/calendarList")) {
        expect(u).toContain("minAccessRole=writer");
        return ok({ items: [{ id: "c24", summary: "24" }, { id: "roto", summary: "Roto" }] });
      }
      if (u.includes("/calendars/c24/events")) {
        expect(u).toContain("singleEvents=true");
        return ok({ items: [
          { id: "x", summary: "Obra", start: { date: "2025-01-01" }, end: { date: "2025-01-02" } },
          { id: "elsa0f8fad5bd9cb469fa16570867728950e", summary: "Del ERP", start: { date: "2025-01-01" } },
        ] });
      }
      if (u.includes("/calendars/roto/events")) return { ok: false, status: 500, json: async () => ({ error: { message: "Boom" } }) };
      throw new Error("fetch inesperado " + u + o.method);
    });
    const r = res();
    await handler({ headers: { authorization: "Bearer s" } }, r);
    vi.unstubAllGlobals();
    expect(r.code).toBe(200);
    expect(r.body.eventos.map((e) => `${e.calendario}:${e.titulo}`)).toEqual(["24:Obra"]);
    expect(r.body.errores).toEqual([{ calendario: "Roto", error: "Boom" }]);
  });
});
