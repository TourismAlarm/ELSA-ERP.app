import { useState, useEffect } from "react";
import { Btn, PhotoGallery, MapasModal, ClienteBloque, NotasInternasBloque } from "../../../shared/components/ui";
import { textoSobre } from "../../../shared/lib/color";
import { dbLoadDecaDeServicio, dbEmitirDeca, faltanDatosDeca } from "../../deca/db";
import { sendDecaWhatsApp } from "../../deca/messaging";

const ESTADOS = {
  abierto:   { label: "Abierto",   emoji: "🟠", summary: "bg-amber-50 border-amber-200 text-amber-700",       badge: "bg-amber-100 text-amber-700" },
  realizado: { label: "Realizado", emoji: "🟢", summary: "bg-emerald-50 border-emerald-200 text-emerald-700", badge: "bg-emerald-100 text-emerald-700" },
};

const TIPO_EMOJI = { whatsapp: "💬", email: "✉️", manual: "📝" };

const formatFechaDia = (fecha) =>
  fecha ? new Date(fecha).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";

const horaCorta = (h) => (h ? h.slice(0, 5) : "");

const rangoHoras = (inicio, fin) => {
  const i = horaCorta(inicio), f = horaCorta(fin);
  if (i && f) return `${i} - ${f}`;
  if (i) return `desde ${i}`;
  if (f) return `hasta ${f}`;
  return "";
};

const formatFechaHora = (fechaISO) =>
  new Date(fechaISO).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

