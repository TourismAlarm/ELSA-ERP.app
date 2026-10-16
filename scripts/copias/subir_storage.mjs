// Sube a Supabase Storage una carpeta descargada con descargar_storage.mjs.
// Crea los buckets si no existen (fotos privado, DeCA público, como en
// producción). Solo para restaurar en un proyecto NUEVO.
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/copias/subir_storage.mjs ./storage

import { createClient } from "@supabase/supabase-js";
import { readdir, readFile } from "node:fs/promises";
import { join, relative, extname } from "node:path";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const origen = process.argv[2] || "storage";
if (!url || !key) { console.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }

const supabase = createClient(url, key, { auth: { persistSession: false } });
const PUBLICOS = new Set(["deca-docs"]);
const TIPOS = { ".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

const ficheros = async (dir) => {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await ficheros(p)); else out.push(p);
  }
  return out;
};

for (const bucket of await readdir(origen)) {
  await supabase.storage.createBucket(bucket, { public: PUBLICOS.has(bucket) }); // si ya existe, da error y se ignora
  const lista = await ficheros(join(origen, bucket));
  for (const f of lista) {
    const ruta = relative(join(origen, bucket), f).split("\\").join("/");
    const { error } = await supabase.storage.from(bucket)
      .upload(ruta, await readFile(f), { upsert: true, contentType: TIPOS[extname(f).toLowerCase()] });
    if (error) throw new Error(`${bucket}/${ruta}: ${error.message}`);
  }
  console.log(`${bucket}: ${lista.length} ficheros`);
}
