import { useState, useRef } from "react";
import { jsPDF } from "jspdf";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const ADMIN_WHATSAPP = "34670090332";
const ADMIN_EMAIL = "gruaselsa@gmail.com";

// ─── UTILIDADES ───────────────────────────────────────────────────────────────
const STORAGE_KEYS = { config: "tg_config", budgets: "tg_budgets", counter: "tg_counter" };
const load = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const save = (key, val) => localStorage.setItem(key, JSON.stringify(val));
const today = () => new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
const nextNum = () => {
  const n = (load(STORAGE_KEYS.counter, 0)) + 1;
  save(STORAGE_KEYS.counter, n);
  return `S-${String(n).padStart(3, "0")}`;
};

// ─── ENVÍOS ───────────────────────────────────────────────────────────────────
const buildMessage = (solicitud, config) => {
  const lines = [
    `🔧 NUEVA SOLICITUD DE SERVICIO`,
    `Nº ${solicitud.numero}  ·  Fecha: ${solicitud.fecha}`,
    ``,
    `👤 Cliente: ${solicitud.cliente || "—"}`,
    solicitud.telCliente ? `📞 Tel: ${solicitud.telCliente}` : null,
    solicitud.direccion ? `📍 Dirección: ${solicitud.direccion}` : null,
    solicitud.tipo ? `🚛 Tipo: ${solicitud.tipo}` : null,
    ``,
    `📋 Descripción:`,
    solicitud.descripcion || "—",
    solicitud.precio ? `\n💶 Precio estimado: ${Number(solicitud.precio).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €` : null,
    ``,
    `— ${config?.nombre || "ELSA"}`,
  ].filter((l) => l !== null).join("\n");
  return lines;
};

const sendWhatsApp = (solicitud, config) => {
  const text = encodeURIComponent(buildMessage(solicitud, config));
  window.open(`https://wa.me/${ADMIN_WHATSAPP}?text=${text}`, "_blank");
};

const sendEmail = (solicitud, config) => {
  const subject = encodeURIComponent(`Solicitud ${solicitud.numero} – ${solicitud.cliente || "Sin nombre"}`);
  const body = encodeURIComponent(buildMessage(solicitud, config));
  window.open(`mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`, "_blank");
};

