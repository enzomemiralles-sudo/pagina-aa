"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearCliente } from "@/lib/supabase/server";
import { GUIAS, PLANTILLAS } from "@/lib/etiquetas";
import { hoyBA, lunesDe, semanaActual, sumarDias } from "@/lib/fechas";
import { separarDdos } from "@/lib/ddo";

// ---------- utilidades ----------
function txt(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  if (v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

async function avisar(texto: string, tipo: "rojo" | "verde" = "rojo") {
  (await cookies()).set("aviso", JSON.stringify({ texto, tipo }), { path: "/", maxAge: 60, sameSite: "lax" });
}

function traducir(msg: string): string {
  if (msg.includes("row-level security")) return "No tenés permiso para hacer eso.";
  if (msg.includes("violates foreign key")) return "Falta un dato relacionado (puede que se haya borrado).";
  if (msg.includes("invalid input syntax for type date")) return "La fecha no es válida.";
  return msg;
}

async function fallo(error: { message: string } | null): Promise<boolean> {
  if (!error) return false;
  await avisar(traducir(error.message));
  return true;
}

function refrescar() {
  revalidatePath("/", "layout");
}

async function cliente() {
  const supabase = await crearCliente();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, uid: user.id };
}

// ---------- tareas ----------
export async function crearTarea(fd: FormData) {
  const { supabase, uid } = await cliente();
  const titulo = txt(fd, "titulo");
  if (!titulo) return void (await avisar("La tarea necesita un título."));
  const { error } = await supabase.from("tareas").insert({
    titulo,
    responsable_id: txt(fd, "responsable_id") ?? uid,
    vence: txt(fd, "vence"),
    proyecto_id: txt(fd, "proyecto_id"),
    actividad_id: txt(fd, "actividad_id"),
    reunion_id: txt(fd, "reunion_id"),
    tema_id: txt(fd, "tema_id"),
  });
  if (await fallo(error)) return;
  refrescar();
  const ir = txt(fd, "ir_a");
  if (ir) {
    await avisar("Tarea cargada.", "verde");
    redirect(ir);
  }
}

export async function cambiarEstadoTarea(fd: FormData) {
  const { supabase } = await cliente();
  const id = txt(fd, "id");
  const estado = txt(fd, "estado");
  if (!id || !estado) return;
  const { error } = await supabase
    .from("tareas")
    .update({ estado, nota_trabada: estado === "trabada" ? txt(fd, "nota_trabada") : null })
    .eq("id", id);
  if (await fallo(error)) return;
  refrescar();
}

export async function cambiarVenceTarea(fd: FormData) {
  const { supabase } = await cliente();
  const id = txt(fd, "id");
  if (!id) return;
  const { error } = await supabase.from("tareas").update({ vence: txt(fd, "vence") }).eq("id", id);
  if (await fallo(error)) return;
  refrescar();
}

export async function reasignarTarea(fd: FormData) {
  const { supabase } = await cliente();
  const id = txt(fd, "id");
  if (!id) return;
  const { error } = await supabase.from("tareas").update({ responsable_id: txt(fd, "responsable_id") }).eq("id", id);
  if (await fallo(error)) return;
  refrescar();
}

export async function borrarTarea(fd: FormData) {
  const { supabase } = await cliente();
  const id = txt(fd, "id");
  if (!id) return;
  const { error } = await supabase.from("tareas").delete().eq("id", id);
  if (await fallo(error)) return;
  refrescar();
}

// ---------- ideas ----------
export async function crearIdea(fd: FormData) {
  const { supabase, uid } = await cliente();
  const titulo = txt(fd, "titulo");
  if (!titulo) return void (await avisar("La idea necesita un título."));
  const { error } = await supabase.from("ideas").insert({
    titulo,
    descripcion: txt(fd, "descripcion"),
    tipo: txt(fd, "tipo") ?? "idea",
    linea_id: txt(fd, "linea_id"),
    propuesta_por: uid,
  });
  if (await fallo(error)) return;
  refrescar();
  await avisar("Idea cargada. Se va a tratar en una reunión.", "verde");
  redirect(txt(fd, "ir_a") ?? "/comision?vista=ideas");
}

export async function resolverIdea(fd: FormData) {
  const { supabase } = await cliente();
  const id = txt(fd, "id");
  const decision = txt(fd, "decision");
  if (!id || !decision) return;

  if (decision === "propuesta") {
    const { data: idea } = await supabase.from("ideas").select("*").eq("id", id).single();
    if (idea && !idea.proyecto_id) {
      const { data: proyecto, error } = await supabase
        .from("proyectos")
        .insert({
          nombre: idea.titulo,
          fundamento: idea.descripcion,
          linea_id: idea.linea_id,
          responsable_id: idea.propuesta_por,
        })
        .select("id")
        .single();
      if (await fallo(error)) return;
      const { error: e2 } = await supabase.from("ideas").update({ estado: "propuesta", proyecto_id: proyecto!.id }).eq("id", id);
      if (await fallo(e2)) return;
      refrescar();
      return;
    }
  }
  const { error } = await supabase.from("ideas").update({ estado: decision }).eq("id", id);
  if (await fallo(error)) return;
  refrescar();
}

async function proximaReunion(supabase: Awaited<ReturnType<typeof crearCliente>>, crear: boolean) {
  const { data } = await supabase
    .from("reuniones")
    .select("id")
    .neq("estado", "cerrada")
    .gte("fecha", hoyBA())
    .order("fecha")
    .limit(1);
  if (data && data.length) return data[0].id as string;
  if (!crear) return null;
  const { data: nueva, error } = await supabase.from("reuniones").insert({ fecha: semanaActual() }).select("id").single();
  if (error) {
    await avisar(traducir(error.message));
    return null;
  }
  return nueva.id as string;
}

export async function alPunteo(fd: FormData) {
  const { supabase } = await cliente();
  const reunionId = await proximaReunion(supabase, true);
  if (!reunionId) return;

  const ideaId = txt(fd, "idea_id");
  const proyectoId = txt(fd, "proyecto_id");
  let titulo = txt(fd, "titulo");
  let origen = txt(fd, "origen");

  if (ideaId) {
    const { data: idea } = await supabase.from("ideas").select("titulo").eq("id", ideaId).single();
    titulo = idea?.titulo ?? titulo;
    origen = "Banco de ideas";
  }
  if (!titulo) return void (await avisar("El tema necesita un título."));

  const { count } = await supabase.from("reunion_temas").select("id", { count: "exact", head: true }).eq("reunion_id", reunionId);
  const { error } = await supabase.from("reunion_temas").insert({
    reunion_id: reunionId,
    orden: (count ?? 0) + 1,
    titulo,
    origen,
    idea_id: ideaId,
    proyecto_id: proyectoId,
  });
  if (await fallo(error)) return;
  if (ideaId) await supabase.from("ideas").update({ estado: "en_punteo" }).eq("id", ideaId);
  refrescar();
}

// ---------- proyectos ----------
function datosProyecto(fd: FormData) {
  return {
    nombre: txt(fd, "nombre") ?? "",
    fundamento: txt(fd, "fundamento"),
    objetivos: txt(fd, "objetivos"),
    linea_id: txt(fd, "linea_id"),
    mesa_id: txt(fd, "mesa_id"),
    responsable_id: txt(fd, "responsable_id"),
    identidad: txt(fd, "identidad") ?? "nexo",
  };
}

export async function crearProyecto(fd: FormData) {
  const { supabase } = await cliente();
  const datos = datosProyecto(fd);
  if (!datos.nombre) return void (await avisar("El proyecto necesita un nombre."));
  const { data, error } = await supabase.from("proyectos").insert(datos).select("id").single();
  if (await fallo(error)) return;
  refrescar();
  redirect(`/proyectos/${data!.id}`);
}

export async function editarProyecto(fd: FormData) {
  const { supabase } = await cliente();
  const id = txt(fd, "id");
  const datos = datosProyecto(fd);
  if (!id || !datos.nombre) return void (await avisar("El proyecto necesita un nombre."));
  const { error } = await supabase.from("proyectos").update(datos).eq("id", id);
  if (await fallo(error)) return;
  refrescar();
  redirect(`/proyectos/${id}`);
}

export async function cambiarEstado(fd: FormData) {
  const { supabase } = await cliente();
  const tabla = txt(fd, "tabla");
  const id = txt(fd, "id");
  const estado = txt(fd, "estado");
  if (!id || !estado || (tabla !== "proyectos" && tabla !== "actividades")) return;
  const { error } = await supabase.from(tabla).update({ estado }).eq("id", id);
  if (await fallo(error)) return;
  refrescar();
}

export async function cambiarSeguimiento(fd: FormData) {
  const { supabase } = await cliente();
  const tabla = txt(fd, "tabla");
  const id = txt(fd, "id");
  const seguimiento = txt(fd, "seguimiento");
  if (!id || !seguimiento || !["proyectos", "actividades", "decisiones"].includes(tabla ?? "")) return;
  const { error } = await supabase.from(tabla!).update({ seguimiento }).eq("id", id);
  if (await fallo(error)) return;
  refrescar();
}

export async function agregarDocumento(fd: FormData) {
  const { supabase } = await cliente();
  const titulo = txt(fd, "titulo");
  let url = txt(fd, "url");
  if (!titulo || !url) return void (await avisar("Poné un nombre y un enlace."));
  if (!/^https?:\/\//.test(url)) url = `https://${url}`;
  const { error } = await supabase.from("documentos").insert({
    titulo,
    url,
    tipo: txt(fd, "tipo") ?? "otro",
    nota: txt(fd, "nota"),
    proyecto_id: txt(fd, "proyecto_id"),
    actividad_id: txt(fd, "actividad_id"),
  });
  if (await fallo(error)) return;
  refrescar();
}

export async function borrarDocumento(fd: FormData) {
  const { supabase } = await cliente();
  const id = txt(fd, "id");
  if (!id) return;
  const { error } = await supabase.from("documentos").delete().eq("id", id);
  if (await fallo(error)) return;
  refrescar();
}

// ---------- actividades ----------
function datosActividad(fd: FormData) {
  return {
    nombre: txt(fd, "nombre") ?? "",
    tipo: txt(fd, "tipo") ?? "charla",
    descripcion: txt(fd, "descripcion"),
    proyecto_id: txt(fd, "proyecto_id"),
    linea_id: txt(fd, "linea_id"),
    mesa_id: txt(fd, "mesa_id"),
    responsable_id: txt(fd, "responsable_id"),
    fecha: txt(fd, "fecha"),
    hora: txt(fd, "hora"),
    lugar: txt(fd, "lugar"),
    cupo: txt(fd, "cupo") ? Number(txt(fd, "cupo")) || null : null,
    identidad: txt(fd, "identidad") ?? "nexo",
  };
}

async function insertarPlantilla(
  supabase: Awaited<ReturnType<typeof crearCliente>>,
  actividadId: string,
  tipo: string,
  responsable: string | null,
  fecha: string | null,
) {
  const lista = PLANTILLAS[tipo];
  if (!lista) return null;
  const hoy = hoyBA();
  // Si la actividad tiene fecha, cada tarea vence unos días antes (si ya pasó, vence hoy).
  const vence = (dias: number) => {
    if (!fecha) return null;
    const v = sumarDias(fecha, -dias);
    return v < hoy ? hoy : v;
  };
  const { error } = await supabase
    .from("tareas")
    .insert(lista.map(([titulo, dias]) => ({ titulo, actividad_id: actividadId, responsable_id: responsable, vence: vence(dias) })));
  return error;
}

export async function crearActividad(fd: FormData) {
  const { supabase } = await cliente();
  const datos = datosActividad(fd);
  if (!datos.nombre) return void (await avisar("La actividad necesita un nombre."));
  // Dentro de un proyecto aprobado, la base la deja aprobada si corresponde; si no, queda como propuesta.
  const { data, error } = await supabase
    .from("actividades")
    .insert({ ...datos, estado: datos.proyecto_id ? "aprobada" : "propuesta", guia: GUIAS[datos.tipo] ?? null })
    .select("id")
    .single();
  if (await fallo(error)) return;
  if (fd.get("plantilla") === "si") {
    const e = await insertarPlantilla(supabase, data!.id, datos.tipo, datos.responsable_id, datos.fecha);
    if (await fallo(e)) return;
  }
  refrescar();
  redirect(`/actividades/${data!.id}`);
}

export async function editarActividad(fd: FormData) {
  const { supabase } = await cliente();
  const id = txt(fd, "id");
  const datos = datosActividad(fd);
  if (!id || !datos.nombre) return void (await avisar("La actividad necesita un nombre."));
  const { error } = await supabase.from("actividades").update(datos).eq("id", id);
  if (await fallo(error)) return;
  refrescar();
  redirect(`/actividades/${id}`);
}

export async function cargarPlantilla(fd: FormData) {
  const { supabase } = await cliente();
  const id = txt(fd, "id");
  if (!id) return;
  const { data } = await supabase.from("actividades").select("tipo, responsable_id, fecha").eq("id", id).single();
  if (!data) return;
  const e = await insertarPlantilla(supabase, id, data.tipo, data.responsable_id, data.fecha);
  if (await fallo(e)) return;
  refrescar();
}

export async function guardarCierre(fd: FormData) {
  const { supabase } = await cliente();
  const id = txt(fd, "id");
  if (!id) return;
  const { error } = await supabase.from("actividades").update({ cierre: txt(fd, "cierre") }).eq("id", id);
  if (await fallo(error)) return;
  refrescar();
  await avisar("Cierre guardado.", "verde");
}

// ---------- mesas y líneas ----------
export async function crearMesa(fd: FormData) {
  const { supabase } = await cliente();
  const nombre = txt(fd, "nombre");
  if (!nombre) return void (await avisar("La mesa necesita un nombre."));
  const { error } = await supabase.from("mesas").insert({ nombre, mision: txt(fd, "mision") });
  if (await fallo(error)) return;
  refrescar();
}

export async function editarMesa(fd: FormData) {
  const { supabase } = await cliente();
  const id = txt(fd, "id");
  if (!id) return;
  const { error } = await supabase
    .from("mesas")
    .update({
      nombre: txt(fd, "nombre") ?? "Mesa",
      mision: txt(fd, "mision"),
      referente_id: txt(fd, "referente_id"),
      estado: txt(fd, "estado") ?? "activa",
    })
    .eq("id", id);
  if (await fallo(error)) return;
  refrescar();
}

export async function sumarAMesa(fd: FormData) {
  const { supabase } = await cliente();
  const mesa_id = txt(fd, "mesa_id");
  const integrante_id = txt(fd, "integrante_id");
  if (!mesa_id || !integrante_id) return;
  const { error } = await supabase.from("mesa_integrantes").insert({ mesa_id, integrante_id });
  if (error && !error.message.includes("duplicate")) return void (await fallo(error));
  refrescar();
}

export async function sacarDeMesa(fd: FormData) {
  const { supabase } = await cliente();
  const mesa_id = txt(fd, "mesa_id");
  const integrante_id = txt(fd, "integrante_id");
  if (!mesa_id || !integrante_id) return;
  const { error } = await supabase.from("mesa_integrantes").delete().eq("mesa_id", mesa_id).eq("integrante_id", integrante_id);
  if (await fallo(error)) return;
  refrescar();
}

export async function guardarLinea(fd: FormData) {
  const { supabase } = await cliente();
  const id = txt(fd, "id");
  const nombre = txt(fd, "nombre");
  if (!nombre) return void (await avisar("La línea necesita un nombre."));
  const { error } = id
    ? await supabase.from("lineas").update({ nombre, fundamento: txt(fd, "fundamento") }).eq("id", id)
    : await supabase.from("lineas").insert({ nombre, fundamento: txt(fd, "fundamento"), orden: 99 });
  if (await fallo(error)) return;
  refrescar();
}

// ---------- reuniones ----------
export async function crearReunion(fd: FormData) {
  const { supabase } = await cliente();
  const fecha = txt(fd, "fecha") ?? semanaActual();
  const { data, error } = await supabase
    .from("reuniones")
    .insert({ fecha, hora: txt(fd, "hora") ?? "18:30" })
    .select("id")
    .single();
  if (await fallo(error)) return;
  refrescar();
  redirect(`/reuniones/${data!.id}`);
}

export async function actualizarReunion(fd: FormData) {
  const { supabase } = await cliente();
  const id = txt(fd, "id");
  if (!id) return;
  const cambios: Record<string, unknown> = {};
  if (fd.has("acta_por")) cambios.acta_por = txt(fd, "acta_por");
  if (fd.has("presentes")) cambios.presentes = txt(fd, "presentes") ? Number(txt(fd, "presentes")) : null;
  if (fd.has("estado")) cambios.estado = txt(fd, "estado");
  if (fd.has("fecha")) cambios.fecha = txt(fd, "fecha");
  const { error } = await supabase.from("reuniones").update(cambios).eq("id", id);
  if (await fallo(error)) return;
  refrescar();
  if (cambios.estado === "cerrada") await avisar("Acta publicada. Cada tarea ya le aparece a su responsable.", "verde");
}

export async function agregarTema(fd: FormData) {
  const { supabase } = await cliente();
  const reunion_id = txt(fd, "reunion_id");
  const titulo = txt(fd, "titulo");
  if (!reunion_id || !titulo) return void (await avisar("El tema necesita un título."));
  const { count } = await supabase.from("reunion_temas").select("id", { count: "exact", head: true }).eq("reunion_id", reunion_id);
  const { error } = await supabase
    .from("reunion_temas")
    .insert({ reunion_id, titulo, origen: txt(fd, "origen"), proyecto_id: txt(fd, "proyecto_id"), orden: (count ?? 0) + 1 });
  if (await fallo(error)) return;
  refrescar();
}

export async function actualizarTema(fd: FormData) {
  const { supabase } = await cliente();
  const id = txt(fd, "id");
  if (!id) return;
  const cambios: Record<string, unknown> = {};
  if (fd.has("notas")) cambios.notas = txt(fd, "notas");
  if (fd.has("estado")) cambios.estado = txt(fd, "estado");
  const { error } = await supabase.from("reunion_temas").update(cambios).eq("id", id);
  if (await fallo(error)) return;
  refrescar();
}

export async function borrarTema(fd: FormData) {
  const { supabase } = await cliente();
  const id = txt(fd, "id");
  if (!id) return;
  const { error } = await supabase.from("reunion_temas").delete().eq("id", id);
  if (await fallo(error)) return;
  refrescar();
}

export async function agregarDecision(fd: FormData) {
  const { supabase } = await cliente();
  const texto = txt(fd, "texto");
  if (!texto) return void (await avisar("Escribí la decisión."));
  const { error } = await supabase.from("decisiones").insert({
    texto,
    reunion_id: txt(fd, "reunion_id"),
    tema_id: txt(fd, "tema_id"),
    proyecto_id: txt(fd, "proyecto_id"),
    actividad_id: txt(fd, "actividad_id"),
    va_a_seguimiento: fd.get("va_a_seguimiento") === "si",
  });
  if (await fallo(error)) return;
  refrescar();
}

export async function borrarDecision(fd: FormData) {
  const { supabase } = await cliente();
  const id = txt(fd, "id");
  if (!id) return;
  const { error } = await supabase.from("decisiones").delete().eq("id", id);
  if (await fallo(error)) return;
  refrescar();
}

// ---------- actualización semanal ----------
export async function guardarActualizacion(fd: FormData) {
  const { supabase, uid } = await cliente();
  const { error } = await supabase.from("actualizaciones").upsert(
    {
      integrante_id: uid,
      semana: semanaActual(),
      necesito: txt(fd, "necesito"),
      sin_novedades: fd.get("sin_novedades") === "si",
    },
    { onConflict: "integrante_id,semana" },
  );
  if (await fallo(error)) return;
  refrescar();
  await avisar("Actualización enviada. Gracias.", "verde");
}

// ---------- integrantes ----------
export async function cambiarIntegrante(fd: FormData) {
  const { supabase } = await cliente();
  const id = txt(fd, "id");
  if (!id) return;
  const cambios: Record<string, unknown> = {};
  if (txt(fd, "estado")) cambios.estado = txt(fd, "estado");
  if (txt(fd, "rol")) cambios.rol = txt(fd, "rol");
  if (txt(fd, "nombre")) cambios.nombre = txt(fd, "nombre");
  const { error } = await supabase.from("integrantes").update(cambios).eq("id", id);
  if (await fallo(error)) return;
  refrescar();
}

// ---------- Columna: asistencia y logística de la reunión ----------
type CambiosAsistencia = { respuesta?: string; motivo?: string | null; insistir?: boolean; llegada?: string | null };

/** Se llama desde la lista (sin formulario): guarda un cambio por vez. */
export async function marcarAsistencia(reunionId: string, nominaId: string, cambios: CambiosAsistencia) {
  const { supabase } = await cliente();
  const fila: Record<string, unknown> = { reunion_id: reunionId, nomina_id: nominaId };
  if (cambios.respuesta !== undefined) fila.respuesta = cambios.respuesta;
  if (cambios.motivo !== undefined) fila.motivo = cambios.motivo?.trim() || null;
  if (cambios.insistir !== undefined) fila.insistir = cambios.insistir;
  if (cambios.llegada !== undefined) fila.llegada = cambios.llegada || null;
  const { error } = await supabase.from("asistencias").upsert(fila, { onConflict: "reunion_id,nomina_id" });
  if (error) return { error: traducir(error.message) };
  refrescar();
  return { error: null };
}

/** Desde Inicio: cada uno dice si viene. */
export async function responderAsistencia(fd: FormData) {
  const reunionId = txt(fd, "reunion_id");
  const nominaId = txt(fd, "nomina_id");
  const respuesta = txt(fd, "respuesta");
  if (!reunionId || !nominaId || !respuesta) return;
  const r = await marcarAsistencia(reunionId, nominaId, { respuesta, motivo: respuesta === "viene" ? null : txt(fd, "motivo") });
  if (r.error) return void (await avisar(r.error));
  await avisar(respuesta === "viene" ? "¡Listo! Te esperamos." : "Gracias por avisar.", "verde");
}

export async function guardarLogistica(fd: FormData) {
  const { supabase } = await cliente();
  const reunion_id = txt(fd, "reunion_id");
  if (!reunion_id) return;
  const { error } = await supabase
    .from("reunion_logistica")
    .upsert({ reunion_id, aula: txt(fd, "aula"), busca_aula_id: txt(fd, "busca_aula_id"), nota: txt(fd, "nota") }, { onConflict: "reunion_id" });
  if (await fallo(error)) return;
  refrescar();
  await avisar("Logística guardada.", "verde");
}

export async function crearReunionSemana() {
  const { supabase } = await cliente();
  const id = await proximaReunion(supabase, true);
  if (!id) return;
  refrescar();
}

export async function agregarANomina(fd: FormData) {
  const { supabase } = await cliente();
  const nombres = (txt(fd, "nombres") ?? "")
    .split(/\n|,/)
    .map((n) => n.trim())
    .filter(Boolean);
  if (!nombres.length) return void (await avisar("Escribí al menos un nombre."));
  const { error } = await supabase.from("nomina").insert(nombres.map((nombre) => ({ nombre })));
  if (await fallo(error)) return;
  refrescar();
  await avisar(nombres.length === 1 ? `${nombres[0]} quedó en la lista.` : `${nombres.length} nombres sumados a la lista.`, "verde");
}

export async function sumarIntegrantesANomina(fd: FormData) {
  const { supabase } = await cliente();
  const ids = fd.getAll("integrante_id").map(String);
  if (!ids.length) return;
  const { data } = await supabase.from("integrantes").select("id, nombre").in("id", ids);
  const { error } = await supabase.from("nomina").insert((data ?? []).map((i) => ({ nombre: i.nombre, integrante_id: i.id })));
  if (await fallo(error)) return;
  refrescar();
}

export async function editarNomina(fd: FormData) {
  const { supabase } = await cliente();
  const id = txt(fd, "id");
  if (!id) return;
  const cambios: Record<string, unknown> = {};
  if (txt(fd, "nombre")) cambios.nombre = txt(fd, "nombre");
  if (fd.has("activo")) cambios.activo = fd.get("activo") === "si";
  if (fd.has("integrante_id")) cambios.integrante_id = txt(fd, "integrante_id");
  const { error } = await supabase.from("nomina").update(cambios).eq("id", id);
  if (error?.message.includes("duplicate")) return void (await avisar("Esa cuenta ya está vinculada a otro nombre de la lista."));
  if (await fallo(error)) return;
  refrescar();
}

// ---------- Calendario ----------
/** Mueve una tarea, actividad o reunión a otra fecha (arrastrando en el calendario). */
export async function moverEnCalendario(tipo: "tarea" | "actividad" | "reunion", id: string, fecha: string) {
  const { supabase } = await cliente();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: "La fecha no es válida." };
  const tabla = tipo === "tarea" ? "tareas" : tipo === "actividad" ? "actividades" : "reuniones";
  const campo = tipo === "tarea" ? "vence" : "fecha";
  const { data, error } = await supabase.from(tabla).update({ [campo]: fecha }).eq("id", id).select("id");
  if (error) return { error: traducir(error.message) };
  if (!data?.length) return { error: "No tenés permiso para mover eso." };
  refrescar();
  return { error: null };
}

// ---------- Guía de la actividad ----------
export async function guardarGuia(fd: FormData) {
  const { supabase } = await cliente();
  const id = txt(fd, "id");
  if (!id) return;
  const { error } = await supabase.from("actividades").update({ guia: txt(fd, "guia") }).eq("id", id);
  if (await fallo(error)) return;
  refrescar();
  await avisar("Guía guardada.", "verde");
}

// ---------- Mensajes modelo ----------
export async function guardarMensaje(fd: FormData) {
  const { supabase } = await cliente();
  const id = txt(fd, "id");
  const titulo = txt(fd, "titulo");
  const texto = txt(fd, "texto");
  if (!titulo || !texto) return void (await avisar("El mensaje necesita un nombre y un texto."));
  const datos = { titulo, texto, para: txt(fd, "para") ?? "general" };
  const { error } = id
    ? await supabase.from("mensajes_modelo").update(datos).eq("id", id)
    : await supabase.from("mensajes_modelo").insert({ ...datos, orden: 99 });
  if (await fallo(error)) return;
  refrescar();
  await avisar("Mensaje guardado.", "verde");
}

export async function borrarMensaje(fd: FormData) {
  const { supabase } = await cliente();
  const id = txt(fd, "id");
  if (!id) return;
  const { error } = await supabase.from("mensajes_modelo").delete().eq("id", id);
  if (await fallo(error)) return;
  refrescar();
}

// ---------- DDO ----------
export async function cargarDdos(fd: FormData) {
  const { supabase } = await cliente();
  const texto = txt(fd, "texto");
  if (!texto) return void (await avisar("Pegá el texto de al menos un DDO."));
  const semana = lunesDe(hoyBA());
  const bloques = separarDdos(texto);
  const { error } = await supabase
    .from("ddo")
    .upsert(bloques.map((b) => ({ comision: b.comision, texto: b.texto, semana })), { onConflict: "comision,semana" });
  if (await fallo(error)) return;
  refrescar();
  await avisar(`Cargados: ${bloques.map((b) => b.comision).join(", ")}.`, "verde");
  redirect("/ddo");
}

export async function borrarDdo(fd: FormData) {
  const { supabase } = await cliente();
  const id = txt(fd, "id");
  if (!id) return;
  const { error } = await supabase.from("ddo").delete().eq("id", id);
  if (await fallo(error)) return;
  refrescar();
}

export async function guardarDdoAA(fd: FormData) {
  const { supabase } = await cliente();
  const texto = txt(fd, "texto");
  if (!texto) return;
  const { error } = await supabase
    .from("ddo")
    .upsert({ comision: "Actividades Académicas", texto, semana: lunesDe(hoyBA()) }, { onConflict: "comision,semana" });
  if (await fallo(error)) return;
  refrescar();
  await avisar("DDO de AA guardado en la semana.", "verde");
}
