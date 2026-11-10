import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirMiembro } from "@/lib/sesion";
import { fechaDia, fechaLarga, hoyBA } from "@/lib/fechas";
import { completar } from "@/lib/mensajes";
import { listaWhatsapp, primerNombre, type Contacto } from "@/lib/contactos";
import { Confirmar, Copiar, Enviar } from "@/components/Cliente";
import { borrarReparto, marcarBloqueListo, reasignarBloque } from "../../../acciones";

/** Seguimiento de un reparto: quién tiene cada bloque y cuánto mandó. */
export default async function Reparto({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, yo } = await requerirMiembro();
  const [{ data: r }, { data: bls }, { data: nom }] = await Promise.all([
    supabase.from("repartos").select("id, titulo, fecha_contacto, mensaje, total, creado_por, purgado, actividad_id").eq("id", id).maybeSingle(),
    supabase.from("bloques").select("id, numero, cantidad, contactos, enviados, listo, nomina_id").eq("reparto_id", id).order("numero"),
    supabase.from("nomina").select("id, nombre, integrante_id").eq("activo", true).order("nombre"),
  ]);
  if (!r) notFound();
  const gestiona = yo.esCoord || r.creado_por === yo.id;
  const bloques = (bls ?? []) as { id: string; numero: number; cantidad: number; contactos: Contacto[]; enviados: number[]; listo: boolean; nomina_id: string | null }[];
  const nomina = (nom ?? []) as { id: string; nombre: string; integrante_id: string | null }[];
  const persona = (nid: string | null) => nomina.find((n) => n.id === nid);
  const listos = bloques.filter((b) => b.listo).length;
  const hoy = hoyBA();

  const paraMandar = (b: (typeof bloques)[number]) => {
    const p = persona(b.nomina_id);
    return [
      `B${b.numero} · ${r.titulo}`,
      `Contactar el ${fechaDia(r.fecha_contacto)}${p ? ` · ${p.nombre}` : ""}`,
      "",
      "Mensaje:",
      completar(r.mensaje, { yo: p ? primerNombre(p.nombre) : null }),
      "",
      "Contactos:",
      listaWhatsapp(b.contactos),
    ].join("\n");
  };

  return (
    <>
      <nav className="migas" aria-label="Ruta">
        <Link href="/contactos?vista=repartos">Contactos · Seguimiento</Link>
        {r.actividad_id && <><span aria-hidden="true">›</span><Link href={`/actividades/${r.actividad_id}`}>Actividad</Link></>}
      </nav>
      <div className="encabezado">
        <div>
          <p className="suave">Contacto el {fechaLarga(r.fecha_contacto)} · {r.total} inscriptos</p>
          <h1>{r.titulo}</h1>
          <div className="acciones">
            <span className={`chip ${listos === bloques.length && bloques.length ? "verde" : r.fecha_contacto < hoy ? "rojo" : "azul"}`}>
              {listos} de {bloques.length} bloques enviados
            </span>
            {r.purgado && <span className="chip gris">Teléfonos borrados</span>}
          </div>
        </div>
        {gestiona && (
          <form action={borrarReparto}>
            <input type="hidden" name="id" value={r.id} />
            <Confirmar mensaje="¿Borrar el reparto? Se borran también las tareas de cada compañero.">Borrar reparto</Confirmar>
          </form>
        )}
      </div>

      {!gestiona && <p className="aviso gris">El detalle de cada bloque lo ve quien repartió y coordinación.</p>}

      <section className="tarjeta sin-relleno">
        <div className="tabla-caja">
          <table className="tabla">
            <thead><tr><th>Bloque</th><th>Quién</th><th>Avance</th><th><span className="oculto">Acciones</span></th></tr></thead>
            <tbody>
              {bloques.map((b) => {
                const p = persona(b.nomina_id);
                const hechos = b.listo ? b.cantidad : b.enviados.length;
                return (
                  <tr key={b.id}>
                    <td className="nowrap"><Link href={`/contactos/b/${b.id}`} className="nombre">B{b.numero}</Link> <span className="suave chico">· {b.cantidad}</span></td>
                    <td>
                      {gestiona ? (
                        <form action={reasignarBloque} style={{ display: "flex", gap: 6 }}>
                          <input type="hidden" name="id" value={b.id} />
                          <label className="oculto" htmlFor={`q-${b.id}`}>Quién manda B{b.numero}</label>
                          <select id={`q-${b.id}`} name="nomina_id" defaultValue={b.nomina_id ?? ""} style={{ minHeight: 34, width: "auto" }}>
                            <option value="">Sin asignar</option>
                            {nomina.map((n) => <option key={n.id} value={n.id}>{n.nombre}</option>)}
                          </select>
                          <Enviar className="boton chico" pendiente="…">Cambiar</Enviar>
                        </form>
                      ) : (
                        p?.nombre ?? "Sin asignar"
                      )}
                      {p && !p.integrante_id && <span className="suave chico" style={{ display: "block" }}>sin cuenta: mandale el bloque por WhatsApp</span>}
                    </td>
                    <td>
                      <span className={`chip ${b.listo ? "verde" : hechos ? "azul" : r.fecha_contacto < hoy ? "rojo" : r.fecha_contacto === hoy ? "ambar" : "gris"}`}>
                        {b.listo ? "Enviado" : `${hechos} de ${b.cantidad}`}
                      </span>
                    </td>
                    <td>
                      {gestiona && (
                        <div className="acciones">
                          {!r.purgado && <Copiar texto={paraMandar(b)} className="boton chico">Copiar para mandar</Copiar>}
                          <form action={marcarBloqueListo} className="en-linea">
                            <input type="hidden" name="id" value={b.id} />
                            <input type="hidden" name="listo" value={b.listo ? "no" : "si"} />
                            <Enviar className="boton chico" pendiente="…">{b.listo ? "Desmarcar" : "Marcar enviado"}</Enviar>
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="tarjeta" aria-labelledby="msj-t">
        <h2 id="msj-t">Mensaje del reparto</h2>
        <p className="texto-largo chico mensaje">{r.mensaje}</p>
      </section>
    </>
  );
}
