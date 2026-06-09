# ANÁLISIS COMPLETO - ELSA-ERP Application

## 🎯 QUÉ ES ELSA-ERP

**Sistema de Gestión de Solicitudes de Servicio (ERP Light)**

- **Tipo**: SPA (Single Page Application) con React 19
- **Stack**: React + Vite + Tailwind CSS + Supabase + jsPDF
- **Propósito**: Gestionar solicitudes/presupuestos de servicios (grúas, transporte, etc.)
- **Usuarios**: Administradores/supervisores de la empresa
- **Datos**: En Supabase (BD + Auth + Storage)

---

## 📊 ARQUITECTURA GENERAL

```
┌─────────────────────────────────────────────────────┐
│                    APP.JSX (Router Central)         │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │
│  │ LoginScreen  │  │ DashboardScrn│  │ ViewScrn │  │
│  └──────────────┘  └──────────────┘  └──────────┘  │
│  ┌──────────────┐  ┌──────────────┐                │
│  │ ConfigScreen │  │  FormScreen  │                │
│  └──────────────┘  └──────────────┘                │
│  ┌──────────────┐                                   │
│  │ClientesScreen│                                   │
│  └──────────────┘                                   │
│                                                     │
├─────────────────────────────────────────────────────┤
│  Shared                                             │
│  ├── Components/UI (Btn, Field, Input, etc.)       │
│  ├── Lib (supabase, pdf, messaging, utils)         │
│  └── Assets                                         │
│                                                     │
├─────────────────────────────────────────────────────┤
│  Modules                                            │
│  └── solicitudes/                                   │
│      ├── db.js (CRUD operations)                    │
│      └── screens/ (DashboardScreen, ViewScreen...)  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 🔐 ESTADO: Autenticación Supabase

```
1. LoginScreen
   ├─ Email + Password
   └─ supabase.auth.signInWithPassword()
   
2. Session Management
   ├─ onAuthStateChange listener
   └─ Auto-refresh en caso de cambio

3. Protected Routes
   └─ Si no hay session → LoginScreen
