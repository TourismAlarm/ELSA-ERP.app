import { supabase, cargarTodas } from "../../shared/lib/supabase";

// Tipos de evento. El icono y el color salen de aquí, así que un evento sin
// color propio ya se distingue de un servicio de un vistazo.
export const TIPOS_EVENTO = {
  visita:   { etiqueta: "Visita",      emoji: "👥", color: "#6366f1" },
  ausencia: { etiqueta: "Ausencia",    emoji: "🌴", color: "#14b8a6" },
  taller:   { etiqueta: "Taller",      emoji: "🔧", color: "#78716c" },
  aviso:    { etiqueta: "Recordatorio", emoji: "📌", color: "#f97316" },
  otro:     { etiqueta: "Otro",        emoji: "📅", color: "#a855f7" },
};

export const tipoDe = (e) => TIPOS_EVENTO[e?.tipo] || TIPOS_EVENTO.otro;
export const colorDe = (e) => e?.color || tipoDe(e).color;

// Un evento de un día tiene fecha_fin vacía; uno de varios, la de cierre
export const diasDelEvento = (e) => {
  const ini = e.fecha;
  const fin = e.fecha_fin && e.fecha_fin > e.fecha ? e.fecha_fin : e.fecha;
  const dias = [];
  const d = new Date(ini + "T00:00:00");
  const hasta = new Date(fin + "T00:00:00");
  // Tope de seguridad: un rango disparatado no debe colgar el calendario
  while (d <= hasta && dias.length < 400) {
    dias.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    );
    d.setDate(d.getDate() + 1);
  }
  return dias;
};

const sanitize = (e) => ({
  titulo: (e.titulo || "").trim(),
  tipo: e.tipo || "otro",
  fecha: e.fecha,
  // Un rango de un solo día se guarda sin fecha_fin, para no arrastrar ruido
  fecha_fin: e.fecha_fin && e.fecha_fin > e.fecha ? e.fecha_fin : null,
  // Los eventos de todo el día no llevan hora: guardar una sobrante haría que
  // el calendario los intentara colocar en la rejilla horaria
  hora_inicio: e.todo_el_dia ? null : (e.hora_inicio || null),
  hora_fin:    e.todo_el_dia ? null : (e.hora_fin || null),
  todo_el_dia: !!e.todo_el_dia,
  notas: (e.notas || "").trim() || null,
  color: e.color || null,
  vehiculo_id: e.vehiculo_id || null,
});

// null cuando la carga falla, para distinguirlo de "no hay eventos"
export const dbLoadEventos = async () => cargarTodas("eventos", { orden: "fecha" });

export const dbSaveEvento = async (evento) => {
  const { data, error } = await supabase.from("eventos").insert([sanitize(evento)]).select().single();
  if (error) { console.error(error); alert("Error al guardar el evento: " + error.message); return null; }
  return data;
};

export const dbUpdateEvento = async (evento) => {
  const { error } = await supabase.from("eventos").update(sanitize(evento)).eq("id", evento.id);
  if (error) { console.error(error); alert("Error al guardar el evento: " + error.message); return false; }
  return true;
};

export const dbDeleteEvento = async (id) => {
  const { error } = await supabase.from("eventos").delete().eq("id", id);
  if (error) { console.error(error); alert("Error al borrar el evento: " + error.message); return false; }
  return true;
};
