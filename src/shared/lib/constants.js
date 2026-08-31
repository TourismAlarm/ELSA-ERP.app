// Destino de los botones "Enviar a administración". Se pueden cambiar desde
// Configuración; estos son los valores por defecto de cuando aún no se han
// tocado, para que la aplicación siga funcionando igual que hasta ahora.
export const ADMIN_WHATSAPP = "34670090332";
export const ADMIN_EMAIL    = "gruaselsa@gmail.com";

// Solo dígitos: wa.me no admite espacios ni el signo +
export const whatsappAdmin = (config) =>
  (config?.adminWhatsapp || ADMIN_WHATSAPP).replace(/\D/g, "");

export const emailAdmin = (config) =>
  (config?.adminEmail || ADMIN_EMAIL).trim();

export const DEFAULT_VEHICLES   = ["Camión 1", "Camión 2", "Grúa 3", "Cesta", "Operario externo"];
export const DEFAULT_WORK_TYPES = ["Maquinaria", "Barcos", "Cesta", "Servicios", "Otro"];

