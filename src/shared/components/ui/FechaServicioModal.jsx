import { useState } from "react";
import Btn from "./Btn";
import Field from "./Field";
import { Input } from "./Input";
import { HORA_INICIO_POR_DEFECTO, conHorasValidas, alCambiarInicio, avisoDuracion } from "../../lib/horas";

const hoy = () => new Date().toISOString().slice(0, 10);

// Al aceptar una solicitud hay que fijar cuándo se hace el trabajo. Antes se
// pedía la fecha con un prompt() del navegador: incómodo en el móvil, sin
// validar nada, y encima el servicio nacía sin hora, así que no ocupaba sitio
// en el calendario y no se veía si el día estaba lleno.
const FechaServicioModal = ({ solicitud, onConfirmar, onCancelar }) => {
  const [datos, setDatos] = useState(() =>
    conHorasValidas({ fecha: hoy(), hora_inicio: HORA_INICIO_POR_DEFECTO, hora_fin: "" })
  );
  const [guardando, setGuardando] = useState(false);

  const set = (k) => (e) => setDatos((d) => ({ ...d, [k]: e.target.value }));

  const confirmar = async () => {
    if (!datos.fecha) return;
    setGuardando(true);
    const { fecha, hora_inicio, hora_fin } = conHorasValidas(datos);
    await onConfirmar({ fecha, hora_inicio, hora_fin });
    setGuardando(false);
  };

  const aviso = avisoDuracion(datos.hora_inicio, datos.hora_fin);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onCancelar} />
      <div className="relative bg-white rounded-t-2xl p-5 pb-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-black text-zinc-900">Crear el servicio</h2>
          <button onClick={onCancelar} className="text-zinc-400 hover:text-zinc-900 text-2xl leading-none p-1">×</button>
        </div>
        <p className="text-sm text-zinc-500 mb-4">
          Solicitud aceptada de <b className="text-zinc-700">{solicitud.cliente || "cliente sin nombre"}</b>. ¿Cuándo se hace el trabajo?
        </p>

        <div className="flex flex-col gap-4">
          <Field label="Fecha del servicio">
            <Input type="date" value={datos.fecha} onChange={set("fecha")} autoFocus />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Hora inicio">
              <Input
                type="time"
                value={datos.hora_inicio}
                onChange={(e) => setDatos((d) => ({ ...d, ...alCambiarInicio(e.target.value, d) }))}
              />
            </Field>
            <Field label="Hora fin">
              <Input type="time" value={datos.hora_fin} onChange={set("hora_fin")} />
            </Field>
          </div>
          {aviso && <p className="text-xs text-amber-600 -mt-2">{aviso}</p>}
        </div>

        <div className="flex gap-2 mt-5">
          <Btn size="lg" className="flex-1" onClick={confirmar} disabled={!datos.fecha || guardando}>
            {guardando ? "Creando..." : "Crear servicio"}
          </Btn>
          <Btn size="lg" variant="secondary" onClick={onCancelar}>Ahora no</Btn>
        </div>
        <p className="text-xs text-zinc-400 mt-3 text-center">
          Si lo dejas para luego, la solicitud queda aceptada igualmente y puedes crear el servicio a mano cuando quieras.
        </p>
      </div>
    </div>
  );
};

export default FechaServicioModal;
