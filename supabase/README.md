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


## Roles y permisos

Desde la migración `20260929190000_consolidacion_permisos_integridad.sql` la
base de datos aplica dos roles, guardados en `public.perfiles`:

| Rol | Puede |
| --- | --- |
| `admin` | Todo. |
| `operario` | Ver lo operativo; crear y modificar servicios, albaranes (firmar incluido) y eventos; dar de alta clientes; apuntar mantenimientos. No borra nada ni toca presupuestos, flota, configuración ni perfiles. |
| sin perfil o `activo = false` | Nada. |

Cada cuenta nueva de Supabase Auth nace como `operario`. Para cambiarla, desde
el SQL Editor:

```sql
update public.perfiles set rol = 'admin'  where id = (select id from auth.users where email = 'alguien@gruaselsa.com');
update public.perfiles set activo = false where id = (select id from auth.users where email = 'se-ha-ido@gruaselsa.com');
```

Desactivar corta el acceso a los datos al momento, aunque la sesión siga abierta.

## Albaranes firmados

Al firmar, la base de datos pone la hora del servidor, congela en
`contenido_firmado` todo lo que sale en el albarán (cliente, servicio,
empresa) y guarda su huella SHA-256. Un firmado ya no se puede editar ni
borrar: se anula (función `anular_albaran`, solo admin, con motivo) y se hace
uno nuevo. Los que ya estaban firmados antes de esta migración se congelaron
con los datos del día de la migración y llevan `"retroactivo": true`.

## Pruebas

`supabase/tests/` reconstruye la base en un Postgres vacío y comprueba
permisos e integridad. Lo hace GitHub Actions en cada PR (`.github/workflows/ci.yml`).
Para ejecutarlo a mano con un Postgres local:

```sh
psql -f supabase/tests/stub_supabase.sql
for f in supabase/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -f "$f"; done
psql -f supabase/tests/permisos_e_integridad.sql
```

**Nunca contra la base real**: las pruebas crean y modifican datos.

## Copias y recuperación

El botón «Exportar datos» de Configuración descarga las tablas en JSON. **No es
una copia de recuperación**: no incluye fotos, PDF de DeCA ni cuentas.

La recuperación depende de las copias de Supabase (plan Pro: copia diaria con
7 días de retención; PITR opcional). Pendiente de decidir y documentar aquí:

- Cuánto dato se puede perder como máximo (RPO) y cuánto tiempo puede estar
  parada la empresa (RTO).
- Una copia fuera de Supabase (volcado `pg_dump` + ficheros de Storage) en un
  sitio privado. **No** en artefactos de GitHub: el repositorio es público.
- Una restauración de prueba en un proyecto aparte, al menos una vez.

## Versiones de las migraciones

Los nombres de los ficheros tienen que coincidir con la versión registrada en
`supabase_migrations.schema_migrations`. El 29/09/2026 se renombraron cuatro
ficheros que no coincidían (se habían aplicado desde el panel con otra hora) y
se recuperó `20260915105425_deca_storage.sql`, que existía en la base pero no
en el repositorio.
