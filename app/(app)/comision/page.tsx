import Link from "next/link";
import { requerirMiembro } from "@/lib/sesion";
import { personasActivas, nombreDe } from "@/lib/datos";
import { ESTADO_ACTIVIDAD, ESTADO_IDEA, ESTADO_PROYECTO, TIPO_ACTIVIDAD, TIPO_IDEA } from "@/lib/etiquetas";
import { fechaCorta, hoyBA, vencimiento } from "@/lib/fechas";
import { Chip, ChipDe } from "@/components/Chip";
import { Enviar } from "@/components/Cliente";
import { alPunteo, crearMesa, editarMesa, guardarLinea, sacarDeMesa, sumarAMesa } from "../acciones";

type Vista = "proyectos" | "mesas" | "ideas" | "lineas";

export default async function Comision({ searchParams }: { searchParams: Promise<{ vista?: string; filtro?: string }> }) {
  const sp = await searchParams;
  const vista: Vista = (["mesas", "ideas", "lineas"].includes(sp.vista ?? "") ? sp.vista : "proyectos") as Vista;
  const { supabase, yo } = await requerirMiembro();
  const { count: ideasNuevas } = await supabase.from("ideas").select("id", { count: "exact", head: true }).eq("estado", "nueva");

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Comisión</h1>
          <p className="suave">Todo lo que está en marcha, quién lo lleva y qué falta.</p>
        </div>
        <div className="acciones">
          <Link href="/actividades/nueva" className="boton">Nueva actividad</Link>
          <Link href="/proyectos/nuevo" className="boton primario">Nuevo proyecto</Link>
        </div>
      </div>

      <nav className="pestanas" aria-label="Vistas de la comisión">
        <Link href="/comision" aria-current={vista === "proyectos" ? "page" : undefined}>Proyectos y actividades</Link>
        <Link href="/comision?vista=mesas" aria-current={vista === "mesas" ? "page" : undefined}>Mesas</Link>
        <Link href="/comision?vista=ideas" aria-current={vista === "ideas" ? "page" : undefined}>
          Ideas {ideasNuevas ? <span className="chip gris">{ideasNuevas}</span> : null}
        </Link>
        <Link href="/comision?vista=lineas" aria-current={vista === "lineas" ? "page" : undefined}>Líneas de trabajo</Link>
      </nav>

      {vista === "proyectos" && <VistaProyectos supabase={supabase} filtro={sp.filtro} />}
      {vista === "mesas" && <VistaMesas supabase={supabase} esCoord={yo.esCoord} />}
      {vista === "ideas" && <VistaIdeas supabase={supabase} esCoord={yo.esCoord} filtro={sp.filtro} />}
      {vista === "lineas" && <VistaLineas supabase={supabase} esCoord={yo.esCoord} />}
    </>
  );
}

type Sb = Awaited<ReturnType<typeof requerirMiembro>>["supabase"];

// ================= Proyectos y actividades =================
type Fila = {
  id: string;
  href: string;
  nombre: string;
  detalle: string;
  responsable: string;
  estado: React.ReactNode;
  grupoEstado: "propuestas" | "en_marcha" | "terminado" | "otro";
  mesaId: string | null;
  proximo: { titulo: string; vence: string | null } | null;
  abiertas: number;
  alertas: { texto: string; color: "rojo" | "ambar" }[];
};

