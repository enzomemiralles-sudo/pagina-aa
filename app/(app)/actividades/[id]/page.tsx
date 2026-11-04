import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirMiembro } from "@/lib/sesion";
import { listasBase, nombreDe, ordenarTareas, SELECT_TAREA, type Tarea } from "@/lib/datos";
import { ESTADO_ACTIVIDAD, IDENTIDAD, PLANTILLAS, SEGUIMIENTO, TIPO_ACTIVIDAD } from "@/lib/etiquetas";
import { fechaLarga, hoyBA } from "@/lib/fechas";
import { ChipDe } from "@/components/Chip";
import { Confirmar, Enviar } from "@/components/Cliente";
import { FormActividad } from "@/components/Formularios";
import { TablaTareas } from "@/components/TablaTareas";
import { AgregarTarea } from "@/components/AgregarTarea";
import { BotonesSeguimiento } from "@/components/Seguimiento";
import { IconoDocumento } from "@/components/Iconos";
import { agregarDocumento, borrarDocumento, cambiarEstado, cargarPlantilla, editarActividad, guardarCierre } from "../../acciones";

const SIGUIENTE: Record<string, { estado: string; texto: string }> = {
  aprobada: { estado: "en_organizacion", texto: "Empezar a organizar" },
  en_organizacion: { estado: "inscripciones_abiertas", texto: "Abrir inscripciones" },
  inscripciones_abiertas: { estado: "realizada", texto: "Marcar realizada" },
  realizada: { estado: "cerrada", texto: "Cerrar actividad" },
};

