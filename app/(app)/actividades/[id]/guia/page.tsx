import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirMiembro } from "@/lib/sesion";
import { TIPO_ACTIVIDAD } from "@/lib/etiquetas";
import { fechaLarga } from "@/lib/fechas";

/** La guía del día en letra grande, para abrir en el celular. */
export default async function Guia({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requerirMiembro();
  const [{ data: a }, { data: links }] = await Promise.all([
    supabase.from("actividades").select("id, nombre, tipo, fecha, hora, lugar, guia").eq("id", id).maybeSingle(),
    supabase.from("documentos").select("titulo, url, tipo").eq("actividad_id", id).in("tipo", ["grupo", "zoom"]),
  ]);
  if (!a) notFound();

  return (
    <div className="guia-movil formulario">
      <nav className="migas" aria-label="Ruta"><Link href={`/actividades/${id}`}>← {a.nombre}</Link></nav>
      <div>
        <p className="suave">{TIPO_ACTIVIDAD[a.tipo] ?? "Actividad"}</p>
        <h1>{a.nombre}</h1>
      </div>
      <dl className="datos" style={{ fontSize: 16 }}>
        {a.fecha && <><dt>Cuándo</dt><dd>{fechaLarga(a.fecha)}{a.hora ? ` · ${a.hora}` : ""}</dd></>}
        {a.lugar && <><dt>Dónde</dt><dd>{a.lugar}</dd></>}
      </dl>
      {(links ?? []).length > 0 && (
        <div className="acciones">
          {(links ?? []).map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="boton">{l.tipo === "grupo" ? "Grupo de WhatsApp" : "Entrar al Zoom"}</a>
          ))}
        </div>
      )}
      <section className="tarjeta">
        {a.guia ? <p className="guia-texto">{a.guia}</p> : <p className="suave">Todavía no hay guía para esta actividad.</p>}
      </section>
    </div>
  );
}
