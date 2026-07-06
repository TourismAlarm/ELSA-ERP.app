import { useState } from "react";
import { Btn } from "../../../shared/components/ui";
import { textoSobre } from "../../../shared/lib/color";

const ESTADOS = {
  abierto:   { label: "Abierto",   emoji: "🟠", border: "border-l-amber-400",   badge: "bg-amber-100 text-amber-700",     summary: "bg-amber-50 border-amber-200 text-amber-700" },
  realizado: { label: "Realizado", emoji: "🟢", border: "border-l-emerald-400", badge: "bg-emerald-100 text-emerald-700", summary: "bg-emerald-50 border-emerald-200 text-emerald-700" },
};

const formatFecha = (fecha) =>
  fecha ? new Date(fecha).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";

const ListScreen = ({ servicios, coloresVehiculo = {}, onNew, onView, onEdit, onDelete, onConfig, loading, onCambiarEstado }) => {
  const [q, setQ] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [searchOpen, setSearchOpen] = useState(false);

  const filtered = servicios.filter((s) => {
    return filtroEstado === "todos" || (s.estado || "abierto") === filtroEstado;
  });

  const searchResults = q.trim() === "" ? [] : servicios.filter((s) => {
    const notasText = (s.notas || []).map((n) => n.texto).join(" ");
    const vehiculosStr = Array.isArray(s.vehiculo) ? s.vehiculo.join(" ") : (s.vehiculo || "");
    return [s.cliente, s.descripcion, s.numero, vehiculosStr, s.origen, s.destino, s.estado, notasText]
      .join(" ").toLowerCase().includes(q.toLowerCase());
  });

  const conteo = Object.fromEntries(
    Object.keys(ESTADOS).map((e) => [e, servicios.filter((s) => (s.estado || "abierto") === e).length])
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">

      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <p className="text-xs font-bold tracking-widest text-zinc-400 uppercase mb-1">Altas de trabajo</p>
          <h1 className="text-3xl font-black text-zinc-900">Servicios</h1>
        </div>
        <Btn variant="ghost" size="sm" onClick={onConfig}>⚙️ Config</Btn>
      </div>

      <Btn size="lg" className="w-full mb-6" onClick={onNew}>➕ Nuevo Servicio</Btn>

      {/* Panel resumen */}
      <div className="grid grid-cols-2 gap-3 mb-6">
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

      {/* Filtros por estado */}
      {servicios.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-5">
          <button
            onClick={() => setFiltroEstado("todos")}
            className={`px-4 py-3 text-sm font-bold rounded-lg border-2 whitespace-nowrap transition-all ${
              filtroEstado === "todos" ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400"
            }`}
          >
            Todos ({servicios.length})
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
          <p className="font-semibold">Cargando servicios...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-zinc-400">
          <div className="text-5xl mb-3">🔧</div>
          <p className="font-semibold">{servicios.length === 0 ? "Aún no hay servicios" : "Sin resultados"}</p>
          <p className="text-sm mt-1">{servicios.length === 0 ? "Crea el primer servicio con el botón de arriba" : "Prueba con otro filtro"}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((s) => {
            const estado = s.estado || "abierto";
            const cfg = ESTADOS[estado] || ESTADOS.abierto;
            return (
              <div key={s.id} className={`bg-white border-2 border-zinc-200 rounded-xl overflow-hidden hover:border-zinc-400 transition-colors border-l-4 ${cfg.border}`}>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="text-xs font-bold text-zinc-400 tracking-widest">{s.numero}</span>
                        {s.fecha_servicio && (
                          <>
                            <span className="text-xs text-zinc-300">·</span>
                            <span className="text-xs text-zinc-400">
                              {formatFecha(s.fecha_servicio)}{s.hora_inicio ? ` · ${s.hora_inicio.slice(0, 5)}` : ""}
                            </span>
                          </>
                        )}
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${cfg.badge}`}>{cfg.emoji} {cfg.label}</span>
                        {(Array.isArray(s.vehiculo) ? s.vehiculo : s.vehiculo ? [s.vehiculo] : []).map((v) => (
                          <span
                            key={v}
                            className="text-xs font-bold px-2 py-0.5 rounded"
                            style={coloresVehiculo[v]
                              ? { backgroundColor: coloresVehiculo[v], color: textoSobre(coloresVehiculo[v]) }
                              : { backgroundColor: "#f4f4f5", color: "#3f3f46" }}
                          >
                            {v}
                          </span>
                        ))}
                      </div>
                      <p className="font-black text-zinc-900 text-lg leading-tight truncate">{s.cliente || "Sin nombre"}</p>
                      {s.origen && <p className="text-xs text-zinc-500 mt-0.5">📍 {s.origen}{s.destino ? ` → ${s.destino}` : ""}</p>}
                      {s.descripcion && <p className="text-sm text-zinc-500 mt-1 line-clamp-2">{s.descripcion}</p>}
                    </div>
                    {s.precio && (
                      <div className="text-right shrink-0">
                        <p className="text-xs text-zinc-400 mb-0.5">Precio</p>
                        <p className="text-lg font-black text-zinc-900">{Number(s.precio).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</p>
                      </div>
                    )}
                  </div>

                  {/* Cambio rápido de estado */}
                  <div className="mb-3">
                    <select
                      value={estado}
                      onChange={(e) => onCambiarEstado(s.id, e.target.value)}
                      className={`text-sm font-bold rounded-lg px-3 py-2 border-2 w-full md:w-auto cursor-pointer ${cfg.summary}`}
                    >
                      <option value="abierto">🟠 Abierto</option>
                      <option value="realizado">🟢 Realizado</option>
                    </select>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Btn size="sm" onClick={() => onView(s)}>👁 Ver</Btn>
                    <Btn size="sm" variant="secondary" onClick={() => onEdit(s)}>✏️ Editar</Btn>
                    <Btn size="sm" variant="danger" onClick={() => onDelete(s.id)}>🗑 Eliminar</Btn>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Botón flotante de búsqueda */}
      {!searchOpen && (
        <button
          onClick={() => setSearchOpen(true)}
          className="fixed bottom-6 right-6 w-16 h-16 bg-zinc-900 hover:bg-zinc-700 text-white rounded-full shadow-lg flex items-center justify-center text-2xl transition-all z-50"
        >
          🔍
        </button>
      )}

      {/* Overlay de búsqueda */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setSearchOpen(false); setQ(""); }} />
          <div className="relative bg-white rounded-t-2xl p-5 pb-8 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-zinc-900">Buscar servicio</h2>
              <button onClick={() => { setSearchOpen(false); setQ(""); }} className="text-zinc-400 hover:text-zinc-900 text-2xl leading-none p-1">×</button>
            </div>
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cliente, descripción, vehículo..."
              className="w-full border-2 border-zinc-200 rounded-xl px-4 py-3.5 text-base text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors mb-4"
            />
            <div className="overflow-y-auto flex-1">
              {q.trim() === "" && (
                <p className="text-center text-zinc-400 py-8">Escribe para buscar...</p>
              )}
              {q.trim() !== "" && searchResults.length === 0 && (
                <p className="text-center text-zinc-400 py-8">Sin resultados para "{q}"</p>
              )}
              {searchResults.map((s) => {
                const estadoCfg = ESTADOS[s.estado || "abierto"] || ESTADOS.abierto;
                return (
                  <button
                    key={s.id}
                    onClick={() => { setSearchOpen(false); setQ(""); onView(s); }}
                    className="w-full text-left p-4 border-b border-zinc-100 hover:bg-zinc-50 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-xs font-bold text-zinc-400">{s.numero}</span>
                      {s.fecha_servicio && (
                        <>
                          <span className="text-xs text-zinc-300">·</span>
                          <span className="text-xs text-zinc-400">{formatFecha(s.fecha_servicio)}</span>
                        </>
                      )}
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${estadoCfg.badge}`}>{estadoCfg.emoji} {estadoCfg.label}</span>
                    </div>
                    <p className="font-bold text-zinc-900">{s.cliente || "Sin nombre"}</p>
                    {s.origen && <p className="text-xs text-zinc-500">📍 {s.origen}{s.destino ? ` → ${s.destino}` : ""}</p>}
                    {s.descripcion && <p className="text-sm text-zinc-500 line-clamp-1 mt-0.5">{s.descripcion}</p>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListScreen;
