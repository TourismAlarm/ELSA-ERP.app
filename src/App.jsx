import { useState, useEffect } from "react";
import { supabase } from "./shared/lib/supabase";
import { LoginScreen, ConfigScreen, ClientesScreen } from "./screens";
import { DashboardScreen, FormScreen, ViewScreen } from "./modules/solicitudes/screens";
import { ListScreen as ServiciosListScreen, FormScreen as ServicioFormScreen, ViewScreen as ServicioViewScreen, CalendarScreen } from "./modules/servicios/screens";
import { ListScreen as AlbaranesListScreen, FormScreen as AlbaranFormScreen, ViewScreen as AlbaranViewScreen } from "./modules/albaranes/screens";
import { dbLoadSolicitudes, dbSaveSolicitud, dbUpdateSolicitud, dbDeleteSolicitud, dbLoadConfig, dbCambiarEstado, dbToggleAvisos, dbAddNota, dbLoadClientes, dbSaveCliente, dbUpdateCliente, dbDeleteCliente } from "./modules/solicitudes/db";
import { dbLoadServicios, dbSaveServicio, dbUpdateServicio, dbDeleteServicio, dbCambiarEstadoServicio, dbAddNotaServicio } from "./modules/servicios/db";
import { dbLoadAlbaranes, dbSaveAlbaran, dbUpdateAlbaran, dbDeleteAlbaran, dbFirmarAlbaran } from "./modules/albaranes/db";
import { generateAlbaranPDF } from "./modules/albaranes/pdf";
import { sendWhatsApp, sendEmail } from "./shared/lib/messaging";
import { generatePDF } from "./shared/lib/pdf";
import { today } from "./shared/lib/utils";

