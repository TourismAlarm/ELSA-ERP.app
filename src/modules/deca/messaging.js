import { dbAddNotaServicio } from "../servicios/db";

// El DeCA se manda al conductor antes de salir: la URL abre el PDF sin
// sesión, que es justo lo que la norma exige, así que basta con el enlace.
// Mismo mecanismo que el resto de envíos (wa.me + nota en la ficha), pero sin
// número fijo: el conductor cambia de un trabajo a otro, así que WhatsApp
// pregunta a quién.

const formatFecha = (f) =>
  f ? new Date(f + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

export const buildDecaMessage = (deca, servicio, config) => [
  `📄 DeCA ${deca.numero}`,
  `🔧 Servicio ${servicio.numero || "—"}  ·  Fecha: ${formatFecha(servicio.fecha_servicio)}`,
  `👤 Cliente: ${servicio.cliente || "—"}`,
  servicio.origen  ? `📍 Origen (A): ${servicio.origen}` : null,
  servicio.destino ? `📍 Destino (B): ${servicio.destino}` : null,
  ``,
  `Documento de control del transporte. Llévalo en el móvil: la Guardia Civil lo puede pedir en ruta.`,
  `🔗 ${deca.url}`,
  ``,
  `— ${config?.nombre || "ELSA"}`,
].filter((l) => l !== null).join("\n");

// Devuelve lo que devuelve dbAddNotaServicio, para que la ficha refresque
// sus notas sin recargar
export const sendDecaWhatsApp = async (deca, servicio, config) => {
  window.open(`https://wa.me/?text=${encodeURIComponent(buildDecaMessage(deca, servicio, config))}`, "_blank");
  if (!servicio.id) return null;
  return dbAddNotaServicio(servicio.id, { tipo: "whatsapp", fecha: new Date().toISOString(), texto: `DeCA ${deca.numero} enviado por WhatsApp` });
};
