// Búsqueda de clientes por nombre fiscal y nombre comercial.
// OJO: en los documentos siempre se guarda el nombre fiscal (c.nombre),
// el comercial solo sirve para encontrar y distinguir al cliente.

export const buscaCliente = (c, q) => {
  const term = (q || "").trim().toLowerCase();
  if (!term) return false;
  return [c.nombre, c.nombre_comercial].some((n) => (n || "").toLowerCase().includes(term));
};

// Devuelve el nombre comercial solo si aporta algo distinto al fiscal
export const comercialDistinto = (c) => {
  const comercial = (c.nombre_comercial || "").trim();
  return comercial && comercial.toLowerCase() !== (c.nombre || "").trim().toLowerCase()
    ? comercial
    : "";
};
