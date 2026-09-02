// Los textos fijos del presupuesto: los que salen igual en todos y que hasta
// ahora no estaban en ningún sitio, así que el PDF de la aplicación no se
// parecía al que se envía de verdad.
//
// Se guardan en Configuración, así que se cambian una vez y valen para
// siempre. Estos son los que se usan mientras no se toquen.
//
// Los huecos {empresa} {email} {tel} {direccion} se rellenan solos con los
// datos de la empresa: así el aviso legal no se queda con una dirección vieja
// el día que se cambie de local.

export const TEXTOS_PRESUPUESTO = {
  // Bajo el encabezado, el teléfono al que se contrata
  contractacion: "{tel}",

  web: "",

  formaPago: "Transferència abans del servei",

  // Una línea por observación. La del IVA es la importante: el importe del
  // presupuesto nunca lo lleva incluido.
  observaciones:
    "*Pressupost orientatiu, en espera de saber les mides exactes.\n" +
    "*El servei es farà en dia laborable.\n" +
    "*A aquest import s'incrementarà l'IVA corresponent.",

  conformidad:
    "Agradeceremos nos retorne el presente presupuesto, debidamente SELLADO y FIRMADO, al mail {email}.",

  legal:
    "{empresa} és Responsable del tractament de les dades personals facilitades per vostè, aquestes seran " +
    "tractades de conformitat amb el GDPR amb la finalitat de mantenir una relació comercial i conserva'ls " +
    "mentre hi hagi un interès mutu. No es comunicaran les dades a tercers. Pot exercir els drets d'accés, " +
    "rectificació, supressió, limitació i oposició a {direccion}. Email: {email} i el de reclamació a www.agpd.es.",
};

// Rellena los huecos con los datos de la empresa. Un hueco sin dato se queda
// vacío en vez de dejar un "{email}" a la vista del cliente.
export const rellenar = (texto, config = {}) =>
  (texto || "").replace(/\{(empresa|email|tel|direccion)\}/g, (_, clave) => {
    const valor = clave === "empresa" ? config.nombre : config[clave];
    return (valor || "").toString().trim();
  });

// El texto que toca: el de Configuración si se ha escrito, si no el de fábrica.
// Una cadena vacía cuenta como "no escrito": nadie borra un aviso legal a
// propósito, y si lo hace siempre puede escribir un espacio.
export const textoDe = (config, clave) =>
  rellenar((config?.[clave] || "").trim() || TEXTOS_PRESUPUESTO[clave], config);

// Las observaciones, ya troceadas en líneas y sin las vacías
export const lineasObservaciones = (texto) =>
  (texto || "").split("\n").map((l) => l.trim()).filter(Boolean);
