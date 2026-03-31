import { useState, useRef, useEffect } from "react";
import { Btn, Field, Input, Select, Textarea } from "../components/ui";
import { DEFAULT_VEHICLES, DEFAULT_WORK_TYPES } from "../lib/constants";

const FormScreen = ({ initial, config, clientes = [], onSave, onSaveCliente, onCancel, saving }) => {
  const [form, setForm] = useState(
    initial || { cliente: "", telCliente: "", emailCliente: "", vehiculo: "", tipoTrabajo: "", origen: "", destino: "", metros: "", peso: "", bultos: "", descripcion: "", precio: "" }
  );
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [savingCliente, setSavingCliente] = useState(false);
  const clienteRef = useRef(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const vehicles  = config?.vehicles  ?? DEFAULT_VEHICLES;
  const workTypes = config?.workTypes ?? DEFAULT_WORK_TYPES;

  // Cerrar sugerencias al pulsar fuera
  useEffect(() => {
    const handler = (e) => {
      if (clienteRef.current && !clienteRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const suggestions = clientes.filter((c) =>
    form.cliente.trim().length >= 1 &&
    c.nombre.toLowerCase().includes(form.cliente.toLowerCase())
  ).slice(0, 6);

  const clienteExacto = clientes.some(
    (c) => c.nombre.toLowerCase() === form.cliente.trim().toLowerCase()
  );

  const selectCliente = (c) => {
    setForm((f) => ({ ...f, cliente: c.nombre, telCliente: c.tel || f.telCliente, emailCliente: c.email || f.emailCliente }));
    setShowSuggestions(false);
  };

  const handleGuardarCliente = async () => {
    if (!form.cliente.trim()) return;
    setSavingCliente(true);
    await onSaveCliente({ nombre: form.cliente.trim(), tel: form.telCliente, email: form.emailCliente });
    setSavingCliente(false);
  };

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

        {/* Nombre del cliente con autocompletado */}
        <Field label="Nombre del cliente *">
          <div ref={clienteRef} className="relative">
            <Input
              value={form.cliente}
              onChange={(e) => { set("cliente")(e); setShowSuggestions(true); }}
              onFocus={() => form.cliente.trim().length >= 1 && setShowSuggestions(true)}
              placeholder="Juan García"
            />
            {/* Dropdown sugerencias */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-20 w-full bg-white border-2 border-zinc-200 rounded-xl mt-1 shadow-xl overflow-hidden">
                {suggestions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onMouseDown={() => selectCliente(c)}
                    className="w-full text-left px-4 py-3 hover:bg-zinc-50 border-b border-zinc-100 last:border-0 transition-colors"
                  >
                    <p className="font-bold text-zinc-900">{c.nombre}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{[c.tel, c.email].filter(Boolean).join(" · ") || "Sin contacto guardado"}</p>
                  </button>
                ))}
              </div>
            )}
            {/* Botón guardar cliente nuevo */}
            {form.cliente.trim() && !clienteExacto && (
              <button
                type="button"
                onClick={handleGuardarCliente}
                disabled={savingCliente}
                className="mt-2 text-xs font-bold text-blue-600 hover:text-blue-800 disabled:opacity-50"
              >
                {savingCliente ? "Guardando..." : `💾 Guardar "${form.cliente.trim()}" como nuevo cliente`}
              </button>
            )}
          </div>
        </Field>

        <Field label="Teléfono del cliente">
          <Input value={form.telCliente} onChange={set("telCliente")} placeholder="600 000 000" />
        </Field>

        <Field label="Email del cliente">
          <Input type="email" value={form.emailCliente} onChange={set("emailCliente")} placeholder="cliente@email.com" />
        </Field>

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