async function VistaProyectos({ supabase, filtro }: { supabase: Sb; filtro?: string }) {
  const hoy = hoyBA();
  const hace14 = new Date(Date.now() - 14 * 86400000).toISOString();
  const [proy, act, mesas, tareas, personas] = await Promise.all([
    supabase.from("proyectos").select("*").neq("estado", "descartado").order("nombre"),
    supabase.from("actividades").select("*").neq("estado", "cancelada").order("fecha", { ascending: true, nullsFirst: false }),
    supabase.from("mesas").select("id, nombre, estado, mesa_integrantes(integrante_id)").order("nombre"),
    supabase.from("tareas").select("id, titulo, estado, vence, proyecto_id, actividad_id, updated_at").not("estado", "in", "(hecha,cancelada)"),
    personasActivas(supabase),
  ]);
  const ts = tareas.data ?? [];
  const mesaDeProyecto = new Map<string, string | null>((proy.data ?? []).map((p) => [p.id, p.mesa_id]));

  function resumen(filtroTarea: (t: (typeof ts)[number]) => boolean, actualizado: string, conMovimiento: boolean, seguimiento: string) {
    const mias = ts.filter(filtroTarea);
    const trabadas = mias.filter((t) => t.estado === "trabada").length;
    const vencidas = mias.filter((t) => t.vence && t.vence < hoy).length;
    const proximo = [...mias].sort((a, b) => ((a.vence ?? "9999") < (b.vence ?? "9999") ? -1 : 1))[0] ?? null;
    const ultimo = [actualizado, ...mias.map((t) => t.updated_at)].sort().pop()!;
    const alertas: Fila["alertas"] = [];
    if (trabadas) alertas.push({ texto: `${trabadas} trabada${trabadas > 1 ? "s" : ""}`, color: "rojo" });
    if (vencidas) alertas.push({ texto: `${vencidas} vencida${vencidas > 1 ? "s" : ""}`, color: "rojo" });
    if (conMovimiento && ultimo < hace14) alertas.push({ texto: "2 semanas sin movimiento", color: "rojo" });
    if (seguimiento === "pendiente") alertas.push({ texto: "Esperando seguimiento", color: "ambar" });
    if (seguimiento === "devuelto") alertas.push({ texto: "Devuelto por seguimiento", color: "rojo" });
    return { abiertas: mias.length, proximo: proximo ? { titulo: proximo.titulo, vence: proximo.vence } : null, alertas };
  }

  const filas: Fila[] = [];
  for (const p of proy.data ?? []) {
    const r = resumen((t) => t.proyecto_id === p.id, p.updated_at, ["aprobado", "en_marcha"].includes(p.estado), p.seguimiento);
    filas.push({
      id: p.id,
      href: `/proyectos/${p.id}`,
      nombre: p.nombre,
      detalle: "Proyecto",
      responsable: nombreDe(personas, p.responsable_id),
      estado: <ChipDe mapa={ESTADO_PROYECTO} valor={p.estado} />,
      grupoEstado: p.estado === "propuesta" ? "propuestas" : ["aprobado", "en_marcha"].includes(p.estado) ? "en_marcha" : p.estado === "terminado" ? "terminado" : "otro",
      mesaId: p.mesa_id,
      ...r,
    });
  }
  for (const a of act.data ?? []) {
    const r = resumen((t) => t.actividad_id === a.id, a.updated_at, false, a.seguimiento);
    if (a.estado === "realizada" && !a.cierre) r.alertas.push({ texto: "Cierre pendiente", color: "ambar" });
    const proyNombre = (proy.data ?? []).find((p) => p.id === a.proyecto_id)?.nombre;
    filas.push({
      id: a.id,
      href: `/actividades/${a.id}`,
      nombre: a.nombre,
      detalle: [TIPO_ACTIVIDAD[a.tipo] ?? "Actividad", a.fecha ? fechaCorta(a.fecha) : null, proyNombre ? `de ${proyNombre}` : null].filter(Boolean).join(" · "),
      responsable: nombreDe(personas, a.responsable_id),
      estado: <ChipDe mapa={ESTADO_ACTIVIDAD} valor={a.estado} />,
      grupoEstado: a.estado === "propuesta" ? "propuestas" : ["aprobada", "en_organizacion", "inscripciones_abiertas"].includes(a.estado) ? "en_marcha" : ["realizada", "cerrada"].includes(a.estado) ? "terminado" : "otro",
      mesaId: a.mesa_id ?? (a.proyecto_id ? (mesaDeProyecto.get(a.proyecto_id) ?? null) : null),
      ...r,
    });
  }

  const cuenta = {
    todo: filas.filter((x) => x.grupoEstado !== "terminado" || x.alertas.length > 0).length,
    alertas: filas.filter((f) => f.alertas.length).length,
    propuestas: filas.filter((f) => f.grupoEstado === "propuestas").length,
    en_marcha: filas.filter((f) => f.grupoEstado === "en_marcha").length,
    terminado: filas.filter((f) => f.grupoEstado === "terminado").length,
  };
  const f = ["alertas", "propuestas", "en_marcha", "terminado"].includes(filtro ?? "") ? filtro : "todo";
  const visibles = filas.filter((x) =>
    f === "todo" ? x.grupoEstado !== "terminado" || x.alertas.length > 0 : f === "alertas" ? x.alertas.length > 0 : x.grupoEstado === f,
  );

  const grupos: { titulo: string; detalle: string; filas: Fila[] }[] = [];
  for (const m of mesas.data ?? []) {
    const fs = visibles.filter((x) => x.mesaId === m.id);
    const n = (m.mesa_integrantes ?? []).length;
    if (fs.length) grupos.push({ titulo: m.nombre, detalle: `${n} integrante${n === 1 ? "" : "s"}`, filas: fs });
  }
  const sinMesa = visibles.filter((x) => !x.mesaId || !(mesas.data ?? []).some((m) => m.id === x.mesaId));
  if (sinMesa.length) grupos.push({ titulo: "Sin mesa", detalle: "", filas: sinMesa });

  const chip = (clave: string, texto: string, color = "") => (
    <Link href={clave === "todo" ? "/comision" : `/comision?filtro=${clave}`} className={color} aria-current={f === clave ? "true" : undefined}>
      {texto}
    </Link>
  );

  return (
    <>
      <div className="filtros" role="group" aria-label="Filtrar">
        {chip("todo", `En curso · ${cuenta.todo}`)}
        {chip("alertas", `Con alertas · ${cuenta.alertas}`, "rojo")}
        {chip("propuestas", `Propuestas · ${cuenta.propuestas}`)}
        {chip("en_marcha", `En marcha · ${cuenta.en_marcha}`, "azul")}
        {chip("terminado", `Terminado · ${cuenta.terminado}`, "verde")}
      </div>

      <div className="tarjeta sin-relleno">
        {grupos.length === 0 ? (
          <p className="vacio">
            {filas.length === 0 ? (
              <>Todavía no hay proyectos ni actividades. <Link href="/proyectos/nuevo">Cargá el primero</Link>.</>
            ) : (
              "No hay nada con este filtro."
            )}
          </p>
        ) : (
          <div className="tabla-caja">
            <table className="tabla" style={{ minWidth: 820 }}>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Responsable</th>
                  <th>Estado</th>
                  <th>Próximo paso</th>
                  <th>Tareas</th>
                  <th>Atención</th>
                </tr>
              </thead>
              {grupos.map((g) => (
                <tbody key={g.titulo}>
                  <tr className="grupo">
                    <th colSpan={6} scope="colgroup">
                      {g.titulo} {g.detalle && <span className="suave" style={{ fontWeight: 500 }}>· {g.detalle}</span>}
                    </th>
                  </tr>
                  {g.filas.map((x) => {
                    const v = x.proximo ? vencimiento(x.proximo.vence) : null;
                    return (
                      <tr key={x.id}>
                        <td>
                          <Link href={x.href} className="nombre">{x.nombre}</Link>
                          <div className="chico suave">{x.detalle}</div>
                        </td>
                        <td>{x.responsable}</td>
                        <td>{x.estado}</td>
                        <td>
                          {x.proximo ? (
                            <>
                              {x.proximo.titulo}{" "}
                              {v && v.nivel !== "sin" && (
                                <span className={v.nivel === "vencida" ? "texto-rojo" : v.nivel === "hoy" ? "texto-ambar" : "suave"}>· {v.texto.toLowerCase()}</span>
                              )}
                            </>
                          ) : (
                            <span className="suave">Sin tareas abiertas</span>
                          )}
                        </td>
                        <td>{x.abiertas}</td>
                        <td>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {x.alertas.length ? x.alertas.map((a) => <Chip key={a.texto} color={a.color}>{a.texto}</Chip>) : <span className="suave">—</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// ================= Mesas =================
async function VistaMesas({ supabase, esCoord }: { supabase: Sb; esCoord: boolean }) {
  const [mesas, personas, proyectos] = await Promise.all([
    supabase.from("mesas").select("id, nombre, mision, referente_id, estado, mesa_integrantes(integrante_id)").order("estado").order("nombre"),
    personasActivas(supabase),
    supabase.from("proyectos").select("id, nombre, estado, mesa_id").not("estado", "in", "(descartado)"),
  ]);
  const lista = mesas.data ?? [];

  return (
    <>
      {lista.length === 0 && <p className="tarjeta suave">Todavía no hay mesas. Se crean cuando haya un grupo con trabajo concreto.</p>}
      <div className="grilla">
        {lista.map((m) => {
          const ids = (m.mesa_integrantes ?? []).map((x: { integrante_id: string }) => x.integrante_id);
          const integrantes = personas.filter((p) => ids.includes(p.id));
          const disponibles = personas.filter((p) => !ids.includes(p.id));
          const susProyectos = (proyectos.data ?? []).filter((p) => p.mesa_id === m.id);
          return (
            <section key={m.id} className="tarjeta" aria-labelledby={`mesa-${m.id}`}>
              <div className="titulo-con-numero" style={{ justifyContent: "space-between" }}>
                <h2 id={`mesa-${m.id}`}>{m.nombre}</h2>
                {m.estado !== "activa" && <span className="chip gris">{m.estado === "pausada" ? "Pausada" : "Cerrada"}</span>}
              </div>
              {m.mision && <p className="texto-largo">{m.mision}</p>}
              <dl className="datos">
                <dt>Referente</dt>
                <dd>{m.referente_id ? nombreDe(personas, m.referente_id) : <span className="suave" style={{ fontWeight: 400 }}>Sin definir</span>}</dd>
                <dt>Proyectos</dt>
                <dd>
                  {susProyectos.length ? (
                    susProyectos.map((p, i) => (
                      <span key={p.id}>
                        {i > 0 && ", "}
                        <Link href={`/proyectos/${p.id}`}>{p.nombre}</Link>
                      </span>
                    ))
                  ) : (
                    <span className="suave" style={{ fontWeight: 400 }}>Ninguno</span>
                  )}
                </dd>
              </dl>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="chico suave" style={{ fontWeight: 700 }}>Integrantes · {integrantes.length}</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {integrantes.map((p) =>
                    esCoord ? (
                      <form key={p.id} action={sacarDeMesa} className="en-linea">
                        <input type="hidden" name="mesa_id" value={m.id} />
                        <input type="hidden" name="integrante_id" value={p.id} />
                        <button type="submit" className="boton chico" title={`Sacar a ${p.nombre} de la mesa`}>
                          {p.nombre} <span aria-hidden="true">×</span>
                        </button>
                      </form>
                    ) : (
                      <span key={p.id} className="chip gris">{p.nombre}</span>
                    ),
                  )}
                  {!integrantes.length && <span className="suave chico">Nadie todavía.</span>}
                </div>
              </div>
              {esCoord && (
                <>
                  {disponibles.length > 0 && (
                    <form action={sumarAMesa} style={{ display: "flex", gap: 8 }}>
                      <input type="hidden" name="mesa_id" value={m.id} />
                      <label htmlFor={`sumar-${m.id}`} className="oculto">Sumar integrante</label>
                      <select id={`sumar-${m.id}`} name="integrante_id" defaultValue="">
                        <option value="" disabled>Sumar a…</option>
                        {disponibles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                      </select>
                      <Enviar className="boton chico">Sumar</Enviar>
                    </form>
                  )}
                  <details>
                    <summary>Editar mesa</summary>
                    <form action={editarMesa} className="formulario" style={{ paddingTop: 8 }}>
                      <input type="hidden" name="id" value={m.id} />
                      <div className="campo"><label htmlFor={`n-${m.id}`}>Nombre</label><input id={`n-${m.id}`} name="nombre" type="text" defaultValue={m.nombre} required /></div>
                      <div className="campo"><label htmlFor={`mi-${m.id}`}>Misión</label><textarea id={`mi-${m.id}`} name="mision" rows={2} defaultValue={m.mision ?? ""} /></div>
                      <div className="fila-campos">
                        <div className="campo">
                          <label htmlFor={`r-${m.id}`}>Referente</label>
                          <select id={`r-${m.id}`} name="referente_id" defaultValue={m.referente_id ?? ""}>
                            <option value="">Sin definir</option>
                            {personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                          </select>
                        </div>
                        <div className="campo">
                          <label htmlFor={`e-${m.id}`}>Estado</label>
                          <select id={`e-${m.id}`} name="estado" defaultValue={m.estado}>
                            <option value="activa">Activa</option>
                            <option value="pausada">Pausada</option>
                            <option value="cerrada">Cerrada</option>
                          </select>
                        </div>
                      </div>
                      <Enviar className="boton primario chico">Guardar</Enviar>
                    </form>
                  </details>
                </>
              )}
            </section>
          );
        })}
      </div>

      {esCoord && (
        <section className="tarjeta" aria-labelledby="nueva-mesa">
          <h2 id="nueva-mesa">Nueva mesa</h2>
          <form action={crearMesa} className="formulario">
            <div className="fila-campos">
              <div className="campo"><label htmlFor="nm-nombre">Nombre</label><input id="nm-nombre" name="nombre" type="text" required /></div>
              <div className="campo"><label htmlFor="nm-mision">Para qué existe</label><input id="nm-mision" name="mision" type="text" /></div>
            </div>
            <Enviar className="boton primario" >Crear mesa</Enviar>
          </form>
        </section>
      )}
    </>
  );
}

// ================= Ideas =================
async function VistaIdeas({ supabase, esCoord, filtro }: { supabase: Sb; esCoord: boolean; filtro?: string }) {
  const estados = ["nueva", "en_punteo", "propuesta", "postergada", "descartada"];
  const f = estados.includes(filtro ?? "") ? filtro! : "abiertas";
  let q = supabase.from("ideas").select("id, titulo, descripcion, tipo, estado, created_at, proyecto_id, propuesta_por, lineas(nombre)").order("created_at", { ascending: false });
  q = f === "abiertas" ? q.in("estado", ["nueva", "en_punteo", "postergada"]) : q.eq("estado", f);
  const [ideas, personas] = await Promise.all([q, personasActivas(supabase)]);

  const chip = (clave: string, texto: string) => (
    <Link href={clave === "abiertas" ? "/comision?vista=ideas" : `/comision?vista=ideas&filtro=${clave}`} aria-current={f === clave ? "true" : undefined}>
      {texto}
    </Link>
  );

  return (
    <>
      <div className="encabezado" style={{ alignItems: "center" }}>
        <div className="filtros" role="group" aria-label="Filtrar ideas">
          {chip("abiertas", "Para tratar")}
          {chip("propuesta", "Pasaron a propuesta")}
          {chip("postergada", "Postergadas")}
          {chip("descartada", "Descartadas")}
        </div>
        <Link href="/cargar" className="boton primario">Cargar idea</Link>
      </div>
      <div className="tarjeta sin-relleno">
        {(ideas.data ?? []).length === 0 ? (
          <p className="vacio">No hay ideas acá.</p>
        ) : (
          <div className="tabla-caja">
            <table className="tabla">
              <thead>
                <tr><th>Idea</th><th>Propuso</th><th>Línea</th><th>Estado</th><th><span className="oculto">Acción</span></th></tr>
              </thead>
              <tbody>
                {(ideas.data ?? []).map((i) => (
                  <tr key={i.id}>
                    <td>
                      <span className="nombre">{i.titulo}</span>
                      <div className="chico suave">{TIPO_IDEA[i.tipo] ?? ""}{i.descripcion ? ` · ${i.descripcion}` : ""}</div>
                    </td>
                    <td>{nombreDe(personas, i.propuesta_por)}</td>
                    <td className="suave">{(i as unknown as { lineas?: { nombre: string } | null }).lineas?.nombre ?? "—"}</td>
                    <td><ChipDe mapa={ESTADO_IDEA} valor={i.estado} /></td>
                    <td className="nowrap">
                      {i.proyecto_id ? (
                        <Link href={`/proyectos/${i.proyecto_id}`} className="boton chico">Ver propuesta</Link>
                      ) : esCoord && (i.estado === "nueva" || i.estado === "postergada") ? (
                        <form action={alPunteo} className="en-linea">
                          <input type="hidden" name="idea_id" value={i.id} />
                          <Enviar className="boton chico" pendiente="Sumando…">Al punteo</Enviar>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// ================= Líneas =================
async function VistaLineas({ supabase, esCoord }: { supabase: Sb; esCoord: boolean }) {
  const [lineas, proyectos] = await Promise.all([
    supabase.from("lineas").select("*").order("orden"),
    supabase.from("proyectos").select("id, linea_id").not("estado", "in", "(descartado,terminado)"),
  ]);
  return (
    <>
      <div className="grilla">
        {(lineas.data ?? []).map((l) => {
          const n = (proyectos.data ?? []).filter((p) => p.linea_id === l.id).length;
          return (
            <section key={l.id} className="tarjeta" aria-labelledby={`l-${l.id}`}>
              <div className="titulo-con-numero" style={{ justifyContent: "space-between" }}>
                <h2 id={`l-${l.id}`}>{l.nombre}</h2>
                <span className="chip gris">{n} proyecto{n === 1 ? "" : "s"}</span>
              </div>
              <p className="texto-largo">{l.fundamento || <span className="suave">Sin fundamento cargado.</span>}</p>
              {esCoord && (
                <details>
                  <summary>Editar</summary>
                  <form action={guardarLinea} className="formulario" style={{ paddingTop: 8 }}>
                    <input type="hidden" name="id" value={l.id} />
                    <div className="campo"><label htmlFor={`ln-${l.id}`}>Nombre</label><input id={`ln-${l.id}`} name="nombre" type="text" defaultValue={l.nombre} required /></div>
                    <div className="campo"><label htmlFor={`lf-${l.id}`}>Fundamento</label><textarea id={`lf-${l.id}`} name="fundamento" rows={5} defaultValue={l.fundamento ?? ""} /></div>
                    <Enviar className="boton primario chico">Guardar</Enviar>
                  </form>
                </details>
              )}
            </section>
          );
        })}
      </div>
      {esCoord && (
        <section className="tarjeta" aria-labelledby="nueva-linea">
          <h2 id="nueva-linea">Nueva línea de trabajo</h2>
          <form action={guardarLinea} className="formulario">
            <div className="campo"><label htmlFor="nl-nombre">Nombre</label><input id="nl-nombre" name="nombre" type="text" required /></div>
            <div className="campo"><label htmlFor="nl-f">Fundamento</label><textarea id="nl-f" name="fundamento" rows={3} /></div>
            <Enviar className="boton primario">Crear línea</Enviar>
          </form>
        </section>
      )}
    </>
  );
}
