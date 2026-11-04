// Consultas compartidas entre pantallas.
import type { crearCliente } from "./supabase/server";

type Cliente = Awaited<ReturnType<typeof crearCliente>>;

export type Persona = { id: string; nombre: string; estado: string; rol: string };

export async function personasActivas(supabase: Cliente): Promise<Persona[]> {
  const { data } = await supabase
    .from("integrantes")
    .select("id, nombre, estado, rol")
    .in("estado", ["activo", "en_pausa"])
    .order("nombre");
  return (data ?? []) as Persona[];
}

export async function listasBase(supabase: Cliente) {
  const [lineas, mesas, proyectos, personas] = await Promise.all([
    supabase.from("lineas").select("id, nombre").order("orden"),
    supabase.from("mesas").select("id, nombre").neq("estado", "cerrada").order("nombre"),
    supabase.from("proyectos").select("id, nombre, estado").not("estado", "in", "(descartado,terminado)").order("nombre"),
    personasActivas(supabase),
  ]);
  return {
    lineas: (lineas.data ?? []) as { id: string; nombre: string }[],
    mesas: (mesas.data ?? []) as { id: string; nombre: string }[],
    proyectos: (proyectos.data ?? []) as { id: string; nombre: string; estado: string }[],
    personas,
  };
}

export function nombreDe(personas: Persona[], id: string | null | undefined): string {
  if (!id) return "Sin asignar";
  return personas.find((p) => p.id === id)?.nombre ?? "—";
}

export type Tarea = {
  id: string;
  titulo: string;
  estado: string;
  vence: string | null;
  responsable_id: string | null;
  nota_trabada: string | null;
  proyecto_id: string | null;
  actividad_id: string | null;
  updated_at: string;
  hecha_at: string | null;
  created_by: string | null;
  proyectos?: { nombre: string } | null;
  actividades?: { nombre: string } | null;
};

export const SELECT_TAREA =
  "id, titulo, estado, vence, responsable_id, nota_trabada, proyecto_id, actividad_id, updated_at, hecha_at, created_by, proyectos(nombre), actividades(nombre)";

export function contextoTarea(t: Tarea): string {
  return t.proyectos?.nombre ?? t.actividades?.nombre ?? "Comisión";
}

export function ordenarTareas(a: Tarea, b: Tarea) {
  const peso = (t: Tarea) => (t.estado === "trabada" ? 0 : 1);
  if (peso(a) !== peso(b)) return peso(a) - peso(b);
  return (a.vence ?? "9999") < (b.vence ?? "9999") ? -1 : 1;
}
