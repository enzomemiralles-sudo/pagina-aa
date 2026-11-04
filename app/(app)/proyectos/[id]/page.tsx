import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirMiembro } from "@/lib/sesion";
import { listasBase, nombreDe, ordenarTareas, SELECT_TAREA, type Tarea } from "@/lib/datos";
import { ESTADO_ACTIVIDAD, ESTADO_PROYECTO, IDENTIDAD, SEGUIMIENTO } from "@/lib/etiquetas";
import { fechaCorta, fechaLarga } from "@/lib/fechas";
import { ChipDe } from "@/components/Chip";
import { Confirmar, Enviar } from "@/components/Cliente";
import { FormProyecto } from "@/components/Formularios";
import { TablaTareas } from "@/components/TablaTareas";
import { AgregarTarea } from "@/components/AgregarTarea";
import { BotonesSeguimiento } from "@/components/Seguimiento";
import { IconoDocumento } from "@/components/Iconos";
import { agregarDocumento, borrarDocumento, cambiarEstado, editarProyecto } from "../../acciones";

export default async function Proyecto({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ editar?: string }> }) {
  const { id } = await params;
  const { editar } = await searchParams;
  const { supabase, yo } = await requerirMiembro();

  const { data: p } = await supabase.from("proyectos").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();

  const [listas, actividades, tareas, decisiones, documentos, linea, mesa] = await Promise.all([
    listasBase(supabase),
    supabase.from("actividades").select("id, nombre, fecha, estado, tipo").eq("proyecto_id", id).order("fecha", { nullsFirst: false }),
    supabase.from("tareas").select(SELECT_TAREA).eq("proyecto_id", id).neq("estado", "cancelada"),
    supabase.from("decisiones").select("id, texto, seguimiento, created_at, reuniones(fecha)").eq("proyecto_id", id).order("created_at", { ascending: false }),
    supabase.from("documentos").select("id, titulo, url, created_by").eq("proyecto_id", id).order("created_at"),
    p.linea_id ? supabase.from("lineas").select("nombre").eq("id", p.linea_id).maybeSingle() : Promise.resolve({ data: null }),
    p.mesa_id ? supabase.from("mesas").select("nombre").eq("id", p.mesa_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const puedeEditar = yo.esCoord || p.responsable_id === yo.id || p.created_by === yo.id;
  const todas = (tareas.data ?? []) as unknown as Tarea[];
  const abiertas = todas.filter((t) => t.estado !== "hecha").sort(ordenarTareas);
  const hechas = todas.filter((t) => t.estado === "hecha");

  if (editar && puedeEditar) {
    return (
      <>
        <div className="encabezado"><div><p className="suave">Editar proyecto</p><h1>{p.nombre}</h1></div></div>
        <FormProyecto accion={editarProyecto} p={p} listas={listas} yoId={yo.id} cancelar={`/proyectos/${id}`} />
      </>
    );
  }

  const estadoBoton = (estado: string, texto: string, clase = "boton chico") => (
    <form action={cambiarEstado} className="en-linea">
      <input type="hidden" name="tabla" value="proyectos" />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="estado" value={estado} />
      <Enviar className={clase} pendiente="…">{texto}</Enviar>
    </form>
  );

  const objetivos = (p.objetivos ?? "").split("\n").map((s: string) => s.trim()).filter(Boolean);

  return (
    <>
      <nav className="migas" aria-label="Ruta">
        <Link href="/comision">Comisión</Link>
        {mesa.data && <><span aria-hidden="true">›</span><span>{mesa.data.nombre}</span></>}
      </nav>

      <div className="encabezado">
        <div>
          <h1>{p.nombre}</h1>
          <div className="acciones">
            <ChipDe mapa={ESTADO_PROYECTO} valor={p.estado} />
            {p.seguimiento !== "no_requiere" && <ChipDe mapa={SEGUIMIENTO} valor={p.seguimiento} />}
          </div>
        </div>
        <div className="acciones">
          {yo.esCoord && p.estado === "propuesta" && (
            <>
              {estadoBoton("aprobado", "Aprobar", "boton primario chico")}
              {estadoBoton("descartado", "Descartar")}
            </>
          )}
          {puedeEditar && p.estado === "aprobado" && estadoBoton("en_marcha", "Poner en marcha", "boton primario chico")}
          {puedeEditar && p.estado === "en_marcha" && (
            <>
              {estadoBoton("pausado", "Pausar")}
              {estadoBoton("terminado", "Terminar")}
            </>
          )}
          {puedeEditar && p.estado === "pausado" && estadoBoton("en_marcha", "Retomar")}
          {yo.esCoord && (p.estado === "descartado" || p.estado === "terminado") && estadoBoton("propuesta", "Volver a propuesta")}
          {yo.esCoord && <BotonesSeguimiento tabla="proyectos" id={id} estado={p.seguimiento} />}
          {puedeEditar && <Link href={`/proyectos/${id}?editar=1`} className="boton chico">Editar</Link>}
        </div>
      </div>

      <div className="columnas">
        <div className="col-principal">
          <section className="tarjeta" aria-labelledby="pq-t">
            <h2 id="pq-t">Por qué y para qué</h2>
            {p.fundamento ? <p className="texto-largo">{p.fundamento}</p> : <p className="suave">Falta el fundamento.</p>}
            {objetivos.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
                {objetivos.map((o: string) => <li key={o}>{o}</li>)}
              </ul>
            )}
          </section>

          <section className="tarjeta sin-relleno" aria-labelledby="act-t">
            <div className="tarjeta-cabecera">
              <h2 id="act-t">Actividades</h2>
              <Link href={`/actividades/nueva?proyecto=${id}`} className="boton chico">+ Actividad</Link>
            </div>
            {(actividades.data ?? []).length ? (
              <div className="tabla-caja">
                <table className="tabla">
                  <thead><tr><th>Actividad</th><th>Cuándo</th><th>Estado</th></tr></thead>
                  <tbody>
                    {(actividades.data ?? []).map((a) => (
                      <tr key={a.id}>
                        <td><Link href={`/actividades/${a.id}`} className="nombre">{a.nombre}</Link></td>
                        <td className="suave">{a.fecha ? fechaCorta(a.fecha) : "Sin fecha"}</td>
                        <td><ChipDe mapa={ESTADO_ACTIVIDAD} valor={a.estado} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="vacio">Todavía no tiene actividades.</p>
            )}
          </section>

          <section className="tarjeta sin-relleno" aria-labelledby="tar-t">
            <div className="tarjeta-cabecera"><h2 id="tar-t">Tareas</h2><span className="suave chico">{abiertas.length} abiertas</span></div>
            <TablaTareas
              tareas={abiertas}
              personas={listas.personas}
              mostrarContexto={false}
              mostrarResponsable
              puedeTildar={(t) => yo.esCoord || puedeEditar || t.responsable_id === yo.id}
              vacio="No hay tareas abiertas."
            />
            <div className="tarjeta-pie" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <AgregarTarea personas={listas.personas} proyectoId={id} sufijo="proy" />
              {hechas.length > 0 && (
                <details>
                  <summary>Hechas · {hechas.length}</summary>
                  <TablaTareas tareas={hechas} personas={listas.personas} mostrarContexto={false} mostrarResponsable puedeTildar={() => puedeEditar} />
                </details>
              )}
            </div>
          </section>
        </div>

        <div className="col-lateral">
          <section className="tarjeta" aria-labelledby="dat-t">
            <h2 id="dat-t">Datos</h2>
            <dl className="datos">
              <dt>Responsable</dt><dd>{nombreDe(listas.personas, p.responsable_id)}</dd>
              <dt>Mesa</dt><dd>{mesa.data?.nombre ?? "Sin mesa"}</dd>
              <dt>Línea</dt><dd>{linea.data?.nombre ?? "Sin línea"}</dd>
              <dt>Se comunica como</dt><dd>{IDENTIDAD[p.identidad] ?? p.identidad}</dd>
              <dt>Seguimiento</dt>
              <dd className={p.seguimiento === "validado" ? "texto-verde" : p.seguimiento === "pendiente" ? "texto-ambar" : p.seguimiento === "devuelto" ? "texto-rojo" : undefined}>
                {SEGUIMIENTO[p.seguimiento]?.texto ?? p.seguimiento}
                {p.seguimiento_at && p.seguimiento !== "no_requiere" ? ` · ${fechaCorta(String(p.seguimiento_at).slice(0, 10))}` : ""}
              </dd>
            </dl>
          </section>

          <section className="tarjeta" aria-labelledby="dec-t">
            <h2 id="dec-t">Decisiones</h2>
            {(decisiones.data ?? []).length ? (
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
            ) : (
              <p className="suave chico">Las decisiones de las reuniones sobre este proyecto aparecen acá.</p>
            )}
          </section>

          <section className="tarjeta" aria-labelledby="doc-t">
            <h2 id="doc-t">Documentos</h2>
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
                <input type="hidden" name="proyecto_id" value={id} />
                <div className="campo"><label htmlFor="doc-titulo">Nombre</label><input id="doc-titulo" name="titulo" type="text" required /></div>
                <div className="campo"><label htmlFor="doc-url">Enlace (Drive, Docs…)</label><input id="doc-url" name="url" type="url" required /></div>
                <Enviar className="boton primario chico">Agregar</Enviar>
              </form>
            </details>
          </section>
        </div>
      </div>
    </>
  );
}