// El DeCA se emite ANTES de salir a hacer el trabajo (el albarán se firma
// después). Solo aparece en los servicios marcados como requiere_deca. Si
// faltan datos obligatorios no se deja emitir: se dice qué falta y dónde se
// rellena, que un DeCA incompleto no vale y nadie tiene por qué adivinarlo.
const DecaBloque = ({ servicio, cliente, config, onEmitido, onNotaAnadida }) => {
  const [decas, setDecas] = useState(null); // null = cargando
  const [cargaFallida, setCargaFallida] = useState(false);
  const [emitiendo, setEmitiendo] = useState(false);
  const [error, setError] = useState(null);
  const [recarga, setRecarga] = useState(0); // sube para volver a pedir la lista

  useEffect(() => {
    let vivo = true;
    dbLoadDecaDeServicio(servicio.id).then((lista) => {
      if (!vivo) return; // la ficha ya cambió de servicio o se cerró
      setCargaFallida(lista === null);
      setDecas(lista ?? []);
    });
    return () => { vivo = false; };
  }, [servicio.id, recarga]);

  const faltan = faltanDatosDeca(servicio, cliente, config);
  const vigentes = (decas || []).filter((d) => !d.anulado);

  const emitir = async () => {
    setEmitiendo(true);
    setError(null);
    const { deca, error: err } = await dbEmitirDeca(servicio, cliente, config);
    setEmitiendo(false);
    if (err) { setError(err.message); return; }
    setRecarga((n) => n + 1);
    onEmitido?.(deca);
  };

  const enviar = async (deca) => {
    const updated = await sendDecaWhatsApp(deca, servicio, config);
    if (updated) onNotaAnadida?.(updated);
  };

  return (
    <div className="bg-rose-50 border-2 border-rose-200 rounded-xl p-4 flex flex-col gap-3">
      <div>
        <p className="text-xs font-bold tracking-widest uppercase mb-1 text-rose-400">DeCA</p>
        <p className="text-sm font-bold text-rose-900">
          {vigentes.length > 0
            ? `📄 ${vigentes.length === 1 ? "DeCA emitido" : `${vigentes.length} DeCA emitidos`}`
            : "Este servicio necesita DeCA antes de salir"}
        </p>
        <p className="text-xs text-rose-700 mt-0.5 opacity-80">Documento de control del transporte. Se emite antes de salir y el conductor lo lleva en el móvil.</p>
      </div>

      {decas === null ? (
        <p className="text-xs text-rose-700">Cargando DeCA...</p>
      ) : cargaFallida ? (
        <p className="text-xs font-semibold text-red-600">No se han podido cargar los DeCA de este servicio. Recarga la página.</p>
      ) : decas.length > 0 && (
        <div className="flex flex-col gap-2">
          {decas.map((d) => (
            <div key={d.id} className={`bg-white border-2 rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap ${d.anulado ? "border-zinc-200 opacity-60" : "border-rose-200"}`}>
              <div className="min-w-0">
                <p className="text-sm font-black text-zinc-900">
                  {d.numero}
                  {d.anulado && <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded bg-zinc-100 text-zinc-500">Anulado</span>}
                </p>
                <p className="text-xs text-zinc-500">Emitido el {formatFechaHora(d.creado_en)}</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <a href={d.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-bold tracking-wide border-2 bg-white text-zinc-900 border-zinc-300 hover:border-zinc-900 hover:bg-zinc-50 px-3 py-1.5 text-xs rounded">
                  📄 Abrir PDF
                </a>
                {!d.anulado && (
                  <Btn size="sm" variant="whatsapp" onClick={() => enviar(d)}>💬 Enviar por WhatsApp</Btn>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {faltan.length > 0 ? (
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3">
          <p className="text-sm font-black text-red-800">⚠️ No se puede emitir: faltan datos obligatorios</p>
          <ul className="text-sm text-red-700 mt-1 list-disc pl-5">
            {faltan.map((f) => <li key={f}>{f}</li>)}
          </ul>
          <p className="text-xs text-red-700 mt-2">
            Los del servicio se completan con ✏️ Editar en esta ficha (bloque "Datos del DeCA"); los de la empresa, en ⚙️ Configuración (Datos fiscales y de transporte).
          </p>
        </div>
      ) : (
        <Btn size="md" onClick={emitir} disabled={emitiendo || decas === null}>
          {emitiendo ? "Emitiendo..." : vigentes.length > 0 ? "📄 Emitir otro DeCA" : "📄 Emitir DeCA"}
        </Btn>
      )}

      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
    </div>
  );
};

const ViewScreen = ({ servicio, config, cliente, solicitudOrigen, onVerSolicitud, albaranVinculado, onVerAlbaran, onCrearAlbaran, coloresVehiculo = {}, onSendEmail, onGeneratePDF, onEdit, onDelete, onBack, onCambiarEstado, onAddNota, onDecaEmitido }) => {
  const [srv, setSrv] = useState(servicio);
  const [nuevaNota, setNuevaNota] = useState("");
  const [direccionAbrir, setDireccionAbrir] = useState(null); // Maps/Waze
  const [addingNota, setAddingNota] = useState(false);

  const estado = srv.estado || "abierto";
  const cfg = ESTADOS[estado] || ESTADOS.abierto;
  const notas = [...(srv.notas || [])].reverse();

  const handleCambioEstado = async (nuevoEstado) => {
    if (!await onCambiarEstado(srv.id, nuevoEstado)) return;
    setSrv((prev) => ({ ...prev, estado: nuevoEstado }));
  };

  const handleAddNota = async () => {
    if (!nuevaNota.trim()) return;
    setAddingNota(true);
    const updated = await onAddNota(srv.id, nuevaNota.trim());
    setAddingNota(false);
    if (!updated) return; // se conserva lo escrito para poder reintentar
    setSrv((prev) => ({ ...prev, ...updated }));
    setNuevaNota("");
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={onBack} className="text-zinc-400 hover:text-zinc-900 transition-colors text-2xl leading-none">←</button>
        <div>
          <p className="text-xs font-bold tracking-widest text-zinc-400 uppercase mb-0.5">Servicio</p>
          <h1 className="text-3xl font-black text-zinc-900">{srv.numero}</h1>
        </div>
      </div>

      <div className="bg-white border-2 border-zinc-200 rounded-xl overflow-hidden shadow-sm mb-5">
        {/* Cabecera empresa */}
        <div className="bg-zinc-900 px-6 py-5 flex items-center gap-4">
          {config.logo
            ? <img src={config.logo} alt="logo" className="h-12 w-12 object-contain rounded bg-white p-1" />
            : <div className="h-12 w-12 bg-zinc-700 rounded flex items-center justify-center text-white text-xl">🏢</div>}
          <div>
            <p className="font-black text-white text-lg leading-tight">{config.nombre || "Mi Empresa"}</p>
            <p className="text-zinc-400 text-xs mt-0.5">{[config.tel, config.email].filter(Boolean).join("  ·  ")}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-zinc-400 text-xs">Fecha servicio</p>
            <p className="text-white font-bold text-sm">
              {formatFechaDia(srv.fecha_servicio) || "—"}
              {rangoHoras(srv.hora_inicio, srv.hora_fin) && <>  ·  {rangoHoras(srv.hora_inicio, srv.hora_fin)}</>}
            </p>
          </div>
        </div>

        <div className="p-6 flex flex-col gap-5">
          {/* Estado */}
          <div className={`${cfg.summary} border-2 rounded-xl p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
            <div>
              <p className="text-xs font-bold tracking-widest uppercase mb-1 opacity-60">Estado actual</p>
              <span className={`text-base font-black px-3 py-1 rounded-lg ${cfg.badge}`}>{cfg.emoji} {cfg.label}</span>
            </div>
            {estado === "abierto" ? (
              <Btn size="lg" onClick={() => handleCambioEstado("realizado")}>✅ Marcar como realizado</Btn>
            ) : (
              <Btn size="lg" variant="secondary" onClick={() => handleCambioEstado("abierto")}>↩️ Reabrir servicio</Btn>
            )}
          </div>

          {/* Origen: solicitud vinculada */}
          {srv.solicitud_id && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs font-bold tracking-widest uppercase mb-1 text-blue-400">Origen</p>
                <p className="text-sm font-bold text-blue-900">
                  📋 Creado desde la solicitud {solicitudOrigen?.numero || "(eliminada)"}
                </p>
                {solicitudOrigen?.fecha && (
                  <p className="text-xs text-blue-700 mt-0.5 opacity-80">Solicitud del {solicitudOrigen.fecha}</p>
                )}
              </div>
              {solicitudOrigen && onVerSolicitud && (
                <Btn size="sm" variant="secondary" onClick={() => onVerSolicitud(solicitudOrigen)}>👁 Ver solicitud</Btn>
              )}
            </div>
          )}

          {/* DeCA: va antes del albarán porque en el ciclo va antes (se
              emite antes de salir; el albarán se firma al acabar) */}
          {srv.requiere_deca && (
            <DecaBloque
              servicio={srv}
              cliente={cliente}
              config={config}
              onEmitido={(deca) => onDecaEmitido?.(srv.id, deca)}
              onNotaAnadida={(updated) => setSrv((prev) => ({ ...prev, ...updated }))}
            />
          )}

          {/* Albarán vinculado */}
          {albaranVinculado ? (
            <div className="bg-violet-50 border-2 border-violet-200 rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs font-bold tracking-widest uppercase mb-1 text-violet-400">Vinculado</p>
                <p className="text-sm font-bold text-violet-900">
                  📝 Albarán {albaranVinculado.numero}
                  <span className="ml-2 text-xs font-black px-2 py-0.5 rounded bg-white/70">
                    {(albaranVinculado.estado || "borrador") === "firmado" ? "🟢 Firmado" : "🟠 Borrador"}
                  </span>
                </p>
              </div>
              {onVerAlbaran && (
                <Btn size="sm" variant="secondary" onClick={() => onVerAlbaran(albaranVinculado)}>👁 Ver albarán</Btn>
              )}
            </div>
          ) : onCrearAlbaran && (
            <div className="bg-violet-50 border-2 border-dashed border-violet-200 rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs font-bold tracking-widest uppercase mb-1 text-violet-400">Albarán</p>
                <p className="text-sm font-bold text-violet-900">Este servicio aún no tiene albarán</p>
              </div>
              <Btn size="md" onClick={() => onCrearAlbaran(srv)}>📝 Crear albarán</Btn>
            </div>
          )}

          <ClienteBloque doc={srv} cliente={cliente} />

          {(() => {
            const vs = Array.isArray(srv.vehiculo) ? srv.vehiculo : (srv.vehiculo ? [srv.vehiculo] : []);
            return vs.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {vs.map((v) => (
                  <span
                    key={v}
                    className="text-sm font-bold px-4 py-1.5 rounded-full"
                    style={coloresVehiculo[v]
                      ? { backgroundColor: coloresVehiculo[v], color: textoSobre(coloresVehiculo[v]) }
                      : { backgroundColor: "#f4f4f5", color: "#27272a" }}
                  >
                    🚛 {v}
                  </span>
                ))}
              </div>
            );
          })()}

          {(srv.origen || srv.destino) && (
            <div className="grid grid-cols-2 gap-3">
              {srv.origen && (
                <button onClick={() => setDireccionAbrir(srv.origen)} className="bg-zinc-50 rounded-lg p-4 text-left hover:bg-zinc-100 transition-colors">
                  <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-1">Origen (A)</p>
                  <p className="text-zinc-800 text-sm font-semibold">📍 {srv.origen}</p>
                  <p className="text-[10px] font-bold text-blue-600 mt-1">Abrir en Maps / Waze</p>
                </button>
              )}
              {srv.destino && (
                <button onClick={() => setDireccionAbrir(srv.destino)} className="bg-zinc-50 rounded-lg p-4 text-left hover:bg-zinc-100 transition-colors">
                  <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-1">Destino (B)</p>
                  <p className="text-zinc-800 text-sm font-semibold">📍 {srv.destino}</p>
                  <p className="text-[10px] font-bold text-blue-600 mt-1">Abrir en Maps / Waze</p>
                </button>
              )}
            </div>
          )}

          <div>
            <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-2">Descripción del servicio</p>
            <p className="text-zinc-700 text-sm leading-relaxed whitespace-pre-wrap">{srv.descripcion || "—"}</p>
          </div>

          {/* La maniobra: se ve en la ficha, nunca en el PDF ni en lo que se
              manda fuera */}
          <NotasInternasBloque texto={srv.notas_internas} />

          {srv.fotos && srv.fotos.length > 0 && (
            <div>
              <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-3">Fotos del servicio ({srv.fotos.length})</p>
              <PhotoGallery photos={srv.fotos} />
            </div>
          )}

          {/* Notas */}
          <div>
            <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-3">Notas</p>
            {notas.length > 0 ? (
              <div className="relative pl-6 border-l-2 border-zinc-200 mb-4">
                {notas.map((nota, i) => (
                  <div key={i} className="mb-4 relative">
                    <div className="absolute -left-[25px] top-1 w-3 h-3 rounded-full bg-zinc-300 border-2 border-white" />
                    <p className="text-sm text-zinc-700">{TIPO_EMOJI[nota.tipo] || "📝"} {nota.texto}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">{formatFechaHora(nota.fecha)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-400 mb-4">Sin notas aún</p>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={nuevaNota}
                onChange={(e) => setNuevaNota(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddNota()}
                placeholder="Escribe una nota..."
                className="flex-1 border-2 border-zinc-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-zinc-500"
              />
              <Btn size="sm" onClick={handleAddNota} disabled={addingNota || !nuevaNota.trim()}>+ Añadir</Btn>
            </div>
          </div>

          {srv.precio && (
            <div className="bg-zinc-900 rounded-lg p-4 flex items-center justify-between">
              <p className="text-zinc-400 font-bold text-sm">PRECIO</p>
              <p className="text-white font-black text-2xl">{Number(srv.precio).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border-2 border-zinc-200 rounded-xl p-5 mb-4">
        <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-3">Confirmación de trabajo</p>
        <Btn size="lg" variant="email" className="w-full" onClick={() => onSendEmail(srv)}>✉️ Enviar por email</Btn>
        {onGeneratePDF && (
          <Btn size="md" variant="secondary" className="w-full mt-2" onClick={() => onGeneratePDF(srv)}>
            📄 PDF del servicio
          </Btn>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <Btn size="md" variant="secondary" className="flex-1" onClick={onEdit}>✏️ Editar</Btn>
        <Btn size="md" variant="danger" onClick={onDelete}>🗑 Eliminar</Btn>
      </div>

      <MapasModal direccion={direccionAbrir} onClose={() => setDireccionAbrir(null)} />
    </div>
  );
};

export default ViewScreen;
