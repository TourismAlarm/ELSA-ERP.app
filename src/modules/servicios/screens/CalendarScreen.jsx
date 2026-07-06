import { useState } from "react";
import { Btn } from "../../../shared/components/ui";
import { textoSobre } from "../../../shared/lib/color";

// Devuelve el primer vehículo/equipo del servicio (para el color del calendario)
const primerVehiculo = (s) => {
  const arr = Array.isArray(s.vehiculo) ? s.vehiculo : (s.vehiculo ? [s.vehiculo] : []);
  return arr[0] || null;
};

const ESTADOS = {
  abierto:   { label: "Abierto",   emoji: "🟠", border: "border-l-amber-400",   badge: "bg-amber-100 text-amber-700" },
  realizado: { label: "Realizado", emoji: "🟢", border: "border-l-emerald-400", badge: "bg-emerald-100 text-emerald-700" },
};

const DIAS_SEMANA = ["L", "M", "X", "J", "V", "S", "D"];

// Formatea una Date local a AAAA-MM-DD sin pasar por UTC (evita saltos de día)
const toISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const hoy = () => toISO(new Date());

const CalendarScreen = ({ servicios, albaranes, coloresVehiculo = {}, onViewServicio, onViewAlbaran, onCrearAlbaran, onConfig }) => {
  // Estilo de la etiqueta de un servicio: color de su vehículo/equipo si lo
  // tiene, si no, el color por estado (ámbar abierto / verde realizado)
  const estiloEvento = (s) => {
    const color = coloresVehiculo[primerVehiculo(s)];
    if (color) {
      return { style: { backgroundColor: color, color: textoSobre(color) }, className: "" };
    }
    return {
      style: {},
      className: (s.estado || "abierto") === "abierto" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800",
    };
  };

  const [fecha, setFecha] = useState(hoy());
  const [mes, setMes] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const cambiarMes = (delta) => {
    const d = new Date(mes.year, mes.month + delta, 1);
    setMes({ year: d.getFullYear(), month: d.getMonth() });
  };

  const volverHoy = () => {
    const d = new Date();
    setFecha(hoy());
    setMes({ year: d.getFullYear(), month: d.getMonth() });
  };

  // Servicios agrupados por fecha
  const porDia = {};
  servicios.forEach((s) => {
    if (s.fecha_servicio) (porDia[s.fecha_servicio] = porDia[s.fecha_servicio] || []).push(s);
  });

  // Rejilla del mes visible (semana empieza en lunes)
  const primerDia = new Date(mes.year, mes.month, 1);
  const offset = (primerDia.getDay() + 6) % 7;
  const diasEnMes = new Date(mes.year, mes.month + 1, 0).getDate();
  const celdas = [
    ...Array(offset).fill(null),
    ...Array.from({ length: diasEnMes }, (_, i) => i + 1),
  ];

  const labelMes = primerDia.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  const labelDia = new Date(fecha + "T00:00:00").toLocaleDateString("es-ES", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const delDia = (porDia[fecha] || [])
    .slice()
    .sort((a, b) => (a.cliente || "").localeCompare(b.cliente || ""));

  const esMesActual = (() => { const d = new Date(); return mes.year === d.getFullYear() && mes.month === d.getMonth(); })();

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">

      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <p className="text-xs font-bold tracking-widest text-zinc-400 uppercase mb-1">Servicios del mes</p>
          <h1 className="text-3xl font-black text-zinc-900">Calendario</h1>
        </div>
        <Btn variant="ghost" size="sm" onClick={onConfig}>⚙️ Config</Btn>
      </div>

      {/* Vista mensual */}
      <div className="bg-white border-2 border-zinc-200 rounded-xl p-4 mb-6">
        {/* Navegación de mes */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <button
            onClick={() => cambiarMes(-1)}
            className="w-12 h-12 shrink-0 bg-zinc-100 hover:bg-zinc-900 hover:text-white text-zinc-700 rounded-xl text-lg font-black transition-colors"
          >
            ◀
          </button>
          <p className="text-lg font-black text-zinc-900 capitalize text-center flex-1">{labelMes}</p>
          <button
            onClick={() => cambiarMes(1)}
            className="w-12 h-12 shrink-0 bg-zinc-100 hover:bg-zinc-900 hover:text-white text-zinc-700 rounded-xl text-lg font-black transition-colors"
          >
            ▶
          </button>
        </div>

        {/* Cabecera de días de la semana */}
        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {DIAS_SEMANA.map((d) => (
            <div key={d} className="text-center text-xs font-black text-zinc-400 py-1">{d}</div>
          ))}
        </div>

        {/* Rejilla de días (estilo agenda: cada día muestra sus servicios) */}
        <div className="grid grid-cols-7 gap-1">
          {celdas.map((dia, i) => {
            if (dia === null) return <div key={`vacio-${i}`} />;
            const iso = toISO(new Date(mes.year, mes.month, dia));
            const svs = (porDia[iso] || [])
              .slice()
              .sort((a, b) => (a.cliente || "").localeCompare(b.cliente || ""));
            const esHoy = iso === hoy();
            const seleccionado = iso === fecha;
            const visibles = svs.slice(0, 3);
            const extra = svs.length - visibles.length;
            return (
              <button
                key={iso}
                onClick={() => setFecha(iso)}
                className={`min-h-[72px] rounded-lg border-2 flex flex-col items-stretch gap-0.5 p-1 text-left transition-colors ${
                  seleccionado
                    ? "bg-zinc-50 border-zinc-900 ring-1 ring-zinc-900"
                    : "bg-white border-zinc-200 hover:border-zinc-400"
                }`}
              >
                <span className={`self-center text-xs font-black leading-none rounded-full w-5 h-5 flex items-center justify-center ${
                  esHoy ? "bg-zinc-900 text-white" : "text-zinc-700"
                }`}>
                  {dia}
                </span>
                {visibles.map((s) => {
                  const ev = estiloEvento(s);
                  const hecho = (s.estado || "abierto") === "realizado";
                  return (
                    <span
                      key={s.id}
                      style={ev.style}
                      className={`block w-full truncate rounded px-1 py-0.5 text-[9px] font-bold leading-tight ${ev.className}`}
                    >
                      {hecho ? "✓ " : ""}{s.cliente || "Sin nombre"}
                    </span>
                  );
                })}
                {extra > 0 && (
                  <span className="block w-full truncate px-1 text-[9px] font-black text-zinc-500 leading-tight">
                    +{extra} más
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Leyenda */}
        <div className="flex items-center justify-center gap-x-4 gap-y-1.5 mt-3 flex-wrap">
          {Object.keys(coloresVehiculo).length > 0 ? (
            <>
              {Object.entries(coloresVehiculo).map(([nombre, color]) => (
                <span key={nombre} className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600">
                  <span className="w-3 h-3 rounded" style={{ backgroundColor: color }} /> {nombre}
                </span>
              ))}
              <span className="text-xs font-semibold text-zinc-500">✓ = realizado</span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
                <span className="w-3 h-3 rounded bg-amber-100 border border-amber-300" /> Abierto
              </span>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
                <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300" /> Realizado
              </span>
            </>
          )}
        </div>

        {(!esMesActual || fecha !== hoy()) && (
          <button
            onClick={volverHoy}
            className="mt-4 w-full text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors"
          >
            Volver a hoy
          </button>
        )}
      </div>

      {/* Día seleccionado */}
      <p className="text-center text-sm font-bold text-zinc-500 capitalize mb-4">{labelDia}</p>

      {delDia.length === 0 ? (
        <div className="text-center py-12 text-zinc-400">
          <div className="text-5xl mb-3">📅</div>
          <p className="font-semibold">No hay servicios programados este día</p>
          <p className="text-sm mt-1">Toca otro día del mes para ver sus servicios</p>
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
                    {(Array.isArray(s.vehiculo) ? s.vehiculo : s.vehiculo ? [s.vehiculo] : []).map((nombre) => (
                      <span
                        key={nombre}
                        className="text-xs font-bold px-2 py-0.5 rounded"
                        style={coloresVehiculo[nombre]
                          ? { backgroundColor: coloresVehiculo[nombre], color: textoSobre(coloresVehiculo[nombre]) }
                          : { backgroundColor: "#f4f4f5", color: "#3f3f46" }}
                      >
                        {nombre}
                      </span>
                    ))}
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
