# Base de datos (Supabase)

Esta carpeta contiene todo lo que hace falta para levantar la base de datos de
ELSA-ERP en un proyecto de Supabase: el esquema completo y las migraciones que
lo han ido modificando.

## Qué hay aquí

| Ruta | Para qué sirve |
| --- | --- |
| `migrations/00000000000000_esquema_base.sql` | Crea el esquema **desde cero**: tablas, índices, funciones, triggers, políticas RLS y el bucket privado de fotos. |
| `migrations/AAAAMMDDhhmmss_*.sql` | Cada fichero es un cambio sobre el esquema base. El nombre empieza por la fecha y hora en que se hizo, así que el orden alfabético es el orden cronológico. |
| `comprobar_columnas.sql` | Consulta de comprobación: lista las columnas que la aplicación escribe y que no existen en la base. Si no devuelve filas, está todo en su sitio. |

El esquema base lleva el prefijo `00000000000000` para que siempre quede el
primero al ordenar por nombre. Las demás migraciones modifican ese esquema por
orden de fecha.

## Recrear la base en un proyecto nuevo

1. Crea un proyecto en [Supabase](https://supabase.com) y abre el **SQL Editor**.
2. Ejecuta primero `migrations/00000000000000_esquema_base.sql` completo.
3. Ejecuta después **cada migración** de `migrations/` en orden alfabético
   (que coincide con el orden de fecha), de una en una y sin saltarte ninguna.
4. Opcionalmente, ejecuta `comprobar_columnas.sql`. No debería devolver ninguna fila.
5. Copia la URL del proyecto y la anon key en el `.env` de la aplicación
   (ver el `README.md` de la raíz).

Si prefieres la CLI de Supabase, `supabase db push` aplica los ficheros de
`migrations/` en ese mismo orden.

## Regla para cambiar el esquema

**Todo cambio de esquema va en una migración.** Aunque el cambio se haya
ejecutado primero a mano en el SQL Editor para probarlo, hay que guardar el
mismo SQL en un fichero nuevo dentro de `migrations/` y subirlo al repositorio.

Esto vale para cualquier cosa: crear o alterar tablas y columnas, índices,
funciones, triggers, políticas RLS, buckets de Storage y sus políticas.

Convenciones:

- Nombre del fichero: `AAAAMMDDhhmmss_descripcion_corta.sql` (fecha y hora
  actuales, en UTC, seguidas de un nombre en minúsculas con guiones bajos).
  Ejemplo: `20260909120000_notas_internas.sql`.
- Empieza el fichero con un comentario que explique **por qué** se hace el
  cambio, no solo qué hace.
- Escribe las migraciones de forma idempotente cuando sea posible
  (`IF NOT EXISTS`, `DROP POLICY IF EXISTS` seguido de `CREATE POLICY`, etc.),
  para que reejecutarlas no rompa nada.
- Nunca edites una migración ya subida. Si hay que corregir algo, se hace con
  otra migración nueva.
- Si añades columnas que la aplicación escribe, añádelas también a la lista de
  `comprobar_columnas.sql`.

Si un cambio se hace solo en el SQL Editor y no se guarda como migración, el
repositorio deja de reflejar la base real y no se puede volver a levantar el
proyecto desde cero.
