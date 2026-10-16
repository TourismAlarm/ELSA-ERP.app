// En Google Calendar todo se apunta en el título: cliente, persona de
// contacto, teléfono y qué hay que hacer («Construcciones Pérez - Joan
// 600112233 - descargar vigas»). Al convertir el evento en servicio, todo eso
// acababa en el nombre del cliente.
//
// Esto lo reparte:
//   · teléfonos y emails → teléfono y email del servicio
//   · el cliente → si en el título sale el nombre (fiscal o comercial) de un
//     cliente de la lista, o uno de sus teléfonos, ese cliente, con su ficha;
//     si no, el primer trozo del título (lo que va antes de « - », «/», «,»...)
//   · el resto del título y las notas del evento → descripción
//
// Es una propuesta: el formulario sale relleno para revisarlo, no se guarda
// nada solo.

// Sin acentos ni mayúsculas, como en la búsqueda de clientes
const normal = (s) =>
  String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const soloDigitos = (s) => String(s || "").replace(/\D/g, "");

// Teléfonos españoles escritos de cualquier manera: «600112233», «600 11 22 33»,
// «+34 600-112-233», «977 12 34 56». 9 cifras empezando por 6, 7, 8 o 9.
const TELEFONO = /(?:\+?34[\s.-]?)?[6789](?:[\s.-]?\d){8}(?!\d)/g;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;

// Lo que separa los trozos del título
const SEPARADORES = /\s+[-–—|·]\s+|\s*[/,;|]\s*|\s+-\s*|\s*-\s+|\s*:\s+|\n+/;

// Quita de los bordes guiones, comas y espacios que quedan al sacar trozos
const limpiar = (s) => String(s || "").replace(/\s{2,}/g, " ").replace(/^[\s\-–—|·,;:/.]+|[\s\-–—|·,;:/]+$/g, "").trim();

// Palabras sueltas que no dicen nada del cliente
const VACIOS = new Set(["tel", "telf", "tlf", "tfn", "movil", "mobil", "contacte", "contacto", "persona"]);

// Cliente de la lista cuyo nombre (fiscal o comercial) sale entero en el
// título; si varios, el más largo («Pérez Grúas» antes que «Pérez»). Si
// ninguno, el que tenga uno de los teléfonos del título.
const clienteEnTitulo = (titulo, clientes, telefonos) => {
  const t = ` ${normal(titulo).replace(/[^\p{L}\p{N}]+/gu, " ")} `;
  let mejor = null;
  let largo = 0;
  clientes.forEach((c) => {
    [c.nombre, c.nombre_comercial].forEach((n) => {
      const k = normal(n).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
      if (k.length < 3) return;
      if (t.includes(` ${k} `) && k.length > largo) { mejor = { c, texto: n }; largo = k.length; }
    });
  });
  if (mejor) return mejor;
  const digitos = telefonos.map((x) => soloDigitos(x).slice(-9));
  const porTel = clientes.find((c) => [c.tel, c.movil].some((v) => {
    const d = soloDigitos(v).slice(-9);
    return d.length === 9 && digitos.includes(d);
  }));
  return porTel ? { c: porTel, texto: null } : null;
};

// Quita del texto un trozo sin distinguir mayúsculas ni acentos
const quitar = (texto, trozo) => {
  if (!trozo) return texto;
  const t = normal(texto);
  const i = t.indexOf(normal(trozo));
  return i < 0 ? texto : texto.slice(0, i) + " " + texto.slice(i + trozo.length);
};

// Devuelve { cliente, cliente_id, ficha, telCliente, emailCliente, descripcion }
export const repartirTituloGoogle = (titulo, notas, clientes = []) => {
  let resto = String(titulo || "").replace(/^\(sin título\)$/, "");
  const telefonos = resto.match(TELEFONO) || [];
  const emails = resto.match(EMAIL) || [];
  telefonos.forEach((x) => { resto = resto.replace(x, " "); });
  emails.forEach((x) => { resto = resto.replace(x, " "); });

  const encontrado = clienteEnTitulo(resto, clientes, telefonos);
  let cliente = "";
  if (encontrado) {
    cliente = encontrado.c.nombre;
    resto = quitar(resto, encontrado.texto);
  } else {
    // Sin cliente conocido: el primer trozo con letras
    const trozos = resto.split(SEPARADORES).map(limpiar).filter(Boolean);
    const i = trozos.findIndex((x) => /\p{L}{2,}/u.test(x) && !VACIOS.has(normal(x)));
    if (i >= 0) {
      cliente = trozos[i];
      resto = quitar(resto, trozos[i]);
    }
  }

  // Lo que queda del título, en trozos limpios, y las notas debajo
  const restoTitulo = resto.split(SEPARADORES).map(limpiar)
    .filter((x) => x && !VACIOS.has(normal(x)))
    .join(" · ");
  const extraTel = telefonos.slice(1).map((x) => `Tel. ${x.trim()}`);
  const descripcion = [restoTitulo, ...extraTel, String(notas || "").trim()].filter(Boolean).join("\n");

  return {
    cliente,
    cliente_id: encontrado?.c.id ?? null,
    ficha: encontrado?.c || null,
    telCliente: telefonos[0]?.trim() || "",
    emailCliente: emails[0] || "",
    descripcion,
  };
};
