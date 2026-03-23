import { useState, useRef } from "react";
import { jsPDF } from "jspdf";

// ─── UTILIDADES ────────────────────────────────────────────────────────────────
const STORAGE_KEYS = { config: "tg_config", budgets: "tg_budgets", counter: "tg_counter" };
const load = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const save = (key, val) => localStorage.setItem(key, JSON.stringify(val));
const today = () => new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
const nextNum = () => {
  const n = (load(STORAGE_KEYS.counter, 0)) + 1;
  save(STORAGE_KEYS.counter, n);
  return `P-${String(n).padStart(3, "0")}`;
};

// ─── PDF GENERATION ───────────────────────────────────────────────────────────
const generatePDF = async (budget, config) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const margin = 18;
  let y = 0;

  // Header bar
  doc.setFillColor(20, 20, 20);
  doc.rect(0, 0, W, 42, "F");

  // Logo or company name in header
  if (config.logo) {
    try {
      doc.addImage(config.logo, "JPEG", margin, 8, 28, 28);
    } catch {}
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(config.nombre || "Mi Empresa", margin + 34, 22);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(180, 180, 180);
    doc.text([config.tel, config.email, config.direccion].filter(Boolean).join("  ·  "), margin + 34, 29);
  } else {
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(config.nombre || "Mi Empresa", margin, 22);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(180, 180, 180);
    doc.text([config.tel, config.email, config.direccion].filter(Boolean).join("  ·  "), margin, 30);
  }

  y = 54;

  // PRESUPUESTO title + number/date
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("PRESUPUESTO", margin, y);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`Nº ${budget.numero}`, W - margin, y - 6, { align: "right" });
  doc.text(`Fecha: ${budget.fecha}`, W - margin, y + 1, { align: "right" });
  y += 10;

  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.line(margin, y, W - margin, y);
  y += 10;

  // Client section
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(margin, y, W - margin * 2, 26, 2, 2, "F");
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("DATOS DEL CLIENTE", margin + 5, y + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text(budget.cliente || "—", margin + 5, y + 15);
  if (budget.telCliente) {
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(`Tel: ${budget.telCliente}`, margin + 5, y + 22);
  }
  y += 36;

  // Service description
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("DESCRIPCIÓN DEL SERVICIO", margin, y);
  y += 5;
  doc.setDrawColor(20, 20, 20);
  doc.setLineWidth(1);
  doc.line(margin, y, margin + 40, y);
  doc.setLineWidth(0.5);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  const lines = doc.splitTextToSize(budget.descripcion || "—", W - margin * 2);
  doc.text(lines, margin, y);
  y += lines.length * 6 + 10;

  // Price box
  doc.setFillColor(20, 20, 20);
  doc.roundedRect(W - margin - 70, y, 70, 26, 2, 2, "F");
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL", W - margin - 35, y + 8, { align: "center" });
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  const priceText = budget.precio
    ? `${Number(budget.precio).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €`
    : "—";
  doc.text(priceText, W - margin - 35, y + 19, { align: "center" });
  y += 36;

  // Payment conditions
  if (config.condiciones) {
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(margin, y, W - margin, y);
    y += 8;
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("CONDICIONES DE PAGO", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    const condLines = doc.splitTextToSize(config.condiciones, W - margin * 2);
    doc.text(condLines, margin, y);
  }

  // Footer
  doc.setFillColor(20, 20, 20);
  doc.rect(0, 282, W, 15, "F");
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  const footerParts = [config.nombre, config.tel, config.email, config.direccion].filter(Boolean).join("  ·  ");
  doc.text(footerParts, W / 2, 291, { align: "center" });

  doc.save(`Presupuesto_${budget.numero}.pdf`);
};

// ─── COMPONENTS ───────────────────────────────────────────────────────────────
const Btn = ({ children, onClick, variant = "primary", size = "md", className = "" }) => {
  const base = "inline-flex items-center justify-center gap-2 font-bold tracking-wide transition-all duration-150 cursor-pointer border-2 select-none";
  const variants = {
    primary: "bg-zinc-900 text-white border-zinc-900 hover:bg-zinc-700 hover:border-zinc-700",
    secondary: "bg-white text-zinc-900 border-zinc-300 hover:border-zinc-900 hover:bg-zinc-50",
    danger: "bg-white text-red-600 border-red-200 hover:bg-red-600 hover:text-white hover:border-red-600",
    ghost: "bg-transparent text-zinc-600 border-transparent hover:bg-zinc-100 hover:text-zinc-900",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-xs rounded",
    md: "px-5 py-2.5 text-sm rounded-md",
    lg: "px-7 py-4 text-base rounded-lg",
  };
  return (
    <button onClick={onClick} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}>
      {children}
    </button>
  );
};

