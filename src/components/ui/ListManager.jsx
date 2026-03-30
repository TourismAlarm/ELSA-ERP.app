import { useState } from "react";
import { inputClass } from "./Input";

const ListManager = ({ items, onChange }) => {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v || items.includes(v)) return;
    onChange([...items, v]);
    setDraft("");
  };
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3 min-h-8">
        {items.map((item) => (
          <span key={item} className="flex items-center gap-1.5 bg-zinc-100 border border-zinc-200 text-zinc-800 text-xs font-semibold px-3 py-1.5 rounded-full">
            {item}
            <button type="button" onClick={() => onChange(items.filter((i) => i !== item))} className="text-zinc-400 hover:text-red-500 transition-colors leading-none">×</button>
          </span>
        ))}
        {items.length === 0 && <span className="text-xs text-zinc-400 italic self-center">Sin elementos</span>}
      </div>
      <div className="flex gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Nuevo elemento..." className={inputClass + " py-2"} />
        <button type="button" onClick={add} className="px-4 py-2 bg-zinc-900 text-white text-sm font-bold rounded-md hover:bg-zinc-700 transition-colors shrink-0">+ Añadir</button>
      </div>
    </div>
  );
};

export default ListManager;
