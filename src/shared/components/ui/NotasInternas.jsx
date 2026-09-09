import { Textarea } from "./Input";

// La caja de maniobra: lo que el equipo necesita saber para hacer el trabajo
// (por dónde entrar, con quién hablar, qué avisar) y que el cliente no tiene
// por qué leer. Va aparte de la descripción justamente por eso: la descripción
// sale en el presupuesto, en la hoja del servicio y en el albarán, y esto no
// sale en ningún documento ni mensaje que salga de la empresa.
//
// Se pinta en ámbar y con candado en todas partes para que se vea de un
// vistazo que ese texto es interno y no se escriba ahí lo que debería ir en la
// descripción.

export const TITULO_NOTAS_INTERNAS = "🔒 Notas internas de maniobra";

const AVISO = "Solo se ve aquí dentro. No sale en el PDF ni en nada que se envíe al cliente.";

export const NotasInternasCampo = ({ value, onChange, placeholder }) => (
  <div className="border-2 border-amber-200 bg-amber-50 rounded-lg p-4">
    <label className="block text-xs font-bold text-amber-700 tracking-widest uppercase mb-2">
      {TITULO_NOTAS_INTERNAS}
    </label>
    <Textarea
      rows={4}
      value={value || ""}
      onChange={onChange}
      placeholder={placeholder || "Entrar por la parte de atrás, preguntar por Jordi, la calle se corta a las 9h..."}
    />
    <p className="text-xs text-amber-700 mt-2">{AVISO}</p>
  </div>
);

export const NotasInternasBloque = ({ texto }) => {
  if (!(texto || "").trim()) return null;
  return (
    <div className="border-2 border-amber-200 bg-amber-50 rounded-lg p-4">
      <p className="text-xs font-bold text-amber-700 tracking-widest uppercase mb-2">{TITULO_NOTAS_INTERNAS}</p>
      <p className="text-sm text-zinc-800 leading-relaxed whitespace-pre-wrap">{texto}</p>
      <p className="text-xs text-amber-700 mt-2">{AVISO}</p>
    </div>
  );
};