// ─── PDF ───────────────────────────────────────────────────────────────────────
const generatePDF = (solicitud, config) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const margin = 18;
  let y = 0;

  doc.setFillColor(20, 20, 20);
  doc.rect(0, 0, W, 42, "F");

  if (config.logo) {
    try { doc.addImage(config.logo, "JPEG", margin, 8, 28, 28); } catch {}
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

  doc.setTextColor(20, 20, 20);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("SOLICITUD DE SERVICIO", margin, y);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`Nº ${solicitud.numero}`, W - margin, y - 6, { align: "right" });
  doc.text(`Fecha: ${solicitud.fecha}`, W - margin, y + 1, { align: "right" });
  y += 10;

  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.line(margin, y, W - margin, y);
  y += 10;

  // Cliente
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(margin, y, W - margin * 2, solicitud.telCliente ? 32 : 26, 2, 2, "F");
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("DATOS DEL CLIENTE", margin + 5, y + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text(solicitud.cliente || "—", margin + 5, y + 15);
  if (solicitud.telCliente) {
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(`Tel: ${solicitud.telCliente}`, margin + 5, y + 22);
  }
  y += solicitud.telCliente ? 42 : 36;

  // Dirección del servicio
  if (solicitud.direccion) {
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(margin, y, W - margin * 2, 22, 2, 2, "F");
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("DIRECCIÓN DEL SERVICIO", margin + 5, y + 7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(20, 20, 20);
    doc.text(solicitud.direccion, margin + 5, y + 15);
    y += 30;
  }

  // Tipo
  if (solicitud.tipo) {
    doc.setFillColor(20, 20, 20);
    doc.roundedRect(margin, y, 50, 14, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(solicitud.tipo.toUpperCase(), margin + 25, y + 9, { align: "center" });
    y += 22;
  }

  // Descripción
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
  const lines = doc.splitTextToSize(solicitud.descripcion || "—", W - margin * 2);
  doc.text(lines, margin, y);
  y += lines.length * 6 + 10;

  // Precio estimado (opcional)
  if (solicitud.precio) {
    doc.setFillColor(20, 20, 20);
    doc.roundedRect(W - margin - 70, y, 70, 26, 2, 2, "F");
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("PRECIO ESTIMADO", W - margin - 35, y + 8, { align: "center" });
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text(
      `${Number(solicitud.precio).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €`,
      W - margin - 35, y + 19, { align: "center" }
    );
    y += 36;
  }

  // Footer
  doc.setFillColor(20, 20, 20);
  doc.rect(0, 282, W, 15, "F");
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  const footerParts = [config.nombre, config.tel, config.email, config.direccion].filter(Boolean).join("  ·  ");
  doc.text(footerParts, W / 2, 291, { align: "center" });

  doc.save(`Solicitud_${solicitud.numero}.pdf`);
};

// ─── COMPONENTS ───────────────────────────────────────────────────────────────
const Btn = ({ children, onClick, variant = "primary", size = "md", className = "", disabled = false }) => {
  const base = "inline-flex items-center justify-center gap-2 font-bold tracking-wide transition-all duration-150 cursor-pointer border-2 select-none disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary:   "bg-zinc-900 text-white border-zinc-900 hover:bg-zinc-700 hover:border-zinc-700",
    secondary: "bg-white text-zinc-900 border-zinc-300 hover:border-zinc-900 hover:bg-zinc-50",
    danger:    "bg-white text-red-600 border-red-200 hover:bg-red-600 hover:text-white hover:border-red-600",
    ghost:     "bg-transparent text-zinc-600 border-transparent hover:bg-zinc-100 hover:text-zinc-900",
    whatsapp:  "bg-green-500 text-white border-green-500 hover:bg-green-600 hover:border-green-600",
    email:     "bg-blue-600 text-white border-blue-600 hover:bg-blue-700 hover:border-blue-700",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-xs rounded",
    md: "px-5 py-2.5 text-sm rounded-md",
    lg: "px-7 py-4 text-base rounded-lg",
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}>
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

const inputClass = "w-full border-2 border-zinc-200 rounded-md px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors bg-white";

const Input = (props) => <input {...props} className={inputClass} />;

const Select = ({ value, onChange, children }) => (
  <select value={value} onChange={onChange} className={inputClass}>
    {children}
  </select>
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
  const [form, setForm] = useState(initial || { nombre: "", tel: "", email: "", direccion: "", logo: "" });
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
            {form.logo
              ? <img src={form.logo} alt="logo" className="h-16 w-16 object-contain rounded" />
              : <div className="h-16 w-16 bg-zinc-100 rounded flex items-center justify-center text-zinc-400 text-2xl">🏢</div>
            }
            <div>
              <p className="text-sm font-semibold text-zinc-700">{form.logo ? "Cambiar logo" : "Subir logo"}</p>
              <p className="text-xs text-zinc-400">JPEG o PNG</p>
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleLogo} />
          </div>
        </Field>
        <Field label="Nombre empresa">
          <Input value={form.nombre} onChange={set("nombre")} placeholder="Grúas ELSA S.L." />
        </Field>
        <Field label="Teléfono">
          <Input value={form.tel} onChange={set("tel")} placeholder="600 000 000" />
        </Field>
        <Field label="Email">
          <Input value={form.email} onChange={set("email")} placeholder="info@empresa.com" type="email" />
        </Field>
        <Field label="Dirección fiscal">
          <Input value={form.direccion} onChange={set("direccion")} placeholder="Calle Mayor 1, 28001 Madrid" />
        </Field>
        <Btn size="lg" className="mt-2" onClick={() => { save(STORAGE_KEYS.config, form); onSave(form); }}>
          💾 Guardar configuración
        </Btn>
      </div>
    </div>
  );
};

