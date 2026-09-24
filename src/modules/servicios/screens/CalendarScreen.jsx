import { useState, useRef, useLayoutEffect, useMemo } from "react";
import { Btn, MapasModal } from "../../../shared/components/ui";
import { textoSobre } from "../../../shared/lib/color";
import { servicioSinDeca } from "../../deca/db";
import { festivoDe } from "../../../shared/lib/festivos";
import { tipoDe, colorDe, diasDelEvento } from "../../eventos/db";
import AgendaView from "./AgendaView";

// Lista de vehículos/equipos de un servicio (normaliza array/string)
const vehiculosDe = (s) => {
  const arr = Array.isArray(s.vehiculo) ? s.vehiculo : (s.vehiculo ? [s.vehiculo] : []);
  return arr.filter(Boolean);
};

// Devuelve el primer vehículo/equipo del servicio (para el color del calendario)
const primerVehiculo = (s) => vehiculosDe(s)[0] || null;

// El camión que va, escrito. Hasta ahora solo se distinguía por el color, así
// que un servicio sin vehículo, o con uno que ya no está en Configuración y por
// tanto sin color, se veía igual que cualquier otro: no había forma de saber
// qué camiones estaban ocupados. Un servicio sin vehículo lo dice, para poder
// detectarlo de un vistazo y asignárselo.
const etiquetaVehiculo = (vehiculo) => (vehiculo ? `🚛 ${vehiculo}` : "🚛 Sin camión");

// Expande un servicio en una entrada por cada vehículo/equipo, para pintar cada
// camión con su color en el calendario (como se hace a mano en Google Calendar).
// Sigue siendo UN solo servicio: todas las entradas comparten el mismo `s`.
// Un servicio sin vehículos o con uno solo produce una única entrada.
const porVehiculo = (s) => {
  const vs = vehiculosDe(s);
  return vs.length > 1 ? vs.map((v) => ({ s, vehiculo: v })) : [{ s, vehiculo: vs[0] || null }];
};

// Aplica porVehiculo a una lista de servicios
const expandir = (lista) => lista.flatMap(porVehiculo);

const DIAS_SEMANA = ["L", "M", "X", "J", "V", "S", "D"];

// Vistas del calendario, como el menú de Google Calendar
const VISTAS = [
  { id: "agenda", nombre: "Agenda" },
  { id: "dia", nombre: "Día" },
  { id: "3dias", nombre: "3 días" },
  { id: "semana", nombre: "Semana" },
  { id: "mes", nombre: "Mes" },
];
const CLAVE_VISTA = "calendario.vista";

// Icono de cada vista: rectángulos que dibujan cómo se reparte la pantalla
const IconoVista = ({ id, className = "w-6 h-6" }) => {
  const trazo = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinejoin: "round" };
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      {id === "agenda" && (<><rect x="3" y="4" width="18" height="7" rx="2" {...trazo} /><rect x="3" y="13" width="18" height="7" rx="2" {...trazo} /></>)}
      {id === "dia" && (<><path d="M3 4h18M3 20h18" {...trazo} /><rect x="3" y="7" width="18" height="10" rx="1" {...trazo} /></>)}
      {id === "3dias" && (<><rect x="3" y="4" width="18" height="16" rx="1" {...trazo} /><path d="M9 4v16M15 4v16" {...trazo} /></>)}
      {id === "semana" && (<><rect x="3" y="4" width="18" height="16" rx="1" {...trazo} /><path d="M7.5 4v16M12 4v16M16.5 4v16" {...trazo} /></>)}
      {id === "mes" && (<><rect x="3" y="4" width="18" height="16" rx="1" {...trazo} /><path d="M3 12h18M9 4v16M15 4v16" {...trazo} /></>)}
    </svg>
  );
};

// Alto (px) de cada línea de la celda del mes: festivo, evento, servicio o "+N más"
const ALTO_LINEA_MES = 21;

// --- Rejilla horaria (el día entero, 00:00 a 24:00, franjas de 30 min) ---
// Al abrirla se coloca sola en HORA_SCROLL_INICIAL (o una hora antes de la
// actual si se está viendo hoy), así que el día completo no obliga a bajar.
const HORA_MIN = 0;
const HORA_MAX = 24;
const PX_POR_MINUTO = 1; // 60px por hora
const TOTAL_MINUTOS = (HORA_MAX - HORA_MIN) * 60;
const HORA_SCROLL_INICIAL = 7;

// Última hora que se guarda como fin: "24:00" no cabe en los campos de hora
// de los formularios, y el resto de la app ya cierra el día en 23:59
const ULTIMO_MINUTO_DEL_DIA = 23 * 60 + 59;

// "HH:MM" o "HH:MM:SS" -> minutos desde el inicio de la rejilla
const aMinutosDesdeInicio = (h) => {
  const [hh, mm] = h.split(":");
  return (Number(hh) - HORA_MIN) * 60 + Number(mm || 0);
};

const horaCorta = (h) => (h ? h.slice(0, 5) : "");

const capitalizar = (t) => t.charAt(0).toUpperCase() + t.slice(1);

// Emoji por tipo de nota (mismo criterio que la vista del servicio)
const TIPO_EMOJI = { whatsapp: "💬", email: "✉️", manual: "📝" };

const formatFechaHora = (fechaISO) =>
  fechaISO
    ? new Date(fechaISO).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "";

const minutosAHora = (min) => {
  const h = HORA_MIN + Math.floor(min / 60);
  return `${String(h).padStart(2, "0")}:${min % 60 === 0 ? "00" : "30"}`;
};

// Minutos desde el inicio de la rejilla -> "HH:MM" (admite cualquier minuto,
// para el arrastre con snap de 15 min). Un fin a medianoche sale "23:59".
const minAbsAHora = (min) => {
  const t = Math.min(HORA_MIN * 60 + min, ULTIMO_MINUTO_DEL_DIA);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

// Alto en px de la cabecera de cada columna en la vista de semana (h-10)
const ALTO_CABECERA_SEMANA = 40;

// Reparte en columnas los eventos que se solapan (estilo Google Calendar):
// los solapados comparten el ancho, los que no, ocupan todo
const asignarColumnas = (eventos) => {
  const ordenados = [...eventos].sort((a, b) => a.ini - b.ini || a.fin - b.fin);
  const colFin = []; // fin del último evento colocado en cada columna
  let cluster = -1;
  let finCluster = -1;
  ordenados.forEach((ev) => {
    if (ev.ini >= finCluster) { cluster++; colFin.length = 0; finCluster = ev.fin; }
    else finCluster = Math.max(finCluster, ev.fin);
    let col = colFin.findIndex((f) => f <= ev.ini);
    if (col === -1) col = colFin.length;
    colFin[col] = ev.fin;
    ev.col = col;
    ev.cluster = cluster;
  });
  const colsPorCluster = {};
  ordenados.forEach((ev) => {
    colsPorCluster[ev.cluster] = Math.max(colsPorCluster[ev.cluster] || 0, ev.col + 1);
  });
  ordenados.forEach((ev) => { ev.cols = colsPorCluster[ev.cluster]; });
  return ordenados;
};

// Convierte los servicios con hora de un día en bloques posicionables
// (ini/fin en minutos desde el inicio de la rejilla, con reparto de columnas si se solapan)
// Cada servicio con varios vehículos genera un bloque por vehículo (mismas
// horas, colocados en paralelo por asignarColumnas), como entradas separadas.
const bloquesDe = (lista) =>
  asignarColumnas(
    lista
      .filter((s) => s.hora_inicio)
      .flatMap((s) => {
        const ini = aMinutosDesdeInicio(s.hora_inicio);
        let fin = s.hora_fin ? aMinutosDesdeInicio(s.hora_fin) : ini + 60; // sin fin: 1h por defecto
        if (fin <= ini) fin = ini + 30; // fin anterior a inicio: bloque mínimo
        return porVehiculo(s).map((e) => ({ ...e, ini, fin }));
      })
  );

// Formatea una Date local a AAAA-MM-DD sin pasar por UTC (evita saltos de día)
const toISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const hoy = () => toISO(new Date());

// Lunes de la semana que contiene una fecha ISO
const lunesDe = (iso) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
};

