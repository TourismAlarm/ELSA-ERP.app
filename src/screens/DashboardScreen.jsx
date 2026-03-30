import { useState } from "react";
import { Btn, Input } from "../components/ui";

const DashboardScreen = ({ solicitudes, onNew, onView, onEdit, onDelete, onConfig, loading }) => {
  const [q, setQ] = useState("");
  const filtered = solicitudes.filter((b) =>
    [b.cliente, b.descripcion, b.numero, b.tipo, b.tipoTrabajo, b.vehiculo, b.direccion, b.origen, b.destino]
      .join(" ").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <p className="text-xs font-bold tracking-widest text-zinc-400 uppercase mb-1">Panel principal</p>
          <h1 className="text-3xl font-black text-zinc-900">Solicitudes</h1>
        </div>
        <Btn variant="ghost" size="sm" onClick={onConfig}>⚙️ Config</Btn>
      </div>

      <Btn size="lg" className="w-full mb-6" onClick={onNew}>➕ Nueva Solicitud</Btn>

      {solicitudes.length > 0 && (
        <div className="mb-5">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍  Buscar por cliente, origen, tipo, vehículo..." />
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-zinc-400">
          <div className="text-4xl mb-3">⏳</div>
          <p className="font-semibold">Cargando solicitudes...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-zinc-400">
          <div className="text-5xl mb-3">📋</div>
          <p className="font-semibold">{solicitudes.length === 0 ? "Aún no hay solicitudes" : "Sin resultados"}</p>
          <p className="text-sm mt-1">{solicitudes.length === 0 ? "Crea la primera solicitud con el botón de arriba" : "Prueba con otra búsqueda"}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((b) => (
            <div key={b.id} className="bg-white border-2 border-zinc-200 rounded-xl p-5 hover:border-zinc-400 transition-colors">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-xs font-bold text-zinc-400 tracking-widest">{b.numero}</span>
                    <span className="text-xs text-zinc-300">·</span>
                    <span className="text-xs text-zinc-400">{b.fecha}</span>
                    {(b.tipoTrabajo || b.tipo) && <span className="text-xs font-bold bg-zinc-900 text-white px-2 py-0.5 rounded">{b.tipoTrabajo || b.tipo}</span>}
                    {b.vehiculo && <span className="text-xs font-semibold bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded">{b.vehiculo}</span>}
                  </div>
                  <p className="font-black text-zinc-900 text-lg leading-tight truncate">{b.cliente || "Sin nombre"}</p>
                  {b.telCliente && <p className="text-xs text-zinc-500 mt-0.5">📞 {b.telCliente}</p>}
                  {b.origen
                    ? <p className="text-xs text-zinc-500 mt-0.5">📍 {b.origen}{b.destino ? ` → ${b.destino}` : ""}</p>
                    : b.direccion && <p className="text-xs text-zinc-500 mt-0.5">📍 {b.direccion}</p>}
                  {b.descripcion && <p className="text-sm text-zinc-500 mt-1 line-clamp-2">{b.descripcion}</p>}
                </div>
                {b.precio && (
                  <div className="text-right shrink-0">
                    <p className="text-xs text-zinc-400 mb-0.5">Est.</p>
                    <p className="text-lg font-black text-zinc-900">{Number(b.precio).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</p>
                  </div>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                <Btn size="sm" onClick={() => onView(b)}>👁 Ver</Btn>
                <Btn size="sm" variant="secondary" onClick={() => onEdit(b)}>✏️ Editar</Btn>
                <Btn size="sm" variant="danger" onClick={() => onDelete(b.id)}>🗑 Eliminar</Btn>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DashboardScreen;
