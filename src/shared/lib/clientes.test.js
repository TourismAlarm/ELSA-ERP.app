import { describe, it, expect } from "vitest";
import { fichaDelCliente, conDatosDelCliente, buscaCliente } from "./clientes";

const clientes = [
  { id: "1", nombre: "Construcciones Pérez", nifCif: "A1", tel: "600 11 22 33" },
  { id: "2", nombre: "Construcciones Pérez", nifCif: "B2" }, // mismo nombre, otra empresa
];

describe("fichaDelCliente", () => {
  it("usa cliente_id antes que el nombre (hallazgo A3)", () => {
    expect(fichaDelCliente({ cliente: "Construcciones Pérez", cliente_id: "2" }, clientes).nifCif).toBe("B2");
  });
  it("cae al nombre solo en documentos antiguos sin cliente_id", () => {
    expect(fichaDelCliente({ cliente: "Construcciones Pérez" }, clientes).id).toBe("1");
  });
});

describe("conDatosDelCliente", () => {
  it("lo escrito en el documento manda sobre la ficha (hallazgo F1)", () => {
    const doc = conDatosDelCliente({ cliente_id: "1", nifCif: "CORREGIDO" }, clientes);
    expect(doc.nifCif).toBe("CORREGIDO");
  });
  it("si el documento no lo trae, se rellena desde la ficha", () => {
    expect(conDatosDelCliente({ cliente_id: "1" }, clientes).nifCif).toBe("A1");
  });
});

describe("buscaCliente", () => {
  it("encuentra por teléfono escrito de otra manera", () => {
    expect(buscaCliente(clientes[0], "+34600112233".slice(3))).toBe(true);
  });
});
