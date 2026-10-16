# Restaurar una copia

Las copias semanales las hace `.github/workflows/copia-semanal.yml`. Cada copia
es un fichero `elsa-copia-AAAA-MM-DD.tar.gz.age`, cifrado con `age`. Solo se
puede abrir con la **clave privada**, que NO está en GitHub: la guarda Jordi
(gestor de contraseñas y una copia impresa o en un USB fuera de la oficina).

## 1. Descargar y descifrar

1. GitHub → Actions → «Copia semanal» → la ejecución que quieras → Artifacts.
2. Descifrar y descomprimir:

```sh
age -d -i clave-privada-copias.txt elsa-copia-2026-10-19.tar.gz.age | tar xz
```

Sale una carpeta con:

| Fichero | Qué es |
| --- | --- |
| `base.dump` | Volcado de la base (`pg_dump -Fc`): esquemas `public`, `auth`, `storage` (solo metadatos) y `supabase_migrations` |
| `storage/` | Todos los ficheros: `service-photos/` (fotos) y `deca-docs/` (PDF de DeCA) |
| `recuento.txt` | Número de filas por tabla y de ficheros en el momento de la copia, para comprobar la restauración |

## 2. Restaurar en un proyecto de Supabase NUEVO

Nunca encima de producción sin haberlo probado antes en uno aparte.

1. Crear un proyecto vacío en Supabase (misma región, eu-central-1).
2. Copiar la cadena de conexión (Project Settings → Database → Session pooler).
3. Restaurar los datos de la aplicación y las cuentas:

```sh
DB="postgresql://postgres.<ref>:<password>@aws-0-eu-central-1.pooler.supabase.com:5432/postgres"

# Estructura y datos de la aplicación
pg_restore --no-owner --no-privileges --schema=public -d "$DB" base.dump
pg_restore --no-owner --no-privileges --schema=supabase_migrations -d "$DB" base.dump

# Cuentas de usuario (solo datos: el esquema auth ya existe en el proyecto nuevo)
pg_restore --no-owner --no-privileges --data-only --schema=auth -t users -t identities -d "$DB" base.dump
```

4. Volver a crear los buckets y subir los ficheros (desde la raíz del repo):

```sh
SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
  node scripts/copias/subir_storage.mjs ./storage
```

5. Comprobar: comparar `recuento.txt` con

```sql
select 'clientes', count(*) from clientes union all
select 'albaranes', count(*) from albaranes union all
select 'albaranes firmados con huella', count(*) from albaranes where huella_sha256 is not null union all
select 'servicios', count(*) from servicios union all
select 'deca', count(*) from deca;
```

6. Apuntar la app al proyecto nuevo: en Vercel, cambiar `VITE_SUPABASE_URL` y
   `VITE_SUPABASE_ANON_KEY` y volver a desplegar.

## Prueba de restauración

Hacerla **una vez ahora** y después cada 6 meses, en un proyecto aparte.
Anotar aquí la fecha y el resultado:

| Fecha | Copia usada | Resultado |
| --- | --- | --- |
| | | |
