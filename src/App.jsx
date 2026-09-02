import { useState, useEffect, useCallback } from "react";
import { supabase } from "./shared/lib/supabase";
import { LoginScreen, ResetPasswordScreen, ConfigScreen, ClientesScreen, ImportarClientesScreen } from "./screens";
import { DashboardScreen, FormScreen, ViewScreen } from "./modules/solicitudes/screens";
import { ListScreen as ServiciosListScreen, FormScreen as ServicioFormScreen, ViewScreen as ServicioViewScreen, CalendarScreen } from "./modules/servicios/screens";
import { ListScreen as AlbaranesListScreen, FormScreen as AlbaranFormScreen, ViewScreen as AlbaranViewScreen } from "./modules/albaranes/screens";
import { ListScreen as FlotaListScreen, FormScreen as VehiculoFormScreen, ViewScreen as VehiculoViewScreen } from "./modules/flota/screens";
import { dbLoadSolicitudes, dbSaveSolicitud, dbUpdateSolicitud, dbDeleteSolicitud, dbLoadConfig, dbCambiarEstado, dbToggleAvisos, dbAddNota, dbLoadClientes, dbSaveCliente, dbUpdateCliente, dbDeleteCliente, dbImportarClientes } from "./modules/solicitudes/db";
import { dbLoadServicios, dbSaveServicio, dbUpdateServicio, dbDeleteServicio, dbCambiarEstadoServicio, dbAddNotaServicio } from "./modules/servicios/db";
import { dbLoadAlbaranes, dbSaveAlbaran, dbUpdateAlbaran, dbDeleteAlbaran, dbFirmarAlbaran, dbDesvincularAlbaranesDeServicio } from "./modules/albaranes/db";
import { dbLoadVehiculos, dbSaveVehiculo, dbUpdateVehiculo, dbDeleteVehiculo } from "./modules/flota/db";
import { dbLoadEventos, dbSaveEvento, dbUpdateEvento, dbDeleteEvento } from "./modules/eventos/db";
import { sendServicioEmail } from "./modules/servicios/messaging";
import { sendWhatsApp, sendEmail } from "./shared/lib/messaging";
import { FechaServicioModal, BotonRefrescar, EventoModal } from "./shared/components/ui";
import { conDatosDelCliente, fichaDelCliente } from "./shared/lib/clientes";
import { mapaColoresVehiculo, normalizeVehiculos } from "./shared/lib/color";
import { DEFAULT_VEHICLES } from "./shared/lib/constants";
import { today } from "./shared/lib/utils";

const PESTANAS = [
  { id: "dashboard",     emoji: "📋", texto: "Solicitudes" },
  { id: "servicios",     emoji: "🔧", texto: "Servicios" },
  { id: "albaranesList", emoji: "📝", texto: "Albaranes" },
  { id: "calendario",    emoji: "📅", texto: "Calendario" },
  { id: "flota",         emoji: "🚚", texto: "Flota" },
];

// El enlace de recuperación del correo vuelve a la app con type=recovery,
// en el hash (flujo implícito) o en la query (flujo PKCE).
const esUrlDeRecuperacion = () => {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  return hash.get("type") === "recovery" || query.get("type") === "recovery";
};

