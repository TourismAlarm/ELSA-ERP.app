import { useState } from "react";
import { Btn, Field, Input } from "../../../shared/components/ui";

// Paleta de ~10 colores bien diferenciados, estilo Google Calendar
const PALETA = [
  "#3b82f6", // azul
  "#22c55e", // verde
  "#ef4444", // rojo
  "#f97316", // naranja
  "#eab308", // amarillo
  "#a855f7", // violeta
  "#ec4899", // rosa
  "#14b8a6", // turquesa
  "#6366f1", // índigo
  "#78716c", // gris piedra
];

const ColorPicker = ({ value, onChange }) => (
  <div className="flex flex-col gap-2">
    <div className="flex flex-wrap gap-2">
      {PALETA.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`w-9 h-9 rounded-full border-2 transition-transform ${
            value?.toLowerCase() === c.toLowerCase() ? "border-zinc-900 scale-110" : "border-white ring-1 ring-zinc-200 hover:scale-105"
          }`}
          style={{ backgroundColor: c }}
          title={c}
        />
      ))}
      <label
        className="w-9 h-9 rounded-full border-2 border-white ring-1 ring-zinc-200 hover:scale-105 transition-transform cursor-pointer relative overflow-hidden flex items-center justify-center text-xs"
        style={{ background: !PALETA.some((c) => c.toLowerCase() === value?.toLowerCase()) ? value : "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }}
        title="Color personalizado"
      >
        <input
          type="color"
          value={value || "#3b82f6"}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
        {!PALETA.some((c) => c.toLowerCase() === value?.toLowerCase()) && (
          <span className="text-white drop-shadow">✓</span>
        )}
      </label>
    </div>
  </div>
);

const RecursoForm = ({ inicial = {}, onGuardar, onCancelar, guardando }) => {
  const [form, setForm] = useState({
    nombre: inicial.nombre || "",
    color: inicial.color || PALETA[0],
  });

  const handleSubmit = () => {
    if (!form.nombre.trim()) { alert("El nombre es obligatorio"); return; }
    onGuardar(form);
  };

  return (
    <div className="bg-zinc-50 border-2 border-zinc-200 rounded-xl p-4 flex flex-col gap-3">
      <Field label="Nombre *">
        <Input
          value={form.nombre}
          onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
          placeholder="24+jib, Externo, Descarga en base..."
          autoFocus
        />
      </Field>
      <Field label="Color">
        <ColorPicker value={form.color} onChange={(color) => setForm((f) => ({ ...f, color }))} />
      </Field>
      <div className="flex gap-2">
        <Btn size="md" className="flex-1" onClick={handleSubmit} disabled={guardando}>
          {guardando ? "Guardando..." : "💾 Guardar"}
        </Btn>
        <Btn size="md" variant="secondary" onClick={onCancelar}>Cancelar</Btn>
      </div>
    </div>
  );
};

const RecursosScreen = ({ recursos, onBack, onNew, onEdit, onDelete }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const handleNew = async (form) => {
    setGuardando(true);
    await onNew(form);
    setGuardando(false);
    setShowForm(false);
  };

  const handleEdit = async (id, form) => {
    setGuardando(true);
    await onEdit(id, form);
    setGuardando(false);
    setEditingId(null);
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={onBack} className="text-zinc-400 hover:text-zinc-900 transition-colors text-2xl leading-none">←</button>
        <div>
          <p className="text-xs font-bold tracking-widest text-zinc-400 uppercase mb-0.5">Configuración</p>
          <h1 className="text-3xl font-black text-zinc-900">Recursos y colores</h1>
        </div>
      </div>

      {!showForm && (
        <Btn size="lg" className="w-full mb-6" onClick={() => { setEditingId(null); setShowForm(true); }}>
          ➕ Nuevo recurso
        </Btn>
      )}

      {showForm && (
        <div className="mb-6">
          <RecursoForm onGuardar={handleNew} onCancelar={() => setShowForm(false)} guardando={guardando} />
        </div>
      )}

      {recursos.length === 0 && !showForm ? (
        <div className="text-center py-16 text-zinc-400">
          <div className="text-5xl mb-3">🎨</div>
          <p className="font-semibold">No hay recursos guardados</p>
          <p className="text-sm mt-1">Añade el primero con el botón de arriba</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {recursos.map((r) => (
            <div key={r.id} className="bg-white border-2 border-zinc-200 rounded-xl overflow-hidden">
              {editingId === r.id ? (
                <div className="p-4">
                  <RecursoForm
                    inicial={r}
                    onGuardar={(form) => handleEdit(r.id, form)}
                    onCancelar={() => setEditingId(null)}
                    guardando={guardando}
                  />
                </div>
              ) : (
                <div className="p-4 flex items-center gap-3">
                  <span className="w-6 h-6 rounded shrink-0" style={{ backgroundColor: r.color || "#a1a1aa" }} />
                  <p className="font-bold text-zinc-900 flex-1 truncate">{r.nombre}</p>
                  <div className="flex gap-2 shrink-0">
                    <Btn size="sm" variant="secondary" onClick={() => { setShowForm(false); setEditingId(r.id); }}>✏️ Editar</Btn>
                    <Btn size="sm" variant="danger" onClick={() => onDelete(r.id)}>🗑 Eliminar</Btn>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecursosScreen;
