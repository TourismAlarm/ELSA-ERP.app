import { useState } from "react";
import { Btn, Field, Input } from "./ui";

const ClienteForm = ({ inicial = {}, onGuardar, onCancelar, guardando }) => {
  const [form, setForm] = useState({
    nombre: inicial.nombre || "",
    nombre_comercial: inicial.nombre_comercial || "",
    nifCif: inicial.nifCif || "",
    dirFact: inicial.dirFact || "",
    cp: inicial.cp || "",
    poblacion: inicial.poblacion || "",
    provincia: inicial.provincia || "",
    tel: inicial.tel || "",
    movil: inicial.movil || "",
    email: inicial.email || "",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = () => {
    if (!form.nombre.trim()) { alert("El nombre es obligatorio"); return; }
    onGuardar(form);
  };

  return (
    <div className="bg-zinc-50 border-2 border-zinc-200 rounded-xl p-4 flex flex-col gap-3">
      <Field label="Nombre *">
        <Input value={form.nombre} onChange={set("nombre")} placeholder="Juan García" autoFocus />
      </Field>
      <Field label="Nombre comercial">
        <Input value={form.nombre_comercial} onChange={set("nombre_comercial")} placeholder="Transportes García" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="NIF / CIF">
          <Input value={form.nifCif} onChange={set("nifCif")} placeholder="B12345678" />
        </Field>
        <Field label="Dirección de facturación">
          <Input value={form.dirFact} onChange={set("dirFact")} placeholder="Calle Mayor 1, 08001 Barcelona" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Código Postal">
          <Input value={form.cp} onChange={set("cp")} placeholder="08001" />
        </Field>
        <Field label="Población">
          <Input value={form.poblacion} onChange={set("poblacion")} placeholder="Barcelona" />
        </Field>
      </div>
      <Field label="Provincia">
        <Input value={form.provincia} onChange={set("provincia")} placeholder="Barcelona" />
      </Field>
      <Field label="Teléfono">
        <Input value={form.tel} onChange={set("tel")} placeholder="600 000 000" />
      </Field>
      <Field label="Móvil">
        <Input value={form.movil} onChange={set("movil")} placeholder="600 000 000" />
      </Field>
      <Field label="Email">
        <Input type="email" value={form.email} onChange={set("email")} placeholder="cliente@email.com" />
      </Field>
      <div className="flex gap-2">
        <Btn size="md" className="flex-1" onClick={handleSubmit} disabled={guardando}>
          {guardando ? "Guardando..." : "💾 Guardar"}
        </Btn>
        <Btn size="md" variant="secondary" onClick={onCancelar}>Cancelar</Btn>
      </div>
    </div>
  );
};

export default ClienteForm;
