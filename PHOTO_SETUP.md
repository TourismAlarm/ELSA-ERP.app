# Configuración de Fotos en Servicios

Esta guía te ayudará a configurar la funcionalidad de adjuntar fotos a cada servicio.

## Pasos de Configuración

### 1. Crear el Bucket en Supabase Storage

1. Ve a [Supabase Dashboard](https://app.supabase.com)
2. Selecciona tu proyecto
3. Ve a **Storage** en el menú lateral
4. Haz clic en **Create a new bucket**
5. Nombre del bucket: `service-photos`
6. **Marca como "Public"** para permitir acceso a las imágenes
7. Haz clic en **Create bucket**

### 2. Configurar Políticas de RLS (Row Level Security)

1. En el bucket `service-photos`, haz clic en **Policies**
2. Crea las siguientes políticas:

#### Permitir carga de archivos (INSERT)
- Haz clic en **New Policy**
- Selecciona **For authenticated users can insert**
- En las condiciones, puedes dejar vacío (permite a cualquier usuario autenticado)
- Haz clic en **Review** y luego **Save policy**

#### Permitir lectura pública (SELECT)
- Haz clic en **New Policy**
- Selecciona **For public access**
- En "Permissions", marca **SELECT**
- En las condiciones, puedes dejar vacío
- Haz clic en **Review** y luego **Save policy**

#### Permitir eliminación por usuario (DELETE)
- Haz clic en **New Policy**
- Selecciona **For authenticated users can delete**
- En las condiciones, puedes dejar vacío
- Haz clic en **Review** y luego **Save policy**

### 3. Crear la columna en la tabla (Opcional pero Recomendado)

Si deseas almacenar los metadatos de las fotos directamente en la BD:

1. Ve a **SQL Editor** en Supabase
2. Ejecuta la siguiente query:

```sql
ALTER TABLE solicitudes ADD COLUMN fotos JSONB DEFAULT '[]'::jsonb;
```

## Uso en la Aplicación

Una vez configurado:

1. Abre o edita una solicitud
2. En la sección "Fotos del servicio", podrás:
   - Hacer clic para seleccionar imágenes
   - Arrastrar y soltar imágenes
   - Ver miniaturas de las fotos adjuntas
   - Eliminar fotos haciendo hover y clickeando en la papelera

3. Las fotos se guardan automáticamente en Supabase Storage
4. Las referencias se almacenan con la solicitud

## Notas Técnicas

- Las fotos se almacenan en: `solicitudes/{id-solicitud}/{timestamp}_{nombre-archivo}`
- Se soportan formatos: PNG, JPG, GIF
- Tamaño máximo recomendado: 10MB por imagen
- Las URLs públicas se generan automáticamente para acceso rápido