const Field = ({ label, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-bold text-zinc-500 tracking-widest uppercase">{label}</label>
    {children}
  </div>
);

const Input = (props) => (
  <input
    {...props}
    className="w-full border-2 border-zinc-200 rounded-md px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors bg-white"
  />
);

const Textarea = (props) => (
  <textarea
    {...props}
    rows={5}
    className="w-full border-2 border-zinc-200 rounded-md px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors bg-white resize-none"
  />
);

// ─── SCREEN: CONFIG ───────────────────────────────────────────────────────────

const ConfigScreen = ({ onSave, initial }) => {
  const [form, setForm] = useState(initial || { nombre: "", tel: "", email: "", direccion: "", condiciones: "", logo: "" });
  const fileRef = useRef();

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleLogo = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setForm((f) => ({ ...f, logo: ev.target.result }));
    reader.readAsDataURL(file);
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <div className="mb-8">
        <p className="text-xs font-bold tracking-widest text-zinc-400 uppercase mb-1">Configuración</p>
        <h1 className="text-3xl font-black text-zinc-900">Datos de la empresa</h1>
      </div>

      <div className="flex flex-col gap-5 bg-white border-2 border-zinc-200 rounded-xl p-6 shadow-sm">
        <Field label="Logo (JPEG / PNG)">
          <div
            className="flex items-center gap-4 border-2 border-dashed border-zinc-200 rounded-lg p-4 cursor-pointer hover:border-zinc-900 transition-colors"
            onClick={() => fileRef.current.click()}
          >
            {form.logo ? (
              <img src={form.logo} alt="logo" className="h-16 w-16 object-contain rounded" />
            ) : (
              <div className="h-16 w-16 bg-zinc-100 rounded flex items-center justify-center text-zinc-400 text-2xl">🏢</div>
            )}
            <div>
              <p className="text-sm font-semibold text-zinc-700">{form.logo ? "Cambiar logo" : "Subir logo"}</p>
              <p className="text-xs text-zinc-400">JPEG o PNG</p>
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleLogo} />
          </div>
        </Field>

        <Field label="Nombre empresa">
          <Input value={form.nombre} onChange={set("nombre")} placeholder="Transportes García S.L." />
        </Field>
        <Field label="Teléfono">
          <Input value={form.tel} onChange={set("tel")} placeholder="600 000 000" />
        </Field>
        <Field label="Email">
          <Input value={form.email} onChange={set("email")} placeholder="info@empresa.com" type="email" />
        </Field>
        <Field label="Dirección">
          <Input value={form.direccion} onChange={set("direccion")} placeholder="Calle Mayor 1, 28001 Madrid" />
        </Field>
        <Field label="Condiciones de pago">
          <Textarea value={form.condiciones} onChange={set("condiciones")} placeholder="Pago al contado. 50% al confirmar y 50% a la entrega..." />
        </Field>

        <Btn size="lg" className="mt-2" onClick={() => { save(STORAGE_KEYS.config, form); onSave(form); }}>
          💾 Guardar configuración
        </Btn>
      </div>
    </div>
  );
};

// ─── SCREEN: DASHBOARD ────────────────────────────────────────────────────────

