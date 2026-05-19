export const today = () =>
  new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
