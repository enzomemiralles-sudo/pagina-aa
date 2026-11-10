import Link from "next/link";
import { requerirMiembro } from "@/lib/sesion";
import { fechaCorta, fechaDia, hoyBA, sumarDias } from "@/lib/fechas";
import { completar, actividadEnFrase } from "@/lib/mensajes";
import { DIAS_GRILLA, opcionForm, textoGrilla } from "@/lib/contactos";
import { Copiar, Enviar } from "@/components/Cliente";
import { Repartir } from "@/components/Repartir";
import { guardarGrillaCompleta } from "../acciones";

type Vista = "mios" | "repartir" | "repartos" | "grilla";
type Nom = { id: string; nombre: string; integrante_id: string | null };

const FORMULA_PLANILLA =
  '=QUERY(IMPORTRANGE("https://docs.google.com/spreadsheets/d/1bG3LcX0Y5yB_T5yMEyCSTIYV7ulhVF3F90mCY-eJ7Aw";"Respuestas de forms!A:M");"select Col1, Col3, Col4, Col6, Col13 where Col13 is not null";1)';

export default async function Contactos({ searchParams }: { searchParams: Promise<{ vista?: string; actividad?: string }> }) {
  const sp = await searchParams;
  const vista: Vista = (["mios", "repartir", "repartos", "grilla"] as const).find((v) => v === sp.vista) ?? "mios";
  const { supabase, yo } = await requerirMiembro();
  const hoy = hoyBA();

  const [nominaR, grillaR] = await Promise.all([
    supabase.from("nomina").select("id, nombre, integrante_id").eq("activo", true).order("nombre"),
    supabase.from("grilla_mensajes").select("dia, nomina_id, suplente, orden").order("orden"),
  ]);
  const nomina = (nominaR.data ?? []) as Nom[];
  const mia = nomina.find((n) => n.integrante_id === yo.id);
  const grillaFilas = (grillaR.data ?? []) as { dia: number; nomina_id: string; suplente: boolean }[];
  const nombre = (id: string) => nomina.find((n) => n.id === id)?.nombre ?? "—";
  const grilla: Record<number, { titulares: { id: string; nombre: string }[]; suplentes: { id: string; nombre: string }[] }> = {};
  for (const [d] of DIAS_GRILLA) grilla[d] = { titulares: [], suplentes: [] };
  for (const g of grillaFilas) grilla[g.dia][g.suplente ? "suplentes" : "titulares"].push({ id: g.nomina_id, nombre: nombre(g.nomina_id) });
  const textoDeGrilla = textoGrilla(Object.fromEntries(Object.entries(grilla).map(([d, g]) => [d, { titulares: g.titulares.map((p) => p.nombre), suplentes: g.suplentes.map((p) => p.nombre) }])));

  const pestanas = (
    <nav className="pestanas" aria-label="Contactos">
      <Link href="/contactos" aria-current={vista === "mios" ? "page" : undefined}>Mis contactos</Link>
      <Link href="/contactos?vista=repartir" aria-current={vista === "repartir" ? "page" : undefined}>Repartir</Link>
      <Link href="/contactos?vista=repartos" aria-current={vista === "repartos" ? "page" : undefined}>Seguimiento</Link>
      <Link href="/contactos?vista=grilla" aria-current={vista === "grilla" ? "page" : undefined}>Grilla</Link>
    </nav>
  );
  const encabezado = (
    <div className="encabezado">
      <div>
        <h1>Contactos</h1>
        <p className="suave">Quién le escribe a cada inscripto, con qué mensaje, y si ya lo mandó.</p>
      </div>
    </div>
  );

  // ----- Mis contactos -----
  if (vista === "mios") {
    const { data } = mia
      ? await supabase.from("bloques").select("id, numero, cantidad, enviados, listo, repartos(titulo, fecha_contacto)").eq("nomina_id", mia.id)
      : { data: [] };
    type B = { id: string; numero: number; cantidad: number; enviados: number[]; listo: boolean; repartos: { titulo: string; fecha_contacto: string } | null };
    const bloques = ((data ?? []) as unknown as B[]).sort((a, b) => (a.listo === b.listo ? ((a.repartos?.fecha_contacto ?? "") < (b.repartos?.fecha_contacto ?? "") ? 1 : -1) : a.listo ? 1 : -1));
    const misDias = DIAS_GRILLA.filter(([d]) => grilla[d].titulares.some((p) => p.id === mia?.id) || grilla[d].suplentes.some((p) => p.id === mia?.id));
    return (
      <>
        {encabezado}
        {pestanas}
        {misDias.length > 0 && (
          <p className="aviso gris">Te toca contactar: <strong>{misDias.map(([d, n]) => `${n.toLowerCase()}${grilla[d].suplentes.some((p) => p.id === mia?.id) ? " (suplente)" : ""}`).join(", ")}</strong>.</p>
        )}
        <section className="tarjeta sin-relleno">
          {bloques.length ? (
            <ul className="lista" style={{ padding: "6px 18px" }}>
              {bloques.map((b) => (
                <li key={b.id}>
                  <span className="cuerpo">
                    <Link href={`/contactos/b/${b.id}`} style={{ fontWeight: 700 }}>{b.repartos?.titulo ?? "Actividad"}</Link>
                    <span className="suave chico">B{b.numero} · {b.cantidad} contactos · para el {fechaDia(b.repartos?.fecha_contacto)}</span>
                  </span>
                  {b.listo ? <span className="chip verde">Enviado</span> : b.enviados.length ? <span className="chip azul">{b.enviados.length} de {b.cantidad}</span> : <span className={`chip ${b.repartos && b.repartos.fecha_contacto < hoy ? "rojo" : b.repartos?.fecha_contacto === hoy ? "ambar" : "gris"}`}>Sin empezar</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="vacio">{mia ? "No tenés contactos asignados." : "Tu cuenta todavía no está en la lista de compañeros (Columna la vincula)."}</p>
          )}
        </section>
      </>
    );
  }

  // ----- Grilla -----
  if (vista === "grilla") {
    const dias = DIAS_GRILLA.slice(0, 5);
    const valor = (nid: string, d: number) => (grilla[d].titulares.some((p) => p.id === nid) ? "t" : grilla[d].suplentes.some((p) => p.id === nid) ? "s" : "");
    return (
      <>
        {encabezado}
        {pestanas}
        <div className="formulario" style={{ gap: 20 }}>
          <section className="tarjeta sin-relleno" aria-labelledby="gri-t">
            <div className="tarjeta-cabecera"><h2 id="gri-t">Quién contacta cada día</h2><span className="suave chico">Se fija en la reunión</span></div>
            {nomina.length ? (
              <form action={guardarGrillaCompleta}>
                <div className="tabla-caja">
                  <table className="tabla">
                    <thead><tr><th>Compañero</th>{dias.map(([d, n]) => <th key={d}>{n.slice(0, 3)}</th>)}</tr></thead>
                    <tbody>
                      {nomina.map((p) => (
                        <tr key={p.id}>
                          <td className="nombre">{p.nombre}</td>
                          {dias.map(([d, n]) => (
                            <td key={d} style={{ padding: "6px 8px" }}>
                              <label className="oculto" htmlFor={`c_${p.id}_${d}`}>{p.nombre} el {n.toLowerCase()}</label>
                              <select id={`c_${p.id}_${d}`} name={`c_${p.id}_${d}`} defaultValue={valor(p.id, d)} disabled={!yo.llevaAsistencia} style={{ minHeight: 34, width: "auto", padding: "4px 8px" }}>
                                <option value="">—</option>
                                <option value="t">Sí</option>
                                <option value="s">Suplente</option>
                              </select>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {yo.llevaAsistencia && <div className="tarjeta-pie"><Enviar className="boton primario chico">Guardar grilla</Enviar></div>}
              </form>
            ) : (
              <p className="vacio">Primero hay que cargar los nombres en Columna → Lista de compañeros.</p>
            )}
          </section>
          <section className="tarjeta" aria-labelledby="gt-t" style={{ maxWidth: 520 }}>
            <h2 id="gt-t">Para mandar al grupo</h2>
            <p className="texto-largo chico mensaje">{textoDeGrilla}</p>
            <Copiar texto={textoDeGrilla}>Copiar para WhatsApp</Copiar>
          </section>
        </div>
      </>
    );
  }

  // ----- Seguimiento (repartos) -----
  if (vista === "repartos") {
    const [{ data: reps }, { data: bls }] = await Promise.all([
      supabase.from("repartos").select("id, titulo, fecha_contacto, total, creado_por, purgado, integrantes(nombre)").order("fecha_contacto", { ascending: false }).limit(40),
      supabase.from("bloques").select("reparto_id, cantidad, enviados, listo"),
    ]);
    type R = { id: string; titulo: string; fecha_contacto: string; total: number; creado_por: string | null; purgado: boolean; integrantes: { nombre: string } | null };
    const lista = (reps ?? []) as unknown as R[];
    const bloques = (bls ?? []) as { reparto_id: string; cantidad: number; enviados: number[]; listo: boolean }[];
    return (
      <>
        {encabezado}
        {pestanas}
        <section className="tarjeta sin-relleno">
          {lista.length ? (
            <div className="tabla-caja">
              <table className="tabla">
                <thead><tr><th>Actividad</th><th>Contacto</th><th>Repartió</th><th>Avance</th></tr></thead>
                <tbody>
                  {lista.map((r) => {
                    const bs = bloques.filter((b) => b.reparto_id === r.id);
                    const listos = bs.filter((b) => b.listo).length;
                    const enviados = bs.reduce((s, b) => s + (b.listo ? b.cantidad : b.enviados.length), 0);
                    const atrasado = r.fecha_contacto < hoy && listos < bs.length;
                    return (
                      <tr key={r.id}>
                        <td><Link href={`/contactos/r/${r.id}`} className="nombre">{r.titulo}</Link></td>
                        <td className="nowrap">{fechaCorta(r.fecha_contacto)}</td>
                        <td>{r.integrantes?.nombre ?? "—"}</td>
                        <td>
                          {bs.length ? (
                            <span className={`chip ${listos === bs.length ? "verde" : atrasado ? "rojo" : enviados ? "azul" : "gris"}`}>
                              {listos === bs.length ? "Todo enviado" : `${enviados} de ${r.total} · ${listos}/${bs.length} bloques`}
                            </span>
                          ) : (
                            <span className="suave chico">{r.total} contactos</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="vacio">Todavía no se repartió nada. Se hace desde “Repartir”.</p>
          )}
        </section>
      </>
    );
  }

  // ----- Repartir -----
  const desde = sumarDias(hoy, -7);
  const [{ data: acts }, { data: msjs }] = await Promise.all([
    supabase.from("actividades").select("id, nombre, tipo, fecha, hora, lugar, opcion_form").neq("estado", "cancelada").or(`fecha.gte.${desde},fecha.is.null`).order("fecha", { nullsFirst: false }),
    supabase.from("mensajes_modelo").select("titulo, texto, para").in("para", ["charla", "visita", "general"]).order("orden"),
  ]);
  type A = { id: string; nombre: string; tipo: string; fecha: string | null; hora: string | null; lugar: string | null; opcion_form: string | null };
  const actividades = (acts ?? []) as A[];
  const ids = actividades.map((a) => a.id);
  const { data: docs } = ids.length ? await supabase.from("documentos").select("actividad_id, tipo, url").in("actividad_id", ids) : { data: [] };
  const link = (aid: string, tipo: string) => (docs ?? []).find((d) => d.actividad_id === aid && d.tipo === tipo)?.url ?? null;
  const mensajes = (msjs ?? []) as { titulo: string; texto: string; para: string }[];
  const paraRepartir = actividades.map((a) => {
    const datos = { actividad: actividadEnFrase(a.nombre), dia: fechaDia(a.fecha), hora: a.hora, lugar: a.lugar, zoom: link(a.id, "zoom"), grupo: link(a.id, "grupo"), encuesta: link(a.id, "encuesta"), inscripcion: link(a.id, "inscripcion") };
    const propios = mensajes.filter((m) => m.para === a.tipo || m.para === "general").filter((m) => !/encuesta|recordatorio|liber/i.test(m.titulo));
    return {
      id: a.id,
      nombre: a.nombre,
      titulo: a.opcion_form ?? opcionForm(a.fecha, a.hora, a.nombre),
      mensajes: propios.map((m) => ({ titulo: m.titulo, texto: completar(m.texto.replace(/\{(nombre|yo)\}/g, "\u0000$1\u0000"), datos).replace(/\u0000(nombre|yo)\u0000/g, "{$1}") })),
    };
  });

  return (
    <>
      {encabezado}
      {pestanas}
      <section className="tarjeta">
        <details>
          <summary>Cómo se hace (y la planilla para repartir)</summary>
          <ol className="pasos" style={{ paddingTop: 8 }}>
            <li>Abrí la planilla de inscriptos, seleccioná las últimas filas (con la fila de títulos si podés) y copiá. No hace falta encontrar la fila exacta: la página filtra por actividad y saca los repetidos.</li>
            <li>Elegí la actividad y el día de contacto: la página reparte entre quienes les toca ese día según la grilla, sin pasar de 30 por persona.</li>
            <li>Al repartir, a cada compañero le aparece la tarea con el mensaje y su lista, con un botón por contacto que abre WhatsApp con todo escrito. A vos te queda la tarea de seguimiento.</li>
            <li>A quien no tiene cuenta en la página, le mandás su bloque por WhatsApp desde el seguimiento (botón “Copiar para mandar”).</li>
          </ol>
          <p className="chico" style={{ marginTop: 10 }}>
            <strong>Recomendado:</strong> no compartas la planilla histórica (tiene DNI y otros datos). Armá una planilla nueva, pegá esta fórmula en A1 y compartí solo esa: trae marca temporal, nombre, apellido, WhatsApp y actividad.
          </p>
          <code className="formula">{FORMULA_PLANILLA}</code>
          <Copiar texto={FORMULA_PLANILLA} className="boton chico">Copiar fórmula</Copiar>
        </details>
      </section>
      <section className="tarjeta">
        <Repartir actividades={paraRepartir} grilla={grilla} nomina={nomina.map((n) => ({ id: n.id, nombre: n.nombre }))} hoy={hoy} actividadInicial={sp.actividad ?? null} />
      </section>
    </>
  );
}
