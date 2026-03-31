import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { LoginScreen, ConfigScreen, DashboardScreen, FormScreen, ViewScreen, ClientesScreen } from "./screens";
import { dbLoadSolicitudes, dbSaveSolicitud, dbUpdateSolicitud, dbDeleteSolicitud, dbLoadConfig, dbCambiarEstado, dbToggleAvisos, dbAddNota, dbLoadClientes, dbSaveCliente, dbUpdateCliente, dbDeleteCliente } from "./lib/db";
import { sendWhatsApp, sendEmail } from "./lib/messaging";
import { generatePDF } from "./lib/pdf";
import { today, nextNum } from "./lib/utils";

export default function App() {
  const [session, setSession]         = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [config, setConfig]           = useState(null);
  const [solicitudes, setSolicitudes] = useState([]);
  const [clientes, setClientes]       = useState([]);
  const [screen, setScreen]           = useState("dashboard");
  const [editing, setEditing]         = useState(null);
  const [viewing, setViewing]         = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving]           = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingAuth(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const sessionUserId = session?.user?.id;

  useEffect(() => {
    if (!sessionUserId) return;
    (async () => {
      setLoadingData(true);
      const [cfg, sols, clts] = await Promise.all([dbLoadConfig(), dbLoadSolicitudes(), dbLoadClientes()]);
      setConfig(cfg);
      setSolicitudes(sols);
      setClientes(clts);
      setScreen(cfg ? "dashboard" : "config");
      setLoadingData(false);
    })();
  }, [sessionUserId]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setConfig(null);
    setSolicitudes([]);
    setScreen("dashboard");
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

  const handleSaveCliente = async (cliente) => {
    const saved = await dbSaveCliente(cliente);
    if (saved) setClientes((prev) => [...prev, saved].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    return saved;
  };

  const handleEditCliente = async (id, datos) => {
    await dbUpdateCliente({ id, ...datos });
    setClientes((prev) => prev.map((c) => c.id === id ? { ...c, ...datos } : c));
  };

  const handleDeleteCliente = async (id) => {
    if (!confirm("¿Eliminar este cliente?")) return;
    await dbDeleteCliente(id);
    setClientes((prev) => prev.filter((c) => c.id !== id));
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
      setSaving(false);
      setEditing(null);
      handleView(updated);
    } else {
      const nueva = { ...form, numero: nextNum(), fecha: today() };
      const saved = await dbSaveSolicitud(nueva);
      setSaving(false);
      setEditing(null);
      if (saved) {
        setSolicitudes((prev) => [saved, ...prev]);
        handleView(saved);
      } else {
        setScreen("dashboard");
      }
    }
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="text-center">
          <div className="text-5xl mb-3">🏗️</div>
          <p className="text-zinc-400 font-semibold">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!session) return <LoginScreen onLogin={(s) => setSession(s)} />;

  return (
    <div className="min-h-screen bg-zinc-50" style={{ backgroundImage: "radial-gradient(circle, #d4d4d4 1px, transparent 1px)", backgroundSize: "24px 24px" }}>
      {screen === "config" && <ConfigScreen initial={config} onSave={handleConfigSave} onLogout={handleLogout} onClientes={() => setScreen("clientes")} />}
      {screen === "clientes" && <ClientesScreen clientes={clientes} onBack={() => setScreen("config")} onNew={handleSaveCliente} onEdit={handleEditCliente} onDelete={handleDeleteCliente} />}
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
        <FormScreen initial={editing} config={config} clientes={clientes} onSave={handleFormSave} onSaveCliente={handleSaveCliente} onCancel={() => setScreen("dashboard")} saving={saving} />
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
