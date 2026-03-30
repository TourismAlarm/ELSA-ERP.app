export const inputClass = "w-full border-2 border-zinc-200 rounded-md px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors bg-white";

export const Input = (props) => <input {...props} className={inputClass} />;

export const Select = ({ value, onChange, children }) => (
  <select value={value} onChange={onChange} className={inputClass}>{children}</select>
);

export const Textarea = (props) => (
  <textarea {...props} rows={5} className="w-full border-2 border-zinc-200 rounded-md px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors bg-white resize-none" />
);
