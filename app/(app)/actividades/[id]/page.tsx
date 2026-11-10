import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirMiembro } from "@/lib/sesion";
import { listasBase, nombreDe, ordenarTareas, SELECT_TAREA, type Tarea } from "@/lib/datos";
import { ESTADO_ACTIVIDAD, GUIAS, IDENTIDAD, PLANTILLAS, SEGUIMIENTO, TIPO_ACTIVIDAD, TIPO_ENLACE } from "@/lib/etiquetas";
import { fechaDia, fechaLarga, hoyBA } from "@/lib/fechas";
import { actividadEnFrase, completar, faltantes, VARIABLES, type DatosMensaje } from "@/lib/mensajes";
import { ChipDe } from "@/components/Chip";
import { Confirmar, Copiar, Enviar } from "@/components/Cliente";
import { FormActividad } from "@/components/Formularios";
import { TablaTareas } from "@/components/TablaTareas";
import { AgregarTarea } from "@/components/AgregarTarea";
import { BotonesSeguimiento } from "@/components/Seguimiento";
import { IconoDocumento } from "@/components/Iconos";
import { agregarDocumento, armarPlanComunicacion, borrarDocumento, cambiarEstado, cargarPlantilla, editarActividad, guardarCierre, guardarGuia, guardarOpcionForm } from "../../acciones";
import { opcionForm } from "@/lib/contactos";

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

  const [listas, tareas, decisiones, documentos, proyecto, mesa, linea, mensajesR] = await Promise.all([
    listasBase(supabase),
    supabase.from("tareas").select(SELECT_TAREA).eq("actividad_id", id).neq("estado", "cancelada"),
    supabase.from("decisiones").select("id, texto, seguimiento, reuniones(fecha)").eq("actividad_id", id).order("created_at", { ascending: false }),
    supabase.from("documentos").select("id, titulo, url, tipo, created_by").eq("actividad_id", id).order("created_at"),
    a.proyecto_id ? supabase.from("proyectos").select("id, nombre").eq("id", a.proyecto_id).maybeSingle() : Promise.resolve({ data: null }),
    a.mesa_id ? supabase.from("mesas").select("nombre").eq("id", a.mesa_id).maybeSingle() : Promise.resolve({ data: null }),
    a.linea_id ? supabase.from("lineas").select("nombre").eq("id", a.linea_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("mensajes_modelo").select("id, titulo, texto, para").in("para", [a.tipo, "general"]).order("orden"),
  ]);
  const { data: formGeneral } = await supabase.from("documentos").select("url").eq("tipo", "inscripcion").is("actividad_id", null).is("proyecto_id", null).limit(1).maybeSingle();

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

  // Mensajes modelo completos con los datos de esta actividad.
  const docs = (documentos.data ?? []) as { id: string; titulo: string; url: string; tipo: string; created_by: string | null }[];
  const linkDe = (tipo: string) => docs.find((d) => d.tipo === tipo)?.url ?? null;
  const datos: DatosMensaje = {
    actividad: actividadEnFrase(a.nombre), dia: fechaDia(a.fecha), hora: a.hora, lugar: a.lugar,
    zoom: linkDe("zoom"), grupo: linkDe("grupo"), encuesta: linkDe("encuesta"), inscripcion: linkDe("inscripcion"),
    yo: yo.nombre.split(" ")[0],
  };
  const mensajes = ((mensajesR.data ?? []) as { id: string; titulo: string; texto: string }[]).map((m) => ({
    ...m,
    listo: completar(m.texto, datos),
    falta: faltantes(m.texto, datos),
  }));
  const tiposUtiles = a.tipo === "charla" ? ["inscripcion", "planilla", "zoom", "encuesta"] : a.tipo === "visita" ? ["inscripcion", "planilla", "grupo", "encuesta"] : [];
  const faltanLinks = tiposUtiles.filter((t) => !linkDe(t));
  const opcion = a.opcion_form ?? opcionForm(a.fecha, a.hora, a.nombre);
  const tienePlan = todas.some((t) => t.canal);
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

          <section className="tarjeta" aria-labelledby="guia-t">
            <div className="encabezado" style={{ alignItems: "center" }}>
              <h2 id="guia-t">Guía para el día</h2>
              {a.guia && <Link href={`/actividades/${id}/guia`} className="boton chico">Abrir en el celular</Link>}
            </div>
            {a.guia ? (
              <p className="guia-texto">{a.guia}</p>
            ) : (
              <p className="suave">Protocolo, speech y responsables, para tenerlo a mano el día de la actividad.</p>
            )}
            {puedeEditar && (
              <details>
                <summary>{a.guia ? "Editar la guía" : "Escribir la guía"}</summary>
                <form action={guardarGuia} className="formulario" style={{ paddingTop: 8 }}>
                  <input type="hidden" name="id" value={id} />
                  <label htmlFor="guia" className="oculto">Guía</label>
                  <textarea id="guia" name="guia" rows={16} defaultValue={a.guia ?? GUIAS[a.tipo] ?? ""} />
                  <Enviar className="boton primario chico">Guardar guía</Enviar>
                </form>
              </details>
            )}
          </section>

          {mensajes.length > 0 && (
            <section className="tarjeta" aria-labelledby="msj-t">
              <h2 id="msj-t">Mensajes</h2>
              <p className="suave chico">Completos con los datos de la actividad. Los modelos se editan en <Link href="/herramientas">Herramientas</Link>.</p>
              <div className="grilla">
                {mensajes.map((m) => (
                  <div key={m.id} className="tarjeta" style={{ gap: 8 }}>
                    <strong>{m.titulo}</strong>
                    <p className="texto-largo chico mensaje">{m.listo}</p>
                    {m.falta.length > 0 && (
                      <p className="chico"><span className="chip ambar">Falta</span> {m.falta.map((f) => VARIABLES[f].toLowerCase()).join(", ")}</p>
                    )}
                    <div className="acciones"><Copiar texto={m.listo} className="boton chico">Copiar</Copiar></div>
                  </div>
                ))}
              </div>
            </section>
          )}

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
          <section className="tarjeta" aria-labelledby="ins-t">
            <h2 id="ins-t">Inscripción y difusión</h2>
            <div className="campo">
              <span className="etiqueta">Opción para el Form de actividades</span>
              <code className="formula" style={{ background: "var(--gris-f)", color: "var(--tinta)" }}>{opcion}</code>
              <div className="acciones">
                <Copiar texto={opcion} className="boton chico">Copiar</Copiar>
                {formGeneral?.url && <a href={formGeneral.url} target="_blank" rel="noreferrer" className="boton chico">Abrir el Form ↗</a>}
              </div>
              {puedeEditar && (
                <details>
                  <summary className="chico">Cambiar el texto</summary>
                  <form action={guardarOpcionForm} className="formulario" style={{ paddingTop: 6, gap: 8 }}>
                    <input type="hidden" name="id" value={id} />
                    <label className="oculto" htmlFor="opcion_form">Texto de la opción</label>
                    <input id="opcion_form" name="opcion_form" type="text" defaultValue={opcion} />
                    <Enviar className="boton chico">Guardar</Enviar>
                  </form>
                </details>
              )}
            </div>
            <div className="acciones">
              <Link href={`/contactos?vista=repartir&actividad=${id}`} className="boton primario chico">Repartir contactos</Link>
              {tienePlan ? (
                <Link href="/comunicacion" className="boton chico">Ver plan de comunicación</Link>
              ) : (
                puedeEditar && (
                  <form action={armarPlanComunicacion} className="en-linea">
                    <input type="hidden" name="id" value={id} />
                    <Enviar className="boton chico" pendiente="…">Armar plan de comunicación</Enviar>
                  </form>
                )
              )}
            </div>
          </section>

          <section className="tarjeta" aria-labelledby="dat-t">
            <h2 id="dat-t">Datos</h2>
            <dl className="datos">
              <dt>Responsable</dt><dd>{nombreDe(listas.personas, a.responsable_id)}</dd>
              <dt>Proyecto</dt><dd>{proyecto.data ? <Link href={`/proyectos/${proyecto.data.id}`}>{proyecto.data.nombre}</Link> : "Actividad suelta"}</dd>
              <dt>Mesa</dt><dd>{mesa.data?.nombre ?? "Sin mesa"}</dd>
              <dt>Línea</dt><dd>{linea.data?.nombre ?? "Sin línea"}</dd>
              <dt>Se comunica como</dt><dd>{IDENTIDAD[a.identidad] ?? a.identidad}</dd>
              {a.cupo && <><dt>Cupo</dt><dd>{a.cupo}</dd></>}
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
            <h2 id="doc-t">Links</h2>
            {docs.map((d) => (
              <div key={d.id} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <a href={d.url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 32, fontWeight: 600 }}>
                  <IconoDocumento size={17} /> {d.titulo}
                </a>
                <span className="acciones" style={{ gap: 4, paddingLeft: 25 }}>
                  {d.tipo !== "otro" && <span className="chip gris">{TIPO_ENLACE[d.tipo]?.texto}</span>}
                  {(yo.esCoord || d.created_by === yo.id) && (
                    <form action={borrarDocumento} className="en-linea">
                      <input type="hidden" name="id" value={d.id} />
                      <Confirmar mensaje={`¿Sacar "${d.titulo}" de la lista? El archivo original no se borra.`} className="boton texto chico">Quitar</Confirmar>
                    </form>
                  )}
                </span>
              </div>
            ))}
            {faltanLinks.length > 0 && (
              <p className="chico"><span className="chip ambar">Falta</span> {faltanLinks.map((t) => TIPO_ENLACE[t].texto).join(", ")}</p>
            )}
            <details>
              <summary>+ Agregar link</summary>
              <form action={agregarDocumento} className="formulario" style={{ paddingTop: 8 }}>
                <input type="hidden" name="actividad_id" value={id} />
                <div className="campo">
                  <label htmlFor="doc-tipo">Qué es</label>
                  <select id="doc-tipo" name="tipo" defaultValue={faltanLinks[0] ?? "otro"}>
                    {Object.entries(TIPO_ENLACE).map(([k, v]) => <option key={k} value={k}>{v.texto}</option>)}
                  </select>
                </div>
                <div className="campo"><label htmlFor="doc-titulo">Nombre</label><input id="doc-titulo" name="titulo" type="text" placeholder="Form de inscripción, grupo, Zoom…" required /></div>
                <div className="campo"><label htmlFor="doc-url">Link</label><input id="doc-url" name="url" type="url" required /></div>
                <Enviar className="boton primario chico">Agregar</Enviar>
              </form>
            </details>
          </section>
        </div>
      </div>
    </>
  );
}