const DashboardScreen = ({ budgets, onNew, onView, onEdit, onDelete, onConfig }) => {
  const [q, setQ] = useState("");
  const filtered = budgets.filter((b) =>
    [b.cliente, b.descripcion, b.numero].join(" ").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <p className="text-xs font-bold tracking-widest text-zinc-400 uppercase mb-1">Panel principal</p>
          <h1 className="text-3xl font-black text-zinc-900">Presupuestos</h1>
        </div>
        <Btn variant="ghost" size="sm" onClick={onConfig}>⚙️ Config</Btn>
      </div>

      <Btn size="lg" className="w-full mb-6" onClick={onNew}>
        ➕ Nuevo Presupuesto
      </Btn>

      {budgets.length > 0 && (
        <div className="mb-5">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍  Buscar por cliente, descripción..." />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-zinc-400">
          <div className="text-5xl mb-3">📋</div>
          <p className="font-semibold">{budgets.length === 0 ? "Aún no hay presupuestos" : "Sin resultados"}</p>
          <p className="text-sm mt-1">{budgets.length === 0 ? "Crea tu primer presupuesto con el botón de arriba" : "Prueba con otra búsqueda"}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((b) => (
            <div key={b.id} className="bg-white border-2 border-zinc-200 rounded-xl p-5 hover:border-zinc-400 transition-colors">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-bold text-zinc-400 tracking-widest">{b.numero}</span>
                    <span className="text-xs text-zinc-300">·</span>
                    <span className="text-xs text-zinc-400">{b.fecha}</span>
                  </div>
                  <p className="font-black text-zinc-900 text-lg leading-tight truncate">{b.cliente || "Sin nombre"}</p>
                  {b.telCliente && <p className="text-xs text-zinc-500 mt-0.5">{b.telCliente}</p>}
                  {b.descripcion && (
                    <p className="text-sm text-zinc-500 mt-1 line-clamp-2">{b.descripcion}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xl font-black text-zinc-900">
                    {b.precio ? `${Number(b.precio).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €` : "—"}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Btn size="sm" onClick={() => onView(b)}>👁 Ver</Btn>
                <Btn size="sm" variant="secondary" onClick={() => onEdit(b)}>✏️ Editar</Btn>
                <Btn size="sm" variant="danger" onClick={() => onDelete(b.id)}>🗑 Eliminar</Btn>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── SCREEN: FORM (NEW / EDIT) ────────────────────────────────────────────────

const FormScreen = ({ initial, onSave, onCancel }) => {
  const [form, setForm] = useState(initial || { cliente: "", telCliente: "", descripcion: "", precio: "" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

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
          <h1 className="text-3xl font-black text-zinc-900">{initial ? "Editar presupuesto" : "Nuevo presupuesto"}</h1>
        </div>
      </div>

      <div className="flex flex-col gap-5 bg-white border-2 border-zinc-200 rounded-xl p-6 shadow-sm">
        <Field label="Nombre del cliente *">
          <Input value={form.cliente} onChange={set("cliente")} placeholder="Juan García" />
        </Field>
        <Field label="Teléfono del cliente">
          <Input value={form.telCliente} onChange={set("telCliente")} placeholder="600 000 000" />
        </Field>
        <Field label="Descripción del servicio">
          <Textarea value={form.descripcion} onChange={set("descripcion")} placeholder="Transporte de maquinaria industrial desde Madrid hasta Barcelona. Grúa de 50 toneladas..." />
        </Field>
        <Field label="Precio total (€)">
          <Input value={form.precio} onChange={set("precio")} placeholder="1.500,00" type="number" min="0" step="0.01" />
        </Field>

        <div className="flex gap-3 mt-2 flex-wrap">
          <Btn size="lg" className="flex-1" onClick={handleSave}>💾 Guardar presupuesto</Btn>
          <Btn size="lg" variant="secondary" onClick={onCancel}>Cancelar</Btn>
        </div>
      </div>
    </div>
  );
};

// ─── SCREEN: VIEW ─────────────────────────────────────────────────────────────

const ViewScreen = ({ budget, config, onEdit, onDelete, onBack }) => {
  const [loading, setLoading] = useState(false);

  const handlePDF = async () => {
    setLoading(true);
    try { await generatePDF(budget, config); } catch (e) { alert("Error al generar el PDF: " + e.message); }
    setLoading(false);
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={onBack} className="text-zinc-400 hover:text-zinc-900 transition-colors text-2xl leading-none">←</button>
        <div>
          <p className="text-xs font-bold tracking-widest text-zinc-400 uppercase mb-0.5">Presupuesto</p>
          <h1 className="text-3xl font-black text-zinc-900">{budget.numero}</h1>
        </div>
      </div>

      <div className="bg-white border-2 border-zinc-200 rounded-xl overflow-hidden shadow-sm mb-5">
        <div className="bg-zinc-900 px-6 py-5 flex items-center gap-4">
          {config.logo ? (
            <img src={config.logo} alt="logo" className="h-12 w-12 object-contain rounded bg-white p-1" />
          ) : (
            <div className="h-12 w-12 bg-zinc-700 rounded flex items-center justify-center text-white text-xl">🏢</div>
          )}
          <div>
            <p className="font-black text-white text-lg leading-tight">{config.nombre || "Mi Empresa"}</p>
            <p className="text-zinc-400 text-xs mt-0.5">{[config.tel, config.email].filter(Boolean).join("  ·  ")}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-zinc-400 text-xs">Fecha</p>
            <p className="text-white font-bold text-sm">{budget.fecha}</p>
          </div>
        </div>

        <div className="p-6 flex flex-col gap-5">
          <div className="bg-zinc-50 rounded-lg p-4">
            <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-2">Cliente</p>
            <p className="font-black text-zinc-900 text-xl">{budget.cliente}</p>
            {budget.telCliente && <p className="text-zinc-500 text-sm mt-0.5">📞 {budget.telCliente}</p>}
          </div>

          <div>
            <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-2">Descripción del servicio</p>
            <p className="text-zinc-700 text-sm leading-relaxed whitespace-pre-wrap">{budget.descripcion || "—"}</p>
          </div>

          <div className="bg-zinc-900 rounded-lg p-4 flex items-center justify-between">
            <p className="text-zinc-400 font-bold text-sm">TOTAL</p>
            <p className="text-white font-black text-2xl">
              {budget.precio ? `${Number(budget.precio).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €` : "—"}
            </p>
          </div>

          {config.condiciones && (
            <div className="border-t border-zinc-100 pt-4">
              <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-2">Condiciones de pago</p>
              <p className="text-zinc-600 text-sm leading-relaxed">{config.condiciones}</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Btn size="lg" className="w-full" onClick={handlePDF} disabled={loading}>
          {loading ? "⏳ Generando PDF..." : "📄 Descargar PDF"}
        </Btn>
        <div className="flex gap-3">
          <Btn size="md" variant="secondary" className="flex-1" onClick={onEdit}>✏️ Editar</Btn>
          <Btn size="md" variant="danger" onClick={onDelete}>🗑 Eliminar</Btn>
        </div>
      </div>
    </div>
  );
};

// ─── APP ROOT ─────────────────────────────────────────────────────────────────

export default function App() {
  const [config, setConfig] = useState(() => load(STORAGE_KEYS.config, null));
  const [budgets, setBudgets] = useState(() => load(STORAGE_KEYS.budgets, []));
  const [screen, setScreen] = useState(() => load(STORAGE_KEYS.config, null) ? "dashboard" : "config");
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);

  const persistBudgets = (next) => { setBudgets(next); save(STORAGE_KEYS.budgets, next); };

  const handleConfigSave = (cfg) => { setConfig(cfg); setScreen("dashboard"); };

  const handleNew = () => { setEditing(null); setScreen("form"); };

  const handleEdit = (b) => { setEditing(b); setScreen("form"); };

  const handleView = (b) => { setViewing(b); setScreen("view"); };

  const handleDelete = (id) => {
    if (!confirm("¿Eliminar este presupuesto?")) return;
    const next = budgets.filter((b) => b.id !== id);
    persistBudgets(next);
    if (screen === "view") setScreen("dashboard");
  };

  const handleFormSave = (form) => {
    if (editing) {
      const next = budgets.map((b) => b.id === editing.id ? { ...editing, ...form } : b);
      persistBudgets(next);
    } else {
      const newB = { ...form, id: Date.now(), numero: nextNum(), fecha: today() };
      persistBudgets([newB, ...budgets]);
    }
    setScreen("dashboard");
    setEditing(null);
  };

  return (
    <div className="min-h-screen bg-zinc-50" style={{ backgroundImage: "radial-gradient(circle, #d4d4d4 1px, transparent 1px)", backgroundSize: "24px 24px" }}>
      {screen === "config" && (
        <ConfigScreen initial={config} onSave={handleConfigSave} />
      )}
      {screen === "dashboard" && (
        <DashboardScreen
          budgets={budgets}
          onNew={handleNew}
          onView={handleView}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onConfig={() => setScreen("config")}
        />
      )}
      {screen === "form" && (
        <FormScreen
          initial={editing}
          onSave={handleFormSave}
          onCancel={() => setScreen("dashboard")}
        />
      )}
      {screen === "view" && viewing && (
        <ViewScreen
          budget={viewing}
          config={config || {}}
          onEdit={() => { handleEdit(viewing); }}
          onDelete={() => handleDelete(viewing.id)}
          onBack={() => setScreen("dashboard")}
        />
      )}
    </div>
  );
}
