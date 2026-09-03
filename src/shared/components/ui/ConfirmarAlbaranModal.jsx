import { useState } from "react";
import Btn from "./Btn";
import Field from "./Field";
import { Input } from "./Input";
import { conHorasValidas, alCambiarInicio, avisoDuracion } from "../../lib/horas";

// Al marcar un servicio como realizado (o al pedir su albarán a mano) hay que
// generar el albarán, pero antes conviene revisar las horas: las que tiene el
// servicio son las previstas al programarlo, y pueden no coincidir con las
// realmente trabajadas. Es la última ocasión cómoda de corregirlas antes de
// que queden fijadas en el papel.
const ConfirmarAlbaranModal = ({ servicio, onConfirmar, onCancelar }) => {
  const [datos, setDatos] = useState(() => conHorasValidas(servicio));
  const [creando, setCreando] = useState(false);

  const confirmar = async () => {
    setCreando(true);
    const { hora_inicio, hora_fin } = conHorasValidas(datos);
    await onConfirmar({ hora_inicio, hora_fin });
    setCreando(false);
  };

  const aviso = avisoDuracion(datos.hora_inicio, datos.hora_fin);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onCancelar} />
      <div className="relative bg-white rounded-t-2xl p-5 pb-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-black text-zinc-900">Generar albarán</h2>
          <button onClick={onCancelar} className="text-zinc-400 hover:text-zinc-900 text-2xl leading-none p-1">×</button>
        </div>
        <p className="text-sm text-zinc-500 mb-4">
          Servicio de <b className="text-zinc-700">{servicio.cliente || "cliente sin nombre"}</b>. Antes de generar el albarán, confirma las horas trabajadas.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Hora inicio">
            <Input
              type="time"
              value={datos.hora_inicio || ""}
              onChange={(e) => setDatos((d) => ({ ...d, ...alCambiarInicio(e.target.value, d) }))}
              autoFocus
            />
          </Field>
          <Field label="Hora fin">
            <Input type="time" value={datos.hora_fin || ""} onChange={(e) => setDatos((d) => ({ ...d, hora_fin: e.target.value }))} />
          </Field>
        </div>
        {aviso && <p className="text-xs text-amber-600 mt-1">{aviso}</p>}

        <div className="flex gap-2 mt-5">
          <Btn size="lg" className="flex-1" onClick={confirmar} disabled={creando}>
            {creando ? "Creando..." : "📝 Crear albarán"}
          </Btn>
          <Btn size="lg" variant="secondary" onClick={onCancelar}>Ahora no</Btn>
        </div>
        <p className="text-xs text-zinc-400 mt-3 text-center">
          Si lo dejas para luego, puedes crear el albarán a mano desde el servicio cuando quieras.
        </p>
      </div>
    </div>
  );
};

export default ConfirmarAlbaranModal;
