import { useState } from "react";
import { Btn, Field, Input } from "../components/ui";

const ClienteForm = ({ inicial = {}, onGuardar, onCancelar, guardando }) => {
  const [form, setForm] = useState({
    nombre: inicial.nombre || "",
    nifCif: inicial.nifCif || "",
    dirFact: inicial.dirFact || "",
    tel: inicial.tel || "",
    email: inicial.email || "",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = () => {
    if (!form.nombre.trim()) { alert("El nombre es obligatorio"); return; }
    onGuardar(form);
  };

  return (
    <div className="bg-zinc-50 border-2 border-zinc-200 rounded-xl p-4 flex flex-col gap-3">
      <Field label="Nombre *">
        <Input value={form.nombre} onChange={set("nombre")} placeholder="Juan García" autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="NIF / CIF">
          <Input value={form.nifCif} onChange={set("nifCif")} placeholder="B12345678" />
        </Field>
        <Field label="Dirección de facturación">
          <Input value={form.dirFact} onChange={set("dirFact")} placeholder="Calle Mayor 1, 08001 Barcelona" />
        </Field>
      </div>
      <Field label="Teléfono">
        <Input value={form.tel} onChange={set("tel")} placeholder="600 000 000" />
      </Field>
      <Field label="Email">
        <Input type="email" value={form.email} onChange={set("email")} placeholder="cliente@email.com" />
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

const ClientesScreen = ({ clientes, onBack, onNew, onEdit, onDelete }) => {
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
          <p className="text-xs font-bold tracking-widest text-zinc-400 uppercase mb-0.5">Base de datos</p>
          <h1 className="text-3xl font-black text-zinc-900">Clientes</h1>
        </div>
      </div>

      {!showForm && (
        <Btn size="lg" className="w-full mb-6" onClick={() => { setEditingId(null); setShowForm(true); }}>
          ➕ Nuevo cliente
        </Btn>
      )}

      {showForm && (
        <div className="mb-6">
          <ClienteForm onGuardar={handleNew} onCancelar={() => setShowForm(false)} guardando={guardando} />
        </div>
      )}

      {clientes.length === 0 && !showForm ? (
        <div className="text-center py-16 text-zinc-400">
          <div className="text-5xl mb-3">👥</div>
          <p className="font-semibold">No hay clientes guardados</p>
          <p className="text-sm mt-1">Añade el primero con el botón de arriba</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {clientes.map((c) => (
            <div key={c.id} className="bg-white border-2 border-zinc-200 rounded-xl overflow-hidden">
              {editingId === c.id ? (
                <div className="p-4">
                  <ClienteForm
                    inicial={c}
                    onGuardar={(form) => handleEdit(c.id, form)}
                    onCancelar={() => setEditingId(null)}
                    guardando={guardando}
                  />
                </div>
              ) : (
                <div className="p-5">
                  <p className="font-black text-zinc-900 text-lg">{c.nombre}</p>
                  {c.nifCif && <p className="text-sm text-zinc-500 mt-0.5">🪪 {c.nifCif}</p>}
                  {c.dirFact && <p className="text-sm text-zinc-500 mt-0.5">🏢 {c.dirFact}</p>}
                  {c.tel && <p className="text-sm text-zinc-500 mt-0.5">📞 {c.tel}</p>}
                  {c.email && <p className="text-sm text-zinc-500 mt-0.5">✉️ {c.email}</p>}
                  <div className="flex gap-2 mt-3">
                    <Btn size="sm" variant="secondary" onClick={() => { setShowForm(false); setEditingId(c.id); }}>✏️ Editar</Btn>
                    <Btn size="sm" variant="danger" onClick={() => onDelete(c.id)}>🗑 Eliminar</Btn>
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

export default ClientesScreen;
