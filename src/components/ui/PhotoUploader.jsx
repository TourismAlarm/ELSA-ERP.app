import { useState, useRef } from "react";
import { supabase } from "../../supabase";

const PhotoUploader = ({ solicitudId, existingPhotos = [], onPhotosChange }) => {
  const [photos, setPhotos] = useState(existingPhotos || []);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  console.log("PhotoUploader mounted with solicitudId:", solicitudId);

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

  const deletePhoto = async (photo) => {
    try {
      setUploading(true);
      const { error } = await supabase.storage
        .from("service-photos")
        .remove([photo.path]);

      if (error) throw error;

      const updatedPhotos = photos.filter((p) => p.id !== photo.id);
      setPhotos(updatedPhotos);
      onPhotosChange(updatedPhotos);
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
          {photos.map((photo) => (
            <div key={photo.id} className="relative group">
              <img
                src={photo.url}
                alt="Foto del servicio"
                className="w-full h-24 object-cover rounded-lg border-2 border-zinc-200"
              />
              <button
                type="button"
                onClick={() => deletePhoto(photo)}
                disabled={uploading}
                className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-black/50 rounded-lg flex items-center justify-center transition-opacity disabled:opacity-50"
              >
                <span className="text-white text-2xl">🗑</span>
              </button>
            </div>
          ))}
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
