// Punteo sugerido con el criterio de Enzo (11/11/2026):
// - Arranca con el acta (quién la toma y se la pasa a la responsable).
// - Después, si hay, las operativas que bajan de arriba y las fechas de la agrupación de la semana.
// - Lo que quedó sin tratar en la reunión anterior.
// - El avance de cada proyecto, ordenado por urgencia (la actividad más próxima y los problemas primero),
//   cada uno con sus puntos: próxima actividad, trabadas, vencidas, sin responsable, propuesta para aprobar.
// - Los pendientes sueltos y los pedidos de las actualizaciones.
// - Ideas nuevas, si sobra tiempo.
// - Cierra con el repaso de tareas y las tareas libres para quienes no vinieron.
// Tiempo: de 18:35 a 19:40 (65 minutos). Lo que no entra queda como "para la próxima".
// Cuando Enzo corrige el borrador, la diferencia queda guardada en reuniones.borrador_punteo para ajustar estas reglas.
import { fechaCorta, fechaDia, sumarDias } from "./fechas";

export const INICIO = "18:35";
export const FIN = "19:40";
export const MINUTOS_REUNION = 65;

export type TemaSugerido = {
  clave: string;
  titulo: string;
  origen: string;
  puntos: string[];
  minutos: number;
  proyectoId?: string | null;
  prioridad: number;
  entra?: boolean;
};

type Datos = {
  fechaReunion: string;
  responsable: string;
  proyectos: { id: string; nombre: string; estado: string }[];
  actividades: { id: string; nombre: string; fecha: string | null; proyecto_id: string | null; estado: string }[];
  tareas: { titulo: string; estado: string; vence: string | null; quien: string | null; proyecto_id: string | null; actividad_id: string | null; nota_trabada?: string | null }[];
  pendientesAnteriores: { titulo: string; proyecto_id: string | null }[];
  pedidos: { quien: string; texto: string }[];
  ideas: { titulo: string }[];
  eventos: { titulo: string; fecha: string; hora: string | null }[];
};

