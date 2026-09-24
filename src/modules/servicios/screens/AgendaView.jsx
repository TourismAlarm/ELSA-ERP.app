import { useEffect, useRef } from "react";
import { servicioSinDeca } from "../../deca/db";
import { festivoDe } from "../../../shared/lib/festivos";
import { tipoDe, colorDe, diasDelEvento } from "../../eventos/db";

// Lista de vehículos/equipos de un servicio (normaliza array/string)
const vehiculosDe = (s) => {
  const arr = Array.isArray(s.vehiculo) ? s.vehiculo : (s.vehiculo ? [s.vehiculo] : []);
  return arr.filter(Boolean);
};

const primerVehiculo = (s) => vehiculosDe(s)[0] || null;

const horaCorta = (h) => (h ? h.slice(0, 5) : "");

// Formatea una Date local a AAAA-MM-DD sin pasar por UTC (evita saltos de día)
const toISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const hoy = () => toISO(new Date());

// "lun, 28 sept" (es-ES) -> "Lun 28 sept"
const labelDia = (iso) => {
  const texto = new Date(iso + "T00:00:00")
    .toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })
    .replace(",", "");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

const labelMes = (iso) =>
  new Date(iso + "T00:00:00").toLocaleDateString("es-ES", { month: "long", year: "numeric" });

