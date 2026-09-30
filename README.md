# ELSA-ERP

Aplicación web interna de ELSA para gestionar el día a día de la empresa:
solicitudes de presupuesto, servicios, albaranes, calendario, flota de vehículos
y clientes. Genera los presupuestos y albaranes en PDF y se puede instalar en el
móvil como aplicación (PWA).

## Qué hace

- **Solicitudes**: alta de solicitudes de presupuesto, seguimiento del estado,
  notas, avisos y fotos del trabajo. Presupuesto en PDF con los textos fijos
  configurables (contratación, forma de pago, observaciones, conformidad, aviso legal).
- **Servicios**: planificación de los trabajos a partir de una solicitud, con
  horas y vehículo asignados, y envío al cliente por WhatsApp o email.
- **Albaranes**: albaranes vinculados a un servicio, con firma del cliente y PDF.
- **Calendario**: vista mensual de servicios y eventos propios.
- **Flota**: fichas de los vehículos con control de ITV, seguro, etc.
- **Clientes**: ficha de cliente con numeración propia e importación masiva
  desde ficheros exportados de Factusol.
- **Configuración**: datos de la empresa, logo, vehículos, contacto del
  administrador y textos de los presupuestos.

El acceso requiere iniciar sesión (Supabase Auth). Todas las tablas tienen RLS:
quien tiene sesión iniciada puede con todo, quien no la tiene no puede con nada.

## Stack

