import { useState } from "react";
import { servicioSinDeca } from "../../deca/db";
import { festivoDe } from "../../../shared/lib/festivos";
import { tipoDe, colorDe, diasDelEvento } from "../../eventos/db";

// Cuántos días se añaden cada vez que se pulsa "Ver 30 días más"
const DIAS_POR_TANDA = 30;

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
  const d = new Date(iso + "T00:00:00");
  const texto = d
    .toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })
    .replace(",", "");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

// Vista Agenda estilo Google Calendar: los próximos días, uno debajo de otro,
// con sus servicios y otros eventos mezclados por hora. Solo aparecen los
// días que tienen algo.
const AgendaView = ({ servicios = [], eventos = [], coloresVehiculo = {}, serviciosConDeca = new Set(), onSelectServicio, onEditarEvento }) => {
  const [diasVisibles, setDiasVisibles] = useState(DIAS_POR_TANDA);
  const sinDeca = (s) => servicioSinDeca(s, serviciosConDeca);

  // Eventos agrupados por día (uno de varios días aparece en cada uno de ellos)
  const eventosPorDia = {};
  eventos.forEach((e) => {
    diasDelEvento(e).forEach((iso) => {
      (eventosPorDia[iso] = eventosPorDia[iso] || []).push(e);
    });
  });

  // Servicios agrupados por fecha
  const serviciosPorDia = {};
  servicios.forEach((s) => {
    if (s.fecha_servicio) (serviciosPorDia[s.fecha_servicio] = serviciosPorDia[s.fecha_servicio] || []).push(s);
  });

  const inicio = new Date(hoy() + "T00:00:00");
  const dias = Array.from({ length: diasVisibles }, (_, i) => {
    const d = new Date(inicio);
    d.setDate(d.getDate() + i);
    return toISO(d);
  }).filter((iso) => (serviciosPorDia[iso]?.length > 0) || (eventosPorDia[iso]?.length > 0));

  return (
    <div className="flex flex-col gap-3">
      {dias.map((iso) => {
        const festivo = festivoDe(iso);
        const esHoy = iso === hoy();

        // Servicios y eventos del día, mezclados por hora (sin hora / todo el
        // día primero, igual que en Google Calendar)
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
          <div key={iso} className="bg-white border-2 border-zinc-200 rounded-xl overflow-hidden">
            <div className={`px-4 py-2 flex items-center gap-2 ${esHoy ? "bg-zinc-900" : "bg-zinc-50"}`}>
              <p className={`text-sm font-black capitalize ${esHoy ? "text-white" : festivo ? "text-rose-600" : "text-zinc-700"}`}>
                {labelDia(iso)}
              </p>
              {festivo && (
                <span className={`text-xs font-bold ${esHoy ? "text-rose-300" : "text-rose-500"}`}>🎉 {festivo}</span>
              )}
            </div>
            <div className="divide-y divide-zinc-100">
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
      })}

      <button
        onClick={() => setDiasVisibles((n) => n + DIAS_POR_TANDA)}
        className="w-full py-3 text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors"
      >
        Ver 30 días más
      </button>
    </div>
  );
};

export default AgendaView;
