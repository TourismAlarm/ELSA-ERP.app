import { useState, useRef, useEffect } from "react";
import { jsPDF } from "jspdf";
import { supabase } from "./supabase";

// ─── AUTH ─────────────────────────────────────────────────────────────────────
const PASSWORD_HASH = "82f61eafeaa2d4cf09ec71e6494c7b017602d4fa0e9a937d246c2b79979d9709";
const AUTH_KEY = "elsa_auth_v1";

const hashStr = async (str) => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
};

const isAuthenticated = () => localStorage.getItem(AUTH_KEY) === PASSWORD_HASH;

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const ADMIN_WHATSAPP = "34670090332";
const ADMIN_EMAIL    = "gruaselsa@gmail.com";

const DEFAULT_VEHICLES   = ["Camión 1", "Camión 2", "Grúa 3", "Cesta", "Operario externo"];
const DEFAULT_WORK_TYPES = ["Maquinaria", "Barcos", "Cesta", "Servicios", "Otro"];

// ─── UTILIDADES ───────────────────────────────────────────────────────────────
const today = () => new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });

// Counter local solo para generar número correlativo (Supabase no lo necesita)
const COUNTER_KEY = "elsa_counter";
const nextNum = () => {
  const n = Number(localStorage.getItem(COUNTER_KEY) || 0) + 1;
  localStorage.setItem(COUNTER_KEY, n);
  return `S-${String(n).padStart(3, "0")}`;
};

// ─── SUPABASE: SOLICITUDES ────────────────────────────────────────────────────
const dbLoadSolicitudes = async () => {
  const { data, error } = await supabase.from("solicitudes").select("*").order("id", { ascending: false });
  if (error) { console.error(error); return []; }
  return data;
};

const sanitize = (s) => ({
  ...s,
  precio: s.precio !== "" && s.precio != null ? Number(s.precio) : null,
  metros: s.metros !== "" && s.metros != null ? Number(s.metros) : null,
  peso:   s.peso   !== "" && s.peso   != null ? Number(s.peso)   : null,
  bultos: s.bultos !== "" && s.bultos != null ? Number(s.bultos) : null,
});

const dbSaveSolicitud = async (solicitud) => {
  const { error } = await supabase.from("solicitudes").insert([sanitize(solicitud)]);
  if (error) console.error(error);
};

const dbUpdateSolicitud = async (solicitud) => {
  const { error } = await supabase.from("solicitudes").update(sanitize(solicitud)).eq("id", solicitud.id);
  if (error) console.error(error);
};

const dbDeleteSolicitud = async (id) => {
  const { error } = await supabase.from("solicitudes").delete().eq("id", id);
  if (error) console.error(error);
};

// ─── SUPABASE: CONFIG ─────────────────────────────────────────────────────────
const dbLoadConfig = async () => {
  const { data, error } = await supabase.from("config").select("*").eq("id", 1).maybeSingle();
  if (error) { console.error(error); return null; }
  return data;
};

const dbSaveConfig = async (cfg) => {
  const { error } = await supabase.from("config").upsert({ id: 1, ...cfg });
  if (error) console.error(error);
};

// ─── ENVÍOS ───────────────────────────────────────────────────────────────────
const buildMessage = (s, config) => {
  const carga = [
    s.metros ? `${s.metros} m` : null,
    s.peso   ? `${s.peso} kg`  : null,
    s.bultos ? `${s.bultos} bultos` : null,
  ].filter(Boolean).join(" · ");

  return [
    `🔧 NUEVA SOLICITUD DE SERVICIO`,
    `Nº ${s.numero}  ·  Fecha: ${s.fecha}`,
    ``,
    `👤 Cliente: ${s.cliente || "—"}`,
    s.telCliente             ? `📞 Tel: ${s.telCliente}` : null,
    s.vehiculo               ? `🚛 Vehículo/Equipo: ${s.vehiculo}` : null,
    (s.tipoTrabajo || s.tipo)? `🔧 Tipo de trabajo: ${s.tipoTrabajo || s.tipo}` : null,
    s.origen                 ? `📍 Origen (A): ${s.origen}` : null,
    s.destino                ? `📍 Destino (B): ${s.destino}` : null,
    (!s.origen && s.direccion)? `📍 Dirección: ${s.direccion}` : null,
    carga                    ? `📦 Carga: ${carga}` : null,
    ``,
    `📋 Descripción:`,
    s.descripcion || "—",
    s.precio ? `\n💶 Precio estimado: ${Number(s.precio).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €` : null,
    ``,
    `— ${config?.nombre || "ELSA"}`,
  ].filter((l) => l !== null).join("\n");
};

