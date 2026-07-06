import { ADMIN_EMAIL } from "../../shared/lib/constants";
import { dbAddNotaServicio } from "./db";

const formatFecha = (f) =>
  f ? new Date(f + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

export const buildServicioMessage = (s, config) => {
  // vehiculoNombre viene del vehículo de flota asignado; si no, del texto antiguo
  const vehiculosTexto = s.vehiculoNombre
    ? s.vehiculoNombre
    : (Array.isArray(s.vehiculo) ? s.vehiculo : (s.vehiculo ? [s.vehiculo] : [])).join(", ");
  const estado = (s.estado || "abierto") === "realizado" ? "🟢 Realizado" : "🟠 Abierto";

  return [
    `🔧 CONFIRMACIÓN DE TRABAJO`,
    `Nº ${s.numero}  ·  Fecha del servicio: ${formatFecha(s.fecha_servicio)}`,
    `Estado: ${estado}`,
    ``,
    `👤 Cliente: ${s.cliente || "—"}`,
    vehiculosTexto ? `🚛 Vehículo/Equipo: ${vehiculosTexto}` : null,
    s.origen  ? `📍 Origen (A): ${s.origen}` : null,
    s.destino ? `📍 Destino (B): ${s.destino}` : null,
    ``,
    `📋 Descripción:`,
    s.descripcion || "—",
    s.precio ? `\n💶 Precio: ${Number(s.precio).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €` : null,
    ``,
    `— ${config?.nombre || "ELSA"}`,
  ].filter((l) => l !== null).join("\n");
};

export const sendServicioEmail = async (s, config) => {
  window.open(
    `mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(`Confirmación de trabajo ${s.numero} – ${s.cliente || "Sin nombre"}`)}&body=${encodeURIComponent(buildServicioMessage(s, config))}`,
    "_blank"
  );
  if (s.id) {
    await dbAddNotaServicio(s.id, { tipo: "email", fecha: new Date().toISOString(), texto: "Enviado por email" });
  }
};
