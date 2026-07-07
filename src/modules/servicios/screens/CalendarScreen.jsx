import { useState, useRef } from "react";
import { Btn } from "../../../shared/components/ui";
import { textoSobre } from "../../../shared/lib/color";

// Devuelve el primer vehículo/equipo del servicio (para el color del calendario)
const primerVehiculo = (s) => {
  const arr = Array.isArray(s.vehiculo) ? s.vehiculo : (s.vehiculo ? [s.vehiculo] : []);
  return arr[0] || null;
};

const DIAS_SEMANA = ["L", "M", "X", "J", "V", "S", "D"];

// --- Rejilla horaria del día seleccionado (07:00 a 21:00, franjas de 30 min) ---
const HORA_MIN = 7;
const HORA_MAX = 21;
const PX_POR_MINUTO = 1; // 60px por hora
const TOTAL_MINUTOS = (HORA_MAX - HORA_MIN) * 60;

// "HH:MM" o "HH:MM:SS" -> minutos desde el inicio de la rejilla
const aMinutosDesdeInicio = (h) => {
  const [hh, mm] = h.split(":");
  return (Number(hh) - HORA_MIN) * 60 + Number(mm || 0);
};

const horaCorta = (h) => (h ? h.slice(0, 5) : "");

const minutosAHora = (min) => {
  const h = HORA_MIN + Math.floor(min / 60);
  return `${String(h).padStart(2, "0")}:${min % 60 === 0 ? "00" : "30"}`;
};

