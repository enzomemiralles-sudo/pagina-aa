import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirMiembro } from "@/lib/sesion";
import { nombreDe, personasActivas } from "@/lib/datos";
import { ESTADO_IDEA, ESTADO_REUNION, SEGUIMIENTO } from "@/lib/etiquetas";
import { fechaLarga } from "@/lib/fechas";
import { ChipDe } from "@/components/Chip";
import { Confirmar, Copiar, Enviar } from "@/components/Cliente";
import { AgregarTarea } from "@/components/AgregarTarea";
import { BotonesSeguimiento } from "@/components/Seguimiento";
import { Vence } from "@/components/TablaTareas";
import { IconoCheck } from "@/components/Iconos";
import { actualizarReunion, actualizarTema, agregarDecision, agregarTema, borrarDecision, borrarTema, resolverIdea } from "../../acciones";

export default async function Reunion({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, yo } = await requerirMiembro();

  const { data: r } = await supabase.from("reuniones").select("*").eq("id", id).maybeSingle();
  if (!r) notFound();

  const [temasR, decisionesR, tareasR, personas, proyectosR] = await Promise.all([
    supabase.from("reunion_temas").select("*, ideas(id, titulo, estado, proyecto_id), proyectos(nombre)").eq("reunion_id", id).order("orden").order("created_at"),
    supabase.from("decisiones").select("*").eq("reunion_id", id).order("created_at"),
    supabase.from("tareas").select("id, titulo, responsable_id, vence, estado, tema_id").eq("reunion_id", id).order("created_at"),
    personasActivas(supabase),
    supabase.from("proyectos").select("id, nombre").not("estado", "in", "(descartado,terminado)").order("nombre"),
  ]);

  type Tema = {
    id: string; titulo: string; origen: string | null; notas: string | null; estado: string; proyecto_id: string | null; idea_id: string | null;
    ideas: { id: string; titulo: string; estado: string; proyecto_id: string | null } | null;
    proyectos: { nombre: string } | null;
  };
  const temas = (temasR.data ?? []) as unknown as Tema[];
  const decisiones = decisionesR.data ?? [];
  const tareas = tareasR.data ?? [];

  const cerrada = r.estado === "cerrada";
  const puedeEditar = yo.esCoord || (r.acta_por === yo.id && !cerrada && yo.estado === "activo");
  const titulo = fechaLarga(r.fecha).replace(/^./, (c) => c.toUpperCase());

  const textoPunteo = [
    `*Reunión de comisión · ${fechaLarga(r.fecha)}, ${r.hora}*`,
    "Punteo:",
    ...temas.map((t, i) => `${i + 1}. ${t.titulo}`),
    "",
    "Antes de la reunión, cargá tu actualización en la página.",
  ].join("\n");

  const textoActa = [
    `*Acta · reunión del ${fechaLarga(r.fecha)}*`,
    ...temas.flatMap((t, i) => {
      const ds = decisiones.filter((d) => d.tema_id === t.id);
      const ts = tareas.filter((x) => x.tema_id === t.id);
      return [
        "",
        `${i + 1}. ${t.titulo}`,
        ...ds.map((d) => `• Decisión: ${d.texto}${d.va_a_seguimiento ? " (va a seguimiento)" : ""}`),
        ...ts.map((x) => `• Tarea: ${x.titulo} — ${nombreDe(personas, x.responsable_id)}`),
      ];
    }),
    "",
    "Cada tarea ya está en la página, en el Inicio de su responsable.",
  ].join("\n");

  const estadoReunion = (estado: string, texto: string, clase = "boton chico") => (
    <form action={actualizarReunion} className="en-linea">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="estado" value={estado} />
      <Enviar className={clase} pendiente="…">{texto}</Enviar>
    </form>
  );

  const resueltas = decisiones.length;
  const aSeguimiento = decisiones.filter((d) => d.va_a_seguimiento).length;

  return (
    <>
      <nav className="migas" aria-label="Ruta"><Link href="/reuniones">Reuniones</Link></nav>
      <div className="encabezado">
        <div>
          <h1>Reunión de comisión</h1>
          <div className="acciones suave chico">
            <ChipDe mapa={ESTADO_REUNION} valor={r.estado} />
            <span>{titulo} · {r.hora}</span>
            <span>· toma el acta {r.acta_por ? nombreDe(personas, r.acta_por) : "nadie todavía"}</span>
            {r.presentes ? <span>· {r.presentes} presentes</span> : null}
          </div>
        </div>
        <div className="acciones">
          <Copiar texto={cerrada ? textoActa : textoPunteo}>{cerrada ? "Copiar acta para WhatsApp" : "Copiar punteo para WhatsApp"}</Copiar>
          {yo.esCoord && r.estado === "preparacion" && estadoReunion("en_curso", "Empezar la reunión", "boton primario")}
          {puedeEditar && r.estado === "en_curso" && estadoReunion("cerrada", "Cerrar acta y publicar", "boton primario")}
          {yo.esCoord && cerrada && estadoReunion("en_curso", "Reabrir acta")}
        </div>
      </div>

      {yo.esCoord && !cerrada && (
        <form action={actualizarReunion} className="tarjeta" style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", gap: 12 }}>
          <input type="hidden" name="id" value={id} />
          <div className="campo" style={{ minWidth: 200 }}>
            <label htmlFor="acta_por">Toma el acta</label>
            <select id="acta_por" name="acta_por" defaultValue={r.acta_por ?? ""}>
              <option value="">Sin definir</option>
              {personas.filter((p) => p.estado === "activo").map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div className="campo" style={{ width: 120 }}>
            <label htmlFor="presentes">Presentes</label>
            <input id="presentes" name="presentes" type="number" min={0} defaultValue={r.presentes ?? ""} />
          </div>
          <Enviar className="boton">Guardar</Enviar>
        </form>
      )}

      <div className="columnas">
        <div className="col-lateral" style={{ flex: "1 1 250px" }}>
        <nav className="tarjeta punteo" aria-label="Temas del punteo" style={{ gap: 4 }}>
          <p className="chico suave" style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "0 8px" }}>Punteo</p>
          {temas.length === 0 && <p className="suave chico" style={{ padding: "0 8px" }}>Sin temas todavía.</p>}
          {temas.map((t, i) => (
            <a key={t.id} href={`#tema-${t.id}`}>
              <span className={`tema-numero${t.estado === "tratado" ? " tratado" : ""}`}>{t.estado === "tratado" ? <IconoCheck size={14} /> : i + 1}</span>
              <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{t.titulo}</span>
                <span className={`chico ${t.estado === "tratado" ? "texto-verde" : "suave"}`}>{t.estado === "tratado" ? "Tratado" : t.origen ?? "Pendiente"}</span>
              </span>
            </a>
          ))}
        </nav>
          <section className="tarjeta" aria-labelledby="res-t">
            <h2 id="res-t">{cerrada ? "Resumen" : "Hasta ahora"}</h2>
            <ul className="conteos">
              <li><span className="chip verde">{temas.filter((t) => t.estado === "tratado").length}</span> de {temas.length} temas tratados</li>
              <li><span className={`chip ${tareas.length ? "verde" : "gris"}`}>{tareas.length}</span> tareas creadas</li>
              <li><span className={`chip ${resueltas ? "verde" : "gris"}`}>{resueltas}</span> decisiones</li>
              <li><span className={`chip ${aSeguimiento ? "ambar" : "gris"}`}>{aSeguimiento}</span> van a seguimiento</li>
            </ul>
            {!cerrada && <p className="suave chico">Cada tarea le aparece a su responsable apenas se carga. Al cerrar, el acta queda como registro y se puede copiar para WhatsApp.</p>}
            {!puedeEditar && !cerrada && <p className="suave chico">Solo coordinación y quien toma el acta pueden escribir acá.</p>}
          </section>
        </div>

        <div className="col-principal">
          {temas.map((t, i) => {
            const ds = decisiones.filter((d) => d.tema_id === t.id);
            const ts = tareas.filter((x) => x.tema_id === t.id);
            return (
              <section key={t.id} id={`tema-${t.id}`} className="tarjeta tema" aria-labelledby={`tt-${t.id}`}>
                <div className="encabezado" style={{ alignItems: "center" }}>
                  <div style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <span className={`tema-numero${t.estado === "tratado" ? " tratado" : ""}`}>{i + 1}</span>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <h2 id={`tt-${t.id}`}>{t.titulo}</h2>
                      {(t.proyecto_id || t.origen) && (
                        <span className="chico suave">
                          {t.proyecto_id ? <Link href={`/proyectos/${t.proyecto_id}`}>{t.proyectos?.nombre ?? "Proyecto"}</Link> : t.origen}
                        </span>
                      )}
                    </div>
                  </div>
                  {puedeEditar && (
                    <div className="acciones">
                      <form action={actualizarTema} className="en-linea">
                        <input type="hidden" name="id" value={t.id} />
                        <input type="hidden" name="estado" value={t.estado === "tratado" ? "pendiente" : "tratado"} />
                        <Enviar className={t.estado === "tratado" ? "boton chico" : "boton verde chico"} pendiente="…">{t.estado === "tratado" ? "Reabrir tema" : "Marcar tratado"}</Enviar>
                      </form>
                      <form action={borrarTema} className="en-linea">
                        <input type="hidden" name="id" value={t.id} />
                        <Confirmar mensaje="¿Quitar este tema del punteo?">Quitar</Confirmar>
                      </form>
                    </div>
                  )}
                </div>

                {t.ideas && (
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 12px", border: "1px solid var(--linea)", borderRadius: 10 }}>
                    <span className="chico">
                      Idea del banco · <ChipDe mapa={ESTADO_IDEA} valor={t.ideas.estado} />
                      {t.ideas.proyecto_id && <> · <Link href={`/proyectos/${t.ideas.proyecto_id}`}>ver propuesta</Link></>}
                    </span>
                    {puedeEditar && !t.ideas.proyecto_id && (
                      <div className="acciones" role="group" aria-label="Qué se decide sobre la idea">
                        {[
                          ["propuesta", "Pasa a propuesta"],
                          ["postergada", "Se posterga"],
                          ["descartada", "Se descarta"],
                        ].map(([valor, texto]) => (
                          <form key={valor} action={resolverIdea} className="en-linea">
                            <input type="hidden" name="id" value={t.ideas!.id} />
                            <input type="hidden" name="decision" value={valor} />
                            <Enviar className={t.ideas!.estado === valor ? "boton verde chico" : "boton chico"} pendiente="…">{texto}</Enviar>
                          </form>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {puedeEditar ? (
                  <form action={actualizarTema} className="campo">
                    <input type="hidden" name="id" value={t.id} />
                    <label htmlFor={`notas-${t.id}`}>Notas</label>
                    <textarea id={`notas-${t.id}`} name="notas" rows={3} defaultValue={t.notas ?? ""} placeholder="Lo que se habló, en pocas líneas" />
                    <div><Enviar className="boton chico">Guardar notas</Enviar></div>
                  </form>
                ) : t.notas ? (
                  <p className="texto-largo">{t.notas}</p>
                ) : null}

                {(ds.length > 0 || puedeEditar) && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <h3>Decisiones</h3>
                    {ds.map((d) => (
                      <div key={d.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 600, flex: "1 1 240px" }}>{d.texto}</span>
                        {d.seguimiento !== "no_requiere" && <ChipDe mapa={SEGUIMIENTO} valor={d.seguimiento} />}
                        {yo.esCoord && d.va_a_seguimiento && <BotonesSeguimiento tabla="decisiones" id={d.id} estado={d.seguimiento} />}
                        {puedeEditar && (
                          <form action={borrarDecision} className="en-linea">
                            <input type="hidden" name="id" value={d.id} />
                            <Confirmar mensaje="¿Borrar esta decisión?" className="boton texto chico">Borrar</Confirmar>
                          </form>
                        )}
                      </div>
                    ))}
                    {puedeEditar && (
                      <form action={agregarDecision} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                        <input type="hidden" name="reunion_id" value={id} />
                        <input type="hidden" name="tema_id" value={t.id} />
                        {t.proyecto_id && <input type="hidden" name="proyecto_id" value={t.proyecto_id} />}
                        <label htmlFor={`dec-${t.id}`} className="oculto">Nueva decisión</label>
                        <input id={`dec-${t.id}`} name="texto" type="text" placeholder="Qué se decidió" style={{ flex: "1 1 260px", width: "auto" }} required />
                        <label className="check" style={{ fontSize: 14 }}><input type="checkbox" name="va_a_seguimiento" value="si" /> Va a seguimiento</label>
                        <Enviar className="boton chico">Agregar decisión</Enviar>
                      </form>
                    )}
                  </div>
                )}

                {(ts.length > 0 || puedeEditar) && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <h3>Tareas que salen de este tema</h3>
                    {ts.map((x) => (
                      <div key={x.id} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", fontSize: 14 }}>
                        <span className="chip verde"><IconoCheck size={12} /> Creada</span>
                        <span style={{ fontWeight: 600 }}>{x.titulo}</span>
                        <span className="suave">· {nombreDe(personas, x.responsable_id)} ·</span>
                        <Vence fecha={x.vence} hecha={x.estado === "hecha"} />
                      </div>
                    ))}
                    {puedeEditar && <AgregarTarea personas={personas} reunionId={id} temaId={t.id} proyectoId={t.proyecto_id} sufijo={t.id} />}
                  </div>
                )}
              </section>
            );
          })}

          {puedeEditar && (
            <form action={agregarTema} className="tarjeta" style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", gap: 10 }}>
              <input type="hidden" name="reunion_id" value={id} />
              <div className="campo" style={{ flex: "2 1 260px" }}>
                <label htmlFor="nuevo-tema">Agregar tema</label>
                <input id="nuevo-tema" name="titulo" type="text" placeholder="Tema" required />
              </div>
              <div className="campo" style={{ flex: "1 1 200px" }}>
                <label htmlFor="tema-proyecto">De qué proyecto (opcional)</label>
                <select id="tema-proyecto" name="proyecto_id" defaultValue="">
                  <option value="">Ninguno</option>
                  {(proyectosR.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <Enviar className="boton primario">Agregar</Enviar>
            </form>
          )}
        </div>

      </div>
    </>
  );
}
