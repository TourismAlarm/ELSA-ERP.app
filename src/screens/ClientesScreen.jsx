import { useState } from "react";
import { Btn } from "../shared/components/ui";
import { buscaCliente, comercialDistinto } from "../shared/lib/clientes";
import ClienteForm from "../shared/components/ClienteForm";

const ClientesScreen = ({ clientes, onBack, onNew, onEdit, onDelete }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [q, setQ] = useState("");

  // Busca por nombre fiscal y por nombre comercial
  const visibles = q.trim() === "" ? clientes : clientes.filter((c) => buscaCliente(c, q));

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

      {clientes.length > 0 && (
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="🔍 Buscar por nombre o nombre comercial..."
          className="w-full border-2 border-zinc-200 rounded-md px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors bg-white mb-4"
        />
      )}

      {clientes.length === 0 && !showForm ? (
        <div className="text-center py-16 text-zinc-400">
          <div className="text-5xl mb-3">👥</div>
          <p className="font-semibold">No hay clientes guardados</p>
          <p className="text-sm mt-1">Añade el primero con el botón de arriba</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visibles.length === 0 && (
            <p className="text-center text-zinc-400 py-8">Sin resultados para "{q}"</p>
          )}
          {visibles.map((c) => (
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
                  {comercialDistinto(c) && <p className="text-sm text-zinc-500 mt-0.5">🏷 {comercialDistinto(c)}</p>}
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
