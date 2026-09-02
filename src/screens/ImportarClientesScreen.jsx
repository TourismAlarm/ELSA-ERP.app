import { useState, useRef, useMemo } from "react";
import { Btn } from "../shared/components/ui";
import { leerCSV, revisarFilas, CAMPOS_CLIENTE, SE_IMPORTAN } from "../shared/lib/importar";

const ESTADOS = {
  nuevo:     { etiqueta: "Se creará",  clase: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  revisar:   { etiqueta: "Se creará ⚠", clase: "bg-sky-50 text-sky-700 border-sky-200" },
  duplicado: { etiqueta: "Ya existe",  clase: "bg-amber-50 text-amber-700 border-amber-200" },
  repetido:  { etiqueta: "Repetido",   clase: "bg-amber-50 text-amber-700 border-amber-200" },
  invalido:  { etiqueta: "Sin nombre", clase: "bg-red-50 text-red-700 border-red-200" },
};

const ImportarClientesScreen = ({ clientes = [], onImportar, onBack }) => {
  const [datos, setDatos] = useState(null);   // { encabezados, filas, columnas }
  const [columnas, setColumnas] = useState([]);
  const [nombreFichero, setNombreFichero] = useState("");
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const fileRef = useRef(null);

  const revision = useMemo(
    () => (datos ? revisarFilas(datos.filas, columnas, clientes) : []),
    [datos, columnas, clientes]
  );

  const nuevos = revision.filter((r) => SE_IMPORTAN.includes(r.estado));
  const hayNombre = columnas.includes("nombre");

  const elegirFichero = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResultado(null);

    const texto = await file.text();
    const leido = leerCSV(texto);
    if (leido.error) { alert(leido.error); return; }
    if (leido.filas.length === 0) { alert("El fichero tiene encabezados pero ninguna fila de datos."); return; }

    setNombreFichero(file.name);
    setDatos(leido);
    setColumnas(leido.columnas);
    if (fileRef.current) fileRef.current.value = "";
  };

  // Cambiar una columna a mano: si ese campo ya estaba asignado a otra
  // columna, se libera, para que no entren dos veces los mismos datos.
  const cambiarColumna = (indice, clave) => {
    setColumnas((prev) => prev.map((c, i) => {
      if (i === indice) return clave || null;
      return clave && c === clave ? null : c;
    }));
  };

  const importar = async () => {
    setImportando(true);
    const res = await onImportar(nuevos.map((r) => r.cliente));
    setImportando(false);
    setResultado(res);
    if (res.creados > 0) { setDatos(null); setColumnas([]); }
  };

  const empezarDeNuevo = () => {
    setDatos(null);
    setColumnas([]);
    setResultado(null);
    setNombreFichero("");
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={onBack} className="text-zinc-400 hover:text-zinc-900 transition-colors text-2xl leading-none">←</button>
        <div>
          <p className="text-xs font-bold tracking-widest text-zinc-400 uppercase mb-0.5">Clientes</p>
          <h1 className="text-3xl font-black text-zinc-900">Importar desde Excel</h1>
        </div>
      </div>

      {resultado && (
        <div className={`border-2 rounded-xl p-5 mb-6 ${resultado.fallidos > 0 ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"}`}>
          <p className="font-black text-zinc-900">
            {resultado.creados > 0 ? `✅ ${resultado.creados} clientes importados` : "No se ha importado ningún cliente"}
          </p>
          {resultado.fallidos > 0 && (
            <p className="text-sm text-amber-800 mt-1">
              {resultado.fallidos} no se han podido guardar. Revisa la lista de clientes y vuelve a importar solo los que falten.
            </p>
          )}
        </div>
      )}

      {/* ---------- paso 1: elegir fichero ---------- */}
      {!datos && (
        <>
          <div className="bg-white border-2 border-zinc-200 rounded-xl p-6 shadow-sm mb-5">
            <p className="text-sm font-black text-zinc-900 mb-3">Cómo sacar el fichero de Excel</p>
            <ol className="text-sm text-zinc-600 flex flex-col gap-2 list-decimal pl-5">
              <li>Abre tu hoja de clientes en Excel.</li>
              <li>La primera fila tiene que ser la de los títulos: Nombre, NIF, Teléfono...</li>
              <li><b>Archivo → Guardar como</b> y elige el tipo <b>CSV UTF-8 (delimitado por comas)</b>.</li>
              <li>Sube aquí ese fichero <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-xs">.csv</code>.</li>
            </ol>
            <p className="text-xs text-zinc-400 mt-4">
              No pasa nada si sobran columnas o si los títulos no son exactos: después podrás decir qué es cada una, y nada se guarda hasta que lo confirmes.
            </p>
          </div>

          <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={elegirFichero} />
          <Btn size="lg" className="w-full" onClick={() => fileRef.current?.click()}>
            📄 Elegir fichero CSV
          </Btn>
        </>
      )}

      {/* ---------- paso 2: revisar ---------- */}
      {datos && (
        <>
          <div className="bg-white border-2 border-zinc-200 rounded-xl p-5 shadow-sm mb-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-sm font-black text-zinc-900">{nombreFichero}</p>
                <p className="text-xs text-zinc-400 mt-0.5">{datos.filas.length} filas · {datos.encabezados.length} columnas</p>
              </div>
              <Btn size="sm" variant="secondary" onClick={empezarDeNuevo}>Cambiar fichero</Btn>
            </div>

            <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-2">Qué es cada columna</p>
            <div className="flex flex-col gap-2">
              {datos.encabezados.map((h, i) => (
                <div key={i} className="grid grid-cols-2 gap-3 items-center">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 truncate">{h || <span className="text-zinc-400 italic">sin título</span>}</p>
                    <p className="text-xs text-zinc-400 truncate">{datos.filas[0]?.[i] || "—"}</p>
                  </div>
                  <select
                    value={columnas[i] || ""}
                    onChange={(e) => cambiarColumna(i, e.target.value)}
                    className="w-full border-2 border-zinc-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:border-zinc-900"
                  >
                    <option value="">— No importar —</option>
                    {CAMPOS_CLIENTE.map((c) => (
                      <option key={c.clave} value={c.clave}>{c.etiqueta}{c.obligatorio ? " *" : ""}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {!hayNombre && (
              <p className="text-sm text-red-600 font-semibold mt-4">
                Falta indicar cuál es la columna del <b>Nombre fiscal</b>. Sin ella no se puede importar.
              </p>
            )}
          </div>

          {hayNombre && (
            <div className="bg-white border-2 border-zinc-200 rounded-xl p-5 shadow-sm mb-5">
              <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase mb-3">Qué va a pasar</p>
              <div className="flex flex-wrap gap-4 mb-4">
                {Object.entries(ESTADOS).map(([clave, cfg]) => {
                  const n = revision.filter((r) => r.estado === clave).length;
                  if (n === 0) return null;
                  return (
                    <div key={clave}>
                      <p className="text-2xl font-black text-zinc-900">{n}</p>
                      <p className="text-xs text-zinc-500">{cfg.etiqueta}</p>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-zinc-500">
                Se crean los marcados como «Se creará». Los que ya existen y los repetidos se dejan tal cual: no se toca ni se sobrescribe ningún cliente que ya tengas.
              </p>
              {revision.some((r) => r.estado === "revisar") && (
                <p className="text-xs text-sky-700 mt-2">
                  Los marcados con ⚠ comparten nombre o NIF con otro, pero traen su propio nº de cliente, así que se crean igualmente: en tu programa de facturación son fichas distintas y saltarse una dejaría su código sin cliente al que apuntar. Míralos después por si alguno sobra.
                </p>
              )}

              <div className="overflow-x-auto mt-4 -mx-5 px-5">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left text-xs text-zinc-400 uppercase tracking-widest">
                      <th className="py-2 pr-3 font-bold">Estado</th>
                      <th className="py-2 pr-3 font-bold">Nº</th>
                      <th className="py-2 pr-3 font-bold">Nombre</th>
                      <th className="py-2 pr-3 font-bold">NIF</th>
                      <th className="py-2 font-bold">Contacto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revision.slice(0, 50).map((r, i) => (
                      <tr key={i} className="border-t border-zinc-100">
                        <td className="py-2 pr-3">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded border whitespace-nowrap ${ESTADOS[r.estado].clase}`}>
                            {ESTADOS[r.estado].etiqueta}
                          </span>
                          {r.motivo && <span className="block text-[11px] text-zinc-400 mt-1">{r.motivo}</span>}
                        </td>
                        <td className="py-2 pr-3 font-mono text-xs text-zinc-500">{r.cliente.numero || "—"}</td>
                        <td className="py-2 pr-3 font-semibold text-zinc-900">
                          {r.cliente.nombre || <span className="text-zinc-300">—</span>}
                          {r.cliente.nombre_comercial && <span className="block text-xs font-normal text-zinc-500">🏷 {r.cliente.nombre_comercial}</span>}
                        </td>
                        <td className="py-2 pr-3 text-zinc-500">{r.cliente.nifCif || "—"}</td>
                        <td className="py-2 text-zinc-500 text-xs">{[r.cliente.tel, r.cliente.email].filter(Boolean).join(" · ") || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {revision.length > 50 && (
                  <p className="text-xs text-zinc-400 mt-3">Se muestran las 50 primeras de {revision.length}. Se importarán todas las marcadas.</p>
                )}
              </div>
            </div>
          )}

          <Btn size="lg" className="w-full" onClick={importar} disabled={!hayNombre || nuevos.length === 0 || importando}>
            {importando ? "Importando..." : `💾 Importar ${nuevos.length} cliente${nuevos.length === 1 ? "" : "s"}`}
          </Btn>
          <Btn size="md" variant="secondary" className="w-full" onClick={onBack}>Cancelar</Btn>
        </>
      )}
    </div>
  );
};

export default ImportarClientesScreen;
