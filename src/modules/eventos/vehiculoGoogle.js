// Cada evento de Google lleva el nombre de su calendario. Si coincide con un
// vehículo (sin distinguir mayúsculas ni espacios), toma su color y queda
// marcado con ese vehículo, para que cuente como camión ocupado ese día.
// coloresVehiculo: { nombreVehiculo: color }
const clave = (t) => String(t || "").trim().toLowerCase().replace(/\s+/g, "");
export const conVehiculo = (eventos, coloresVehiculo = {}) => {
  const porClave = Object.fromEntries(Object.keys(coloresVehiculo).map((n) => [clave(n), n]));
  return eventos.map((e) => {
    const vehiculo = porClave[clave(e.calendario)];
    return vehiculo ? { ...e, vehiculo, color: coloresVehiculo[vehiculo] } : e;
  });
};