// ─── SCREEN: DASHBOARD ────────────────────────────────────────────────────────
const DashboardScreen = ({ solicitudes, onNew, onView, onEdit, onDelete, onConfig }) => {
  const [q, setQ] = useState("");
  const filtered = solicitudes.filter((b) =>
    [b.cliente, b.descripcion, b.numero, b.tipo, b.direccion].join(" ").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <p className="text-xs font-bold tracking-widest text-zinc-400 uppercase mb-1">Panel principal</p>
          <h1 className="text-3xl font-black text-zinc-900">Solicitudes</h1>
        </div>
        <Btn variant="ghost" size="sm" onClick={onConfig}>⚙️ Config</Btn>
      </div>

      <Btn size="lg" className="w-full mb-6" onClick={onNew}>
        ➕ Nueva Solicitud
      </Btn>

      {solicitudes.length > 0 && (
        <div className="mb-5">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍  Buscar por cliente, dirección, tipo..." />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-zinc-400">
          <div className="text-5xl mb-3">📋</div>
          <p className="font-semibold">{solicitudes.length === 0 ? "Aún no hay solicitudes" : "Sin resultados"}</p>
          <p className="text-sm mt-1">{solicitudes.length === 0 ? "Crea la primera solicitud con el botón de arriba" : "Prueba con otra búsqueda"}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((b) => (
            <div key={b.id} className="bg-white border-2 border-zinc-200 rounded-xl p-5 hover:border-zinc-400 transition-colors">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-xs font-bold text-zinc-400 tracking-widest">{b.numero}</span>
                    <span className="text-xs text-zinc-300">·</span>
                    <span className="text-xs text-zinc-400">{b.fecha}</span>
                    {b.tipo && (
                      <>
                        <span className="text-xs text-zinc-300">·</span>
                        <span className="text-xs font-bold bg-zinc-900 text-white px-2 py-0.5 rounded">{b.tipo}</span>
                      </>
                    )}
                  </div>
                  <p className="font-black text-zinc-900 text-lg leading-tight truncate">{b.cliente || "Sin nombre"}</p>
                  {b.telCliente && <p className="text-xs text-zinc-500 mt-0.5">📞 {b.telCliente}</p>}
                  {b.direccion && <p className="text-xs text-zinc-500 mt-0.5">📍 {b.direccion}</p>}
                  {b.descripcion && <p className="text-sm text-zinc-500 mt-1 line-clamp-2">{b.descripcion}</p>}
                </div>
                {b.precio && (
                  <div className="text-right shrink-0">
                    <p className="text-xs text-zinc-400 mb-0.5">Est.</p>
                    <p className="text-lg font-black text-zinc-900">
                      {Number(b.precio).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €
                    </p>
                  </div>
                )}
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

// ─── SCREEN: FORM ─────────────────────────────────────────────────────────────
const FormScreen = ({ initial, onSave, onCancel }) => {
  const [form, setForm] = useState(
    initial || { cliente: "", telCliente: "", direccion: "", tipo: "", descripcion: "", precio: "" }
  );
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
          <p className="text-xs font-bold tracking-widest text-zinc-400 uppercase mb-0.5">{initial ? "Editando" : "Nueva"}</p>
          <h1 className="text-3xl font-black text-zinc-900">{initial ? "Editar solicitud" : "Nueva solicitud"}</h1>
        </div>
      </div>

      <div className="flex flex-col gap-5 bg-white border-2 border-zinc-200 rounded-xl p-6 shadow-sm">
        <Field label="Nombre del cliente *">
          <Input value={form.cliente} onChange={set("cliente")} placeholder="Juan García" />
        </Field>
        <Field label="Teléfono del cliente">
          <Input value={form.telCliente} onChange={set("telCliente")} placeholder="600 000 000" />
        </Field>
        <Field label="Dirección del servicio">
          <Input value={form.direccion} onChange={set("direccion")} placeholder="Polígono Industrial Las Rozas, Madrid" />
        </Field>
        <Field label="Tipo de servicio">
          <Select value={form.tipo} onChange={set("tipo")}>
            <option value="">— Seleccionar —</option>
            <option value="Transporte">Transporte</option>
            <option value="Grúa">Grúa</option>
            <option value="Transporte + Grúa">Transporte + Grúa</option>
            <option value="Otro">Otro</option>
          </Select>
        </Field>
        <Field label="Descripción del servicio">
          <Textarea
            value={form.descripcion}
            onChange={set("descripcion")}
            placeholder="Descripción del trabajo a realizar, origen, destino, tonelaje..."
          />
        </Field>
        <Field label="Precio estimado (€) — opcional">
          <Input value={form.precio} onChange={set("precio")} placeholder="1500" type="number" min="0" step="0.01" />
        </Field>

        <div className="flex gap-3 mt-2 flex-wrap">
          <Btn size="lg" className="flex-1" onClick={handleSave}>💾 Guardar</Btn>
          <Btn size="lg" variant="secondary" onClick={onCancel}>Cancelar</Btn>
        </div>
      </div>
    </div>
  );
};

// ─── SCREEN: VIEW ─────────────────────────────────────────────────────────────
const ViewScreen = ({ solicitud, config, onEdit, onDelete, onBack }) => (
  <div className="max-w-xl mx-auto px-4 py-10">
    <div className="flex items-center gap-3 mb-8">
      <button onClick={onBack} className="text-zinc-400 hover:text-zinc-900 transition-colors text-2xl leading-none">←</button>
      <div>
        <p className="text-xs font-bold tracking-widest text-zinc-400 uppercase mb-0.5">Solicitud</p>
        <h1 className="text-3xl font-black text-zinc-900">{solicitud.numero}</h1>
      </div>
    </div>

    {/* Card */}
    <div className="bg-white border-2 border-zinc-200 rounded-xl overflow-hidden shadow-sm mb-5">
      {/* Cabecera empresa */}
      <div className="bg-zinc-900 px-6 py-5 flex items-center gap-4">
        {config.logo
          ? <img src={config.logo} alt="logo" className="h-12 w-12 object-contain rounded bg-white p-1" />
          : <div className="h-12 w-12 bg-zinc-700 rounded flex items-center justify-center text-white text-xl">🏢</div>
        }
        <div>
          <p className="font-black text-white text-lg leading-tight">{config.nombre || "Mi Empresa"}</p>
          <p className="text-zinc-400 text-xs mt-0.5">{[config.tel, config.email].filter(Boolean).join("  ·  ")}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-zinc-400 text-xs">Fecha</p>
          <p className="text-white font-bold text-sm">{solicitud.fecha}</p>
        </div>
      </div>

      <div className="p-6 flex flex-col gap-5">
        {/* Cliente */}
        <div className="bg-zinc-50 rounded-lg p-4">
          <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-2">Cliente</p>
          <p className="font-black text-zinc-900 text-xl">{solicitud.cliente}</p>
          {solicitud.telCliente && <p className="text-zinc-500 text-sm mt-1">📞 {solicitud.telCliente}</p>}
        </div>

        {/* Dirección */}
        {solicitud.direccion && (
          <div className="bg-zinc-50 rounded-lg p-4">
            <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-2">Dirección del servicio</p>
            <p className="text-zinc-800 text-sm font-semibold">📍 {solicitud.direccion}</p>
          </div>
        )}

        {/* Tipo */}
        {solicitud.tipo && (
          <div className="flex items-center gap-3">
            <span className="bg-zinc-900 text-white text-sm font-bold px-4 py-1.5 rounded-full">🚛 {solicitud.tipo}</span>
          </div>
        )}

        {/* Descripción */}
        <div>
          <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-2">Descripción del servicio</p>
          <p className="text-zinc-700 text-sm leading-relaxed whitespace-pre-wrap">{solicitud.descripcion || "—"}</p>
        </div>

        {/* Precio estimado */}
        {solicitud.precio && (
          <div className="bg-zinc-900 rounded-lg p-4 flex items-center justify-between">
            <p className="text-zinc-400 font-bold text-sm">PRECIO ESTIMADO</p>
            <p className="text-white font-black text-2xl">
              {Number(solicitud.precio).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €
            </p>
          </div>
        )}
      </div>
    </div>

    {/* Enviar a administración */}
    <div className="bg-white border-2 border-zinc-200 rounded-xl p-5 mb-4">
      <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-3">Enviar a administración</p>
      <div className="flex gap-3">
        <Btn size="lg" variant="whatsapp" className="flex-1" onClick={() => sendWhatsApp(solicitud, config)}>
          💬 WhatsApp
        </Btn>
        <Btn size="lg" variant="email" className="flex-1" onClick={() => sendEmail(solicitud, config)}>
          ✉️ Email
        </Btn>
      </div>
    </div>

    {/* Acciones secundarias */}
    <div className="flex gap-3 flex-wrap">
      <Btn size="md" variant="secondary" className="flex-1" onClick={onEdit}>✏️ Editar</Btn>
      <Btn size="md" variant="secondary" onClick={() => generatePDF(solicitud, config)}>📄 PDF</Btn>
      <Btn size="md" variant="danger" onClick={onDelete}>🗑 Eliminar</Btn>
    </div>
  </div>
);

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const [config, setConfig] = useState(() => load(STORAGE_KEYS.config, null));
  const [solicitudes, setSolicitudes] = useState(() => load(STORAGE_KEYS.budgets, []));
  const [screen, setScreen] = useState(() => load(STORAGE_KEYS.config, null) ? "dashboard" : "config");
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);

  const persist = (next) => { setSolicitudes(next); save(STORAGE_KEYS.budgets, next); };

  const handleConfigSave = (cfg) => { setConfig(cfg); setScreen("dashboard"); };
  const handleNew  = () => { setEditing(null); setScreen("form"); };
  const handleEdit = (b) => { setEditing(b); setScreen("form"); };
  const handleView = (b) => { setViewing(b); setScreen("view"); };

  const handleDelete = (id) => {
    if (!confirm("¿Eliminar esta solicitud?")) return;
    persist(solicitudes.filter((b) => b.id !== id));
    if (screen === "view") setScreen("dashboard");
  };

  const handleFormSave = (form) => {
    if (editing) {
      persist(solicitudes.map((b) => b.id === editing.id ? { ...editing, ...form } : b));
    } else {
      persist([{ ...form, id: Date.now(), numero: nextNum(), fecha: today() }, ...solicitudes]);
    }
    setScreen("dashboard");
    setEditing(null);
  };

  return (
    <div className="min-h-screen bg-zinc-50" style={{ backgroundImage: "radial-gradient(circle, #d4d4d4 1px, transparent 1px)", backgroundSize: "24px 24px" }}>
      {screen === "config" && <ConfigScreen initial={config} onSave={handleConfigSave} />}
      {screen === "dashboard" && (
        <DashboardScreen
          solicitudes={solicitudes}
          onNew={handleNew}
          onView={handleView}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onConfig={() => setScreen("config")}
        />
      )}
      {screen === "form" && (
        <FormScreen initial={editing} onSave={handleFormSave} onCancel={() => setScreen("dashboard")} />
      )}
      {screen === "view" && viewing && (
        <ViewScreen
          solicitud={viewing}
          config={config || {}}
          onEdit={() => handleEdit(viewing)}
          onDelete={() => handleDelete(viewing.id)}
          onBack={() => setScreen("dashboard")}
        />
      )}
    </div>
  );
}
