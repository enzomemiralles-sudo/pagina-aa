import Link from "next/link";
import { requerirCoord } from "@/lib/sesion";
import { leerDdo, horaDdo, type DdoLeido } from "@/lib/ddo";
import { fechaCorta, fechaDdo, haceCuanto, hoyBA, lunesDe, sumarDias } from "@/lib/fechas";
import { Confirmar, Enviar } from "@/components/Cliente";
import { DdoAA } from "@/components/DdoAA";
import { borrarDdo, cargarDdos } from "../acciones";

type Fila = { id: string; comision: string; semana: string; texto: string; created_at: string; updated_at: string };
const AA = "Actividades Académicas";

export default async function Ddo({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requerirCoord();
  const hoy = hoyBA();
  const estaSemana = lunesDe(hoy);
  const semana = sp.semana && /^\d{4}-\d{2}-\d{2}$/.test(sp.semana) ? lunesDe(sp.semana) : estaSemana;
  const domingo = sumarDias(semana, 6);
  const esEsta = semana === estaSemana;

  const { data } = await supabase.from("ddo").select("id, comision, semana, texto, created_at, updated_at").eq("semana", semana).order("comision");
  const filas = (data ?? []) as Fila[];
  const leidos: (DdoLeido & { fila: Fila })[] = filas.map((f) => ({ ...leerDdo(f.texto, f.updated_at.slice(0, 10), f.comision), fila: f }));
  const otras = leidos.filter((l) => l.comision !== AA);
  const esComu = (c: string) => /^comu/i.test(c);

  // Por día, todas las comisiones juntas.
  type Linea = { comision: string; texto: string; comu: boolean };
  const porDia = new Map<string, Linea[]>();
  const avisos: { comision: string; texto: string }[] = [];
  for (const l of otras) {
    for (const d of l.dias) {
      if (d.aviso) avisos.push({ comision: l.comision, texto: d.aviso });
      const lista = porDia.get(d.fecha) ?? [];
      for (const i of d.items) lista.push({ comision: l.comision, texto: i.texto, comu: i.comu || esComu(l.comision) });
      porDia.set(d.fecha, lista);
    }
  }
  const fechas = [...porDia.keys()].filter((f) => porDia.get(f)!.length).sort();
  const comu = fechas.flatMap((f) => porDia.get(f)!.filter((i) => i.comu).map((i) => ({ ...i, fecha: f })));
  const sinFechaComu = otras.flatMap((l) => l.otras.flatMap((o) => o.items.filter((i) => i.comu || esComu(l.comision)).map((i) => ({ comision: l.comision, texto: i.texto, titulo: o.titulo }))));

  // DDO de AA: sale de lo cargado en la página (desde hoy hasta el domingo).
  let diasAA: { fecha: string; items: string[] }[] = [];
  let objetivosAA: string[] = [];
  if (esEsta) {
    const [tareas, acts, reus] = await Promise.all([
      supabase.from("tareas").select("titulo, vence").gte("vence", hoy).lte("vence", domingo).not("estado", "in", "(hecha,cancelada)").order("vence"),
      supabase.from("actividades").select("nombre, fecha, hora").gte("fecha", hoy).lte("fecha", domingo).neq("estado", "cancelada"),
      supabase.from("reuniones").select("fecha, hora").gte("fecha", hoy).lte("fecha", domingo),
    ]);
    const mapa = new Map<string, string[]>();
    const sumar = (f: string, t: string) => mapa.set(f, [...(mapa.get(f) ?? []), t]);
    for (const r of reus.data ?? []) sumar(r.fecha, `Reunión de AA - ${horaDdo(r.hora)}`);
    for (const a of acts.data ?? []) sumar(a.fecha, `${a.nombre}${a.hora ? ` - ${horaDdo(a.hora)}` : ""}`);
    for (const t of tareas.data ?? []) sumar(t.vence, t.titulo);
    diasAA = [...mapa.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([fecha, items]) => ({ fecha, items }));
    objetivosAA = leidos.find((l) => l.comision === AA)?.objetivos ?? [];
  }

  return (
    <>
      <div className="encabezado">
        <div>
          <p className="suave">Solo coordinación</p>
          <h1>DDO de las comisiones</h1>
          <p className="suave">En qué anda cada comisión y Comunicación. Se pegan tal como llegan por WhatsApp.</p>
        </div>
        <div className="acciones">
          <Link href={`/ddo?semana=${sumarDias(semana, -7)}`} className="boton chico" aria-label="Semana anterior">‹</Link>
          <span className="chip contorno">Semana del {fechaCorta(semana)} al {fechaCorta(domingo)}</span>
          {!esEsta && <Link href="/ddo" className="boton chico">Esta semana</Link>}
          <Link href={`/ddo?semana=${sumarDias(semana, 7)}`} className="boton chico" aria-label="Semana siguiente">›</Link>
        </div>
      </div>

      {esEsta && (
        <section className="tarjeta" aria-labelledby="cargar-t">
          <details open={filas.length === 0}>
            <summary id="cargar-t">Cargar DDO</summary>
            <form action={cargarDdos} className="formulario" style={{ paddingTop: 8 }}>
              <div className="campo">
                <label htmlFor="texto-ddo">Pegá uno o varios DDO, todos juntos</label>
                <textarea id="texto-ddo" name="texto" rows={10} placeholder={"DDO Coyuntura:\nMartes 10/11:\n- Mandar a corregir boletín\n…\nDDO COLUMNA ⛓️\nObjetivos semanales:\n- …"} required />
                <span className="ayuda">Cada uno empieza con una línea “DDO …”. Si una comisión ya tenía DDO esta semana, se reemplaza por el nuevo.</span>
              </div>
              <Enviar>Cargar</Enviar>
            </form>
          </details>
        </section>
      )}

      {avisos.length > 0 && (
        <div className="aviso ambar" role="status">
          <div>
            <strong>Fechas que no coinciden con el día</strong> (conviene avisarle a la comisión)
            <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
              {avisos.map((a, i) => <li key={i}><strong>{a.comision}:</strong> {a.texto}</li>)}
            </ul>
          </div>
        </div>
      )}

      {otras.length > 0 ? (
        <div className="columnas">
          <section className="col-principal tarjeta" aria-labelledby="dias-t">
            <h2 id="dias-t">Día por día</h2>
            {fechas.map((f) => (
              <div key={f} className="formulario" style={{ gap: 6 }}>
                <h3 className={f === hoy ? "texto-ambar" : undefined}>{fechaDdo(f)}{f === hoy ? " · hoy" : ""}</h3>
                <ul className="conteos" style={{ gap: 6 }}>
                  {porDia.get(f)!.map((i, k) => (
                    <li key={k} style={{ alignItems: "flex-start" }}>
                      <span className={`chip ${i.comu ? "azul" : "contorno"}`} style={{ minWidth: 92, justifyContent: "center" }}>{i.comu ? "Comunicación" : i.comision}</span>
                      <span>{i.texto}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>

          <div className="col-lateral">
            <section className="tarjeta" aria-labelledby="comu-t">
              <h2 id="comu-t">Comunicación</h2>
              {comu.length || sinFechaComu.length ? (
                <ul className="lista">
                  {comu.map((c, k) => (
                    <li key={k} style={{ alignItems: "flex-start" }}>
                      <span className="chico" style={{ fontWeight: 700, minWidth: 64 }}>{fechaCorta(c.fecha)}</span>
                      <span className="cuerpo"><span>{c.texto}</span><span className="suave chico">desde {c.comision}</span></span>
                    </li>
                  ))}
                  {sinFechaComu.map((c, k) => (
                    <li key={`s${k}`} style={{ alignItems: "flex-start" }}>
                      <span className="chico" style={{ fontWeight: 700, minWidth: 64 }}>Sin fecha</span>
                      <span className="cuerpo"><span>{c.texto}</span><span className="suave chico">{c.titulo} · {c.comision}</span></span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="suave chico">Ningún DDO trae cosas de Comunicación esta semana (las líneas debajo de “COMU:”).</p>
              )}
            </section>

            <section className="tarjeta" aria-labelledby="obj-t">
              <h2 id="obj-t">Objetivos de la semana</h2>
              {otras.filter((l) => l.objetivos.length).map((l) => (
                <div key={l.comision}>
                  <h3 style={{ marginBottom: 4 }}>{l.comision}</h3>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>
                    {l.objetivos.map((o, k) => <li key={k}>{o}</li>)}
                  </ul>
                </div>
              ))}
              {!otras.some((l) => l.objetivos.length) && <p className="suave chico">Nadie cargó objetivos.</p>}
            </section>

            {otras.some((l) => l.otras.length) && (
              <section className="tarjeta" aria-labelledby="otr-t">
                <h2 id="otr-t">Sin fecha</h2>
                {otras.flatMap((l) => l.otras.map((o, k) => (
                  <div key={`${l.comision}${k}`}>
                    <h3 style={{ marginBottom: 4 }}>{o.titulo} <span className="suave chico">· {l.comision}</span></h3>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>
                      {o.items.map((i, j) => <li key={j}>{i.texto}</li>)}
                    </ul>
                  </div>
                )))}
              </section>
            )}

            <section className="tarjeta" aria-labelledby="carg-t">
              <h2 id="carg-t">Cargados</h2>
              <ul className="lista">
                {filas.map((f) => (
                  <li key={f.id}>
                    <span className="cuerpo">
                      <strong>{f.comision}</strong>
                      <span className="suave chico">{haceCuanto(f.updated_at)}</span>
                    </span>
                    <details>
                      <summary className="chico">Texto</summary>
                      <p className="texto-largo chico mensaje" style={{ marginTop: 6 }}>{f.texto}</p>
                    </details>
                    <form action={borrarDdo} className="en-linea">
                      <input type="hidden" name="id" value={f.id} />
                      <Confirmar mensaje={`¿Borrar el DDO de ${f.comision}?`} className="boton texto chico">Borrar</Confirmar>
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      ) : (
        <p className="tarjeta suave">{esEsta ? "Todavía no hay DDO de otras comisiones esta semana." : "No hay DDO cargados esa semana."}</p>
      )}

      {esEsta && (
        <section className="tarjeta" aria-labelledby="aa-t">
          <h2 id="aa-t">DDO de AA</h2>
          <DdoAA dias={diasAA} objetivosIniciales={objetivosAA} />
        </section>
      )}
    </>
  );
}