const sendWhatsApp = (s, config) =>
  window.open(`https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(buildMessage(s, config))}`, "_blank");

const sendEmail = (s, config) =>
  window.open(
    `mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(`Solicitud ${s.numero} – ${s.cliente || "Sin nombre"}`)}&body=${encodeURIComponent(buildMessage(s, config))}`,
    "_blank"
  );

// ─── PDF ───────────────────────────────────────────────────────────────────────
const generatePDF = (s, config) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, margin = 18;
  let y = 0;

  doc.setFillColor(20, 20, 20);
  doc.rect(0, 0, W, 42, "F");

  if (config.logo) {
    try {
      const fmt = config.logo.startsWith("data:image/png") ? "PNG" : "JPEG";
      doc.addImage(config.logo, fmt, margin, 8, 28, 28);
    } catch {}
    doc.setTextColor(255,255,255); doc.setFontSize(16); doc.setFont("helvetica","bold");
    doc.text(config.nombre || "Mi Empresa", margin + 34, 22);
    doc.setFontSize(8); doc.setFont("helvetica","normal"); doc.setTextColor(180,180,180);
    doc.text([config.tel, config.email, config.direccion].filter(Boolean).join("  ·  "), margin + 34, 29);
  } else {
    doc.setTextColor(255,255,255); doc.setFontSize(18); doc.setFont("helvetica","bold");
    doc.text(config.nombre || "Mi Empresa", margin, 22);
    doc.setFontSize(8); doc.setFont("helvetica","normal"); doc.setTextColor(180,180,180);
    doc.text([config.tel, config.email, config.direccion].filter(Boolean).join("  ·  "), margin, 30);
  }

  y = 54;
  doc.setTextColor(20,20,20); doc.setFontSize(22); doc.setFont("helvetica","bold");
  doc.text("SOLICITUD DE SERVICIO", margin, y);
  doc.setFontSize(10); doc.setFont("helvetica","normal"); doc.setTextColor(100,100,100);
  doc.text(`Nº ${s.numero}`, W - margin, y - 6, { align: "right" });
  doc.text(`Fecha: ${s.fecha}`, W - margin, y + 1, { align: "right" });
  y += 10;

  doc.setDrawColor(220,220,220); doc.setLineWidth(0.5);
  doc.line(margin, y, W - margin, y);
  y += 10;

  const clienteH = s.telCliente ? 32 : 26;
  doc.setFillColor(245,245,245);
  doc.roundedRect(margin, y, W - margin * 2, clienteH, 2, 2, "F");
  doc.setTextColor(100,100,100); doc.setFontSize(7); doc.setFont("helvetica","bold");
  doc.text("DATOS DEL CLIENTE", margin + 5, y + 7);
  doc.setFont("helvetica","normal"); doc.setFontSize(11); doc.setTextColor(20,20,20);
  doc.text(s.cliente || "—", margin + 5, y + 15);
  if (s.telCliente) { doc.setFontSize(9); doc.setTextColor(80,80,80); doc.text(`Tel: ${s.telCliente}`, margin + 5, y + 22); }
  y += clienteH + 10;

  if (s.origen || s.destino) {
    const colW = (W - margin * 2 - 6) / 2;
    if (s.origen) {
      doc.setFillColor(245,245,245); doc.roundedRect(margin, y, colW, 22, 2, 2, "F");
      doc.setTextColor(100,100,100); doc.setFontSize(7); doc.setFont("helvetica","bold");
      doc.text("ORIGEN (A)", margin + 5, y + 7);
      doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(20,20,20);
      doc.text(doc.splitTextToSize(s.origen, colW - 10)[0] || "", margin + 5, y + 15);
    }
    if (s.destino) {
      const x2 = margin + colW + 6;
      doc.setFillColor(245,245,245); doc.roundedRect(x2, y, colW, 22, 2, 2, "F");
      doc.setTextColor(100,100,100); doc.setFontSize(7); doc.setFont("helvetica","bold");
      doc.text("DESTINO (B)", x2 + 5, y + 7);
      doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(20,20,20);
      doc.text(doc.splitTextToSize(s.destino, colW - 10)[0] || "", x2 + 5, y + 15);
    }
    y += 30;
  } else if (s.direccion) {
    doc.setFillColor(245,245,245); doc.roundedRect(margin, y, W - margin * 2, 22, 2, 2, "F");
    doc.setTextColor(100,100,100); doc.setFontSize(7); doc.setFont("helvetica","bold");
    doc.text("DIRECCIÓN DEL SERVICIO", margin + 5, y + 7);
    doc.setFont("helvetica","normal"); doc.setFontSize(10); doc.setTextColor(20,20,20);
    doc.text(s.direccion, margin + 5, y + 15);
    y += 30;
  }

  const badges = [s.vehiculo, (s.tipoTrabajo || s.tipo) ? (s.tipoTrabajo || s.tipo).toUpperCase() : null].filter(Boolean);
  if (badges.length) {
    let bx = margin;
    badges.forEach((badge) => {
      const bw = Math.max(40, Math.min(80, badge.length * 2.4 + 16));
      doc.setFillColor(20,20,20); doc.roundedRect(bx, y, bw, 14, 2, 2, "F");
      doc.setTextColor(255,255,255); doc.setFontSize(8); doc.setFont("helvetica","bold");
      doc.text(badge, bx + bw / 2, y + 9, { align: "center" });
      bx += bw + 6;
    });
    y += 22;
  }

  const cargaItems = [
    s.metros ? `Metros de descarga: ${s.metros} m` : null,
    s.peso   ? `Peso: ${s.peso} kg` : null,
    s.bultos ? `Nº de bultos: ${s.bultos}` : null,
  ].filter(Boolean);
  if (cargaItems.length) {
    const boxH = 14 + cargaItems.length * 7;
    doc.setFillColor(245,245,245); doc.roundedRect(margin, y, W - margin * 2, boxH, 2, 2, "F");
    doc.setTextColor(100,100,100); doc.setFontSize(7); doc.setFont("helvetica","bold");
    doc.text("DATOS DE CARGA", margin + 5, y + 7);
    doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(20,20,20);
    cargaItems.forEach((item, i) => doc.text(item, margin + 5, y + 14 + i * 7));
    y += boxH + 8;
  }

  doc.setTextColor(100,100,100); doc.setFontSize(7); doc.setFont("helvetica","bold");
  doc.text("DESCRIPCIÓN DEL SERVICIO", margin, y);
  y += 5;
  doc.setDrawColor(20,20,20); doc.setLineWidth(1);
  doc.line(margin, y, margin + 40, y); doc.setLineWidth(0.5);
  y += 8;
  doc.setFont("helvetica","normal"); doc.setFontSize(10); doc.setTextColor(30,30,30);
  const descLines = doc.splitTextToSize(s.descripcion || "—", W - margin * 2);
  doc.text(descLines, margin, y);
  y += descLines.length * 6 + 10;

  if (s.precio) {
    doc.setFillColor(20,20,20); doc.roundedRect(W - margin - 70, y, 70, 26, 2, 2, "F");
    doc.setTextColor(150,150,150); doc.setFontSize(7); doc.setFont("helvetica","bold");
    doc.text("PRECIO ESTIMADO", W - margin - 35, y + 8, { align: "center" });
    doc.setTextColor(255,255,255); doc.setFontSize(16);
    doc.text(`${Number(s.precio).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €`, W - margin - 35, y + 19, { align: "center" });
    y += 36;
  }

  doc.setFillColor(20,20,20); doc.rect(0, 282, W, 15, "F");
  doc.setTextColor(150,150,150); doc.setFontSize(7); doc.setFont("helvetica","normal");
  doc.text([config.nombre, config.tel, config.email, config.direccion].filter(Boolean).join("  ·  "), W / 2, 291, { align: "center" });

  doc.save(`Solicitud_${s.numero}.pdf`);
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
    {label && <label className="text-xs font-bold text-zinc-500 tracking-widest uppercase">{label}</label>}
    {children}
  </div>
);

