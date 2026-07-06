import { useState, useRef, useEffect } from "react";
import { Btn, PhotoGallery } from "../../../shared/components/ui";

const ESTADOS = {
  borrador: { label: "Borrador", emoji: "🟠", summary: "bg-amber-50 border-amber-200 text-amber-700",       badge: "bg-amber-100 text-amber-700" },
  firmado:  { label: "Firmado",  emoji: "🟢", summary: "bg-emerald-50 border-emerald-200 text-emerald-700", badge: "bg-emerald-100 text-emerald-700" },
};

const formatFechaDia = (fecha) =>
  fecha ? new Date(fecha).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";

const formatFechaHora = (fechaISO) =>
  fechaISO ? new Date(fechaISO).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

const ViewScreen = ({ albaran, config, servicioVinculado, onVerServicio, solicitudVinculada, onVerSolicitud, onEdit, onDelete, onBack, onFirmar, onGeneratePDF, onEnviarEmail }) => {
  const [alb, setAlb] = useState(albaran);
  const [firmante, setFirmante] = useState("");
  const [firmando, setFirmando] = useState(false);
  const [hasStroke, setHasStroke] = useState(false);

  const canvasRef = useRef(null);
  const drawing = useRef(false);

  const estado = alb.estado || "borrador";
  const cfg = ESTADOS[estado] || ESTADOS.borrador;
  const yaFirmado = estado === "firmado" && alb.firma;
  const lineas = (alb.lineas || []).filter((l) => l && (l.concepto || l.cantidad || l.observaciones));

  // Preparar el canvas de firma (tamaño real según el elemento y el pixel ratio)
  useEffect(() => {
    if (yaFirmado) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    const ctx = canvas.getContext("2d");
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#18181b";
  }, [yaFirmado]);

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e) => {
    e.preventDefault();
    canvasRef.current.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handlePointerMove = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasStroke(true);
  };

  const handlePointerUp = () => { drawing.current = false; };

  const handleBorrarFirma = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStroke(false);
  };

  const handleGuardarFirma = async () => {
    if (!hasStroke) { alert("Dibuja la firma antes de guardar."); return; }
    if (!firmante.trim()) { alert("Escribe el nombre de quien firma."); return; }
    setFirmando(true);
    const firmaBase64 = canvasRef.current.toDataURL("image/png");
    const updated = await onFirmar(alb.id, firmaBase64, firmante.trim());
    if (updated) setAlb((prev) => ({ ...prev, ...updated }));
    setFirmando(false);
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={onBack} className="text-zinc-400 hover:text-zinc-900 transition-colors text-2xl leading-none">←</button>
        <div>
          <p className="text-xs font-bold tracking-widest text-zinc-400 uppercase mb-0.5">Albarán</p>
          <h1 className="text-3xl font-black text-zinc-900">{alb.numero}</h1>
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
            <p className="text-zinc-400 text-xs">Fecha</p>
            <p className="text-white font-bold text-sm">{formatFechaDia(alb.fecha) || "—"}</p>
          </div>
        </div>

        <div className="p-6 flex flex-col gap-5">
          {/* Estado */}
          <div className={`${cfg.summary} border-2 rounded-xl p-4`}>
            <p className="text-xs font-bold tracking-widest uppercase mb-1 opacity-60">Estado actual</p>
            <span className={`text-base font-black px-3 py-1 rounded-lg ${cfg.badge}`}>{cfg.emoji} {cfg.label}</span>
            {yaFirmado && alb.firmado_en && (
              <p className="text-xs mt-2 opacity-70">Firmado el {formatFechaHora(alb.firmado_en)}</p>
            )}
          </div>

          {/* Servicio vinculado */}
          {alb.servicio_id && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs font-bold tracking-widest uppercase mb-1 text-blue-400">Vinculado</p>
                <p className="text-sm font-bold text-blue-900">
                  🔧 Servicio {servicioVinculado?.numero || "(eliminado)"}
                  {servicioVinculado && (
                    <span className="ml-2 text-xs font-black px-2 py-0.5 rounded bg-white/70">
                      {(servicioVinculado.estado || "abierto") === "realizado" ? "🟢 Realizado" : "🟠 Abierto"}
                    </span>
                  )}
                </p>
              </div>
              {servicioVinculado && onVerServicio && (
                <Btn size="sm" variant="secondary" onClick={() => onVerServicio(servicioVinculado)}>👁 Ver servicio</Btn>
              )}
            </div>
          )}

          {/* Solicitud vinculada */}
          {alb.solicitud_id && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs font-bold tracking-widest uppercase mb-1 text-blue-400">Vinculado</p>
                <p className="text-sm font-bold text-blue-900">📋 Solicitud {solicitudVinculada?.numero || "(eliminada)"}</p>
              </div>
              {solicitudVinculada && onVerSolicitud && (
                <Btn size="sm" variant="secondary" onClick={() => onVerSolicitud(solicitudVinculada)}>👁 Ver solicitud</Btn>
              )}
            </div>
          )}

          {/* Cliente */}
          <div className="bg-zinc-50 rounded-lg p-4">
            <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-2">Cliente</p>
            <p className="font-black text-zinc-900 text-xl">{alb.cliente}</p>
          </div>

          <div>
            <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-2">Descripción del trabajo</p>
            <p className="text-zinc-700 text-sm leading-relaxed whitespace-pre-wrap">{alb.descripcion || "—"}</p>
          </div>

          {/* Líneas */}
          {lineas.length > 0 && (
            <div>
              <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-3">Líneas ({lineas.length})</p>
              <div className="border-2 border-zinc-200 rounded-xl overflow-hidden">
                <div className="grid grid-cols-[1fr_70px] bg-zinc-900 text-white text-xs font-bold uppercase tracking-widest">
                  <div className="px-4 py-2.5">Concepto</div>
                  <div className="px-3 py-2.5 text-right">Cant.</div>
                </div>
                {lineas.map((l, i) => (
                  <div key={i} className={`grid grid-cols-[1fr_70px] text-sm ${i % 2 === 1 ? "bg-zinc-50" : "bg-white"}`}>
                    <div className="px-4 py-3">
                      <p className="font-semibold text-zinc-900">{l.concepto || "—"}</p>
                      {l.observaciones && <p className="text-xs text-zinc-500 mt-0.5">{l.observaciones}</p>}
                    </div>
                    <div className="px-3 py-3 text-right font-bold text-zinc-900">{l.cantidad || ""}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fotos */}
          {alb.fotos && alb.fotos.length > 0 && (
            <div>
              <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-3">Fotos ({alb.fotos.length})</p>
              <PhotoGallery photos={alb.fotos} />
            </div>
          )}

          {/* Panel de firma digital */}
          <div>
            <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-3">Firma del cliente</p>
            {yaFirmado ? (
              <div className="border-2 border-emerald-200 bg-emerald-50 rounded-xl p-4">
                <img src={alb.firma} alt="Firma" className="bg-white border-2 border-zinc-200 rounded-lg w-full max-h-40 object-contain" />
                <p className="text-sm font-bold text-zinc-900 mt-3">✍️ {alb.firmado_por || "—"}</p>
                {alb.firmado_en && <p className="text-xs text-zinc-500 mt-0.5">{formatFechaHora(alb.firmado_en)}</p>}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <canvas
                  ref={canvasRef}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  className="w-full h-44 touch-none bg-white border-2 border-dashed border-zinc-300 rounded-xl cursor-crosshair"
                />
                <p className="text-xs text-zinc-400 -mt-1">Firma en el recuadro con el dedo o el ratón</p>
                <input
                  type="text"
                  value={firmante}
                  onChange={(e) => setFirmante(e.target.value)}
                  placeholder="Nombre de quien firma"
                  className="w-full border-2 border-zinc-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-zinc-500"
                />
                <div className="flex gap-3">
                  <Btn size="lg" variant="secondary" className="flex-1" onClick={handleBorrarFirma}>🧹 Borrar firma</Btn>
                  <Btn size="lg" className="flex-1" onClick={handleGuardarFirma} disabled={firmando}>
                    {firmando ? "Guardando..." : "✍️ Guardar firma"}
                  </Btn>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border-2 border-zinc-200 rounded-xl p-5 mb-4">
        <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-3">Documento</p>
        <div className="flex gap-3 flex-wrap">
          <Btn size="lg" className="flex-1" onClick={() => onGeneratePDF(alb)}>📄 Generar PDF</Btn>
          <Btn size="lg" variant="email" className="flex-1" onClick={() => onEnviarEmail(alb)}>✉️ Enviar por email</Btn>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Btn size="md" variant="secondary" className="flex-1" onClick={onEdit}>✏️ Editar</Btn>
        <Btn size="md" variant="danger" onClick={onDelete}>🗑 Eliminar</Btn>
      </div>
    </div>
  );
};

export default ViewScreen;
