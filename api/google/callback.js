// GET /api/google/callback?code=…&state=…  →  vuelta de Google tras dar
// permiso. Guarda la conexión y devuelve a la app, a Configuración.
//
// Aquí no llega la sesión de la app (es una redirección de Google), así que
// quién lo pidió va en el state firmado, y se vuelve a comprobar en la base
// de datos que esa persona sigue siendo admin.
import { admin } from "../_lib/supabase.js";
import { leerState, canjearCodigo, revocar, leerConexion } from "../_lib/googleApi.js";

const volver = (res, estado, detalle) => {
  const p = new URLSearchParams({ google: estado, ...(detalle ? { detalle } : {}) });
  res.setHeader("Cache-Control", "no-store");
  res.redirect(302, `/?${p}`);
};

export default async function handler(req, res) {
  const { code, state, error } = req.query || {};
  if (error) { volver(res, "error", error === "access_denied" ? "No se ha dado permiso en Google." : String(error)); return; }

  const usuarioId = leerState(state);
  if (!usuarioId || !code) { volver(res, "error", "El enlace ha caducado. Vuelve a pulsar «Conectar con Google»."); return; }

  try {
    const p = await admin(`perfiles?select=id&id=eq.${encodeURIComponent(usuarioId)}&activo=is.true&rol=eq.admin`);
    if (!p.ok || (await p.json()).length === 0) { volver(res, "error", "Solo administración puede conectar la cuenta de Google."); return; }

    const { refreshToken, cuenta } = await canjearCodigo(req, String(code));

    // Si había otra conexión, se retira en Google: un permiso que ya no se
    // usa no debe quedar vivo
    const anterior = await leerConexion().catch(() => null);

    const g = await admin("google_conexion?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ id: 1, refresh_token: refreshToken, cuenta, conectado_por: usuarioId, conectado_en: new Date().toISOString() }),
    });
    if (!g.ok) throw new Error(`No se ha podido guardar la conexión (${g.status})`);
    await admin("config?id=eq.1", { method: "PATCH", body: JSON.stringify({ google_cuenta: cuenta || "conectada" }) });

    if (anterior?.refresh_token && anterior.refresh_token !== refreshToken) revocar(anterior.refresh_token);
    volver(res, "conectado");
  } catch (e) {
    console.error(e);
    volver(res, "error", e.message || "No se ha podido conectar con Google.");
  }
}
