import Link from "next/link";
import { headers } from "next/headers";
import { requerirCoord } from "@/lib/sesion";
import { claveResponsable, nombreDe, personasActivas, responsablesPosibles } from "@/lib/datos";
import { fechaCorta, fechaLarga, hoyBA, semanaActual, sumarDias } from "@/lib/fechas";
import { Chip } from "@/components/Chip";
import { Copiar, Enviar } from "@/components/Cliente";
import { BotonesSeguimiento } from "@/components/Seguimiento";
import { Vence } from "@/components/TablaTareas";
import { IconoCandado } from "@/components/Iconos";
import { agregarTema, alPunteo, crearReunion } from "../acciones";
import { horarios, textoPunteo as armarTextoPunteo } from "@/lib/punteo";

function AlPunteo({ titulo, origen, proyectoId, ideaId }: { titulo?: string; origen?: string; proyectoId?: string | null; ideaId?: string }) {
  return (
    <form action={alPunteo} className="en-linea">
      {titulo && <input type="hidden" name="titulo" value={titulo} />}
      {origen && <input type="hidden" name="origen" value={origen} />}
      {proyectoId && <input type="hidden" name="proyecto_id" value={proyectoId} />}
      {ideaId && <input type="hidden" name="idea_id" value={ideaId} />}
      <Enviar className="boton chico" pendiente="…">Al punteo</Enviar>
    </form>
  );
}

function Cuenta({ n, color }: { n: number; color: "rojo" | "ambar" | "gris" }) {
  return <Chip color={n ? color : "gris"}>{n}</Chip>;
}

