import { Children, cloneElement, isValidElement, useId } from "react";

// La etiqueta queda asociada al control (htmlFor → id): pulsarla enfoca el
// campo y los lectores de pantalla leen el nombre del campo. Si el hijo ya
// trae su propio id se respeta; si hay varios hijos, se asocia el primero.
const Field = ({ label, children }) => {
  const idAuto = useId();
  const hijos = Children.toArray(children);
  const primero = hijos[0];
  const asociable = isValidElement(primero) && typeof primero.type !== "symbol";
  const id = asociable ? primero.props.id || idAuto : undefined;
  const contenido = asociable && !primero.props.id
    ? [cloneElement(primero, { id }), ...hijos.slice(1)]
    : hijos;

  return (
    <div className="flex flex-col gap-1.5">
      {label && <label htmlFor={id} className="text-xs font-bold text-zinc-500 tracking-widest uppercase">{label}</label>}
      {contenido}
    </div>
  );
};

export default Field;
