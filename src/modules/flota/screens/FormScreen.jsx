import { useState } from "react";
import { Btn, Field, Input, Textarea, PhotoUploader, ColorPicker } from "../../../shared/components/ui";
import { PALETA } from "../../../shared/lib/color";

const FormScreen = ({ initial, onSave, onCancel, saving }) => {
  const [tempId] = useState(initial?.id || `temp_${Date.now()}`);
  const [form, setForm] = useState(
    initial
      ? { ...initial, vencimientos: initial.vencimientos || [], fotos: initial.fotos || [], color: initial.color || PALETA[0] }
      : { nombre: "", matricula: "", tipo: "", itv_vencimiento: "", seguro_vencimiento: "", notas: "", vencimientos: [], fotos: [], color: PALETA[0] }
  );

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const setVencimiento = (i, k, valor) => {
    setForm((f) => ({
      ...f,
      vencimientos: f.vencimientos.map((x, idx) => idx === i ? { ...x, [k]: valor } : x),
    }));
  };

  const addVencimiento = () => setForm((f) => ({ ...f, vencimientos: [...f.vencimientos, { nombre: "", fecha: "" }] }));

  const removeVencimiento = (i) => setForm((f) => ({ ...f, vencimientos: f.vencimientos.filter((_, idx) => idx !== i) }));

  const handleSave = () => {
    if (!form.nombre.trim()) { alert("El nombre del vehículo es obligatorio."); return; }
    const vencimientos = form.vencimientos.filter((x) => (x.nombre || "").trim() || x.fecha);
    onSave({ ...form, vencimientos });
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

        <Field label="Color (identifica el vehículo en el calendario)">
          <ColorPicker value={form.color} onChange={(color) => setForm((f) => ({ ...f, color }))} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Vencimiento ITV">
            <Input type="date" value={form.itv_vencimiento || ""} onChange={set("itv_vencimiento")} />
          </Field>
          <Field label="Vencimiento seguro">
            <Input type="date" value={form.seguro_vencimiento || ""} onChange={set("seguro_vencimiento")} />
          </Field>
        </div>

        {/* Vencimientos extra */}
        <Field label="Otros vencimientos (tacógrafo, ADR, revisiones...)">
          <div className="flex flex-col gap-3">
            {form.vencimientos.map((x, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex-1">
                  <Input value={x.nombre} onChange={(e) => setVencimiento(i, "nombre", e.target.value)} placeholder="Tacógrafo" />
                </div>
                <div className="w-40">
                  <Input type="date" value={x.fecha || ""} onChange={(e) => setVencimiento(i, "fecha", e.target.value)} />
                </div>
                <button
                  type="button"
                  onClick={() => removeVencimiento(i)}
                  className="text-zinc-300 hover:text-red-600 transition-colors text-xl leading-none p-1"
                  title="Quitar vencimiento"
                >
                  ×
                </button>
              </div>
            ))}
            <Btn variant="secondary" size="md" onClick={addVencimiento}>➕ Añadir vencimiento</Btn>
          </div>
        </Field>

        <Field label="Notas">
          <Textarea value={form.notas || ""} onChange={set("notas")} placeholder="Revisiones, taller habitual, observaciones..." />
        </Field>

        {/* Documentación y fotos */}
        <div className="border-t border-zinc-100 pt-4">
          <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-2">Documentación y fotos</p>
          <p className="text-xs text-zinc-400 mb-2">Permiso de circulación, ficha técnica, póliza, fotos del vehículo...</p>
          <PhotoUploader
            solicitudId={tempId}
            existingPhotos={form.fotos}
            onPhotosChange={(fotos) => setForm((f) => ({ ...f, fotos }))}
          />
        </div>

        <div className="flex gap-3 mt-2 flex-wrap">
          <Btn size="lg" className="flex-1" onClick={handleSave} disabled={saving}>{saving ? "Guardando..." : "💾 Guardar"}</Btn>
          <Btn size="lg" variant="secondary" onClick={onCancel}>Cancelar</Btn>
        </div>
      </div>
    </div>
  );
};

export default FormScreen;
