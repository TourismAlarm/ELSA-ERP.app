# Instrucciones para Ejecutar el SQL en Supabase

## 📌 Antes de empezar

- Revisa [SUPOSICIONES_BD.md](./SUPOSICIONES_BD.md) y verifica el checklist ✅
- Ten a mano tu proyecto Supabase

---

## 🚀 OPCIÓN 1: Supabase Dashboard (Más fácil)

### Paso 1: Accede a tu proyecto Supabase
1. Ve a https://app.supabase.com
2. Abre tu proyecto de ELSA-ERP
3. Navega a **SQL Editor** (en el menú izquierdo)

### Paso 2: Crea una nueva query
1. Haz clic en **"New Query"** (botón azul arriba a la derecha)
2. O abre una query existente y bórrala

### Paso 3: Copia y pega el SQL
1. Abre el archivo `database_schema.sql` en tu editor de texto
2. Copia TODO el contenido (Ctrl+A, Ctrl+C)
3. Pégalo en el editor SQL de Supabase (Ctrl+V)

### Paso 4: Ejecuta el SQL
1. Haz clic en el botón **"RUN"** (verde, arriba a la derecha)
2. O presiona **Ctrl+Enter**

### Paso 5: Verifica que funcionó
1. Deberías ver mensaje de éxito (sin errores rojos)
2. En el menú izquierdo, ve a **Table Editor**
3. Deberías ver las tres tablas:
   - `clientes`
   - `solicitudes`
   - `config`
   - `_solicitud_counter` (tabla interna)

---

## 🛠️ OPCIÓN 2: Supabase CLI (Para desarrolladores)

### Paso 1: Instala Supabase CLI (si no lo tienes)
```bash
npm install -g supabase
# o si usas brew:
brew install supabase/tap/supabase
```

### Paso 2: Autentícate
```bash
supabase login
# Sigue las instrucciones en el navegador
```

### Paso 3: Ejecuta la migración
```bash
# Desde el directorio raíz del proyecto:
cd /home/user/ELSA-ERP.app

# Opción A: Ejecuta el SQL directamente
supabase db push < database_schema.sql

# Opción B: Manualmente
psql $DATABASE_URL < database_schema.sql
```

### Paso 4: Verifica
```bash
# Listar tablas:
supabase db list
```

---

## ✅ VERIFICACIÓN POST-EJECUCIÓN

### 1. Verifica que las tablas existen
```sql
-- Ejecuta esto en SQL Editor de Supabase:
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
```

Deberías ver:
- `_solicitud_counter`
- `clientes`
- `config`
- `solicitudes`

### 2. Verifica la función RPC
```sql
-- En SQL Editor:
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%solicitud%';
```

Deberías ver:
- `next_solicitud_numero`

### 3. Prueba la función RPC
```sql
-- En SQL Editor, ejecuta:
SELECT next_solicitud_numero() as numero;
SELECT next_solicitud_numero() as numero;
SELECT next_solicitud_numero() as numero;
```

Deberías ver:
- `S-001`
- `S-002`
- `S-003`

### 4. Verifica la estructura de clientes
```sql
-- En SQL Editor:
\d public.clientes
```

O en el Table Editor de Supabase, entra en `clientes` y verifica columnas:
- id (uuid)
- nombre (text)
- nifCif (text)
- dirFact (text)
- tel (text)
- email (text)
- created_at (timestamptz)
- updated_at (timestamptz)

### 5. Verifica la estructura de solicitudes
```sql
-- Usa Table Editor para verificar que existen:
- id (uuid)
- numero (text)
- cliente (text)
- vehiculo (text)
- origen (text)
- destino (text)
- metros (numeric)
- peso (numeric)
- bultos (integer)
- descripcion (text)
- precio (numeric)
- fotos (jsonb)
- estado (text, default: 'pendiente')
- fecha_ultimo_contacto (timestamptz)
- notas_seguimiento (jsonb, default: '[]')
- avisos_activos (boolean, default: true)
- created_at (timestamptz)
- updated_at (timestamptz)
```

