import { useState } from "react";
import Btn from "./Btn";
import Field from "./Field";
import { Input, Textarea } from "./Input";
import ColorPicker from "./ColorPicker";
import { TIPOS_EVENTO, tipoDe } from "../../../modules/eventos/db";
import { conHorasValidas, alCambiarInicio, avisoDuracion, HORA_INICIO_POR_DEFECTO } from "../../lib/horas";
import { textoSobre } from "../../lib/color";

// Alta y edición de lo que no es un servicio: visitas, días libres, bajas, un
// camión en el taller. Lo que se apunta en el calendario y no factura.
const EventoModal = ({ inicial, fecha, vehiculos = [], onGuardar, onBorrar, onCancelar }) => {
  const editando = !!inicial?.id;

  const [form, setForm] = useState(() => ({
    titulo: inicial?.titulo || "",
    tipo: inicial?.tipo || "visita",
    fecha: inicial?.fecha || fecha,
    fecha_fin: inicial?.fecha_fin || "",
    // Los eventos son de todo el día salvo que se diga lo contrario: una visita
    // con hora es lo raro, un día libre es lo normal
    todo_el_dia: inicial ? !!inicial.todo_el_dia : true,
    hora_inicio: inicial?.hora_inicio?.slice(0, 5) || HORA_INICIO_POR_DEFECTO,
    hora_fin: inicial?.hora_fin?.slice(0, 5) || "",
    notas: inicial?.notas || "",
    color: inicial?.color || "",
    vehiculo_id: inicial?.vehiculo_id || "",
  }));
  const [guardando, setGuardando] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const variosDias = !!form.fecha_fin && form.fecha_fin > form.fecha;

  const guardar = async () => {
    if (!form.titulo.trim()) { alert("Ponle un título al evento."); return; }
    if (!form.fecha) { alert("Falta la fecha."); return; }
    setGuardando(true);
    const datos = form.todo_el_dia ? form : conHorasValidas(form);
    await onGuardar({ ...inicial, ...datos });
    setGuardando(false);
  };

  const borrar = async () => {
    if (!confirm(`¿Eliminar "${form.titulo}"?`)) return;
    setGuardando(true);
    await onBorrar(inicial.id);
    setGuardando(false);
  };

  const aviso = form.todo_el_dia ? "" : avisoDuracion(form.hora_inicio, form.hora_fin);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onCancelar} />
      <div className="relative bg-white rounded-t-2xl p-5 pb-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-zinc-900">{editando ? "Editar evento" : "Nuevo evento"}</h2>
          <button onClick={onCancelar} className="text-zinc-400 hover:text-zinc-900 text-2xl leading-none p-1">×</button>
        </div>

        <div className="flex flex-col gap-4">
          <Field label="Qué es">
            <div className="flex flex-wrap gap-2 pt-0.5">
              {Object.entries(TIPOS_EVENTO).map(([clave, t]) => {
                const activo = form.tipo === clave;
                return (
                  <button
                    key={clave}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, tipo: clave }))}
                    className="text-sm font-bold px-3 py-1.5 rounded-full border-2 transition-all"
                    style={activo
                      ? { backgroundColor: t.color, borderColor: t.color, color: textoSobre(t.color) }
                      : { backgroundColor: "#fff", borderColor: t.color, color: "#3f3f46" }}
                  >
                    {t.emoji} {t.etiqueta}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Título *">
            <Input
              value={form.titulo}
              onChange={set("titulo")}
              placeholder={form.tipo === "ausencia" ? "Vacaciones Jordi" : "Visita a obra Mataró"}
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Desde">
              <Input type="date" value={form.fecha} onChange={set("fecha")} />
            </Field>
            <Field label="Hasta (opcional)">
              <Input type="date" value={form.fecha_fin} min={form.fecha} onChange={set("fecha_fin")} />
            </Field>
          </div>
          {form.fecha_fin && form.fecha_fin < form.fecha && (
            <p className="text-xs text-red-500 -mt-2">La fecha de fin es anterior a la de inicio.</p>
          )}

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.todo_el_dia}
              onChange={(e) => setForm((f) => ({ ...f, todo_el_dia: e.target.checked }))}
              className="w-5 h-5 accent-zinc-900"
            />
            <span className="text-sm font-semibold text-zinc-700">Todo el día</span>
          </label>

          {!form.todo_el_dia && !variosDias && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Hora inicio">
                  <Input
                    type="time"
                    value={form.hora_inicio}
                    onChange={(e) => setForm((f) => ({ ...f, ...alCambiarInicio(e.target.value, f) }))}
                  />
                </Field>
                <Field label="Hora fin">
                  <Input type="time" value={form.hora_fin} onChange={set("hora_fin")} />
                </Field>
              </div>
              {aviso && <p className="text-xs text-amber-600 -mt-2">{aviso}</p>}
            </>
          )}
          {!form.todo_el_dia && variosDias && (
            <p className="text-xs text-zinc-400 -mt-2">
              Un evento de varios días se apunta como día completo; las horas solo tienen sentido en uno suelto.
            </p>
          )}

          {vehiculos.length > 0 && (
            <Field label="Vehículo afectado (opcional)">
              <select
                value={form.vehiculo_id}
                onChange={set("vehiculo_id")}
                className="w-full border-2 border-zinc-200 rounded-md px-4 py-3 text-sm bg-white focus:outline-none focus:border-zinc-900"
              >
                <option value="">— Ninguno —</option>
                {vehiculos.map((v) => (
                  <option key={v.id} value={v.id}>{v.nombre}{v.matricula ? ` (${v.matricula})` : ""}</option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Notas">
            <Textarea value={form.notas} onChange={set("notas")} placeholder="Lo que haga falta recordar..." />
          </Field>

          <Field label="Color">
            <ColorPicker
              value={form.color || tipoDe(form).color}
              onChange={(color) => setForm((f) => ({ ...f, color }))}
            />
            {form.color && (
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, color: "" }))}
                className="text-xs font-bold text-zinc-500 hover:text-zinc-900 mt-1"
              >
                Usar el color del tipo
              </button>
            )}
          </Field>
        </div>

        <div className="flex gap-2 mt-5">
          <Btn size="lg" className="flex-1" onClick={guardar} disabled={guardando || !form.titulo.trim()}>
            {guardando ? "Guardando..." : "💾 Guardar"}
          </Btn>
          <Btn size="lg" variant="secondary" onClick={onCancelar}>Cancelar</Btn>
        </div>
        {editando && (
          <Btn size="md" variant="danger" className="w-full mt-2" onClick={borrar} disabled={guardando}>
            🗑 Eliminar evento
          </Btn>
        )}
      </div>
    </div>
  );
};

export default EventoModal;