// Minutos desde el inicio de la rejilla -> "HH:MM" (admite cualquier minuto,
// para el arrastre con snap de 15 min)
const minAbsAHora = (min) => {
  const t = HORA_MIN * 60 + min;
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
// (ini/fin en minutos desde las 07:00, con reparto de columnas si se solapan)
const bloquesDe = (lista) =>
  asignarColumnas(
    lista
      .filter((s) => s.hora_inicio)
      .map((s) => {
        const ini = aMinutosDesdeInicio(s.hora_inicio);
        let fin = s.hora_fin ? aMinutosDesdeInicio(s.hora_fin) : ini + 60; // sin fin: 1h por defecto
        if (fin <= ini) fin = ini + 30; // fin anterior a inicio: bloque mínimo
        return { s, ini, fin };
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

const CalendarScreen = ({ servicios, albaranes, coloresVehiculo = {}, flota = [], onVerVehiculo, onViewServicio, onViewAlbaran, onCrearAlbaran, onNuevoServicioEnHora, onMoverServicio, onConfig }) => {
  // Estilo de la etiqueta de un servicio: color de su vehículo/equipo si lo
  // tiene, si no, el color por estado (ámbar abierto / verde realizado)
  const estiloEvento = (s) => {
    const color = coloresVehiculo[primerVehiculo(s)];
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
  // Vista de la rejilla horaria: un día o la semana completa
  const [vistaHoras, setVistaHoras] = useState("dia");

  // --- Arrastrar y soltar bloques (mantener pulsado en táctil, arrastrar con ratón) ---
  // drag = posición propuesta del bloque fantasma { s, dur, durReal, dia, min }
  const [drag, setDrag] = useState(null);
  const pressRef = useRef(null);        // datos del gesto en curso
  const justDraggedRef = useRef(false); // evita que el click tras soltar abra el panel
  const diaAreaRef = useRef(null);      // área de eventos de la vista de día
  const semanaColsRef = useRef(null);   // contenedor de las 7 columnas de la semana

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
    if (vistaHoras === "dia" || !semanaColsRef.current) {
      const rect = diaAreaRef.current?.getBoundingClientRect();
      if (!rect) return null;
      dia = fecha;
      min = (e.clientY - rect.top) / PX_POR_MINUTO - p.grabOffset;
    } else {
      const rect = semanaColsRef.current.getBoundingClientRect();
      const idx = Math.max(0, Math.min(6, Math.floor(((e.clientX - rect.left) / rect.width) * 7)));
      dia = diasDeLaSemana[idx];
      min = (e.clientY - rect.top - ALTO_CABECERA_SEMANA - alturaAvisosSemana) / PX_POR_MINUTO - p.grabOffset;
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

  const volverHoy = () => {
    const d = new Date();
    setFecha(hoy());
    setMes({ year: d.getFullYear(), month: d.getMonth() });
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
  const labelDia = new Date(fecha + "T00:00:00").toLocaleDateString("es-ES", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const delDia = (porDia[fecha] || [])
    .slice()
    .sort((a, b) => (a.cliente || "").localeCompare(b.cliente || ""));

  // Rejilla horaria: servicios con hora (bloques posicionados) y sin hora (chips)
  const sinHora = delDia.filter((s) => !s.hora_inicio);
  const conHora = bloquesDe(delDia);
  const franjas = Array.from({ length: TOTAL_MINUTOS / 30 }, (_, i) => i * 30);

  // Semana (lunes a domingo) que contiene la fecha seleccionada
  const diasDeLaSemana = (() => {
    const lunes = lunesDe(fecha);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(lunes);
      d.setDate(lunes.getDate() + i);
      return toISO(d);
    });
  })();

  const labelSemana = (() => {
    const ini = new Date(diasDeLaSemana[0] + "T00:00:00");
    const fin = new Date(diasDeLaSemana[6] + "T00:00:00");
    const mIni = ini.toLocaleDateString("es-ES", { month: "short" });
    const mFin = fin.toLocaleDateString("es-ES", { month: "short" });
    return mIni === mFin
      ? `${ini.getDate()} – ${fin.getDate()} ${mFin}`
      : `${ini.getDate()} ${mIni} – ${fin.getDate()} ${mFin}`;
  })();

  const cambiarSemana = (delta) => {
    const d = new Date(fecha + "T00:00:00");
    d.setDate(d.getDate() + delta * 7);
    setFecha(toISO(d));
    setMes({ year: d.getFullYear(), month: d.getMonth() });
  };

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
  const ALTO_AVISO = 18; // px por fila de aviso en la vista de semana
  const maxAvisosSemana = Math.max(0, ...diasDeLaSemana.map((iso) => (avisosPorDia[iso] || []).length));
  const alturaAvisosSemana = maxAvisosSemana * ALTO_AVISO;

  const esMesActual = (() => { const d = new Date(); return mes.year === d.getFullYear() && mes.month === d.getMonth(); })();

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">

      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <p className="text-xs font-bold tracking-widest text-zinc-400 uppercase mb-1">Servicios del mes</p>
          <h1 className="text-3xl font-black text-zinc-900">Calendario</h1>
        </div>
        <Btn variant="ghost" size="sm" onClick={onConfig}>⚙️ Config</Btn>
      </div>

      {/* Vista mensual */}
      <div className="bg-white border-2 border-zinc-200 rounded-xl p-4 mb-6">
        {/* Navegación de mes */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <button
            onClick={() => cambiarMes(-1)}
            className="w-12 h-12 shrink-0 bg-zinc-100 hover:bg-zinc-900 hover:text-white text-zinc-700 rounded-xl text-lg font-black transition-colors"
          >
            ◀
          </button>
          <p className="text-lg font-black text-zinc-900 capitalize text-center flex-1">{labelMes}</p>
          <button
            onClick={() => cambiarMes(1)}
            className="w-12 h-12 shrink-0 bg-zinc-100 hover:bg-zinc-900 hover:text-white text-zinc-700 rounded-xl text-lg font-black transition-colors"
          >
            ▶
          </button>
        </div>

        {/* Cabecera de días de la semana */}
        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {DIAS_SEMANA.map((d) => (
            <div key={d} className="text-center text-xs font-black text-zinc-400 py-1">{d}</div>
          ))}
        </div>

        {/* Rejilla de días (estilo agenda: cada día muestra sus servicios) */}
        <div className="grid grid-cols-7 gap-1">
          {celdas.map((dia, i) => {
            if (dia === null) return <div key={`vacio-${i}`} />;
            const iso = toISO(new Date(mes.year, mes.month, dia));
            const svs = (porDia[iso] || [])
              .slice()
              .sort((a, b) => (a.cliente || "").localeCompare(b.cliente || ""));
            const esHoy = iso === hoy();
            const seleccionado = iso === fecha;
            const visibles = svs.slice(0, 3);
            const extra = svs.length - visibles.length;
            return (
              <button
                key={iso}
                onClick={() => setFecha(iso)}
                className={`relative min-h-[72px] rounded-lg border-2 flex flex-col items-stretch gap-0.5 p-1 text-left transition-colors ${
                  seleccionado
                    ? "bg-zinc-50 border-zinc-900 ring-1 ring-zinc-900"
                    : "bg-white border-zinc-200 hover:border-zinc-400"
                }`}
              >
                {(avisosPorDia[iso] || []).length > 0 && (
                  <span className="absolute top-0.5 right-0.5 text-[9px] leading-none" title="Vencimiento de flota">⚠️</span>
                )}
                <span className={`self-center text-xs font-black leading-none rounded-full w-5 h-5 flex items-center justify-center ${
                  esHoy ? "bg-zinc-900 text-white" : "text-zinc-700"
                }`}>
                  {dia}
                </span>
                {visibles.map((s) => {
                  const ev = estiloEvento(s);
                  const hecho = (s.estado || "abierto") === "realizado";
                  return (
                    <span
                      key={s.id}
                      style={ev.style}
                      className={`block w-full truncate rounded px-1 py-0.5 text-[9px] font-bold leading-tight ${ev.className}`}
                    >
                      {hecho ? "✓ " : ""}{s.cliente || "Sin nombre"}
                    </span>
                  );
                })}
                {extra > 0 && (
                  <span className="block w-full truncate px-1 text-[9px] font-black text-zinc-500 leading-tight">
                    +{extra} más
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Leyenda */}
        <div className="flex items-center justify-center gap-x-4 gap-y-1.5 mt-3 flex-wrap">
          {Object.keys(coloresVehiculo).length > 0 ? (
            <>
              {Object.entries(coloresVehiculo).map(([nombre, color]) => (
                <span key={nombre} className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600">
                  <span className="w-3 h-3 rounded" style={{ backgroundColor: color }} /> {nombre}
                </span>
              ))}
              <span className="text-xs font-semibold text-zinc-500">✓ = realizado</span>
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

        {(!esMesActual || fecha !== hoy()) && (
          <button
            onClick={volverHoy}
            className="mt-4 w-full text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors"
          >
            Volver a hoy
          </button>
        )}
      </div>

      {/* Conmutador Día / Semana */}
      <div className="flex gap-1.5 bg-white border-2 border-zinc-200 rounded-xl p-1.5 mb-4">
        <button
          onClick={() => setVistaHoras("dia")}
          className={`flex-1 py-2.5 text-sm font-black rounded-lg transition-colors ${
            vistaHoras === "dia" ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
          }`}
        >
          Día
        </button>
        <button
          onClick={() => setVistaHoras("semana")}
          className={`flex-1 py-2.5 text-sm font-black rounded-lg transition-colors ${
            vistaHoras === "semana" ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
          }`}
        >
          Semana
        </button>
      </div>

      <Btn size="lg" className="w-full mb-1.5" onClick={() => onNuevoServicioEnHora(fecha, null)}>➕ Nuevo servicio</Btn>
      <p className="text-[11px] text-zinc-400 text-center mb-4">
        Mantén pulsado un bloque para moverlo de hora{vistaHoras === "semana" ? " o de día" : ""}
      </p>

      {vistaHoras === "dia" ? (
        <>
          {/* Día seleccionado */}
          <p className="text-center text-sm font-bold text-zinc-500 capitalize mb-4">{labelDia}</p>

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
                {sinHora.map((s) => {
                  const ev = estiloEvento(s);
                  const albaran = albaranes.find((a) => a.servicio_id === s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => setServicioSeleccionado(s)}
                      style={ev.style}
                      className={`text-xs font-bold px-3 py-2 rounded-full ${ev.className}`}
                    >
                      {(s.estado || "abierto") === "realizado" ? "✓ " : ""}{s.cliente || "Sin nombre"}{albaran ? " 📝" : ""}
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
                    <span className={`absolute -top-1.5 right-2 leading-none ${min % 60 === 0 ? "text-[10px] font-bold text-zinc-500" : "text-[9px] text-zinc-300"}`}>
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

                {/* Bloques de servicios con hora */}
                {conHora.map((bloque) => {
                  const { s, ini, fin, col, cols } = bloque;
                  const top = Math.max(0, Math.min(ini, TOTAL_MINUTOS - 24));
                  const alto = Math.max(24, Math.min(fin, TOTAL_MINUTOS) - top);
                  const ev = estiloEvento(s);
                  const albaran = albaranes.find((a) => a.servicio_id === s.id);
                  const hecho = (s.estado || "abierto") === "realizado";
                  return (
                    <button
                      key={s.id}
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
                      <p className="text-[10px] font-black leading-tight truncate">
                        {horaCorta(s.hora_inicio)}{s.hora_fin ? ` – ${horaCorta(s.hora_fin)}` : ""}{albaran ? " 📝" : ""}
                      </p>
                      <p className="text-[11px] font-bold leading-tight truncate">
                        {hecho ? "✓ " : ""}{s.cliente || "Sin nombre"}
                      </p>
                    </button>
                  );
                })}

                {/* Bloque fantasma durante el arrastre */}
                {drag && drag.dia === fecha && (
                  <div
                    className="absolute left-0.5 right-0.5 z-10 rounded-lg border-2 border-dashed border-zinc-900 bg-zinc-900/10 pointer-events-none px-1 pt-0.5"
                    style={{ top: drag.min * PX_POR_MINUTO, height: drag.dur * PX_POR_MINUTO }}
                  >
                    <span className="inline-block text-[10px] font-black bg-zinc-900 text-white rounded px-1">
                      {minAbsAHora(drag.min)}{drag.durReal ? ` – ${minAbsAHora(drag.min + drag.dur)}` : ""}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Navegación de semana */}
          <div className="flex items-center justify-between gap-3 mb-4">
            <button
              onClick={() => cambiarSemana(-1)}
              className="w-12 h-12 shrink-0 bg-zinc-100 hover:bg-zinc-900 hover:text-white text-zinc-700 rounded-xl text-lg font-black transition-colors"
            >
              ◀
            </button>
            <p className="text-sm font-black text-zinc-700 text-center flex-1 capitalize">{labelSemana}</p>
            <button
              onClick={() => cambiarSemana(1)}
              className="w-12 h-12 shrink-0 bg-zinc-100 hover:bg-zinc-900 hover:text-white text-zinc-700 rounded-xl text-lg font-black transition-colors"
            >
              ▶
            </button>
          </div>

          {/* Rejilla semanal (scroll horizontal en pantallas estrechas) */}
          <div className="bg-white border-2 border-zinc-200 rounded-xl p-2 pt-3 overflow-x-auto">
            <div className="flex min-w-[600px]">
              {/* Columna de horas (fija al hacer scroll) */}
              <div className="w-11 shrink-0 sticky left-0 bg-white z-20">
                <div className="h-10" />
                {alturaAvisosSemana > 0 && <div style={{ height: alturaAvisosSemana }} />}
                {franjas.map((min) => (
                  <div key={min} className="relative" style={{ height: 30 * PX_POR_MINUTO }}>
                    {min % 60 === 0 && (
                      <span className="absolute -top-1.5 right-1.5 leading-none text-[10px] font-bold text-zinc-500">
                        {minutosAHora(min)}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Una columna por día de la semana */}
              <div ref={semanaColsRef} className="flex flex-1">
              {diasDeLaSemana.map((iso, idx) => {
                const d = new Date(iso + "T00:00:00");
                const svsDia = porDia[iso] || [];
                const sinHoraDia = svsDia.filter((s) => !s.hora_inicio).length;
                const bloques = bloquesDe(svsDia);
                const esHoy = iso === hoy();
                const seleccionado = iso === fecha;
                return (
                  <div key={iso} className="flex-1 min-w-[72px] border-l border-zinc-100">
                    {/* Cabecera del día */}
                    <button
                      onClick={() => setFecha(iso)}
                      className={`w-full h-10 flex items-center justify-center gap-1 rounded-t-lg transition-colors ${
                        seleccionado ? "bg-zinc-100" : "hover:bg-zinc-50"
                      }`}
                    >
                      <span className="text-[10px] font-black text-zinc-400">{DIAS_SEMANA[idx]}</span>
                      <span className={`text-xs font-black leading-none rounded-full w-5 h-5 flex items-center justify-center ${
                        esHoy ? "bg-zinc-900 text-white" : "text-zinc-800"
                      }`}>
                        {d.getDate()}
                      </span>
                      {sinHoraDia > 0 && (
                        <span
                          onClick={(e) => { e.stopPropagation(); setFecha(iso); setVistaHoras("dia"); }}
                          title={`${sinHoraDia} sin hora — ver día`}
                          className="text-[9px] font-black bg-zinc-200 text-zinc-700 rounded-full px-1.5 py-0.5 leading-none cursor-pointer"
                        >
                          •{sinHoraDia}
                        </span>
                      )}
                    </button>

                    {/* Franja de vencimientos de flota (todo el día) */}
                    {alturaAvisosSemana > 0 && (
                      <div className="border-t border-zinc-100 overflow-hidden" style={{ height: alturaAvisosSemana }}>
                        {(avisosPorDia[iso] || []).map((a, i) => (
                          <button
                            key={i}
                            onClick={() => onVerVehiculo && onVerVehiculo(a.vehiculo)}
                            title={`${a.tipo} ${a.vehiculo.nombre}`}
                            className="block w-full truncate text-left text-[8px] font-black bg-red-100 text-red-700 hover:bg-red-200 rounded px-1 mt-px leading-tight transition-colors"
                            style={{ height: ALTO_AVISO - 2 }}
                          >
                            ⚠️ {a.tipo} {a.vehiculo.nombre}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Área horaria del día */}
                    <div className="relative">
                      {franjas.map((min) => (
                        <button
                          key={min}
                          onClick={() => onNuevoServicioEnHora(iso, minutosAHora(min))}
                          title={`Nuevo servicio el ${d.getDate()} a las ${minutosAHora(min)}`}
                          className={`block w-full border-t transition-colors hover:bg-blue-50 ${min % 60 === 0 ? "border-zinc-200" : "border-zinc-100"}`}
                          style={{ height: 30 * PX_POR_MINUTO }}
                        />
                      ))}
                      {bloques.map((bloque) => {
                        const { s, ini, fin, col, cols } = bloque;
                        const top = Math.max(0, Math.min(ini, TOTAL_MINUTOS - 24));
                        const alto = Math.max(24, Math.min(fin, TOTAL_MINUTOS) - top);
                        const ev = estiloEvento(s);
                        return (
                          <button
                            key={s.id}
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
                            <p className="text-[9px] font-black leading-tight truncate">{horaCorta(s.hora_inicio)}</p>
                            <p className="text-[9px] font-bold leading-tight truncate">{s.cliente || "Sin nombre"}</p>
                          </button>
                        );
                      })}

                      {/* Bloque fantasma durante el arrastre */}
                      {drag && drag.dia === iso && (
                        <div
                          className="absolute left-0.5 right-0.5 z-10 rounded border-2 border-dashed border-zinc-900 bg-zinc-900/10 pointer-events-none px-0.5 pt-0.5"
                          style={{ top: drag.min * PX_POR_MINUTO, height: drag.dur * PX_POR_MINUTO }}
                        >
                          <span className="inline-block text-[9px] font-black bg-zinc-900 text-white rounded px-1">
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
        </>
      )}

      {/* Panel de acciones del servicio tocado */}
      {servicioSeleccionado && (() => {
        const s = servicioSeleccionado;
        const albaran = albaranes.find((a) => a.servicio_id === s.id);
        const hecho = (s.estado || "abierto") === "realizado";
        const cerrar = () => setServicioSeleccionado(null);
        return (
          <div className="fixed inset-0 z-50 flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/40" onClick={cerrar} />
            <div className="relative bg-white rounded-t-2xl p-5 pb-8">
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
                  </div>
                  <p className="font-black text-zinc-900 text-lg leading-tight truncate">{s.cliente || "Sin nombre"}</p>
                  {(s.origen || s.destino) && (
                    <p className="text-xs text-zinc-500 mt-0.5">📍 {s.origen || "—"}{s.destino ? ` → ${s.destino}` : ""}</p>
                  )}
                </div>
                <button onClick={cerrar} className="text-zinc-400 hover:text-zinc-900 text-2xl leading-none p-1 shrink-0">×</button>
              </div>
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
    </div>
  );
};

export default CalendarScreen;