export default function App() {
  const [session, setSession]         = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [recovery, setRecovery]       = useState(esUrlDeRecuperacion);
  const [config, setConfig]           = useState(null);
  const [solicitudes, setSolicitudes] = useState([]);
  const [servicios, setServicios]     = useState([]);
  const [albaranes, setAlbaranes]     = useState([]);
  const [clientes, setClientes]       = useState([]);
  const [screen, setScreen]           = useState("dashboard");
  const [editing, setEditing]         = useState(null);
  const [viewing, setViewing]         = useState(null);
  const [editingServicio, setEditingServicio] = useState(null);
  const [prefillServicio, setPrefillServicio] = useState(null);
  const [viewingServicio, setViewingServicio] = useState(null);
  const [editingAlbaran, setEditingAlbaran] = useState(null);
  const [viewingAlbaran, setViewingAlbaran] = useState(null);
  const [vehiculos, setVehiculos] = useState([]);
  const [eventos, setEventos] = useState([]);
  // Evento del calendario que se está creando o editando: { evento?, fecha }
  const [editandoEvento, setEditandoEvento] = useState(null);
  const [editingVehiculo, setEditingVehiculo] = useState(null);
  const [viewingVehiculo, setViewingVehiculo] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving]           = useState(false);
  const [errorCarga, setErrorCarga]   = useState(false);
  const [pidiendoFechaServicio, setPidiendoFechaServicio] = useState(null);
  const [refrescando, setRefrescando] = useState(false);
  const [configError, setConfigError] = useState(false);

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data }) => setSession(data?.session ?? null))
      .catch(() => setSession(null))
      .finally(() => setLoadingAuth(false));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const sessionUserId = session?.user?.id;

  // Las cargas devuelven null cuando fallan: hay que distinguir "no hay nada
  // guardado" de "no se ha podido leer", porque la segunda no debe vaciar la
  // pantalla en silencio ni llevar a la configuración vacía.
  // `inicial` distingue el arranque del refresco a mano. En el refresco no se
  // toca `loadingData`, porque las listas se sustituyen por un cargando y se
  // verían parpadear, ni se cambia de pantalla: te quedas donde estabas.
  const cargarDatos = useCallback(async ({ inicial = false } = {}) => {
    if (inicial) setLoadingData(true); else setRefrescando(true);

    const [cfgRes, sols, srvs, albs, vhcs, clts, evts] = await Promise.all([dbLoadConfig(), dbLoadSolicitudes(), dbLoadServicios(), dbLoadAlbaranes(), dbLoadVehiculos(), dbLoadClientes(), dbLoadEventos()]);
    const falloAlguna = [sols, srvs, albs, vhcs, clts, evts].some((x) => x === null) || cfgRes.error;
    setConfig(cfgRes.config);
    setConfigError(cfgRes.error);
    setErrorCarga(falloAlguna);
    setSolicitudes(sols ?? []);
    setServicios(srvs ?? []);
    setAlbaranes(albs ?? []);
    setVehiculos(vhcs ?? []);
    setClientes(clts ?? []);
    setEventos(evts ?? []);

    // Si estás mirando una ficha, que se actualice también: si no, refrescar
    // cambiaría la lista pero dejaría delante la versión vieja del documento
    const refrescaFicha = (lista) => (prev) => (prev ? (lista ?? []).find((x) => x.id === prev.id) || prev : prev);
    setViewing(refrescaFicha(sols));
    setViewingServicio(refrescaFicha(srvs));
    setViewingAlbaran(refrescaFicha(albs));
    setViewingVehiculo(refrescaFicha(vhcs));

    if (inicial) {
      // Solo llevar a Configuración cuando sabemos con certeza que no hay ninguna
      setScreen(cfgRes.config || cfgRes.error ? "dashboard" : "config");
      setLoadingData(false);
    } else {
      setRefrescando(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionUserId) return;
    (async () => { await cargarDatos({ inicial: true }); })();
  }, [sessionUserId, cargarDatos]);

  // Quita los tokens del enlace de recuperación de la barra de direcciones
  const limpiarUrlRecuperacion = () => {
    window.history.replaceState({}, "", window.location.pathname);
  };

  const handleRecoveryDone = () => {
    limpiarUrlRecuperacion();
    setRecovery(false);
  };

  const handleRecoveryCancel = async () => {
    limpiarUrlRecuperacion();
    setRecovery(false);
    await supabase.auth.signOut();
    setSession(null);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setConfig(null);
    setSolicitudes([]);
    setServicios([]);
    setAlbaranes([]);
    setVehiculos([]);
    setEventos([]);
    setErrorCarga(false);
    setConfigError(false);
    setRefrescando(false);
    setScreen("dashboard");
  };

  // El generador de PDF (jspdf) son unos 700 KB que solo hacen falta cuando
  // alguien pulsa el botón, así que se carga en ese momento y no en el arranque
  const pdfSolicitud = async (s) => {
    const { generatePDF } = await import("./shared/lib/pdf");
    generatePDF(conCliente(s), config);
  };

  const pdfServicio = async (s) => {
    const { generateServicioPDF } = await import("./shared/lib/pdf");
    generateServicioPDF(conCliente(s), config);
  };

  // Ni solicitudes ni servicios ni albaranes guardan el NIF, la dirección de
  // facturación, el teléfono ni el email: son del cliente, no del documento, y
  // no existen como columnas. Se rellenan desde su ficha justo antes de
  // enseñarlos o imprimirlos, así que ya no se pierden al salir y volver.
  const conCliente = (doc) => conDatosDelCliente(doc, clientes);

  // La ficha entera del cliente, para el número y el nombre comercial, que el
  // documento no guarda
  const fichaCliente = (doc) => fichaDelCliente(doc, clientes);

  const servicioDeAlbaran = (a) => (a.servicio_id ? servicios.find((s) => s.id === a.servicio_id) || null : null);

  // El albarán guarda el nombre del cliente, no su id, así que la ficha se
  // busca por nombre para poder poner el nº de cliente en el PDF
  const clienteDeAlbaran = (a) =>
    clientes.find((c) => (c.nombre || "").trim().toLowerCase() === (a.cliente || "").trim().toLowerCase()) || null;

  const pdfAlbaran = async (a) => {
    const { generateAlbaranPDF } = await import("./modules/albaranes/pdf");
    generateAlbaranPDF(a, config || {}, servicioDeAlbaran(a), clienteDeAlbaran(a));
  };

  const compartirAlbaran = async (a) => {
    const { shareAlbaranPDF } = await import("./modules/albaranes/pdf");
    await shareAlbaranPDF(a, config || {}, servicioDeAlbaran(a), clienteDeAlbaran(a));
  };

  const handleConfigSave = (cfg) => { setConfig(cfg); setScreen("dashboard"); };
  const handleNew        = () => { setEditing(null); setScreen("form"); };
  const handleEdit       = (b) => { setEditing(b); setScreen("form"); };
  const handleView       = (b) => { setViewing(b); setScreen("view"); };

  const handleCambiarEstado = async (id, nuevoEstado) => {
    if (!await dbCambiarEstado(id, nuevoEstado)) return false;
    const now = new Date().toISOString();
    setSolicitudes((prev) => prev.map((b) => b.id === id ? { ...b, estado: nuevoEstado, fecha_ultimo_contacto: now } : b));
    setViewing((prev) => prev && prev.id === id ? { ...prev, estado: nuevoEstado, fecha_ultimo_contacto: now } : prev);

    // Al aceptar una solicitud, crear su servicio vinculado (si no existe ya)
    if (nuevoEstado === "aceptado" && !servicios.some((s) => s.solicitud_id === id)) {
      const sol = solicitudes.find((b) => b.id === id);
      // El diálogo pide la fecha con un calendario de verdad, en vez del
      // prompt() del navegador, que en el móvil es incómodo y no valida nada
      if (sol) setPidiendoFechaServicio(sol);
    }
    return true;
  };

  const crearServicioDesdeSolicitud = async ({ fecha, hora_inicio, hora_fin }) => {
    const sol = pidiendoFechaServicio;
    setPidiendoFechaServicio(null);
    if (!sol) return;
    const saved = await dbSaveServicio({
      cliente: sol.cliente,
      cliente_id: sol.cliente_id ?? null,
      vehiculo: sol.vehiculo,
      origen: sol.origen,
      destino: sol.destino,
      descripcion: sol.descripcion,
      precio: sol.precio,
      fecha_servicio: fecha,
      hora_inicio,
      hora_fin,
      solicitud_id: sol.id,
    });
    if (saved) {
      setServicios((prev) => [saved, ...prev]);
      handleServicioView(saved);
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
    if (!await dbUpdateCliente({ id, ...datos })) return false;
    setClientes((prev) => prev.map((c) => c.id === id ? { ...c, ...datos } : c));
    return true;
  };

  const handleImportarClientes = async (nuevos) => {
    const { creados, fallidos } = await dbImportarClientes(nuevos);
    if (creados.length > 0) {
      setClientes((prev) => [...prev, ...creados].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    }
    return { creados: creados.length, fallidos };
  };

  const handleDeleteCliente = async (id) => {
    if (!confirm("¿Eliminar este cliente?")) return;
    if (!await dbDeleteCliente(id)) return;
    setClientes((prev) => prev.filter((c) => c.id !== id));
  };

  const handleToggleAvisos = async (id, valor) => {
    if (!await dbToggleAvisos(id, valor)) return;
    setSolicitudes((prev) => prev.map((b) => b.id === id ? { ...b, avisos_activos: valor } : b));
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar esta solicitud?")) return;
    if (!await dbDeleteSolicitud(id)) return;
    setSolicitudes((prev) => prev.filter((b) => b.id !== id));
    if (screen === "view") setScreen("dashboard");
  };

  const handleFormSave = async (form) => {
    setSaving(true);
    if (editing) {
      const updated = { ...editing, ...form };
      const ok = await dbUpdateSolicitud(updated);
      setSaving(false);
      if (!ok) return; // el aviso ya se ha mostrado; se queda en el formulario
      setSolicitudes((prev) => prev.map((b) => b.id === editing.id ? updated : b));
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
  const handleServicioNew  = () => { setEditingServicio(null); setPrefillServicio(null); setScreen("servicioForm"); };

  // Alta desde el calendario: fecha (y hora, si se tocó una franja) precargadas
  const handleNuevoServicioEnHora = (fechaISO, hora) => {
    setEditingServicio(null);
    setPrefillServicio(hora ? { fecha_servicio: fechaISO, hora_inicio: hora } : { fecha_servicio: fechaISO });
    setScreen("servicioForm");
  };
  const handleServicioEdit = (s) => { setEditingServicio(s); setScreen("servicioForm"); };
  const handleServicioView = (s) => { setViewingServicio(s); setScreen("servicioView"); };

  // Mover un servicio arrastrándolo en el calendario (cambia fecha y/u horas)
  const handleMoverServicio = async (servicio, fecha_servicio, hora_inicio, hora_fin) => {
    const updated = { ...servicio, fecha_servicio, hora_inicio, hora_fin };
    if (!await dbUpdateServicio(updated)) return;
    setServicios((prev) => prev.map((s) => s.id === servicio.id ? updated : s));
    setViewingServicio((prev) => prev && prev.id === servicio.id ? { ...prev, fecha_servicio, hora_inicio, hora_fin } : prev);
  };

  const handleServicioCambiarEstado = async (id, nuevoEstado) => {
    if (!await dbCambiarEstadoServicio(id, nuevoEstado)) return false;
    setServicios((prev) => prev.map((s) => s.id === id ? { ...s, estado: nuevoEstado } : s));
    setViewingServicio((prev) => prev && prev.id === id ? { ...prev, estado: nuevoEstado } : prev);
    return true;
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
    // La FK de albaranes.servicio_id impide borrar un servicio con albaranes:
    // avisar y desvincularlos primero (los albaranes no se borran)
    const vinculados = albaranes.filter((a) => a.servicio_id === id);
    if (vinculados.length > 0) {
      const nums = vinculados.map((a) => a.numero).join(", ");
      const plural = vinculados.length !== 1;
      if (!confirm(`Este servicio tiene ${vinculados.length} albarán${plural ? "es" : ""} vinculado${plural ? "s" : ""} (${nums}). Se desvincular${plural ? "án" : "á"} (no se borra${plural ? "n" : ""}) y después se eliminará el servicio. ¿Continuar?`)) return;
      const okDesvincular = await dbDesvincularAlbaranesDeServicio(id);
      if (!okDesvincular) return;
      setAlbaranes((prev) => prev.map((a) => a.servicio_id === id ? { ...a, servicio_id: null } : a));
    } else if (!confirm("¿Eliminar este servicio?")) {
      return;
    }
    const ok = await dbDeleteServicio(id);
    if (!ok) return; // si la BD rechaza el borrado, no lo quitamos de pantalla
    setServicios((prev) => prev.filter((s) => s.id !== id));
    if (screen === "servicioView") setScreen("servicios");
  };

  const handleServicioFormSave = async (form) => {
    setSaving(true);
    if (editingServicio) {
      const updated = { ...editingServicio, ...form };
      const ok = await dbUpdateServicio(updated);
      setSaving(false);
      if (!ok) return;
      setServicios((prev) => prev.map((s) => s.id === editingServicio.id ? updated : s));
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
    if (!await dbDeleteAlbaran(id)) return;
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

  // ---- Eventos del calendario (lo que no es un servicio) ----
  const handleGuardarEvento = async (evento) => {
    if (evento.id) {
      if (!await dbUpdateEvento(evento)) return;
      setEventos((prev) => prev.map((e) => e.id === evento.id ? { ...e, ...evento } : e));
    } else {
      const saved = await dbSaveEvento(evento);
      if (!saved) return;
      setEventos((prev) => [...prev, saved]);
    }
    setEditandoEvento(null);
  };

  const handleBorrarEvento = async (id) => {
    if (!await dbDeleteEvento(id)) return;
    setEventos((prev) => prev.filter((e) => e.id !== id));
    setEditandoEvento(null);
  };

  // ---- Flota ----
  const handleVehiculoNew  = () => { setEditingVehiculo(null); setScreen("vehiculoForm"); };
  const handleVehiculoEdit = (v) => { setEditingVehiculo(v); setScreen("vehiculoForm"); };
  const handleVehiculoView = (v) => { setViewingVehiculo(v); setScreen("vehiculoView"); };

  const handleVehiculoDelete = async (id) => {
    if (!confirm("¿Eliminar este vehículo?")) return;
    if (!await dbDeleteVehiculo(id)) return;
    setVehiculos((prev) => prev.filter((v) => v.id !== id));
    if (screen === "vehiculoView") setScreen("flota");
  };

  const handleVehiculoFormSave = async (form) => {
    setSaving(true);
    if (editingVehiculo) {
      const updated = { ...editingVehiculo, ...form };
      const ok = await dbUpdateVehiculo(updated);
      setSaving(false);
      if (!ok) return;
      setVehiculos((prev) => prev.map((v) => v.id === editingVehiculo.id ? updated : v).sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "")));
      setEditingVehiculo(null);
      handleVehiculoView(updated);
    } else {
      const saved = await dbSaveVehiculo(form);
      setSaving(false);
      setEditingVehiculo(null);
      if (saved) {
        setVehiculos((prev) => [...prev, saved].sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "")));
        handleVehiculoView(saved);
      } else {
        setScreen("flota");
      }
    }
  };

  const handleAlbaranFormSave = async (form) => {
    setSaving(true);
    if (editingAlbaran) {
      const updated = { ...editingAlbaran, ...form };
      const ok = await dbUpdateAlbaran(updated);
      setSaving(false);
      if (!ok) return;
      setAlbaranes((prev) => prev.map((a) => a.id === editingAlbaran.id ? updated : a));
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

  if (recovery) return <ResetPasswordScreen onDone={handleRecoveryDone} onCancel={handleRecoveryCancel} />;

  if (!session) return <LoginScreen onLogin={(s) => setSession(s)} />;

  // Mapa nombre de vehículo/equipo -> color, para pintar servicios y calendario
  const coloresVehiculo = mapaColoresVehiculo(config?.vehicles);

  return (
    <div className="min-h-screen bg-zinc-50" style={{ backgroundImage: "radial-gradient(circle, #d4d4d4 1px, transparent 1px)", backgroundSize: "24px 24px" }}>
      {/* Aviso de datos no cargados: sin esto una lista vacía por falta de red
          parece una lista vacía de verdad, y se acaba duplicando el trabajo */}
      {errorCarga && !loadingData && (
        <div className="max-w-2xl mx-auto px-4 pt-6">
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-start gap-3">
            <span className="text-xl leading-none">⚠️</span>
            <div className="flex-1">
              <p className="text-sm font-black text-red-800">No se han podido cargar todos los datos</p>
              <p className="text-xs text-red-700 mt-0.5">Puede faltar información en las listas. No crees nada nuevo hasta que se recupere, o lo duplicarás.</p>
            </div>
            <button
              onClick={() => cargarDatos()}
              className="text-xs font-black text-red-800 hover:text-red-950 underline underline-offset-2 shrink-0 pt-0.5"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      {!loadingData && <BotonRefrescar onRefrescar={() => cargarDatos()} refrescando={refrescando} />}

      {editandoEvento && (
        <EventoModal
          inicial={editandoEvento.evento}
          fecha={editandoEvento.fecha}
          vehiculos={vehiculos}
          onGuardar={handleGuardarEvento}
          onBorrar={handleBorrarEvento}
          onCancelar={() => setEditandoEvento(null)}
        />
      )}

      {pidiendoFechaServicio && (
        <FechaServicioModal
          solicitud={pidiendoFechaServicio}
          servicios={servicios}
          eventos={eventos}
          vehiculos={normalizeVehiculos(config?.vehicles ?? DEFAULT_VEHICLES)}
          onConfirmar={crearServicioDesdeSolicitud}
          onCancelar={() => setPidiendoFechaServicio(null)}
        />
      )}

      {/* Navegación principal. Cinco pestañas con texto no caben en un móvil de
          375px, así que en pantalla estrecha se queda el icono y el texto solo
          aparece en la pestaña activa. */}
      {(screen === "dashboard" || screen === "servicios" || screen === "albaranesList" || screen === "calendario" || screen === "flota") && (
        <div className="max-w-2xl mx-auto px-4 pt-6 -mb-4">
          <div className="flex gap-1 bg-white border-2 border-zinc-200 rounded-xl p-1.5">
            {PESTANAS.map((p) => {
              const activa = screen === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setScreen(p.id)}
                  aria-label={p.texto}
                  aria-current={activa ? "page" : undefined}
                  className={`flex items-center justify-center gap-1.5 py-3.5 px-2 text-base font-black rounded-lg transition-colors ${
                    activa ? "bg-zinc-900 text-white flex-[2]" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 flex-1"
                  }`}
                >
                  <span aria-hidden="true">{p.emoji}</span>
                  <span className={activa ? "text-sm" : "hidden sm:inline text-sm"}>{p.texto}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {screen === "config" && <ConfigScreen initial={config} cargaFallida={configError} onSave={handleConfigSave} onLogout={handleLogout} onClientes={() => setScreen("clientes")} />}
      {screen === "clientes" && <ClientesScreen clientes={clientes} onBack={() => setScreen("config")} onNew={handleSaveCliente} onEdit={handleEditCliente} onDelete={handleDeleteCliente} onImportar={() => setScreen("importarClientes")} />}
      {screen === "importarClientes" && <ImportarClientesScreen clientes={clientes} onImportar={handleImportarClientes} onBack={() => setScreen("clientes")} />}
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
        <FormScreen initial={conCliente(editing)} config={config} clientes={clientes} onSave={handleFormSave} onSaveCliente={handleSaveCliente} onCancel={() => setScreen("dashboard")} saving={saving} />
      )}
      {screen === "view" && viewing && (
        <ViewScreen
          solicitud={conCliente(viewing)}
          cliente={fichaCliente(viewing)}
          config={config || {}}
          servicioVinculado={servicios.find((s) => s.solicitud_id === viewing.id) || null}
          onVerServicio={handleServicioView}
          onEdit={() => handleEdit(viewing)}
          onDelete={() => handleDelete(viewing.id)}
          onBack={() => setScreen("dashboard")}
          onSendWhatsApp={(s) => sendWhatsApp(s, config)}
          onSendEmail={(s) => sendEmail(s, config)}
          onGeneratePDF={pdfSolicitud}
          onCambiarEstado={handleCambiarEstado}
          onAddNota={handleAddNota}
        />
      )}
      {screen === "servicios" && (
        <ServiciosListScreen
          servicios={servicios}
          coloresVehiculo={coloresVehiculo}
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
        <ServicioFormScreen initial={conCliente(editingServicio)} prefill={prefillServicio} config={config} clientes={clientes} servicios={servicios} eventos={eventos} onSave={handleServicioFormSave} onSaveCliente={handleSaveCliente} onCancel={() => setScreen("servicios")} saving={saving} />
      )}
      {screen === "servicioView" && viewingServicio && (
        <ServicioViewScreen
          servicio={conCliente(viewingServicio)}
          cliente={fichaCliente(viewingServicio)}
          onGeneratePDF={pdfServicio}
          config={config || {}}
          solicitudOrigen={viewingServicio.solicitud_id ? solicitudes.find((b) => b.id === viewingServicio.solicitud_id) || null : null}
          onVerSolicitud={handleView}
          albaranVinculado={albaranes.find((a) => a.servicio_id === viewingServicio.id) || null}
          onVerAlbaran={handleAlbaranView}
          onCrearAlbaran={handleCrearAlbaranDesdeServicio}
          coloresVehiculo={coloresVehiculo}
          onSendEmail={(s) => sendServicioEmail(s, config)}
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
          eventos={eventos}
          onNuevoEvento={(fecha) => setEditandoEvento({ fecha })}
          onEditarEvento={(evento) => setEditandoEvento({ evento, fecha: evento.fecha })}
          coloresVehiculo={coloresVehiculo}
          flota={vehiculos}
          onVerVehiculo={handleVehiculoView}
          onViewServicio={handleServicioView}
          onViewAlbaran={handleAlbaranView}
          onCrearAlbaran={handleCrearAlbaranDesdeServicio}
          onNuevoServicioEnHora={handleNuevoServicioEnHora}
          onMoverServicio={handleMoverServicio}
          onAddNota={handleServicioAddNota}
          onConfig={() => setScreen("config")}
        />
      )}
      {screen === "flota" && (
        <FlotaListScreen
          vehiculos={vehiculos}
          loading={loadingData}
          onNew={handleVehiculoNew}
          onView={handleVehiculoView}
          onEdit={handleVehiculoEdit}
          onDelete={handleVehiculoDelete}
          onConfig={() => setScreen("config")}
        />
      )}
      {screen === "vehiculoForm" && (
        <VehiculoFormScreen initial={editingVehiculo} onSave={handleVehiculoFormSave} onCancel={() => setScreen("flota")} saving={saving} />
      )}
      {screen === "vehiculoView" && viewingVehiculo && (
        <VehiculoViewScreen
          vehiculo={viewingVehiculo}
          onEdit={() => handleVehiculoEdit(viewingVehiculo)}
          onDelete={() => handleVehiculoDelete(viewingVehiculo.id)}
          onBack={() => setScreen("flota")}
        />
      )}
      {screen === "albaranesList" && (
        <AlbaranesListScreen
          albaranes={albaranes}
          servicios={servicios}
          loading={loadingData}
          onNew={handleAlbaranNew}
          onView={handleAlbaranView}
          onEdit={handleAlbaranEdit}
          onDelete={handleAlbaranDelete}
          onConfig={() => setScreen("config")}
        />
      )}
      {screen === "albaranForm" && (
        <AlbaranFormScreen initial={conCliente(editingAlbaran)} clientes={clientes} onSave={handleAlbaranFormSave} onSaveCliente={handleSaveCliente} onCancel={() => setScreen("albaranesList")} saving={saving} />
      )}
      {screen === "albaranView" && viewingAlbaran && (
        <AlbaranViewScreen
          albaran={conCliente(viewingAlbaran)}
          cliente={fichaCliente(viewingAlbaran)}
          config={config || {}}
          servicioVinculado={viewingAlbaran.servicio_id ? servicios.find((s) => s.id === viewingAlbaran.servicio_id) || null : null}
          onVerServicio={handleServicioView}
          solicitudVinculada={viewingAlbaran.solicitud_id ? solicitudes.find((b) => b.id === viewingAlbaran.solicitud_id) || null : null}
          onVerSolicitud={handleView}
          onEdit={() => handleAlbaranEdit(viewingAlbaran)}
          onDelete={() => handleAlbaranDelete(viewingAlbaran.id)}
          onBack={() => setScreen("albaranesList")}
          onFirmar={handleAlbaranFirmar}
          onGeneratePDF={pdfAlbaran}
          onEnviarEmail={compartirAlbaran}
        />
      )}
    </div>
  );
}
