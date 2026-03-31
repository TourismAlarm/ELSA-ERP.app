import { useState } from "react";
import { Btn } from "../components/ui";

const ESTADOS = {
  pendiente:   { label: "Pendiente",      emoji: "🟡", summary: "bg-amber-50 border-amber-200 text-amber-700",    badge: "bg-amber-100 text-amber-700" },
  seguimiento: { label: "En seguimiento", emoji: "🔵", summary: "bg-blue-50 border-blue-200 text-blue-700",       badge: "bg-blue-100 text-blue-700" },
  aceptado:    { label: "Aceptado",       emoji: "🟢", summary: "bg-emerald-50 border-emerald-200 text-emerald-700", badge: "bg-emerald-100 text-emerald-700" },
  rechazado:   { label: "Rechazado",      emoji: "🔴", summary: "bg-red-50 border-red-200 text-red-700",          badge: "bg-red-100 text-red-700" },
};

const TIPO_EMOJI = { whatsapp: "💬", email: "✉️", manual: "📝" };

const diasDesde = (fechaISO) => {
  if (!fechaISO) return null;
  return Math.floor((Date.now() - new Date(fechaISO).getTime()) / (1000 * 60 * 60 * 24));
};

const formatFecha = (fechaISO) =>
  new Date(fechaISO).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

