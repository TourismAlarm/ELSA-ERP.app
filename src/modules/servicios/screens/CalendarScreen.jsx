import { useState } from "react";
import { Btn } from "../../../shared/components/ui";
import { textoSobre } from "../../../shared/lib/color";

// Devuelve el primer vehículo/equipo del servicio (para el color del calendario)
const primerVehiculo = (s) => {
  const arr = Array.isArray(s.vehiculo) ? s.vehiculo : (s.vehiculo ? [s.vehiculo] : []);
  return arr[0] || null;
};

const DIAS_SEMANA = ["L", "M", "X", "J", "V", "S", "D"];

// --- Rejilla horaria del día seleccionado (07:00 a 21:00, franjas de 30 min) ---
const HORA_MIN = 7;
const HORA_MAX = 21;
const PX_POR_MINUTO = 1; // 60px por hora
const TOTAL_MINUTOS = (HORA_MAX - HORA_MIN) * 60;

// "HH:MM" o "HH:MM:SS" -> minutos desde el inicio de la rejilla
const aMinutosDesdeInicio = (h) => {
  const [hh, mm] = h.split(":");
  return (Number(hh) - HORA_MIN) * 60 + Number(mm || 0);
};

const horaCorta = (h) => (h ? h.slice(0, 5) : "");

const minutosAHora = (min) => {
  const h = HORA_MIN + Math.floor(min / 60);
  return `${String(h).padStart(2, "0")}:${min % 60 === 0 ? "00" : "30"}`;
};

// Reparte en columnas los eventos que se solapan (estilo Google Calendar):
// los solapados comparten el ancho, los que no, ocupan todo
const asignarColumnas = (eventos) => {
  const ordenados = [...eventos].sort((a, b) => a.ini - b.ini || a.fin - b.fin);
  const colFin = []; // fin del último evento colocado en cada columna
  let cluster = -1;
  let finCluster = -1;
  ordenados.forEach((ev) => {
    if (ev.ini >= finCluster) { cluster++; colFin.length = 0; finCluster = ev.fin; }
    else finCluster = Math.max(finCluster, ev.fin);
    let col = colFin.findIndex((f) => f <= ev.ini);
    if (col === -1) col = colFin.length;
    colFin[col] = ev.fin;
    ev.col = col;
    ev.cluster = cluster;
  });
  const colsPorCluster = {};
  ordenados.forEach((ev) => {
    colsPorCluster[ev.cluster] = Math.max(colsPorCluster[ev.cluster] || 0, ev.col + 1);
  });
  ordenados.forEach((ev) => { ev.cols = colsPorCluster[ev.cluster]; });
  return ordenados;
};

// Formatea una Date local a AAAA-MM-DD sin pasar por UTC (evita saltos de día)
const toISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const hoy = () => toISO(new Date());

const CalendarScreen = ({ servicios, albaranes, coloresVehiculo = {}, onViewServicio, onViewAlbaran, onCrearAlbaran, onNuevoServicioEnHora, onConfig }) => {
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

  // Rejilla horaria: servicios con hora (bloques posicionados) y sin hora (chips)
  const sinHora = delDia.filter((s) => !s.hora_inicio);
  const conHora = asignarColumnas(
    delDia
      .filter((s) => s.hora_inicio)
      .map((s) => {
        const ini = aMinutosDesdeInicio(s.hora_inicio);
        let fin = s.hora_fin ? aMinutosDesdeInicio(s.hora_fin) : ini + 60; // sin fin: 1h por defecto
        if (fin <= ini) fin = ini + 30; // fin anterior a inicio: bloque mínimo
        return { s, ini, fin };
      })
  );
  const franjas = Array.from({ length: TOTAL_MINUTOS / 30 }, (_, i) => i * 30);

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

      <Btn size="lg" className="w-full mb-4" onClick={() => onNuevoServicioEnHora(fecha, null)}>➕ Nuevo servicio</Btn>

      {/* Servicios sin hora asignada */}
      {sinHora.length > 0 && (
        <div className="bg-white border-2 border-zinc-200 rounded-xl p-4 mb-3">
          <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-2">Sin hora asignada</p>
          <div className="flex flex-wrap gap-2">
            {sinHora.map((s) => {
              const ev = estiloEvento(s);
              const albaran = albaranes.find((a) => a.servicio_id === s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => onViewServicio(s)}
                  style={ev.style}
                  className={`text-xs font-bold px-3 py-2 rounded-full ${ev.className}`}
                >
                  {(s.estado || "abierto") === "realizado" ? "✓ " : ""}{s.cliente || "Sin nombre"}{albaran ? " 📝" : ""}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Rejilla horaria del día */}
      <div className="bg-white border-2 border-zinc-200 rounded-xl p-3 pt-4">
        <div className="flex">
          {/* Columna de horas */}
          <div className="w-12 shrink-0">
            {franjas.map((min) => (
              <div key={min} className="relative" style={{ height: 30 * PX_POR_MINUTO }}>
                <span className={`absolute -top-1.5 right-2 leading-none ${min % 60 === 0 ? "text-[10px] font-bold text-zinc-500" : "text-[9px] text-zinc-300"}`}>
                  {minutosAHora(min)}
                </span>
              </div>
            ))}
          </div>

          {/* Área de eventos */}
          <div className="flex-1 relative border-l-2 border-zinc-100">
            {/* Franjas vacías: tocar crea un servicio a esa hora */}
            {franjas.map((min) => (
              <button
                key={min}
                onClick={() => onNuevoServicioEnHora(fecha, minutosAHora(min))}
                title={`Nuevo servicio a las ${minutosAHora(min)}`}
                className={`block w-full border-t transition-colors hover:bg-blue-50 ${min % 60 === 0 ? "border-zinc-200" : "border-zinc-100"}`}
                style={{ height: 30 * PX_POR_MINUTO }}
              />
            ))}

            {/* Bloques de servicios con hora */}
            {conHora.map(({ s, ini, fin, col, cols }) => {
              const top = Math.max(0, Math.min(ini, TOTAL_MINUTOS - 24));
              const alto = Math.max(24, Math.min(fin, TOTAL_MINUTOS) - top);
              const ev = estiloEvento(s);
              const albaran = albaranes.find((a) => a.servicio_id === s.id);
              const hecho = (s.estado || "abierto") === "realizado";
              return (
                <button
                  key={s.id}
                  onClick={() => onViewServicio(s)}
                  style={{
                    top: top * PX_POR_MINUTO,
                    height: alto * PX_POR_MINUTO,
                    left: `calc(${(col / cols) * 100}% + 2px)`,
                    width: `calc(${100 / cols}% - 4px)`,
                    ...ev.style,
                  }}
                  className={`absolute rounded-lg px-1.5 py-1 text-left overflow-hidden shadow-sm border border-white/50 ${ev.className}`}
                >
                  <p className="text-[10px] font-black leading-tight truncate">
                    {horaCorta(s.hora_inicio)}{s.hora_fin ? ` – ${horaCorta(s.hora_fin)}` : ""}{albaran ? " 📝" : ""}
                  </p>
                  <p className="text-[11px] font-bold leading-tight truncate">
                    {hecho ? "✓ " : ""}{s.cliente || "Sin nombre"}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarScreen;