const CalendarScreen = ({ servicios, albaranes, eventos = [], coloresVehiculo = {}, flota = [], serviciosConDeca = new Set(), onVerVehiculo, onViewServicio, onViewAlbaran, onCrearAlbaran, onNuevoServicioEnHora, onNuevoEvento, onEditarEvento, onMoverServicio, onAddNota, onConfig }) => {
  // Marca roja en los servicios que necesitan DeCA y no lo tienen: no pueden salir
  const sinDeca = (x) => servicioSinDeca(x, serviciosConDeca);
  // Estilo de la etiqueta de un servicio: color del vehículo/equipo indicado
  // (o del primero si no se especifica); si no hay color, el color por estado
  // (ámbar abierto / verde realizado)
  const estiloEvento = (s, vehiculo) => {
    const v = vehiculo !== undefined ? vehiculo : primerVehiculo(s);
    const color = coloresVehiculo[v];
    if (color) {
      return { style: { backgroundColor: color, color: textoSobre(color) }, className: "" };
    }
    return {
      style: {},
      className: (s.estado || "abierto") === "abierto" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800",
    };
  };

  const [fecha, setFecha] = useState(hoy());
  const [mes, setMes] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  // Servicio tocado en la rejilla/chips: abre el panel de acciones
  const [servicioSeleccionado, setServicioSeleccionado] = useState(null);
  // Dirección a abrir en Maps/Waze desde el panel de acciones
  const [direccionAbrir, setDireccionAbrir] = useState(null);
  // Nota que se está escribiendo en el panel de acciones
  const [nuevaNota, setNuevaNota] = useState("");
  const [guardandoNota, setGuardandoNota] = useState(false);
  // Vista elegida (agenda, día, 3 días, semana o mes). Cada uno trabaja con la
  // suya, así que se recuerda en el dispositivo.
  const [vista, setVistaState] = useState(() => {
    try {
      const guardada = localStorage.getItem(CLAVE_VISTA);
      if (VISTAS.some((v) => v.id === guardada)) return guardada;
    } catch { /* sin almacenamiento: vista por defecto */ }
    return "agenda";
  });
  const setVista = (v) => {
    setVistaState(v);
    try { localStorage.setItem(CLAVE_VISTA, v); } catch { /* sin almacenamiento */ }
  };
  const [menuVistas, setMenuVistas] = useState(false);
  // En la agenda: cada incremento vuelve la lista a hoy; y el menú del botón "+"
  const [saltoAHoy, setSaltoAHoy] = useState(0);
  const [menuNuevo, setMenuNuevo] = useState(false);

  // Cada vista ocupa el alto que queda de pantalla y solo se desplaza su
  // contenido, no la página
  const areaRef = useRef(null);
  const [altoArea, setAltoArea] = useState(null);
  useLayoutEffect(() => {
    const medir = () => {
      const area = areaRef.current;
      if (!area) return;
      const top = area.getBoundingClientRect().top + window.scrollY;
      setAltoArea(Math.max(320, window.innerHeight - top));
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [vista]);

  // Alto de la rejilla del mes, para meter en cada día tantos servicios como quepan
  const rejillaMesRef = useRef(null);
  const [altoRejillaMes, setAltoRejillaMes] = useState(0);
  useLayoutEffect(() => {
    const el = rejillaMesRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setAltoRejillaMes(el.clientHeight));
    obs.observe(el);
    return () => obs.disconnect();
  }, [vista]);

  // Añade una nota al servicio del panel y refresca el panel con la respuesta
  const handleAddNotaPanel = async () => {
    if (!nuevaNota.trim() || !servicioSeleccionado || !onAddNota) return;
    setGuardandoNota(true);
    const updated = await onAddNota(servicioSeleccionado.id, nuevaNota.trim());
    if (updated) setServicioSeleccionado((prev) => (prev ? { ...prev, ...updated } : prev));
    setNuevaNota("");
    setGuardandoNota(false);
  };

  // --- Arrastrar y soltar bloques (mantener pulsado en táctil, arrastrar con ratón) ---
  // drag = posición propuesta del bloque fantasma { s, dur, durReal, dia, min }
  const [drag, setDrag] = useState(null);
  const pressRef = useRef(null);        // datos del gesto en curso
  const justDraggedRef = useRef(false); // evita que el click tras soltar abra el panel
  const diaAreaRef = useRef(null);      // área de eventos de la vista de día
  const semanaColsRef = useRef(null);   // contenedor de las columnas de 3 días / semana

  // Bloquea el scroll nativo solo mientras hay un arrastre activo
  const bloquearScroll = useRef((e) => {
    if (pressRef.current?.active) e.preventDefault();
  }).current;

  const limpiarArrastre = () => {
    const p = pressRef.current;
    if (p?.timer) clearTimeout(p.timer);
    document.removeEventListener("touchmove", bloquearScroll);
    pressRef.current = null;
    setDrag(null);
  };

  const activarArrastre = () => {
    const p = pressRef.current;
    if (!p || p.active) return;
    p.active = true;
    p.target = { dia: p.origenDia, min: p.ini };
    if (navigator.vibrate) navigator.vibrate(30);
    setDrag({ s: p.s, dur: p.dur, durReal: p.durReal, dia: p.origenDia, min: p.ini });
  };

  // Posición (día + minutos con snap de 15) bajo el puntero
  const objetivoDe = (e, p) => {
    let dia, min;
    if (vista === "dia" || !semanaColsRef.current) {
      const rect = diaAreaRef.current?.getBoundingClientRect();
      if (!rect) return null;
      dia = fecha;
      min = (e.clientY - rect.top) / PX_POR_MINUTO - p.grabOffset;
    } else {
      const rect = semanaColsRef.current.getBoundingClientRect();
      const n = diasRejilla.length;
      const idx = Math.max(0, Math.min(n - 1, Math.floor(((e.clientX - rect.left) / rect.width) * n)));
      dia = diasRejilla[idx];
      min = (e.clientY - rect.top - ALTO_CABECERA_SEMANA - alturaAvisosSemana - alturaSinHoraSemana) / PX_POR_MINUTO - p.grabOffset;
    }
    min = Math.max(0, Math.min(TOTAL_MINUTOS - p.dur, Math.round(min / 15) * 15));
    return { dia, min };
  };

  const iniciarArrastre = (e, bloque, diaISO) => {
    if (pressRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    pressRef.current = {
      s: bloque.s,
      ini: bloque.ini,
      dur: bloque.fin - bloque.ini,
      durReal: Boolean(bloque.s.hora_fin),
      origenDia: diaISO,
      grabOffset: (e.clientY - rect.top) / PX_POR_MINUTO,
      startX: e.clientX,
      startY: e.clientY,
      active: false,
      timer: null,
      target: null,
    };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* sin captura seguimos igual */ }
    document.addEventListener("touchmove", bloquearScroll, { passive: false });
    // Táctil: mantener pulsado ~0,4s activa el arrastre; ratón: basta con mover
    if (e.pointerType !== "mouse") pressRef.current.timer = setTimeout(activarArrastre, 380);
  };

  const moverArrastre = (e) => {
    const p = pressRef.current;
    if (!p) return;
    if (!p.active) {
      const dist = Math.hypot(e.clientX - p.startX, e.clientY - p.startY);
      if (e.pointerType === "mouse") {
        if (dist > 4) activarArrastre();
      } else if (dist > 12) {
        limpiarArrastre(); // el dedo se mueve antes de la pulsación larga: es scroll
      }
      if (!pressRef.current?.active) return;
    }
    const t = objetivoDe(e, p);
    if (t && (!p.target || t.dia !== p.target.dia || t.min !== p.target.min)) {
      p.target = t;
      setDrag({ s: p.s, dur: p.dur, durReal: p.durReal, ...t });
    }
  };

  const soltarArrastre = () => {
    const p = pressRef.current;
    if (!p) return;
    if (p.active && p.target) {
      justDraggedRef.current = true;
      setTimeout(() => { justDraggedRef.current = false; }, 300);
      const { dia, min } = p.target;
      if (dia !== p.origenDia || min !== p.ini) {
        onMoverServicio(p.s, dia, minAbsAHora(min), p.durReal ? minAbsAHora(min + p.dur) : null);
      }
    }
    limpiarArrastre();
  };

  // Props comunes de arrastre para los bloques de la rejilla
  const propsArrastre = (bloque, diaISO) => ({
    onPointerDown: (e) => iniciarArrastre(e, bloque, diaISO),
    onPointerMove: moverArrastre,
    onPointerUp: soltarArrastre,
    onPointerCancel: limpiarArrastre,
  });

  const cambiarMes = (delta) => {
    const d = new Date(mes.year, mes.month + delta, 1);
    setMes({ year: d.getFullYear(), month: d.getMonth() });
  };

  const moverFecha = (dias) => {
    const d = new Date(fecha + "T00:00:00");
    d.setDate(d.getDate() + dias);
    setFecha(toISO(d));
    setMes({ year: d.getFullYear(), month: d.getMonth() });
  };

  // ◀ ▶ de la cabecera: lo que avanza depende de la vista
  const navegar = (delta) => {
    if (vista === "mes") cambiarMes(delta);
    else moverFecha(delta * (vista === "semana" ? 7 : vista === "3dias" ? 3 : 1));
  };

  const volverHoy = () => {
    const d = new Date();
    setFecha(hoy());
    setMes({ year: d.getFullYear(), month: d.getMonth() });
    setSaltoAHoy((n) => n + 1);
  };

  // Tocar un día del mes lo abre en la vista de día, como en Google Calendar
  const abrirDia = (iso) => {
    setFecha(iso);
    setVista("dia");
  };

  // Servicios agrupados por fecha
  const porDia = {};
  servicios.forEach((s) => {
    if (s.fecha_servicio) (porDia[s.fecha_servicio] = porDia[s.fecha_servicio] || []).push(s);
  });

  // Rejilla del mes visible (semana empieza en lunes)
  const primerDia = new Date(mes.year, mes.month, 1);
  const offset = (primerDia.getDay() + 6) % 7;
  const diasEnMes = new Date(mes.year, mes.month + 1, 0).getDate();
  const celdas = [
    ...Array(offset).fill(null),
    ...Array.from({ length: diasEnMes }, (_, i) => i + 1),
  ];

  const labelMes = primerDia.toLocaleDateString("es-ES", { month: "long", year: "numeric" });

  const delDia = (porDia[fecha] || [])
    .slice()
    .sort((a, b) => (a.cliente || "").localeCompare(b.cliente || ""));

  // Rejilla horaria: servicios con hora (bloques posicionados) y sin hora (chips)
  const sinHora = delDia.filter((s) => !s.hora_inicio);
  const conHora = bloquesDe(delDia);
  const franjas = Array.from({ length: TOTAL_MINUTOS / 30 }, (_, i) => i * 30);

  // Columnas de la rejilla por días: la semana (lunes a domingo) que contiene
  // la fecha, o 3 días empezando en ella
  const diasRejilla = useMemo(() => {
    const inicio = vista === "3dias" ? new Date(fecha + "T00:00:00") : lunesDe(fecha);
    return Array.from({ length: vista === "3dias" ? 3 : 7 }, (_, i) => {
      const d = new Date(inicio);
      d.setDate(inicio.getDate() + i);
      return toISO(d);
    });
  }, [vista, fecha]);

  // Al abrir Día / 3 días / Semana, al cambiar de fecha o al pulsar "Hoy", la
  // rejilla se coloca en las 7:00; si se está viendo hoy y ya pasan de las
  // 8:00, en la hora anterior a la actual. Solo en esos momentos: recargar
  // los datos no mueve lo que se está mirando.
  const diaScrollRef = useRef(null);
  const semanaScrollRef = useRef(null);
  const inicioSemanaRef = useRef(null); // 00:00 de la primera columna de la semana
  useLayoutEffect(() => {
    if (vista !== "dia" && vista !== "3dias" && vista !== "semana") return;
    const contenedor = vista === "dia" ? diaScrollRef.current : semanaScrollRef.current;
    const cero = vista === "dia" ? diaAreaRef.current : inicioSemanaRef.current;
    if (!contenedor || !cero) return;
    const visibles = vista === "dia" ? [fecha] : diasRejilla;
    const ahora = new Date();
    const minAhora = ahora.getHours() * 60 + ahora.getMinutes();
    const minuto = visibles.includes(hoy()) && minAhora > 8 * 60
      ? Math.floor((minAhora - 60) / 60) * 60
      : HORA_SCROLL_INICIAL * 60;
    const yCero = cero.getBoundingClientRect().top - contenedor.getBoundingClientRect().top + contenedor.scrollTop;
    // En 3 días / Semana la fila con los días queda fija arriba y tapa esa franja;
    // los 8 px dejan ver la etiqueta de la hora, que asoma por encima de su línea
    const tapado = vista === "dia" ? 0 : ALTO_CABECERA_SEMANA;
    contenedor.scrollTop = yCero + (minuto - HORA_MIN * 60) * PX_POR_MINUTO - tapado - 8;
  }, [vista, fecha, diasRejilla, saltoAHoy]);

  const labelRango = (() => {
    const ini = new Date(diasRejilla[0] + "T00:00:00");
    const fin = new Date(diasRejilla[diasRejilla.length - 1] + "T00:00:00");
    const mIni = ini.toLocaleDateString("es-ES", { month: "short" });
    const mFin = fin.toLocaleDateString("es-ES", { month: "short" });
    return mIni === mFin
      ? `${ini.getDate()} – ${fin.getDate()} ${mFin}`
      : `${ini.getDate()} ${mIni} – ${fin.getDate()} ${mFin}`;
  })();

  const labelCabecera =
    vista === "mes" ? labelMes
    : vista === "dia" ? new Date(fecha + "T00:00:00").toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" }).replace(",", "")
    : labelRango;

  // Vencimientos de la flota (ITV, seguro y extras) agrupados por fecha.
  // Son avisos informativos: tocarlos navega al vehículo, no se arrastran.
  const avisosPorDia = {};
  (flota || []).forEach((v) => {
    const añade = (f, tipo) => {
      if (f) (avisosPorDia[f] = avisosPorDia[f] || []).push({ tipo, vehiculo: v });
    };
    añade(v.itv_vencimiento, "ITV");
    añade(v.seguro_vencimiento, "Seguro");
    (v.vencimientos || []).forEach((x) => añade(x.fecha, x.nombre || "Vencimiento"));
  });
  // Eventos que no son servicios (visitas, ausencias, taller...). Los de varios
  // días aparecen en cada uno de los días que ocupan.
  const eventosPorDia = {};
  (eventos || []).forEach((e) => {
    diasDelEvento(e).forEach((iso) => {
      (eventosPorDia[iso] = eventosPorDia[iso] || []).push(e);
    });
  });
  // Los de todo el día van a la franja de arriba; los que tienen hora, a la rejilla
  const eventosDelDia = eventosPorDia[fecha] || [];
  const eventosSinHora = eventosDelDia.filter((e) => e.todo_el_dia || !e.hora_inicio);
  const eventosConHora = eventosDelDia
    .filter((e) => !e.todo_el_dia && e.hora_inicio)
    .map((e) => ({
      e,
      ini: aMinutosDesdeInicio(e.hora_inicio),
      fin: e.hora_fin ? aMinutosDesdeInicio(e.hora_fin) : aMinutosDesdeInicio(e.hora_inicio) + 60,
    }));

  const ALTO_AVISO = 18; // px por fila de aviso en la vista de semana
  const maxAvisosSemana = Math.max(0, ...diasRejilla.map((iso) => (avisosPorDia[iso] || []).length));
  const alturaAvisosSemana = maxAvisosSemana * ALTO_AVISO;

  // Franja de servicios sin hora en la vista de semana (misma altura en todas
  // las columnas para que la rejilla horaria quede alineada)
  const ALTO_SIN_HORA = 18; // px por fila de servicio sin hora
  const maxSinHoraSemana = Math.max(0, ...diasRejilla.map((iso) =>
    expandir((porDia[iso] || []).filter((s) => !s.hora_inicio)).length +
    (eventosPorDia[iso] || []).filter((e) => e.todo_el_dia || !e.hora_inicio).length
  ));
  const alturaSinHoraSemana = maxSinHoraSemana * ALTO_SIN_HORA;

  // Líneas que caben en cada celda del mes, restando la del número del día
  const filasMes = Math.ceil(celdas.length / 7);
  const lineasPorCelda = altoRejillaMes
    ? Math.max(1, Math.floor((altoRejillaMes / filasMes - 24) / ALTO_LINEA_MES))
    : 3;

  const nombreVista = VISTAS.find((v) => v.id === vista)?.nombre;

  return (
    <div className="max-w-7xl mx-auto px-3 pt-5">

      {/* Cabecera: menú de vistas, navegación, hoy y configuración. En pantalla
          estrecha la navegación baja a una segunda fila. */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <button
          onClick={() => setMenuVistas(true)}
          aria-label="Cambiar de vista"
          className="inline-flex items-center gap-2 h-11 pl-3.5 pr-1.5 rounded-full bg-zinc-900 text-white shadow-md active:scale-95 transition-transform"
        >
          <IconoVista id={vista} className="w-5 h-5" />
          <span className="text-lg font-black">{nombreVista}</span>
          <span aria-hidden="true" className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
          </span>
        </button>

        {vista !== "agenda" && (
          <div className="order-last w-full sm:order-none sm:w-auto sm:flex-1 flex items-center justify-between sm:justify-center gap-2 min-w-0">
            <button
              onClick={() => navegar(-1)}
              aria-label="Anterior"
              className="w-10 h-10 shrink-0 bg-white border-2 border-zinc-200 hover:border-zinc-900 text-zinc-700 rounded-lg font-black transition-colors"
            >
              ◀
            </button>
            <p className="text-base font-black text-zinc-900 text-center truncate sm:min-w-[11rem]">{capitalizar(labelCabecera)}</p>
            <button
              onClick={() => navegar(1)}
              aria-label="Siguiente"
              className="w-10 h-10 shrink-0 bg-white border-2 border-zinc-200 hover:border-zinc-900 text-zinc-700 rounded-lg font-black transition-colors"
            >
              ▶
            </button>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={volverHoy}
            className="h-10 px-4 rounded-lg border-2 border-zinc-200 bg-white text-sm font-black text-zinc-700 hover:border-zinc-900 transition-colors"
          >
            Hoy
          </button>
          <button
            onClick={onConfig}
            aria-label="Configuración"
            className="w-10 h-10 rounded-lg text-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* Menú de vistas, como el lateral de Google Calendar */}
      {menuVistas && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuVistas(false)} />
          <nav className="absolute left-0 top-0 bottom-0 w-72 max-w-[80vw] bg-white shadow-2xl pt-8 pr-3 flex flex-col gap-1">
            <p className="px-6 pb-4 text-2xl font-black text-zinc-900">Calendario</p>
            {VISTAS.map((v) => (
              <button
                key={v.id}
                onClick={() => { setVista(v.id); setMenuVistas(false); }}
                aria-current={vista === v.id ? "true" : undefined}
                className={`flex items-center gap-5 h-14 pl-6 pr-4 rounded-r-full text-lg font-bold text-left transition-colors ${
                  vista === v.id ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                <IconoVista id={v.id} />
                {v.nombre}
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* Botón flotante de nuevo, como en Google Calendar */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
        {menuNuevo && (
          <>
            <button
              onClick={() => { setMenuNuevo(false); onNuevoServicioEnHora(vista === "agenda" ? hoy() : fecha, null); }}
              className="bg-white border-2 border-zinc-200 shadow-lg rounded-full px-5 py-3 text-base font-black text-zinc-900"
            >
              🚛 Servicio
            </button>
            <button
              onClick={() => { setMenuNuevo(false); onNuevoEvento(vista === "agenda" ? hoy() : fecha); }}
              className="bg-white border-2 border-zinc-200 shadow-lg rounded-full px-5 py-3 text-base font-black text-zinc-900"
            >
              📅 Otra cosa
            </button>
          </>
        )}
        <button
          onClick={() => (onNuevoEvento ? setMenuNuevo((v) => !v) : onNuevoServicioEnHora(vista === "agenda" ? hoy() : fecha, null))}
          aria-label="Nuevo"
          className="w-16 h-16 rounded-2xl bg-zinc-900 text-white text-3xl font-black shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        >
          {menuNuevo ? "×" : "+"}
        </button>
      </div>

      {/* Zona de la vista: ocupa el resto de la pantalla y solo se desplaza su contenido */}
      <div ref={areaRef} style={{ height: altoArea ?? "70vh" }} className="min-h-0">

      {vista === "agenda" && (
        <AgendaView
          servicios={servicios}
          eventos={eventos}
          coloresVehiculo={coloresVehiculo}
          serviciosConDeca={serviciosConDeca}
          onSelectServicio={setServicioSeleccionado}
          onEditarEvento={onEditarEvento}
          saltoAHoy={saltoAHoy}
        />
      )}

      {vista === "mes" && (
        // pb-20: la leyenda queda entre los dos botones flotantes y no tapan días
        <div className="h-full flex flex-col pb-20">
          <div className="flex-1 min-h-0 flex flex-col bg-white border-2 border-zinc-200 rounded-xl p-1.5">
            {/* Cabecera de días de la semana */}
            <div className="grid grid-cols-7 gap-0.5 mb-0.5">
              {DIAS_SEMANA.map((d) => (
                <div key={d} className="text-center text-xs font-black text-zinc-400 py-1">{d}</div>
              ))}
            </div>

            {/* Rejilla de días: cada día muestra tantos servicios como quepan */}
            <div
              ref={rejillaMesRef}
              className="flex-1 min-h-0 grid grid-cols-7 gap-0.5"
              style={{ gridTemplateRows: `repeat(${filasMes}, minmax(0, 1fr))` }}
            >
              {celdas.map((dia, i) => {
                if (dia === null) return <div key={`vacio-${i}`} />;
                const iso = toISO(new Date(mes.year, mes.month, dia));
                const svs = (porDia[iso] || [])
                  .slice()
                  .sort((a, b) => (a.cliente || "").localeCompare(b.cliente || ""));
                const esHoy = iso === hoy();
                const festivo = festivoDe(iso);
                const evs = eventosPorDia[iso] || [];
                const entradas = expandir(svs); // una por vehículo, con su color
                // Los eventos van primero: un día libre o una visita condicionan
                // lo que se puede meter ese día. Si no cabe todo, la última línea
                // es "+N más".
                let lineas = lineasPorCelda - (festivo ? 1 : 0);
                const total = evs.length + entradas.length;
                if (total > lineas) lineas -= 1;
                const evsVisibles = evs.slice(0, Math.max(0, lineas));
                const visibles = entradas.slice(0, Math.max(0, lineas - evsVisibles.length));
                const extra = total - evsVisibles.length - visibles.length;
                return (
                  <button
                    key={iso}
                    onClick={() => abrirDia(iso)}
                    title={festivo || undefined}
                    className={`relative min-h-0 overflow-hidden rounded border flex flex-col items-stretch gap-px p-0.5 text-left transition-colors ${
                      festivo ? "bg-rose-50 border-rose-200 hover:border-rose-400" : "bg-white border-zinc-200 hover:border-zinc-400"
                    }`}
                  >
                    {(avisosPorDia[iso] || []).length > 0 && (
                      <span className="absolute top-0.5 right-0.5 text-xs leading-none" title="Vencimiento de flota">⚠️</span>
                    )}
                    <span className={`self-center shrink-0 text-xs font-black leading-none rounded-full w-6 h-6 flex items-center justify-center ${
                      esHoy ? "bg-zinc-900 text-white" : festivo ? "text-rose-600" : "text-zinc-700"
                    }`}>
                      {dia}
                    </span>
                    {festivo && (
                      <span className="block w-full truncate px-1 text-xs font-bold text-rose-500 leading-tight shrink-0">
                        {festivo}
                      </span>
                    )}
                    {evsVisibles.map((e) => (
                      <span
                        key={e.id}
                        style={{ backgroundColor: colorDe(e), color: textoSobre(colorDe(e)) }}
                        className="block w-full truncate rounded px-1 py-0.5 text-xs font-bold leading-tight shrink-0"
                      >
                        {tipoDe(e).emoji} {e.titulo}
                      </span>
                    ))}
                    {visibles.map(({ s, vehiculo }, vi) => {
                      const ev = estiloEvento(s, vehiculo);
                      const hecho = (s.estado || "abierto") === "realizado";
                      return (
                        <span
                          key={`${s.id}-${vehiculo || vi}`}
                          style={ev.style}
                          title={`${vehiculo || "Sin camión"} · ${s.cliente || "Sin nombre"}`}
                          className={`block w-full truncate rounded px-1 py-0.5 text-xs font-bold leading-tight shrink-0 ${ev.className} ${vehiculo ? "" : "ring-1 ring-inset ring-zinc-400"}`}
                        >
                          {/* En móvil la celda es estrecha: el color ya dice el camión, así que va el cliente */}
                          {sinDeca(s) ? "🔴 " : ""}{hecho ? "✓ " : ""}<span className="hidden sm:inline">{vehiculo || "Sin camión"} · </span>{s.cliente || "Sin nombre"}
                        </span>
                      );
                    })}
                    {extra > 0 && (
                      <span className="block w-full truncate px-1 text-xs font-black text-zinc-500 leading-tight shrink-0">
                        +{extra}<span className="hidden sm:inline"> más</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Leyenda */}
          <div className="flex items-center justify-center gap-x-4 gap-y-1.5 mt-2 flex-wrap px-16">
            {Object.keys(coloresVehiculo).length > 0 ? (
              <>
                {Object.entries(coloresVehiculo).map(([nombre, color]) => (
                  <span key={nombre} className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600">
                    <span className="w-3 h-3 rounded" style={{ backgroundColor: color }} /> {nombre}
                  </span>
                ))}
                <span className="text-xs font-semibold text-zinc-500">✓ = realizado · 🔴 = sin DeCA</span>
              </>
            ) : (
              <>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
                  <span className="w-3 h-3 rounded bg-amber-100 border border-amber-300" /> Abierto
                </span>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
                  <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300" /> Realizado
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {vista === "dia" && (
        <div ref={diaScrollRef} className="h-full overflow-y-auto overscroll-contain pb-24">
          {festivoDe(fecha) && (
            <p className="text-center text-sm font-black text-rose-600 mb-3">🎉 {festivoDe(fecha)}</p>
          )}

          {/* Qué camiones están cogidos este día: la pregunta que se hace
              todo el rato al mirar el calendario */}
          {Object.keys(coloresVehiculo).length > 0 && (() => {
            const ocupados = new Set(
              (porDia[fecha] || []).flatMap((s) => vehiculosDe(s))
            );
            const sinCamion = (porDia[fecha] || []).filter((s) => vehiculosDe(s).length === 0).length;
            return (
              <div className="flex items-center gap-x-2 gap-y-1 flex-wrap mb-3">
                {Object.entries(coloresVehiculo).map(([nombre, color]) => {
                  const ocupado = ocupados.has(nombre);
                  return (
                    <span
                      key={nombre}
                      style={ocupado ? { backgroundColor: color, color: textoSobre(color) } : undefined}
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${ocupado ? "" : "bg-white text-zinc-400 line-through ring-1 ring-zinc-200"}`}
                    >
                      {nombre}
                    </span>
                  );
                })}
                {sinCamion > 0 && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white text-zinc-500 ring-1 ring-zinc-300">
                    {sinCamion} sin camión
                  </span>
                )}
              </div>
            );
          })()}

          {/* Eventos del día que no son servicios */}
          {eventosSinHora.length > 0 && (
            <div className="bg-white border-2 border-zinc-200 rounded-xl p-4 mb-3">
              <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-2">Todo el día</p>
              <div className="flex flex-wrap gap-2">
                {eventosSinHora.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => onEditarEvento && onEditarEvento(e)}
                    style={{ backgroundColor: colorDe(e), color: textoSobre(colorDe(e)) }}
                    className="text-xs font-bold px-3 py-2 rounded-full"
                  >
                    {tipoDe(e).emoji} {e.titulo}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Vencimientos de flota del día (informativos, navegan al vehículo) */}
          {(avisosPorDia[fecha] || []).length > 0 && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-3">
              <p className="text-xs font-bold text-red-400 tracking-widest uppercase mb-2">Vencimientos de flota</p>
              <div className="flex flex-wrap gap-2">
                {avisosPorDia[fecha].map((a, i) => (
                  <button
                    key={i}
                    onClick={() => onVerVehiculo && onVerVehiculo(a.vehiculo)}
                    className="text-xs font-bold px-3 py-2 rounded-full bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                  >
                    ⚠️ {a.tipo} {a.vehiculo.nombre}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Servicios sin hora asignada */}
          {sinHora.length > 0 && (
            <div className="bg-white border-2 border-zinc-200 rounded-xl p-4 mb-3">
              <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-2">Sin hora asignada</p>
              <div className="flex flex-wrap gap-2">
                {expandir(sinHora).map(({ s, vehiculo }, vi) => {
                  const ev = estiloEvento(s, vehiculo);
                  const albaran = albaranes.find((a) => a.servicio_id === s.id);
                  return (
                    <button
                      key={`${s.id}-${vehiculo || vi}`}
                      onClick={() => setServicioSeleccionado(s)}
                      style={ev.style}
                      className={`text-xs font-bold px-3 py-2 rounded-full ${ev.className}`}
                    >
                      {sinDeca(s) ? "🔴 " : ""}{(s.estado || "abierto") === "realizado" ? "✓ " : ""}{etiquetaVehiculo(vehiculo)} · {s.cliente || "Sin nombre"}{albaran ? " 📝" : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Rejilla horaria del día */}
          <div className="bg-white border-2 border-zinc-200 rounded-xl p-3 pt-4">
            <div className="flex">
              {/* Columna de horas */}
              <div className="w-12 shrink-0">
                {franjas.map((min) => (
                  <div key={min} className="relative" style={{ height: 30 * PX_POR_MINUTO }}>
                    <span className={`absolute -top-1.5 right-2 leading-none ${min % 60 === 0 ? "text-xs font-bold text-zinc-500" : "text-xs text-zinc-300"}`}>
                      {minutosAHora(min)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Área de eventos */}
              <div ref={diaAreaRef} className="flex-1 relative border-l-2 border-zinc-100">
                {/* Franjas vacías: tocar crea un servicio a esa hora */}
                {franjas.map((min) => (
                  <button
                    key={min}
                    onClick={() => onNuevoServicioEnHora(fecha, minutosAHora(min))}
                    title={`Nuevo servicio a las ${minutosAHora(min)}`}
                    className={`block w-full border-t transition-colors hover:bg-blue-50 ${min % 60 === 0 ? "border-zinc-200" : "border-zinc-100"}`}
                    style={{ height: 30 * PX_POR_MINUTO }}
                  />
                ))}

                {/* Eventos con hora: no se arrastran, tocarlos abre su ficha.
                    Van al fondo para que un servicio encima siga siendo visible. */}
                {eventosConHora.map(({ e, ini, fin }) => {
                  const top = Math.max(0, Math.min(ini, TOTAL_MINUTOS - 24));
                  const alto = Math.max(24, Math.min(fin, TOTAL_MINUTOS) - top);
                  const color = colorDe(e);
                  return (
                    <button
                      key={`ev-${e.id}`}
                      onClick={() => onEditarEvento && onEditarEvento(e)}
                      style={{
                        top: top * PX_POR_MINUTO,
                        height: alto * PX_POR_MINUTO,
                        left: "2%", width: "96%",
                        backgroundColor: color, color: textoSobre(color),
                      }}
                      className="absolute rounded-lg px-2 py-1 text-left overflow-hidden border-2 border-white/40"
                    >
                      <p className="text-xs font-black leading-tight truncate">
                        {tipoDe(e).emoji} {e.titulo}
                      </p>
                      <p className="text-xs opacity-80 leading-tight">
                        {horaCorta(e.hora_inicio)}{e.hora_fin ? ` – ${horaCorta(e.hora_fin)}` : ""}
                      </p>
                    </button>
                  );
                })}

                {/* Bloques de servicios con hora */}
                {conHora.map((bloque, bi) => {
                  const { s, vehiculo, ini, fin, col, cols } = bloque;
                  const top = Math.max(0, Math.min(ini, TOTAL_MINUTOS - 24));
                  const alto = Math.max(24, Math.min(fin, TOTAL_MINUTOS) - top);
                  const ev = estiloEvento(s, vehiculo);
                  const albaran = albaranes.find((a) => a.servicio_id === s.id);
                  const hecho = (s.estado || "abierto") === "realizado";
                  return (
                    <button
                      key={`${s.id}-${vehiculo || bi}`}
                      onClick={() => { if (justDraggedRef.current) return; setServicioSeleccionado(s); }}
                      {...propsArrastre(bloque, fecha)}
                      style={{
                        top: top * PX_POR_MINUTO,
                        height: alto * PX_POR_MINUTO,
                        left: `calc(${(col / cols) * 100}% + 2px)`,
                        width: `calc(${100 / cols}% - 4px)`,
                        WebkitTouchCallout: "none",
                        ...ev.style,
                      }}
                      className={`absolute rounded-lg px-1.5 py-1 text-left overflow-hidden shadow-sm border border-white/50 select-none ${ev.className} ${drag && drag.s.id === s.id ? "opacity-40" : ""}`}
                    >
                      <p className="text-xs font-black leading-tight truncate">
                        {horaCorta(s.hora_inicio)}{s.hora_fin ? ` – ${horaCorta(s.hora_fin)}` : ""}{albaran ? " 📝" : ""}
                      </p>
                      <p className="text-xs font-bold leading-tight truncate">
                        {sinDeca(s) ? "🔴 " : ""}{hecho ? "✓ " : ""}{s.cliente || "Sin nombre"}
                      </p>
                      <p className={`text-xs font-bold leading-tight truncate ${vehiculo ? "" : "opacity-70 italic"}`}>
                        {etiquetaVehiculo(vehiculo)}
                      </p>
                      {s.descripcion && (
                        <p className="text-xs leading-tight opacity-80 line-clamp-2">{s.descripcion}</p>
                      )}
                    </button>
                  );
                })}

                {/* Bloque fantasma durante el arrastre */}
                {drag && drag.dia === fecha && (
                  <div
                    className="absolute left-0.5 right-0.5 z-10 rounded-lg border-2 border-dashed border-zinc-900 bg-zinc-900/10 pointer-events-none px-1 pt-0.5"
                    style={{ top: drag.min * PX_POR_MINUTO, height: drag.dur * PX_POR_MINUTO }}
                  >
                    <span className="inline-block text-xs font-black bg-zinc-900 text-white rounded px-1">
                      {minAbsAHora(drag.min)}{drag.durReal ? ` – ${minAbsAHora(drag.min + drag.dur)}` : ""}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {(vista === "semana" || vista === "3dias") && (
          // Rejilla de varios días: se desplaza en vertical y, en pantallas
          // estrechas, también en horizontal
          <div ref={semanaScrollRef} className="h-full bg-white border-2 border-zinc-200 rounded-xl px-2 overflow-auto overscroll-contain">
            <div className="flex pb-24" style={{ minWidth: 44 + diasRejilla.length * 80 }}>
              {/* Columna de horas (fija al hacer scroll) */}
              <div className="w-11 shrink-0 sticky left-0 bg-white z-20">
                <div className="h-10 sticky top-0 bg-white z-10" />
                {alturaAvisosSemana > 0 && <div style={{ height: alturaAvisosSemana }} />}
                {alturaSinHoraSemana > 0 && <div style={{ height: alturaSinHoraSemana }} />}
                {franjas.map((min) => (
                  <div key={min} className="relative" style={{ height: 30 * PX_POR_MINUTO }}>
                    {min % 60 === 0 && (
                      <span className="absolute -top-1.5 right-1.5 leading-none text-xs font-bold text-zinc-500">
                        {minutosAHora(min)}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Una columna por día de la semana */}
              <div ref={semanaColsRef} className="flex flex-1">
              {diasRejilla.map((iso, idx) => {
                const d = new Date(iso + "T00:00:00");
                const svsDia = porDia[iso] || [];
                const sinHoraDia = expandir(svsDia.filter((s) => !s.hora_inicio));
                const bloques = bloquesDe(svsDia);
                const esHoy = iso === hoy();
                const seleccionado = iso === fecha;
                const festivoDia = festivoDe(iso);
                const evsDia = eventosPorDia[iso] || [];
                const evsSinHoraDia = evsDia.filter((e) => e.todo_el_dia || !e.hora_inicio);
                const evsConHoraDia = evsDia
                  .filter((e) => !e.todo_el_dia && e.hora_inicio)
                  .map((e) => ({ e, ini: aMinutosDesdeInicio(e.hora_inicio), fin: e.hora_fin ? aMinutosDesdeInicio(e.hora_fin) : aMinutosDesdeInicio(e.hora_inicio) + 60 }));
                return (
                  <div key={iso} className="flex-1 min-w-[72px] border-l border-zinc-100">
                    {/* Cabecera del día: se queda arriba al bajar; tocarla abre el día */}
                    <button
                      onClick={() => abrirDia(iso)}
                      className={`sticky top-0 z-[15] w-full h-10 flex items-center justify-center gap-1 transition-colors ${
                        seleccionado ? "bg-zinc-100" : "bg-white hover:bg-zinc-50"
                      }`}
                    >
                      <span className={`text-xs font-black ${festivoDia ? "text-rose-500" : "text-zinc-400"}`} title={festivoDia || undefined}>{DIAS_SEMANA[(d.getDay() + 6) % 7]}</span>
                      <span className={`text-xs font-black leading-none rounded-full w-5 h-5 flex items-center justify-center ${
                        esHoy ? "bg-zinc-900 text-white" : "text-zinc-800"
                      }`}>
                        {d.getDate()}
                      </span>
                    </button>

                    {/* Franja de vencimientos de flota (todo el día) */}
                    {alturaAvisosSemana > 0 && (
                      <div className="border-t border-zinc-100 overflow-hidden" style={{ height: alturaAvisosSemana }}>
                        {(avisosPorDia[iso] || []).map((a, i) => (
                          <button
                            key={i}
                            onClick={() => onVerVehiculo && onVerVehiculo(a.vehiculo)}
                            title={`${a.tipo} ${a.vehiculo.nombre}`}
                            className="block w-full truncate text-left text-xs font-black bg-red-100 text-red-700 hover:bg-red-200 rounded px-1 mt-px leading-tight transition-colors"
                            style={{ height: ALTO_AVISO - 2 }}
                          >
                            ⚠️ {a.tipo} {a.vehiculo.nombre}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Franja de servicios sin hora asignada (tocar abre el panel) */}
                    {alturaSinHoraSemana > 0 && (
                      <div className="border-t border-zinc-100 overflow-hidden" style={{ height: alturaSinHoraSemana }}>
                        {evsSinHoraDia.map((e) => (
                          <button
                            key={`ev-${e.id}`}
                            onClick={() => onEditarEvento && onEditarEvento(e)}
                            title={e.titulo}
                            style={{ height: ALTO_SIN_HORA - 2, backgroundColor: colorDe(e), color: textoSobre(colorDe(e)) }}
                            className="block w-full truncate text-left text-xs font-black rounded px-1 mt-px leading-tight"
                          >
                            {tipoDe(e).emoji} {e.titulo}
                          </button>
                        ))}
                        {sinHoraDia.map(({ s, vehiculo }, vi) => {
                          const ev = estiloEvento(s, vehiculo);
                                  return (
                            <button
                              key={`${s.id}-${vehiculo || vi}`}
                              onClick={() => setServicioSeleccionado(s)}
                              title={`${vehiculo || "Sin camión"} · ${s.cliente || "Sin nombre"}`}
                              style={{ height: ALTO_SIN_HORA - 2, ...ev.style }}
                              className={`block w-full truncate text-left text-xs font-black rounded px-1 mt-px leading-tight ${ev.className} ${vehiculo ? "" : "ring-1 ring-inset ring-zinc-400"}`}
                            >
                              {sinDeca(s) ? "🔴 " : ""}{(s.estado || "abierto") === "realizado" ? "✓ " : ""}{vehiculo || "Sin camión"}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Área horaria del día */}
                    <div ref={idx === 0 ? inicioSemanaRef : undefined} className="relative">
                      {evsConHoraDia.map(({ e, ini, fin }) => {
                        const top = Math.max(0, Math.min(ini, TOTAL_MINUTOS - 24));
                        const alto = Math.max(20, Math.min(fin, TOTAL_MINUTOS) - top);
                        const color = colorDe(e);
                        return (
                          <button
                            key={`ev-${e.id}`}
                            onClick={() => onEditarEvento && onEditarEvento(e)}
                            title={`${e.titulo} · ${horaCorta(e.hora_inicio)}`}
                            style={{ top: top * PX_POR_MINUTO, height: alto * PX_POR_MINUTO,
                                     left: "3%", width: "94%", backgroundColor: color, color: textoSobre(color) }}
                            className="absolute rounded px-1 text-left overflow-hidden border border-white/40 z-[1]"
                          >
                            <p className="text-xs font-black leading-tight truncate">{tipoDe(e).emoji} {e.titulo}</p>
                          </button>
                        );
                      })}
                      {franjas.map((min) => (
                        <button
                          key={min}
                          onClick={() => onNuevoServicioEnHora(iso, minutosAHora(min))}
                          title={`Nuevo servicio el ${d.getDate()} a las ${minutosAHora(min)}`}
                          className={`block w-full border-t transition-colors hover:bg-blue-50 ${min % 60 === 0 ? "border-zinc-200" : "border-zinc-100"}`}
                          style={{ height: 30 * PX_POR_MINUTO }}
                        />
                      ))}
                      {bloques.map((bloque, bi) => {
                        const { s, vehiculo, ini, fin, col, cols } = bloque;
                        const top = Math.max(0, Math.min(ini, TOTAL_MINUTOS - 24));
                        const alto = Math.max(24, Math.min(fin, TOTAL_MINUTOS) - top);
                        const ev = estiloEvento(s, vehiculo);
                              return (
                          <button
                            key={`${s.id}-${vehiculo || bi}`}
                            onClick={() => { if (justDraggedRef.current) return; setServicioSeleccionado(s); }}
                            {...propsArrastre(bloque, iso)}
                            style={{
                              top: top * PX_POR_MINUTO,
                              height: alto * PX_POR_MINUTO,
                              left: `calc(${(col / cols) * 100}% + 1px)`,
                              width: `calc(${100 / cols}% - 2px)`,
                              WebkitTouchCallout: "none",
                              ...ev.style,
                            }}
                            className={`absolute rounded px-1 py-0.5 text-left overflow-hidden shadow-sm border border-white/50 select-none ${ev.className} ${drag && drag.s.id === s.id ? "opacity-40" : ""}`}
                          >
                            <p className="text-xs font-black leading-tight truncate">{horaCorta(s.hora_inicio)}</p>
                            <p className={`text-xs font-bold leading-tight truncate ${vehiculo ? "" : "opacity-70 italic"}`}>{etiquetaVehiculo(vehiculo)}</p>
                            <p className="text-xs leading-tight truncate">{sinDeca(s) ? "🔴 " : ""}{s.cliente || "Sin nombre"}</p>
                          </button>
                        );
                      })}

                      {/* Bloque fantasma durante el arrastre */}
                      {drag && drag.dia === iso && (
                        <div
                          className="absolute left-0.5 right-0.5 z-10 rounded border-2 border-dashed border-zinc-900 bg-zinc-900/10 pointer-events-none px-0.5 pt-0.5"
                          style={{ top: drag.min * PX_POR_MINUTO, height: drag.dur * PX_POR_MINUTO }}
                        >
                          <span className="inline-block text-xs font-black bg-zinc-900 text-white rounded px-1">
                            {minAbsAHora(drag.min)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          </div>
      )}
      </div>

      {/* Panel de acciones del servicio tocado */}
      {servicioSeleccionado && (() => {
        const s = servicioSeleccionado;
        const albaran = albaranes.find((a) => a.servicio_id === s.id);
        const hecho = (s.estado || "abierto") === "realizado";
        const notas = [...(s.notas || [])].reverse(); // más recientes primero
        const cerrar = () => { setServicioSeleccionado(null); setNuevaNota(""); };
        return (
          <div className="fixed inset-0 z-50 flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/40" onClick={cerrar} />
            <div className="relative bg-white rounded-t-2xl p-5 pb-8 max-h-[85vh] overflow-y-auto">
              {/* Cabecera */}
              <div className="flex items-start justify-between gap-3 mb-1">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-bold text-zinc-400 tracking-widest">{s.numero}</span>
                    {s.hora_inicio && (
                      <span className="text-xs font-bold text-zinc-500">
                        {horaCorta(s.hora_inicio)}{s.hora_fin ? ` – ${horaCorta(s.hora_fin)}` : ""}
                      </span>
                    )}
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${hecho ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {hecho ? "🟢 Realizado" : "🟠 Abierto"}
                    </span>
                    {sinDeca(s) && (
                      <span className="text-xs font-black px-2 py-0.5 rounded bg-red-600 text-white">⚠️ Sin DeCA: no puede salir</span>
                    )}
                  </div>
                  <p className="font-black text-zinc-900 text-lg leading-tight truncate">{s.cliente || "Sin nombre"}</p>
                </div>
                <button onClick={cerrar} className="text-zinc-400 hover:text-zinc-900 text-2xl leading-none p-1 shrink-0">×</button>
              </div>

              {/* Origen y destino: tocar abre Google Maps / Waze */}
              {(s.origen || s.destino) && (
                <div className="flex flex-col gap-2 mt-3">
                  {s.origen && (
                    <button
                      onClick={() => setDireccionAbrir(s.origen)}
                      className="flex items-center gap-2 bg-zinc-50 hover:bg-zinc-100 rounded-lg px-3 py-2 text-left transition-colors"
                    >
                      <span className="text-xs font-black text-zinc-400 tracking-widest uppercase shrink-0">A</span>
                      <span className="text-sm font-semibold text-zinc-800 truncate flex-1">📍 {s.origen}</span>
                      <span className="text-xs font-bold text-blue-600 shrink-0">Maps / Waze</span>
                    </button>
                  )}
                  {s.destino && (
                    <button
                      onClick={() => setDireccionAbrir(s.destino)}
                      className="flex items-center gap-2 bg-zinc-50 hover:bg-zinc-100 rounded-lg px-3 py-2 text-left transition-colors"
                    >
                      <span className="text-xs font-black text-zinc-400 tracking-widest uppercase shrink-0">B</span>
                      <span className="text-sm font-semibold text-zinc-800 truncate flex-1">🏁 {s.destino}</span>
                      <span className="text-xs font-bold text-blue-600 shrink-0">Maps / Waze</span>
                    </button>
                  )}
                </div>
              )}

              {/* Descripción */}
              {s.descripcion && (
                <p className="text-sm text-zinc-600 mt-3 whitespace-pre-wrap">{s.descripcion}</p>
              )}

              {/* Notas: historial + añadir una nueva */}
              <div className="mt-4">
                <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-2">Notas</p>
                {notas.length > 0 && (
                  <div className="flex flex-col gap-1.5 mb-2 max-h-32 overflow-y-auto">
                    {notas.map((nota, i) => (
                      <div key={i} className="bg-zinc-50 rounded-lg px-3 py-1.5">
                        <p className="text-sm text-zinc-700">{TIPO_EMOJI[nota.tipo] || "📝"} {nota.texto}</p>
                        <p className="text-xs text-zinc-400 mt-0.5">{formatFechaHora(nota.fecha)}</p>
                      </div>
                    ))}
                  </div>
                )}
                {onAddNota && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={nuevaNota}
                      onChange={(e) => setNuevaNota(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddNotaPanel()}
                      placeholder="Escribe una nota..."
                      className="flex-1 border-2 border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
                    />
                    <Btn size="sm" onClick={handleAddNotaPanel} disabled={guardandoNota || !nuevaNota.trim()}>+ Añadir</Btn>
                  </div>
                )}
              </div>

              {/* Acciones */}
              <div className="flex flex-col gap-3 mt-4">
                <Btn size="lg" className="w-full" onClick={() => { cerrar(); onViewServicio(s); }}>👁 Ver servicio</Btn>
                {albaran ? (
                  <Btn size="lg" variant="secondary" className="w-full" onClick={() => { cerrar(); onViewAlbaran(albaran); }}>
                    📝 Ver albarán {albaran.numero}
                  </Btn>
                ) : (
                  <Btn size="lg" variant="secondary" className="w-full" onClick={() => { cerrar(); onCrearAlbaran(s); }}>
                    📝 Crear albarán
                  </Btn>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Abrir dirección del panel en Google Maps / Waze */}
      <MapasModal direccion={direccionAbrir} onClose={() => setDireccionAbrir(null)} />
    </div>
  );
};

export default CalendarScreen;
