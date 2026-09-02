import { useState } from "react";

// Botón para volver a leer los datos sin cerrar y abrir la aplicación. Hace
// falta sobre todo con la app instalada en el móvil, donde no hay botón de
// recargar del navegador: si alguien crea un servicio desde otro aparato, esta
// es la forma de verlo.
//
// Va abajo a la izquierda, enfrente del botón de búsqueda, que ocupa la
// derecha en las pantallas de lista.
const BotonRefrescar = ({ onRefrescar, refrescando }) => {
  const [hecho, setHecho] = useState(false);

  const pulsar = async () => {
    if (refrescando) return;
    await onRefrescar();
    // Confirmación breve: sin ella no se sabe si ha hecho algo cuando no hay
    // ningún cambio que ver
    setHecho(true);
    setTimeout(() => setHecho(false), 1600);
  };

  return (
    <>
      <button
        onClick={pulsar}
        disabled={refrescando}
        aria-label="Actualizar datos"
        title="Actualizar datos"
        className="fixed bottom-6 left-6 w-14 h-14 bg-white border-2 border-zinc-300 text-zinc-700 rounded-full shadow-lg flex items-center justify-center text-xl transition-all hover:border-zinc-900 hover:text-zinc-900 active:scale-95 disabled:opacity-70 z-50"
      >
        <span className={refrescando ? "animate-spin inline-block" : "inline-block"}>🔄</span>
      </button>

      {hecho && !refrescando && (
        <div className="fixed bottom-24 left-6 bg-zinc-900 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-lg z-50">
          Actualizado
        </div>
      )}
    </>
  );
};

export default BotonRefrescar;
