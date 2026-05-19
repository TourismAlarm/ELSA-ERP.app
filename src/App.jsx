import { useState, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { supabase } from "./shared/lib/supabase";
import { LoginScreen, ConfigScreen, ClientesScreen } from "./screens";
import { DashboardScreen, FormScreen, ViewScreen } from "./modules/solicitudes/screens";
import { dbLoadSolicitudes, dbSaveSolicitud, dbUpdateSolicitud, dbDeleteSolicitud, dbLoadConfig, dbCambiarEstado, dbToggleAvisos, dbAddNota, dbLoadClientes, dbSaveCliente, dbUpdateCliente, dbDeleteCliente } from "./modules/solicitudes/db";
import { sendWhatsApp, sendEmail } from "./shared/lib/messaging";
import { generatePDF } from "./shared/lib/pdf";
import { today } from "./shared/lib/utils";
import { ROUTES } from "./router";

export default function App() {
  const navigate = useNavigate();
  const [session, setSession]         = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [config, setConfig]           = useState(null);
  const [solicitudes, setSolicitudes] = useState([]);
  const [clientes, setClientes]       = useState([]);
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
      navigate(cfg ? ROUTES.dashboard : ROUTES.config, { replace: true });
      setLoadingData(false);
    })();
  }, [sessionUserId]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setConfig(null);
    setSolicitudes([]);
  };

  const handleConfigSave = (cfg) => { setConfig(cfg); navigate(ROUTES.dashboard); };
  const handleNew        = () => { setEditing(null); navigate(ROUTES.solicitudNueva); };
  const handleEdit       = (b) => { setEditing(b); navigate(ROUTES.solicitudEditar(b.id)); };
  const handleView       = (b) => { setViewing(b); navigate(ROUTES.solicitudVer(b.id)); };

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
    navigate(ROUTES.dashboard, { replace: true });
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
      const nueva = { ...form, fecha: today() };
      const saved = await dbSaveSolicitud(nueva);
      setSaving(false);
      setEditing(null);
      if (saved) {
        setSolicitudes((prev) => [saved, ...prev]);
        handleView(saved);
      } else {
        navigate(ROUTES.dashboard);
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

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<LoginScreen onLogin={(s) => setSession(s)} />} />
        <Route path="*" element={<Navigate to={ROUTES.login} replace />} />
      </Routes>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50" style={{ backgroundImage: "radial-gradient(circle, #d4d4d4 1px, transparent 1px)", backgroundSize: "24px 24px" }}>
      <Routes>
        <Route path={ROUTES.config} element={
          <ConfigScreen initial={config} onSave={handleConfigSave} onLogout={handleLogout} onClientes={() => navigate(ROUTES.clientes)} />
        } />
        <Route path={ROUTES.clientes} element={
          <ClientesScreen clientes={clientes} onBack={() => navigate(ROUTES.config)} onNew={handleSaveCliente} onEdit={handleEditCliente} onDelete={handleDeleteCliente} />
        } />
        <Route path={ROUTES.dashboard} element={
          <DashboardScreen
            solicitudes={solicitudes}
            loading={loadingData}
            onNew={handleNew}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onConfig={() => navigate(ROUTES.config)}
            onCambiarEstado={handleCambiarEstado}
            onToggleAvisos={handleToggleAvisos}
          />
        } />
        <Route path={ROUTES.solicitudNueva} element={
          <FormScreen initial={null} config={config} clientes={clientes} onSave={handleFormSave} onSaveCliente={handleSaveCliente} onCancel={() => navigate(ROUTES.dashboard)} saving={saving} />
        } />
        <Route path="/solicitud/:id/editar" element={
          editing ? (
            <FormScreen initial={editing} config={config} clientes={clientes} onSave={handleFormSave} onSaveCliente={handleSaveCliente} onCancel={() => navigate(-1)} saving={saving} />
          ) : (
            <Navigate to={ROUTES.dashboard} replace />
          )
        } />
        <Route path="/solicitud/:id" element={
          viewing ? (
            <ViewScreen
              solicitud={viewing}
              config={config || {}}
              onEdit={() => handleEdit(viewing)}
              onDelete={() => handleDelete(viewing.id)}
              onBack={() => navigate(ROUTES.dashboard)}
              onSendWhatsApp={(s) => sendWhatsApp(s, config)}
              onSendEmail={(s) => sendEmail(s, config)}
              onGeneratePDF={(s) => generatePDF(s, config)}
              onCambiarEstado={handleCambiarEstado}
              onAddNota={handleAddNota}
            />
          ) : (
            <Navigate to={ROUTES.dashboard} replace />
          )
        } />
        <Route path="/login" element={<Navigate to={ROUTES.dashboard} replace />} />
        <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
      </Routes>
    </div>
  );
}
