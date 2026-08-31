-- Columnas del contacto de administración. Se añadieron los campos al
-- formulario de Configuración sin crear antes las columnas, así que guardar la
-- configuración fallaba con "Could not find the 'adminEmail' column of 'config'".
--
-- Son el destino de los botones «Enviar a administración» de solicitudes,
-- servicios y albaranes. Antes estaban escritos en el código
-- (shared/lib/constants.js) y cambiarlos obligaba a volver a desplegar.
--
-- Van en camelCase entrecomillado por coherencia con el resto de la tabla,
-- que ya usa "workTypes".
--
-- Idempotente: se puede reejecutar sin romper nada.

ALTER TABLE public.config ADD COLUMN IF NOT EXISTS "adminWhatsapp" text;
ALTER TABLE public.config ADD COLUMN IF NOT EXISTS "adminEmail"    text;

-- PostgREST cachea el esquema: sin esto seguiría diciendo que las columnas no
-- existen hasta que refresque solo.
NOTIFY pgrst, 'reload schema';

-- Comprobación: deben salir las dos columnas
--   select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'config'
--   order by ordinal_position;
