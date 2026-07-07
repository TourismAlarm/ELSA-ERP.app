import Btn from "./Btn";

// Panel inferior para abrir una dirección en Google Maps o Waze.
// Renderiza null si no hay dirección; el padre controla la visibilidad.
const MapasModal = ({ direccion, onClose }) => {
  if (!direccion) return null;

  const abrir = (url) => {
    window.open(url, "_blank");
    onClose();
  };

  const q = encodeURIComponent(direccion);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl p-5 pb-8">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-1">Abrir dirección</p>
            <p className="font-black text-zinc-900 truncate">📍 {direccion}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-900 text-2xl leading-none p-1 shrink-0">×</button>
        </div>
        <div className="flex flex-col gap-3">
          <Btn size="lg" className="w-full" onClick={() => abrir(`https://www.google.com/maps/search/?api=1&query=${q}`)}>
            🗺️ Google Maps
          </Btn>
          <Btn size="lg" variant="secondary" className="w-full" onClick={() => abrir(`https://waze.com/ul?q=${q}`)}>
            🚙 Waze
          </Btn>
          <Btn size="lg" variant="ghost" className="w-full" onClick={onClose}>Cancelar</Btn>
        </div>
      </div>
    </div>
  );
};

export default MapasModal;