const ViewScreen = ({ solicitud, config, onEdit, onDelete, onBack, onSendWhatsApp, onSendEmail, onGeneratePDF, onCambiarEstado, onAddNota }) => {
  const [sol, setSol] = useState(solicitud);
  const [nuevaNota, setNuevaNota] = useState("");
  const [addingNota, setAddingNota] = useState(false);

  const estado = sol.estado || "pendiente";
  const cfg = ESTADOS[estado] || ESTADOS.pendiente;
  const dias = diasDesde(sol.fecha_ultimo_contacto);
  const notas = [...(sol.notas_seguimiento || [])].reverse();

  const handleCambioEstado = async (nuevoEstado) => {
    await onCambiarEstado(sol.id, nuevoEstado);
    setSol((prev) => ({ ...prev, estado: nuevoEstado, fecha_ultimo_contacto: new Date().toISOString() }));
  };

  const handleAddNota = async () => {
    if (!nuevaNota.trim()) return;
    setAddingNota(true);
    const updated = await onAddNota(sol.id, nuevaNota.trim());
    if (updated) setSol((prev) => ({ ...prev, ...updated }));
    setNuevaNota("");
    setAddingNota(false);
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={onBack} className="text-zinc-400 hover:text-zinc-900 transition-colors text-2xl leading-none">←</button>
        <div>
          <p className="text-xs font-bold tracking-widest text-zinc-400 uppercase mb-0.5">Solicitud</p>
          <h1 className="text-3xl font-black text-zinc-900">{sol.numero}</h1>
        </div>
      </div>

      <div className="bg-white border-2 border-zinc-200 rounded-xl overflow-hidden shadow-sm mb-5">
        {/* Cabecera empresa */}
        <div className="bg-zinc-900 px-6 py-5 flex items-center gap-4">
          {config.logo
            ? <img src={config.logo} alt="logo" className="h-12 w-12 object-contain rounded bg-white p-1" />
            : <div className="h-12 w-12 bg-zinc-700 rounded flex items-center justify-center text-white text-xl">🏢</div>}
          <div>
            <p className="font-black text-white text-lg leading-tight">{config.nombre || "Mi Empresa"}</p>
            <p className="text-zinc-400 text-xs mt-0.5">{[config.tel, config.email].filter(Boolean).join("  ·  ")}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-zinc-400 text-xs">Fecha</p>
            <p className="text-white font-bold text-sm">{sol.fecha}</p>
          </div>
        </div>

        <div className="p-6 flex flex-col gap-5">
          {/* Estado */}
          <div className={`${cfg.summary} border-2 rounded-xl p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
            <div>
              <p className="text-xs font-bold tracking-widest uppercase mb-1 opacity-60">Estado actual</p>
              <span className={`text-base font-black px-3 py-1 rounded-lg ${cfg.badge}`}>{cfg.emoji} {cfg.label}</span>
              {dias !== null && (
                <p className="text-xs mt-2 opacity-70">
                  Último contacto: {dias === 0 ? "hoy" : `hace ${dias} día${dias !== 1 ? "s" : ""}`}
                </p>
              )}
            </div>
            <select
              value={estado}
              onChange={(e) => handleCambioEstado(e.target.value)}
              className={`text-sm font-bold rounded-lg px-3 py-2 border-2 cursor-pointer ${cfg.summary}`}
            >
              <option value="pendiente">🟡 Pendiente</option>
              <option value="seguimiento">🔵 En seguimiento</option>
              <option value="aceptado">🟢 Aceptado</option>
              <option value="rechazado">🔴 Rechazado</option>
            </select>
          </div>

          {/* Cliente */}
          <div className="bg-zinc-50 rounded-lg p-4">
            <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-2">Cliente</p>
            <p className="font-black text-zinc-900 text-xl">{sol.cliente}</p>
            {sol.telCliente && <p className="text-zinc-500 text-sm mt-1">📞 {sol.telCliente}</p>}
            {sol.emailCliente && <p className="text-zinc-500 text-sm mt-0.5">✉️ {sol.emailCliente}</p>}
          </div>

          {(sol.vehiculo || sol.tipoTrabajo || sol.tipo) && (
            <div className="flex flex-wrap gap-2">
              {sol.vehiculo && <span className="bg-zinc-100 text-zinc-800 text-sm font-bold px-4 py-1.5 rounded-full">🚛 {sol.vehiculo}</span>}
              {(sol.tipoTrabajo || sol.tipo) && <span className="bg-zinc-900 text-white text-sm font-bold px-4 py-1.5 rounded-full">🔧 {sol.tipoTrabajo || sol.tipo}</span>}
            </div>
          )}

          {(sol.origen || sol.destino) ? (
            <div className="grid grid-cols-2 gap-3">
              {sol.origen && <div className="bg-zinc-50 rounded-lg p-4"><p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-1">Origen (A)</p><p className="text-zinc-800 text-sm font-semibold">📍 {sol.origen}</p></div>}
              {sol.destino && <div className="bg-zinc-50 rounded-lg p-4"><p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-1">Destino (B)</p><p className="text-zinc-800 text-sm font-semibold">📍 {sol.destino}</p></div>}
            </div>
          ) : sol.direccion && (
            <div className="bg-zinc-50 rounded-lg p-4">
              <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-2">Dirección del servicio</p>
              <p className="text-zinc-800 text-sm font-semibold">📍 {sol.direccion}</p>
            </div>
          )}

          {(sol.metros || sol.peso || sol.bultos) && (
            <div className="bg-zinc-50 rounded-lg p-4">
              <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-3">Datos de carga</p>
              <div className="flex gap-6 flex-wrap">
                {sol.metros && <div><p className="text-xs text-zinc-400">Metros descarga</p><p className="font-black text-zinc-900">{sol.metros} m</p></div>}
                {sol.peso   && <div><p className="text-xs text-zinc-400">Peso</p><p className="font-black text-zinc-900">{sol.peso} kg</p></div>}
                {sol.bultos && <div><p className="text-xs text-zinc-400">Nº bultos</p><p className="font-black text-zinc-900">{sol.bultos}</p></div>}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-2">Descripción del servicio</p>
            <p className="text-zinc-700 text-sm leading-relaxed whitespace-pre-wrap">{sol.descripcion || "—"}</p>
          </div>

          {/* Seguimiento */}
          <div>
            <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-3">Seguimiento</p>
            {notas.length > 0 ? (
              <div className="relative pl-6 border-l-2 border-zinc-200 mb-4">
                {notas.map((nota, i) => (
                  <div key={i} className="mb-4 relative">
                    <div className="absolute -left-[25px] top-1 w-3 h-3 rounded-full bg-zinc-300 border-2 border-white" />
                    <p className="text-sm text-zinc-700">{TIPO_EMOJI[nota.tipo] || "📝"} {nota.texto}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">{formatFecha(nota.fecha)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-400 mb-4">Sin notas de seguimiento aún</p>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={nuevaNota}
                onChange={(e) => setNuevaNota(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddNota()}
                placeholder="Escribe una nota..."
                className="flex-1 border-2 border-zinc-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-zinc-500"
              />
              <Btn size="sm" onClick={handleAddNota} disabled={addingNota || !nuevaNota.trim()}>+ Añadir</Btn>
            </div>
          </div>

          {sol.precio && (
            <div className="bg-zinc-900 rounded-lg p-4 flex items-center justify-between">
              <p className="text-zinc-400 font-bold text-sm">PRECIO ESTIMADO</p>
              <p className="text-white font-black text-2xl">{Number(sol.precio).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border-2 border-zinc-200 rounded-xl p-5 mb-4">
        <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-3">Enviar a administración</p>
        <div className="flex gap-3">
          <Btn size="lg" variant="whatsapp" className="flex-1" onClick={() => onSendWhatsApp(sol)}>💬 WhatsApp</Btn>
          <Btn size="lg" variant="email" className="flex-1" onClick={() => onSendEmail(sol)}>✉️ Email</Btn>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Btn size="md" variant="secondary" className="flex-1" onClick={onEdit}>✏️ Editar</Btn>
        <Btn size="md" variant="secondary" onClick={() => onGeneratePDF(sol)}>📄 PDF</Btn>
        <Btn size="md" variant="danger" onClick={onDelete}>🗑 Eliminar</Btn>
      </div>
    </div>
  );
};

export default ViewScreen;