```

**Estado**: ✅ Implementado

---

## 📋 PANTALLAS (Screens)

### 1. **LoginScreen** ✅
```
Entrada: email, password
├─ Validación con Supabase Auth
├─ Manejo de errores
└─ Redirección al Dashboard
```

### 2. **DashboardScreen** ✅
```
Panel principal con:
├─ Lista de solicitudes
├─ Filtros por estado (4: pendiente, seguimiento, aceptado, rechazado)
├─ Contador de solicitudes por estado
├─ ⚠️ Alertas (solicitudes sin contacto >3 días)
├─ Búsqueda global (cliente, descripción, número, vehículos, etc.)
├─ Acciones rápidas:
│  ├─ Nueva solicitud
│  ├─ Ver solicitud
│  ├─ Editar solicitud
│  ├─ Cambiar estado
│  ├─ Toggle avisos
│  └─ Eliminar solicitud
└─ Botón config (esquina superior derecha)
```

### 3. **FormScreen** ✅
```
Crear/Editar solicitud:
├─ Cliente (autocompletado desde lista)
├─ NIF/CIF, Dirección, Teléfono, Email del cliente
├─ Vehículos (checkboxes multi-select)
├─ Origen (Punto A) y Destino (Punto B)
├─ Datos de carga (metros, peso, bultos) — opcionales
├─ Descripción
├─ Precio estimado — opcional
├─ Fotos (subida/drag-drop)
├─ Botón guardar cliente nuevo (si no existe)
└─ Actions: Guardar / Cancelar
```

### 4. **ViewScreen** ✅
```
Detalles completos de solicitud:
├─ Encabezado empresa (logo, nombre, tel, email)
├─ Número y fecha de solicitud
├─ Estado actual (con selector para cambiar)
├─ Días desde último contacto
├─ Datos del cliente (nombre, NIF, dirección, tel, email)
├─ Vehículos (tags)
├─ Origen/Destino
├─ Datos de carga (si existen)
├─ Descripción
├─ Galería de fotos (clickeable)
├─ 📊 Seguimiento (timeline de notas)
│  ├─ Notas manuales
│  ├─ Envíos por WhatsApp
│  ├─ Envíos por email
│  └─ Entrada nueva de nota
├─ Precio estimado
├─ 📤 Botones de acción:
│  ├─ Enviar por WhatsApp
│  ├─ Enviar por Email
│  ├─ Descargar PDF
│  ├─ Editar
│  └─ Eliminar
└─ Botón atrás
```

### 5. **ConfigScreen** ✅
```
Configuración de empresa:
├─ Logo (subida imagen JPEG/PNG)
├─ Nombre empresa
├─ Teléfono
├─ Email
├─ Dirección fiscal
├─ Lista de vehículos (agregar/remover)
├─ Actions:
│  ├─ Guardar configuración
│  ├─ Gestionar clientes
│  ├─ Descargar backup JSON
│  └─ Cerrar sesión
└─ Estado: datos guardados en tabla config (id=1)
```

### 6. **ClientesScreen** ✅
```
CRUD de clientes:
├─ Lista de clientes (ordenada por nombre)
├─ Para cada cliente:
│  ├─ Nombre
│  ├─ NIF/CIF
│  ├─ Dirección
│  ├─ Teléfono
│  ├─ Email
│  └─ Botones: Editar, Eliminar
├─ Nuevo cliente (formulario)
└─ Accesible desde ConfigScreen
```

---

## 💾 MÓDULO: Solicitudes (db.js)

**CRUD Operations:**

| Operación | Función | BD | Status |
|-----------|---------|-------|---------|
| Crear | dbSaveSolicitud | INSERT | ✅ |
| Leer | dbLoadSolicitudes | SELECT | ✅ |
| Actualizar | dbUpdateSolicitud | UPDATE | ✅ |
| Eliminar | dbDeleteSolicitud | DELETE | ✅ |
| Cambiar estado | dbCambiarEstado | UPDATE estado | ✅ |
| Agregar nota | dbAddNota | UPDATE notas_seguimiento | ✅ |
| Toggle avisos | dbToggleAvisos | UPDATE avisos_activos | ✅ |

**RPC Function:**
```
next_solicitud_numero() → "S-001", "S-002", etc.
```

---

## 🎨 COMPONENTES UI COMPARTIDOS

| Componente | Prop | Uso |
|------------|------|-----|
| **Btn** | size, variant, disabled | Botones |
| **Field** | label | Wrapper label + input |
| **Input** | type, placeholder, value | Texto/email/number |
| **Textarea** | value, placeholder | Áreas de texto |
| **PhotoUploader** | solicitudId, existingPhotos, onPhotosChange | Upload fotos drag-drop |
| **PhotoGallery** | photos | Galería modal clickeable |
| **ListManager** | items, onChange | Add/remove items lista |

**Variantes de Btn:**
- `primary` (default - zinc-900)
- `secondary` (zinc-200)
- `danger` (red)
- `whatsapp` (green)
- `email` (blue)
- `ghost` (transparent)

---

## 📤 LIBRERÍAS DE UTILIDAD

### 1. **pdf.js** 📄
```
generatePDF(solicitud, config)
├─ Cabecera con logo/nombre empresa
├─ Título: "SOLICITUD DE SERVICIO"
├─ Datos cliente (nombre, NIF, dirección, tel)
├─ Vehículos
├─ Origen/Destino
├─ Datos de carga
├─ Descripción
├─ Precio estimado
└─ Exporta a archivo: solicitud_S-XXX.pdf
```
**Librería**: jsPDF v4.2.1

### 2. **messaging.js** 💬
```
buildMessage(solicitud, config)
├─ Formato WhatsApp/Email legible
└─ Campos: número, cliente, vehículos, origen/destino, 
          carga, descripción, precio

sendWhatsApp(solicitud, config)
├─ Abre wa.me con mensaje pre-llenado
└─ Registra nota automática (tipo: whatsapp)

