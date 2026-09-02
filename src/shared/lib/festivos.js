// Festivos del calendario, calculados. No dependen de ningún servicio externo
// ni de ninguna tabla: se sacan del año, así que funcionan solos para siempre
// y también hacia atrás, para las fechas del histórico.
//
// Cubre los nacionales y los de Cataluña. Los dos festivos locales de cada
// municipio no se pueden calcular — cambian por pueblo y año — y se apuntan a
// mano como evento del calendario, igual que el resto de cosas.

// Domingo de Pascua por el algoritmo de Meeus/Butcher (calendario gregoriano).
// De él cuelgan Viernes Santo y el Lunes de Pascua.
const domingoDePascua = (anyo) => {
  const a = anyo % 19;
  const b = Math.floor(anyo / 100);
  const c = anyo % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);   // 3 = marzo, 4 = abril
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(anyo, mes - 1, dia);
};

const toISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const sumaDias = (fecha, dias) => {
  const d = new Date(fecha);
  d.setDate(d.getDate() + dias);
  return d;
};

// Devuelve { "2026-01-01": "Any nou", ... } para el año pedido
export const festivosDelAnyo = (anyo) => {
  const pascua = domingoDePascua(anyo);
  const fijo = (mes, dia) => toISO(new Date(anyo, mes - 1, dia));

  return {
    // --- Nacionales ---
    [fijo(1, 1)]:   "Any nou",
    [fijo(1, 6)]:   "Reis",
    [toISO(sumaDias(pascua, -2))]: "Divendres Sant",
    [fijo(5, 1)]:   "Festa del Treball",
    [fijo(8, 15)]:  "L'Assumpció",
    [fijo(10, 12)]: "Festa Nacional d'Espanya",
    [fijo(11, 1)]:  "Tots Sants",
    [fijo(12, 6)]:  "Dia de la Constitució",
    [fijo(12, 8)]:  "La Immaculada",
    [fijo(12, 25)]: "Nadal",

    // --- Cataluña ---
    [toISO(sumaDias(pascua, 1))]: "Dilluns de Pasqua",
    [fijo(6, 24)]:  "Sant Joan",
    [fijo(9, 11)]:  "Diada de Catalunya",
    [fijo(12, 26)]: "Sant Esteve",
  };
};

// Caché por año: el calendario pinta 42 celdas y preguntaría 42 veces
const cache = new Map();

export const festivoDe = (iso) => {
  if (!iso) return null;
  const anyo = Number(iso.slice(0, 4));
  if (!Number.isFinite(anyo)) return null;
  if (!cache.has(anyo)) cache.set(anyo, festivosDelAnyo(anyo));
  return cache.get(anyo)[iso] || null;
};

export const esFestivo = (iso) => festivoDe(iso) !== null;

// Fin de semana: sábado o domingo
export const esFinDeSemana = (iso) => {
  const d = new Date(iso + "T00:00:00").getDay();
  return d === 0 || d === 6;
};

// Días en los que no se trabaja: festivo o fin de semana
export const esNoLaborable = (iso) => esFestivo(iso) || esFinDeSemana(iso);
