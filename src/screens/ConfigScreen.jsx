import { useState, useRef } from "react";
import { supabase } from "../supabase";
import { Btn, Field, Input, ListManager } from "../components/ui";

const DEFAULT_VEHICLES   = ["Camión 1", "Camión 2", "Grúa 3", "Cesta", "Operario externo"];
const DEFAULT_WORK_TYPES = ["Maquinaria", "Barcos", "Cesta", "Servicios", "Otro"];

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

const ConfigScreen = ({ onSave, initial, onLogout }) => {
  const [form, setForm] = useState(() => ({
    nombre: "", tel: "", email: "", direccion: "", logo: "",
    vehicles: DEFAULT_VEHICLES, workTypes: DEFAULT_WORK_TYPES,
    ...initial,
    vehicles:  initial?.vehicles  ?? DEFAULT_VEHICLES,
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
        <p className="text-sm font-black text-zinc-900 mb-4">Vehículos / Equipos</p>
        <ListManager items={form.vehicles} onChange={(v) => setForm((f) => ({ ...f, vehicles: v }))} />
      </div>

      <div className="bg-white border-2 border-zinc-200 rounded-xl p-6 shadow-sm mb-6">
        <p className="text-sm font-black text-zinc-900 mb-4">Tipos de trabajo</p>
        <ListManager items={form.workTypes} onChange={(v) => setForm((f) => ({ ...f, workTypes: v }))} />
      </div>

      <Btn size="lg" className="w-full" onClick={handleSave} disabled={saving}>
        {saving ? "Guardando..." : "💾 Guardar configuración"}
      </Btn>
      <Btn size="md" variant="secondary" className="w-full" onClick={downloadBackup}>
        📥 Descargar copia de seguridad
      </Btn>
    </div>
  );
};

export default ConfigScreen;
