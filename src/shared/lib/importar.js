// Lectura de CSV exportado desde Excel para el alta masiva de clientes.
// Se hace a mano en vez de con una librería: el formato es sencillo y no
// compensa meter una dependencia en el bundle por esto.

// Excel en español exporta con punto y coma; el CSV "de toda la vida" usa
// comas. Se detecta cuál separa más columnas en la primera línea.
const detectarSeparador = (linea) => {
  const candidatos = [";", ",", "\t"];
  return candidatos.reduce((mejor, sep) =>
    partirLinea(linea, sep).length > partirLinea(linea, mejor).length ? sep : mejor
  , ";");
};

// Parte una línea respetando las comillas: un campo entrecomillado puede
// llevar el separador dentro ("Calle Mayor 1, 3º B") y "" es una comilla.
const partirLinea = (linea, sep) => {
  const campos = [];
  let actual = "";
  let entreComillas = false;

  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (entreComillas) {
      if (c === '"' && linea[i + 1] === '"') { actual += '"'; i++; }
      else if (c === '"') entreComillas = false;
      else actual += c;
    } else if (c === '"') {
      entreComillas = true;
    } else if (c === sep) {
      campos.push(actual);
      actual = "";
    } else {
      actual += c;
    }
  }
  campos.push(actual);
  return campos.map((v) => v.trim());
};

// Parte el fichero en líneas sin romper los campos entrecomillados que
// contienen saltos de línea (una dirección en dos renglones, por ejemplo).
const partirLineas = (texto) => {
  const lineas = [];
  let actual = "";
  let entreComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (c === '"') { entreComillas = !entreComillas; actual += c; continue; }
    if (!entreComillas && (c === "\n" || c === "\r")) {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      lineas.push(actual);
      actual = "";
      continue;
    }
    actual += c;
  }
  if (actual) lineas.push(actual);
  return lineas.filter((l) => l.trim() !== "");
};

// Campos del cliente y los encabezados que se reconocen para cada uno.
// Se comparan sin acentos, sin mayúsculas y sin signos.
export const CAMPOS_CLIENTE = [
  { clave: "numero",           etiqueta: "Nº de cliente",
    alias: ["numero", "num", "n", "no", "codigo", "cod", "numero cliente", "n cliente",
            "codigo cliente", "cod cliente", "id cliente", "ref", "referencia", "clave",
            "codi", "codi client", "num client"] },
  { clave: "nombre",           etiqueta: "Nombre fiscal",     obligatorio: true,
    alias: ["nombre", "cliente", "razon social", "nombre fiscal", "denominacion", "empresa", "nombrecliente",
            "nom", "client", "rao social", "nom fiscal"] },
  { clave: "nombre_comercial", etiqueta: "Nombre comercial",  alias: ["nombre comercial", "comercial", "alias", "rotulo", "nombrecomercial",
            "nom comercial", "retol"] },
  { clave: "nifCif",           etiqueta: "NIF / CIF",         alias: ["nif", "cif", "nif cif", "nifcif", "dni", "documento", "cifnif", "n i f", "n i f "] },
  { clave: "dirFact",          etiqueta: "Dirección",         alias: ["direccion", "dir", "domicilio", "direccion facturacion", "dirfact", "calle",
            "adreca", "adreca fiscal", "carrer"] },
  { clave: "cp",               etiqueta: "Código postal",     alias: ["cp", "codigo postal", "codpostal", "cpostal", "zip", "c p", "codi postal"] },
  { clave: "poblacion",        etiqueta: "Población",         alias: ["poblacion", "ciudad", "localidad", "municipio", "poblacio", "ciutat", "municipi"] },
  { clave: "provincia",        etiqueta: "Provincia",         alias: ["provincia", "comarca"] },
  { clave: "tel",              etiqueta: "Teléfono",          alias: ["tel", "telefono", "tlf", "fijo", "telefono fijo", "telefon", "tel fon"] },
  { clave: "movil",            etiqueta: "Móvil",             alias: ["movil", "mobil", "celular", "telefono movil", "whatsapp", "mobil "] },
  { clave: "email",            etiqueta: "Email",             alias: ["email", "correo", "mail", "e mail", "correo electronico", "correu", "adreca electronica"] },
];

