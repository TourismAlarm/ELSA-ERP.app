import { PALETA } from "../../lib/color";

const ColorPicker = ({ value, onChange }) => {
  const esPersonalizado = !PALETA.some((c) => c.toLowerCase() === value?.toLowerCase());
  return (
    <div className="flex flex-wrap gap-2">
      {PALETA.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`w-8 h-8 rounded-full border-2 transition-transform ${
            value?.toLowerCase() === c.toLowerCase() ? "border-zinc-900 scale-110" : "border-white ring-1 ring-zinc-200 hover:scale-105"
          }`}
          style={{ backgroundColor: c }}
          title={c}
        />
      ))}
      <label
        className="w-8 h-8 rounded-full border-2 border-white ring-1 ring-zinc-200 hover:scale-105 transition-transform cursor-pointer relative overflow-hidden flex items-center justify-center text-xs"
        style={{ background: esPersonalizado && value ? value : "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }}
        title="Color personalizado"
      >
        <input
          type="color"
          value={value || "#3b82f6"}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
        {esPersonalizado && value && <span className="text-white drop-shadow">✓</span>}
      </label>
    </div>
  );
};

export default ColorPicker;
