import { useState } from "react";
import { supabase } from "../shared/lib/supabase";
import { Btn, Field, inputClass } from "../shared/components/ui";

const LoginScreen = ({ onLogin }) => {
  const [tab, setTab] = useState("login"); // "login" | "recuperar"
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [loading, setLoading] = useState(false);

  const cambiarTab = (nuevo) => {
    setTab(nuevo);
    setError("");
    setAviso("");
    setPwd("");
  };

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

  // Envía el correo con el enlace de recuperación. Al volver desde el enlace,
  // la app detecta la sesión de recuperación y muestra la pantalla de nueva contraseña.
  const handleRecuperar = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setAviso("");

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}${window.location.pathname}`,
    });

    if (resetError) {
      setError("No se ha podido enviar el correo. Inténtalo de nuevo en unos minutos.");
    } else {
      setAviso("Si ese email tiene cuenta, te hemos enviado un enlace para crear una contraseña nueva. Revisa también la carpeta de spam.");
    }
    setLoading(false);
  };

  const tabClass = (activo) =>
    `flex-1 py-2.5 text-sm font-black rounded-lg transition-colors ${
      activo ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
    }`;

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

        <div className="flex gap-1.5 bg-white border-2 border-zinc-200 rounded-xl p-1.5 mb-4">
          <button type="button" onClick={() => cambiarTab("login")} className={tabClass(tab === "login")}>
            🔑 Entrar
          </button>
          <button type="button" onClick={() => cambiarTab("recuperar")} className={tabClass(tab === "recuperar")}>
            🔓 Recuperar
          </button>
        </div>

        {tab === "login" ? (
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
            <button
              type="button"
              onClick={() => cambiarTab("recuperar")}
              className="text-xs font-bold text-zinc-500 hover:text-zinc-900 underline underline-offset-2"
            >
              ¿Has olvidado la contraseña?
            </button>
          </form>
        ) : (
          <form onSubmit={handleRecuperar} className="bg-white border-2 border-zinc-200 rounded-xl p-6 shadow-sm flex flex-col gap-4">
            <p className="text-xs text-zinc-500 leading-relaxed">
              Escribe el email de tu cuenta y te enviaremos un enlace para poner una contraseña nueva.
            </p>
            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); setAviso(""); }}
                placeholder="correo@empresa.com"
                className={`${inputClass} ${error ? "border-red-400 focus:border-red-500" : ""}`}
                autoFocus
              />
              {error && <p className="text-red-500 text-xs font-semibold">{error}</p>}
              {aviso && <p className="text-green-600 text-xs font-semibold">{aviso}</p>}
            </Field>
            <Btn size="lg" className="w-full" disabled={loading || !email}>
              {loading ? "Enviando..." : "📧 Enviar enlace"}
            </Btn>
            <button
              type="button"
              onClick={() => cambiarTab("login")}
              className="text-xs font-bold text-zinc-500 hover:text-zinc-900 underline underline-offset-2"
            >
              Volver a entrar
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default LoginScreen;
