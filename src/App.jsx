import { useState, useEffect } from "react";
import { LoginScreen, ConfigScreen, DashboardScreen, FormScreen, ViewScreen } from "./screens";
import { isAuthenticated, AUTH_KEY } from "./screens/LoginScreen";
import { dbLoadSolicitudes, dbSaveSolicitud, dbUpdateSolicitud, dbDeleteSolicitud, dbLoadConfig, dbCambiarEstado, dbToggleAvisos, dbAddNota } from "./lib/db";
import { sendWhatsApp, sendEmail } from "./lib/messaging";
import { generatePDF } from "./lib/pdf";
import { today, nextNum } from "./lib/utils";

export default function App() {
  const [authed, setAuthed]           = useState(isAuthenticated);
  const [config, setConfig]           = useState(null);
  const [solicitudes, setSolicitudes] = useState([]);
  const [screen, setScreen]           = useState("dashboard");
  const [editing, setEditing]         = useState(null);
  const [viewing, setViewing]         = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving]           = useState(false);

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

  const handleCambiarEstado = async (id, nuevoEstado) => {
    await dbCambiarEstado(id, nuevoEstado);
    const now = new Date().toISOString();
    setSolicitudes((prev) => prev.map((b) => b.id === id ? { ...b, estado: nuevoEstado, fecha_ultimo_contacto: now } : b));
    setViewing((prev) => prev && prev.id === id ? { ...prev, estado: nuevoEstado, fecha_ultimo_contacto: now } : prev);
  };

  const handleAddNota = async (id, texto) => {
    const nota = { tipo: "manual", fecha: new Date().toISOString(), texto };
    const updated = await dbAddNota(id, nota);
    if (updated) {
      setSolicitudes((prev) => prev.map((b) => b.id === id ? { ...b, ...updated } : b));
      setViewing((prev) => prev && prev.id === id ? { ...prev, ...updated } : prev);
    }
    return updated;
  };

  const handleToggleAvisos = async (id, valor) => {
    await dbToggleAvisos(id, valor);
    setSolicitudes((prev) => prev.map((b) => b.id === id ? { ...b, avisos_activos: valor } : b));
  };

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
      const nueva = { ...form, numero: nextNum(), fecha: today() };
      const saved = await dbSaveSolicitud(nueva);
      if (saved) setSolicitudes((prev) => [saved, ...prev]);
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
          onCambiarEstado={handleCambiarEstado}
          onToggleAvisos={handleToggleAvisos}
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
          onSendWhatsApp={(s) => sendWhatsApp(s, config)}
          onSendEmail={(s) => sendEmail(s, config)}
          onGeneratePDF={(s) => generatePDF(s, config)}
          onCambiarEstado={handleCambiarEstado}
          onAddNota={handleAddNota}
        />
      )}
    </div>
  );
}
