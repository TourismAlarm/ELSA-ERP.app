import { describe, it, expect } from "vitest";
import { repartirTituloGoogle } from "./repartirGoogle";

const clientes = [
  { id: "c1", nombre: "CONSTRUCCIONES PÉREZ SL", nombre_comercial: "Pérez Obras", tel: "977 11 22 33" },
  { id: "c2", nombre: "Transports Vidal", tel: "", movil: "+34 655 44 33 22" },
  { id: "c3", nombre: "Pérez" },
];

describe("repartirTituloGoogle", () => {
  it("cliente de la lista por su nombre comercial, contacto y teléfono aparte", () => {
    const r = repartirTituloGoogle("Pérez Obras - Joan 600 11 22 33 - descargar vigas", "Llevar eslingas", clientes);
    expect(r).toMatchObject({
      cliente: "CONSTRUCCIONES PÉREZ SL",
      cliente_id: "c1",
      telCliente: "600 11 22 33",
      descripcion: "Joan · descargar vigas\nLlevar eslingas",
    });
  });

  it("el nombre más largo gana (no confunde «Pérez» con «Construcciones Pérez SL»)", () => {
    expect(repartirTituloGoogle("Construcciones Pérez SL / muro", "", clientes).cliente_id).toBe("c1");
    expect(repartirTituloGoogle("Pérez, muro", "", clientes).cliente_id).toBe("c3");
  });

  it("si no sale el nombre, lo reconoce por el teléfono", () => {
    const r = repartirTituloGoogle("Vidal grúa 655443322 nave Reus", "", clientes);
    expect(r).toMatchObject({ cliente: "Transports Vidal", cliente_id: "c2", telCliente: "655443322" });
    expect(r.descripcion).toBe("Vidal grúa nave Reus");
  });

  it("cliente desconocido: el primer trozo, y el email a su sitio", () => {
    const r = repartirTituloGoogle("Fusteria Roig – Marta marta@roig.cat – pujar finestres", "", clientes);
    expect(r).toMatchObject({ cliente: "Fusteria Roig", cliente_id: null, emailCliente: "marta@roig.cat", descripcion: "Marta · pujar finestres" });
  });

  it("varios teléfonos: el primero al campo, los demás a la descripción", () => {
    const r = repartirTituloGoogle("Obra nova: tel 666111222 / 977654321", "", []);
    expect(r).toMatchObject({ cliente: "Obra nova", telCliente: "666111222" });
    expect(r.descripcion).toBe("Tel. 977654321");
  });

  it("sin título", () => {
    expect(repartirTituloGoogle("(sin título)", "notas", clientes)).toMatchObject({ cliente: "", descripcion: "notas" });
  });
});
