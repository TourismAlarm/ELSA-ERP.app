import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "./shared/lib/supabase";
import { LoginScreen, ResetPasswordScreen, ConfigScreen, ClientesScreen, ImportarClientesScreen } from "./screens";
import { DashboardScreen, FormScreen, ViewScreen } from "./modules/solicitudes/screens";
import { ListScreen as ServiciosListScreen, FormScreen as ServicioFormScreen, ViewScreen as ServicioViewScreen, CalendarScreen } from "./modules/servicios/screens";
import { ListScreen as AlbaranesListScreen, FormScreen as AlbaranFormScreen, ViewScreen as AlbaranViewScreen } from "./modules/albaranes/screens";
import { ListScreen as FlotaListScreen, FormScreen as VehiculoFormScreen, ViewScreen as VehiculoViewScreen } from "./modules/flota/screens";
import { dbLoadSolicitudes, dbSaveSolicitud, dbUpdateSolicitud, dbDeleteSolicitud, dbLoadConfig, dbCambiarEstado, dbAceptarSolicitud, dbMiRol, dbToggleAvisos, dbAddNota, dbLoadClientes, dbSaveCliente, dbUpdateCliente, dbDeleteCliente, dbImportarClientes } from "./modules/solicitudes/db";
import { dbLoadServicios, deserializeServicio, dbSaveServicio, dbUpdateServicio, dbDeleteServicio, dbCambiarEstadoServicio, dbAddNotaServicio } from "./modules/servicios/db";
import { dbLoadAlbaranes, dbSaveAlbaran, dbUpdateAlbaran, dbDeleteAlbaran, dbFirmarAlbaran, dbEmitirAlbaranDeServicio, dbAnularAlbaran, dbDesvincularAlbaranesDeServicio } from "./modules/albaranes/db";
import { dbLoadVehiculos, dbSaveVehiculo, dbUpdateVehiculo, dbDeleteVehiculo } from "./modules/flota/db";
import { dbLoadEventos, dbSaveEvento, dbUpdateEvento, dbDeleteEvento } from "./modules/eventos/db";
import { dbLoadEventosGoogle, conVehiculo, dbSincronizarGoogle } from "./modules/eventos/google";
import { dbLoadServiciosConDeca } from "./modules/deca/db";
import { sendServicioEmail } from "./modules/servicios/messaging";
import { sendWhatsApp, sendEmail } from "./shared/lib/messaging";
import { FechaServicioModal, ConfirmarAlbaranModal, BotonRefrescar, EventoModal, EventoGoogleModal } from "./shared/components/ui";
import { conDatosDelCliente, fichaDelCliente } from "./shared/lib/clientes";
import { mapaColoresVehiculo, normalizeVehiculos } from "./shared/lib/color";
import { DEFAULT_VEHICLES } from "./shared/lib/constants";
import { today } from "./shared/lib/utils";
import { conHorasValidas } from "./shared/lib/horas";
import { borrarFotosQuitadas } from "./shared/lib/fotos";

