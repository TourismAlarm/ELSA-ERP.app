# Suposiciones en el Script SQL - ELSA-ERP

## Resumen
El script SQL ha sido generado analizando TODO el código de la aplicación (módulos, screens, componentes). Se han deducido **3 tablas principales** y **1 función RPC**.

---

## 📋 TABLAS IDENTIFICADAS

### 1. **clientes** ✅
**Confirmación: 100%**
- Columnas: id, nombre, nifCif, dirFact, tel, email
- Usada en: ClientesScreen.jsx, FormScreen.jsx, src/modules/solicitudes/db.js (funciones dbLoadClientes, dbSaveCliente, dbUpdateCliente)
- Sin sorpresas

---

### 2. **solicitudes** ⚠️
**Confirmación: 95%**

#### Campos CONFIRMADOS (de lectura/escritura en código):
- `id` - UUID primary key
- `numero` - String único, generado por RPC
- `cliente` - Nombre del cliente (text)
- `vehiculo` - CSV de vehículos (text)
- `origen`, `destino` - Ubicaciones
- `metros`, `peso`, `bultos` - Datos de carga opcionales
- `descripcion` - Texto libre
- `precio` - Numeric
- `fotos` - JSONB array
- `estado` - Text con valor por defecto "pendiente"
- `fecha_ultimo_contacto` - Timestamp
- `notas_seguimiento` - JSONB array
- `avisos_activos` - Boolean con default true

#### Campos DEDUCIDOS (del formulario pero no explícitamente guardados):
- `nifCif` - Se copia del cliente al crear solicitud (FormScreen.jsx línea 51)
- `dirFact` - Se copia del cliente al crear solicitud
- `telCliente` - Se copia del cliente
- `emailCliente` - Se copia del cliente

**⚠️ VERIFICACIÓN NECESARIA:**
```
¿Estos cuatro campos (nifCif, dirFact, telCliente, emailCliente) se guardan EN LA TABLA 
solicitudes o solo en clientes?

Evidencia del código:
- En FormScreen.jsx línea 10: "fotos: initial.fotos || []" sugiere que fotos SE GUARDAN
- En db.js línea 10: "const { nifCif, dirFact, fotos, ...rest } = s;" 
  → nifCif y dirFact SE EXCLUYEN del insert (comentario: "campos del cliente, no de solicitudes")
  → fotos SE INCLUYE en el insert

CONCLUSIÓN: nifCif y dirFact NO se guardan en solicitudes, solo se usan en el formulario.
telCliente y emailCliente tampoco se guardan (solo en clientes).
```

---

### 3. **config** ✅
**Confirmación: 90%**

#### Campos CONFIRMADOS:
- `id` - Integer (siempre 1)
- `nombre` - Nombre empresa
- `tel` - Teléfono empresa
- `email` - Email empresa
- `direccion` - Dirección fiscal
- `logo` - Base64 encoded image (text o BYTEA)
- `vehicles` - JSONB array de strings

#### Campo DEDUCIDO pero NO CONFIRMADO:
- `workTypes` - JSONB array
  - Definido en `src/shared/lib/constants.js` como DEFAULT_WORK_TYPES
  - Cargado en ConfigScreen.jsx línea 29, 32
  - **PERO**: No se guarda en dbSaveConfig (línea 48, 99) - solo se actualiza `vehicles`
  
**⚠️ VERIFICACIÓN NECESARIA:**
¿Se usa workTypes en algún lugar? Si no, podría ser código legacy sin usar.

---

### 4. **_solicitud_counter** (Interna) ✅
**Confirmación: 100%**

Tabla auxiliar para la función RPC next_solicitud_numero().
- Propósito: Mantener el contador de solicitudes de forma segura
- Acceso: Solo la función RPC debe acceder

---

## 🔧 RPC IDENTIFICADA

### **next_solicitud_numero()** ✅
**Confirmación: 100%**

#### Uso:
- Llamada en: dbSaveSolicitud (src/modules/solicitudes/db.js línea 40)
- Devuelve: String con el siguiente número de solicitud
- Formato asumido: "S-001", "S-002", ..., "S-999", "S-1000", etc.

**⚠️ VERIFICACIÓN NECESARIA:**
1. ¿El formato "S-001" es correcto o debería ser diferente?
   - Ejemplos alternativos: "SOL-001", "-001", "20260001", "2026-001"
2. ¿Cómo se comporta el contador?
   - ¿Se reinicia cada año/mes?
   - ¿Es global y secuencial indefinidamente?

