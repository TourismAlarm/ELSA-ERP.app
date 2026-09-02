import { useMemo, useState } from "react";
import Btn from "./Btn";
import { festivoDe, esFinDeSemana } from "../../lib/festivos";
import { diasDelEvento, tipoDe } from "../../../modules/eventos/db";

const DIAS_SEMANA = ["L", "M", "X", "J", "V", "S", "D"];

const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const hoy = () => iso(new Date());

// Mientras se crea un servicio hace falta saber si el día está libre. Antes
// había que salir de la ficha, mirar el calendario y volver, con lo escrito a
// medias. Esto enseña el mes con la carga de cada día sin salir de la ficha.
const MiniCalendario = ({ valor, servicios = [], eventos = [], onElegir, onCancelar }) => {
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
  };

  const labelMes = primerDia.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  const detalle = ocupacion[valor];

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onCancelar} />
      <div className="relative bg-white rounded-t-2xl p-5 pb-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-black text-zinc-900">Elegir el día</h2>
          <button onClick={onCancelar} className="text-zinc-400 hover:text-zinc-900 text-2xl leading-none p-1">×</button>
        </div>
        <p className="text-sm text-zinc-500 mb-4">Toca un día para ponerlo en el servicio. Los números dicen lo que ya hay apuntado.</p>

        <div className="flex items-center justify-between mb-3">
          <button onClick={() => mover(-1)} className="w-9 h-9 rounded-lg border-2 border-zinc-200 font-black text-zinc-600 hover:border-zinc-900">‹</button>
          <div className="text-center">
            <p className="font-black text-zinc-900 capitalize">{labelMes}</p>
            <button onClick={irAHoy} className="text-xs font-bold text-blue-600 hover:text-blue-800">Ir a hoy</button>
          </div>
          <button onClick={() => mover(1)} className="w-9 h-9 rounded-lg border-2 border-zinc-200 font-black text-zinc-600 hover:border-zinc-900">›</button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {DIAS_SEMANA.map((d) => (
            <div key={d} className="text-center text-[11px] font-black text-zinc-400 py-1">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {celdas.map((dia, i) => {
            if (!dia) return <div key={`v${i}`} />;
            const festivo = festivoDe(dia);
            const carga = ocupacion[dia];
            const nServicios = carga?.servicios.length || 0;
            const nEventos = carga?.eventos.length || 0;
            const elegido = dia === valor;
            const esHoy = dia === hoy();
            const libre = !nServicios && !nEventos && !festivo && !esFinDeSemana(dia);

            return (
              <button
                key={dia}
                type="button"
                onClick={() => onElegir(dia)}
                title={festivo || undefined}
                className={[
                  "aspect-square rounded-lg border-2 flex flex-col items-center justify-center transition-all",
                  elegido ? "border-zinc-900 bg-zinc-900 text-white"
                    : festivo ? "border-rose-200 bg-rose-50 text-rose-600"
                    : esFinDeSemana(dia) ? "border-zinc-100 bg-zinc-50 text-zinc-400"
                    : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-900",
                ].join(" ")}
              >
                <span className={`text-sm font-black leading-none ${esHoy && !elegido ? "underline decoration-2 underline-offset-2" : ""}`}>
                  {Number(dia.slice(8, 10))}
                </span>
                <span className="flex items-center gap-0.5 h-3 mt-0.5">
                  {nServicios > 0 && (
                    <span className={`text-[9px] font-black leading-none px-1 rounded ${elegido ? "bg-white/25" : "bg-zinc-900 text-white"}`}>
                      {nServicios}
                    </span>
                  )}
                  {nEventos > 0 && (
                    <span className={`text-[9px] leading-none ${elegido ? "opacity-90" : ""}`}>●</span>
                  )}
                  {libre && !elegido && <span className="text-[9px] text-emerald-500 leading-none">·</span>}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] text-zinc-500">
          <span><b className="text-zinc-900">3</b> servicios ese día</span>
          <span>● otra cosa apuntada</span>
          <span className="text-rose-500">festivo</span>
        </div>

        {valor && (
          <div className="mt-4 border-t border-zinc-100 pt-3">
            <p className="text-xs font-bold tracking-widest text-zinc-400 uppercase mb-2">
              {new Date(valor + "T00:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
              {festivoDe(valor) && <span className="text-rose-500 normal-case tracking-normal"> · {festivoDe(valor)}</span>}
            </p>
            {!detalle && <p className="text-sm text-zinc-400">Ese día no hay nada apuntado.</p>}
            {detalle?.servicios.map((s) => (
              <p key={s.id} className="text-sm text-zinc-700 truncate">
                <span className="font-mono text-xs text-zinc-400 mr-1.5">{(s.hora_inicio || "").slice(0, 5) || "--:--"}</span>
                {s.cliente || "Sin cliente"}
              </p>
            ))}
            {detalle?.eventos.map((e) => (
              <p key={e.id} className="text-sm text-zinc-700 truncate">
                <span className="mr-1.5">{tipoDe(e).emoji}</span>{e.titulo}
              </p>
            ))}
          </div>
        )}

        <div className="flex gap-2 mt-5">
          <Btn size="lg" className="flex-1" onClick={onCancelar}>Listo</Btn>
        </div>
      </div>
    </div>
  );
};

export default MiniCalendario;