const PESTANAS = [
  { id: "dashboard",     emoji: "📋", texto: "Presupuestos" },
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
  // servicio_id de los servicios que ya tienen DeCA: para marcar en la lista y
  // el calendario los que lo necesitan y aún no lo tienen
  const [serviciosConDeca, setServiciosConDeca] = useState(() => new Set());
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
  // Eventos de Google Calendar (solo lectura) y, si no se han podido traer, por qué
  const [eventosGoogle, setEventosGoogle] = useState([]);
  const [avisoGoogle, setAvisoGoogle] = useState(null);
  const [verEventoGoogle, setVerEventoGoogle] = useState(null);
  // Lo que pintan los calendarios: los del ERP y los de Google juntos. Los de
  // un calendario de Google con nombre de vehículo llevan su color y lo marcan
  // como ocupado.
  const vehiculosConfig = config?.vehicles;
  const eventosCalendario = useMemo(
    () => [...eventos, ...conVehiculo(eventosGoogle, mapaColoresVehiculo(vehiculosConfig))],
    [eventos, eventosGoogle, vehiculosConfig]
  );

  // Con la cuenta de Google conectada, cada cambio en un servicio se lleva a
  // los calendarios de Google de sus vehículos. Va sin esperar: guardar en el
  // ERP no depende de Google. Si Google falla se avisa abajo, y el servicio
  // se arregla en Google con solo volver a guardarlo.
  const [avisoEscrituraGoogle, setAvisoEscrituraGoogle] = useState(null);
  // Vuelta de Google tras conectar la cuenta (/?google=conectado|error):
  // se lee una vez, se quita de la barra de direcciones y se enseña el
  // resultado en Configuración
  const [vueltaGoogle] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    const estado = p.get("google");
    if (!estado) return null;
    window.history.replaceState({}, "", window.location.pathname + window.location.hash);
    return { ok: estado === "conectado", detalle: p.get("detalle") };
  });
  const googleConectado = Boolean(config?.google_cuenta);
  const avisarGoogle = useCallback((id) => {
    if (!googleConectado || !id) return;
    dbSincronizarGoogle([id]).then((error) => setAvisoEscrituraGoogle(error));
  }, [googleConectado]);

  // Trae los calendarios de Google. Va aparte y sin esperar: si Google tarda
  // o falla, el resto de la app no se queda esperando, y si falla del todo se
  // conservan los eventos que ya había. Si se piden dos cargas seguidas, solo
  // cuenta la última (la otra puede llegar después con datos viejos).
  const cargaGoogleRef = useRef(0);
  const ultimaGoogleRef = useRef(0); // cuándo se pidió por última vez
  const cargarGoogle = useCallback(async ({ vaciar = false } = {}) => {
    const n = ++cargaGoogleRef.current;
    ultimaGoogleRef.current = Date.now();
    if (vaciar) setEventosGoogle([]);
    const { eventos: evsGoogle, error } = await dbLoadEventosGoogle();
    if (n !== cargaGoogleRef.current) return;
    if (evsGoogle) setEventosGoogle(evsGoogle);
    setAvisoGoogle(error);
  }, []);
  // Evento del calendario que se está creando o editando: { evento?, fecha }
  const [editandoEvento, setEditandoEvento] = useState(null);
  const [editingVehiculo, setEditingVehiculo] = useState(null);
  const [viewingVehiculo, setViewingVehiculo] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving]           = useState(false);
  const [errorCarga, setErrorCarga]   = useState(false);
  const [pidiendoFechaServicio, setPidiendoFechaServicio] = useState(null);
  // Servicio para el que se está a punto de generar un albarán: primero se
  // piden las horas (previstas al programarlo, quizá no las trabajadas)
  const [pidiendoAlbaranServicio, setPidiendoAlbaranServicio] = useState(null);
  const [refrescando, setRefrescando] = useState(false);
  const [configError, setConfigError] = useState(false);
  // 'admin' | 'operario' | null. Solo decide qué botones se enseñan: los
  // permisos de verdad los aplica la base de datos.
  const [rol, setRol] = useState(null);
  const esAdmin = rol === "admin";

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

    cargarGoogle();

    const [cfgRes, sols, srvs, albs, vhcs, clts, evts, decas, miRol] = await Promise.all([dbLoadConfig(), dbLoadSolicitudes(), dbLoadServicios(), dbLoadAlbaranes(), dbLoadVehiculos(), dbLoadClientes(), dbLoadEventos(), dbLoadServiciosConDeca(), dbMiRol()]);
    setRol(miRol);
    const falloAlguna = [sols, srvs, albs, vhcs, clts, evts, decas].some((x) => x === null) || cfgRes.error;
    setConfig(cfgRes.config);
    setConfigError(cfgRes.error);
    setErrorCarga(falloAlguna);
    setSolicitudes(sols ?? []);
    setServicios(srvs ?? []);
    setAlbaranes(albs ?? []);
    setVehiculos(vhcs ?? []);
    setClientes(clts ?? []);
    setEventos(evts ?? []);
    // Si esta carga falla se conserva lo anterior: vaciarla marcaría en rojo
    // como "sin DeCA" servicios que sí lo tienen
    if (decas !== null) setServiciosConDeca(decas);

    // Si estás mirando una ficha, que se actualice también: si no, refrescar
    // cambiaría la lista pero dejaría delante la versión vieja del documento
    const refrescaFicha = (lista) => (prev) => (prev ? (lista ?? []).find((x) => x.id === prev.id) || prev : prev);
    setViewing(refrescaFicha(sols));
    setViewingServicio(refrescaFicha(srvs));
    setViewingAlbaran(refrescaFicha(albs));
    setViewingVehiculo(refrescaFicha(vhcs));

    if (inicial) {
      // Solo llevar a Configuración cuando sabemos con certeza que no hay ninguna
      setScreen(vueltaGoogle || !(cfgRes.config || cfgRes.error) ? "config" : "dashboard");
      setLoadingData(false);
    } else {
      setRefrescando(false);
    }
  }, [cargarGoogle, vueltaGoogle]);

  // Lo que se apunta en Google tiene que llegar sin tocar nada: cada 10
  // minutos con la app abierta, y al volver a ella (el móvil la deja en
  // segundo plano y los temporizadores se paran)
  useEffect(() => {
    if (!sessionUserId) return;
    const cada = setInterval(() => { if (document.visibilityState === "visible") cargarGoogle(); }, 10 * 60 * 1000);
    // Al volver, solo si hace más de un minuto: cambiar de app y volver no
    // debe pedir los calendarios cada vez
    const alVolver = () => {
      if (document.visibilityState === "visible" && Date.now() - ultimaGoogleRef.current > 60 * 1000) cargarGoogle();
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => { clearInterval(cada); document.removeEventListener("visibilitychange", alVolver); };
  }, [sessionUserId, cargarGoogle]);

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
    setEventosGoogle([]);
    setAvisoGoogle(null);
    setServiciosConDeca(new Set());
    setRol(null);
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

  // Por cliente_id, que es el vínculo fiable; por nombre solo en los
  // albaranes antiguos que no lo guardaban (con dos clientes de nombre
  // parecido, buscar por nombre podía coger la ficha equivocada)
  const clienteDeAlbaran = (a) => fichaDelCliente(a, clientes);

  const pdfAlbaran = async (a) => {
    const { generateAlbaranPDF } = await import("./modules/albaranes/pdf");
    generateAlbaranPDF(a, config || {}, servicioDeAlbaran(a), clienteDeAlbaran(a));
  };

  const compartirAlbaran = async (a) => {
    const { shareAlbaranPDF } = await import("./modules/albaranes/pdf");
    await shareAlbaranPDF(a, config || {}, servicioDeAlbaran(a), clienteDeAlbaran(a));
  };

  const handleConfigSave = (cfg) => {
    // Si han cambiado los calendarios de Google, se vuelven a traer
    if (JSON.stringify(cfg.google_calendarios || []) !== JSON.stringify(config?.google_calendarios || [])) {
      cargarGoogle({ vaciar: true });
    }
    setConfig(cfg);
    setScreen("dashboard");
  };
  const handleNew        = () => { setEditing(null); setScreen("form"); };
  const handleEdit       = (b) => { setEditing(b); setScreen("form"); };
  const handleView       = (b) => { setViewing(b); setScreen("view"); };

  const handleCambiarEstado = async (id, nuevoEstado) => {
    // Aceptar sin servicio todavía: primero se pide la fecha y, al
    // confirmarla, se acepta y se programa en una sola operación. Si se
    // cancela el diálogo, la solicitud se queda como estaba.
    if (nuevoEstado === "aceptado" && !servicios.some((s) => s.solicitud_id === id)) {
      const sol = solicitudes.find((b) => b.id === id);
      if (sol) { setPidiendoFechaServicio(sol); return false; }
    }
    if (!await dbCambiarEstado(id, nuevoEstado)) return false;
    const now = new Date().toISOString();
    setSolicitudes((prev) => prev.map((b) => b.id === id ? { ...b, estado: nuevoEstado, fecha_ultimo_contacto: now } : b));
    setViewing((prev) => prev && prev.id === id ? { ...prev, estado: nuevoEstado, fecha_ultimo_contacto: now } : prev);
    return true;
  };

  const crearServicioDesdeSolicitud = async ({ fecha, hora_inicio, hora_fin }) => {
    const sol = pidiendoFechaServicio;
    setPidiendoFechaServicio(null);
    if (!sol) return;
    // Mismas horas por defecto que un servicio creado desde el formulario
    const horas = conHorasValidas({ hora_inicio, hora_fin });
    const creado = await dbAceptarSolicitud(sol.id, { fecha, ...horas });
    if (!creado) return;
    const saved = deserializeServicio(creado);
    const now = new Date().toISOString();
    setSolicitudes((prev) => prev.map((b) => b.id === sol.id ? { ...b, estado: "aceptado", fecha_ultimo_contacto: now } : b));
    setViewing((prev) => prev && prev.id === sol.id ? { ...prev, estado: "aceptado", fecha_ultimo_contacto: now } : prev);
    setServicios((prev) => prev.some((s) => s.id === saved.id) ? prev : [saved, ...prev]);
    avisarGoogle(saved.id);
    handleServicioView(saved);
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
    if (!esAdmin) { alert("Solo administración puede eliminar."); return; }
    if (!confirm("¿Eliminar este cliente?")) return;
    if (!await dbDeleteCliente(id)) return;
    setClientes((prev) => prev.filter((c) => c.id !== id));
  };

  const handleToggleAvisos = async (id, valor) => {
    if (!await dbToggleAvisos(id, valor)) return;
    setSolicitudes((prev) => prev.map((b) => b.id === id ? { ...b, avisos_activos: valor } : b));
  };

  const handleDelete = async (id) => {
    if (!esAdmin) { alert("Solo administración puede eliminar."); return; }
    if (!confirm("¿Eliminar este presupuesto?")) return;
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
      borrarFotosQuitadas(editing.fotos, updated.fotos);
      setSolicitudes((prev) => prev.map((b) => b.id === editing.id ? updated : b));
      setEditing(null);
      handleView(updated);
    } else {
      const nueva = { ...form, fecha: today() };
      const saved = await dbSaveSolicitud(nueva);
      setSaving(false);
      if (saved) {
        setEditing(null);
        setSolicitudes((prev) => [saved, ...prev]);
        handleView(saved);
      }
      // Si falla, se queda en el formulario con lo escrito para reintentar
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
    avisarGoogle(servicio.id);
    setViewingServicio((prev) => prev && prev.id === servicio.id ? { ...prev, fecha_servicio, hora_inicio, hora_fin } : prev);
  };

  const handleServicioCambiarEstado = async (id, nuevoEstado) => {
    if (!await dbCambiarEstadoServicio(id, nuevoEstado)) return false;
    setServicios((prev) => prev.map((s) => s.id === id ? { ...s, estado: nuevoEstado } : s));
    setViewingServicio((prev) => prev && prev.id === id ? { ...prev, estado: nuevoEstado } : prev);
    avisarGoogle(id);

    // Al marcar un servicio como realizado, si aún no tiene albarán, pedir que
    // se confirmen las horas y generarlo directamente: antes había que
    // acordarse de crearlo a mano aparte
    if (nuevoEstado === "realizado" && !albaranes.some((a) => a.servicio_id === id)) {
      const srv = servicios.find((s) => s.id === id);
      if (srv) setPidiendoAlbaranServicio({ ...srv, estado: nuevoEstado });
    }
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
    if (!esAdmin) { alert("Solo administración puede eliminar."); return; }
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
    avisarGoogle(id);
    if (screen === "servicioView") setScreen("servicios");
  };

  const handleServicioFormSave = async (form) => {
    setSaving(true);
    if (editingServicio) {
      const updated = { ...editingServicio, ...form };
      const ok = await dbUpdateServicio(updated);
      setSaving(false);
      if (!ok) return;
      borrarFotosQuitadas(editingServicio.fotos, updated.fotos);
      setServicios((prev) => prev.map((s) => s.id === editingServicio.id ? updated : s));
      avisarGoogle(updated.id);
      setEditingServicio(null);
      handleServicioView(updated);
    } else {
      const saved = await dbSaveServicio(form);
      setSaving(false);
      if (saved) {
        setEditingServicio(null);
        setServicios((prev) => [saved, ...prev]);
        avisarGoogle(saved.id);
        handleServicioView(saved);
      }
      // Si falla, se queda en el formulario con lo escrito para reintentar
    }
  };

  // ---- Albaranes ----
  const handleAlbaranNew  = () => { setEditingAlbaran(null); setScreen("albaranForm"); };
  const handleAlbaranEdit = (a) => { setEditingAlbaran(a); setScreen("albaranForm"); };
  const handleAlbaranView = (a) => { setViewingAlbaran(a); setScreen("albaranView"); };

  const handleAlbaranFirmar = async (id, firmaBase64, firmadoPor) => {
    // Firma y cierre del servicio van juntos en la base de datos
    const firmado = await dbFirmarAlbaran(id, firmaBase64, firmadoPor);
    if (!firmado) return null;
    setAlbaranes((prev) => prev.map((a) => a.id === id ? { ...a, ...firmado } : a));
    setViewingAlbaran((prev) => prev && prev.id === id ? { ...prev, ...firmado } : prev);
    if (firmado.servicio_id) {
      setServicios((prev) => prev.map((s) => s.id === firmado.servicio_id ? { ...s, estado: "realizado" } : s));
      avisarGoogle(firmado.servicio_id);
      setViewingServicio((prev) => prev && prev.id === firmado.servicio_id ? { ...prev, estado: "realizado" } : prev);
    }
    return firmado;
  };

  const handleAlbaranAnular = async (id) => {
    const motivo = prompt("Motivo de la anulación (queda registrado):");
    if (motivo === null) return null;
    if (!motivo.trim()) { alert("Hay que indicar el motivo."); return null; }
    const anulado = await dbAnularAlbaran(id, motivo.trim());
    if (!anulado) return null;
    setAlbaranes((prev) => prev.map((a) => a.id === id ? { ...a, ...anulado } : a));
    setViewingAlbaran((prev) => prev && prev.id === id ? { ...prev, ...anulado } : prev);
    return anulado;
  };

  const handleAlbaranDelete = async (id) => {
    if (!esAdmin) { alert("Solo administración puede eliminar."); return; }
    if (!confirm("¿Eliminar este albarán?")) return;
    if (!await dbDeleteAlbaran(id)) return;
    setAlbaranes((prev) => prev.filter((a) => a.id !== id));
    if (screen === "albaranView") setScreen("albaranesList");
  };

  // Pide confirmar las horas del servicio antes de generar su albarán (ver
  // ConfirmarAlbaranModal más abajo, en el render)
  const handleCrearAlbaranDesdeServicio = (servicio) => setPidiendoAlbaranServicio(servicio);

  const crearAlbaranConfirmado = async ({ hora_inicio, hora_fin }) => {
    const servicio = pidiendoAlbaranServicio;
    setPidiendoAlbaranServicio(null);
    if (!servicio) return;

    // Horas reales, servicio realizado y albarán nuevo, en una sola
    // operación: si algo falla no queda nada a medias. Si el servicio ya
    // tenía albarán, se abre ese en vez de crear otro.
    const alb = await dbEmitirAlbaranDeServicio(servicio.id, hora_inicio, hora_fin);
    if (!alb) return;

    // Si devolvió un albarán que ya existía, la base no ha tocado el
    // servicio: no pintar aquí unas horas que no se han guardado
    const yaExistia = albaranes.some((a) => a.id === alb.id);
    if (!yaExistia) {
      const cambios = { estado: "realizado", ...(hora_inicio ? { hora_inicio } : {}), ...(hora_fin ? { hora_fin } : {}) };
      setServicios((prev) => prev.map((s) => s.id === servicio.id ? { ...s, ...cambios } : s));
      avisarGoogle(servicio.id);
      setViewingServicio((prev) => prev && prev.id === servicio.id ? { ...prev, ...cambios } : prev);
    }
    setAlbaranes((prev) => prev.some((a) => a.id === alb.id) ? prev : [alb, ...prev]);
    setViewingAlbaran(alb);
    setScreen("albaranView");
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
    if (!esAdmin) { alert("Solo administración puede eliminar."); return; }
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
      borrarFotosQuitadas(editingVehiculo.fotos, updated.fotos);
      setVehiculos((prev) => prev.map((v) => v.id === editingVehiculo.id ? updated : v).sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "")));
      setEditingVehiculo(null);
      handleVehiculoView(updated);
    } else {
      const saved = await dbSaveVehiculo(form);
      setSaving(false);
      if (saved) {
        setEditingVehiculo(null);
        setVehiculos((prev) => [...prev, saved].sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "")));
        handleVehiculoView(saved);
      }
      // Si falla, se queda en el formulario con lo escrito para reintentar
    }
  };

  const handleAlbaranFormSave = async (form) => {
    setSaving(true);
    if (editingAlbaran) {
      const updated = { ...editingAlbaran, ...form };
      const ok = await dbUpdateAlbaran(updated);
      setSaving(false);
      if (!ok) return;
      borrarFotosQuitadas(editingAlbaran.fotos, updated.fotos);
      setAlbaranes((prev) => prev.map((a) => a.id === editingAlbaran.id ? updated : a));
      setEditingAlbaran(null);
      handleAlbaranView(updated);
    } else {
      const saved = await dbSaveAlbaran(form);
      setSaving(false);
      if (saved) {
        setEditingAlbaran(null);
        setAlbaranes((prev) => [saved, ...prev]);
        handleAlbaranView(saved);
      }
      // Si falla, se queda en el formulario con lo escrito para reintentar
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

      {avisoEscrituraGoogle && (
        <div className="fixed bottom-24 left-3 right-3 z-50 mx-auto max-w-xl bg-amber-50 border-2 border-amber-300 rounded-xl px-4 py-3 shadow-lg flex items-start gap-3">
          <p className="text-sm text-amber-900 flex-1">
            📆 Guardado en el ERP, pero no se ha podido pasar a Google Calendar: {avisoEscrituraGoogle}
          </p>
          <button onClick={() => setAvisoEscrituraGoogle(null)} aria-label="Cerrar" className="text-amber-700 text-xl leading-none">×</button>
        </div>
      )}

      {verEventoGoogle && (
        <EventoGoogleModal evento={verEventoGoogle} onCerrar={() => setVerEventoGoogle(null)} />
      )}

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
          eventos={eventosCalendario}
          vehiculos={normalizeVehiculos(config?.vehicles ?? DEFAULT_VEHICLES)}
          onConfirmar={crearServicioDesdeSolicitud}
          onCancelar={() => setPidiendoFechaServicio(null)}
        />
      )}

      {pidiendoAlbaranServicio && (
        <ConfirmarAlbaranModal
          servicio={pidiendoAlbaranServicio}
          onConfirmar={crearAlbaranConfirmado}
          onCancelar={() => setPidiendoAlbaranServicio(null)}
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
      {screen === "config" && <ConfigScreen initial={config} cargaFallida={configError} onSave={handleConfigSave} onLogout={handleLogout} onClientes={() => setScreen("clientes")} servicios={servicios} esAdmin={esAdmin} vueltaGoogle={vueltaGoogle} onGoogleCambio={(cuenta) => setConfig((c) => (c ? { ...c, google_cuenta: cuenta } : c))} />}
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
          serviciosConDeca={serviciosConDeca}
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
        <ServicioFormScreen initial={conCliente(editingServicio)} prefill={prefillServicio} config={config} clientes={clientes} servicios={servicios} eventos={eventosCalendario} flota={vehiculos} onSave={handleServicioFormSave} onSaveCliente={handleSaveCliente} onCancel={() => setScreen("servicios")} saving={saving} />
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
          onDecaEmitido={(servicioId) => setServiciosConDeca((prev) => new Set(prev).add(servicioId))}
          esAdmin={esAdmin}
          onDecaCambio={(servicioId, hayVigente) => setServiciosConDeca((prev) => {
            const n = new Set(prev);
            if (hayVigente) n.add(servicioId); else n.delete(servicioId);
            return n;
          })}
        />
      )}
      {screen === "calendario" && (
        <CalendarScreen
          servicios={servicios}
          albaranes={albaranes}
          eventos={eventosCalendario}
          avisoGoogle={avisoGoogle}
          serviciosConDeca={serviciosConDeca}
          onNuevoEvento={(fecha) => setEditandoEvento({ fecha })}
          onEditarEvento={(evento) => (evento.externo ? setVerEventoGoogle(evento) : setEditandoEvento({ evento, fecha: evento.fecha }))}
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
          onAnular={esAdmin ? handleAlbaranAnular : null}
          onBack={() => setScreen("albaranesList")}
          onFirmar={handleAlbaranFirmar}
          onGeneratePDF={pdfAlbaran}
          onEnviarEmail={compartirAlbaran}
        />
      )}
    </div>
  );
}
