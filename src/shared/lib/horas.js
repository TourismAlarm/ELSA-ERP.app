// Horas de los servicios. Todo servicio nace con hora de inicio y de fin: sin
// hora no ocupa sitio en el calendario y no se puede ver de un vistazo si el
// día está lleno, que es justo para lo que se usa.

export const HORA_INICIO_POR_DEFECTO = "08:00";
export const DURACION_MINIMA_MIN = 60; // una hora

const aMinutos = (h) => {
  if (!h) return null;
  const [hh, mm] = h.slice(0, 5).split(":");
  const n = Number(hh) * 60 + Number(mm || 0);
  return Number.isFinite(n) ? n : null;
};

const aHora = (min) => {
  // Un servicio que se pasa de medianoche se queda en 23:59: la rejilla del
  // calendario es de un día y dar la vuelta al reloj lo pintaría al revés
  const m = Math.max(0, Math.min(23 * 60 + 59, Math.round(min)));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

export const sumaMinutos = (hora, minutos) => {
  const m = aMinutos(hora);
  return m === null ? "" : aHora(m + minutos);
};

export const duracionEnMinutos = (inicio, fin) => {
  const a = aMinutos(inicio), b = aMinutos(fin);
  return a === null || b === null ? null : b - a;
};

// Completa las horas de un servicio: si falta el inicio pone el de por defecto,
// y si el fin falta o no llega a la duración mínima lo empuja a una hora más.
export const conHorasValidas = (form) => {
  const inicio = form.hora_inicio ? form.hora_inicio.slice(0, 5) : HORA_INICIO_POR_DEFECTO;
  const dur = duracionEnMinutos(inicio, form.hora_fin);
  const fin = dur !== null && dur >= DURACION_MINIMA_MIN
    ? form.hora_fin.slice(0, 5)
    : sumaMinutos(inicio, DURACION_MINIMA_MIN);
  return { ...form, hora_inicio: inicio, hora_fin: fin };
};

// Al cambiar la hora de inicio en un formulario, arrastrar la de fin para
// conservar la duración que hubiera; si no llegaba al mínimo, se pone el mínimo.
export const alCambiarInicio = (inicioNuevo, form) => {
  if (!inicioNuevo) return { hora_inicio: "", hora_fin: form.hora_fin };
  const durPrevia = duracionEnMinutos(form.hora_inicio, form.hora_fin);
  const dur = durPrevia && durPrevia >= DURACION_MINIMA_MIN ? durPrevia : DURACION_MINIMA_MIN;
  return { hora_inicio: inicioNuevo, hora_fin: sumaMinutos(inicioNuevo, dur) };
};

// Aviso para enseñar debajo del campo, sin bloquear: se corrige al guardar
export const avisoDuracion = (inicio, fin) => {
  const dur = duracionEnMinutos(inicio, fin);
  if (dur === null) return "";
  if (dur <= 0) return "La hora de fin es anterior a la de inicio. Al guardar se pondrá una hora de duración.";
  if (dur < DURACION_MINIMA_MIN) return "Menos de una hora. Al guardar se ajustará a una hora.";
  return "";
};
