const Btn = ({ children, onClick, variant = "primary", size = "md", className = "", disabled = false }) => {
  const base = "inline-flex items-center justify-center gap-2 font-bold tracking-wide transition-all duration-150 cursor-pointer border-2 select-none disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary:   "bg-zinc-900 text-white border-zinc-900 hover:bg-zinc-700 hover:border-zinc-700",
    secondary: "bg-white text-zinc-900 border-zinc-300 hover:border-zinc-900 hover:bg-zinc-50",
    danger:    "bg-white text-red-600 border-red-200 hover:bg-red-600 hover:text-white hover:border-red-600",
    ghost:     "bg-transparent text-zinc-600 border-transparent hover:bg-zinc-100 hover:text-zinc-900",
    whatsapp:  "bg-green-500 text-white border-green-500 hover:bg-green-600 hover:border-green-600",
    email:     "bg-blue-600 text-white border-blue-600 hover:bg-blue-700 hover:border-blue-700",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-xs rounded",
    md: "px-5 py-2.5 text-sm rounded-md",
    lg: "px-7 py-4 text-base rounded-lg",
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}>
      {children}
    </button>
  );
};

export default Btn;
