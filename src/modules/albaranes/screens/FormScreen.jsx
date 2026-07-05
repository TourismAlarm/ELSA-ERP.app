import { useState, useRef, useEffect } from "react";
import { Btn, Field, Input, Textarea, PhotoUploader } from "../../../shared/components/ui";

const hoy = () => new Date().toISOString().slice(0, 10);

const lineaVacia = () => ({ concepto: "", cantidad: "", observaciones: "" });

const FormScreen = ({ initial, clientes = [], onSave, onCancel, saving }) => {
  const [tempId] = useState(initial?.id || `temp_${Date.now()}`);
  const [form, setForm] = useState(
    initial
      ? { ...initial, fecha: initial.fecha || hoy(), lineas: (initial.lineas && initial.lineas.length > 0 ? initial.lineas : [lineaVacia()]), fotos: initial.fotos || [] }
      : { cliente: "", fecha: hoy(), descripcion: "", lineas: [lineaVacia()], fotos: [] }
  );
  const [showSuggestions, setShowSuggestions] = useState(false);
  const clienteRef = useRef(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

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

  const setLinea = (i, k, v) => {
    setForm((f) => ({
      ...f,
      lineas: f.lineas.map((l, idx) => idx === i ? { ...l, [k]: v } : l),
    }));
  };

  const addLinea = () => setForm((f) => ({ ...f, lineas: [...f.lineas, lineaVacia()] }));

  const removeLinea = (i) => {
    setForm((f) => ({
      ...f,
      lineas: f.lineas.length > 1 ? f.lineas.filter((_, idx) => idx !== i) : [lineaVacia()],
    }));
  };

  const handleSave = () => {
    if (!form.cliente.trim()) { alert("El nombre del cliente es obligatorio."); return; }
    const lineas = form.lineas.filter((l) => (l.concepto || "").trim() || (l.cantidad || "").toString().trim() || (l.observaciones || "").trim());
    onSave({ ...form, lineas });
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={onCancel} className="text-zinc-400 hover:text-zinc-900 transition-colors text-2xl leading-none">←</button>
        <div>
          <p className="text-xs font-bold tracking-widest text-zinc-400 uppercase mb-0.5">{initial ? "Editando" : "Nuevo"}</p>
          <h1 className="text-3xl font-black text-zinc-900">{initial ? "Editar albarán" : "Nuevo albarán"}</h1>
        </div>
      </div>

      <div className="flex flex-col gap-5 bg-white border-2 border-zinc-200 rounded-xl p-6 shadow-sm">

        {/* Nombre del cliente con autocompletado */}
        <Field label="Cliente *">
          <div ref={clienteRef} className="relative">
            <Input
              value={form.cliente}
              onChange={(e) => { set("cliente")(e); setShowSuggestions(true); }}
              onFocus={() => form.cliente.trim().length >= 1 && setShowSuggestions(true)}
              placeholder="Juan García"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-20 w-full bg-white border-2 border-zinc-200 rounded-xl mt-1 shadow-xl overflow-hidden">
                {suggestions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onMouseDown={() => { setForm((f) => ({ ...f, cliente: c.nombre })); setShowSuggestions(false); }}
                    className="w-full text-left px-4 py-3 hover:bg-zinc-50 border-b border-zinc-100 last:border-0 transition-colors"
                  >
                    <p className="font-bold text-zinc-900">{c.nombre}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{[c.tel, c.email].filter(Boolean).join(" · ") || "Sin contacto guardado"}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Field>

        <Field label="Fecha">
          <Input type="date" value={form.fecha || ""} onChange={set("fecha")} />
        </Field>

        <Field label="Descripción del trabajo">
          <Textarea value={form.descripcion || ""} onChange={set("descripcion")} placeholder="Descripción general del trabajo realizado..." />
        </Field>

        {/* Gestor de líneas */}
        <Field label="Líneas del albarán">
          <div className="flex flex-col gap-3">
            {form.lineas.map((l, i) => (
              <div key={i} className="border-2 border-zinc-200 rounded-xl p-4 relative">
                <button
                  type="button"
                  onClick={() => removeLinea(i)}
                  className="absolute top-2 right-2 text-zinc-300 hover:text-red-600 transition-colors text-xl leading-none p-1"
                  title="Quitar línea"
                >
                  ×
                </button>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="col-span-2">
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Concepto</p>
                    <Input value={l.concepto} onChange={(e) => setLinea(i, "concepto", e.target.value)} placeholder="Descarga de material" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Cantidad</p>
                    <Input value={l.cantidad} onChange={(e) => setLinea(i, "cantidad", e.target.value)} placeholder="2" />
                  </div>
                </div>
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Observaciones</p>
                <Input value={l.observaciones} onChange={(e) => setLinea(i, "observaciones", e.target.value)} placeholder="Opcional" />
              </div>
            ))}
            <Btn variant="secondary" size="md" onClick={addLinea}>➕ Añadir línea</Btn>
          </div>
        </Field>

        {/* Albarán en papel: subir foto */}
        <div className="border-t border-zinc-100 pt-4">
          <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-2">Albarán en papel (opcional)</p>
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