sendEmail(solicitud, config)
├─ Abre mailto con asunto y cuerpo pre-llenados
└─ Registra nota automática (tipo: email)
```

### 3. **constants.js** 🔧
```
ADMIN_WHATSAPP    = +XX XXXXXXXXXX (número administrador)
ADMIN_EMAIL       = admin@email.com
DEFAULT_VEHICLES  = ["Grúa 45T", "Plataforma", ...] (lista inicial)
DEFAULT_WORK_TYPES = [lista tipos trabajo] (sin usar actualmente)
```

### 4. **utils.js** 🛠️
```
today()
├─ Retorna fecha actual en formato ISO
└─ Usado en solicitudes al crear
```

### 5. **supabase.js** 🔑
```
export const supabase = createClient(URL, ANON_KEY)
└─ Cliente Supabase configurado
```

---

## 📊 FLUJOS DE DATOS

### Flujo 1: Crear Solicitud
```
FormScreen (vacío)
    ↓
Usuario llena formulario
    ↓
dbSaveSolicitud()
    ├─ Genera número con RPC next_solicitud_numero()
    ├─ Inserta en tabla solicitudes
    └─ Retorna solicitud creada
    ↓
Mostrar ViewScreen con nueva solicitud
```

### Flujo 2: Editar Solicitud
```
DashboardScreen → Editar
    ↓
FormScreen (pre-llenado)
    ↓
dbUpdateSolicitud()
    ├─ UPDATE solicitudes SET ...
    └─ Actualiza estado local
    ↓
Mostrar ViewScreen actualizada
```

### Flujo 3: Cambiar Estado
```
ViewScreen (dropdown estado)
    ↓
handleCambioEstado()
    ├─ dbCambiarEstado()
    ├─ Actualiza fecha_ultimo_contacto
    └─ Actualiza estado local
```

### Flujo 4: Agregar Nota
```
ViewScreen (input nota)
    ↓
handleAddNota()
    ├─ dbAddNota()
    │  ├─ Fetch notas_seguimiento actuales
    │  ├─ Append nueva nota {tipo: "manual", fecha, texto}
    │  └─ UPDATE tabla solicitudes
    └─ Actualiza estado local
```

### Flujo 5: Enviar WhatsApp/Email
```
ViewScreen (botones WhatsApp/Email)
    ↓
sendWhatsApp() / sendEmail()
    ├─ Construye mensaje formateado
    ├─ Abre wa.me / mailto en navegador
    └─ dbAddNota() (registra envío)
        ├─ tipo: "whatsapp" o "email"
        └─ texto: "Enviado por..."
```

### Flujo 6: Generar PDF
```
ViewScreen (botón PDF)
    ↓
generatePDF()
    ├─ Crea documento jsPDF
    ├─ Añade header empresa (con logo si existe)
    ├─ Rellena datos solicitud
    └─ Descarga archivo PDF
```

### Flujo 7: Gestionar Clientes
```
ConfigScreen → Gestionar clientes
    ↓
ClientesScreen
    ├─ Listar clientes (ordenado por nombre)
    ├─ Nuevo cliente (formulario)
    ├─ Editar cliente
    └─ Eliminar cliente (con confirmación)
    ↓
Guardar en tabla clientes
```

### Flujo 8: Upload Fotos
```
FormScreen / PhotoUploader
    ├─ Drag-drop o click a input file
    ├─ Upload a Supabase Storage (bucket: service-photos)
    │  └─ Path: solicitudes/{id}/{timestamp}_{filename}
    ├─ Get public URL
    └─ Store en fotos array (JSON)
        └─ {id, url, path, uploadedAt}
