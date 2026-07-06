import { useState, useRef } from "react";
import { supabase } from "../shared/lib/supabase";
import { Btn, Field, Input, ColorPicker } from "../shared/components/ui";
import { DEFAULT_VEHICLES, DEFAULT_WORK_TYPES } from "../shared/lib/constants";
import { normalizeVehiculos, textoSobre, PALETA } from "../shared/lib/color";

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

const downloadBackup = async () => {
  const [{ data: sols }, { data: cfg }] = await Promise.all([
    supabase.from("solicitudes").select("*").order("id", { ascending: false }),
    supabase.from("config").select("*").eq("id", 1).maybeSingle(),
  ]);
  const backup = { fecha: new Date().toISOString(), config: cfg, solicitudes: sols };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ELSA_backup_${new Date().toLocaleDateString("es-ES").replace(/\//g, "-")}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

const dbSaveConfig = async (cfg) => {
  const { error } = await supabase.from("config").upsert({ id: 1, ...cfg });
  if (error) console.error(error);
};

const ConfigScreen = ({ onSave, initial, onLogout, onClientes }) => {
  const [form, setForm] = useState(() => ({
    nombre: "", tel: "", email: "", direccion: "", logo: "",
    workTypes: DEFAULT_WORK_TYPES,
    ...initial,
    vehicles:  normalizeVehiculos(initial?.vehicles ?? DEFAULT_VEHICLES),
    workTypes: initial?.workTypes ?? DEFAULT_WORK_TYPES,
  }));
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleLogo = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setForm((f) => ({ ...f, logo: ev.target.result }));
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    await dbSaveConfig(form);
    onSave(form);
    setSaving(false);
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

      <Btn size="lg" className="w-full" onClick={handleSave} disabled={saving}>
        {saving ? "Guardando..." : "💾 Guardar configuración"}
      </Btn>
      <Btn size="md" variant="secondary" className="w-full" onClick={onClientes}>
        👥 Gestionar clientes
      </Btn>
      <Btn size="md" variant="secondary" className="w-full" onClick={downloadBackup}>
        📥 Descargar copia de seguridad
      </Btn>
    </div>
  );
};

export default ConfigScreen;