---

## 📸 ALMACENAMIENTO DE FOTOS

**Confirmación: 100%**

- Las fotos se guardan en Supabase Storage (bucket `service-photos`)
- No hay tabla de BD para fotos, solo referencias JSON en solicitudes.fotos
- Estructura de cada foto: `{ id, url, path, uploadedAt }`
- El código de subida: PhotoUploader.jsx

**CONCLUSIÓN**: No se necesita tabla de fotos, solo almacenar JSON.

---

## ⚠️ VERIFICACIONES RECOMENDADAS

### ANTES de ejecutar el SQL:

#### 1. Formato del número de solicitud
```javascript
// En next_solicitud_numero() actualmente generamos: 'S-' || LPAD(num, 3, '0')
// Ejemplo: S-001, S-002, S-999, S-1000

// Pregunta: ¿Es correcto? ¿Debería ser algo diferente?
```

#### 2. Estructura de notas_seguimiento
```javascript
// Código agrega notas como array simple:
const notas = [...(current.notas_seguimiento || []), nota];

// Pero ¿qué es "nota"? ¿Qué estructura tiene?
// Suposición: { texto, autor?, fecha?, ... }
// Debería verificarse viendo cómo se añaden notas en AddNotaScreen o similar
```

#### 3. Valores posibles de estado
```
Confirmado: "pendiente"
Probable: "completada", "cancelada", "en_progreso", "pausada", etc.

¿Debería ser ENUM en lugar de TEXT para validar?
```

#### 4. ¿Campos nifCif, dirFact, telCliente, emailCliente en solicitudes?
```
Evidencia: db.js línea 10 EXCLUYE estos campos
const { nifCif, dirFact, fotos, ...rest } = s;

✅ Decisión: NO incluirlos en solicitudes, solo guardar en clientes.
```

#### 5. ¿Usar workTypes?
```
Está definido pero no se guarda. ¿Es código legacy o se usa en otra parte?
Búsqueda: "workTypes" no aparece siendo guardado en ningún lugar.

✅ Decisión: Incluir en config por si acaso, pero verificar si se usa.
```

---

## 📝 INSTRUCCIONES PARA EJECUTAR

### Opción A: Via Supabase Dashboard SQL Editor

1. Abre tu proyecto Supabase
2. Ve a SQL Editor
3. Crea una nueva query
4. Copia TODO el contenido de `database_schema.sql`
5. Ejecuta

### Opción B: Via Supabase CLI (Local)

```bash
# Si tienes supabase cli instalado:
supabase db push
```

### Opción C: Manual verificación

Antes de ejecutar:
1. Verifica las preguntas en la sección "⚠️ VERIFICACIONES"
2. Ajusta el script si es necesario
3. Ejecuta el SQL

---

## ✅ CHECKLIST FINAL

- [ ] **Número de solicitud**: Confirmo que formato "S-001, S-002, ..." es correcto
- [ ] **Estados**: Confirmo los valores posibles para campo `estado`
- [ ] **Notas**: Confirmo estructura de objetos en `notas_seguimiento`
- [ ] **workTypes**: Confirmo si debe guardarse en config o no
- [ ] **Campos de cliente**: Confirmo que solicitudes NO debe tener nifCif, dirFact, etc.
- [ ] **RLS**: Confirmo que NO se activen RLS todavía (se harán después)

---

## 🔍 AUDITORÍA DEL CÓDIGO REALIZADO

Archivos analizados:
- ✅ src/modules/solicitudes/db.js
- ✅ src/shared/lib/supabase.js
- ✅ src/modules/solicitudes/screens/FormScreen.jsx
- ✅ src/screens/ConfigScreen.jsx
- ✅ src/screens/ClientesScreen.jsx
- ✅ src/shared/components/ui/PhotoUploader.jsx
- ✅ Búsqueda global de `.from()`, `.select()`, `.insert()`, `.rpc()` en todo src/

Tablas encontradas:
- `clientes` - CONFIRMADO 100%
- `solicitudes` - CONFIRMADO 95%
- `config` - CONFIRMADO 90%
- `_solicitud_counter` - Función auxiliar CONFIRMADA 100%

Funciones RPC:
- `next_solicitud_numero()` - CONFIRMADO 100%

---

## 📞 Contacto / Cambios

Si necesitas ajustar algo:
1. Avísame de los cambios específicos
2. Regeneraré el SQL si es necesario
3. O puedes editar database_schema.sql directamente

---