export default async function Actividad({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ editar?: string }> }) {
  const { id } = await params;
  const { editar } = await searchParams;
  const { supabase, yo } = await requerirMiembro();

  const { data: a } = await supabase.from("actividades").select("*").eq("id", id).maybeSingle();
  if (!a) notFound();

  const [listas, tareas, decisiones, documentos, proyecto, mesa, linea] = await Promise.all([
    listasBase(supabase),
    supabase.from("tareas").select(SELECT_TAREA).eq("actividad_id", id).neq("estado", "cancelada"),
    supabase.from("decisiones").select("id, texto, seguimiento, reuniones(fecha)").eq("actividad_id", id).order("created_at", { ascending: false }),
    supabase.from("documentos").select("id, titulo, url, created_by").eq("actividad_id", id).order("created_at"),
    a.proyecto_id ? supabase.from("proyectos").select("id, nombre").eq("id", a.proyecto_id).maybeSingle() : Promise.resolve({ data: null }),
    a.mesa_id ? supabase.from("mesas").select("nombre").eq("id", a.mesa_id).maybeSingle() : Promise.resolve({ data: null }),
    a.linea_id ? supabase.from("lineas").select("nombre").eq("id", a.linea_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const puedeEditar = yo.esCoord || a.responsable_id === yo.id || a.created_by === yo.id;
  const todas = (tareas.data ?? []) as unknown as Tarea[];
  const abiertas = todas.filter((t) => t.estado !== "hecha").sort(ordenarTareas);
  const hechas = todas.filter((t) => t.estado === "hecha");

  if (editar && puedeEditar) {
    return (
      <>
        <div className="encabezado"><div><p className="suave">Editar actividad</p><h1>{a.nombre}</h1></div></div>
        <FormActividad accion={editarActividad} a={a} listas={listas} yoId={yo.id} cancelar={`/actividades/${id}`} />
      </>
    );
  }

  const estadoBoton = (estado: string, texto: string, clase = "boton chico") => (
    <form action={cambiarEstado} className="en-linea">
      <input type="hidden" name="tabla" value="actividades" />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="estado" value={estado} />
      <Enviar className={clase} pendiente="…">{texto}</Enviar>
    </form>
  );
  const siguiente = SIGUIENTE[a.estado];
  const mostrarCierre = ["realizada", "cerrada"].includes(a.estado) || (a.fecha && a.fecha < hoyBA());

  return (
    <>
      <nav className="migas" aria-label="Ruta">
        <Link href="/comision">Comisión</Link>
        {proyecto.data && <><span aria-hidden="true">›</span><Link href={`/proyectos/${proyecto.data.id}`}>{proyecto.data.nombre}</Link></>}
      </nav>

      <div className="encabezado">
        <div>
          <p className="suave">{TIPO_ACTIVIDAD[a.tipo] ?? "Actividad"}{a.fecha ? ` · ${fechaLarga(a.fecha)}` : ""}{a.hora ? ` · ${a.hora}` : ""}</p>
          <h1>{a.nombre}</h1>
          <div className="acciones">
            <ChipDe mapa={ESTADO_ACTIVIDAD} valor={a.estado} />
            {a.seguimiento !== "no_requiere" && <ChipDe mapa={SEGUIMIENTO} valor={a.seguimiento} />}
            {a.estado === "realizada" && !a.cierre && <span className="chip ambar">Cierre pendiente</span>}
          </div>
        </div>
        <div className="acciones">
          {yo.esCoord && a.estado === "propuesta" && estadoBoton("aprobada", "Aprobar", "boton primario chico")}
          {puedeEditar && siguiente && estadoBoton(siguiente.estado, siguiente.texto, "boton primario chico")}
          {puedeEditar && !["cancelada", "cerrada", "realizada"].includes(a.estado) && (a.estado !== "propuesta" || yo.esCoord) && estadoBoton("cancelada", "Cancelar")}
          {yo.esCoord && ["cancelada", "cerrada"].includes(a.estado) && estadoBoton("propuesta", "Volver a propuesta")}
          {yo.esCoord && <BotonesSeguimiento tabla="actividades" id={id} estado={a.seguimiento} />}
          {puedeEditar && <Link href={`/actividades/${id}?editar=1`} className="boton chico">Editar</Link>}
        </div>
      </div>

      <div className="columnas">
        <div className="col-principal">
          {(a.descripcion || a.lugar) && (
            <section className="tarjeta" aria-labelledby="de-t">
              <h2 id="de-t">De qué se trata</h2>
              {a.lugar && <p><strong>Dónde:</strong> {a.lugar}</p>}
              {a.descripcion && <p className="texto-largo">{a.descripcion}</p>}
            </section>
          )}

          <section className="tarjeta sin-relleno" aria-labelledby="tar-t">
            <div className="tarjeta-cabecera">
              <h2 id="tar-t">Tareas</h2>
              {todas.length === 0 && PLANTILLAS[a.tipo] && puedeEditar && (
                <form action={cargarPlantilla} className="en-linea">
                  <input type="hidden" name="id" value={id} />
                  <Enviar className="boton chico" pendiente="Cargando…">Cargar tareas sugeridas</Enviar>
                </form>
              )}
            </div>
            <TablaTareas
              tareas={abiertas}
              personas={listas.personas}
              mostrarContexto={false}
              mostrarResponsable
              puedeTildar={(t) => puedeEditar || t.responsable_id === yo.id}
              vacio="No hay tareas abiertas."
            />
            <div className="tarjeta-pie" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <AgregarTarea personas={listas.personas} actividadId={id} responsableInicial={a.responsable_id} sufijo="act" />
              {hechas.length > 0 && (
                <details>
                  <summary>Hechas · {hechas.length}</summary>
                  <TablaTareas tareas={hechas} personas={listas.personas} mostrarContexto={false} mostrarResponsable puedeTildar={() => puedeEditar} />
                </details>
              )}
            </div>
          </section>

          {mostrarCierre && (
            <section className="tarjeta" aria-labelledby="cie-t">
              <h2 id="cie-t">Cierre</h2>
              {puedeEditar ? (
                <form action={guardarCierre} className="formulario">
                  <input type="hidden" name="id" value={id} />
                  <div className="campo">
                    <label htmlFor="cierre">Qué se hizo, cuántos participaron, contactos nuevos, qué aprendimos y qué sigue</label>
                    <textarea id="cierre" name="cierre" rows={6} defaultValue={a.cierre ?? ""} />
                    <span className="ayuda">Se puede guardar a medias y completar después.</span>
                  </div>
                  <Enviar className="boton primario" >Guardar cierre</Enviar>
                </form>
              ) : a.cierre ? (
                <p className="texto-largo">{a.cierre}</p>
              ) : (
                <p className="suave">Todavía no se cargó el cierre.</p>
              )}
            </section>
          )}
        </div>

        <div className="col-lateral">
          <section className="tarjeta" aria-labelledby="dat-t">
            <h2 id="dat-t">Datos</h2>
            <dl className="datos">
              <dt>Responsable</dt><dd>{nombreDe(listas.personas, a.responsable_id)}</dd>
              <dt>Proyecto</dt><dd>{proyecto.data ? <Link href={`/proyectos/${proyecto.data.id}`}>{proyecto.data.nombre}</Link> : "Actividad suelta"}</dd>
              <dt>Mesa</dt><dd>{mesa.data?.nombre ?? "Sin mesa"}</dd>
              <dt>Línea</dt><dd>{linea.data?.nombre ?? "Sin línea"}</dd>
              <dt>Se comunica como</dt><dd>{IDENTIDAD[a.identidad] ?? a.identidad}</dd>
            </dl>
          </section>

          {(decisiones.data ?? []).length > 0 && (
            <section className="tarjeta" aria-labelledby="dec-t">
              <h2 id="dec-t">Decisiones</h2>
              <ol className="conteos" style={{ gap: 14 }}>
                {(decisiones.data ?? []).map((d) => {
                  const fecha = (d as unknown as { reuniones?: { fecha: string } | null }).reuniones?.fecha;
                  return (
                    <li key={d.id} style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                      {fecha && <span className="chico suave" style={{ fontWeight: 700 }}>{fechaLarga(fecha)}</span>}
                      <span style={{ fontWeight: 600 }}>{d.texto}</span>
                      {d.seguimiento !== "no_requiere" && <ChipDe mapa={SEGUIMIENTO} valor={d.seguimiento} />}
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          <section className="tarjeta" aria-labelledby="doc-t">
            <h2 id="doc-t">Documentos y enlaces</h2>
            {(documentos.data ?? []).map((d) => (
              <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <a href={d.url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, flex: 1, minHeight: 36, fontWeight: 600 }}>
                  <IconoDocumento size={17} /> {d.titulo}
                </a>
                {(yo.esCoord || d.created_by === yo.id) && (
                  <form action={borrarDocumento} className="en-linea">
                    <input type="hidden" name="id" value={d.id} />
                    <Confirmar mensaje={`¿Sacar "${d.titulo}" de la lista? El archivo original no se borra.`} className="boton texto chico">Quitar</Confirmar>
                  </form>
                )}
              </div>
            ))}
            <details>
              <summary>+ Agregar enlace</summary>
              <form action={agregarDocumento} className="formulario" style={{ paddingTop: 8 }}>
                <input type="hidden" name="actividad_id" value={id} />
                <div className="campo"><label htmlFor="doc-titulo">Nombre</label><input id="doc-titulo" name="titulo" type="text" placeholder="Zoom, formulario, grabación…" required /></div>
                <div className="campo"><label htmlFor="doc-url">Enlace</label><input id="doc-url" name="url" type="url" required /></div>
                <Enviar className="boton primario chico">Agregar</Enviar>
              </form>
            </details>
          </section>
        </div>
      </div>
    </>
  );
}
