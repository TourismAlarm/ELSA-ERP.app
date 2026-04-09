import { ADMIN_WHATSAPP, ADMIN_EMAIL } from "./constants";
import { dbAddNota } from "./db";

export const buildMessage = (s, config) => {
  const carga = [
    s.metros ? `${s.metros} m` : null,
    s.peso   ? `${s.peso} kg`  : null,
    s.bultos ? `${s.bultos} bultos` : null,
  ].filter(Boolean).join(" · ");

  const vehiculos = Array.isArray(s.vehiculo) ? s.vehiculo : (s.vehiculo ? [s.vehiculo] : []);

  return [
    `🔧 NUEVA SOLICITUD DE SERVICIO`,
    `Nº ${s.numero}  ·  Fecha: ${s.fecha}`,
    ``,
    `👤 Cliente: ${s.cliente || "—"}`,
    s.nifCif           ? `🪪 NIF/CIF: ${s.nifCif}` : null,
    s.dirFact          ? `🏢 Dir. facturación: ${s.dirFact}` : null,
    s.telCliente       ? `📞 Tel: ${s.telCliente}` : null,
    vehiculos.length > 0 ? `🚛 Vehículo/Equipo: ${vehiculos.join(", ")}` : null,
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

export const sendWhatsApp = async (s, config) => {
  window.open(`https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(buildMessage(s, config))}`, "_blank");
  if (s.id) {
    await dbAddNota(s.id, { tipo: "whatsapp", fecha: new Date().toISOString(), texto: "Enviado por WhatsApp" });
  }
};

export const sendEmail = async (s, config) => {
  window.open(
    `mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(`Solicitud ${s.numero} – ${s.cliente || "Sin nombre"}`)}&body=${encodeURIComponent(buildMessage(s, config))}`,
    "_blank"
  );
  if (s.id) {
    await dbAddNota(s.id, { tipo: "email", fecha: new Date().toISOString(), texto: "Enviado por email" });
  }
};
