// Búsqueda de clientes y datos que se copian al documento.
// OJO: en los documentos siempre se guarda el nombre fiscal (c.nombre); el
// resto de campos sirven para encontrar y distinguir al cliente.

// Los teléfonos se escriben de mil maneras ("600 11 22 33", "+34600112233"),
// así que para buscar se comparan solo los dígitos.
const soloDigitos = (s) => (s || "").replace(/\D/g, "");

// Sin acentos: escribir "gruas" tiene que encontrar "Grúas", que es justo lo
// que se teclea con prisa desde el móvil.
const texto = (s) =>
  (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

// Campos por los que se puede encontrar un cliente: nombre fiscal, comercial,
// número de cliente, NIF/CIF, email y los dos teléfonos.
export const buscaCliente = (c, q) => {
  const term = texto(q);
  if (!term) return false;

  const enTexto = [c.nombre, c.nombre_comercial, c.numero, c.nifCif, c.email]
    .some((v) => texto(v).includes(term));
  if (enTexto) return true;

  // Por teléfono solo si lo escrito tiene dígitos, para que buscar "pepe" no
  // entre por aquí
  const digitos = soloDigitos(term);
  if (digitos.length < 3) return false;
  return [c.tel, c.movil].some((v) => soloDigitos(v).includes(digitos));
};

// El cliente ya existe si lo escrito coincide exactamente con su nombre fiscal,
// su comercial o su número; evita ofrecer "guardar como nuevo cliente" y
// duplicarlo.
export const clienteYaExiste = (clientes, texto_) => {
  const escrito = texto(texto_);
  if (!escrito) return false;
  return clientes.some((c) =>
    [c.nombre, c.nombre_comercial, c.numero].some((v) => texto(v) === escrito)
  );
};

// Devuelve el nombre comercial solo si aporta algo distinto al fiscal
export const comercialDistinto = (c) => {
  const comercial = (c.nombre_comercial || "").trim();
  return comercial && comercial.toLowerCase() !== (c.nombre || "").trim().toLowerCase()
    ? comercial
    : "";
};

// Segunda línea de la sugerencia: lo que sirve para distinguir a un cliente de
// otro que se llame parecido.
export const detallesCliente = (c) =>
  [c.nifCif, c.tel || c.movil, c.email, c.poblacion].filter(Boolean).join(" · ");

// Datos del cliente que se copian al documento al elegirlo. En el documento se
// guarda SIEMPRE el nombre fiscal, nunca el comercial.
// Se usa tanto al escoger del autocompletado como al acabar de crear el cliente
// desde el propio formulario, para que en los dos casos quede igual de relleno.
export const datosDelCliente = (c, actual = {}) => ({
  cliente: c.nombre,
  cliente_id: c.id ?? null,
  nifCif: c.nifCif || actual.nifCif || "",
  dirFact: c.dirFact || actual.dirFact || "",
  telCliente: c.tel || c.movil || actual.telCliente || "",
  emailCliente: c.email || actual.emailCliente || "",
});
