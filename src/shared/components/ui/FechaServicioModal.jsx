import { useState } from "react";
import Btn from "./Btn";
import Field from "./Field";
import { Input } from "./Input";

const hoy = () => new Date().toISOString().slice(0, 10);

// Al aceptar una solicitud hay que fijar la fecha del servicio. Antes se pedía
// con un prompt() del navegador: en el móvil es incómodo, no valida el formato
// y una fecha mal escrita se guardaba tal cual.
const FechaServicioModal = ({ solicitud, onConfirmar, onCancelar }) => {
  const [fecha, setFecha] = useState(hoy);
  const [guardando, setGuardando] = useState(false);

  const confirmar = async () => {
    if (!fecha) return;
    setGuardando(true);
    await onConfirmar(fecha);
    setGuardando(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onCancelar} />
      <div className="relative bg-white rounded-t-2xl p-5 pb-8">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-black text-zinc-900">Crear el servicio</h2>
          <button onClick={onCancelar} className="text-zinc-400 hover:text-zinc-900 text-2xl leading-none p-1">×</button>
        </div>
        <p className="text-sm text-zinc-500 mb-4">
          Solicitud aceptada de <b className="text-zinc-700">{solicitud.cliente || "cliente sin nombre"}</b>. ¿Para qué día es el trabajo?
        </p>

        <Field label="Fecha del servicio">
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} autoFocus />
        </Field>

        <div className="flex gap-2 mt-5">
          <Btn size="lg" className="flex-1" onClick={confirmar} disabled={!fecha || guardando}>
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
