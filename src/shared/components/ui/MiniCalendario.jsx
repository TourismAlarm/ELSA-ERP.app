import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { festivoDe, esFinDeSemana } from "../../lib/festivos";
import { textoSobre } from "../../lib/color";
import { diasDelEvento, tipoDe, colorDe } from "../../../modules/eventos/db";

const DIAS_SEMANA = ["L", "M", "X", "J", "V", "S", "D"];

const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const hoy = () => iso(new Date());
const hhmm = (h) => (h ? String(h).slice(0, 5) : "");
// Hora de inicio delante de cada trabajo en el mes, sin el cero: "9:00"
const horaDelante = (h) => (h ? `${String(h).slice(0, 5).replace(/^0/, "")} ` : "");

const vehiculosDe = (s) => {
  const a = Array.isArray(s.vehiculo) ? s.vehiculo : (s.vehiculo ? [s.vehiculo] : []);
  return a.filter(Boolean);
};

// Alto (px) de cada línea dentro de una celda del mes
const ALTO_LINEA = 17;
// Días que enseña la agenda a partir del día elegido
const DIAS_AGENDA = 60;

// Mientras se crea un servicio hace falta saber si el día está libre sin
// salir de la ficha. Antes era un mes en miniatura con un punto por servicio:
// se veía que había algo, pero no qué ni con qué camión, así que no servía
// para decidir si cabía otro trabajo. Ahora ocupa la pantalla entera y cada
// día enseña sus trabajos escritos (camión con su color + cliente), como el
// mes del calendario grande, y hay una pestaña de agenda con la lista de días.
const MiniCalendario = ({ valor, servicios = [], eventos = [], vehiculos = [], onElegir, onCancelar }) => {
  const inicial = valor || hoy();
  const [mes, setMes] = useState(() => ({
    year: Number(inicial.slice(0, 4)),
    month: Number(inicial.slice(5, 7)) - 1,
  }));
  const [vista, setVista] = useState("mes");

  const colores = useMemo(
    () => Object.fromEntries(vehiculos.map((v) => [v.nombre, v.color])),
    [vehiculos]
  );

  // Qué hay ya apuntado cada día. Los servicios, ordenados por hora.
  const ocupacion = useMemo(() => {
    const mapa = {};
    const anota = (dia, clave, dato) => {
      if (!dia) return;
      if (!mapa[dia]) mapa[dia] = { servicios: [], eventos: [] };
      mapa[dia][clave].push(dato);
    };
    servicios.forEach((s) => anota(s.fecha_servicio, "servicios", s));
    eventos.forEach((e) => diasDelEvento(e).forEach((d) => anota(d, "eventos", e)));
    Object.values(mapa).forEach((d) =>
      d.servicios.sort((a, b) => (a.hora_inicio || "99").localeCompare(b.hora_inicio || "99"))
    );
    return mapa;
  }, [servicios, eventos]);

  const primerDia = new Date(mes.year, mes.month, 1);
  const offset = (primerDia.getDay() + 6) % 7;          // la semana empieza en lunes
  const diasDelMes = new Date(mes.year, mes.month + 1, 0).getDate();
  const celdas = [
    ...Array(offset).fill(null),
    ...Array.from({ length: diasDelMes }, (_, i) => iso(new Date(mes.year, mes.month, i + 1))),
  ];
  const filas = Math.ceil(celdas.length / 7);

  // Cuántas líneas caben en cada día según el alto real de la rejilla
  const rejillaRef = useRef(null);
  const [altoRejilla, setAltoRejilla] = useState(0);
  useLayoutEffect(() => {
    const el = rejillaRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setAltoRejilla(el.clientHeight));
    obs.observe(el);
    return () => obs.disconnect();
  }, [vista]);
  const lineasPorCelda = altoRejilla
    ? Math.max(1, Math.floor((altoRejilla / filas - 20) / ALTO_LINEA))
    : 3;

  const mover = (n) => setMes((m) => {
    const d = new Date(m.year, m.month + n, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const irAHoy = () => {
    const d = new Date();
    setMes({ year: d.getFullYear(), month: d.getMonth() });
    onElegir(hoy());
  };

  // Elegir un día desde la agenda también lleva el mes a ese día
  const elegir = (dia) => {
    setMes({ year: Number(dia.slice(0, 4)), month: Number(dia.slice(5, 7)) - 1 });
    onElegir(dia);
  };

  const labelMes = primerDia.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  const detalle = ocupacion[valor];
  const delDia = detalle?.servicios || [];

  // Qué camiones están cogidos el día elegido: por servicios del ERP y por
  // eventos del calendario de Google de ese vehículo
  const ocupados = new Set([
    ...delDia.flatMap(vehiculosDe),
    ...(detalle?.eventos || []).map((e) => e.vehiculo).filter(Boolean),
  ]);

  // Días de la agenda: desde el elegido (o hoy) en adelante, solo los que
  // tienen algo o son el elegido
  const diasAgenda = useMemo(() => {
    const desde = new Date((valor || hoy()) + "T00:00:00");
    const lista = [];
    for (let i = 0; i < DIAS_AGENDA; i++) {
      const d = new Date(desde);
      d.setDate(desde.getDate() + i);
      const dia = iso(d);
      if (ocupacion[dia] || dia === valor) lista.push(dia);
    }
    return lista;
  }, [valor, ocupacion]);

  // Una línea por servicio: camión con su color y cliente
  // (sin camión o sin color: ámbar, como en el calendario grande)
  const lineaServicio = (s) => {
    const color = colores[vehiculosDe(s)[0]];
    return (
      <span
        key={s.id}
        style={{ lineHeight: `${ALTO_LINEA - 1}px`, ...(color ? { backgroundColor: color, color: textoSobre(color) } : {}) }}
        className={`block w-full truncate rounded px-1 text-[10px] font-bold shrink-0 ${
          color ? "" : "bg-amber-100 text-amber-800"
        }`}
      >
        {s.hora_inicio && <span className="font-black">{horaDelante(s.hora_inicio)}</span>}
        {s.cliente || "Sin cliente"}
      </span>
    );
  };

  const tituloDia = (dia) =>
    new Date(dia + "T00:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">

      {/* Cabecera: pestañas, mes y navegación */}
      <div className="shrink-0 px-3 pt-3 pb-2 border-b border-zinc-100">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex rounded-lg bg-zinc-100 p-0.5">
            {[["mes", "Mes"], ["agenda", "Agenda"]].map(([id, nombre]) => (
              <button
                key={id}
                type="button"
                onClick={() => setVista(id)}
                className={`px-3 py-1.5 rounded-md text-sm font-black transition-colors ${
                  vista === id ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
                }`}
              >
                {nombre}
              </button>
            ))}
          </div>
          <button type="button" onClick={irAHoy} className="ml-auto text-sm font-bold text-blue-600 hover:text-blue-800 px-2">Hoy</button>
          <button type="button" onClick={onCancelar} aria-label="Cerrar" className="w-9 h-9 rounded-lg text-zinc-400 hover:text-zinc-900 text-2xl leading-none">×</button>
        </div>
        {vista === "mes" && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => mover(-1)} className="w-9 h-9 shrink-0 rounded-lg bg-zinc-100 text-zinc-600 font-black hover:bg-zinc-900 hover:text-white transition-colors">‹</button>
            <p className="flex-1 text-center text-base font-black text-zinc-900 capitalize">{labelMes}</p>
            <button type="button" onClick={() => mover(1)} className="w-9 h-9 shrink-0 rounded-lg bg-zinc-100 text-zinc-600 font-black hover:bg-zinc-900 hover:text-white transition-colors">›</button>
          </div>
        )}
      </div>

      {vista === "mes" && (
        <div className="flex-1 min-h-0 flex flex-col px-1.5 pt-1">
          <div className="grid grid-cols-7 gap-0.5 mb-0.5">
            {DIAS_SEMANA.map((d) => (
              <div key={d} className="text-center text-xs font-black text-zinc-400 py-0.5">{d}</div>
            ))}
          </div>

          {/* Cada día enseña sus trabajos; si no caben, "+N" */}
          <div
            ref={rejillaRef}
            className="flex-1 min-h-0 grid grid-cols-7 gap-0.5"
            style={{ gridTemplateRows: `repeat(${filas}, minmax(0, 1fr))` }}
          >
            {celdas.map((dia, i) => {
              if (!dia) return <div key={`v${i}`} />;
              const festivo = festivoDe(dia);
              const carga = ocupacion[dia];
              const svs = carga?.servicios || [];
              const evs = carga?.eventos || [];
              const elegido = dia === valor;
              const esHoy = dia === hoy();
              const finde = esFinDeSemana(dia);

              let lineas = lineasPorCelda;
              const total = evs.length + svs.length;
              if (total > lineas) lineas -= 1;
              const evsVisibles = evs.slice(0, Math.max(0, lineas));
              const svsVisibles = svs.slice(0, Math.max(0, lineas - evsVisibles.length));
              const extra = total - evsVisibles.length - svsVisibles.length;

              return (
                <button
                  key={dia}
                  type="button"
                  onClick={() => onElegir(dia)}
                  title={festivo || undefined}
                  className={[
                    "min-h-0 overflow-hidden rounded border flex flex-col items-stretch gap-px p-0.5 text-left transition-colors",
                    elegido ? "border-zinc-900 ring-2 ring-zinc-900 bg-white"
                      : festivo ? "bg-rose-50 border-rose-200"
                      : finde ? "bg-zinc-50 border-zinc-200"
                      : "bg-white border-zinc-200 hover:border-zinc-400",
                  ].join(" ")}
                >
                  <span className={`self-center shrink-0 text-xs font-black leading-none rounded-full w-5 h-5 flex items-center justify-center ${
                    esHoy ? "bg-zinc-900 text-white" : festivo ? "text-rose-600" : finde ? "text-zinc-400" : "text-zinc-800"
                  }`}>
                    {Number(dia.slice(8, 10))}
                  </span>
                  {evsVisibles.map((e) => (
                    <span
                      key={e.id}
                      style={{ lineHeight: `${ALTO_LINEA - 1}px`, backgroundColor: colorDe(e), color: textoSobre(colorDe(e)) }}
                      className="block w-full truncate rounded px-1 text-[10px] font-bold shrink-0"
                    >
                      {e.todo_el_dia ? "" : horaDelante(e.hora_inicio)}{tipoDe(e).emoji} {e.titulo}
                    </span>
                  ))}
                  {svsVisibles.map(lineaServicio)}
                  {extra > 0 && (
                    <span className="block w-full truncate px-1 text-[10px] font-black text-zinc-500 shrink-0">+{extra}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {vista === "agenda" && (
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
          {diasAgenda.length === 0 && (
            <p className="text-sm text-zinc-400 text-center mt-6">Nada apuntado en los próximos {DIAS_AGENDA} días.</p>
          )}
          {diasAgenda.map((dia) => {
            const carga = ocupacion[dia];
            const elegido = dia === valor;
            return (
              <button
                key={dia}
                type="button"
                onClick={() => elegir(dia)}
                className={`w-full text-left rounded-xl border-2 p-3 mb-2 transition-colors ${
                  elegido ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 hover:border-zinc-400"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <p className={`text-sm font-black capitalize ${dia === hoy() ? "text-blue-700" : "text-zinc-900"}`}>{tituloDia(dia)}</p>
                  {festivoDe(dia) && <span className="text-xs font-bold text-rose-500 truncate">{festivoDe(dia)}</span>}
                </div>
                {!carga && <p className="text-xs text-zinc-400">Nada apuntado. Día libre.</p>}
                {carga?.eventos.map((e) => (
                  <p key={e.id} className="text-sm font-bold truncate" style={{ color: colorDe(e) }}>
                    {tipoDe(e).emoji} {e.titulo}
                  </p>
                ))}
                {carga?.servicios.map((s) => {
                  const vs = vehiculosDe(s);
                  return (
                    <div key={s.id} className="flex items-center gap-2 py-0.5 min-w-0">
                      <span className="font-mono text-xs text-zinc-500 w-11 shrink-0">
                        {hhmm(s.hora_inicio) || "--:--"}
                      </span>
                      {vs.length > 0 ? vs.map((v) => (
                        <span
                          key={v}
                          style={colores[v] ? { backgroundColor: colores[v], color: textoSobre(colores[v]) } : undefined}
                          className={`text-[11px] font-bold px-1.5 py-0.5 rounded shrink-0 ${colores[v] ? "" : "bg-zinc-100 text-zinc-600"}`}
                        >
                          {v}
                        </span>
                      )) : (
                        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-white text-zinc-500 ring-1 ring-zinc-300 shrink-0">sin camión</span>
                      )}
                      <span className="text-sm text-zinc-800 truncate">{s.cliente || "sin cliente"}</span>
                    </div>
                  );
                })}
              </button>
            );
          })}
        </div>
      )}

      {/* Lo que hay el día elegido y camiones libres */}
      <div className="shrink-0 border-t border-zinc-200 px-3 pt-2 pb-4 bg-white">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-black text-zinc-900 capitalize">
            {valor ? tituloDia(valor) : "Elige un día"}
          </p>
          {festivoDe(valor) && <span className="text-xs font-bold text-rose-500">🔴 {festivoDe(valor)}</span>}
        </div>

        {vehiculos.length > 0 && valor && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {vehiculos.map((v) => {
              const cogido = ocupados.has(v.nombre);
              return (
                <span
                  key={v.nombre}
                  style={cogido ? { backgroundColor: v.color, color: textoSobre(v.color) } : undefined}
                  className={`text-xs font-bold px-2 py-0.5 rounded ${cogido ? "" : "bg-zinc-50 text-zinc-400 line-through ring-1 ring-zinc-200"}`}
                >
                  {v.nombre}
                </span>
              );
            })}
          </div>
        )}

        {vista === "mes" && valor && (
          <div className="mt-1.5 max-h-24 overflow-y-auto">
            {delDia.length === 0 && (detalle?.eventos.length || 0) === 0 && (
              <p className="text-xs text-zinc-400">Nada apuntado. Día libre.</p>
            )}
            {delDia.map((s) => (
              <p key={s.id} className="text-xs text-zinc-700 truncate leading-snug">
                <span className="font-mono text-zinc-400">{hhmm(s.hora_inicio) || "--:--"}</span>
                {" "}{vehiculosDe(s).join(", ") || "sin camión"}
                <span className="text-zinc-400"> · </span>{s.cliente || "sin cliente"}
              </p>
            ))}
            {detalle?.eventos.map((e) => (
              <p key={e.id} className="text-xs truncate leading-snug" style={{ color: colorDe(e) }}>
                {tipoDe(e).emoji} {e.titulo}
              </p>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={onCancelar}
          className="w-full mt-2 py-3 bg-zinc-900 text-white text-base font-black rounded-lg hover:bg-zinc-700 transition-colors"
        >
          Usar este día
        </button>
      </div>
    </div>
  );
};

export default MiniCalendario;