```

---

## 📦 ESTADO DE FEATURES

### ✅ IMPLEMENTADOS

| Feature | Status | Notas |
|---------|--------|-------|
| Autenticación | ✅ | Supabase Auth (email/password) |
| CRUD Solicitudes | ✅ | Crear, Leer, Actualizar, Eliminar |
| Cambiar estado | ✅ | 4 estados: pendiente, seguimiento, aceptado, rechazado |
| Notas de seguimiento | ✅ | Timeline con tipos (manual, whatsapp, email) |
| Alertas | ✅ | Solicitudes sin contacto >3 días |
| Búsqueda | ✅ | Global en cliente, descripción, número, notas, etc. |
| Filtro por estado | ✅ | En DashboardScreen |
| CRUD Clientes | ✅ | Con autocompletado en FormScreen |
| Upload fotos | ✅ | Drag-drop, preview, delete, galería modal |
| Generar PDF | ✅ | Con datos empresa + solicitud |
| Enviar WhatsApp | ✅ | Mensaje pre-formateado a admin |
| Enviar Email | ✅ | Mensaje pre-formateado a admin |
| Backup JSON | ✅ | Descargar datos (ConfigScreen) |
| Config empresa | ✅ | Logo, nombre, contacto, lista vehículos |
| Responsive Design | ✅ | Mobile-first con Tailwind |
| Dark/Light mode | ✅ | Background grid CSS puro |

### ⚠️ POR REVISAR / MEJORAR

| Feature | Status | Notas |
|---------|--------|-------|
| RLS (Row Level Security) | ❌ | No está implementado |
| Validaciones | ⚠️ | Mínimas, solo algunas en FormScreen |
| Error handling | ⚠️ | Algunos errores silenciados (console.error) |
| Loading states | ⚠️ | No hay skeleton loaders |
| Undo/Redo | ❌ | No existe |
| Exportar Excel | ❌ | Solo PDF |
| Filtros avanzados | ⚠️ | Solo por estado |
| Asignación usuarios | ❌ | No existe (multi-user) |
| Permisos granulares | ❌ | No existe |
| Historial cambios | ❌ | No existe |
| Notificaciones | ❌ | No hay push/email automáticas |
| Integraciones | ❌ | Solo WhatsApp y Email manuales |
| Reportes | ❌ | No hay reportes |
| API REST | ❌ | Solo acceso directo a Supabase |
| Tests unitarios | ❌ | No hay tests |
| Tests E2E | ❌ | No hay tests |

### ❌ NO IMPLEMENTADOS (Fuera de scope)

- Sincronización offline
- Caché local persistente
- Notificaciones push
- Mobile app nativa
- Desktop app (Electron)
- Webhooks
- API pública
- OAuth (Google, MS, etc.)
- 2FA
- Auditoría completa
- Gestión usuarios avanzada

---

## 📂 ESTRUCTURA DE ARCHIVOS

```
src/
├── App.jsx                          [Router central, state manager]
├── main.jsx                         [Entrada React]
│
├── screens/                         [Pantallas principales]
│   ├── LoginScreen.jsx
│   ├── ConfigScreen.jsx
│   ├── ClientesScreen.jsx
│   └── index.js                     [Exports]
│
├── modules/                         [Features organizadas]
│   └── solicitudes/
│       ├── db.js                    [CRUD + RPC calls]
│       └── screens/
│           ├── DashboardScreen.jsx
│           ├── FormScreen.jsx
│           ├── ViewScreen.jsx
│           └── index.js
│
├── shared/                          [Código compartido]
│   ├── components/
│   │   └── ui/
│   │       ├── Btn.jsx
│   │       ├── Field.jsx
│   │       ├── Input.jsx
│   │       ├── Textarea.jsx
│   │       ├── PhotoUploader.jsx
│   │       ├── PhotoGallery.jsx
│   │       ├── ListManager.jsx
│   │       └── index.js
│   │
│   ├── lib/
│   │   ├── supabase.js              [Cliente Supabase]
│   │   ├── pdf.js                   [Generación PDF]
│   │   ├── messaging.js             [WhatsApp + Email]
│   │   ├── constants.js             [Constantes globales]
│   │   ├── utils.js                 [Funciones útiles]
│   │   └── index.js
│   │
│   └── assets/
│       └── [logos, imágenes]
│
└── [config files]
    ├── vite.config.js               [Bundler]
    ├── tailwind.config.js           [CSS]
    ├── postcss.config.js            [CSS processor]
    ├── eslint.config.js             [Linter]
    └── package.json                 [Dependencies]
