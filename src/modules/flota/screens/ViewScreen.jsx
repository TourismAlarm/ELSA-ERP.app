import { Btn } from "../../../shared/components/ui";
import { NIVELES, estadoVencimiento, formatFecha } from "../vencimientos";

const PanelVencimiento = ({ etiqueta, fecha }) => {
  const estado = estadoVencimiento(fecha);
  const cfg = NIVELES[estado.nivel];
  return (
    <div className={`border-2 rounded-xl p-4 ${cfg.chip}`}>
      <p className="text-xs font-bold tracking-widest uppercase mb-1 opacity-60">{etiqueta}</p>
      <p className="text-base font-black flex items-center gap-2">
        <span className={`w-3 h-3 rounded-full ${cfg.dot}`} />
        {fecha ? formatFecha(fecha) : "Sin fecha"}
      </p>
      {fecha && <p className="text-sm font-bold mt-1">{estado.texto}</p>}
    </div>
  );
};

const ViewScreen = ({ vehiculo, onEdit, onDelete, onBack }) => {
  const v = vehiculo;
  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={onBack} className="text-zinc-400 hover:text-zinc-900 transition-colors text-2xl leading-none">←</button>
        <div>
          <p className="text-xs font-bold tracking-widest text-zinc-400 uppercase mb-0.5">Vehículo</p>
          <h1 className="text-3xl font-black text-zinc-900">🚚 {v.nombre}</h1>
        </div>
      </div>

      <div className="bg-white border-2 border-zinc-200 rounded-xl shadow-sm mb-5 p-6 flex flex-col gap-5">

        <div className="flex items-center gap-2 flex-wrap">
          {v.matricula && <span className="text-sm font-bold bg-zinc-900 text-white px-3 py-1 rounded tracking-widest">{v.matricula}</span>}
          {v.tipo && <span className="text-sm font-semibold bg-zinc-100 text-zinc-700 px-3 py-1 rounded">{v.tipo}</span>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <PanelVencimiento etiqueta="ITV" fecha={v.itv_vencimiento} />
          <PanelVencimiento etiqueta="Seguro" fecha={v.seguro_vencimiento} />
        </div>

        <div>
          <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-2">Notas</p>
          <p className="text-zinc-700 text-sm leading-relaxed whitespace-pre-wrap">{v.notas || "—"}</p>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Btn size="md" variant="secondary" className="flex-1" onClick={onEdit}>✏️ Editar</Btn>
        <Btn size="md" variant="danger" onClick={onDelete}>🗑 Eliminar</Btn>
      </div>
    </div>
  );
};

export default ViewScreen;
