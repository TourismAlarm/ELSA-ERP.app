import { Btn } from "../components/ui";

const ViewScreen = ({ solicitud: s, config, onEdit, onDelete, onBack, onSendWhatsApp, onSendEmail, onGeneratePDF }) => (
  <div className="max-w-xl mx-auto px-4 py-10">
    <div className="flex items-center gap-3 mb-8">
      <button onClick={onBack} className="text-zinc-400 hover:text-zinc-900 transition-colors text-2xl leading-none">←</button>
      <div>
        <p className="text-xs font-bold tracking-widest text-zinc-400 uppercase mb-0.5">Solicitud</p>
        <h1 className="text-3xl font-black text-zinc-900">{s.numero}</h1>
      </div>
    </div>

    <div className="bg-white border-2 border-zinc-200 rounded-xl overflow-hidden shadow-sm mb-5">
      <div className="bg-zinc-900 px-6 py-5 flex items-center gap-4">
        {config.logo ? <img src={config.logo} alt="logo" className="h-12 w-12 object-contain rounded bg-white p-1" /> : <div className="h-12 w-12 bg-zinc-700 rounded flex items-center justify-center text-white text-xl">🏢</div>}
        <div>
          <p className="font-black text-white text-lg leading-tight">{config.nombre || "Mi Empresa"}</p>
          <p className="text-zinc-400 text-xs mt-0.5">{[config.tel, config.email].filter(Boolean).join("  ·  ")}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-zinc-400 text-xs">Fecha</p>
          <p className="text-white font-bold text-sm">{s.fecha}</p>
        </div>
      </div>

      <div className="p-6 flex flex-col gap-5">
        <div className="bg-zinc-50 rounded-lg p-4">
          <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-2">Cliente</p>
          <p className="font-black text-zinc-900 text-xl">{s.cliente}</p>
          {s.telCliente && <p className="text-zinc-500 text-sm mt-1">📞 {s.telCliente}</p>}
        </div>

        {(s.vehiculo || s.tipoTrabajo || s.tipo) && (
          <div className="flex flex-wrap gap-2">
            {s.vehiculo && <span className="bg-zinc-100 text-zinc-800 text-sm font-bold px-4 py-1.5 rounded-full">🚛 {s.vehiculo}</span>}
            {(s.tipoTrabajo || s.tipo) && <span className="bg-zinc-900 text-white text-sm font-bold px-4 py-1.5 rounded-full">🔧 {s.tipoTrabajo || s.tipo}</span>}
          </div>
        )}

        {(s.origen || s.destino) ? (
          <div className="grid grid-cols-2 gap-3">
            {s.origen && <div className="bg-zinc-50 rounded-lg p-4"><p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-1">Origen (A)</p><p className="text-zinc-800 text-sm font-semibold">📍 {s.origen}</p></div>}
            {s.destino && <div className="bg-zinc-50 rounded-lg p-4"><p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-1">Destino (B)</p><p className="text-zinc-800 text-sm font-semibold">📍 {s.destino}</p></div>}
          </div>
        ) : s.direccion && (
          <div className="bg-zinc-50 rounded-lg p-4">
            <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-2">Dirección del servicio</p>
            <p className="text-zinc-800 text-sm font-semibold">📍 {s.direccion}</p>
          </div>
        )}

        {(s.metros || s.peso || s.bultos) && (
          <div className="bg-zinc-50 rounded-lg p-4">
            <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-3">Datos de carga</p>
            <div className="flex gap-6 flex-wrap">
              {s.metros && <div><p className="text-xs text-zinc-400">Metros descarga</p><p className="font-black text-zinc-900">{s.metros} m</p></div>}
              {s.peso   && <div><p className="text-xs text-zinc-400">Peso</p><p className="font-black text-zinc-900">{s.peso} kg</p></div>}
              {s.bultos && <div><p className="text-xs text-zinc-400">Nº bultos</p><p className="font-black text-zinc-900">{s.bultos}</p></div>}
            </div>
          </div>
        )}

        <div>
          <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-2">Descripción del servicio</p>
          <p className="text-zinc-700 text-sm leading-relaxed whitespace-pre-wrap">{s.descripcion || "—"}</p>
        </div>

        {s.precio && (
          <div className="bg-zinc-900 rounded-lg p-4 flex items-center justify-between">
            <p className="text-zinc-400 font-bold text-sm">PRECIO ESTIMADO</p>
            <p className="text-white font-black text-2xl">{Number(s.precio).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</p>
          </div>
        )}
      </div>
    </div>

    <div className="bg-white border-2 border-zinc-200 rounded-xl p-5 mb-4">
      <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-3">Enviar a administración</p>
      <div className="flex gap-3">
        <Btn size="lg" variant="whatsapp" className="flex-1" onClick={() => onSendWhatsApp(s)}>💬 WhatsApp</Btn>
        <Btn size="lg" variant="email" className="flex-1" onClick={() => onSendEmail(s)}>✉️ Email</Btn>
      </div>
    </div>

    <div className="flex gap-3 flex-wrap">
      <Btn size="md" variant="secondary" className="flex-1" onClick={onEdit}>✏️ Editar</Btn>
      <Btn size="md" variant="secondary" onClick={() => onGeneratePDF(s)}>📄 PDF</Btn>
      <Btn size="md" variant="danger" onClick={onDelete}>🗑 Eliminar</Btn>
    </div>
  </div>
);

export default ViewScreen;
