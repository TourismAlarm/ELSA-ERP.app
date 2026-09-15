// Lo que el DeCA no puede dejar en blanco (artículo 6 de la Orden
// FOM/2861/2012). Un DeCA sin NIF o sin matrícula no cumple la norma, y es
// preferible no emitirlo a emitirlo mal: dbEmitirDeca se niega si esta lista
// no viene vacía.
//
// Bultos, matrícula del remolque, autorización especial y observaciones son
// opcionales: un camión rígido no lleva remolque y la autorización especial
// solo existe cuando el transporte la necesita.

const vacio = (v) => v === null || v === undefined || String(v).trim() === "";

export const faltanDatosDeca = (servicio = {}, cliente = null, config = {}) => {
  // Si no hay ficha de cliente, se mira lo que el servicio trae copiado de ella
  const c = cliente || { nombre: servicio.cliente, nifCif: servicio.nifCif, dirFact: servicio.dirFact };

  const obligatorios = [
    [config.nombre,                  "Nombre de la empresa"],
    [config.nif,                     "NIF de la empresa"],
    [config.direccion,               "Dirección de la empresa"],
    [config.autorizacion_transporte, "Autorización de transporte de la empresa"],
    [c.nombre,                       "Nombre del cliente"],
    [c.nifCif,                       "NIF del cliente"],
    [c.dirFact,                      "Dirección del cliente"],
    [servicio.fecha_servicio,        "Fecha del transporte"],
    [servicio.origen,                "Origen"],
    [servicio.destino,               "Destino"],
    [servicio.naturaleza_mercancia,  "Naturaleza de la mercancía"],
    [servicio.peso,                  "Peso de la mercancía"],
    [servicio.matricula_tractora,    "Matrícula tractora"],
  ];

  return obligatorios.filter(([valor]) => vacio(valor)).map(([, nombre]) => nombre);
};
