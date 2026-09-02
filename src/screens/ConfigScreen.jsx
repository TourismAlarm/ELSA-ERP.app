import { useState, useRef } from "react";
import { supabase } from "../shared/lib/supabase";
import { dbSaveConfig } from "../modules/solicitudes/db";
import { Btn, Field, Input, Textarea, ColorPicker } from "../shared/components/ui";
import { DEFAULT_VEHICLES, ADMIN_WHATSAPP, ADMIN_EMAIL } from "../shared/lib/constants";
import { normalizeVehiculos, textoSobre, PALETA } from "../shared/lib/color";
import { TEXTOS_PRESUPUESTO } from "../shared/lib/textos";

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

// Vuelca TODAS las tablas, no solo solicitudes: una copia que se deja fuera
// los clientes, los albaranes firmados o la flota no es una copia de seguridad.
const TABLAS_BACKUP = ["solicitudes", "servicios", "albaranes", "clientes", "vehiculos", "mantenimientos"];

const downloadBackup = async (onEstado) => {
  onEstado("Descargando...");

  const [{ data: cfg, error: errorCfg }, ...resultados] = await Promise.all([
    supabase.from("config").select("*").eq("id", 1).maybeSingle(),
    ...TABLAS_BACKUP.map((t) => supabase.from(t).select("*")),
  ]);

  // Si falla cualquier tabla no se descarga nada: una copia incompleta que
  // parece completa es peor que no tener copia
  const fallos = TABLAS_BACKUP.filter((_, i) => resultados[i].error);
  if (errorCfg || fallos.length > 0) {
    const detalle = [errorCfg ? "config" : null, ...fallos].filter(Boolean).join(", ");
    console.error(errorCfg, ...resultados.map((r) => r.error).filter(Boolean));
    alert(`No se ha podido descargar la copia: falló la lectura de ${detalle}.\n\nNo se ha guardado nada para no dejarte una copia incompleta. Inténtalo de nuevo.`);
    onEstado(null);
    return;
  }

  const datos = Object.fromEntries(TABLAS_BACKUP.map((t, i) => [t, resultados[i].data || []]));
  const total = Object.values(datos).reduce((n, filas) => n + filas.length, 0);

  const backup = { fecha: new Date().toISOString(), version: 2, config: cfg, ...datos };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ELSA_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);

  onEstado(null);
  const resumen = TABLAS_BACKUP.map((t) => `${datos[t].length} ${t}`).join("\n");
  alert(`Copia descargada con ${total} registros:\n\n${resumen}`);
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

const ConfigScreen = ({ onSave, initial, cargaFallida = false, onLogout, onClientes }) => {
  const [form, setForm] = useState(() => ({
    nombre: "", tel: "", email: "", direccion: "", logo: "",
    ...initial,
    // La base de datos devuelve null en las columnas vacías, y un null en un
    // <input> lo convierte en no controlado y React se queja
    ...Object.fromEntries(
      ["contractacion", "web", "formaPago", "observaciones", "conformidad", "legal"]
        .map((k) => [k, initial?.[k] ?? ""])
    ),
    vehicles: normalizeVehiculos(initial?.vehicles ?? DEFAULT_VEHICLES),
    adminWhatsapp: initial?.adminWhatsapp ?? ADMIN_WHATSAPP,
    adminEmail:    initial?.adminEmail    ?? ADMIN_EMAIL,
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
    const ok = await dbSaveConfig(form);
    setSaving(false);
    if (ok) onSave(form);
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

      <div className="bg-white border-2 border-zinc-200 rounded-xl p-6 shadow-sm mb-5">
        <p className="text-sm font-black text-zinc-900 mb-1">Vehículos / Equipos</p>
        <p className="text-xs text-zinc-400 mb-4">Los que se asignan en servicios y solicitudes. Su color identifica el trabajo en el calendario.</p>
        <VehiculosManager items={form.vehicles} onChange={(v) => setForm((f) => ({ ...f, vehicles: v }))} />
      </div>

      <div className="flex flex-col gap-5 bg-white border-2 border-zinc-200 rounded-xl p-6 shadow-sm mb-5">
        <div>
          <p className="text-sm font-black text-zinc-900 mb-1">Administración</p>
          <p className="text-xs text-zinc-400">
            A dónde llegan los botones «Enviar a administración» de las solicitudes, los servicios y los albaranes.
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

      <CambiarPassword />

      <Btn size="lg" className="w-full" onClick={handleSave} disabled={saving || cargaFallida}>
        {saving ? "Guardando..." : "💾 Guardar configuración"}
      </Btn>
      <Btn size="md" variant="secondary" className="w-full" onClick={onClientes}>
        👥 Gestionar clientes
      </Btn>
      <Btn size="md" variant="secondary" className="w-full" onClick={() => downloadBackup(setEstadoBackup)} disabled={!!estadoBackup}>
        {estadoBackup || "📥 Descargar copia de seguridad"}
      </Btn>
    </div>
  );
};

export default ConfigScreen;
