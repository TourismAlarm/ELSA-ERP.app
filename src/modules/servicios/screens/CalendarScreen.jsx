import { useState } from "react";
import { Btn } from "../../../shared/components/ui";

const ESTADOS = {
  abierto:   { label: "Abierto",   emoji: "🟠", border: "border-l-amber-400",   badge: "bg-amber-100 text-amber-700" },
  realizado: { label: "Realizado", emoji: "🟢", border: "border-l-emerald-400", badge: "bg-emerald-100 text-emerald-700" },
};

// Formatea una Date local a AAAA-MM-DD sin pasar por UTC (evita saltos de día)
const toISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const hoy = () => toISO(new Date());

const CalendarScreen = ({ servicios, albaranes, onViewServicio, onViewAlbaran, onCrearAlbaran, onConfig }) => {
  const [fecha, setFecha] = useState(hoy());

  const cambiarDia = (delta) => {
    const d = new Date(fecha + "T00:00:00");
    d.setDate(d.getDate() + delta);
    setFecha(toISO(d));
  };

  const delDia = servicios
    .filter((s) => s.fecha_servicio === fecha)
    .sort((a, b) => (a.cliente || "").localeCompare(b.cliente || ""));

  const labelDia = new Date(fecha + "T00:00:00").toLocaleDateString("es-ES", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">

      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <p className="text-xs font-bold tracking-widest text-zinc-400 uppercase mb-1">Servicios del día</p>
          <h1 className="text-3xl font-black text-zinc-900">Calendario</h1>
        </div>
        <Btn variant="ghost" size="sm" onClick={onConfig}>⚙️ Config</Btn>
      </div>

      {/* Selector de fecha */}
      <div className="bg-white border-2 border-zinc-200 rounded-xl p-4 mb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => cambiarDia(-1)}
            className="w-14 h-14 shrink-0 bg-zinc-100 hover:bg-zinc-900 hover:text-white text-zinc-700 rounded-xl text-xl font-black transition-colors"
          >
            ◀
          </button>
          <input
            type="date"
            value={fecha}
            onChange={(e) => e.target.value && setFecha(e.target.value)}
            className="flex-1 border-2 border-zinc-200 rounded-xl px-4 py-3.5 text-base font-bold text-zinc-900 text-center focus:outline-none focus:border-zinc-900 transition-colors bg-white"
          />
          <button
            onClick={() => cambiarDia(1)}
            className="w-14 h-14 shrink-0 bg-zinc-100 hover:bg-zinc-900 hover:text-white text-zinc-700 rounded-xl text-xl font-black transition-colors"
          >
            ▶
          </button>
        </div>
        {fecha !== hoy() && (
          <button
            onClick={() => setFecha(hoy())}
            className="mt-3 w-full text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors"
          >
            Volver a hoy
          </button>
        )}
      </div>

      <p className="text-center text-sm font-bold text-zinc-500 capitalize mb-6">{labelDia}</p>

      {/* Servicios del día */}
      {delDia.length === 0 ? (
        <div className="text-center py-16 text-zinc-400">
          <div className="text-5xl mb-3">📅</div>
          <p className="font-semibold">No hay servicios programados este día</p>
          <p className="text-sm mt-1">Usa las flechas o el selector para ver otros días</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {delDia.map((s) => {
            const estado = s.estado || "abierto";
            const cfg = ESTADOS[estado] || ESTADOS.abierto;
            const albaran = albaranes.find((a) => a.servicio_id === s.id);
            return (
              <div key={s.id} className={`bg-white border-2 border-zinc-200 rounded-xl overflow-hidden hover:border-zinc-400 transition-colors border-l-4 ${cfg.border}`}>
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-xs font-bold text-zinc-400 tracking-widest">{s.numero}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${cfg.badge}`}>{cfg.emoji} {cfg.label}</span>
                    {albaran && (
                      <span className="text-xs font-semibold bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded">📝 {albaran.numero}</span>
                    )}
                  </div>
                  <p className="font-black text-zinc-900 text-lg leading-tight truncate mb-1">{s.cliente || "Sin nombre"}</p>
                  {(s.origen || s.destino) && (
                    <p className="text-xs text-zinc-500 mb-3">📍 {s.origen || "—"}{s.destino ? ` → ${s.destino}` : ""}</p>
                  )}

                  <div className="flex gap-2 flex-wrap">
                    <Btn size="md" className="flex-1" onClick={() => onViewServicio(s)}>👁 Ver servicio</Btn>
                    {albaran ? (
                      <Btn size="md" variant="secondary" className="flex-1" onClick={() => onViewAlbaran(albaran)}>📝 Ver albarán</Btn>
                    ) : (
                      <Btn size="md" variant="secondary" className="flex-1" onClick={() => onCrearAlbaran(s)}>📝 Crear albarán</Btn>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CalendarScreen;