const inputClass = "w-full border-2 border-zinc-200 rounded-md px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors bg-white";
const Input    = (props) => <input {...props} className={inputClass} />;
const Select   = ({ value, onChange, children }) => <select value={value} onChange={onChange} className={inputClass}>{children}</select>;
const Textarea = (props) => <textarea {...props} rows={5} className="w-full border-2 border-zinc-200 rounded-md px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors bg-white resize-none" />;

// ─── SCREEN: LOGIN ────────────────────────────────────────────────────────────
const LoginScreen = ({ onLogin }) => {
  const [pwd, setPwd]     = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(false);
    const hash = await hashStr(pwd);
    if (hash === PASSWORD_HASH) {
      localStorage.setItem(AUTH_KEY, hash);
      onLogin();
    } else {
      setError(true);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundImage: "radial-gradient(circle, #d4d4d4 1px, transparent 1px)", backgroundSize: "24px 24px" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🏗️</div>
          <h1 className="text-3xl font-black text-zinc-900">ELSA</h1>
          <p className="text-zinc-500 text-sm mt-1">Sistema de presupuestos</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white border-2 border-zinc-200 rounded-xl p-6 shadow-sm flex flex-col gap-4">
          <Field label="Contraseña">
            <input
              type="password"
              value={pwd}
              onChange={(e) => { setPwd(e.target.value); setError(false); }}
              placeholder="••••••••"
              className={`${inputClass} ${error ? "border-red-400 focus:border-red-500" : ""}`}
              autoFocus
            />
            {error && <p className="text-red-500 text-xs font-semibold">Contraseña incorrecta</p>}
          </Field>
          <Btn size="lg" className="w-full" disabled={loading || !pwd}>
            {loading ? "Verificando..." : "Entrar"}
          </Btn>
        </form>
      </div>
    </div>
  );
};

