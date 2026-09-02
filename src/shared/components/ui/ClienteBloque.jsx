import { comercialDistinto } from "../../lib/clientes";

// Solo dígitos: wa.me y tel: no admiten espacios ni el signo +
const digitos = (t) => (t || "").replace(/\D/g, "");

// Un móvil español para WhatsApp: 6xx o 7xx, con o sin el 34 delante
const paraWhatsapp = (t) => {
  const d = digitos(t);
  if (d.length === 9 && /^[67]/.test(d)) return "34" + d;
  if (d.length === 11 && d.startsWith("34") && /^[67]/.test(d.slice(2))) return d;
  return null;
};

const Fila = ({ icono, texto, href, accion }) => {
  if (!texto) return null;
  const contenido = (
    <>
      <span className="shrink-0">{icono}</span>
      <span className="truncate">{texto}</span>
    </>
  );
  return (
    <div className="flex items-center gap-2 text-sm mt-1">
      {href ? (
        <a href={href} className="flex items-center gap-2 min-w-0 text-zinc-700 hover:text-zinc-900 underline decoration-zinc-300 underline-offset-2">
          {contenido}
        </a>
      ) : (
        <span className="flex items-center gap-2 min-w-0 text-zinc-500">{contenido}</span>
      )}
      {accion}
    </div>
  );
};

// El bloque de cliente de las fichas. Antes solo salía el nombre y para ver un
// teléfono o un email había que entrar a editar el documento; ahora están aquí
// y se pulsan para llamar, escribir por WhatsApp o mandar un correo.
//
// `doc` es la solicitud, el servicio o el albarán; `cliente` su ficha, de donde
// salen el número y el nombre comercial, que el documento no guarda.
const ClienteBloque = ({ doc, cliente }) => {
  // Fijo y móvil por separado: por WhatsApp solo se puede escribir al móvil, y
  // si se enseñara uno solo se perdería el otro justo cuando hace falta llamar
  const telefonos = [...new Set([doc.telCliente, cliente?.tel, cliente?.movil]
    .map((t) => (t || "").trim())
    .filter(Boolean))];
  const email = doc.emailCliente || cliente?.email || "";
  const nifCif = doc.nifCif || cliente?.nifCif || "";
  const dirFact = doc.dirFact || cliente?.dirFact || "";
  const comercial = cliente ? comercialDistinto(cliente) : "";

  return (
    <div className="bg-zinc-50 rounded-lg p-4">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase">Cliente</p>
        {cliente?.numero && (
          <span className="text-xs font-mono font-bold text-zinc-400" title="Número de cliente">nº {cliente.numero}</span>
        )}
      </div>

      <p className="font-black text-zinc-900 text-xl leading-tight">{doc.cliente || "—"}</p>
      {comercial && <p className="text-sm text-zinc-600 mt-0.5">🏷 {comercial}</p>}

      <Fila icono="🪪" texto={nifCif} />
      <Fila icono="🏢" texto={dirFact} />
      {telefonos.map((t) => {
        const wa = paraWhatsapp(t);
        return (
          <Fila
            key={t}
            icono="📞"
            texto={t}
            href={`tel:${digitos(t)}`}
            accion={wa && (
              <a
                href={`https://wa.me/${wa}`}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 hover:bg-emerald-100"
              >
                💬 WhatsApp
              </a>
            )}
          />
        );
      })}
      <Fila icono="✉️" texto={email} href={email ? `mailto:${email}` : null} />

      {telefonos.length === 0 && !email && (
        <p className="text-xs text-zinc-400 mt-2 italic">
          Este cliente no tiene teléfono ni email guardados en su ficha.
        </p>
      )}
    </div>
  );
};

export default ClienteBloque;
