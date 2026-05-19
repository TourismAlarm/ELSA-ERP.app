import { useState, useEffect } from "react";

const PhotoGallery = ({ photos = [] }) => {
  const [viewingIndex, setViewingIndex] = useState(null);

  useEffect(() => {
    if (viewingIndex === null) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setViewingIndex(null);
      } else if (e.key === "ArrowLeft") {
        setViewingIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
      } else if (e.key === "ArrowRight") {
        setViewingIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewingIndex, photos.length]);

  if (!photos || photos.length === 0) return null;

  return (
    <>
      {/* Grid de miniaturas */}
      <div className="grid grid-cols-2 gap-3">
        {photos.map((foto, index) => (
          <button
            key={foto.id}
            type="button"
            onClick={() => setViewingIndex(index)}
            className="relative overflow-hidden rounded-lg border-2 border-zinc-200 hover:border-zinc-400 transition-colors"
          >
            <img
              src={foto.url}
              alt="Foto del servicio"
              className="w-full h-32 object-cover hover:opacity-75 transition-opacity"
            />
            <div className="absolute inset-0 opacity-0 hover:opacity-100 bg-black/40 flex items-center justify-center transition-opacity">
              <span className="text-white text-2xl">🔍</span>
            </div>
          </button>
        ))}
      </div>

      {/* Modal galería */}
      {viewingIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setViewingIndex(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={photos[viewingIndex].url}
              alt="Foto del servicio"
              className="w-full h-full object-contain rounded-lg"
            />

            {/* Botón cerrar */}
            <button
              type="button"
              onClick={() => setViewingIndex(null)}
              className="absolute top-4 right-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-full p-3 transition-colors"
            >
              ✕
            </button>

            {/* Navegación */}
            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setViewingIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1))}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-zinc-800/80 hover:bg-zinc-700 text-white rounded-full p-3 transition-colors"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => setViewingIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0))}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-zinc-800/80 hover:bg-zinc-700 text-white rounded-full p-3 transition-colors"
                >
                  →
                </button>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-zinc-800/80 text-white px-3 py-2 rounded-full text-sm">
                  {viewingIndex + 1} de {photos.length}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default PhotoGallery;
