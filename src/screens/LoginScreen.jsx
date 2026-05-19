import { useState } from "react";
import { supabase } from "../shared/lib/supabase";
import { Btn, Field, inputClass } from "../shared/components/ui";

const LoginScreen = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password: pwd,
    });

    if (authError) {
      setError("Email o contraseña incorrectos");
    } else if (data.session) {
      onLogin(data.session);
    }
    setLoading(false);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundImage: "radial-gradient(circle, #d4d4d4 1px, transparent 1px)", backgroundSize: "24px 24px" }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🏗️</div>
          <h1 className="text-3xl font-black text-zinc-900">ELSA</h1>
          <p className="text-zinc-500 text-sm mt-1">Sistema de presupuestos</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white border-2 border-zinc-200 rounded-xl p-6 shadow-sm flex flex-col gap-4">
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              placeholder="correo@empresa.com"
              className={`${inputClass} ${error ? "border-red-400 focus:border-red-500" : ""}`}
              autoFocus
            />
          </Field>
          <Field label="Contraseña">
            <input
              type="password"
              value={pwd}
              onChange={(e) => { setPwd(e.target.value); setError(""); }}
              placeholder="••••••••"
              className={`${inputClass} ${error ? "border-red-400 focus:border-red-500" : ""}`}
            />
            {error && <p className="text-red-500 text-xs font-semibold">{error}</p>}
          </Field>
          <Btn size="lg" className="w-full" disabled={loading || !email || !pwd}>
            {loading ? "Verificando..." : "Entrar"}
          </Btn>
        </form>
      </div>
    </div>
  );
};

export default LoginScreen;
