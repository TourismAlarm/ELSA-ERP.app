import { useState } from "react";
import { supabase } from "../shared/lib/supabase";
import { Btn, Field, inputClass } from "../shared/components/ui";

const MIN_PWD = 6;

// Pantalla a la que se llega desde el enlace del correo de recuperación.
// En ese momento Supabase ya ha creado una sesión temporal, así que basta
// con llamar a updateUser para fijar la contraseña nueva.
const ResetPasswordScreen = ({ onDone, onCancel }) => {
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (pwd.length < MIN_PWD) return setError(`La contraseña debe tener al menos ${MIN_PWD} caracteres`);
    if (pwd !== pwd2) return setError("Las contraseñas no coinciden");

    setLoading(true);
    setError("");
    const { error: updateError } = await supabase.auth.updateUser({ password: pwd });
    setLoading(false);

    if (updateError) {
      setError("El enlace ha caducado o ya se ha usado. Pide uno nuevo desde la pantalla de inicio.");
      return;
    }
    setOk(true);
    setTimeout(onDone, 1200);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundImage: "radial-gradient(circle, #d4d4d4 1px, transparent 1px)", backgroundSize: "24px 24px" }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🔐</div>
          <h1 className="text-3xl font-black text-zinc-900">Nueva contraseña</h1>
          <p className="text-zinc-500 text-sm mt-1">Elige la contraseña con la que entrarás a partir de ahora</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white border-2 border-zinc-200 rounded-xl p-6 shadow-sm flex flex-col gap-4">
          <Field label="Nueva contraseña">
            <input
              type="password"
              value={pwd}
              onChange={(e) => { setPwd(e.target.value); setError(""); }}
              placeholder="••••••••"
              className={`${inputClass} ${error ? "border-red-400 focus:border-red-500" : ""}`}
              autoFocus
            />
          </Field>
          <Field label="Repite la contraseña">
            <input
              type="password"
              value={pwd2}
              onChange={(e) => { setPwd2(e.target.value); setError(""); }}
              placeholder="••••••••"
              className={`${inputClass} ${error ? "border-red-400 focus:border-red-500" : ""}`}
            />
            {error && <p className="text-red-500 text-xs font-semibold">{error}</p>}
            {ok && <p className="text-green-600 text-xs font-semibold">Contraseña actualizada</p>}
          </Field>
          <Btn size="lg" className="w-full" disabled={loading || !pwd || !pwd2}>
            {loading ? "Guardando..." : "💾 Guardar contraseña"}
          </Btn>
          <button
            type="button"
            onClick={onCancel}
            className="text-xs font-bold text-zinc-500 hover:text-zinc-900 underline underline-offset-2"
          >
            Cancelar
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPasswordScreen;
