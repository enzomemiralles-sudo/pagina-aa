import Link from "next/link";
import { requerirMiembro } from "@/lib/sesion";
import { personasActivas, SELECT_TAREA, type Tarea } from "@/lib/datos";
import { ESTADO_ACTIVIDAD, ESTADO_REUNION, ESTADO_TAREA, TIPO_ACTIVIDAD } from "@/lib/etiquetas";
import { fechaCorta, fechaLarga, hoyBA, lunesDe, mesTitulo, sumarDias } from "@/lib/fechas";
import { leerDdo } from "@/lib/ddo";
import { Calendario, type ItemCal } from "@/components/Calendario";
import { AgregarTarea } from "@/components/AgregarTarea";
import { TablaTareas } from "@/components/TablaTareas";
import { Enviar } from "@/components/Cliente";
import { crearReunion } from "../acciones";

type Params = { vista?: string; mes?: string; dia?: string; otras?: string };

function mesValido(m?: string) {
  return m && /^\d{4}-\d{2}$/.test(m) ? m : null;
}
function mesSumar(ym: string, k: number) {
  const [y, m] = ym.split("-").map(Number);
  const t = y * 12 + (m - 1) + k;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

export default async function PaginaCalendario({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const { supabase, yo } = await requerirMiembro();
  const hoy = hoyBA();
  const vista = sp.vista === "general" ? "general" : "mio";
  const mes = mesValido(sp.mes) ?? hoy.slice(0, 7);
  const diaSel = sp.dia && /^\d{4}-\d{2}-\d{2}$/.test(sp.dia) ? sp.dia : null;
  const verOtras = yo.esCoord && vista === "general" && sp.otras !== "no";

  // Grilla de lunes a domingo que cubre el mes.
  const inicio = lunesDe(`${mes}-01`);
  const ultimo = sumarDias(`${mesSumar(mes, 1)}-01`, -1);
  const fin = sumarDias(lunesDe(ultimo), 6);
  const semanas: string[][] = [];
  for (let d = inicio; d <= fin; d = sumarDias(d, 7)) semanas.push(Array.from({ length: 7 }, (_, i) => sumarDias(d, i)));

  let qTareas = supabase.from("tareas").select(SELECT_TAREA).gte("vence", inicio).lte("vence", fin).neq("estado", "cancelada");
  if (vista === "mio") qTareas = qTareas.eq("responsable_id", yo.id);
  let qAct = supabase.from("actividades").select("id, nombre, tipo, estado, fecha, hora, responsable_id, created_by").gte("fecha", inicio).lte("fecha", fin).neq("estado", "cancelada");
  if (vista === "mio") qAct = qAct.eq("responsable_id", yo.id);

  const [tareasR, actR, reuR, personas, ddoR] = await Promise.all([
    qTareas,
    qAct,
    supabase.from("reuniones").select("id, fecha, hora, estado").gte("fecha", inicio).lte("fecha", fin),
    personasActivas(supabase),
    verOtras
      ? supabase.from("ddo").select("comision, texto, created_at, semana").gte("semana", sumarDias(inicio, -7)).lte("semana", fin)
      : Promise.resolve({ data: [] }),
  ]);

  const tareas = (tareasR.data ?? []) as unknown as Tarea[];
  const actividades = (actR.data ?? []) as { id: string; nombre: string; tipo: string; estado: string; fecha: string; hora: string | null; responsable_id: string | null; created_by: string | null }[];
  const reuniones = (reuR.data ?? []) as { id: string; fecha: string; hora: string; estado: string }[];

  const items: ItemCal[] = [];
  for (const r of reuniones) {
    items.push({ clave: `r${r.id}`, id: r.id, tipo: "reunion", fecha: r.fecha, titulo: `Reunión de AA ${r.hora}`, color: "reunion", estado: ESTADO_REUNION[r.estado]?.texto ?? r.estado, href: `/reuniones/${r.id}`, movible: yo.esCoord });
  }
  for (const a of actividades) {
    items.push({
      clave: `a${a.id}`, id: a.id, tipo: "actividad", fecha: a.fecha,
      titulo: `${a.hora ? a.hora + " " : ""}${a.nombre}`,
      color: ESTADO_ACTIVIDAD[a.estado]?.color ?? "gris", estado: ESTADO_ACTIVIDAD[a.estado]?.texto ?? a.estado,
      href: `/actividades/${a.id}`,
      movible: yo.esCoord || a.responsable_id === yo.id || a.created_by === yo.id,
    });
  }
  for (const t of tareas) {
    if (!t.vence) continue;
    const vencida = t.estado !== "hecha" && t.vence < hoy;
    const color = t.estado === "hecha" ? "verde" : t.estado === "trabada" || vencida ? "rojo" : t.vence === hoy ? "ambar" : t.estado === "en_curso" ? "azul" : "gris";
    const quien = vista === "general" ? personas.find((p) => p.id === t.responsable_id)?.nombre.split(" ")[0] : null;
    items.push({
      clave: `t${t.id}`, id: t.id, tipo: "tarea", fecha: t.vence,
      titulo: `${t.titulo}${quien ? ` · ${quien}` : ""}`,
      color, estado: vencida ? "Vencida" : ESTADO_TAREA[t.estado]?.texto ?? t.estado,
      movible: yo.esCoord || t.responsable_id === yo.id || t.created_by === yo.id,
    });
  }

  // Otras comisiones (DDO): solo coordinación, en el general.
  type Otra = { comision: string; texto: string; comu: boolean };
  const otrasPorDia = new Map<string, Otra[]>();
  for (const d of (ddoR.data ?? []) as { comision: string; texto: string; created_at: string }[]) {
    if (d.comision === "Actividades Académicas") continue;
    const leido = leerDdo(d.texto, d.created_at.slice(0, 10), d.comision);
    for (const dia of leido.dias) {
      if (dia.fecha < inicio || dia.fecha > fin) continue;
      for (const it of dia.items) {
        const l = otrasPorDia.get(dia.fecha) ?? [];
        l.push({ comision: d.comision, texto: it.texto, comu: it.comu });
        otrasPorDia.set(dia.fecha, l);
        items.push({ clave: `o${d.comision}${dia.fecha}${l.length}`, id: "", tipo: "otra", fecha: dia.fecha, titulo: `${d.comision}: ${it.texto}`, color: "otra", estado: d.comision, movible: false });
      }
    }
  }

  const base = new URLSearchParams({ vista, mes, ...(sp.otras === "no" ? { otras: "no" } : {}) }).toString();
  const enlace = (cambios: Record<string, string | null>) => {
    const q = new URLSearchParams(base);
    for (const [k, v] of Object.entries(cambios)) (v === null ? q.delete(k) : q.set(k, v));
    return `/calendario?${q.toString()}`;
  };

  const delDia = diaSel ? items.filter((i) => i.fecha === diaSel) : [];
  const tareasDia = diaSel ? tareas.filter((t) => t.vence === diaSel) : [];
  const diasConAlgo = semanas.flat().filter((d) => d.startsWith(mes) && items.some((i) => i.fecha === d && i.tipo !== "otra"));

  return (
    <>
      <div className="encabezado">
        <div>
          <p className="suave">{vista === "mio" ? "Tus vencimientos, tus actividades y las reuniones" : "Actividades, reuniones y tareas de toda la comisión"}</p>
          <h1>{mesTitulo(mes).charAt(0).toUpperCase() + mesTitulo(mes).slice(1)}</h1>
        </div>
        <div className="acciones">
          <nav className="segmentado" aria-label="Qué calendario ver">
            <Link href={enlace({ vista: "mio", dia: null })} aria-current={vista === "mio" ? "page" : undefined}>Mío</Link>
            <Link href={enlace({ vista: "general", dia: null })} aria-current={vista === "general" ? "page" : undefined}>General</Link>
          </nav>
          <Link href={enlace({ mes: mesSumar(mes, -1), dia: null })} className="boton chico" aria-label="Mes anterior">‹</Link>
          <Link href={enlace({ mes: hoy.slice(0, 7), dia: hoy })} className="boton chico">Hoy</Link>
          <Link href={enlace({ mes: mesSumar(mes, 1), dia: null })} className="boton chico" aria-label="Mes siguiente">›</Link>
        </div>
      </div>

      <div className="acciones chico suave leyenda">
        <span><span className="cal-item reunion muestra">Reunión</span></span>
        <span><span className="chip azul">Azul</span> en marcha</span>
        <span><span className="chip ambar">Ámbar</span> vence hoy</span>
        <span><span className="chip rojo">Rojo</span> vencida o trabada</span>
        <span><span className="chip verde">Verde</span> hecha</span>
        <span><span className="chip gris">Gris</span> sin empezar</span>
        {yo.esCoord && vista === "general" && (
          <Link href={enlace({ otras: verOtras ? "no" : null })} className="boton texto chico">
            {verOtras ? "Ocultar otras comisiones" : "Ver otras comisiones (DDO)"}
          </Link>
        )}
        <span className="ocultar-movil">Arrastrá una tarea o actividad para cambiarle el día. Tocá un día para ver todo y agregar.</span>
      </div>

      <Calendario semanas={semanas} mes={mes} hoy={hoy} items={items} diaSel={diaSel} base={base} />

      {/* En el celular: lista por día */}
      <section className="agenda tarjeta" aria-label="Agenda del mes">
        {diasConAlgo.length ? (
          <ul className="lista">
            {diasConAlgo.map((d) => (
              <li key={d} style={{ alignItems: "flex-start" }}>
                <Link href={enlace({ dia: d })} className={`agenda-fecha${d === hoy ? " hoy" : ""}`} scroll={false}>{fechaCorta(d)}</Link>
                <span className="cuerpo">
                  {items.filter((i) => i.fecha === d && i.tipo !== "otra").map((i) => (
                    <span key={i.clave}>
                      {i.href ? <Link href={i.href}>{i.titulo}</Link> : i.titulo}{" "}
                      <span className={`chip ${i.color === "reunion" || i.color === "otra" ? "gris" : i.color}`}>{i.estado}</span>
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="suave">Nada cargado este mes.</p>
        )}
      </section>

      {diaSel && (
        <section className="tarjeta destacada" aria-labelledby="dia-t" id="dia">
          <div className="encabezado" style={{ alignItems: "center" }}>
            <h2 id="dia-t">{fechaLarga(diaSel).charAt(0).toUpperCase() + fechaLarga(diaSel).slice(1)}</h2>
            <Link href={enlace({ dia: null })} className="boton texto chico" scroll={false}>Cerrar</Link>
          </div>

          {delDia.filter((i) => i.tipo === "reunion" || i.tipo === "actividad").length > 0 && (
            <ul className="lista">
              {delDia.filter((i) => i.tipo === "reunion" || i.tipo === "actividad").map((i) => (
                <li key={i.clave}>
                  <span className="cuerpo">
                    <Link href={i.href!} style={{ fontWeight: 700 }}>{i.titulo}</Link>
                    <span className="suave chico">{i.tipo === "reunion" ? "Reunión de comisión" : TIPO_ACTIVIDAD[actividades.find((a) => a.id === i.id)?.tipo ?? ""] ?? "Actividad"}</span>
                  </span>
                  <span className={`chip ${i.color === "reunion" ? "gris" : i.color}`}>{i.estado}</span>
                </li>
              ))}
            </ul>
          )}

          {tareasDia.length > 0 && (
            <div className="tarjeta sin-relleno">
              <TablaTareas tareas={tareasDia} personas={personas} mostrarResponsable={vista === "general"} puedeTildar={(t) => yo.esCoord || t.responsable_id === yo.id || t.created_by === yo.id} />
            </div>
          )}

          {otrasPorDia.get(diaSel)?.length ? (
            <div>
              <h3 style={{ marginBottom: 6 }}>Otras comisiones</h3>
              <ul className="conteos" style={{ gap: 6 }}>
                {otrasPorDia.get(diaSel)!.map((o, k) => (
                  <li key={k}><span className="chip contorno">{o.comu ? "Comunicación" : o.comision}</span> {o.texto}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {delDia.length === 0 && <p className="suave">No hay nada este día.</p>}

          <div className="formulario" style={{ borderTop: "1px solid var(--linea)", paddingTop: 14 }}>
            <AgregarTarea personas={personas} responsableInicial={yo.id} venceInicial={diaSel} sufijo="cal" />
            <div className="acciones">
              <Link href={`/actividades/nueva?fecha=${diaSel}`} className="boton chico">+ Actividad este día</Link>
              {yo.esCoord && !reuniones.some((r) => r.fecha === diaSel) && (
                <form action={crearReunion} className="en-linea">
                  <input type="hidden" name="fecha" value={diaSel} />
                  <Enviar className="boton chico" pendiente="…">+ Reunión este día</Enviar>
                </form>
              )}
            </div>
          </div>
        </section>
      )}

      <p className="suave chico">Las tareas sin fecha no aparecen acá: están en <Link href="/">Inicio</Link> y en cada proyecto o actividad.</p>
    </>
  );
}
