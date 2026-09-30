import { describe, it, expect } from "vitest";
import { conHorasValidas } from "./horas";

describe("conHorasValidas", () => {
  it("respeta un rango válido", () => {
    expect(conHorasValidas({ hora_inicio: "08:00", hora_fin: "11:00" })).toMatchObject({ hora_inicio: "08:00", hora_fin: "11:00" });
  });
  it("corrige un fin anterior al inicio", () => {
    const r = conHorasValidas({ hora_inicio: "10:00", hora_fin: "09:00" });
    expect(r.hora_inicio).toBe("10:00");
    expect(r.hora_fin > r.hora_inicio).toBe(true);
  });
  it("recorta los segundos que devuelve la base de datos", () => {
    expect(conHorasValidas({ hora_inicio: "08:00:00", hora_fin: "10:00:00" })).toMatchObject({ hora_inicio: "08:00", hora_fin: "10:00" });
  });
});
