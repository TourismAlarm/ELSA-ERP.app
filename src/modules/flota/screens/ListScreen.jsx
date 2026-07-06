import { Btn } from "../../../shared/components/ui";
import { NIVELES, estadoVencimiento, formatFecha } from "../vencimientos";

const Semaforo = ({ etiqueta, fecha }) => {
  const estado = estadoVencimiento(fecha);
  const cfg = NIVELES[estado.nivel];
  return (
    <div className={`flex items-center justify-between gap-2 border-2 rounded-lg px-3 py-2 ${cfg.chip}`}>
      <span className="flex items-center gap-2 text-xs font-black uppercase tracking-wider">
        <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
        {etiqueta}
      </span>
      <span className="text-xs font-bold text-right">
        {fecha ? `${formatFecha(fecha)} · ${estado.texto}` : "Sin fecha"}
      </span>
    </div>
  );
};

const fechasDe = (v) => [
  v.itv_vencimiento,
  v.seguro_vencimiento,
  ...(v.vencimientos || []).map((x) => x.fecha),
];

const ListScreen = ({ vehiculos, onNew, onView, onEdit, onDelete, onConfig, loading }) => {
  const conAviso = vehiculos.filter((v) =>
    fechasDe(v).some((f) => {
      const nivel = estadoVencimiento(f).nivel;
      return nivel === "pronto" || nivel === "vencido";
    })
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">

      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <p className="text-xs font-bold tracking-widest text-zinc-400 uppercase mb-1">Vehículos y equipos</p>
          <h1 className="text-3xl font-black text-zinc-900">Flota</h1>
        </div>
        <Btn variant="ghost" size="sm" onClick={onConfig}>⚙️ Config</Btn>
      </div>

      <Btn size="lg" className="w-full mb-6" onClick={onNew}>➕ Nuevo Vehículo</Btn>

      {/* Aviso de vencimientos */}
      {conAviso.length > 0 && (
        <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-5 mb-6">
          <p className="text-orange-800 font-black text-lg">
            ⚠️ {conAviso.length} {conAviso.length === 1 ? "vehículo" : "vehículos"} con ITV o seguro próximos a vencer o vencidos
          </p>
          <p className="text-orange-700 text-sm mt-1 font-semibold">
            {conAviso.map((v) => v.nombre).join(" · ")}
          </p>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="text-center py-16 text-zinc-400">
          <div className="text-4xl mb-3">⏳</div>
          <p className="font-semibold">Cargando flota...</p>
        </div>
      ) : vehiculos.length === 0 ? (
        <div className="text-center py-16 text-zinc-400">
          <div className="text-5xl mb-3">🚚</div>
          <p className="font-semibold">Aún no hay vehículos</p>
          <p className="text-sm mt-1">Añade el primero con el botón de arriba</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {vehiculos.map((v) => (
            <div key={v.id} className="bg-white border-2 border-zinc-200 rounded-xl overflow-hidden hover:border-zinc-400 transition-colors">
              <div className="p-5">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {v.matricula && <span className="text-xs font-bold bg-zinc-900 text-white px-2 py-0.5 rounded tracking-widest">{v.matricula}</span>}
                  {v.tipo && <span className="text-xs font-semibold bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded">{v.tipo}</span>}
                </div>
                <p className="font-black text-zinc-900 text-lg leading-tight truncate mb-3 flex items-center gap-2">
                  <span className="w-4 h-4 rounded shrink-0" style={{ backgroundColor: v.color || "#a1a1aa" }} />
                  🚚 {v.nombre}
                </p>

                <div className="flex flex-col gap-2 mb-4">
                  <Semaforo etiqueta="ITV" fecha={v.itv_vencimiento} />
                  <Semaforo etiqueta="Seguro" fecha={v.seguro_vencimiento} />
                  {(v.vencimientos || []).map((x, i) => (
                    <Semaforo key={i} etiqueta={x.nombre || "Vencimiento"} fecha={x.fecha} />
                  ))}
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Btn size="sm" onClick={() => onView(v)}>👁 Ver</Btn>
                  <Btn size="sm" variant="secondary" onClick={() => onEdit(v)}>✏️ Editar</Btn>
                  <Btn size="sm" variant="danger" onClick={() => onDelete(v.id)}>🗑 Eliminar</Btn>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ListScreen;