| Capa | Tecnología |
| --- | --- |
| Interfaz | [React 19](https://react.dev) |
| Empaquetado y desarrollo | [Vite](https://vite.dev) |
| Estilos | [Tailwind CSS](https://tailwindcss.com) |
| Base de datos, auth y almacenamiento de fotos | [Supabase](https://supabase.com) (Postgres + RLS + Storage) |
| Generación de PDF | [jsPDF](https://github.com/parallax/jsPDF) |
| Instalable en el móvil | PWA: `public/manifest.webmanifest` y service worker en `public/sw.js` |

No hay backend propio: la aplicación habla directamente con Supabase desde el
navegador usando la anon key y las políticas RLS de la base de datos.

## Estructura del repositorio

```
src/
  App.jsx             Estado global, navegación entre pantallas y acceso a datos
  screens/            Login, recuperación de contraseña, configuración, clientes
  modules/            Un módulo por área: solicitudes, servicios, albaranes, flota, eventos
    <modulo>/db.js      Acceso a Supabase de ese módulo
    <modulo>/screens/   Pantallas de ese módulo
    <modulo>/pdf.js     Generación de PDF (donde aplica)
  shared/
    components/       Componentes de interfaz reutilizables
    lib/              Cliente de Supabase, PDF, mensajería, utilidades
public/               Manifest, iconos y service worker de la PWA
supabase/
  migrations/         Esquema base y migraciones (ver supabase/README.md)
  comprobar_columnas.sql
```

## Arrancar en local

Requisitos: Node.js 22 o superior y npm.

```bash
npm install
cp .env.example .env     # y rellena las variables (ver abajo)
npm run dev
```

Vite muestra la URL local (normalmente `http://localhost:5173`).

Otros comandos:

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con recarga en caliente. El service worker no se registra en desarrollo. |
| `npm run build` | Genera la versión de producción en `dist/`. |
| `npm run preview` | Sirve `dist/` en local para probar la build (aquí sí se registra el service worker). |
| `npm run lint` | Pasa ESLint. |

## Variables de entorno

Se leen de un fichero `.env` en la raíz (no se sube al repositorio; el
`.gitignore` ya lo excluye). `.env.example` sirve de plantilla.

| Variable | Valor |
| --- | --- |
| `VITE_SUPABASE_URL` | URL del proyecto de Supabase, por ejemplo `https://xxxx.supabase.co`. |
| `VITE_SUPABASE_ANON_KEY` | Anon key (clave pública) del proyecto. |

Ambos valores están en el panel de Supabase, en **Project Settings > API**.
Como llevan el prefijo `VITE_`, Vite los incrusta en el JavaScript de la
aplicación: la anon key es pública por diseño y la seguridad la ponen las
políticas RLS, nunca pongas aquí la service role key.

## DeCA: procedimiento del operario

El DeCA (documento electrónico de control administrativo) es un PDF con un QR
que se emite desde la ficha del servicio. La app lo genera y lo guarda; el
conductor lo lleva en el móvil. Las condiciones legales exactas (a qué
transportes aplica, qué datos exige, cuánto se conserva) están en la
[Orden FOM/2861/2012](https://www.boe.es/eli/es/o/2012/12/13/fom2861/con) y
sus modificaciones: este apartado solo explica cómo se usa la app.

**Cuándo se emite.** Antes de salir, en cada servicio marcado como "requiere
DeCA" (casilla en ✏️ Editar, bloque "Datos del DeCA"). Un servicio abierto con
esa casilla y sin DeCA vigente se marca en la lista y el calendario.

**Cómo se emite.**
1. Abre el servicio. Bloque rosa "DeCA".
2. Si faltan datos, la ficha los lista y no deja emitir: los del servicio se
   completan en ✏️ Editar; los de la empresa, en ⚙️ Configuración.
3. Pulsa **📄 Emitir DeCA**. Aparece el número (`DECA-001`…) y el estado.
4. **💬 Enviar por WhatsApp** manda al conductor el enlace al PDF.

**Estados en la ficha.** *Sin DeCA* (hay que emitir), *Emitido* (vigente),
*Anulado* (hay que emitir otro antes de salir) y *Sustituido* (anulado, y se
emitió otro después).

**Cómo se enseña en un control.** El conductor abre el enlace recibido, o pulsa
**📄 Abrir PDF** en la ficha, y enseña el PDF en el móvil. El QR del propio PDF
apunta a su URL pública, que se abre **sin sesión ni contraseña**. Conviene que
el conductor tenga el PDF ya descargado en el móvil por si no hay cobertura.

**Si hay un error en un DeCA emitido.** Un DeCA emitido no se edita ni se
borra. Solo un **admin** puede anularlo: **⛔ Anular** en la tarjeta del DeCA,
con motivo obligatorio. Queda registrado quién, cuándo y por qué. Después,
corrige el dato en el servicio y emite uno nuevo (queda como *Sustituido* el
anulado). Un operario que detecte un error avisa a un admin.

**Si algo falla al emitir.**
| Síntoma | Qué hacer |
| --- | --- |
| "Faltan datos obligatorios" | Rellenar lo que indica la lista. |
| "No se ha podido reservar el número" / "subir el PDF" / "registrar el DeCA" | Comprobar la conexión y reintentar. No se guarda un DeCA a medias; puede quedar un número sin usar, y no es un problema. |
| El botón Anular no aparece | Tu cuenta no es admin. |
| Sigue sin salir | Anotar el mensaje exacto y avisar al responsable de la app. |

**Aviso.** Anular no retira el PDF: su URL sigue abierta y el PDF no lleva
marca de anulado. Un DeCA anulado hay que dejar de usarlo y borrarlo del móvil
del conductor.

## Base de datos

Para levantar la base de datos en un proyecto nuevo de Supabase, o para hacer
cualquier cambio de esquema, sigue las instrucciones de
[`supabase/README.md`](supabase/README.md). En resumen: se ejecuta primero el
esquema base y después cada migración por orden, y todo cambio de esquema se
guarda como migración aunque se haya probado antes a mano en el SQL Editor.

## Despliegue

`npm run build` genera un sitio estático en `dist/` que se puede servir desde
cualquier hosting de ficheros estáticos (por ejemplo Vercel). Las variables de
entorno anteriores hay que definirlas también en el hosting, porque se
incrustan en el momento de la build.
