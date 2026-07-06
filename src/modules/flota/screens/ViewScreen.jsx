import { useState, useEffect } from "react";
import { Btn, PhotoGallery } from "../../../shared/components/ui";
import { textoSobre } from "../../../shared/lib/color";
import { NIVELES, estadoVencimiento, formatFecha } from "../vencimientos";
import { dbLoadMantenimientos, dbSaveMantenimiento, dbDeleteMantenimiento } from "../db";

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

const mantenimientoVacio = () => ({
  fecha: new Date().toISOString().slice(0, 10),
  descripcion: "",
  taller: "",
  coste: "",
  km: "",
});

const ViewScreen = ({ vehiculo, onEdit, onDelete, onBack }) => {
  const v = vehiculo;
  const [mantenimientos, setMantenimientos] = useState([]);
  const [loadingMant, setLoadingMant] = useState(true);
  const [nuevoMant, setNuevoMant] = useState(mantenimientoVacio());
  const [mostrarFormMant, setMostrarFormMant] = useState(false);
  const [guardandoMant, setGuardandoMant] = useState(false);

  useEffect(() => {
    let vivo = true;
    dbLoadMantenimientos(v.id).then((m) => {
      if (vivo) { setMantenimientos(m); setLoadingMant(false); }
    });
    return () => { vivo = false; };
  }, [v.id]);

  const setMant = (k) => (e) => setNuevoMant((m) => ({ ...m, [k]: e.target.value }));

  const handleAddMantenimiento = async () => {
    if (!nuevoMant.descripcion.trim()) { alert("Describe el mantenimiento o la reparación."); return; }
    setGuardandoMant(true);
    const saved = await dbSaveMantenimiento({ ...nuevoMant, vehiculo_id: v.id });
    setGuardandoMant(false);
    if (saved) {
      setMantenimientos((prev) => [saved, ...prev]);
      setNuevoMant(mantenimientoVacio());
      setMostrarFormMant(false);
    }
  };

  const handleDeleteMantenimiento = async (id) => {
    if (!confirm("¿Eliminar este mantenimiento?")) return;
    await dbDeleteMantenimiento(id);
    setMantenimientos((prev) => prev.filter((m) => m.id !== id));
  };

  const totalCoste = mantenimientos.reduce((acc, m) => acc + (m.coste ? Number(m.coste) : 0), 0);

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
          <span className="flex items-center gap-1.5 text-sm font-bold px-3 py-1 rounded" style={{ backgroundColor: v.color || "#a1a1aa", color: textoSobre(v.color) }}>
            <span className="w-3 h-3 rounded-full bg-white/70" /> Color
          </span>
          {v.matricula && <span className="text-sm font-bold bg-zinc-900 text-white px-3 py-1 rounded tracking-widest">{v.matricula}</span>}
          {v.tipo && <span className="text-sm font-semibold bg-zinc-100 text-zinc-700 px-3 py-1 rounded">{v.tipo}</span>}
        </div>

        {/* Vencimientos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <PanelVencimiento etiqueta="ITV" fecha={v.itv_vencimiento} />
          <PanelVencimiento etiqueta="Seguro" fecha={v.seguro_vencimiento} />
          {(v.vencimientos || []).map((x, i) => (
            <PanelVencimiento key={i} etiqueta={x.nombre || "Vencimiento"} fecha={x.fecha} />
          ))}
        </div>

        <div>
          <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-2">Notas</p>
          <p className="text-zinc-700 text-sm leading-relaxed whitespace-pre-wrap">{v.notas || "—"}</p>
        </div>

        {/* Documentación y fotos */}
        {v.fotos && v.fotos.length > 0 && (
          <div>
            <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-3">Documentación y fotos ({v.fotos.length})</p>
            <PhotoGallery photos={v.fotos} />
          </div>
        )}

        {/* Mantenimientos y reparaciones */}
        <div>
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase">
              Mantenimientos y reparaciones{mantenimientos.length > 0 ? ` (${mantenimientos.length})` : ""}
            </p>
            {totalCoste > 0 && (
              <span className="text-xs font-black bg-zinc-900 text-white px-2.5 py-1 rounded">
                Total: {totalCoste.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €
              </span>
            )}
          </div>

          {loadingMant ? (
            <p className="text-sm text-zinc-400 mb-3">Cargando historial...</p>
          ) : mantenimientos.length === 0 ? (
            <p className="text-sm text-zinc-400 mb-3">Sin mantenimientos registrados aún</p>
          ) : (
            <div className="flex flex-col gap-2 mb-3">
              {mantenimientos.map((m) => (
                <div key={m.id} className="border-2 border-zinc-200 rounded-xl p-4 relative">
                  <button
                    onClick={() => handleDeleteMantenimiento(m.id)}
                    className="absolute top-2 right-2 text-zinc-300 hover:text-red-600 transition-colors text-lg leading-none p-1"
                    title="Eliminar"
                  >
                    ×
                  </button>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-bold text-zinc-400">{m.fecha ? formatFecha(m.fecha) : "Sin fecha"}</span>
                    {m.taller && <span className="text-xs font-semibold bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded">🔧 {m.taller}</span>}
                    {m.km != null && m.km !== "" && <span className="text-xs font-semibold bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded">{Number(m.km).toLocaleString("es-ES")} km</span>}
                    {m.coste != null && m.coste !== "" && (
                      <span className="text-xs font-black bg-zinc-900 text-white px-2 py-0.5 rounded ml-auto">
                        {Number(m.coste).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-700">{m.descripcion}</p>
                </div>
              ))}
            </div>
          )}

          {mostrarFormMant ? (
            <div className="border-2 border-zinc-300 border-dashed rounded-xl p-4 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Fecha</p>
                  <input type="date" value={nuevoMant.fecha} onChange={setMant("fecha")} className="w-full border-2 border-zinc-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-zinc-900 bg-white" />
                </div>
                <div>
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Taller</p>
                  <input value={nuevoMant.taller} onChange={setMant("taller")} placeholder="Talleres García" className="w-full border-2 border-zinc-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-zinc-900 bg-white" />
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Descripción *</p>
                <input value={nuevoMant.descripcion} onChange={setMant("descripcion")} placeholder="Cambio de aceite y filtros" className="w-full border-2 border-zinc-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-zinc-900 bg-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Coste (€)</p>
                  <input type="number" min="0" step="0.01" value={nuevoMant.coste} onChange={setMant("coste")} placeholder="350" className="w-full border-2 border-zinc-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-zinc-900 bg-white" />
                </div>
                <div>
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Kilómetros</p>
                  <input type="number" min="0" value={nuevoMant.km} onChange={setMant("km")} placeholder="120000" className="w-full border-2 border-zinc-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:border-zinc-900 bg-white" />
                </div>
              </div>
              <div className="flex gap-2">
                <Btn size="md" className="flex-1" onClick={handleAddMantenimiento} disabled={guardandoMant}>
                  {guardandoMant ? "Guardando..." : "💾 Guardar mantenimiento"}
                </Btn>
                <Btn size="md" variant="secondary" onClick={() => setMostrarFormMant(false)}>Cancelar</Btn>
              </div>
            </div>
          ) : (
            <Btn size="md" variant="secondary" className="w-full" onClick={() => setMostrarFormMant(true)}>
              ➕ Añadir mantenimiento
            </Btn>
          )}
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