export default function App() {
  const [session, setSession]         = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [config, setConfig]           = useState(null);
  const [solicitudes, setSolicitudes] = useState([]);
  const [servicios, setServicios]     = useState([]);
  const [albaranes, setAlbaranes]     = useState([]);
  const [clientes, setClientes]       = useState([]);
  const [screen, setScreen]           = useState("dashboard");
  const [editing, setEditing]         = useState(null);
  const [viewing, setViewing]         = useState(null);
  const [editingServicio, setEditingServicio] = useState(null);
  const [viewingServicio, setViewingServicio] = useState(null);
  const [editingAlbaran, setEditingAlbaran] = useState(null);
  const [viewingAlbaran, setViewingAlbaran] = useState(null);
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
      const [cfg, sols, srvs, albs, clts] = await Promise.all([dbLoadConfig(), dbLoadSolicitudes(), dbLoadServicios(), dbLoadAlbaranes(), dbLoadClientes()]);
      setConfig(cfg);
      setSolicitudes(sols);
      setServicios(srvs);
      setAlbaranes(albs);
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
    setServicios([]);
    setAlbaranes([]);
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

    // Al aceptar una solicitud, crear su servicio vinculado (si no existe ya)
    if (nuevoEstado === "aceptado" && !servicios.some((s) => s.solicitud_id === id)) {
      const sol = solicitudes.find((b) => b.id === id);
      if (!sol) return;
      const hoy = new Date().toISOString().slice(0, 10);
      const fecha = prompt("Fecha del servicio (AAAA-MM-DD):", hoy);
      if (!fecha || !fecha.trim()) {
        alert("Solicitud aceptada sin crear servicio. Puedes crearlo a mano desde la pestaña Servicios.");
        return;
      }
      const saved = await dbSaveServicio({
        cliente: sol.cliente,
        vehiculo: sol.vehiculo,
        origen: sol.origen,
        destino: sol.destino,
        descripcion: sol.descripcion,
        precio: sol.precio,
        fecha_servicio: fecha.trim(),
        solicitud_id: id,
      });
      if (saved) {
        setServicios((prev) => [saved, ...prev]);
        alert(`Solicitud aceptada. Servicio ${saved.numero} creado para el ${fecha.trim()}.`);
      }
    }
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
      const nueva = { ...form, fecha: today() };
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

  // ---- Servicios ----
  const handleServicioNew  = () => { setEditingServicio(null); setScreen("servicioForm"); };
  const handleServicioEdit = (s) => { setEditingServicio(s); setScreen("servicioForm"); };
  const handleServicioView = (s) => { setViewingServicio(s); setScreen("servicioView"); };

  const handleServicioCambiarEstado = async (id, nuevoEstado) => {
    await dbCambiarEstadoServicio(id, nuevoEstado);
    setServicios((prev) => prev.map((s) => s.id === id ? { ...s, estado: nuevoEstado } : s));
    setViewingServicio((prev) => prev && prev.id === id ? { ...prev, estado: nuevoEstado } : prev);
  };

  const handleServicioAddNota = async (id, texto) => {
    const nota = { tipo: "manual", fecha: new Date().toISOString(), texto };
    const updated = await dbAddNotaServicio(id, nota);
    if (updated) {
      setServicios((prev) => prev.map((s) => s.id === id ? { ...s, ...updated } : s));
      setViewingServicio((prev) => prev && prev.id === id ? { ...prev, ...updated } : prev);
    }
    return updated;
  };

  const handleServicioDelete = async (id) => {
    if (!confirm("¿Eliminar este servicio?")) return;
    await dbDeleteServicio(id);
    setServicios((prev) => prev.filter((s) => s.id !== id));
    if (screen === "servicioView") setScreen("servicios");
  };

  const handleServicioFormSave = async (form) => {
    setSaving(true);
    if (editingServicio) {
      const updated = { ...editingServicio, ...form };
      await dbUpdateServicio(updated);
      setServicios((prev) => prev.map((s) => s.id === editingServicio.id ? updated : s));
      setSaving(false);
      setEditingServicio(null);
      handleServicioView(updated);
    } else {
      const saved = await dbSaveServicio(form);
      setSaving(false);
      setEditingServicio(null);
      if (saved) {
        setServicios((prev) => [saved, ...prev]);
        handleServicioView(saved);
      } else {
        setScreen("servicios");
      }
    }
  };

  // ---- Albaranes ----
  const handleAlbaranNew  = () => { setEditingAlbaran(null); setScreen("albaranForm"); };
  const handleAlbaranEdit = (a) => { setEditingAlbaran(a); setScreen("albaranForm"); };
  const handleAlbaranView = (a) => { setViewingAlbaran(a); setScreen("albaranView"); };

  const handleAlbaranFirmar = async (id, firmaBase64, firmadoPor) => {
    const updated = await dbFirmarAlbaran(id, firmaBase64, firmadoPor);
    if (updated) {
      setAlbaranes((prev) => prev.map((a) => a.id === id ? { ...a, ...updated } : a));
      setViewingAlbaran((prev) => prev && prev.id === id ? { ...prev, ...updated } : prev);

      // La firma confirma que el trabajo está terminado:
      // cerrar automáticamente el servicio vinculado
      const albaran = albaranes.find((a) => a.id === id);
      const servicio = albaran?.servicio_id ? servicios.find((s) => s.id === albaran.servicio_id) : null;
      if (servicio && (servicio.estado || "abierto") !== "realizado") {
        await dbCambiarEstadoServicio(servicio.id, "realizado");
        setServicios((prev) => prev.map((s) => s.id === servicio.id ? { ...s, estado: "realizado" } : s));
        setViewingServicio((prev) => prev && prev.id === servicio.id ? { ...prev, estado: "realizado" } : prev);
      }
    }
    return updated;
  };

  const handleAlbaranDelete = async (id) => {
    if (!confirm("¿Eliminar este albarán?")) return;
    await dbDeleteAlbaran(id);
    setAlbaranes((prev) => prev.filter((a) => a.id !== id));
    if (screen === "albaranView") setScreen("albaranesList");
  };

  const handleCrearAlbaranDesdeServicio = async (servicio) => {
    const saved = await dbSaveAlbaran({
      cliente: servicio.cliente,
      fecha: servicio.fecha_servicio,
      descripcion: servicio.descripcion,
      servicio_id: servicio.id,
      lineas: [],
    });
    if (saved) {
      setAlbaranes((prev) => [saved, ...prev]);
      setViewingAlbaran(saved);
      setScreen("albaranView");
    }
  };

  const handleAlbaranFormSave = async (form) => {
    setSaving(true);
    if (editingAlbaran) {
      const updated = { ...editingAlbaran, ...form };
      await dbUpdateAlbaran(updated);
      setAlbaranes((prev) => prev.map((a) => a.id === editingAlbaran.id ? updated : a));
      setSaving(false);
      setEditingAlbaran(null);
      handleAlbaranView(updated);
    } else {
      const saved = await dbSaveAlbaran(form);
      setSaving(false);
      setEditingAlbaran(null);
      if (saved) {
        setAlbaranes((prev) => [saved, ...prev]);
        handleAlbaranView(saved);
      } else {
        setScreen("albaranesList");
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
      {/* Navegación principal */}
      {(screen === "dashboard" || screen === "servicios" || screen === "albaranesList" || screen === "calendario") && (
        <div className="max-w-2xl mx-auto px-4 pt-6 -mb-4">
          <div className="flex gap-1.5 bg-white border-2 border-zinc-200 rounded-xl p-1.5">
            <button
              onClick={() => setScreen("dashboard")}
              className={`flex-1 py-3.5 text-base font-black rounded-lg transition-colors ${
                screen === "dashboard" ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
            >
              📋 Solicitudes
            </button>
            <button
              onClick={() => setScreen("servicios")}
              className={`flex-1 py-3.5 text-base font-black rounded-lg transition-colors ${
                screen === "servicios" ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
            >
              🔧 Servicios
            </button>
            <button
              onClick={() => setScreen("albaranesList")}
              className={`flex-1 py-3.5 text-base font-black rounded-lg transition-colors ${
                screen === "albaranesList" ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
            >
              📝 Albaranes
            </button>
            <button
              onClick={() => setScreen("calendario")}
              className={`flex-1 py-3.5 text-base font-black rounded-lg transition-colors ${
                screen === "calendario" ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
            >
              📅 Calendario
            </button>
          </div>
        </div>
      )}
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
          servicioVinculado={servicios.find((s) => s.solicitud_id === viewing.id) || null}
          onVerServicio={handleServicioView}
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
      {screen === "servicios" && (
        <ServiciosListScreen
          servicios={servicios}
          loading={loadingData}
          onNew={handleServicioNew}
          onView={handleServicioView}
          onEdit={handleServicioEdit}
          onDelete={handleServicioDelete}
          onConfig={() => setScreen("config")}
          onCambiarEstado={handleServicioCambiarEstado}
        />
      )}
      {screen === "servicioForm" && (
        <ServicioFormScreen initial={editingServicio} config={config} clientes={clientes} onSave={handleServicioFormSave} onSaveCliente={handleSaveCliente} onCancel={() => setScreen("servicios")} saving={saving} />
      )}
      {screen === "servicioView" && viewingServicio && (
        <ServicioViewScreen
          servicio={viewingServicio}
          config={config || {}}
          solicitudOrigen={viewingServicio.solicitud_id ? solicitudes.find((b) => b.id === viewingServicio.solicitud_id) || null : null}
          onVerSolicitud={handleView}
          albaranVinculado={albaranes.find((a) => a.servicio_id === viewingServicio.id) || null}
          onVerAlbaran={handleAlbaranView}
          onEdit={() => handleServicioEdit(viewingServicio)}
          onDelete={() => handleServicioDelete(viewingServicio.id)}
          onBack={() => setScreen("servicios")}
          onCambiarEstado={handleServicioCambiarEstado}
          onAddNota={handleServicioAddNota}
        />
      )}
      {screen === "calendario" && (
        <CalendarScreen
          servicios={servicios}
          albaranes={albaranes}
          onViewServicio={handleServicioView}
          onViewAlbaran={handleAlbaranView}
          onCrearAlbaran={handleCrearAlbaranDesdeServicio}
          onConfig={() => setScreen("config")}
        />
      )}
      {screen === "albaranesList" && (
        <AlbaranesListScreen
          albaranes={albaranes}
          loading={loadingData}
          onNew={handleAlbaranNew}
          onView={handleAlbaranView}
          onEdit={handleAlbaranEdit}
          onDelete={handleAlbaranDelete}
          onConfig={() => setScreen("config")}
        />
      )}
      {screen === "albaranForm" && (
        <AlbaranFormScreen initial={editingAlbaran} clientes={clientes} onSave={handleAlbaranFormSave} onCancel={() => setScreen("albaranesList")} saving={saving} />
      )}
      {screen === "albaranView" && viewingAlbaran && (
        <AlbaranViewScreen
          albaran={viewingAlbaran}
          config={config || {}}
          servicioVinculado={viewingAlbaran.servicio_id ? servicios.find((s) => s.id === viewingAlbaran.servicio_id) || null : null}
          onVerServicio={handleServicioView}
          solicitudVinculada={viewingAlbaran.solicitud_id ? solicitudes.find((b) => b.id === viewingAlbaran.solicitud_id) || null : null}
          onVerSolicitud={handleView}
          onEdit={() => handleAlbaranEdit(viewingAlbaran)}
          onDelete={() => handleAlbaranDelete(viewingAlbaran.id)}
          onBack={() => setScreen("albaranesList")}
          onFirmar={handleAlbaranFirmar}
          onGeneratePDF={(a) => generateAlbaranPDF(a, config || {})}
        />
      )}
    </div>
  );
}