export default async function Coordinacion() {
  const { supabase } = await requerirCoord();
  const hoy = hoyBA();
  const semana = semanaActual();
  const hace14 = new Date(Date.now() - 14 * 86400000).toISOString();
  const h = await headers();
  const base = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;

  const [personas, acts, trabadas, vencidas, segProy, segAct, segDec, ideas, proyectosActivos, tareasRecientes, proximas, reunion] = await Promise.all([
    personasActivas(supabase),
    supabase.from("actualizaciones").select("integrante_id, necesito, sin_novedades").eq("semana", semana),
    supabase.from("tareas").select("id, titulo, responsable_id, responsable_nomina_id, nota_trabada, proyecto_id, actividad_id, proyectos(nombre), actividades(nombre)").eq("estado", "trabada"),
    supabase.from("tareas").select("id, titulo, responsable_id, responsable_nomina_id, vence, proyecto_id").not("estado", "in", "(hecha,cancelada)").lt("vence", hoy).order("vence"),
    supabase.from("proyectos").select("id, nombre, seguimiento_at").eq("seguimiento", "pendiente"),
    supabase.from("actividades").select("id, nombre, seguimiento_at").eq("seguimiento", "pendiente"),
    supabase.from("decisiones").select("id, texto, created_at, reuniones(fecha)").eq("seguimiento", "pendiente"),
    supabase.from("ideas").select("id, titulo, propuesta_por, created_at").eq("estado", "nueva").order("created_at"),
    supabase.from("proyectos").select("id, nombre, responsable_id, updated_at").in("estado", ["aprobado", "en_marcha"]),
    supabase.from("tareas").select("proyecto_id, updated_at").gte("updated_at", hace14).not("proyecto_id", "is", null),
    supabase.from("actividades").select("id, nombre, fecha, hora, lugar").gte("fecha", hoy).lte("fecha", sumarDias(hoy, 10)).neq("estado", "cancelada").order("fecha"),
    supabase.from("reuniones").select("id, fecha, hora, estado").neq("estado", "cerrada").gte("fecha", hoy).order("fecha").limit(1).maybeSingle(),
  ]);

  const activos = personas.filter((p) => p.estado === "activo" && p.rol !== "columna");
  const actualizaron = new Set((acts.data ?? []).map((a) => a.integrante_id));
  const faltan = activos.filter((p) => !actualizaron.has(p.id));
  const necesidades = (acts.data ?? []).filter((a) => a.necesito);
  const pct = activos.length ? Math.round((100 * (activos.length - faltan.length)) / activos.length) : 0;

  const conMovimiento = new Set((tareasRecientes.data ?? []).map((t) => t.proyecto_id));
  const quietos = (proyectosActivos.data ?? []).filter((p) => p.updated_at < hace14 && !conMovimiento.has(p.id));

  const seguimientos = [
    ...(segProy.data ?? []).map((p) => ({ tabla: "proyectos" as const, id: p.id, texto: p.nombre, detalle: "Proyecto", href: `/proyectos/${p.id}` })),
    ...(segAct.data ?? []).map((a) => ({ tabla: "actividades" as const, id: a.id, texto: a.nombre, detalle: "Actividad", href: `/actividades/${a.id}` })),
    ...(segDec.data ?? []).map((d) => {
      const f = (d as unknown as { reuniones?: { fecha: string } | null }).reuniones?.fecha;
      return { tabla: "decisiones" as const, id: d.id, texto: d.texto, detalle: f ? `Decidido el ${fechaCorta(f)}` : "Decisión", href: null as string | null };
    }),
  ];

  let temas: { id: string; titulo: string; origen: string | null; puntos: string | null; minutos: number | null }[] = [];
  if (reunion.data) {
    const { data } = await supabase.from("reunion_temas").select("id, titulo, origen, puntos, minutos").eq("reunion_id", reunion.data.id).order("orden").order("created_at");
    temas = data ?? [];
  }

  const recordatorio = `Recordatorio: antes del martes a las 22 h, cada uno carga su actualización semanal. Son dos minutos: ${base}/actualizacion`;
  const responsables = await responsablesPosibles(supabase, personas);
  const textoPunteo = reunion.data
    ? armarTextoPunteo(`*Reunión de AA · ${fechaLarga(reunion.data.fecha)}*`, temas, personas.find((p) => p.rol === "responsable")?.nombre.split(" ")[0] ?? "la responsable")
    : "";
  const horas = horarios(temas.map((t) => t.minutos));

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Informe para la reunión</h1>
          <p className="suave">
            {reunion.data ? `${fechaLarga(reunion.data.fecha).replace(/^./, (c) => c.toUpperCase())} · ${reunion.data.hora}` : "Sin reunión cargada"} · con las actualizaciones hasta el martes a las 22 h
          </p>
        </div>
        <span className="chip contorno" style={{ padding: "6px 12px", fontSize: 13 }}><IconoCandado size={14} /> Solo responsable y seguimiento</span>
      </div>

      <div className="columnas">
        <div className="col-principal grilla" style={{ display: "grid" }}>
          <section className="tarjeta" aria-labelledby="c-act">
            <h2 id="c-act">Actualizaciones</h2>
            <p className="numero-grande">{activos.length - faltan.length} <span>de {activos.length}</span></p>
            <div className="barra" aria-hidden="true"><div style={{ width: `${pct}%` }} /></div>
            {faltan.length ? (
              <p style={{ fontSize: 14 }}><strong className="texto-ambar">Faltan {faltan.length}:</strong> {faltan.map((p) => p.nombre).join(", ")}.</p>
            ) : (
              <p className="texto-verde" style={{ fontSize: 14 }}>Actualizaron todos.</p>
            )}
            <Copiar texto={recordatorio} className="boton chico">Copiar recordatorio para el grupo</Copiar>
          </section>

          <section className="tarjeta" aria-labelledby="c-nec">
            <div className="titulo-con-numero"><h2 id="c-nec">Lo que necesitan</h2><Cuenta n={necesidades.length} color="ambar" /></div>
            {necesidades.length ? (
              <ul className="lista">
                {necesidades.map((a) => (
                  <li key={a.integrante_id} style={{ alignItems: "flex-start" }}>
                    <div className="cuerpo">
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{nombreDe(personas, a.integrante_id)}</span>
                      <span style={{ fontSize: 14 }}>{a.necesito}</span>
                    </div>
                    <AlPunteo titulo={`${nombreDe(personas, a.integrante_id)}: ${a.necesito}`.slice(0, 140)} origen="Actualización semanal" />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="suave chico">Nadie pidió nada esta semana.</p>
            )}
          </section>

          <section className="tarjeta" aria-labelledby="c-tra">
            <div className="titulo-con-numero"><h2 id="c-tra">Trabadas</h2><Cuenta n={(trabadas.data ?? []).length} color="rojo" /></div>
            {(trabadas.data ?? []).length ? (
              <ul className="lista">
                {(trabadas.data ?? []).map((t) => {
                  const ctx = (t as unknown as { proyectos?: { nombre: string } | null; actividades?: { nombre: string } | null });
                  return (
                    <li key={t.id}>
                      <div className="cuerpo">
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{t.titulo}</span>
                        <span className="chico suave">{nombreDe(responsables, claveResponsable(t))}{t.nota_trabada ? ` · ${t.nota_trabada}` : ""}</span>
                      </div>
                      <AlPunteo titulo={`Destrabar: ${t.titulo}`} origen={ctx.proyectos?.nombre ?? ctx.actividades?.nombre ?? "Tarea trabada"} proyectoId={t.proyecto_id} />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="suave chico">No hay tareas trabadas.</p>
            )}
          </section>

          <section className="tarjeta" aria-labelledby="c-seg">
            <div className="titulo-con-numero"><h2 id="c-seg">Esperando seguimiento</h2><Cuenta n={seguimientos.length} color="ambar" /></div>
            {seguimientos.length ? (
              <ul className="lista">
                {seguimientos.map((s) => (
                  <li key={s.id} style={{ flexWrap: "wrap" }}>
                    <div className="cuerpo" style={{ flex: "1 1 180px" }}>
                      {s.href ? <Link href={s.href} style={{ fontWeight: 600, fontSize: 14 }}>{s.texto}</Link> : <span style={{ fontWeight: 600, fontSize: 14 }}>{s.texto}</span>}
                      <span className="chico suave">{s.detalle}</span>
                    </div>
                    <div className="acciones"><BotonesSeguimiento tabla={s.tabla} id={s.id} estado="pendiente" /></div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="suave chico">No hay nada esperando a seguimiento.</p>
            )}
          </section>

          <section className="tarjeta" aria-labelledby="c-ven">
            <div className="titulo-con-numero"><h2 id="c-ven">Vencidas</h2><Cuenta n={(vencidas.data ?? []).length} color="rojo" /></div>
            {(vencidas.data ?? []).length ? (
              <ul className="lista">
                {(vencidas.data ?? []).slice(0, 8).map((t) => (
                  <li key={t.id}>
                    <div className="cuerpo">
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{t.titulo}</span>
                      <span className="chico">{nombreDe(responsables, claveResponsable(t))} · <Vence fecha={t.vence} /></span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="suave chico">No hay tareas vencidas.</p>
            )}
          </section>

          <section className="tarjeta" aria-labelledby="c-ide">
            <div className="titulo-con-numero"><h2 id="c-ide">Ideas nuevas</h2><Cuenta n={(ideas.data ?? []).length} color="gris" /></div>
            {(ideas.data ?? []).length ? (
              <ul className="lista">
                {(ideas.data ?? []).map((i) => (
                  <li key={i.id}>
                    <div className="cuerpo">
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{i.titulo}</span>
                      <span className="chico suave">{nombreDe(personas, i.propuesta_por)}</span>
                    </div>
                    <AlPunteo ideaId={i.id} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="suave chico">No hay ideas nuevas.</p>
            )}
          </section>

          <section className="tarjeta" aria-labelledby="c-qui">
            <div className="titulo-con-numero"><h2 id="c-qui">Sin movimiento hace 2 semanas</h2><Cuenta n={quietos.length} color="rojo" /></div>
            {quietos.length ? (
              <ul className="lista">
                {quietos.map((p) => (
                  <li key={p.id}>
                    <div className="cuerpo">
                      <Link href={`/proyectos/${p.id}`} style={{ fontWeight: 600, fontSize: 14 }}>{p.nombre}</Link>
                      <span className="chico suave">{nombreDe(personas, p.responsable_id)}</span>
                    </div>
                    <AlPunteo titulo={`¿Cómo sigue ${p.nombre}?`} origen="Sin movimiento" proyectoId={p.id} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="suave chico">Todos los proyectos en marcha tuvieron movimiento.</p>
            )}
          </section>

          <section className="tarjeta" aria-labelledby="c-pro">
            <h2 id="c-pro">Próximos 10 días</h2>
            {(proximas.data ?? []).length ? (
              <ul className="conteos">
                {(proximas.data ?? []).map((a) => (
                  <li key={a.id} style={{ alignItems: "baseline" }}>
                    <strong style={{ width: 76, flex: "none" }}>{fechaCorta(a.fecha)}</strong>
                    <Link href={`/actividades/${a.id}`}>{a.nombre}</Link>
                    <span className="suave chico">{[a.hora, a.lugar].filter(Boolean).join(" · ")}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="suave chico">No hay actividades en los próximos 10 días.</p>
            )}
          </section>
        </div>

        <aside className="col-lateral tarjeta destacada" aria-labelledby="punteo-t" style={{ flex: "1 1 300px" }}>
          <div className="titulo-con-numero" style={{ justifyContent: "space-between" }}>
            <h2 id="punteo-t" style={{ fontSize: 20 }}>Punteo</h2>
            <span className="suave chico">{temas.length} {temas.length === 1 ? "tema" : "temas"}</span>
          </div>
          {reunion.data ? (
            <>
              <ol className="conteos" style={{ gap: 12 }}>
                {temas.map((t, i) => (
                  <li key={t.id} style={{ alignItems: "flex-start" }}>
                    <span className="tema-numero">{i + 1}</span>
                    <span style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontWeight: 600 }}>{t.titulo}</span>
                      <span className="chico suave">{horas[i]} · {t.minutos ?? 5} min{t.origen ? ` · ${t.origen}` : ""}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <form action={agregarTema} style={{ display: "flex", gap: 8 }}>
                <input type="hidden" name="reunion_id" value={reunion.data.id} />
                <label htmlFor="tema" className="oculto">Agregar tema</label>
                <input id="tema" name="titulo" type="text" placeholder="Agregar tema" required />
                <Enviar className="boton" pendiente="…">Agregar</Enviar>
              </form>
              <Link href={`/reuniones/${reunion.data.id}/armar`} className="boton">Armar punteo sugerido</Link>
              <Copiar texto={textoPunteo} className="boton primario">Copiar para WhatsApp</Copiar>
              <Link href={`/reuniones/${reunion.data.id}`} className="boton">Abrir la reunión</Link>
            </>
          ) : (
            <form action={crearReunion} className="formulario">
              <input type="hidden" name="fecha" value={semanaActual()} />
              <p className="suave chico">No hay reunión cargada para el {fechaLarga(semanaActual())}.</p>
              <Enviar>Crear la reunión</Enviar>
            </form>
          )}
        </aside>
      </div>
    </>
  );
}
