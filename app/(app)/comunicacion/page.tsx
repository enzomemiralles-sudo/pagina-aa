import Link from "next/link";
import { requerirMiembro } from "@/lib/sesion";
import { personasActivas } from "@/lib/datos";
import { CANAL, ESTADO_TAREA } from "@/lib/etiquetas";
import { fechaCorta, hoyBA, lunesDe, sumarDias } from "@/lib/fechas";
import { leerDdo } from "@/lib/ddo";
import { Semana, type ItemSemana } from "@/components/Semana";
import { Enviar } from "@/components/Cliente";
import { armarPlanComunicacion, cambiarEstadoTarea, reasignarTarea, cambiarVenceTarea } from "../acciones";

type Pieza = { id: string; titulo: string; canal: string; vence: string | null; estado: string; responsable_id: string | null; actividad_id: string | null; actividades: { nombre: string; fecha: string | null } | null };

export default async function Comunicacion({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const sp = await searchParams;
  const { supabase, yo } = await requerirMiembro();
  const hoy = hoyBA();
  const lunes = sp.semana && /^\d{4}-\d{2}-\d{2}$/.test(sp.semana) ? lunesDe(sp.semana) : lunesDe(hoy);
  const domingo = sumarDias(lunes, 6);

  const [piezasR, personas, actsR, ddoR] = await Promise.all([
    supabase.from("tareas").select("id, titulo, canal, vence, estado, responsable_id, actividad_id, actividades(nombre, fecha)").not("canal", "is", null).neq("estado", "cancelada").or(`vence.is.null,and(vence.gte.${lunes},vence.lte.${domingo})`).order("vence"),
    personasActivas(supabase),
    supabase.from("actividades").select("id, nombre, fecha").gte("fecha", hoy).lte("fecha", sumarDias(hoy, 45)).neq("estado", "cancelada").order("fecha"),
    yo.esCoord ? supabase.from("ddo").select("comision, texto, updated_at").eq("semana", lunes) : Promise.resolve({ data: [] }),
  ]);
  const piezas = ((piezasR.data ?? []) as unknown as Pieza[]).filter((p) => p.canal);
  const conFecha = piezas.filter((p) => p.vence);
  const sinFecha = piezas.filter((p) => !p.vence);
  const nombre = (id: string | null) => personas.find((p) => p.id === id)?.nombre.split(" ")[0];

  const items: ItemSemana[] = conFecha.map((p) => {
    const vencida = p.estado !== "hecha" && p.vence! < hoy;
    const quien = nombre(p.responsable_id);
    return {
      clave: p.id,
      fecha: p.vence!,
      etiqueta: `${CANAL[p.canal] ?? p.canal}${p.estado === "hecha" ? " · subido" : ""}`,
      texto: `${p.titulo}${p.actividades ? ` · ${p.actividades.nombre}` : ""}`,
      detalle: quien ? quien : "Falta quién",
      clase: p.estado === "hecha" ? "verde" : vencida ? "rojo" : !quien ? "ambar" : p.vence === hoy ? "ambar" : "azul",
      href: p.actividad_id ? `/actividades/${p.actividad_id}` : undefined,
    };
  });
  // Lo de Comunicación que viene en los DDO (solo coordinación).
  for (const d of (ddoR.data ?? []) as { comision: string; texto: string; updated_at: string }[]) {
    const l = leerDdo(d.texto, d.updated_at.slice(0, 10), d.comision);
    const todo = /^comu/i.test(d.comision);
    for (const dia of l.dias) for (const [k, it] of dia.items.entries()) {
      if ((it.comu || todo) && dia.fecha >= lunes && dia.fecha <= domingo) {
        items.push({ clave: `d${d.comision}${dia.fecha}${k}`, fecha: dia.fecha, etiqueta: `Nexo · DDO ${d.comision}`, texto: it.texto, clase: "gris" });
      }
    }
  }

  const ids = (actsR.data ?? []).map((a) => a.id);
  const { data: conPlan } = ids.length ? await supabase.from("tareas").select("actividad_id").in("actividad_id", ids).not("canal", "is", null) : { data: [] };
  const planeadas = new Set((conPlan ?? []).map((t) => t.actividad_id));
  const sinPlan = (actsR.data ?? []).filter((a) => !planeadas.has(a.id));
  const faltaQuien = conFecha.filter((p) => !p.responsable_id && p.estado !== "hecha").length;

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Comunicación</h1>
          <p className="suave">Qué se sube, cuándo y quién lo hace: carga al Form, posteos, historias y reels de cada actividad.</p>
        </div>
        <div className="acciones">
          <Link href={`/comunicacion?semana=${sumarDias(lunes, -7)}`} className="boton chico" aria-label="Semana anterior">‹</Link>
          <span className="chip contorno">{fechaCorta(lunes)} al {fechaCorta(domingo)}</span>
          {lunes !== lunesDe(hoy) && <Link href="/comunicacion" className="boton chico">Esta semana</Link>}
          <Link href={`/comunicacion?semana=${sumarDias(lunes, 7)}`} className="boton chico" aria-label="Semana siguiente">›</Link>
        </div>
      </div>

      <div className="acciones chico suave leyenda">
        <span><span className="chip azul">Azul</span> con responsable</span>
        <span><span className="chip ambar">Ámbar</span> falta quién o es hoy</span>
        <span><span className="chip rojo">Rojo</span> se pasó la fecha</span>
        <span><span className="chip verde">Verde</span> subido</span>
        {faltaQuien > 0 && <span className="texto-ambar">{faltaQuien} {faltaQuien === 1 ? "pieza sin responsable" : "piezas sin responsable"} esta semana</span>}
      </div>

      <Semana lunes={lunes} hoy={hoy} items={items} />

      {conFecha.length > 0 && (
        <section className="tarjeta sin-relleno" aria-labelledby="quien-t">
          <div className="tarjeta-cabecera"><h2 id="quien-t">Quién sube cada cosa esta semana</h2></div>
          <div className="tabla-caja">
            <table className="tabla">
              <thead><tr><th>Pieza</th><th>Actividad</th><th>Día</th><th>Quién</th><th>Estado</th></tr></thead>
              <tbody>
                {conFecha.map((p) => (
                  <tr key={p.id}>
                    <td><span className="chip contorno">{CANAL[p.canal]}</span> <span className="nombre">{p.titulo}</span></td>
                    <td>{p.actividad_id ? <Link href={`/actividades/${p.actividad_id}`}>{p.actividades?.nombre}</Link> : "—"}</td>
                    <td>
                      <form action={cambiarVenceTarea} style={{ display: "flex", gap: 4 }}>
                        <input type="hidden" name="id" value={p.id} />
                        <label className="oculto" htmlFor={`v-${p.id}`}>Día</label>
                        <input id={`v-${p.id}`} name="vence" type="date" defaultValue={p.vence ?? ""} style={{ minHeight: 34, width: "auto" }} />
                        <Enviar className="boton chico" pendiente="…">Ok</Enviar>
                      </form>
                    </td>
                    <td>
                      <form action={reasignarTarea} style={{ display: "flex", gap: 4 }}>
                        <input type="hidden" name="id" value={p.id} />
                        <label className="oculto" htmlFor={`q-${p.id}`}>Quién</label>
                        <select id={`q-${p.id}`} name="responsable_id" defaultValue={p.responsable_id ?? ""} style={{ minHeight: 34, width: "auto" }}>
                          <option value="">Falta quién</option>
                          {personas.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                        </select>
                        <Enviar className="boton chico" pendiente="…">Ok</Enviar>
                      </form>
                    </td>
                    <td>
                      <form action={cambiarEstadoTarea} className="en-linea">
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="estado" value={p.estado === "hecha" ? "pendiente" : "hecha"} />
                        <Enviar className={`boton chico${p.estado === "hecha" ? " verde" : ""}`} pendiente="…">{p.estado === "hecha" ? "Subido" : ESTADO_TAREA[p.estado]?.texto ?? p.estado}</Enviar>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="vacio" style={{ paddingTop: 8 }}>Tocá el estado para marcarlo como subido. Cada pieza también le aparece como tarea a quien la tiene.</p>
        </section>
      )}

      <div className="grilla">
        <section className="tarjeta" aria-labelledby="sp-t">
          <h2 id="sp-t">Actividades sin plan de comunicación</h2>
          {sinPlan.length ? (
            <ul className="lista">
              {sinPlan.map((a) => (
                <li key={a.id}>
                  <span className="cuerpo"><Link href={`/actividades/${a.id}`} style={{ fontWeight: 700 }}>{a.nombre}</Link><span className="suave chico">{fechaCorta(a.fecha)}</span></span>
                  <form action={armarPlanComunicacion} className="en-linea">
                    <input type="hidden" name="id" value={a.id} />
                    <Enviar className="boton chico" pendiente="…">Armar plan</Enviar>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="suave chico">Todas las actividades de las próximas semanas tienen plan.</p>
          )}
          <p className="suave chico">El plan: cargar al Form (12 días antes), posteo (10), historias (8, 5 y 2), reel si va (7) e historia el día. Las fechas se mueven acá o en el calendario.</p>
        </section>
        {sinFecha.length > 0 && (
          <section className="tarjeta" aria-labelledby="sf-t">
            <h2 id="sf-t">Sin fecha</h2>
            <ul className="lista">
              {sinFecha.map((p) => (
                <li key={p.id}><span className="cuerpo"><span><span className="chip contorno">{CANAL[p.canal]}</span> {p.titulo}</span><span className="suave chico">{p.actividades?.nombre ?? ""}</span></span></li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
