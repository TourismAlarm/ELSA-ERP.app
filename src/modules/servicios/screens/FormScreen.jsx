import { useState, useRef, useEffect } from "react";
import { Btn, Field, Input, Textarea, PhotoUploader } from "../../../shared/components/ui";
import { DEFAULT_VEHICLES } from "../../../shared/lib/constants";
import { textoSobre } from "../../recursos/color";

const hoy = () => new Date().toISOString().slice(0, 10);

const FormScreen = ({ initial, config, clientes = [], recursos = [], onSave, onSaveCliente, onCancel, saving }) => {
  const normalizeVehiculo = (v) => Array.isArray(v) ? v : (v ? [v] : []);
  const [tempId] = useState(initial?.id || `temp_${Date.now()}`);
  const [form, setForm] = useState(
    initial
      ? { ...initial, vehiculo: normalizeVehiculo(initial.vehiculo), fotos: initial.fotos || [], fecha_servicio: initial.fecha_servicio || hoy(), recurso_id: initial.recurso_id || "" }
      : { cliente: "", nifCif: "", dirFact: "", telCliente: "", emailCliente: "", vehiculo: [], origen: "", destino: "", fecha_servicio: hoy(), descripcion: "", precio: "", fotos: [], recurso_id: "" }
  );
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [savingCliente, setSavingCliente] = useState(false);
  const clienteRef = useRef(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const vehicles = config?.vehicles ?? DEFAULT_VEHICLES;

  const toggleVehiculo = (v) => {
    setForm((f) => {
      const arr = Array.isArray(f.vehiculo) ? f.vehiculo : (f.vehiculo ? [f.vehiculo] : []);
      return { ...f, vehiculo: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v] };
    });
  };

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
    setForm((f) => ({
      ...f,
      cliente: c.nombre,
      nifCif: c.nifCif || f.nifCif,
      dirFact: c.dirFact || f.dirFact,
      telCliente: c.tel || f.telCliente,
      emailCliente: c.email || f.emailCliente,
    }));
    setShowSuggestions(false);
  };

  const handleGuardarCliente = async () => {
    if (!form.cliente.trim()) return;
    setSavingCliente(true);
    await onSaveCliente({ nombre: form.cliente.trim(), nifCif: form.nifCif || "", dirFact: form.dirFact || "", tel: form.telCliente, email: form.emailCliente });
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
          <p className="text-xs font-bold tracking-widest text-zinc-400 uppercase mb-0.5">{initial ? "Editando" : "Nuevo"}</p>
          <h1 className="text-3xl font-black text-zinc-900">{initial ? "Editar servicio" : "Nuevo servicio"}</h1>
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

        <div className="grid grid-cols-2 gap-4">
          <Field label="NIF / CIF">
            <Input value={form.nifCif} onChange={set("nifCif")} placeholder="B12345678" />
          </Field>
          <Field label="Dirección de facturación">
            <Input value={form.dirFact} onChange={set("dirFact")} placeholder="Calle Mayor 1, 08001 Barcelona" />
          </Field>
        </div>

        <Field label="Teléfono del cliente">
          <Input value={form.telCliente} onChange={set("telCliente")} placeholder="600 000 000" />
        </Field>

        <Field label="Email del cliente">
          <Input type="email" value={form.emailCliente} onChange={set("emailCliente")} placeholder="cliente@email.com" />
        </Field>

        <Field label="Fecha del servicio">
          <Input type="date" value={form.fecha_servicio || ""} onChange={set("fecha_servicio")} />
        </Field>

        {recursos.length > 0 && (
          <Field label="Recurso de agenda (color en el calendario)">
            <div className="flex flex-wrap gap-2 pt-0.5">
              {recursos.map((r) => {
                const selected = form.recurso_id === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, recurso_id: selected ? "" : r.id }))}
                    className="text-sm font-bold px-3 py-1.5 rounded-full border-2 transition-all"
                    style={
                      selected
                        ? { backgroundColor: r.color || "#18181b", borderColor: r.color || "#18181b", color: textoSobre(r.color) }
                        : { backgroundColor: "#fff", borderColor: r.color || "#e4e4e7", color: "#3f3f46" }
                    }
                  >
                    <span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle" style={{ backgroundColor: r.color || "#a1a1aa" }} />
                    {r.nombre}
                  </button>
                );
              })}
            </div>
          </Field>
        )}

        <Field label="Vehículo / Equipo">
          <div className="flex flex-wrap gap-2 pt-0.5">
            {vehicles.map((v) => {
              const selected = form.vehiculo.includes(v);
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => toggleVehiculo(v)}
                  className={`text-sm font-bold px-3 py-1.5 rounded-full border-2 transition-colors ${
                    selected
                      ? "bg-zinc-900 text-white border-zinc-900"
                      : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
                  }`}
                >
                  {v}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Origen (Punto A)"><Input value={form.origen} onChange={set("origen")} placeholder="Puerto de Barcelona" /></Field>
          <Field label="Destino (Punto B)"><Input value={form.destino} onChange={set("destino")} placeholder="Polígono Las Rozas" /></Field>
        </div>

        <Field label="Descripción del servicio"><Textarea value={form.descripcion} onChange={set("descripcion")} placeholder="Descripción del trabajo realizado..." /></Field>
        <Field label="Precio (€) — opcional"><Input value={form.precio} onChange={set("precio")} placeholder="1500" type="number" min="0" step="0.01" /></Field>

        <div className="border-t border-zinc-100 pt-4">
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
