import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirCoord } from "@/lib/sesion";
import { claveResponsable, nombreDe, personasActivas, responsablesPosibles } from "@/lib/datos";
import { fechaLarga, sumarDias } from "@/lib/fechas";
import { armarBorrador, FIN, horarios, INICIO } from "@/lib/punteo";
import { Enviar } from "@/components/Cliente";
import { usarBorrador } from "../../../acciones";

/** Borrador del punteo armado con el criterio de la comisión. Se elige qué entra y se suma a la reunión. */
export default async function ArmarPunteo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requerirCoord();
  const { data: r } = await supabase.from("reuniones").select("id, fecha, hora, estado").eq("id", id).maybeSingle();
  if (!r) notFound();

  const [personas, anteriorR, proyR, actR, tarR, actuR, ideasR, evR, yaR] = await Promise.all([
    personasActivas(supabase),
    supabase.from("reuniones").select("id").lt("fecha", r.fecha).order("fecha", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("proyectos").select("id, nombre, estado").in("estado", ["propuesta", "aprobado", "en_marcha"]).order("nombre"),
    supabase.from("actividades").select("id, nombre, fecha, proyecto_id, estado").neq("estado", "cancelada").or(`fecha.is.null,and(fecha.gte.${sumarDias(r.fecha, -30)},fecha.lte.${sumarDias(r.fecha, 45)})`),
    supabase.from("tareas").select("titulo, estado, vence, responsable_id, responsable_nomina_id, proyecto_id, actividad_id, nota_trabada").not("estado", "in", "(hecha,cancelada)").is("canal", null),
    supabase.from("actualizaciones").select("integrante_id, necesito").eq("semana", r.fecha).not("necesito", "is", null),
    supabase.from("ideas").select("titulo").eq("estado", "nueva"),
    supabase.from("eventos").select("titulo, fecha, hora").gte("fecha", r.fecha).lte("fecha", sumarDias(r.fecha, 7)).order("fecha"),
    supabase.from("reunion_temas").select("titulo").eq("reunion_id", id),
  ]);
  const responsables = await responsablesPosibles(supabase, personas);
  const pendientesAnteriores = anteriorR.data
    ? ((await supabase.from("reunion_temas").select("titulo, proyecto_id, estado").eq("reunion_id", anteriorR.data.id)).data ?? []).filter((t) => t.estado !== "tratado")
    : [];

  const nombre = (k: string | null) => (k ? nombreDe(responsables, k).split(" ")[0] : null);
  const { temas, quedan } = armarBorrador({
    fechaReunion: r.fecha,
    responsable: personas.find((p) => p.rol === "responsable")?.nombre.split(" ")[0] ?? "la responsable",
    proyectos: (proyR.data ?? []) as { id: string; nombre: string; estado: string }[],
    actividades: (actR.data ?? []) as { id: string; nombre: string; fecha: string | null; proyecto_id: string | null; estado: string }[],
    tareas: ((tarR.data ?? []) as { titulo: string; estado: string; vence: string | null; responsable_id: string | null; responsable_nomina_id: string | null; proyecto_id: string | null; actividad_id: string | null; nota_trabada: string | null }[]).map((t) => ({
      ...t,
      quien: nombre(claveResponsable(t)),
    })),
    pendientesAnteriores: pendientesAnteriores.map((t) => ({ titulo: t.titulo, proyecto_id: t.proyecto_id })),
    pedidos: ((actuR.data ?? []) as { integrante_id: string; necesito: string }[]).map((a) => ({ quien: nombreDe(personas, a.integrante_id).split(" ")[0], texto: a.necesito })),
    ideas: (ideasR.data ?? []) as { titulo: string }[],
    eventos: (evR.data ?? []) as { titulo: string; fecha: string; hora: string | null }[],
  });
  const ya = new Set((yaR.data ?? []).map((t) => t.titulo.trim().toLowerCase()));
  const horas = horarios(temas.map((t) => t.minutos));
  const total = temas.reduce((s, t) => s + t.minutos, 0);
  const valor = (t: (typeof temas)[number]) => JSON.stringify({ titulo: t.titulo, origen: t.origen, puntos: t.puntos, minutos: t.minutos, proyectoId: t.proyectoId ?? null });

  return (
    <>
      <nav className="migas" aria-label="Ruta">
        <Link href="/reuniones">Reuniones</Link><span aria-hidden="true">›</span><Link href={`/reuniones/${id}`}>{fechaLarga(r.fecha)}</Link>
      </nav>
      <div className="encabezado">
        <div>
          <h1>Armar el punteo</h1>
          <p className="suave">
            Borrador con el criterio de la comisión: acta, operativas, lo que quedó de la anterior, el avance de cada proyecto por urgencia, pendientes y repaso de tareas. De {INICIO} a {FIN}: {total} de 65 minutos.
          </p>
        </div>
      </div>

      <form action={usarBorrador} className="formulario">
        <input type="hidden" name="reunion_id" value={id} />
        <input type="hidden" name="borrador" value={JSON.stringify([...temas, ...quedan].map((t) => ({ titulo: t.titulo, origen: t.origen, minutos: t.minutos, entra: t.entra })))} />

        <section className="tarjeta sin-relleno" aria-labelledby="bor-t">
          <div className="tarjeta-cabecera"><h2 id="bor-t">Borrador</h2><span className="suave chico">Destildá lo que no va</span></div>
          <ul className="lista" style={{ padding: "0 18px" }}>
            {temas.map((t, i) => {
              const repetido = ya.has(t.titulo.trim().toLowerCase());
              return (
                <li key={t.clave} style={{ alignItems: "flex-start" }}>
                  <label className="check" style={{ minHeight: 0, alignItems: "flex-start" }}>
                    <input type="checkbox" name="tema" value={valor(t)} defaultChecked={!repetido} />
                    <span className="oculto">Incluir {t.titulo}</span>
                  </label>
                  <span className="chico suave" style={{ minWidth: 44, fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{horas[i]}</span>
                  <span className="cuerpo">
                    <strong>{t.titulo}</strong>
                    {t.puntos.map((p, k) => <span key={k} className="chico">– {p}</span>)}
                    <span className="suave chico">{t.origen} · {t.minutos} min{repetido ? " · ya está en el punteo" : ""}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {quedan.length > 0 && (
          <section className="tarjeta" aria-labelledby="qd-t">
            <h2 id="qd-t">No entran en el tiempo: para la próxima</h2>
            <p className="suave chico">Si querés sumar alguno igual, tildalo (se agrega antes del repaso).</p>
            <ul className="lista">
              {quedan.map((t) => (
                <li key={t.clave} style={{ alignItems: "flex-start" }}>
                  <label className="check" style={{ minHeight: 0 }}>
                    <input type="checkbox" name="tema" value={valor(t)} />
                    <span className="oculto">Incluir {t.titulo}</span>
                  </label>
                  <span className="cuerpo">
                    <strong>{t.titulo}</strong>
                    {t.puntos.map((p, k) => <span key={k} className="chico">– {p}</span>)}
                    <span className="suave chico">{t.origen} · {t.minutos} min</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="tarjeta" aria-labelledby="op-t">
          <h2 id="op-t">Operativas que bajaron de arriba</h2>
          <label htmlFor="operativas" className="oculto">Operativas, una por línea</label>
          <textarea id="operativas" name="operativas" rows={3} placeholder={"Una por línea. Ej.: Sumar gente a la marcha del jueves"} />
          <span className="ayuda">Si cargás algo, va como tema después del acta.</span>
        </section>

        <div className="acciones">
          <Enviar>Usar este punteo</Enviar>
          <Link href={`/reuniones/${id}`} className="boton">Volver</Link>
        </div>
      </form>
    </>
  );
}
