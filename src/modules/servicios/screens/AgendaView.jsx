import { useLayoutEffect, useRef, useState } from "react";
import { textoSobre } from "../../../shared/lib/color";
import { servicioSinDeca } from "../../deca/db";
import { festivoDe } from "../../../shared/lib/festivos";
import { tipoDe, colorDe, diasDelEvento } from "../../eventos/db";

// Lista de vehículos/equipos de un servicio (normaliza array/string)
const vehiculosDe = (s) => {
  const arr = Array.isArray(s.vehiculo) ? s.vehiculo : (s.vehiculo ? [s.vehiculo] : []);
  return arr.filter(Boolean);
};

const primerVehiculo = (s) => vehiculosDe(s)[0] || null;

// "08:30:00" -> "8:30", como lo escribe Google Calendar
const hora = (h) => (h ? h.slice(0, 5).replace(/^0/, "") : "");

const rangoHoras = (ini, fin) => (ini ? `${hora(ini)}${fin ? `–${hora(fin)}` : ""}` : "Todo el día");

// Formatea una Date local a AAAA-MM-DD sin pasar por UTC (evita saltos de día)
const toISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const hoy = () => toISO(new Date());

const fechaDe = (iso) => new Date(iso + "T00:00:00");

// "septiembre de 2026" -> "Septiembre de 2026"
const labelMes = (iso) => {
  const texto = fechaDe(iso).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

// Vista Agenda estilo Google Calendar: todas las faenas, pasadas y futuras, un
// día debajo de otro. Solo salen los días con algo, más hoy, que es donde se
// abre la lista. La lista ocupa el resto de la pantalla y es lo único que se
// desplaza, para que al bajar con el dedo la cabecera no se vaya.
// Cada vez que cambia `saltoAHoy` la lista vuelve a hoy (botón "Hoy").
const AgendaView = ({ servicios = [], eventos = [], coloresVehiculo = {}, serviciosConDeca = new Set(), onSelectServicio, onEditarEvento, saltoAHoy = 0 }) => {
  const listaRef = useRef(null);
  const hoyRef = useRef(null);
  const [alto, setAlto] = useState(null);
  const sinDeca = (s) => servicioSinDeca(s, serviciosConDeca);
  const iHoy = hoy();

  // Alto = lo que queda de pantalla por debajo de donde empieza la lista
  useLayoutEffect(() => {
    const medir = () => {
      const lista = listaRef.current;
      if (!lista) return;
      const top = lista.getBoundingClientRect().top + window.scrollY;
      setAlto(Math.max(320, window.innerHeight - top));
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  // Coloca hoy arriba, dejando sitio a la cabecera fija del mes
  useLayoutEffect(() => {
    const lista = listaRef.current;
    if (!lista || !hoyRef.current) return;
    const alturaMes = lista.querySelector("[data-cabecera-mes]")?.offsetHeight || 0;
    lista.scrollTo({ top: hoyRef.current.offsetTop - alturaMes, behavior: saltoAHoy ? "smooth" : "auto" });
  }, [saltoAHoy]);

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

  const tarjetaServicio = (s) => {
    const color = coloresVehiculo[primerVehiculo(s)];
    const hecho = (s.estado || "abierto") === "realizado";
    const vehiculos = vehiculosDe(s);
    // Sin color de vehículo, el mismo color por estado que en el calendario
    const sinColor = hecho ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900";
    return (
      <button
        key={`servicio-${s.id}`}
        onClick={() => onSelectServicio && onSelectServicio(s)}
        style={color ? { backgroundColor: color, color: textoSobre(color) } : undefined}
        className={`w-full min-h-[64px] rounded-xl px-4 py-3 text-left shadow-sm active:opacity-80 transition-opacity ${color ? "" : sinColor}`}
      >
        <p className="text-base font-bold leading-snug truncate">
          {sinDeca(s) ? "🔴 " : ""}{hecho ? "✓ " : ""}{s.cliente || "Sin nombre"}
        </p>
        <p className="text-sm leading-snug truncate">
          {rangoHoras(s.hora_inicio, s.hora_fin)} · {vehiculos.length > 0 ? vehiculos.map((v) => `🚛 ${v}`).join(" · ") : "🚛 Sin camión"}
        </p>
        {s.origen && <p className="text-sm leading-snug truncate opacity-90">📍 {s.origen}</p>}
      </button>
    );
  };

  const tarjetaEvento = (e) => {
    const color = colorDe(e);
    return (
      <button
        key={`evento-${e.id}`}
        onClick={() => onEditarEvento && onEditarEvento(e)}
        style={{ backgroundColor: color, color: textoSobre(color) }}
        className="w-full min-h-[64px] rounded-xl px-4 py-3 text-left shadow-sm active:opacity-80 transition-opacity"
      >
        <p className="text-base font-bold leading-snug truncate">{tipoDe(e).emoji} {e.titulo}</p>
        <p className="text-sm leading-snug">
          {e.todo_el_dia ? "Todo el día" : rangoHoras(e.hora_inicio, e.hora_fin)}
        </p>
      </button>
    );
  };

  const renderDia = (iso) => {
    const festivo = festivoDe(iso);
    const esHoy = iso === iHoy;
    const d = fechaDe(iso);

    // Servicios y eventos mezclados por hora; los sin hora ("Todo el día") primero
    const entradas = [
      ...(eventosPorDia[iso] || []).map((e) => ({ hora: e.todo_el_dia || !e.hora_inicio ? null : e.hora_inicio, nodo: tarjetaEvento(e) })),
      ...(serviciosPorDia[iso] || []).map((s) => ({ hora: s.hora_inicio || null, nodo: tarjetaServicio(s) })),
    ].sort((a, b) => {
      if (a.hora === b.hora) return 0;
      if (a.hora === null) return -1;
      if (b.hora === null) return 1;
      return a.hora.localeCompare(b.hora);
    });

    return (
      <div key={iso} ref={esHoy ? hoyRef : undefined} className="flex gap-3 py-2">
        {/* Columna de la fecha */}
        <div className="w-12 shrink-0 flex flex-col items-center pt-1">
          <span className={`text-xs font-bold uppercase ${festivo ? "text-rose-600" : "text-zinc-500"}`}>
            {d.toLocaleDateString("es-ES", { weekday: "short" }).replace(".", "")}
          </span>
          <span
            className={`mt-0.5 w-10 h-10 rounded-full flex items-center justify-center text-2xl ${
              esHoy ? "bg-zinc-900 text-white font-black" : festivo ? "text-rose-600 font-semibold" : "text-zinc-700 font-semibold"
            }`}
          >
            {d.getDate()}
          </span>
        </div>

        {/* Tarjetas del día */}
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          {festivo && (
            <p className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-2 text-sm font-bold text-rose-700 truncate">🎉 {festivo}</p>
          )}
          {entradas.length === 0 && (
            <p className="min-h-[64px] flex items-center px-1 text-base text-zinc-400">Nada programado para hoy</p>
          )}
          {entradas.map((e) => e.nodo)}
        </div>
      </div>
    );
  };

  return (
    <div
      ref={listaRef}
      style={{ height: alto ?? "70vh" }}
      className="relative overflow-y-auto overscroll-contain -mx-3 px-3 pb-28 bg-zinc-50"
    >
      {meses.map(({ clave, dias: diasMes }) => (
        <div key={clave}>
          <p data-cabecera-mes className="sticky top-0 z-10 -mx-3 px-3 bg-zinc-50/95 backdrop-blur py-2 text-sm font-black text-zinc-500">
            {labelMes(diasMes[0])}
          </p>
          {diasMes.map(renderDia)}
        </div>
      ))}
    </div>
  );
};

export default AgendaView;
