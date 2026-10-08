import { describe, it, expect } from "vitest";
import { conVehiculo } from "./vehiculoGoogle";

describe("conVehiculo", () => {
  it("da el color y el vehículo cuando el calendario se llama como él", () => {
    const evs = conVehiculo(
      [{ id: 1, calendario: "24 + JIB" }, { id: 2, calendario: "14" }, { id: 3, calendario: "General" }],
      { "24+JIB": "#f00", "14": "#0f0" }
    );
    expect(evs[0]).toMatchObject({ vehiculo: "24+JIB", color: "#f00" });
    expect(evs[1]).toMatchObject({ vehiculo: "14", color: "#0f0" });
    expect(evs[2].vehiculo).toBeUndefined();
  });
});
