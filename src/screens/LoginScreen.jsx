import { useState } from "react";
import { Btn, Field, inputClass } from "../components/ui";

export const PASSWORD_HASH = "82f61eafeaa2d4cf09ec71e6494c7b017602d4fa0e9a937d246c2b79979d9709";
export const AUTH_KEY = "elsa_auth_v1";

export const hashStr = async (str) => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
};

export const isAuthenticated = () => localStorage.getItem(AUTH_KEY) === PASSWORD_HASH;

const LoginScreen = ({ onLogin }) => {
  const [pwd, setPwd]         = useState("");
  const [error, setError]     = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(false);
    const hash = await hashStr(pwd);
    if (hash === PASSWORD_HASH) {
      localStorage.setItem(AUTH_KEY, hash);
      onLogin();
    } else {
      setError(true);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundImage: "radial-gradient(circle, #d4d4d4 1px, transparent 1px)", backgroundSize: "24px 24px" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🏗️</div>
          <h1 className="text-3xl font-black text-zinc-900">ELSA</h1>
          <p className="text-zinc-500 text-sm mt-1">Sistema de presupuestos</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white border-2 border-zinc-200 rounded-xl p-6 shadow-sm flex flex-col gap-4">
          <Field label="Contraseña">
            <input
              type="password"
              value={pwd}
              onChange={(e) => { setPwd(e.target.value); setError(false); }}
              placeholder="••••••••"
              className={`${inputClass} ${error ? "border-red-400 focus:border-red-500" : ""}`}
              autoFocus
            />
            {error && <p className="text-red-500 text-xs font-semibold">Contraseña incorrecta</p>}
          </Field>
          <Btn size="lg" className="w-full" disabled={loading || !pwd}>
            {loading ? "Verificando..." : "Entrar"}
          </Btn>
        </form>
      </div>
    </div>
  );
};

export default LoginScreen;
