// Acceso a Supabase desde las funciones de Vercel, por la API REST.
//
// rest(): con la clave pública (anon), como hace el navegador; con la sesión
// del usuario si se pasa token. Los permisos los pone la base de datos (RLS).
//
// admin(): con la clave de servicio, que se salta RLS. Solo para lo que el
// usuario no puede tocar por sí mismo (la conexión con Google) y siempre
// después de comprobar quién pregunta con quienEs().
//
// Primero las variables de la app (VITE_…), que son las del proyecto que usa
// el navegador; las SUPABASE_… las pone la integración de Vercel.
export const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const hayClaveServicio = () => Boolean(SERVICE_KEY);

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

export const admin = (ruta, opciones = {}) => {
  if (!SERVICE_KEY) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en Vercel");
  return fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...opciones,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...opciones.headers,
    },
  });
};

// Quién hace la petición, según su sesión: { id, activo, admin } o null si
// no hay sesión válida. Lo decide la base de datos (es_usuario_activo,
// es_admin), igual que para todo lo demás.
export const quienEs = async (req) => {
  const token = (req.headers?.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!u.ok) return null;
  const { id } = await u.json();
  const llama = async (fn) => {
    const r = await rest(`rpc/${fn}`, { token, method: "POST", body: "{}" });
    return r.ok ? (await r.json()) === true : false;
  };
  const [activo, esAdmin] = await Promise.all([llama("es_usuario_activo"), llama("es_admin")]);
  return { id, activo, admin: esAdmin };
};
