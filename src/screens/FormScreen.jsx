import { useState } from "react";
import { Btn, Field, Input, Select, Textarea } from "../components/ui";

const DEFAULT_VEHICLES   = ["Camión 1", "Camión 2", "Grúa 3", "Cesta", "Operario externo"];
const DEFAULT_WORK_TYPES = ["Maquinaria", "Barcos", "Cesta", "Servicios", "Otro"];

const FormScreen = ({ initial, config, onSave, onCancel, saving }) => {
  const [form, setForm] = useState(
    initial || { cliente: "", telCliente: "", vehiculo: "", tipoTrabajo: "", origen: "", destino: "", metros: "", peso: "", bultos: "", descripcion: "", precio: "" }
  );
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const vehicles  = config?.vehicles  ?? DEFAULT_VEHICLES;
  const workTypes = config?.workTypes ?? DEFAULT_WORK_TYPES;

  const handleSave = () => {
    if (!form.cliente.trim()) { alert("El nombre del cliente es obligatorio."); return; }
    onSave(form);
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={onCancel} className="text-zinc-400 hover:text-zinc-900 transition-colors text-2xl leading-none">←</button>
        <div>
          <p className="text-xs font-bold tracking-widest text-zinc-400 uppercase mb-0.5">{initial ? "Editando" : "Nueva"}</p>
          <h1 className="text-3xl font-black text-zinc-900">{initial ? "Editar solicitud" : "Nueva solicitud"}</h1>
        </div>
      </div>

      <div className="flex flex-col gap-5 bg-white border-2 border-zinc-200 rounded-xl p-6 shadow-sm">
        <Field label="Nombre del cliente *"><Input value={form.cliente} onChange={set("cliente")} placeholder="Juan García" /></Field>
        <Field label="Teléfono del cliente"><Input value={form.telCliente} onChange={set("telCliente")} placeholder="600 000 000" /></Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Vehículo / Equipo">
            <Select value={form.vehiculo} onChange={set("vehiculo")}>
              <option value="">— Seleccionar —</option>
              {vehicles.map((v) => <option key={v} value={v}>{v}</option>)}
            </Select>
          </Field>
          <Field label="Tipo de trabajo">
            <Select value={form.tipoTrabajo} onChange={set("tipoTrabajo")}>
              <option value="">— Seleccionar —</option>
              {workTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Origen (Punto A)"><Input value={form.origen} onChange={set("origen")} placeholder="Puerto de Barcelona" /></Field>
          <Field label="Destino (Punto B)"><Input value={form.destino} onChange={set("destino")} placeholder="Polígono Las Rozas" /></Field>
        </div>

        <div className="border-t border-zinc-100 pt-4">
          <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-3">Datos de carga — opcionales</p>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Metros descarga"><Input value={form.metros} onChange={set("metros")} placeholder="12" type="number" min="0" step="0.1" /></Field>
            <Field label="Peso (kg)"><Input value={form.peso} onChange={set("peso")} placeholder="5000" type="number" min="0" /></Field>
            <Field label="Nº bultos"><Input value={form.bultos} onChange={set("bultos")} placeholder="4" type="number" min="0" /></Field>
          </div>
        </div>

        <Field label="Descripción del servicio"><Textarea value={form.descripcion} onChange={set("descripcion")} placeholder="Descripción del trabajo a realizar..." /></Field>
        <Field label="Precio estimado (€) — opcional"><Input value={form.precio} onChange={set("precio")} placeholder="1500" type="number" min="0" step="0.01" /></Field>

        <div className="flex gap-3 mt-2 flex-wrap">
          <Btn size="lg" className="flex-1" onClick={handleSave} disabled={saving}>{saving ? "Guardando..." : "💾 Guardar"}</Btn>
          <Btn size="lg" variant="secondary" onClick={onCancel}>Cancelar</Btn>
        </div>
      </div>
    </div>
  );
};

export default FormScreen;
