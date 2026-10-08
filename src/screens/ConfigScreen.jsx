import { useState, useRef } from "react";
import { supabase, cargarTodas } from "../shared/lib/supabase";
import { dbSaveConfig } from "../modules/solicitudes/db";
import { Btn, Field, Input, Textarea, ColorPicker } from "../shared/components/ui";
import { DEFAULT_VEHICLES, ADMIN_WHATSAPP, ADMIN_EMAIL } from "../shared/lib/constants";
import { normalizeVehiculos, textoSobre, PALETA } from "../shared/lib/color";
import { TEXTOS_PRESUPUESTO } from "../shared/lib/textos";
import { urlCalendarioERP, dbRegenerarTokenCalendario } from "../modules/eventos/google";

// Gestor de vehículos / equipos con color (los que se usan en servicios,
// solicitudes y el calendario). Cada uno es { nombre, color }.
const VehiculosManager = ({ items, onChange }) => {
  const [draft, setDraft] = useState("");
  const [editando, setEditando] = useState(null); // índice con el picker abierto

  const add = () => {
    const nombre = draft.trim();
    if (!nombre || items.some((v) => v.nombre === nombre)) return;
    onChange([...items, { nombre, color: PALETA[items.length % PALETA.length] }]);
    setDraft("");
  };

  return (
    <div>
      <div className="flex flex-col gap-2 mb-3">
        {items.length === 0 && <span className="text-xs text-zinc-400 italic">Sin vehículos / equipos</span>}
        {items.map((v, i) => (
          <div key={i} className="flex items-center gap-2 flex-wrap">
            <span
              className="flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-full"
              style={{ backgroundColor: v.color, color: textoSobre(v.color) }}
            >
              {v.nombre}
            </span>
            <button
              type="button"
              onClick={() => setEditando(editando === i ? null : i)}
              className="text-xs font-bold text-zinc-500 hover:text-zinc-900"
            >
              🎨 Color
            </button>
            <button
              type="button"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              className="text-zinc-400 hover:text-red-500 transition-colors leading-none text-lg"
            >
              ×
            </button>
            {editando === i && (
              <div className="w-full pl-1 pb-1">
                <ColorPicker value={v.color} onChange={(color) => onChange(items.map((x, idx) => idx === i ? { ...x, color } : x))} />
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Camión 1, 24+jib, Externo..."
          className="w-full border-2 border-zinc-200 rounded-md px-4 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-900 bg-white"
        />
        <button type="button" onClick={add} className="px-4 py-2 bg-zinc-900 text-white text-sm font-bold rounded-md hover:bg-zinc-700 transition-colors shrink-0">+ Añadir</button>
      </div>
    </div>
  );
};

// EXPORTACIÓN DE DATOS (no es la copia de recuperación).
//
// Antes pedía seis tablas sin paginar: Supabase corta cada respuesta a 1.000
// filas sin avisar, así que con 1.482 clientes la «copia» se dejaba 482, y
// faltaban eventos, DeCA, contadores y perfiles. Ahora pide todas las tablas
// por páginas (cargarTodas) y, si cualquiera falla, no descarga nada.
//
// Sigue sin incluir los ficheros (fotos y PDF de DeCA) ni las cuentas de
// usuario: la copia de recuperación de verdad es la de Supabase (ver
// supabase/README.md, «Copias y recuperación»).
const TABLAS_EXPORTACION = [
  ["solicitudes", "id"], ["servicios", "id"], ["albaranes", "id"], ["clientes", "id"],
  ["vehiculos", "id"], ["mantenimientos", "id"], ["eventos", "id"], ["deca", "id"],
  ["perfiles", "id"], ["contadores", "clave", null], ["_solicitud_counter", "id"],
];

const downloadBackup = async (onEstado) => {
  onEstado("Exportando...");

  const [{ data: cfg, error: errorCfg }, ...resultados] = await Promise.all([
    supabase.from("config").select("*").eq("id", 1).maybeSingle(),
    ...TABLAS_EXPORTACION.map(([t, orden, desempate = "id"]) => cargarTodas(t, { orden, desempate })),
  ]);

  const fallos = TABLAS_EXPORTACION.filter((_, i) => resultados[i] === null).map(([t]) => t);
  if (errorCfg || fallos.length > 0) {
    const detalle = [errorCfg ? "config" : null, ...fallos].filter(Boolean).join(", ");
    alert(`No se ha podido exportar: falló la lectura de ${detalle}.\n\nNo se ha guardado nada para no dejarte una exportación incompleta. Si eres operario, la exportación completa es cosa de administración.`);
    onEstado(null);
    return;
  }

  const datos = Object.fromEntries(TABLAS_EXPORTACION.map(([t], i) => [t, resultados[i]]));
  const total = Object.values(datos).reduce((n, filas) => n + filas.length, 0);

  const exportacion = {
    fecha: new Date().toISOString(),
    version: 3,
    aviso: "Exportación de datos. No incluye fotos, PDF de DeCA ni cuentas de usuario.",
    config: cfg,
    ...datos,
  };
  const blob = new Blob([JSON.stringify(exportacion, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ELSA_exportacion_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);

  onEstado(null);
  const resumen = TABLAS_EXPORTACION.map(([t]) => `${datos[t].length} ${t}`).join("\n");
  alert(`Exportados ${total} registros:\n\n${resumen}\n\nNo incluye fotos ni PDF de DeCA.`);
};

// Cambio de contraseña del usuario que ya tiene la sesión iniciada
const CambiarPassword = () => {
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [msg, setMsg] = useState(null); // { tipo: "ok" | "error", texto }
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (pwd.length < 6) return setMsg({ tipo: "error", texto: "La contraseña debe tener al menos 6 caracteres" });
    if (pwd !== pwd2) return setMsg({ tipo: "error", texto: "Las contraseñas no coinciden" });

    setGuardando(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setGuardando(false);

    if (error) return setMsg({ tipo: "error", texto: "No se ha podido cambiar la contraseña" });
    setPwd("");
    setPwd2("");
    setMsg({ tipo: "ok", texto: "Contraseña actualizada" });
  };

  return (
    <div className="bg-white border-2 border-zinc-200 rounded-xl p-6 shadow-sm mb-5 flex flex-col gap-4">
      <div>
        <p className="text-sm font-black text-zinc-900 mb-1">Contraseña</p>
        <p className="text-xs text-zinc-400">Cámbiala cuando quieras. La necesitarás la próxima vez que entres.</p>
      </div>
      <Field label="Nueva contraseña">
        <Input type="password" value={pwd} onChange={(e) => { setPwd(e.target.value); setMsg(null); }} placeholder="••••••••" />
      </Field>
      <Field label="Repite la contraseña">
        <Input type="password" value={pwd2} onChange={(e) => { setPwd2(e.target.value); setMsg(null); }} placeholder="••••••••" />
      </Field>
      {msg && (
        <p className={`text-xs font-semibold ${msg.tipo === "ok" ? "text-green-600" : "text-red-500"}`}>{msg.texto}</p>
      )}
      <Btn variant="secondary" onClick={guardar} disabled={guardando || !pwd || !pwd2}>
        {guardando ? "Guardando..." : "🔐 Cambiar contraseña"}
      </Btn>
    </div>
  );
};

// Conexión con Google Calendar, en los dos sentidos y sin iniciar sesión
// con Google:
//   · ERP → Google: un enlace iCal que se añade en Google Calendar. Lleva un
//     token secreto que se genera aquí; cambiarlo deja sin servicio el viejo.
//   · Google → ERP: la «dirección secreta en formato iCal» del calendario de
//     Google. Sus eventos salen en el calendario del ERP en solo lectura.
const GoogleCalendar = ({ token, onToken, googleUrl, onGoogleUrl }) => {
  const [generando, setGenerando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const enlace = urlCalendarioERP(token);
  const urlMala = googleUrl && !/^https:\/\/calendar\.google\.com\/calendar\/ical\//.test(googleUrl.trim());

  const generar = async () => {
    if (token && !confirm("Si cambias el enlace, el que ya está puesto en Google Calendar deja de funcionar y habrá que añadir el nuevo. ¿Seguir?")) return;
    setGenerando(true);
    const nuevo = await dbRegenerarTokenCalendario();
    setGenerando(false);
    if (nuevo) onToken(nuevo);
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      prompt("Copia el enlace:", enlace);
    }
  };

  return (
    <div className="flex flex-col gap-5 bg-white border-2 border-zinc-200 rounded-xl p-6 shadow-sm mb-5">
      <div>
        <p className="text-sm font-black text-zinc-900 mb-1">📆 Google Calendar</p>
        <p className="text-xs text-zinc-400">
          Para poder mirar lo mismo desde los dos sitios. No hace falta usar los dos: es para que lo que está en uno se vea también en el otro.
        </p>
      </div>

      <div>
        <p className="text-xs font-black text-zinc-700 uppercase tracking-widest mb-1">Ver el ERP en Google Calendar</p>
        {enlace ? (
          <>
            <div className="flex gap-2">
              <input readOnly value={enlace} onFocus={(e) => e.target.select()}
                className="w-full min-w-0 border-2 border-zinc-200 rounded-md px-3 py-2 text-xs text-zinc-700 bg-zinc-50 font-mono" />
              <button type="button" onClick={copiar} className="px-3 py-2 bg-zinc-900 text-white text-xs font-bold rounded-md shrink-0">
                {copiado ? "✓ Copiado" : "Copiar"}
              </button>
            </div>
            <ol className="text-xs text-zinc-500 mt-2 list-decimal pl-4 space-y-0.5">
              <li>En el ordenador, abre Google Calendar.</li>
              <li>A la izquierda, junto a «Otros calendarios», pulsa <b>+</b> y luego <b>Desde URL</b>.</li>
              <li>Pega este enlace y pulsa <b>Añadir calendario</b>.</li>
            </ol>
            <p className="text-xs text-amber-700 mt-2">
              Google lo actualiza solo cada pocas horas (a veces hasta un día): lo que cambies en el ERP tarda en verse allí.
              Quien tenga este enlace ve los servicios, así que no lo compartas fuera de la empresa.
            </p>
          </>
        ) : (
          <p className="text-xs text-zinc-500 mb-1">Todavía no hay enlace. Genera uno para añadirlo en Google Calendar.</p>
        )}
        <button type="button" onClick={generar} disabled={generando}
          className="mt-2 text-xs font-bold text-blue-600 hover:text-blue-800 disabled:opacity-50">
          {generando ? "Generando..." : enlace ? "🔄 Cambiar enlace (el anterior deja de funcionar)" : "🔗 Generar enlace"}
        </button>
      </div>

      <div>
        <p className="text-xs font-black text-zinc-700 uppercase tracking-widest mb-1">Ver Google Calendar en el ERP</p>
        <Input value={googleUrl} onChange={(e) => onGoogleUrl(e.target.value)} placeholder="https://calendar.google.com/calendar/ical/.../basic.ics" />
        {urlMala && <p className="text-xs font-semibold text-red-600 mt-1">Tiene que ser la dirección iCal de Google (empieza por https://calendar.google.com/calendar/ical/).</p>}
        <ol className="text-xs text-zinc-500 mt-2 list-decimal pl-4 space-y-0.5">
          <li>En Google Calendar (ordenador), ⚙️ <b>Configuración</b>.</li>
          <li>A la izquierda, en «Configuración de mis calendarios», elige el calendario.</li>
          <li>Abajo del todo, copia la <b>Dirección secreta en formato iCal</b> y pégala aquí.</li>
          <li>Pulsa <b>Guardar configuración</b>.</li>
        </ol>
        <p className="text-xs text-zinc-400 mt-2">
          Sus eventos, también los antiguos, salen en el calendario del ERP en azul 📆 y solo se pueden mirar: se cambian en Google. Se actualizan al abrir la app y con el botón de refrescar.
        </p>
      </div>
    </div>
  );
};

const ConfigScreen = ({ onSave, initial, cargaFallida = false, onLogout, onClientes }) => {
  const [form, setForm] = useState(() => ({
    nombre: "", tel: "", email: "", direccion: "", logo: "",
    ...initial,
    // La base de datos devuelve null en las columnas vacías, y un null en un
    // <input> lo convierte en no controlado y React se queja
    ...Object.fromEntries(
      ["contractacion", "web", "formaPago", "observaciones", "conformidad", "legal", "nif", "autorizacion_transporte"]
        .map((k) => [k, initial?.[k] ?? ""])
    ),
    vehicles: normalizeVehiculos(initial?.vehicles ?? DEFAULT_VEHICLES),
    adminWhatsapp: initial?.adminWhatsapp ?? ADMIN_WHATSAPP,
    adminEmail:    initial?.adminEmail    ?? ADMIN_EMAIL,
    google_ics_url: initial?.google_ics_url ?? "",
  }));
  const [saving, setSaving] = useState(false);
  const [estadoBackup, setEstadoBackup] = useState(null);
  const fileRef = useRef();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleLogo = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setForm((f) => ({ ...f, logo: ev.target.result }));
    reader.readAsDataURL(file);
  };

  // Con la configuración sin cargar, el formulario está vacío y guardarlo
  // machacaría la buena: se bloquea el guardado hasta que se pueda leer.
  const handleSave = async () => {
    if (cargaFallida) return;
    setSaving(true);
    // El token del enlace iCal solo lo escribe la base de datos al generarlo:
    // no se manda, para no pisar uno recién cambiado con el de la pantalla
    const { ics_token: _token, ...datos } = form;
    datos.google_ics_url = (datos.google_ics_url || "").trim() || null;
    const ok = await dbSaveConfig(datos);
    setSaving(false);
    if (ok) onSave({ ...form, google_ics_url: datos.google_ics_url });
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-xs font-bold tracking-widest text-zinc-400 uppercase mb-1">Configuración</p>
          <h1 className="text-3xl font-black text-zinc-900">Datos de la empresa</h1>
        </div>
        <Btn variant="ghost" size="sm" onClick={onLogout}>🔒 Cerrar sesión</Btn>
      </div>

      {cargaFallida && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-5">
          <p className="text-sm font-black text-red-800">⚠️ No se ha podido cargar la configuración</p>
          <p className="text-xs text-red-700 mt-0.5">
            Este formulario está vacío porque no se han podido leer tus datos, no porque no existan.
            Guardar ahora los borraría, así que está bloqueado. Recarga la página cuando vuelvas a tener conexión.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-5 bg-white border-2 border-zinc-200 rounded-xl p-6 shadow-sm mb-5">
        <p className="text-sm font-black text-zinc-900">Empresa</p>
        <Field label="Logo (JPEG / PNG)">
          <div className="flex items-center gap-4 border-2 border-dashed border-zinc-200 rounded-lg p-4 cursor-pointer hover:border-zinc-900 transition-colors" onClick={() => fileRef.current.click()}>
            {form.logo ? <img src={form.logo} alt="logo" className="h-16 w-16 object-contain rounded" /> : <div className="h-16 w-16 bg-zinc-100 rounded flex items-center justify-center text-zinc-400 text-2xl">🏢</div>}
            <div>
              <p className="text-sm font-semibold text-zinc-700">{form.logo ? "Cambiar logo" : "Subir logo"}</p>
              <p className="text-xs text-zinc-400">JPEG o PNG</p>
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleLogo} />
          </div>
        </Field>
        <Field label="Nombre empresa"><Input value={form.nombre} onChange={set("nombre")} placeholder="Grúas ELSA S.L." /></Field>
        <Field label="Teléfono"><Input value={form.tel} onChange={set("tel")} placeholder="600 000 000" /></Field>
        <Field label="Email"><Input value={form.email} onChange={set("email")} placeholder="info@empresa.com" type="email" /></Field>
        <Field label="Dirección fiscal"><Input value={form.direccion} onChange={set("direccion")} placeholder="Calle Mayor 1, 28001 Madrid" /></Field>
      </div>

      <div className="flex flex-col gap-5 bg-white border-2 border-zinc-200 rounded-xl p-6 shadow-sm mb-5">
        <div>
          <p className="text-sm font-black text-zinc-900 mb-1">Datos fiscales y de transporte</p>
          <p className="text-xs text-zinc-400">
            El NIF sale debajo del nombre de la empresa en los presupuestos. Los dos datos identifican al
            transportista en el documento de control (DeCA) obligatorio desde octubre de 2026.
          </p>
        </div>
        <Field label="NIF / CIF de la empresa">
          <Input value={form.nif} onChange={set("nif")} placeholder="B12345678" />
        </Field>
        <Field label="Nº de autorización de transporte">
          <Input value={form.autorizacion_transporte} onChange={set("autorizacion_transporte")} placeholder="MDP-1234567" />
        </Field>
      </div>

      <div className="bg-white border-2 border-zinc-200 rounded-xl p-6 shadow-sm mb-5">
        <p className="text-sm font-black text-zinc-900 mb-1">Vehículos / Equipos</p>
        <p className="text-xs text-zinc-400 mb-4">Los que se asignan en servicios y presupuestos. Su color identifica el trabajo en el calendario.</p>
        <VehiculosManager items={form.vehicles} onChange={(v) => setForm((f) => ({ ...f, vehicles: v }))} />
      </div>

      <div className="flex flex-col gap-5 bg-white border-2 border-zinc-200 rounded-xl p-6 shadow-sm mb-5">
        <div>
          <p className="text-sm font-black text-zinc-900 mb-1">Administración</p>
          <p className="text-xs text-zinc-400">
            A dónde llegan los botones «Enviar a administración» de los presupuestos, los servicios y los albaranes.
          </p>
        </div>
        <Field label="WhatsApp de administración">
          <Input value={form.adminWhatsapp} onChange={set("adminWhatsapp")} placeholder="34600000000" />
        </Field>
        <Field label="Email de administración">
          <Input type="email" value={form.adminEmail} onChange={set("adminEmail")} placeholder="administracion@empresa.com" />
        </Field>
      </div>

      <div className="flex flex-col gap-5 bg-white border-2 border-zinc-200 rounded-xl p-6 shadow-sm mb-5">
        <div>
          <p className="text-sm font-black text-zinc-900 mb-1">Textos del presupuesto</p>
          <p className="text-xs text-zinc-400">
            Lo que sale igual en todos los presupuestos. Se escribe una vez y ya no hay que volver a tocarlo.
            Si dejas un campo en blanco se usa el texto que trae la aplicación.
          </p>
          <p className="text-xs text-zinc-400 mt-1">
            Puedes usar <b className="text-zinc-600">{"{empresa}"}</b>, <b className="text-zinc-600">{"{email}"}</b>,{" "}
            <b className="text-zinc-600">{"{tel}"}</b> y <b className="text-zinc-600">{"{direccion}"}</b>: se cambian solos
            por los datos de arriba.
          </p>
        </div>

        <Field label="Teléfonos de contratación">
          <Input value={form.contractacion} onChange={set("contractacion")} placeholder={TEXTOS_PRESUPUESTO.contractacion} />
        </Field>

        <Field label="Web">
          <Input value={form.web} onChange={set("web")} placeholder="gruaselsa.com" />
        </Field>

        <Field label="Forma de pago por defecto">
          <Input value={form.formaPago} onChange={set("formaPago")} placeholder={TEXTOS_PRESUPUESTO.formaPago} />
        </Field>

        <Field label="Observaciones por defecto (una por línea)">
          <Textarea rows={4} value={form.observaciones} onChange={set("observaciones")} placeholder={TEXTOS_PRESUPUESTO.observaciones} />
          <p className="text-xs text-zinc-400 mt-1">Aquí va la línea del IVA, que si no el cliente puede pensar que el precio ya lo lleva.</p>
        </Field>

        <Field label="Texto de conformidad (encima de las firmas)">
          <Textarea rows={2} value={form.conformidad} onChange={set("conformidad")} placeholder={TEXTOS_PRESUPUESTO.conformidad} />
        </Field>

        <Field label="Aviso legal del pie">
          <Textarea rows={5} value={form.legal} onChange={set("legal")} placeholder={TEXTOS_PRESUPUESTO.legal} />
        </Field>
      </div>

      <GoogleCalendar
        token={form.ics_token}
        onToken={(t) => setForm((f) => ({ ...f, ics_token: t }))}
        googleUrl={form.google_ics_url}
        onGoogleUrl={(v) => setForm((f) => ({ ...f, google_ics_url: v }))}
      />

      <CambiarPassword />

      <Btn size="lg" className="w-full" onClick={handleSave} disabled={saving || cargaFallida}>
        {saving ? "Guardando..." : "💾 Guardar configuración"}
      </Btn>
      <Btn size="md" variant="secondary" className="w-full" onClick={onClientes}>
        👥 Gestionar clientes
      </Btn>
      <Btn size="md" variant="secondary" className="w-full" onClick={() => downloadBackup(setEstadoBackup)} disabled={!!estadoBackup}>
        {estadoBackup || "📥 Exportar datos (sin fotos ni PDF)"}
      </Btn>
    </div>
  );
};

export default ConfigScreen;
