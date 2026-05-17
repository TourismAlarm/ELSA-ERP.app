import { useState, useRef, useEffect } from "react";
import { supabase } from "../../supabase";

const PhotoUploader = ({ solicitudId, existingPhotos = [], onPhotosChange }) => {
  const [photos, setPhotos] = useState(existingPhotos || []);
  const [uploading, setUploading] = useState(false);
  const [viewingIndex, setViewingIndex] = useState(null);
  const fileInputRef = useRef(null);

  const uploadPhoto = async (file) => {
    try {
      setUploading(true);
      const filename = `${Date.now()}_${file.name}`;
      const filePath = `solicitudes/${solicitudId}/${filename}`;

      const { error: uploadError } = await supabase.storage
        .from("service-photos")
        .upload(filePath, file, { upsert: false });

      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage
        .from("service-photos")
        .getPublicUrl(filePath);

      const newPhoto = {
        id: Date.now(),
        url: publicUrl.publicUrl,
        path: filePath,
        uploadedAt: new Date().toISOString(),
      };

      const updatedPhotos = [...photos, newPhoto];
      setPhotos(updatedPhotos);
      onPhotosChange(updatedPhotos);
    } catch (error) {
      console.error("Error uploading photo:", error);
      alert("Error al subir la foto. Intenta de nuevo.");
    } finally {
      setUploading(false);
    }
  };

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

  const deletePhoto = async (photo, e) => {
    if (e) {
      e.stopPropagation();
    }
    try {
      setUploading(true);
      const { error } = await supabase.storage
        .from("service-photos")
        .remove([photo.path]);

      if (error) throw error;

      const updatedPhotos = photos.filter((p) => p.id !== photo.id);
      setPhotos(updatedPhotos);
      onPhotosChange(updatedPhotos);
      setViewingIndex(null);
    } catch (error) {
      console.error("Error deleting photo:", error);
      alert("Error al eliminar la foto.");
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e) => {
    const files = e.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) {
        alert("Solo se permiten archivos de imagen.");
        continue;
      }
      uploadPhoto(file);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase">Fotos del servicio</p>
        {photos.length > 0 && <span className="text-xs font-bold bg-zinc-100 text-zinc-700 px-2 py-1 rounded">{photos.length}</span>}
      </div>

      {/* Grid de fotos existentes */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          {photos.map((photo, index) => (
            <div key={photo.id} className="relative group">
              <button
                type="button"
                onClick={() => setViewingIndex(index)}
                className="w-full h-24 rounded-lg border-2 border-zinc-200 overflow-hidden hover:border-zinc-400 transition-colors"
              >
                <img
                  src={photo.url}
                  alt="Foto del servicio"
                  className="w-full h-full object-cover group-hover:opacity-75 transition-opacity"
                />
              </button>
              <button
                type="button"
                onClick={(e) => deletePhoto(photo, e)}
                disabled={uploading}
                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 transition-opacity disabled:opacity-50"
              >
                <span className="text-sm">✕</span>
              </button>
            </div>
          ))}
        </div>
      )}

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

            {/* Controles del modal */}
            <div className="absolute top-4 right-4 flex gap-2">
              <button
                type="button"
                onClick={() => deletePhoto(photos[viewingIndex])}
                disabled={uploading}
                className="bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-full p-3 transition-colors"
              >
                🗑
              </button>
              <button
                type="button"
                onClick={() => setViewingIndex(null)}
                className="bg-zinc-800 hover:bg-zinc-700 text-white rounded-full p-3 transition-colors"
              >
                ✕
              </button>
            </div>

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

      {/* Área de carga */}
      <div
        className="border-2 border-dashed border-zinc-300 rounded-lg p-6 text-center hover:border-zinc-400 transition-colors"
        onDragOver={(e) => {
          e.preventDefault();
          e.currentTarget.classList.add("border-zinc-500");
        }}
        onDragLeave={(e) => {
          e.currentTarget.classList.remove("border-zinc-500");
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.classList.remove("border-zinc-500");
          const files = e.dataTransfer.files;
          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.type.startsWith("image/")) uploadPhoto(file);
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileSelect}
          disabled={uploading}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full"
        >
          <p className="text-3xl mb-2">{uploading ? "⏳" : "📸"}</p>
          <p className="text-sm font-semibold text-zinc-700">
            {uploading ? "Subiendo..." : "Haz clic o arrastra fotos aquí"}
          </p>
          <p className="text-xs text-zinc-400 mt-1">PNG, JPG, GIF hasta 10MB</p>
        </button>
      </div>
    </div>
  );
};

export default PhotoUploader;
