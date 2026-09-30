import { describe, it, expect } from "vitest";
import { estadoDeca, estadoDecaServicio } from "./estado";

const anul = (id, creado_en, cuando) => ({ id, creado_en, anulado: true, modificaciones: [{ accion: "anulacion", cuando, motivo: "x" }] });
const vig = (id, creado_en) => ({ id, creado_en, anulado: false, modificaciones: [] });

describe("estadoDecaServicio", () => {
  it("sin DeCA", () => expect(estadoDecaServicio([])).toBe("sin_deca"));
  it("emitido", () => expect(estadoDecaServicio([vig("a", "2026-10-05T08:00:00Z")])).toBe("emitido"));
  it("anulado si no queda ninguno vigente", () => {
    expect(estadoDecaServicio([anul("a", "2026-10-05T08:00:00Z", "2026-10-05T09:00:00Z")])).toBe("anulado");
  });
  it("emitido si se sustituyó", () => {
    expect(estadoDecaServicio([vig("b", "2026-10-05T10:00:00Z"), anul("a", "2026-10-05T08:00:00Z", "2026-10-05T09:00:00Z")])).toBe("emitido");
  });
});

describe("estadoDeca", () => {
  const a = anul("a", "2026-10-05T08:00:00Z", "2026-10-05T09:00:00Z");
  it("vigente = emitido", () => expect(estadoDeca(vig("v", "2026-10-05T08:00:00Z"), [])).toBe("emitido"));
  it("anulado sin otro posterior", () => expect(estadoDeca(a, [a])).toBe("anulado"));
  it("sustituido: otro emitido después de anular", () => {
    expect(estadoDeca(a, [a, vig("b", "2026-10-05T10:00:00Z")])).toBe("sustituido");
  });
  it("otro emitido ANTES de anular no cuenta como sustituto", () => {
    expect(estadoDeca(a, [a, vig("b", "2026-10-05T08:30:00Z")])).toBe("anulado");
  });
  it("cadena: el primero sustituido, el último anulado", () => {
    const b = anul("b", "2026-10-05T10:00:00Z", "2026-10-05T11:00:00Z");
    expect(estadoDeca(a, [a, b])).toBe("sustituido");
    expect(estadoDeca(b, [a, b])).toBe("anulado");
  });
});
