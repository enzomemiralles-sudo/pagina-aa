import { redirect } from "next/navigation";
import { cache } from "react";
import { crearCliente } from "./supabase/server";

export type Yo = {
  id: string;
  nombre: string;
  rol: "integrante" | "responsable" | "seguimiento";
  estado: "pendiente" | "activo" | "en_pausa" | "baja";
  esCoord: boolean;
  esResponsable: boolean;
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

  const yo: Yo = {
    id: data.id,
    nombre: data.nombre,
    rol: data.rol,
    estado: data.estado,
    esCoord: data.estado === "activo" && (data.rol === "responsable" || data.rol === "seguimiento"),
    esResponsable: data.estado === "activo" && data.rol === "responsable",
  };
  return { supabase, yo };
});

export async function requerirCoord() {
  const r = await requerirMiembro();
  if (!r.yo.esCoord) redirect("/");
  return r;
}
