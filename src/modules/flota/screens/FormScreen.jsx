import { useState } from "react";
import { Btn, Field, Input, Textarea } from "../../../shared/components/ui";

const FormScreen = ({ initial, onSave, onCancel, saving }) => {
  const [form, setForm] = useState(
    initial
      ? { ...initial }
      : { nombre: "", matricula: "", tipo: "", itv_vencimiento: "", seguro_vencimiento: "", notas: "" }
  );

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = () => {
    if (!form.nombre.trim()) { alert("El nombre del vehículo es obligatorio."); return; }
    onSave(form);
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={onCancel} className="text-zinc-400 hover:text-zinc-900 transition-colors text-2xl leading-none">←</button>
        <div>
          <p className="text-xs font-bold tracking-widest text-zinc-400 uppercase mb-0.5">{initial ? "Editando" : "Nuevo"}</p>
          <h1 className="text-3xl font-black text-zinc-900">{initial ? "Editar vehículo" : "Nuevo vehículo"}</h1>
        </div>
      </div>

      <div className="flex flex-col gap-5 bg-white border-2 border-zinc-200 rounded-xl p-6 shadow-sm">

        <Field label="Nombre *">
          <Input value={form.nombre} onChange={set("nombre")} placeholder="Grúa 40T" />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Matrícula">
            <Input value={form.matricula || ""} onChange={set("matricula")} placeholder="1234 ABC" />
          </Field>
          <Field label="Tipo">
            <Input value={form.tipo || ""} onChange={set("tipo")} placeholder="Grúa, camión, furgoneta..." />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Vencimiento ITV">
            <Input type="date" value={form.itv_vencimiento || ""} onChange={set("itv_vencimiento")} />
          </Field>
          <Field label="Vencimiento seguro">
            <Input type="date" value={form.seguro_vencimiento || ""} onChange={set("seguro_vencimiento")} />
          </Field>
        </div>

        <Field label="Notas">
          <Textarea value={form.notas || ""} onChange={set("notas")} placeholder="Revisiones, taller habitual, observaciones..." />
        </Field>

        <div className="flex gap-3 mt-2 flex-wrap">
          <Btn size="lg" className="flex-1" onClick={handleSave} disabled={saving}>{saving ? "Guardando..." : "💾 Guardar"}</Btn>
          <Btn size="lg" variant="secondary" onClick={onCancel}>Cancelar</Btn>
        </div>
      </div>
    </div>
  );
};

export default FormScreen;
