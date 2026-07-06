// Paleta de ~10 colores bien diferenciados, estilo Google Calendar
export const PALETA = [
  "#3b82f6", // azul
  "#22c55e", // verde
  "#ef4444", // rojo
  "#f97316", // naranja
  "#eab308", // amarillo
  "#a855f7", // violeta
  "#ec4899", // rosa
  "#14b8a6", // turquesa
  "#6366f1", // índigo
  "#78716c", // gris piedra
];

// Devuelve un color de texto legible (negro o blanco) sobre un fondo hex,
// según su luminancia percibida.
export const textoSobre = (hex) => {
  if (!hex) return "#18181b";
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return "#18181b";
  const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminancia > 0.6 ? "#18181b" : "#ffffff";
};