### 6. Verifica la estructura de config
```sql
-- En Table Editor, verifica:
- id (integer, primary key)
- nombre (text)
- tel (text)
- email (text)
- direccion (text)
- logo (text)
- vehicles (jsonb)
- workTypes (jsonb)
- created_at (timestamptz)
- updated_at (timestamptz)
```

---

## 🐛 SOLUCIÓN DE PROBLEMAS

### Error: "relation already exists"
**Causa**: Las tablas ya existen en la BD
**Solución**: 
- Opción A: Ejecuta en una BD nueva (recomendado para desarrollo limpio)
- Opción B: Borra las tablas primero:
```sql
DROP TABLE IF EXISTS public.solicitudes CASCADE;
DROP TABLE IF EXISTS public.clientes CASCADE;
DROP TABLE IF EXISTS public.config CASCADE;
DROP TABLE IF EXISTS public._solicitud_counter CASCADE;
DROP FUNCTION IF EXISTS public.next_solicitud_numero() CASCADE;
```

### Error: "permission denied for schema public"
**Causa**: Falta de permisos en la BD
**Solución**: 
- Usa credenciales de superadmin de Supabase (no anon key)
- O ejecuta vía dashboard Supabase (automáticamente tiene permisos)

### La función RPC devuelve error
**Causa**: Posible conflicto con otra función
**Solución**:
```sql
DROP FUNCTION IF EXISTS public.next_solicitud_numero() CASCADE;
-- Luego vuelve a ejecutar el SQL
```

### Las columnas de solicitudes no coinciden
**Causa**: Script ejecutado parcialmente o conflicto con datos existentes
**Solución**:
```sql
-- Borra todo y empieza de cero (BE CAREFUL - BORRA DATOS):
DROP TABLE IF EXISTS public.solicitudes CASCADE;
DROP TABLE IF EXISTS public._solicitud_counter CASCADE;

-- Luego vuelve a ejecutar el SQL
```

---

## 🔒 PRÓXIMOS PASOS DESPUÉS DEL SQL

1. **Prueba con datos de ejemplo**
   - Inserta un cliente
   - Inserta una solicitud
   - Verifica que todo se guarda bien

2. **Configura RLS (Row Level Security)**
   - Esto se hace en una fase posterior
   - Las tablas ahora tienen RLS desactivado

3. **Configura backups**
   - En Supabase Dashboard → Backups

4. **Sincroniza los API Keys**
   - Verifica que src/shared/lib/supabase.js usa la URL y KEY correctas

---

## 📋 CHECKLIST FINAL

- [ ] Leí y verifiqué [SUPOSICIONES_BD.md](./SUPOSICIONES_BD.md)
- [ ] Tengo acceso a mi proyecto Supabase
- [ ] Ejecuté el SQL (ya sea por dashboard o CLI)
- [ ] Verifiqué que las 4 tablas existen
- [ ] Probé la función RPC y devuelve números secuenciales
- [ ] Probé insertar datos manualmente en una tabla

---

## ❓ Preguntas frecuentes

### P: ¿Puedo ejecutar el SQL en una base de datos local primero?
**R**: Sí, si tienes Supabase local o PostgreSQL instalado:
```bash
psql -U postgres -h localhost < database_schema.sql
```

### P: ¿Qué pasa si ejecuto el SQL dos veces?
**R**: La mayoría de instrucciones usan `IF NOT EXISTS`, así que es seguro ejecutar dos veces.
Solo la función RPC podría dar error, pero tienes `DROP FUNCTION IF NOT EXISTS` al inicio si lo necesitas.

### P: ¿Debo hacer backup antes?
**R**: Si tu BD ya tiene datos, SÍ. En Supabase Dashboard → Backups → Manual Backup.
Si es una BD nueva, no es necesario.

### P: ¿Dónde veo los logs de ejecución?
**R**: En Supabase Dashboard → Logs → Database → Recent queries

---

## 🎉 ¡Éxito!

Si todo funcionó, tu base de datos está lista para que la aplicación escriba datos. 
Ahora puedes:
1. Abrir la aplicación ELSA-ERP
2. Crear clientes
3. Crear solicitudes
4. Todo debe guardarse en Supabase automáticamente

---
