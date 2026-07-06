// Semáforo de vencimientos (ITV, seguro) comparando contra la fecha de hoy
// del dispositivo. Niveles: ok (> 30 días), pronto (≤ 30 días), vencido, sin fecha.

export const NIVELES = {
  ok:      { emoji: "🟢", chip: "bg-emerald-50 border-emerald-200 text-emerald-700", dot: "bg-emerald-500" },
  pronto:  { emoji: "🟠", chip: "bg-amber-50 border-amber-200 text-amber-700",       dot: "bg-amber-500" },
  vencido: { emoji: "🔴", chip: "bg-red-50 border-red-200 text-red-700",             dot: "bg-red-500" },
  sin:     { emoji: "⚪", chip: "bg-zinc-50 border-zinc-200 text-zinc-500",           dot: "bg-zinc-300" },
};

export const estadoVencimiento = (fecha) => {
  if (!fecha) return { nivel: "sin", dias: null, texto: "Sin fecha" };
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const dias = Math.round((new Date(fecha + "T00:00:00") - hoy) / 86400000);
  if (dias < 0) {
    const d = -dias;
    return { nivel: "vencido", dias, texto: `Vencido hace ${d} día${d !== 1 ? "s" : ""}` };
  }
  if (dias === 0) return { nivel: "pronto", dias, texto: "Vence hoy" };
  const texto = `Falta${dias !== 1 ? "n" : ""} ${dias} día${dias !== 1 ? "s" : ""}`;
  return { nivel: dias <= 30 ? "pronto" : "ok", dias, texto };
};

export const formatFecha = (f) =>
  f ? new Date(f + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