```

---

## 🔗 DEPENDENCIAS

```json
{
  "react": "^19.2.4",                 [Framework UI]
  "react-dom": "^19.2.4",             [Render React]
  "@supabase/supabase-js": "^2.101.0",[BD + Auth + Storage]
  "jspdf": "^4.2.1",                  [PDF generation]
  "tailwindcss": "^3.4.19",           [CSS framework]
  "vite": "^8.0.1"                    [Bundler/Dev server]
}
```

---

## 🎯 FLUJO DE ESTADOS (State Management)

### App.jsx (Estado central)

```javascript
const [session, setSession]         // Auth session
const [loadingAuth, setLoadingAuth] // Auth loading
const [config, setConfig]           // Datos empresa
const [solicitudes, setSolicitudes] // Lista solicitudes
const [clientes, setClientes]       // Lista clientes
const [screen, setScreen]           // Current screen: "dashboard" | "form" | "view" | "config" | "clientes"
const [editing, setEditing]         // Solicitud siendo editada
const [viewing, setViewing]         // Solicitud siendo visualizada
const [loadingData, setLoadingData] // Data loading
const [saving, setSaving]           // Save operation pending
```

**Props compartidas**: handlers de eventos (handleFormSave, handleCambiarEstado, etc.)

---

## 🔒 SEGURIDAD (Estado actual)

### ✅ Implementado
- ✅ Autenticación Supabase (email/password)
- ✅ Session management con listeners
- ✅ Usuarios no autenticados → LoginScreen

### ⚠️ Falta implementar
- ❌ RLS policies en tablas
- ❌ Row-level filtering en queries
- ❌ Validación inputs backend
- ❌ Rate limiting
- ❌ CSRF protection
- ❌ XSS prevention (Trusted React, pero revisar)
- ❌ SQL injection (Safe, Supabase SDK lo previene)

---

## 💻 DESARROLLO

### Scripts disponibles
```bash
npm run dev      # Vite dev server (localhost:5173)
npm run build    # Build production (dist/)
npm run lint     # ESLint check
npm run preview  # Preview build
```

### Stack técnico
- **Language**: JavaScript (ES2020+)
- **Framework**: React 19
- **Styling**: Tailwind CSS + PostCSS
- **Bundler**: Vite
- **Linter**: ESLint
- **DB**: Supabase PostgreSQL
- **Auth**: Supabase Auth
- **Storage**: Supabase Storage
- **PDF**: jsPDF

---

## 📊 ESTADÍSTICAS

| Métrica | Valor |
|---------|-------|
| Archivos JS/JSX | ~22 archivos |
| Componentes | 6 Screens + 7 UI components |
| Líneas de código | ~3000 líneas |
| Funciones RPC | 1 (next_solicitud_numero) |
| Tablas BD | 3 principales + 1 auxiliar |
| Estados en ViewScreen | 4 |
| Campos solicitud | 15+ |
| Campos cliente | 5 |

---

## 🚀 PRÓXIMOS PASOS RECOMENDADOS

### Fase 1: Estabilización
- [ ] Implementar validaciones completas
- [ ] Mejorar error handling
- [ ] Agregar loading skeletons
- [ ] Tests unitarios

### Fase 2: Seguridad
- [ ] Implementar RLS
- [ ] Validación backend
- [ ] Rate limiting
- [ ] Auditoría

### Fase 3: Features
- [ ] Exportar Excel
- [ ] Reportes
- [ ] Multi-user con permisos
- [ ] Historial cambios

### Fase 4: Optimización
- [ ] Code splitting
- [ ] Lazy loading
- [ ] Caché estratégico
- [ ] PWA (offline)

---

## 📞 CONTACTO / ROADMAP

Para crear roadmap detallado, consultar documento de roadmap generado en otro chat.

---
