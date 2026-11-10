import Link from "next/link";
import { requerirMiembro } from "@/lib/sesion";
import { estadoCierre, fechaLarga, haceCuanto, hoyBA, hoyTitulo, semanaActual } from "@/lib/fechas";
import { ordenarTareas, SELECT_TAREA, type Tarea } from "@/lib/datos";
import { TablaTareas } from "@/components/TablaTareas";
import { IconoReloj } from "@/components/Iconos";
import { Enviar } from "@/components/Cliente";
import { RESPUESTA } from "@/lib/etiquetas";
import { responderAsistencia } from "./acciones";

export default async function Inicio() {
  const { supabase, yo } = await requerirMiembro();
  const semana = semanaActual();
  const hoy = hoyBA();

  const [misTareas, miActualizacion, reunion, trabadas, ideasNuevas, seguimientos, ultimasIdeas, ultimasActas] = await Promise.all([
    supabase.from("tareas").select(SELECT_TAREA).eq("responsable_id", yo.id).not("estado", "in", "(hecha,cancelada)"),
    supabase.from("actualizaciones").select("id").eq("integrante_id", yo.id).eq("semana", semana).maybeSingle(),
    supabase.from("reuniones").select("id, fecha, hora, estado").neq("estado", "cerrada").gte("fecha", hoy).order("fecha").limit(1).maybeSingle(),
    supabase.from("tareas").select("id", { count: "exact", head: true }).eq("estado", "trabada"),
    supabase.from("ideas").select("id", { count: "exact", head: true }).eq("estado", "nueva"),
    yo.esCoord
      ? Promise.all([
          supabase.from("proyectos").select("id", { count: "exact", head: true }).eq("seguimiento", "pendiente"),
          supabase.from("actividades").select("id", { count: "exact", head: true }).eq("seguimiento", "pendiente"),
          supabase.from("decisiones").select("id", { count: "exact", head: true }).eq("seguimiento", "pendiente"),
        ])
      : Promise.resolve(null),
    supabase.from("ideas").select("id, titulo, created_at, integrantes!ideas_propuesta_por_fkey(nombre)").order("created_at", { ascending: false }).limit(3),
    supabase.from("reuniones").select("id, fecha").eq("estado", "cerrada").order("fecha", { ascending: false }).limit(1),
  ]);

  const tareas = ((misTareas.data ?? []) as unknown as Tarea[]).sort(ordenarTareas);
  const vencidas = tareas.filter((t) => t.vence && t.vence < hoy).length;
  const yaActualice = !!miActualizacion.data;
  const cierre = estadoCierre();
  const pendSeguimiento = seguimientos ? seguimientos.reduce((s, r) => s + (r.count ?? 0), 0) : 0;

  let temas = 0;
  let miNomina: string | null = null;
  let miRespuesta: { respuesta: string; motivo: string | null } | null = null;
  let vienen = 0;
  if (reunion.data) {
    const [t, n, c] = await Promise.all([
      supabase.from("reunion_temas").select("id", { count: "exact", head: true }).eq("reunion_id", reunion.data.id),
      supabase.from("nomina").select("id").eq("integrante_id", yo.id).eq("activo", true).maybeSingle(),
      supabase.rpc("conteo_asistencia", { rid: reunion.data.id }),
    ]);
    temas = t.count ?? 0;
    miNomina = n.data?.id ?? null;
    vienen = ((c.data ?? []) as { respuesta: string; cantidad: number }[]).find((x) => x.respuesta === "viene")?.cantidad ?? 0;
    if (miNomina) {
      const { data } = await supabase.from("asistencias").select("respuesta, motivo").eq("reunion_id", reunion.data.id).eq("nomina_id", miNomina).maybeSingle();
      miRespuesta = data;
    }
  }

  type Nov = { clave: string; texto: React.ReactNode; cuando: string };
  const novedades: Nov[] = [];
  for (const i of ultimasIdeas.data ?? []) {
    const quien = (i as unknown as { integrantes?: { nombre: string } | null }).integrantes?.nombre ?? "Alguien";
    novedades.push({ clave: `i${i.id}`, texto: <>{quien} cargó una idea: {i.titulo}.</>, cuando: i.created_at });
  }
  for (const r of ultimasActas.data ?? []) {
    novedades.push({ clave: `r${r.id}`, texto: <><Link href={`/reuniones/${r.id}`}>Acta del {fechaLarga(r.fecha)}</Link> publicada.</>, cuando: `${r.fecha}T22:00:00Z` });
  }
  novedades.sort((a, b) => (a.cuando < b.cuando ? 1 : -1));

  return (
    <>
      <div className="encabezado">
        <div>
          <p className="suave">{hoyTitulo()}</p>
          <h1>Tu semana</h1>
        </div>
      </div>

      {!yaActualice && yo.estado === "activo" && !yo.esColumna && (
        <div className={`aviso ${cierre === "abierta" ? "gris" : "ambar"}`} role="status">
          <IconoReloj size={20} />
          <span>
            <strong>
              {cierre === "cierra_hoy"
                ? "Tu actualización semanal cierra hoy a las 22 h."
                : cierre === "cerrada"
                  ? "Todavía no cargaste tu actualización de esta semana."
                  : "Tu actualización semanal cierra el martes a las 22 h."}
            </strong>{" "}
            Te lleva dos minutos.
          </span>
          <Link href="/actualizacion" className={`boton ${cierre === "abierta" ? "" : "ambar"}`}>
            Actualizar
          </Link>
        </div>
      )}

      <div className="columnas">
        <section className="col-principal" aria-labelledby="tareas-t">
          <div className="tarjeta sin-relleno">
            <div className="tarjeta-cabecera">
              <h2 id="tareas-t">Mis tareas</h2>
              <span className="suave chico">{tareas.length} abiertas</span>
            </div>
            <TablaTareas tareas={tareas} vacio="No tenés tareas abiertas." />
            <div className="tarjeta-pie acciones" style={{ justifyContent: "space-between" }}>
              <Link href="/cargar?tipo=tarea" className="boton texto">+ Agregar tarea</Link>
              <Link href="/calendario" className="boton texto">Ver en mi calendario</Link>
            </div>
          </div>
        </section>

        <div className="col-lateral">
          <section className="tarjeta" aria-labelledby="reu-t">
            {reunion.data ? (
              <>
                <p className="chico suave" style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {reunion.data.fecha === hoy ? "Hoy" : fechaLarga(reunion.data.fecha)} · {reunion.data.hora}
                </p>
                <h2 id="reu-t">Reunión de comisión</h2>
                <p className="suave chico">
                  {temas ? `Punteo con ${temas} ${temas === 1 ? "tema" : "temas"}.` : "Todavía no hay punteo."}
                  {vienen > 0 && ` Confirmaron ${vienen}.`} 18:15 en la puerta del aula, 18:30 arrancamos.
                </p>
                {miNomina && (
                  <div className="formulario" style={{ gap: 8 }}>
                    {miRespuesta && miRespuesta.respuesta !== "sin_respuesta" ? (
                      <p className="chico">
                        Respondiste: <span className={`chip ${RESPUESTA[miRespuesta.respuesta]?.color ?? "gris"}`}>{RESPUESTA[miRespuesta.respuesta]?.texto}</span>
                      </p>
                    ) : (
                      <p className="chico" style={{ fontWeight: 700 }}>¿Venís?</p>
                    )}
                    <form action={responderAsistencia} className="formulario" style={{ gap: 8 }}>
                      <input type="hidden" name="reunion_id" value={reunion.data.id} />
                      <input type="hidden" name="nomina_id" value={miNomina} />
                      <div className="acciones">
                        <Enviar name="respuesta" value="viene" className="boton verde chico" pendiente="…">Voy</Enviar>
                        <Enviar name="respuesta" value="no_viene" className="boton chico" pendiente="…">No puedo</Enviar>
                      </div>
                      <label className="oculto" htmlFor="motivo-inicio">Si no podés, contá por qué</label>
                      <input id="motivo-inicio" name="motivo" type="text" placeholder="Si no podés, ¿por qué? (opcional)" defaultValue={miRespuesta?.motivo ?? ""} style={{ minHeight: 36 }} />
                    </form>
                  </div>
                )}
                <div className="acciones">
                  <Link href={`/reuniones/${reunion.data.id}`} className="boton primario chico">
                    Ver punteo
                  </Link>
                  {yo.llevaAsistencia && <Link href="/columna" className="boton chico">Asistencia</Link>}
                </div>
              </>
            ) : (
              <>
                <h2 id="reu-t">Reunión de comisión</h2>
                <p className="suave chico">No hay una próxima reunión cargada.</p>
                {yo.esCoord && <Link href="/reuniones" className="boton" style={{ alignSelf: "flex-start" }}>Crear la reunión</Link>}
              </>
            )}
          </section>

          <section className="tarjeta" aria-labelledby="aten-t">
            <h2 id="aten-t">Necesita atención</h2>
            <ul className="conteos">
              <li><span className={`chip ${vencidas ? "rojo" : "gris"}`}>{vencidas}</span> tareas tuyas vencidas</li>
              <li><span className={`chip ${trabadas.count ? "rojo" : "gris"}`}>{trabadas.count ?? 0}</span> tareas trabadas en la comisión</li>
              <li><span className="chip gris">{ideasNuevas.count ?? 0}</span> ideas nuevas para tratar</li>
              {yo.esCoord && <li><span className={`chip ${pendSeguimiento ? "ambar" : "gris"}`}>{pendSeguimiento}</span> esperando a seguimiento</li>}
            </ul>
            <Link href={yo.esCoord ? "/coordinacion" : "/comision"} className="boton texto" style={{ alignSelf: "flex-start", paddingLeft: 0 }}>
              {yo.esCoord ? "Abrir el informe" : "Ver la comisión"}
            </Link>
          </section>

          {novedades.length > 0 && (
            <section className="tarjeta" aria-labelledby="nov-t">
              <h2 id="nov-t">Novedades</h2>
              <ul className="conteos" style={{ gap: 12 }}>
                {novedades.slice(0, 4).map((n) => (
                  <li key={n.clave} style={{ display: "block" }}>
                    {n.texto} <span className="suave">{haceCuanto(n.cuando)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
