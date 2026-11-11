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

// PROVISORIO (mientras no todos tengan cuenta): a quién se le puede asignar una tarea.
// Las personas con cuenta van con su id; las de la lista de compañeros sin cuenta, con "n:<id de nomina>".
export async function responsablesPosibles(supabase: Cliente, personas?: Persona[]): Promise<Persona[]> {
  const [con, { data }] = await Promise.all([
    personas ? Promise.resolve(personas) : personasActivas(supabase),
    supabase.from("nomina").select("id, nombre, integrante_id").is("integrante_id", null).eq("activo", true).order("nombre"),
  ]);
  const sinCuenta = ((data ?? []) as { id: string; nombre: string; integrante_id: string | null }[]).filter((n) => !n.integrante_id).map((n) => ({ id: `n:${n.id}`, nombre: n.nombre, estado: "activo", rol: "sin_cuenta" }) as Persona);
  return [...con, ...sinCuenta];
}

/** Clave del responsable de una tarea (con o sin cuenta), para buscar el nombre en responsablesPosibles. */
export function claveResponsable(t: { responsable_id?: string | null; responsable_nomina_id?: string | null }): string | null {
  return t.responsable_id ?? (t.responsable_nomina_id ? `n:${t.responsable_nomina_id}` : null);
}

/** Valor del selector de responsable → columnas de la tarea. */
export function separarResponsable(valor: string | null): { responsable_id: string | null; responsable_nomina_id: string | null } {
  if (valor?.startsWith("n:")) return { responsable_id: null, responsable_nomina_id: valor.slice(2) };
  return { responsable_id: valor, responsable_nomina_id: null };
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
    responsables: await responsablesPosibles(supabase, personas),
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
  enlace?: string | null;
  responsable_nomina_id?: string | null;
  canal?: string | null;
  proyectos?: { nombre: string } | null;
  actividades?: { nombre: string } | null;
};

export const SELECT_TAREA =
  "id, titulo, estado, vence, responsable_id, responsable_nomina_id, nota_trabada, proyecto_id, actividad_id, updated_at, hecha_at, created_by, enlace, canal, proyectos(nombre), actividades(nombre)";

export function contextoTarea(t: Tarea): string {
  return t.proyectos?.nombre ?? t.actividades?.nombre ?? "Comisión";
}

export function ordenarTareas(a: Tarea, b: Tarea) {
  const peso = (t: Tarea) => (t.estado === "trabada" ? 0 : 1);
  if (peso(a) !== peso(b)) return peso(a) - peso(b);
  return (a.vence ?? "9999") < (b.vence ?? "9999") ? -1 : 1;
}
