import Link from "next/link";
import { requerirMiembro } from "@/lib/sesion";
import { CANAL, claseComision } from "@/lib/etiquetas";
import { fechaCorta, hoyBA, lunesDe, sumarDias } from "@/lib/fechas";
import { leerDdo } from "@/lib/ddo";
import { Semana, type ItemSemana } from "@/components/Semana";
import { Confirmar, Enviar } from "@/components/Cliente";
import { borrarEvento, guardarEvento } from "../acciones";

type Evento = { id: string; titulo: string; fecha: string | null; hora: string | null; lugar: string | null; origen: string; nota: string | null; created_by: string | null };

/** Semana de la agrupación: AA, las otras comisiones (DDO) y las fechas generales, con un color por comisión. */
export async function SemanaAgrupacion({ semana }: { semana?: string }) {
  const { supabase, yo } = await requerirMiembro();
  const hoy = hoyBA();
  const lunes = semana && /^\d{4}-\d{2}-\d{2}$/.test(semana) ? lunesDe(semana) : lunesDe(hoy);
  const domingo = sumarDias(lunes, 6);

  const [reus, acts, tareas, eventosR, ddoR] = await Promise.all([
    supabase.from("reuniones").select("id, fecha, hora").gte("fecha", lunes).lte("fecha", domingo),
    supabase.from("actividades").select("id, nombre, fecha, hora").gte("fecha", lunes).lte("fecha", domingo).neq("estado", "cancelada"),
    supabase.from("tareas").select("id, titulo, vence, estado, canal, actividad_id, proyecto_id").gte("vence", lunes).lte("vence", domingo).not("estado", "in", "(hecha,cancelada)"),
    supabase.from("eventos").select("id, titulo, fecha, hora, lugar, origen, nota, created_by").or(`fecha.is.null,and(fecha.gte.${lunes},fecha.lte.${domingo})`).order("fecha"),
    yo.esCoord ? supabase.from("ddo").select("comision, texto, updated_at").in("semana", [lunes, sumarDias(lunes, -7)]) : Promise.resolve({ data: [] }),
  ]);

  const items: ItemSemana[] = [];
  const eventos = (eventosR.data ?? []) as Evento[];
  for (const e of eventos.filter((e) => e.fecha)) {
    items.push({ clave: `e${e.id}`, fecha: e.fecha!, etiqueta: e.origen, texto: `${e.hora ? `${e.hora} · ` : ""}${e.titulo}`, detalle: e.lugar ?? undefined, clase: claseComision(e.origen) });
  }
  for (const r of reus.data ?? []) items.push({ clave: `r${r.id}`, fecha: r.fecha, etiqueta: "AA · Reunión", texto: `${r.hora} · Reunión de comisión`, clase: "com-aa", href: `/reuniones/${r.id}` });
  for (const a of acts.data ?? []) items.push({ clave: `a${a.id}`, fecha: a.fecha, etiqueta: "AA · Actividad", texto: `${a.hora ? `${a.hora} · ` : ""}${a.nombre}`, clase: "com-aa", href: `/actividades/${a.id}` });
  for (const t of tareas.data ?? []) {
    items.push({
      clave: `t${t.id}`, fecha: t.vence, etiqueta: `AA · ${t.canal ? CANAL[t.canal] : "Tarea"}`,
      texto: t.titulo, detalle: t.vence < hoy ? "Vencida" : undefined, clase: "com-aa",
      href: t.actividad_id ? `/actividades/${t.actividad_id}` : t.proyecto_id ? `/proyectos/${t.proyecto_id}` : undefined,
    });
  }
  // Otras comisiones (DDO): solo coordinación. Si hay dos semanas cargadas, se usa la más nueva de cada comisión.
  const comisiones = new Set<string>();
  const vistas = new Set<string>();
  for (const d of ((ddoR.data ?? []) as { comision: string; texto: string; updated_at: string }[]).sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))) {
    if (d.comision === "Actividades Académicas" || vistas.has(d.comision)) continue;
    vistas.add(d.comision);
    const leido = leerDdo(d.texto, d.updated_at.slice(0, 10), d.comision);
    for (const dia of leido.dias) {
      if (dia.fecha < lunes || dia.fecha > domingo) continue;
      dia.items.forEach((it, k) => {
        const esComu = it.comu || /^comu/i.test(d.comision);
        comisiones.add(esComu ? "Comunicación" : d.comision);
        items.push({ clave: `d${d.comision}${dia.fecha}${k}`, fecha: dia.fecha, etiqueta: esComu ? `Comunicación · ${d.comision}` : d.comision, texto: it.texto, clase: esComu ? "com-comu" : claseComision(d.comision) });
      });
    }
  }
  const aConfirmar = eventos.filter((e) => !e.fecha);
  const leyenda = ["AA", ...new Set(eventos.filter((e) => e.fecha).map((e) => e.origen)), ...comisiones];

  return (
    <>
      <div className="encabezado">
        <div>
          <p className="suave">AA, {yo.esCoord ? "las otras comisiones (DDO) " : ""}y las fechas de la agrupación</p>
          <h1>Semana de la agrupación</h1>
        </div>
        <div className="acciones">
          <nav className="segmentado" aria-label="Qué calendario ver">
            <Link href="/calendario">Mío</Link>
            <Link href="/calendario?vista=general">General</Link>
            <Link href="/calendario?vista=semana" aria-current="page">Semana de la agrupación</Link>
          </nav>
          <Link href={`/calendario?vista=semana&semana=${sumarDias(lunes, -7)}`} className="boton chico" aria-label="Semana anterior">‹</Link>
          <span className="chip contorno">{fechaCorta(lunes)} al {fechaCorta(domingo)}</span>
          {lunes !== lunesDe(hoy) && <Link href="/calendario?vista=semana" className="boton chico">Esta semana</Link>}
          <Link href={`/calendario?vista=semana&semana=${sumarDias(lunes, 7)}`} className="boton chico" aria-label="Semana siguiente">›</Link>
        </div>
      </div>

      <ul className="leyenda-comisiones" aria-label="Colores por comisión" style={{ margin: 0, padding: 0 }}>
        {[...new Set(leyenda)].map((c) => (
          <li key={c} className={`semana-item ${c === "AA" ? "com-aa" : c === "Comunicación" ? "com-comu" : claseComision(c)}`}>
            <div><span className="semana-etiqueta">{c}</span></div>
          </li>
        ))}
        {yo.esCoord && !comisiones.size && <li className="suave chico" style={{ alignSelf: "center" }}>Sin DDO de otras comisiones esta semana (se cargan en <Link href="/ddo">DDO</Link>).</li>}
      </ul>

      <Semana lunes={lunes} hoy={hoy} items={items} />

      <div className="grilla">
        <section className="tarjeta" aria-labelledby="conf-t">
          <h2 id="conf-t">Fechas a confirmar</h2>
          {aConfirmar.length ? (
            <ul className="lista">
              {aConfirmar.map((e) => (
                <li key={e.id} style={{ flexDirection: "column", alignItems: "stretch" }}>
                  <span className="cuerpo">
                    <strong>{e.titulo} <span className="suave chico">· {e.origen}</span></strong>
                    {e.nota && <span className="suave chico">{e.nota}</span>}
                  </span>
                  {(yo.esCoord || e.created_by === yo.id) && (
                    <details>
                      <summary className="chico">Cargar la fecha</summary>
                      <form action={guardarEvento} className="formulario" style={{ paddingTop: 6, gap: 8 }}>
                        <input type="hidden" name="id" value={e.id} />
                        <input type="hidden" name="titulo" value={e.titulo} />
                        <input type="hidden" name="origen" value={e.origen} />
                        <div className="fila-campos">
                          <div className="campo"><label htmlFor={`f-${e.id}`}>Fecha</label><input id={`f-${e.id}`} name="fecha" type="date" /></div>
                          <div className="campo"><label htmlFor={`h-${e.id}`}>Hora</label><input id={`h-${e.id}`} name="hora" type="text" placeholder="18:30" /></div>
                          <div className="campo"><label htmlFor={`l-${e.id}`}>Lugar</label><input id={`l-${e.id}`} name="lugar" type="text" /></div>
                        </div>
                        <input type="hidden" name="nota" value={e.nota ?? ""} />
                        <Enviar className="boton primario chico">Guardar</Enviar>
                      </form>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="suave chico">Nada pendiente de fecha.</p>
          )}
        </section>

        <section className="tarjeta" aria-labelledby="nue-t">
          <h2 id="nue-t">Cargar una fecha de la agrupación</h2>
          <form action={guardarEvento} className="formulario">
            <div className="campo"><label htmlFor="ev-t">Qué es</label><input id="ev-t" name="titulo" type="text" placeholder="Congreso de la JUP, marcha, plenario…" required /></div>
            <div className="fila-campos">
              <div className="campo"><label htmlFor="ev-f">Fecha (vacía = a confirmar)</label><input id="ev-f" name="fecha" type="date" /></div>
              <div className="campo"><label htmlFor="ev-h">Hora</label><input id="ev-h" name="hora" type="text" placeholder="20:15" /></div>
            </div>
            <div className="fila-campos">
              <div className="campo"><label htmlFor="ev-l">Lugar</label><input id="ev-l" name="lugar" type="text" /></div>
              <div className="campo">
                <label htmlFor="ev-o">De quién es</label>
                <input id="ev-o" name="origen" type="text" list="origenes" defaultValue="Agrupación" />
                <datalist id="origenes">
                  {["Agrupación", "JUP", "Nexo", "Coyuntura", "Columna", "Sumables", "Tradu", "CGT", "Comunicación"].map((o) => <option key={o} value={o} />)}
                </datalist>
              </div>
            </div>
            <div className="campo"><label htmlFor="ev-n">Nota</label><input id="ev-n" name="nota" type="text" placeholder="Ej.: falta confirmar el lugar" /></div>
            <Enviar className="boton primario chico">Cargar</Enviar>
          </form>
          {eventos.filter((e) => e.fecha && (yo.esCoord || e.created_by === yo.id)).length > 0 && (
            <details>
              <summary className="chico">Borrar una fecha de esta semana</summary>
              <ul className="lista" style={{ paddingTop: 6 }}>
                {eventos.filter((e) => e.fecha && (yo.esCoord || e.created_by === yo.id)).map((e) => (
                  <li key={e.id}>
                    <span className="cuerpo">{e.titulo} · {fechaCorta(e.fecha)}</span>
                    <form action={borrarEvento} className="en-linea">
                      <input type="hidden" name="id" value={e.id} />
                      <Confirmar mensaje={`¿Borrar "${e.titulo}"?`} className="boton texto chico">Borrar</Confirmar>
                    </form>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      </div>
    </>
  );
}
