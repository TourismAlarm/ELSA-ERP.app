import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Supabase corta toda respuesta de la API en un máximo de filas (1.000 por
// defecto) y lo hace en silencio: no da error, simplemente devuelve menos.
// Con los 1.481 clientes importados de Factusol la app enseñaba 1.000 y los
// 481 últimos por orden alfabético parecían no existir: no salían al buscar y
// el importador los daba por nuevos, con riesgo de duplicarlos al reimportar.
//
// Por eso las listas se piden por páginas hasta que la base de datos deja de
// devolver filas. Se avanza por lo que llega de verdad, no por lo que se pide,
// así que sigue funcionando aunque el límite del proyecto sea otro.
const TAMANO_PAGINA = 1000;
const MAX_PAGINAS = 100; // freno de seguridad: 100.000 filas es mucho más de lo que mueve la app

export const cargarTodas = async (tabla, { orden = "id", ascendente = true } = {}) => {
  const filas = [];

  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    let consulta = supabase.from(tabla).select("*").order(orden, { ascending: ascendente });
    // Desempate por id: cuando dos filas empatan en el orden pedido, la base de
    // datos no garantiza cuál va antes, y entre una página y la siguiente una
    // podría repetirse o perderse.
    if (orden !== "id") consulta = consulta.order("id", { ascending: true });

    const { data, error } = await consulta.range(filas.length, filas.length + TAMANO_PAGINA - 1);
    if (error) { console.error(error); return null; }
    if (!data || data.length === 0) return filas;
    filas.push(...data);
  }

  console.error(`cargarTodas(${tabla}): demasiadas páginas, se corta por seguridad`);
  return filas;
};
