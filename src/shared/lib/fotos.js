import { useState, useEffect } from "react";
import { supabase } from "./supabase";

export const BUCKET_FOTOS = "service-photos";

// El bucket es privado: las fotos son trabajos en casa de clientes y no deben
// quedar accesibles con una URL suelta. Se guarda el path en la base de datos
// y la URL se firma al mostrarla, con caducidad.
const CADUCIDAD_FIRMA = 60 * 60; // 1 hora

// Las fotos salen de la cámara del móvil a 4-8 MB. Subirlas tal cual es lento
// con la cobertura de una obra y llena el almacenamiento en semanas. Se
// redimensionan y recomprimen en el navegador antes de subirlas.
const LADO_MAXIMO = 1800;   // px, suficiente para leer una matrícula o un albarán en papel
const CALIDAD_JPEG = 0.82;
export const TAMANO_MAXIMO = 15 * 1024 * 1024; // 15 MB antes de comprimir

const leerImagen = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se ha podido leer la imagen")); };
    img.src = url;
  });

// Devuelve un Blob comprimido, o el fichero original si comprimir no ayuda
// (imágenes ya pequeñas, PNG con transparencia, o un navegador que falle).
export const comprimirImagen = async (file) => {
  if (file.type === "image/gif") return file; // podría estar animado
  try {
    const img = await leerImagen(file);
    const escala = Math.min(1, LADO_MAXIMO / Math.max(img.width, img.height));
    // Ya es pequeña y ligera: no vale la pena recomprimir y perder calidad
    if (escala === 1 && file.size < 900 * 1024) return file;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * escala);
    canvas.height = Math.round(img.height * escala);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; // fondo blanco: el JPEG no tiene transparencia
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", CALIDAD_JPEG));
    if (!blob || blob.size >= file.size) return file;
    return blob;
  } catch (e) {
    console.error("No se ha podido comprimir la foto, se sube el original:", e);
    return file;
  }
};

const extension = (file, blob) => {
  if (blob !== file) return "jpg"; // si se ha comprimido, sale JPEG
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  return /^[a-z0-9]{1,5}$/.test(ext) ? ext : "jpg";
};

export const subirFoto = async (carpeta, id, file) => {
  if (file.size > TAMANO_MAXIMO) {
    alert(`"${file.name}" ocupa ${(file.size / 1024 / 1024).toFixed(1)} MB y el máximo son ${TAMANO_MAXIMO / 1024 / 1024} MB.`);
    return null;
  }

  const blob = await comprimirImagen(file);
  const nombre = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${extension(file, blob)}`;
  const path = `${carpeta}/${id}/${nombre}`;

  const { error } = await supabase.storage
    .from(BUCKET_FOTOS)
    .upload(path, blob, { upsert: false, contentType: blob.type || file.type });

  if (error) {
    console.error(error);
    const falta = /bucket/i.test(error.message || "");
    alert(falta
      ? `No existe el almacén de fotos "${BUCKET_FOTOS}" en Supabase. Hay que crearlo antes de poder adjuntar fotos.`
      : "No se ha podido subir la foto: " + error.message);
    return null;
  }

  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`,
    path,
    tamano: blob.size,
    uploadedAt: new Date().toISOString(),
  };
};

export const borrarFoto = async (path) => {
  const { error } = await supabase.storage.from(BUCKET_FOTOS).remove([path]);
  if (error) { console.error(error); alert("No se ha podido eliminar la foto: " + error.message); return false; }
  return true;
};

// Firma en bloque los paths de una lista de fotos y devuelve {path: url}.
// Las fotos antiguas que solo tengan `url` pública se dejan como están.
export const firmarFotos = async (fotos = []) => {
  const paths = fotos.map((f) => f?.path).filter(Boolean);
  if (paths.length === 0) return {};
  const { data, error } = await supabase.storage
    .from(BUCKET_FOTOS)
    .createSignedUrls(paths, CADUCIDAD_FIRMA);
  if (error) { console.error(error); return {}; }
  return Object.fromEntries(
    (data || []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl])
  );
};

// Hook para pintar fotos: firma los paths al montar y devuelve la función que
// da la URL de cada foto. Con `url` heredada de cuando el bucket era público,
// se usa esa y no se firma nada.
export const useUrlsFotos = (fotos = []) => {
  const [firmadas, setFirmadas] = useState({});
  const clave = fotos.map((f) => f?.path).filter(Boolean).join("|");

  useEffect(() => {
    if (!clave) { setFirmadas({}); return; }
    let vivo = true;
    firmarFotos(fotos).then((m) => { if (vivo) setFirmadas(m); });
    return () => { vivo = false; };
    // `clave` resume los paths: se vuelve a firmar solo si cambian de verdad
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  return (foto) => (foto?.path ? firmadas[foto.path] : null) || foto?.url || "";
};
