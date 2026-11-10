import { redirect } from "next/navigation";
import { cache } from "react";
import { crearCliente } from "./supabase/server";

export type Yo = {
  id: string;
  nombre: string;
  rol: "integrante" | "responsable" | "seguimiento" | "columna";
  estado: "pendiente" | "activo" | "en_pausa" | "baja";
  esCoord: boolean;
  esResponsable: boolean;
  /** Columna: releva la asistencia a las reuniones (no administra). */
  esColumna: boolean;
  /** Coordinación o Columna: lleva la asistencia y la logística de la reunión. */
  llevaAsistencia: boolean;
};

/** Devuelve el cliente y la persona logueada. Redirige si no está logueada o no fue aprobada. */
export const requerirMiembro = cache(async () => {
  const supabase = await crearCliente();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("integrantes")
    .select("id, nombre, rol, estado")
    .eq("id", user.id)
    .single();

  if (!data || data.estado === "pendiente" || data.estado === "baja") redirect("/pendiente");

  const esCoord = data.estado === "activo" && (data.rol === "responsable" || data.rol === "seguimiento");
  const esColumna = data.estado === "activo" && data.rol === "columna";
  const yo: Yo = {
    id: data.id,
    nombre: data.nombre,
    rol: data.rol,
    estado: data.estado,
    esCoord,
    esResponsable: data.estado === "activo" && data.rol === "responsable",
    esColumna,
    llevaAsistencia: esCoord || esColumna,
  };
  return { supabase, yo };
});

export async function requerirCoord() {
  const r = await requerirMiembro();
  if (!r.yo.esCoord) redirect("/");
  return r;
}

export async function requerirAsistencia() {
  const r = await requerirMiembro();
  if (!r.yo.llevaAsistencia) redirect("/");
  return r;
}
