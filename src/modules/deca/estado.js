// En qué situación está el DeCA de un servicio. Función pura: recibe las filas
// de la tabla deca de UN servicio y no toca la base.
//
// Estados de un DeCA suelto:
//   emitido    → vigente, no anulado
//   anulado    → anulado y no se ha emitido otro después
//   sustituido → anulado y se emitió otro DeCA DESPUÉS de anular
//
// Estado del servicio: sin_deca si no hay ninguno; emitido si hay alguno
// vigente; anulado si todos están anulados y ninguno fue sustituido; sustituido
// no aparece a nivel de servicio porque si se sustituyó hay uno vigente (o el
// sustituto se anuló también, y entonces el servicio está anulado).

// Cuándo se anuló: la entrada de anulación de modificaciones (la pone el
// servidor). Si falta, cae a updated_at.
export const anuladoEn = (d) => {
  const e = (d.modificaciones || []).filter((m) => m?.accion === "anulacion").pop();
  return e?.cuando || d.updated_at || null;
};

export const motivoAnulacion = (d) =>
  (d.modificaciones || []).filter((m) => m?.accion === "anulacion").pop()?.motivo || null;

export const estadoDeca = (d, todos = []) => {
  if (!d.anulado) return "emitido";
  const cuando = anuladoEn(d);
  const sustituido = todos.some((o) => o.id !== d.id && o.creado_en && cuando && new Date(o.creado_en) >= new Date(cuando));
  return sustituido ? "sustituido" : "anulado";
};

export const estadoDecaServicio = (decas = []) => {
  if (decas.length === 0) return "sin_deca";
  if (decas.some((d) => !d.anulado)) return "emitido";
  return "anulado";
};
