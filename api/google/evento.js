// POST /api/google/evento  →  mover, cambiar o borrar desde el ERP un evento
// que se creó en Google Calendar. Lo que se cambia aquí se cambia en Google.
//
//   { accion: "mover",  calendarioId, eventoId, fecha, hora_inicio }
//   { accion: "editar", calendarioId, eventoId, titulo, notas, ubicacion,
//                       fecha, fecha_fin, hora_inicio, hora_fin, todo_el_dia }
//   { accion: "borrar", calendarioId, eventoId }
//
// Solo en los calendarios propios de la cuenta conectada, y nunca los que
// escribió el propio ERP (esos son servicios: se cambian como servicio).
// Cualquier usuario activo, igual que puede mover un servicio.
import { quienEs } from "../_lib/supabase.js";
import {
  leerConexion, tokenAcceso, listarCalendarios, leerEvento, cambiarEvento,
  borrarEventoGoogle, tiemposAlMover, tiemposAlEditar,
} from "../_lib/googleApi.js";
import { eventoDeGoogle, esEventoDelERP } from "../_lib/google.js";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^\d{2}:\d{2}$/;
const corta = (h) => (h ? String(h).slice(0, 5) : null);

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.status(405).json({ error: "Método no permitido" }); return; }
  const yo = await quienEs(req);
  if (!yo?.activo) { res.status(401).json({ error: "Sin sesión" }); return; }

  const b = req.body || {};
  const { accion, calendarioId, eventoId } = b;
  if (!["mover", "editar", "borrar"].includes(accion) || !calendarioId || !eventoId) {
    res.status(400).json({ error: "Petición incompleta" });
    return;
  }
  if (esEventoDelERP(eventoId)) { res.status(400).json({ error: "Este evento es un servicio del ERP: cámbialo desde el servicio." }); return; }
  const fecha = b.fecha;
  if (accion !== "borrar" && !FECHA.test(String(fecha || ""))) { res.status(400).json({ error: "Falta la fecha" }); return; }
  const hi = corta(b.hora_inicio);
  const hf = corta(b.hora_fin);
  if ((hi && !HORA.test(hi)) || (hf && !HORA.test(hf)) || (b.fecha_fin && !FECHA.test(b.fecha_fin))) {
    res.status(400).json({ error: "Fecha u hora no válidas" });
    return;
  }

  try {
    const conexion = await leerConexion();
    if (!conexion) { res.status(409).json({ error: "La cuenta de Google no está conectada." }); return; }
    const token = await tokenAcceso(conexion.refresh_token);
    const calendario = (await listarCalendarios(token)).find((c) => c.id === calendarioId);
    if (!calendario) { res.status(403).json({ error: "Ese calendario no es de la cuenta conectada o no se puede escribir en él." }); return; }

    if (accion === "borrar") {
      await borrarEventoGoogle(token, calendarioId, eventoId);
      res.status(200).json({ ok: true });
      return;
    }

    let cambios;
    if (accion === "mover") {
      cambios = tiemposAlMover(await leerEvento(token, calendarioId, eventoId), { fecha, hora_inicio: hi });
    } else {
      cambios = {
        summary: String(b.titulo || "").trim() || "(sin título)",
        description: String(b.notas || ""),
        location: String(b.ubicacion || ""),
        ...tiemposAlEditar({ fecha, fecha_fin: b.fecha_fin || null, hora_inicio: hi, hora_fin: hf, todo_el_dia: !!b.todo_el_dia }),
      };
    }
    const ev = await cambiarEvento(token, calendarioId, eventoId, cambios);
    res.status(200).json({ ok: true, evento: eventoDeGoogle(ev, calendario) });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: e.message || "No se ha podido cambiar en Google" });
  }
}
