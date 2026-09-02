import { useMemo, useState } from "react";
import { festivoDe, esFinDeSemana } from "../../lib/festivos";
import { diasDelEvento, tipoDe, colorDe } from "../../../modules/eventos/db";

const DIAS_SEMANA = ["L", "M", "X", "J", "V", "S", "D"];

const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const hoy = () => iso(new Date());
const hhmm = (h) => (h ? String(h).slice(0, 5) : "");

const vehiculosDe = (s) => {
  const a = Array.isArray(s.vehiculo) ? s.vehiculo : (s.vehiculo ? [s.vehiculo] : []);
  return a.filter(Boolean);
};

// Mientras se crea un servicio hace falta saber si el día está libre. Antes
// había que salir de la ficha, mirar el calendario y volver, con lo escrito a
// medias. Esto enseña el mes entero sin salir de la ficha.
//
// Todo va apretado a propósito: en un mes caben 42 días y con la letra grande
// no entraban en la pantalla del móvil, así que había que ir haciendo scroll
// para ver la semana de abajo y se perdía justo lo que se venía a mirar.
const MiniCalendario = ({ valor, servicios = [], eventos = [], vehiculos = [], onElegir, onCancelar }) => {
  const inicial = valor || hoy();
  const [mes, setMes] = useState(() => ({
    year: Number(inicial.slice(0, 4)),
    month: Number(inicial.slice(5, 7)) - 1,
  }));

  // Qué hay ya apuntado cada día, para saber de un vistazo si cabe algo más
  const ocupacion = useMemo(() => {
    const mapa = {};
    const anota = (dia, clave, dato) => {
      if (!dia) return;
      if (!mapa[dia]) mapa[dia] = { servicios: [], eventos: [] };
      mapa[dia][clave].push(dato);
    };
    servicios.forEach((s) => anota(s.fecha_servicio, "servicios", s));
    eventos.forEach((e) => diasDelEvento(e).forEach((d) => anota(d, "eventos", e)));
    return mapa;
  }, [servicios, eventos]);

  const primerDia = new Date(mes.year, mes.month, 1);
  const offset = (primerDia.getDay() + 6) % 7;          // la semana empieza en lunes
  const diasDelMes = new Date(mes.year, mes.month + 1, 0).getDate();
  const celdas = [
    ...Array(offset).fill(null),
    ...Array.from({ length: diasDelMes }, (_, i) => iso(new Date(mes.year, mes.month, i + 1))),
  ];

  const mover = (n) => setMes((m) => {
    const d = new Date(m.year, m.month + n, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const irAHoy = () => {
    const d = new Date();
    setMes({ year: d.getFullYear(), month: d.getMonth() });
    onElegir(hoy());
  };

  const labelMes = primerDia.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  const detalle = ocupacion[valor];
  const delDia = detalle ? [...detalle.servicios] : [];
  delDia.sort((a, b) => (a.hora_inicio || "").localeCompare(b.hora_inicio || ""));

  // Qué camiones están cogidos el día elegido
  const ocupados = new Set(delDia.flatMap(vehiculosDe));

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onCancelar} />
      <div className="relative bg-white rounded-t-2xl px-4 pt-3 pb-5 max-h-[92vh] overflow-y-auto">

        {/* Cabecera: mes y navegación en una sola línea */}
        <div className="flex items-center gap-2 mb-2">
          <button onClick={() => mover(-1)} className="w-8 h-8 shrink-0 rounded-lg bg-zinc-100 text-zinc-600 font-black hover:bg-zinc-900 hover:text-white transition-colors">‹</button>
          <p className="flex-1 text-center text-sm font-black text-zinc-900 capitalize leading-none">{labelMes}</p>
          <button onClick={() => mover(1)} className="w-8 h-8 shrink-0 rounded-lg bg-zinc-100 text-zinc-600 font-black hover:bg-zinc-900 hover:text-white transition-colors">›</button>
          <button onClick={irAHoy} className="shrink-0 text-[11px] font-bold text-blue-600 hover:text-blue-800 px-1">Hoy</button>
          <button onClick={onCancelar} className="shrink-0 w-8 h-8 rounded-lg text-zinc-400 hover:text-zinc-900 text-xl leading-none">×</button>
        </div>

        <div className="grid grid-cols-7 gap-px mb-px">
          {DIAS_SEMANA.map((d) => (
            <div key={d} className="text-center text-[10px] font-black text-zinc-300 leading-none py-1">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px">
          {celdas.map((dia, i) => {
            if (!dia) return <div key={`v${i}`} />;
            const festivo = festivoDe(dia);
            const carga = ocupacion[dia];
            const nServicios = carga?.servicios.length || 0;
            const nEventos = carga?.eventos.length || 0;
            const elegido = dia === valor;
            const esHoy = dia === hoy();
            const finde = esFinDeSemana(dia);

            return (
              <button
                key={dia}
                type="button"
                onClick={() => onElegir(dia)}
                title={[festivo, nServicios ? `${nServicios} servicio(s)` : null].filter(Boolean).join(" · ") || undefined}
                className={[
                  "h-11 rounded flex flex-col items-center justify-center gap-px transition-colors",
                  elegido ? "bg-zinc-900 text-white"
                    : festivo ? "bg-rose-50 text-rose-600 hover:bg-rose-100"
                    : finde ? "bg-zinc-50 text-zinc-400 hover:bg-zinc-100"
                    : "text-zinc-800 hover:bg-zinc-100",
                ].join(" ")}
              >
                <span className={`text-xs font-black leading-none ${esHoy && !elegido ? "underline decoration-2 underline-offset-2" : ""}`}>
                  {Number(dia.slice(8, 10))}
                </span>
                {/* Un punto por servicio, hasta cuatro: se lee la carga del día
                    sin tener que poner un número que no se ve en el móvil */}
                <span className="flex items-center gap-px h-1.5">
                  {Array.from({ length: Math.min(nServicios, 4) }).map((_, k) => (
                    <span key={k} className={`w-1 h-1 rounded-full ${elegido ? "bg-white" : "bg-zinc-800"}`} />
                  ))}
                  {nServicios > 4 && <span className={`text-[7px] font-black leading-none ${elegido ? "text-white" : "text-zinc-800"}`}>+</span>}
                  {nEventos > 0 && <span className={`w-1 h-1 rounded-full ${elegido ? "bg-white/70" : "bg-teal-500"}`} />}
                </span>
              </button>
            );
          })}
        </div>

        {/* Lo que hay el día elegido */}
        <div className="mt-3 border-t border-zinc-100 pt-2">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs font-black text-zinc-900 capitalize">
              {valor
                ? new Date(valor + "T00:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })
                : "Elige un día"}
            </p>
            {festivoDe(valor) && <span className="text-[11px] font-bold text-rose-500">🔴 {festivoDe(valor)}</span>}
          </div>

          {/* Camiones libres y cogidos ese día */}
          {vehiculos.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {vehiculos.map((v) => {
                const cogido = ocupados.has(v.nombre);
                return (
                  <span
                    key={v.nombre}
                    style={cogido ? { backgroundColor: v.color, color: "#fff" } : undefined}
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cogido ? "" : "bg-zinc-50 text-zinc-400 line-through"}`}
                  >
                    {v.nombre}
                  </span>
                );
              })}
            </div>
          )}

          <div className="mt-1.5 max-h-28 overflow-y-auto">
            {delDia.length === 0 && (detalle?.eventos.length || 0) === 0 && (
              <p className="text-[11px] text-zinc-400">Nada apuntado. Día libre.</p>
            )}
            {delDia.map((s) => (
              <p key={s.id} className="text-[11px] text-zinc-700 truncate leading-snug">
                <span className="font-mono text-zinc-400">{hhmm(s.hora_inicio) || "--:--"}</span>
                {" "}{vehiculosDe(s).join(", ") || "sin camión"}
                <span className="text-zinc-400"> · </span>{s.cliente || "sin cliente"}
              </p>
            ))}
            {detalle?.eventos.map((e) => (
              <p key={e.id} className="text-[11px] truncate leading-snug" style={{ color: colorDe(e) }}>
                {tipoDe(e).emoji} {e.titulo}
              </p>
            ))}
          </div>
        </div>

        <button
          onClick={onCancelar}
          className="w-full mt-3 py-2.5 bg-zinc-900 text-white text-sm font-black rounded-lg hover:bg-zinc-700 transition-colors"
        >
          Usar este día
        </button>
      </div>
    </div>
  );
};

export default MiniCalendario;
