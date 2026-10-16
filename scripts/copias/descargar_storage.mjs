// Descarga todos los ficheros de los buckets de Supabase Storage a una
// carpeta local, conservando la ruta de cada uno. Lo usa la copia semanal
// (.github/workflows/copia-semanal.yml) y sirve igual a mano:
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/copias/descargar_storage.mjs ./salida
//
// La service_role se salta RLS: NUNCA en el navegador ni en el repositorio,
// solo en los secretos de GitHub o en tu terminal.

import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const destino = process.argv[2] || "storage";
if (!url || !key) {
  console.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

// list() no es recursivo: las carpetas vienen como entradas sin id
const listarTodo = async (bucket, carpeta = "") => {
  const rutas = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(bucket).list(carpeta, { limit: 1000, offset });
    if (error) throw new Error(`${bucket}/${carpeta}: ${error.message}`);
    for (const e of data) {
      const ruta = carpeta ? `${carpeta}/${e.name}` : e.name;
      if (e.id) rutas.push(ruta);
      else rutas.push(...await listarTodo(bucket, ruta));
    }
    if (data.length < 1000) break;
  }
  return rutas;
};

const { data: buckets, error } = await supabase.storage.listBuckets();
if (error) { console.error(error.message); process.exit(1); }

let total = 0;
for (const b of buckets) {
  const rutas = await listarTodo(b.id);
  for (const ruta of rutas) {
    const { data, error: e } = await supabase.storage.from(b.id).download(ruta);
    if (e) throw new Error(`No se pudo descargar ${b.id}/${ruta}: ${e.message}`);
    const fichero = join(destino, b.id, ruta);
    await mkdir(dirname(fichero), { recursive: true });
    await writeFile(fichero, Buffer.from(await data.arrayBuffer()));
  }
  console.log(`${b.id}: ${rutas.length} ficheros`);
  total += rutas.length;
}
console.log(`Total: ${total} ficheros`);