export const normalizar = (s) =>
  (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // quita los acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Empareja cada columna del fichero con un campo del cliente. Devuelve un
// array paralelo a los encabezados: la clave del campo, o null si no encaja.
const adivinarColumnas = (encabezados) => {
  const usados = new Set();
  return encabezados.map((h) => {
    const limpio = normalizar(h);
    if (!limpio) return null;
    const campo = CAMPOS_CLIENTE.find(
      (c) => !usados.has(c.clave) && (c.alias.includes(limpio) || normalizar(c.etiqueta) === limpio)
    );
    if (campo) usados.add(campo.clave);
    return campo ? campo.clave : null;
  });
};

export const leerCSV = (texto) => {
  // Excel mete a veces una marca invisible al principio del fichero
  const limpio = texto.replace(/^\uFEFF/, "");
  const lineas = partirLineas(limpio);
  if (lineas.length === 0) return { encabezados: [], filas: [], columnas: [], error: "El fichero está vacío." };

  const sep = detectarSeparador(lineas[0]);
  const encabezados = partirLinea(lineas[0], sep);
  if (encabezados.length < 2) {
    return { encabezados: [], filas: [], columnas: [], error: "No se han encontrado columnas. ¿Seguro que es un CSV?" };
  }

  const filas = lineas.slice(1)
    .map((l) => partirLinea(l, sep))
    .filter((f) => f.some((v) => v !== ""));

  return { encabezados, filas, columnas: adivinarColumnas(encabezados), error: null };
};

// Convierte una fila del fichero en un objeto cliente según el mapeo elegido.
export const filaACliente = (fila, columnas) => {
  const cliente = {};
  columnas.forEach((clave, i) => {
    if (clave) cliente[clave] = (fila[i] || "").trim();
  });
  return cliente;
};

// Marca cada fila con lo que pasa con ella. El número de cliente manda cuando
// lo hay: es la clave con la que el cliente está dado de alta en Factusol, así
// que dos fichas con el mismo NIF pero distinto número son dos clientes
// distintos y hay que crear los dos. Saltarse uno dejaría su código sin cliente
// al que apuntar, que es justo lo que el número existe para evitar.
export const revisarFilas = (filas, columnas, clientesExistentes = []) => {
  const nombresEnBase = new Set();
  clientesExistentes.forEach((c) => {
    if (c.nombre) nombresEnBase.add(normalizar(c.nombre));
    if (c.nifCif) nombresEnBase.add(normalizar(c.nifCif));
  });
  const numerosEnBase = new Set(
    clientesExistentes.map((c) => normalizar(c.numero)).filter(Boolean)
  );

  const vistos = new Set();
  const numerosVistos = new Set();

  return filas.map((fila) => {
    const cliente = filaACliente(fila, columnas);
    const nombre = normalizar(cliente.nombre);
    const nif = normalizar(cliente.nifCif);
    const num = normalizar(cliente.numero);

    const repiteNombre = vistos.has(nombre) || (nif && vistos.has(nif));
    const yaExiste     = nombresEnBase.has(nombre) || (nif && nombresEnBase.has(nif));

    let estado = "nuevo";
    let motivo = "";

    if (!cliente.nombre || !cliente.nombre.trim()) {
      estado = "invalido";
      motivo = "Sin nombre";
    } else if (num && numerosVistos.has(num)) {
      estado = "repetido";
      motivo = `El nº ${cliente.numero} sale dos veces en el fichero`;
    } else if (num && numerosEnBase.has(num)) {
      estado = "duplicado";
      motivo = `El nº ${cliente.numero} ya lo tiene otro cliente`;
    } else if (num && (repiteNombre || yaExiste)) {
      // Tiene número propio: se crea, pero conviene mirarlo
      estado = "revisar";
      motivo = "Mismo nombre o NIF que otro, pero con su propio nº";
    } else if (!num && repiteNombre) {
      estado = "repetido";
      motivo = "Repetido en el fichero";
    } else if (!num && yaExiste) {
      estado = "duplicado";
      motivo = "Ya está en la base de datos";
    }

    // Los que van a entrar reservan su nombre y su número para las filas siguientes
    if (estado === "nuevo" || estado === "revisar") {
      vistos.add(nombre);
      if (nif) vistos.add(nif);
      if (num) numerosVistos.add(num);
    }

    return { cliente, estado, motivo };
  });
};

// Filas que se van a crear de verdad
export const SE_IMPORTAN = ["nuevo", "revisar"];