export function armarBorrador(d: Datos): { temas: TemaSugerido[]; quedan: TemaSugerido[] } {
  const hoy = d.fechaReunion;
  const proyectoDeActividad = new Map(d.actividades.map((a) => [a.id, a.proyecto_id]));
  const proyectoDe = (t: { proyecto_id: string | null; actividad_id: string | null }) =>
    t.proyecto_id ?? (t.actividad_id ? proyectoDeActividad.get(t.actividad_id) ?? null : null);

  const candidatos: TemaSugerido[] = [];

  if (d.eventos.length) {
    candidatos.push({
      clave: "operativas",
      titulo: "Operativas y fechas de la agrupación",
      origen: "Operativa",
      puntos: d.eventos.map((e) => `${e.titulo}: ${fechaDia(e.fecha)}${e.hora ? ` a las ${e.hora}` : ""}`),
      minutos: 5,
      prioridad: 100,
    });
  }

  d.pendientesAnteriores.forEach((t, i) =>
    candidatos.push({ clave: `ant${i}`, titulo: t.titulo, origen: "Quedó de la reunión anterior", puntos: [], minutos: 5, proyectoId: t.proyecto_id, prioridad: 90 }),
  );

  for (const p of d.proyectos) {
    const acts = d.actividades.filter((a) => a.proyecto_id === p.id && a.estado !== "cancelada");
    const proximas = acts.filter((a) => a.fecha && a.fecha >= hoy).sort((a, b) => (a.fecha! < b.fecha! ? -1 : 1));
    const sinFecha = acts.filter((a) => !a.fecha);
    const ts = d.tareas.filter((t) => proyectoDe(t) === p.id);
    const trabadas = ts.filter((t) => t.estado === "trabada");
    const vencidas = ts.filter((t) => t.estado !== "trabada" && t.vence && t.vence < hoy);
    const semana = ts.filter((t) => t.estado !== "trabada" && t.vence && t.vence >= hoy && t.vence <= sumarDias(hoy, 7));
    const sinQuien = ts.filter((t) => !t.quien);

    const puntos: string[] = [];
    if (p.estado === "propuesta") puntos.push("Está como propuesta: ¿lo aprobamos?");
    if (proximas[0]) puntos.push(`Próxima: ${proximas[0].nombre}, ${fechaDia(proximas[0].fecha)}`);
    if (sinFecha.length) puntos.push(`Falta fecha: ${sinFecha.map((a) => a.nombre).join(", ")}`);
    trabadas.slice(0, 3).forEach((t) => puntos.push(`Trabada: ${t.titulo}${t.quien ? ` (${t.quien})` : ""}${t.nota_trabada ? ` · ${t.nota_trabada}` : ""}`));
    vencidas.slice(0, 3).forEach((t) => puntos.push(`Vencida: ${t.titulo}${t.quien ? ` (${t.quien}` : " (sin responsable"}, era el ${fechaCorta(t.vence)})`));
    if (vencidas.length > 3) puntos.push(`Y ${vencidas.length - 3} vencidas más`);
    if (semana.length) puntos.push(`Vencen esta semana: ${semana.length}`);
    if (sinQuien.length) puntos.push(`${sinQuien.length} ${sinQuien.length === 1 ? "tarea sin responsable" : "tareas sin responsable"}`);
    if (!puntos.length) puntos.push("¿Cómo viene?");

    const problemas = trabadas.length + vencidas.length;
    const dias = proximas[0] ? (new Date(proximas[0].fecha!).getTime() - new Date(hoy).getTime()) / 86400000 : 30;
    const minutos = Math.min(15, p.estado === "propuesta" ? 10 : puntos[0] === "¿Cómo viene?" ? 3 : 5 + 2 * problemas + (dias <= 14 ? 3 : 0) + (sinFecha.length ? 2 : 0));
    candidatos.push({
      clave: `p${p.id}`,
      titulo: `${p.nombre}: avance`,
      origen: "Proyecto",
      puntos,
      minutos,
      proyectoId: p.id,
      prioridad: 80 - Math.min(dias, 30) + 3 * problemas + (p.estado === "propuesta" ? 5 : 0),
    });
  }

  const sueltas = d.tareas.filter((t) => !proyectoDe(t) && (t.estado === "trabada" || (t.vence && t.vence < hoy)));
  if (d.pedidos.length || sueltas.length) {
    candidatos.push({
      clave: "pendientes",
      titulo: "Pendientes y pedidos",
      origen: "Pendientes",
      puntos: [
        ...d.pedidos.map((x) => `${x.quien} necesita: ${x.texto}`),
        ...sueltas.slice(0, 5).map((t) => `${t.estado === "trabada" ? "Trabada" : "Vencida"}: ${t.titulo}${t.quien ? ` (${t.quien})` : ""}`),
      ],
      minutos: Math.min(10, 3 + d.pedidos.length + sueltas.length),
      prioridad: 75,
    });
  }

  if (d.ideas.length) {
    candidatos.push({ clave: "ideas", titulo: "Ideas nuevas", origen: "Banco de ideas", puntos: d.ideas.map((i) => i.titulo), minutos: Math.min(8, 2 + d.ideas.length), prioridad: 20 });
  }

  // Elegir por prioridad hasta llenar el tiempo (descontando acta y repaso).
  const acta: TemaSugerido = { clave: "acta", titulo: `📝 Acta: quién la toma y se la pasa a ${d.responsable}`, origen: "Fijo", puntos: [], minutos: 2, prioridad: 1000 };
  const repaso: TemaSugerido = { clave: "repaso", titulo: "Repaso de tareas y tareas libres", origen: "Fijo", puntos: ["Quién hace qué y para cuándo", "Qué queda libre para los que no vinieron"], minutos: 8, prioridad: 1000 };
  let libre = MINUTOS_REUNION - acta.minutos - repaso.minutos;
  for (const c of [...candidatos].sort((a, b) => b.prioridad - a.prioridad)) {
    c.entra = c.minutos <= libre;
    if (c.entra) libre -= c.minutos;
  }
  const orden = (c: TemaSugerido) => (c.origen === "Operativa" ? 0 : c.origen.startsWith("Quedó") ? 1 : c.origen === "Proyecto" ? 2 : c.origen === "Pendientes" ? 3 : 4);
  const dentro = candidatos.filter((c) => c.entra).sort((a, b) => orden(a) - orden(b) || b.prioridad - a.prioridad);
  return { temas: [{ ...acta, entra: true }, ...dentro, { ...repaso, entra: true }], quedan: candidatos.filter((c) => !c.entra) };
}

/** Hora de inicio de cada tema según los minutos ("18:35", "18:37", …). */
export function horarios(minutos: (number | null)[], inicio = INICIO): string[] {
  const [h, m] = inicio.split(":").map(Number);
  let t = h * 60 + m;
  return minutos.map((x) => {
    const s = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
    t += x ?? 5;
    return s;
  });
}

/** Texto del punteo para WhatsApp. */
export function textoPunteo(
  encabezado: string,
  temas: { titulo: string; puntos: string | null; minutos: number | null; origen?: string | null }[],
  responsable: string,
): string {
  const tieneActa = temas.some((t) => /acta/i.test(t.titulo));
  return [
    encabezado,
    `🕕 18:15 en la puerta del aula · ${INICIO} arrancamos · ${FIN} terminamos`,
    "",
    "Punteo:",
    ...temas.flatMap((t, i) => [
      `${i + 1}. ${t.titulo}${t.minutos ? ` (${t.minutos}')` : ""}`,
      ...(t.puntos ?? "").split("\n").map((p) => p.trim()).filter(Boolean).map((p) => `   – ${p}`),
    ]),
    ...(tieneActa ? [] : ["", `📝 Acta: alguien la toma y se la pasa a ${responsable} por WhatsApp al terminar, con cada tarea con nombre y fecha, y las que quedan libres para quienes no vinieron.`]),
  ].join("\n");
}
