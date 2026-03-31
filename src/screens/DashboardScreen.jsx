import { useState } from "react";
import { Btn, Input } from "../components/ui";

const ESTADOS = {
  pendiente:   { label: "Pendiente",      emoji: "🟡", border: "border-l-amber-400",   badge: "bg-amber-100 text-amber-700",    summary: "bg-amber-50 border-amber-200 text-amber-700" },
  seguimiento: { label: "En seguimiento", emoji: "🔵", border: "border-l-blue-400",    badge: "bg-blue-100 text-blue-700",      summary: "bg-blue-50 border-blue-200 text-blue-700" },
  aceptado:    { label: "Aceptado",       emoji: "🟢", border: "border-l-emerald-400", badge: "bg-emerald-100 text-emerald-700", summary: "bg-emerald-50 border-emerald-200 text-emerald-700" },
  rechazado:   { label: "Rechazado",      emoji: "🔴", border: "border-l-red-400",     badge: "bg-red-100 text-red-700",        summary: "bg-red-50 border-red-200 text-red-700" },
};

const diasDesde = (fechaISO) => {
  if (!fechaISO) return null;
  return Math.floor((Date.now() - new Date(fechaISO).getTime()) / (1000 * 60 * 60 * 24));
};

const DashboardScreen = ({ solicitudes, onNew, onView, onEdit, onDelete, onConfig, loading, onCambiarEstado, onToggleAvisos }) => {
  const [q, setQ] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");

  const filtered = solicitudes.filter((b) => {
    const matchText = [b.cliente, b.descripcion, b.numero, b.tipo, b.tipoTrabajo, b.vehiculo, b.direccion, b.origen, b.destino]
      .join(" ").toLowerCase().includes(q.toLowerCase());
    const matchEstado = filtroEstado === "todos" || (b.estado || "pendiente") === filtroEstado;
    return matchText && matchEstado;
  });

  const conteo = Object.fromEntries(
    Object.keys(ESTADOS).map((e) => [e, solicitudes.filter((b) => (b.estado || "pendiente") === e).length])
  );

  const alertas = solicitudes
    .filter((b) => {
      const estado = b.estado || "pendiente";
      const dias = diasDesde(b.fecha_ultimo_contacto);
      return (estado === "pendiente" || estado === "seguimiento") && dias !== null && dias >= 3 && b.avisos_activos !== false;
    })
    .sort((a, b) => diasDesde(b.fecha_ultimo_contacto) - diasDesde(a.fecha_ultimo_contacto));

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">

      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <p className="text-xs font-bold tracking-widest text-zinc-400 uppercase mb-1">Panel principal</p>
          <h1 className="text-3xl font-black text-zinc-900">Solicitudes</h1>
        </div>
        <Btn variant="ghost" size="sm" onClick={onConfig}>⚙️ Config</Btn>
      </div>

      <Btn size="lg" className="w-full mb-6" onClick={onNew}>➕ Nueva Solicitud</Btn>

      {/* Panel resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {Object.entries(ESTADOS).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setFiltroEstado(filtroEstado === key ? "todos" : key)}
            className={`${cfg.summary} border-2 rounded-xl p-4 text-left transition-all ${filtroEstado === key ? "ring-2 ring-offset-2 ring-zinc-900" : "hover:opacity-80"}`}
          >
            <div className="text-3xl font-black">{conteo[key]}</div>
            <div className="text-sm font-semibold mt-1">{cfg.emoji} {cfg.label}</div>
          </button>
        ))}
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-5 mb-6">
          <p className="text-orange-800 font-black text-lg mb-3">
            ⚠️ {alertas.length} {alertas.length === 1 ? "solicitud necesita" : "solicitudes necesitan"} atención
          </p>
          <div className="flex flex-col gap-3">
            {alertas.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 flex-wrap">
                <span className="text-orange-900 font-semibold text-sm flex-1 min-w-0">
                  • {s.cliente || "Sin nombre"} — <span className="font-normal">hace {diasDesde(s.fecha_ultimo_contacto)} días</span>
                </span>
                <div className="flex gap-2">
                  <Btn size="sm" onClick={() => onView(s)}>Contactar</Btn>
                  <Btn size="sm" variant="secondary" onClick={() => onToggleAvisos(s.id, false)}>Silenciar</Btn>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Búsqueda */}
      {solicitudes.length > 0 && (
        <div className="mb-4">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍  Buscar por cliente, origen, tipo, vehículo..." />
        </div>
      )}

      {/* Filtros por estado */}
      {solicitudes.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-5">
          <button
            onClick={() => setFiltroEstado("todos")}
            className={`px-4 py-3 text-sm font-bold rounded-lg border-2 whitespace-nowrap transition-all ${
              filtroEstado === "todos" ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400"
            }`}
          >
            Todas ({solicitudes.length})
          </button>
          {Object.entries(ESTADOS).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => setFiltroEstado(filtroEstado === key ? "todos" : key)}
              className={`px-4 py-3 text-sm font-bold rounded-lg border-2 whitespace-nowrap transition-all ${
                filtroEstado === key
                  ? `${cfg.summary} ring-2 ring-offset-1 ring-zinc-700`
                  : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400"
              }`}
            >
              {cfg.emoji} {cfg.label} ({conteo[key]})
            </button>
          ))}
        </div>
      )}

      {/* Lista */}
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
          {filtered.map((b) => {
            const estado = b.estado || "pendiente";
            const cfg = ESTADOS[estado] || ESTADOS.pendiente;
            return (
              <div key={b.id} className={`bg-white border-2 border-zinc-200 rounded-xl overflow-hidden hover:border-zinc-400 transition-colors border-l-4 ${cfg.border}`}>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="text-xs font-bold text-zinc-400 tracking-widest">{b.numero}</span>
                        <span className="text-xs text-zinc-300">·</span>
                        <span className="text-xs text-zinc-400">{b.fecha}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${cfg.badge}`}>{cfg.emoji} {cfg.label}</span>
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

                  {/* Cambio rápido de estado */}
                  <div className="mb-3">
                    <select
                      value={estado}
                      onChange={(e) => onCambiarEstado(b.id, e.target.value)}
                      className={`text-sm font-bold rounded-lg px-3 py-2 border-2 w-full md:w-auto cursor-pointer ${cfg.summary}`}
                    >
                      <option value="pendiente">🟡 Pendiente</option>
                      <option value="seguimiento">🔵 En seguimiento</option>
                      <option value="aceptado">🟢 Aceptado</option>
                      <option value="rechazado">🔴 Rechazado</option>
                    </select>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Btn size="sm" onClick={() => onView(b)}>👁 Ver</Btn>
                    <Btn size="sm" variant="secondary" onClick={() => onEdit(b)}>✏️ Editar</Btn>
                    <Btn size="sm" variant="danger" onClick={() => onDelete(b.id)}>🗑 Eliminar</Btn>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DashboardScreen;
