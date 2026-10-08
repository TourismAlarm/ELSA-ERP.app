import { TIPO_GOOGLE } from "../../../modules/eventos/db";

const fechaLarga = (iso) =>
  new Date(iso + "T00:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

// Ficha de un evento que viene de Google Calendar. Solo se mira: se cambia
// en Google, y el ERP lo verá al refrescar.
const EventoGoogleModal = ({ evento, onCerrar }) => (
  <div className="fixed inset-0 z-50 flex flex-col justify-end">
    <div className="absolute inset-0 bg-black/40" onClick={onCerrar} />
    <div className="relative bg-white rounded-t-2xl p-5 pb-8 max-h-[80vh] overflow-y-auto">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: TIPO_GOOGLE.color }}>
            {TIPO_GOOGLE.emoji} {TIPO_GOOGLE.etiqueta}
          </p>
          <h2 className="text-lg font-black text-zinc-900 break-words">{evento.titulo}</h2>
        </div>
        <button onClick={onCerrar} aria-label="Cerrar" className="text-zinc-400 hover:text-zinc-900 text-2xl leading-none p-1">×</button>
      </div>
      <p className="text-sm text-zinc-700 capitalize">
        {fechaLarga(evento.fecha)}{evento.fecha_fin ? ` – ${fechaLarga(evento.fecha_fin)}` : ""}
      </p>
      <p className="text-sm text-zinc-700">
        {evento.todo_el_dia ? "Todo el día" : `${evento.hora_inicio}${evento.hora_fin ? ` – ${evento.hora_fin}` : ""}`}
      </p>
      {evento.ubicacion && <p className="text-sm text-zinc-700 mt-2">📍 {evento.ubicacion}</p>}
      {evento.notas && <p className="text-sm text-zinc-600 mt-3 whitespace-pre-wrap break-words">{evento.notas}</p>}
      <p className="text-xs text-zinc-400 mt-4">Este evento se cambia en Google Calendar. El ERP lo actualiza al refrescar.</p>
    </div>
  </div>
);

export default EventoGoogleModal;
