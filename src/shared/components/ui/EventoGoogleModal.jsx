import { useState } from "react";
import { TIPO_GOOGLE } from "../../../modules/eventos/db";
import Btn from "./Btn";

const campo = "w-full border-2 border-zinc-200 rounded-md px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:border-zinc-900 bg-white";

// Ficha de un evento que viene de Google Calendar. Se puede cambiar y borrar
// desde aquí (se guarda en Google al momento) o convertir en servicio del
// ERP: entonces se abre el formulario del servicio con lo que se sabe y, al
// guardarlo, el evento se quita de Google para que no quede repetido.
const EventoGoogleModal = ({ evento, onGuardar, onBorrar, onConvertir, onCerrar }) => {
  const [f, setF] = useState(() => ({
    titulo: evento.titulo || "",
    fecha: evento.fecha,
    fecha_fin: evento.fecha_fin || "",
    todo_el_dia: !!evento.todo_el_dia,
    hora_inicio: evento.hora_inicio || "",
    hora_fin: evento.hora_fin || "",
    ubicacion: evento.ubicacion || "",
    notas: evento.notas || "",
  }));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const guardar = async () => {
    if (!f.fecha) { setError("Falta el día."); return; }
    if (!f.todo_el_dia && !f.hora_inicio) { setError("Falta la hora de inicio (o marca «Todo el día»)."); return; }
    setGuardando(true);
    setError(null);
    const err = await onGuardar(evento, {
      ...f,
      fecha_fin: f.todo_el_dia && f.fecha_fin > f.fecha ? f.fecha_fin : null,
      hora_inicio: f.todo_el_dia ? null : f.hora_inicio,
      hora_fin: f.todo_el_dia ? null : f.hora_fin || null,
    });
    setGuardando(false);
    if (err) setError(err);
  };

  const borrar = async () => {
    if (!confirm("Se borrará este evento de Google Calendar. ¿Seguir?")) return;
    setGuardando(true);
    setError(null);
    const err = await onBorrar(evento);
    setGuardando(false);
    if (err) setError(err);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onCerrar} />
      <div className="relative bg-white rounded-t-2xl p-5 pb-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 mb-4">
          <p className="text-xs font-bold tracking-widest uppercase" style={{ color: TIPO_GOOGLE.color }}>
            {TIPO_GOOGLE.emoji} {TIPO_GOOGLE.etiqueta}{evento.calendario ? ` · ${evento.calendario}` : ""}
          </p>
          <button onClick={onCerrar} aria-label="Cerrar" className="text-zinc-400 hover:text-zinc-900 text-2xl leading-none p-1">×</button>
        </div>

        <div className="flex flex-col gap-3">
          <input value={f.titulo} onChange={set("titulo")} placeholder="Título" className={`${campo} text-base font-bold`} />
          <div className="flex gap-2 flex-wrap items-center">
            <input type="date" value={f.fecha} onChange={set("fecha")} className={`${campo} w-auto`} />
            <label className="flex items-center gap-2 text-sm font-semibold text-zinc-700">
              <input type="checkbox" checked={f.todo_el_dia} onChange={set("todo_el_dia")} /> Todo el día
            </label>
          </div>
          {f.todo_el_dia ? (
            <label className="text-xs font-semibold text-zinc-500 flex items-center gap-2">
              Hasta (si dura varios días)
              <input type="date" value={f.fecha_fin} min={f.fecha} onChange={set("fecha_fin")} className={`${campo} w-auto`} />
            </label>
          ) : (
            <div className="flex gap-2 items-center">
              <input type="time" value={f.hora_inicio} onChange={set("hora_inicio")} className={`${campo} w-auto`} />
              <span className="text-zinc-400">–</span>
              <input type="time" value={f.hora_fin} onChange={set("hora_fin")} className={`${campo} w-auto`} />
            </div>
          )}
          <input value={f.ubicacion} onChange={set("ubicacion")} placeholder="📍 Ubicación" className={campo} />
          <textarea value={f.notas} onChange={set("notas")} rows={3} placeholder="Notas" className={campo} />
        </div>

        {error && <p className="text-sm font-semibold text-red-600 mt-3">{error}</p>}

        <div className="flex gap-2 mt-4 flex-wrap">
          <Btn size="md" className="flex-1" onClick={guardar} disabled={guardando}>{guardando ? "Guardando en Google..." : "💾 Guardar en Google"}</Btn>
          <Btn size="md" variant="secondary" onClick={borrar} disabled={guardando}>🗑 Borrar</Btn>
        </div>
        <Btn size="md" variant="secondary" className="w-full mt-2" onClick={() => onConvertir(evento)} disabled={guardando}>
          🚛 Convertir en servicio del ERP
        </Btn>
        <p className="text-xs text-zinc-400 mt-2">
          Convertir abre un servicio nuevo con estos datos. Al guardarlo, este evento se quita de Google y queda el servicio,
          que también sale en Google y ya se gestiona desde el ERP (cliente, DeCA, albarán).
        </p>
        {evento.enlace && (
          <a href={evento.enlace} target="_blank" rel="noopener noreferrer" className="block text-xs font-bold text-blue-600 mt-3">Abrir en Google Calendar ↗</a>
        )}
      </div>
    </div>
  );
};

export default EventoGoogleModal;