// ─── LIST MANAGER ─────────────────────────────────────────────────────────────
const ListManager = ({ items, onChange }) => {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v || items.includes(v)) return;
    onChange([...items, v]);
    setDraft("");
  };
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3 min-h-8">
        {items.map((item) => (
          <span key={item} className="flex items-center gap-1.5 bg-zinc-100 border border-zinc-200 text-zinc-800 text-xs font-semibold px-3 py-1.5 rounded-full">
            {item}
            <button type="button" onClick={() => onChange(items.filter((i) => i !== item))} className="text-zinc-400 hover:text-red-500 transition-colors leading-none">×</button>
          </span>
        ))}
        {items.length === 0 && <span className="text-xs text-zinc-400 italic self-center">Sin elementos</span>}
      </div>
      <div className="flex gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Nuevo elemento..." className={inputClass + " py-2"} />
        <button type="button" onClick={add} className="px-4 py-2 bg-zinc-900 text-white text-sm font-bold rounded-md hover:bg-zinc-700 transition-colors shrink-0">+ Añadir</button>
      </div>
    </div>
  );
};

// ─── SCREEN: CONFIG ───────────────────────────────────────────────────────────
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

// ─── SCREEN: DASHBOARD ────────────────────────────────────────────────────────
const DashboardScreen = ({ solicitudes, onNew, onView, onEdit, onDelete, onConfig, loading }) => {
  const [q, setQ] = useState("");
  const filtered = solicitudes.filter((b) =>
    [b.cliente, b.descripcion, b.numero, b.tipo, b.tipoTrabajo, b.vehiculo, b.direccion, b.origen, b.destino]
      .join(" ").toLowerCase().includes(q.toLowerCase())
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

      <Btn size="lg" className="w-full mb-6" onClick={onNew}>➕ Nueva Solicitud</Btn>

      {solicitudes.length > 0 && (
        <div className="mb-5">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍  Buscar por cliente, origen, tipo, vehículo..." />
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-zinc-400">
          <div className="text-4xl mb-3">⏳</div>
          <p className="font-semibold">Cargando solicitudes...</p>
        </div>
      ) : filtered.length === 0 ? (
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
                    {(b.tipoTrabajo || b.tipo) && <span className="text-xs font-bold bg-zinc-900 text-white px-2 py-0.5 rounded">{b.tipoTrabajo || b.tipo}</span>}
                    {b.vehiculo && <span className="text-xs font-semibold bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded">{b.vehiculo}</span>}
                  </div>
                  <p className="font-black text-zinc-900 text-lg leading-tight truncate">{b.cliente || "Sin nombre"}</p>
                  {b.telCliente && <p className="text-xs text-zinc-500 mt-0.5">📞 {b.telCliente}</p>}
                  {b.origen
                    ? <p className="text-xs text-zinc-500 mt-0.5">📍 {b.origen}{b.destino ? ` → ${b.destino}` : ""}</p>
                    : b.direccion && <p className="text-xs text-zinc-500 mt-0.5">📍 {b.direccion}</p>}
                  {b.descripcion && <p className="text-sm text-zinc-500 mt-1 line-clamp-2">{b.descripcion}</p>}
                </div>
                {b.precio && (
                  <div className="text-right shrink-0">
                    <p className="text-xs text-zinc-400 mb-0.5">Est.</p>
                    <p className="text-lg font-black text-zinc-900">{Number(b.precio).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</p>
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

// ─── SCREEN: VIEW ─────────────────────────────────────────────────────────────
const ViewScreen = ({ solicitud: s, config, onEdit, onDelete, onBack }) => (
  <div className="max-w-xl mx-auto px-4 py-10">
    <div className="flex items-center gap-3 mb-8">
      <button onClick={onBack} className="text-zinc-400 hover:text-zinc-900 transition-colors text-2xl leading-none">←</button>
      <div>
        <p className="text-xs font-bold tracking-widest text-zinc-400 uppercase mb-0.5">Solicitud</p>
        <h1 className="text-3xl font-black text-zinc-900">{s.numero}</h1>
      </div>
    </div>

    <div className="bg-white border-2 border-zinc-200 rounded-xl overflow-hidden shadow-sm mb-5">
      <div className="bg-zinc-900 px-6 py-5 flex items-center gap-4">
        {config.logo ? <img src={config.logo} alt="logo" className="h-12 w-12 object-contain rounded bg-white p-1" /> : <div className="h-12 w-12 bg-zinc-700 rounded flex items-center justify-center text-white text-xl">🏢</div>}
        <div>
          <p className="font-black text-white text-lg leading-tight">{config.nombre || "Mi Empresa"}</p>
          <p className="text-zinc-400 text-xs mt-0.5">{[config.tel, config.email].filter(Boolean).join("  ·  ")}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-zinc-400 text-xs">Fecha</p>
          <p className="text-white font-bold text-sm">{s.fecha}</p>
        </div>
      </div>

      <div className="p-6 flex flex-col gap-5">
        <div className="bg-zinc-50 rounded-lg p-4">
          <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-2">Cliente</p>
          <p className="font-black text-zinc-900 text-xl">{s.cliente}</p>
          {s.telCliente && <p className="text-zinc-500 text-sm mt-1">📞 {s.telCliente}</p>}
        </div>

        {(s.vehiculo || s.tipoTrabajo || s.tipo) && (
          <div className="flex flex-wrap gap-2">
            {s.vehiculo && <span className="bg-zinc-100 text-zinc-800 text-sm font-bold px-4 py-1.5 rounded-full">🚛 {s.vehiculo}</span>}
            {(s.tipoTrabajo || s.tipo) && <span className="bg-zinc-900 text-white text-sm font-bold px-4 py-1.5 rounded-full">🔧 {s.tipoTrabajo || s.tipo}</span>}
          </div>
        )}

        {(s.origen || s.destino) ? (
          <div className="grid grid-cols-2 gap-3">
            {s.origen && <div className="bg-zinc-50 rounded-lg p-4"><p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-1">Origen (A)</p><p className="text-zinc-800 text-sm font-semibold">📍 {s.origen}</p></div>}
            {s.destino && <div className="bg-zinc-50 rounded-lg p-4"><p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-1">Destino (B)</p><p className="text-zinc-800 text-sm font-semibold">📍 {s.destino}</p></div>}
          </div>
        ) : s.direccion && (
          <div className="bg-zinc-50 rounded-lg p-4">
            <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-2">Dirección del servicio</p>
            <p className="text-zinc-800 text-sm font-semibold">📍 {s.direccion}</p>
          </div>
        )}

        {(s.metros || s.peso || s.bultos) && (
          <div className="bg-zinc-50 rounded-lg p-4">
            <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-3">Datos de carga</p>
            <div className="flex gap-6 flex-wrap">
              {s.metros && <div><p className="text-xs text-zinc-400">Metros descarga</p><p className="font-black text-zinc-900">{s.metros} m</p></div>}
              {s.peso   && <div><p className="text-xs text-zinc-400">Peso</p><p className="font-black text-zinc-900">{s.peso} kg</p></div>}
              {s.bultos && <div><p className="text-xs text-zinc-400">Nº bultos</p><p className="font-black text-zinc-900">{s.bultos}</p></div>}
            </div>
          </div>
        )}

        <div>
          <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-2">Descripción del servicio</p>
          <p className="text-zinc-700 text-sm leading-relaxed whitespace-pre-wrap">{s.descripcion || "—"}</p>
        </div>

        {s.precio && (
          <div className="bg-zinc-900 rounded-lg p-4 flex items-center justify-between">
            <p className="text-zinc-400 font-bold text-sm">PRECIO ESTIMADO</p>
            <p className="text-white font-black text-2xl">{Number(s.precio).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</p>
          </div>
        )}
      </div>
    </div>

    <div className="bg-white border-2 border-zinc-200 rounded-xl p-5 mb-4">
      <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-3">Enviar a administración</p>
      <div className="flex gap-3">
        <Btn size="lg" variant="whatsapp" className="flex-1" onClick={() => sendWhatsApp(s, config)}>💬 WhatsApp</Btn>
        <Btn size="lg" variant="email" className="flex-1" onClick={() => sendEmail(s, config)}>✉️ Email</Btn>
      </div>
    </div>

    <div className="flex gap-3 flex-wrap">
      <Btn size="md" variant="secondary" className="flex-1" onClick={onEdit}>✏️ Editar</Btn>
      <Btn size="md" variant="secondary" onClick={() => generatePDF(s, config)}>📄 PDF</Btn>
      <Btn size="md" variant="danger" onClick={onDelete}>🗑 Eliminar</Btn>
    </div>
  </div>
);

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const [authed, setAuthed]         = useState(isAuthenticated);
  const [config, setConfig]         = useState(null);
  const [solicitudes, setSolicitudes] = useState([]);
  const [screen, setScreen]         = useState("dashboard");
  const [editing, setEditing]       = useState(null);
  const [viewing, setViewing]       = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving]         = useState(false);

  // Cargar datos de Supabase al iniciar
  useEffect(() => {
    if (!authed) return;
    (async () => {
      setLoadingData(true);
      const [cfg, sols] = await Promise.all([dbLoadConfig(), dbLoadSolicitudes()]);
      setConfig(cfg);
      setSolicitudes(sols);
      setScreen(cfg ? "dashboard" : "config");
      setLoadingData(false);
    })();
  }, [authed]);

  const handleLogout = () => {
    localStorage.removeItem(AUTH_KEY);
    setAuthed(false);
  };

  const handleConfigSave = (cfg) => { setConfig(cfg); setScreen("dashboard"); };
  const handleNew        = () => { setEditing(null); setScreen("form"); };
  const handleEdit       = (b) => { setEditing(b); setScreen("form"); };
  const handleView       = (b) => { setViewing(b); setScreen("view"); };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar esta solicitud?")) return;
    await dbDeleteSolicitud(id);
    setSolicitudes((prev) => prev.filter((b) => b.id !== id));
    if (screen === "view") setScreen("dashboard");
  };

  const handleFormSave = async (form) => {
    setSaving(true);
    if (editing) {
      const updated = { ...editing, ...form };
      await dbUpdateSolicitud(updated);
      setSolicitudes((prev) => prev.map((b) => b.id === editing.id ? updated : b));
    } else {
      const nueva = { ...form, id: Date.now(), numero: nextNum(), fecha: today() };
      await dbSaveSolicitud(nueva);
      setSolicitudes((prev) => [nueva, ...prev]);
    }
    setSaving(false);
    setScreen("dashboard");
    setEditing(null);
  };

  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />;

  return (
    <div className="min-h-screen bg-zinc-50" style={{ backgroundImage: "radial-gradient(circle, #d4d4d4 1px, transparent 1px)", backgroundSize: "24px 24px" }}>
      {screen === "config" && <ConfigScreen initial={config} onSave={handleConfigSave} onLogout={handleLogout} />}
      {screen === "dashboard" && (
        <DashboardScreen
          solicitudes={solicitudes}
          loading={loadingData}
          onNew={handleNew}
          onView={handleView}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onConfig={() => setScreen("config")}
        />
      )}
      {screen === "form" && (
        <FormScreen initial={editing} config={config} onSave={handleFormSave} onCancel={() => setScreen("dashboard")} saving={saving} />
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
