import { ADMIN_WHATSAPP, ADMIN_EMAIL } from "./constants";

export const buildMessage = (s, config) => {
  const carga = [
    s.metros ? `${s.metros} m` : null,
    s.peso   ? `${s.peso} kg`  : null,
    s.bultos ? `${s.bultos} bultos` : null,
  ].filter(Boolean).join(" · ");

  return [
    `🔧 NUEVA SOLICITUD DE SERVICIO`,
    `Nº ${s.numero}  ·  Fecha: ${s.fecha}`,
    ``,
    `👤 Cliente: ${s.cliente || "—"}`,
    s.telCliente              ? `📞 Tel: ${s.telCliente}` : null,
    s.vehiculo                ? `🚛 Vehículo/Equipo: ${s.vehiculo}` : null,
    (s.tipoTrabajo || s.tipo) ? `🔧 Tipo de trabajo: ${s.tipoTrabajo || s.tipo}` : null,
    s.origen                  ? `📍 Origen (A): ${s.origen}` : null,
    s.destino                 ? `📍 Destino (B): ${s.destino}` : null,
    (!s.origen && s.direccion)? `📍 Dirección: ${s.direccion}` : null,
    carga                     ? `📦 Carga: ${carga}` : null,
    ``,
    `📋 Descripción:`,
    s.descripcion || "—",
    s.precio ? `\n💶 Precio estimado: ${Number(s.precio).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €` : null,
    ``,
    `— ${config?.nombre || "ELSA"}`,
  ].filter((l) => l !== null).join("\n");
};

export const sendWhatsApp = (s, config) =>
  window.open(`https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(buildMessage(s, config))}`, "_blank");

export const sendEmail = (s, config) =>
  window.open(
    `mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(`Solicitud ${s.numero} – ${s.cliente || "Sin nombre"}`)}&body=${encodeURIComponent(buildMessage(s, config))}`,
    "_blank"
  );
