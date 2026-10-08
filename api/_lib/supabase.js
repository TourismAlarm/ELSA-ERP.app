// Acceso a Supabase desde las funciones de Vercel. Sin cliente ni clave de
// servicio: se llama a la API REST con la clave pública (anon), como hace el
// navegador, y los permisos los pone la base de datos (RLS y funciones).
// Las variables son las mismas que usa la app; en Vercel están disponibles
// también en el servidor.
export const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

// token: el de la sesión del usuario, o nada para llamar como anon
export const rest = (ruta, { token, ...opciones } = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...opciones,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      ...opciones.headers,
    },
  });
