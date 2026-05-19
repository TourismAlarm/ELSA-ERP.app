const Field = ({ label, children }) => (
  <div className="flex flex-col gap-1.5">
    {label && <label className="text-xs font-bold text-zinc-500 tracking-widest uppercase">{label}</label>}
    {children}
  </div>
);

export default Field;