// Vista Agenda estilo Google Calendar: todas las faenas, pasadas y futuras, un
// día debajo de otro. Solo salen los días con algo, más hoy, que es donde se
// abre la lista.
const AgendaView = ({ servicios = [], eventos = [], coloresVehiculo = {}, serviciosConDeca = new Set(), onSelectServicio, onEditarEvento }) => {
  const listaRef = useRef(null);
  const hoyRef = useRef(null);
  const sinDeca = (s) => servicioSinDeca(s, serviciosConDeca);
  const iHoy = hoy();

  // Abre la lista en hoy, dejando sitio a la cabecera fija del mes
  useEffect(() => {
    const lista = listaRef.current;
    if (!lista || !hoyRef.current) return;
    const alturaMes = lista.querySelector("[data-cabecera-mes]")?.offsetHeight || 0;
    lista.scrollTop = hoyRef.current.offsetTop - alturaMes;
  }, []);

  const eventosPorDia = {};
  eventos.forEach((e) => {
    diasDelEvento(e).forEach((iso) => {
      (eventosPorDia[iso] = eventosPorDia[iso] || []).push(e);
    });
  });

  const serviciosPorDia = {};
  servicios.forEach((s) => {
    if (s.fecha_servicio) (serviciosPorDia[s.fecha_servicio] = serviciosPorDia[s.fecha_servicio] || []).push(s);
  });

  const dias = [...new Set([...Object.keys(eventosPorDia), ...Object.keys(serviciosPorDia), iHoy])].sort();

  // Días agrupados por mes, para no perder el año al ir hacia atrás o adelante
  const meses = [];
  dias.forEach((iso) => {
    const clave = iso.slice(0, 7);
    if (meses.length === 0 || meses[meses.length - 1].clave !== clave) meses.push({ clave, dias: [] });
    meses[meses.length - 1].dias.push(iso);
  });

  const renderDia = (iso) => {
    const festivo = festivoDe(iso);
    const esHoy = iso === iHoy;

    // Servicios y eventos mezclados por hora; los sin hora ("Todo el día") primero
    const entradas = [
      ...(eventosPorDia[iso] || []).map((e) => ({
        tipo: "evento",
        hora: e.todo_el_dia || !e.hora_inicio ? null : e.hora_inicio,
        e,
      })),
      ...(serviciosPorDia[iso] || []).map((s) => ({
        tipo: "servicio",
        hora: s.hora_inicio || null,
        s,
      })),
    ].sort((a, b) => {
      if (a.hora === b.hora) return 0;
      if (a.hora === null) return -1;
      if (b.hora === null) return 1;
      return a.hora.localeCompare(b.hora);
    });

    return (
      <div
        key={iso}
        ref={esHoy ? hoyRef : undefined}
        className={`bg-white border-2 rounded-xl overflow-hidden ${esHoy ? "border-zinc-900" : "border-zinc-200"}`}
      >
        <div className={`px-4 py-2 flex items-center gap-2 ${esHoy ? "bg-zinc-900" : "bg-zinc-50"}`}>
          <p className={`text-sm font-black ${esHoy ? "text-white" : festivo ? "text-rose-600" : "text-zinc-700"}`}>
            {labelDia(iso)}{esHoy ? " · Hoy" : ""}
          </p>
          {festivo && (
            <span className={`text-xs font-bold ${esHoy ? "text-rose-300" : "text-rose-500"}`}>🎉 {festivo}</span>
          )}
        </div>
        <div className="divide-y divide-zinc-100">
          {entradas.length === 0 && (
            <p className="min-h-[56px] flex items-center px-4 text-sm text-zinc-400">Nada programado para hoy</p>
          )}
          {entradas.map((entrada) =>
            entrada.tipo === "evento" ? (
              <button
                key={`evento-${entrada.e.id}`}
                onClick={() => onEditarEvento && onEditarEvento(entrada.e)}
                className="w-full min-h-[56px] flex items-stretch text-left hover:bg-zinc-50 transition-colors"
              >
                <span className="w-1.5 shrink-0" style={{ backgroundColor: colorDe(entrada.e) }} />
                <span className="flex-1 min-w-0 px-3 py-2 flex flex-col justify-center gap-0.5">
                  <span className="text-xs font-bold text-zinc-400">
                    {entrada.hora ? horaCorta(entrada.hora) : "Todo el día"}
                  </span>
                  <span className="text-sm font-bold text-zinc-900 truncate">
                    {tipoDe(entrada.e).emoji} {entrada.e.titulo}
                  </span>
                </span>
              </button>
            ) : (
              <button
                key={`servicio-${entrada.s.id}`}
                onClick={() => onSelectServicio && onSelectServicio(entrada.s)}
                className="w-full min-h-[56px] flex items-stretch text-left hover:bg-zinc-50 transition-colors"
              >
                <span
                  className="w-1.5 shrink-0"
                  style={{ backgroundColor: coloresVehiculo[primerVehiculo(entrada.s)] || "#a1a1aa" }}
                />
                <span className="flex-1 min-w-0 px-3 py-2 flex flex-col justify-center gap-0.5">
                  <span className="text-xs font-bold text-zinc-400">
                    {entrada.s.hora_inicio
                      ? `${horaCorta(entrada.s.hora_inicio)}${entrada.s.hora_fin ? ` – ${horaCorta(entrada.s.hora_fin)}` : ""}`
                      : "Todo el día"}
                  </span>
                  <span className="text-sm font-bold text-zinc-900 truncate">
                    {sinDeca(entrada.s) ? "🔴 " : ""}{entrada.s.cliente || "Sin nombre"}
                  </span>
                  <span className="text-xs text-zinc-500 truncate">
                    {vehiculosDe(entrada.s).length > 0 ? vehiculosDe(entrada.s).map((v) => `🚛 ${v}`).join(" · ") : "🚛 Sin camión"}
                    {entrada.s.origen ? ` · ${entrada.s.origen}` : ""}
                  </span>
                </span>
              </button>
            )
          )}
        </div>
      </div>
    );
  };

  return (
    <div ref={listaRef} className="relative max-h-[75vh] overflow-y-auto">
      {meses.map(({ clave, dias: diasMes }) => (
        <div key={clave}>
          <p data-cabecera-mes className="sticky top-0 z-10 bg-zinc-50 py-2 text-xs font-black tracking-widest text-zinc-500 uppercase">
            {labelMes(diasMes[0])}
          </p>
          <div className="flex flex-col gap-3 pb-3">
            {diasMes.map(renderDia)}
          </div>
        </div>
      ))}
    </div>
  );
};

export default AgendaView;
