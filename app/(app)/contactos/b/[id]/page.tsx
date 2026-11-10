import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirMiembro } from "@/lib/sesion";
import { fechaLarga } from "@/lib/fechas";
import { completar } from "@/lib/mensajes";
import { listaWhatsapp, primerNombre, type Contacto } from "@/lib/contactos";
import { Copiar, Enviar } from "@/components/Cliente";
import { ListaContactos } from "@/components/ListaContactos";
import { marcarBloqueListo } from "../../../acciones";

/** Lo que le toca a un compañero: el mensaje, su lista y un botón por contacto. */
export default async function Bloque({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, yo } = await requerirMiembro();
  const { data: b } = await supabase
    .from("bloques")
    .select("id, numero, cantidad, contactos, enviados, listo, nomina_id, reparto_id, nomina(nombre, integrante_id), repartos(titulo, fecha_contacto, mensaje, creado_por, purgado)")
    .eq("id", id)
    .maybeSingle();
  if (!b) notFound();
  const bloque = b as unknown as {
    id: string; numero: number; cantidad: number; contactos: Contacto[]; enviados: number[]; listo: boolean; reparto_id: string;
    nomina: { nombre: string; integrante_id: string | null } | null;
    repartos: { titulo: string; fecha_contacto: string; mensaje: string; creado_por: string | null; purgado: boolean };
  };
  const r = bloque.repartos;
  const esMio = bloque.nomina?.integrante_id === yo.id;
  const puedeMarcar = esMio || yo.esCoord || r.creado_por === yo.id;
  const quien = primerNombre(bloque.nomina?.nombre ?? yo.nombre);
  const mensajeSinNombre = completar(r.mensaje, { yo: quien });
  const enviados = bloque.listo ? bloque.contactos.map((c) => c.n) : bloque.enviados;

  return (
    <div className="formulario" style={{ maxWidth: 760 }}>
      <nav className="migas" aria-label="Ruta">
        <Link href="/contactos">Contactos</Link>
        {(yo.esCoord || r.creado_por === yo.id) && <><span aria-hidden="true">›</span><Link href={`/contactos/r/${bloque.reparto_id}`}>Seguimiento</Link></>}
      </nav>
      <div>
        <p className="suave">B{bloque.numero} · {bloque.cantidad} contactos · para el {fechaLarga(r.fecha_contacto)}{!esMio && bloque.nomina ? ` · ${bloque.nomina.nombre}` : ""}</p>
        <h1>{r.titulo}</h1>
      </div>

      {bloque.listo ? (
        <div className="aviso verde"><strong>Enviado.</strong> ¡Gracias!</div>
      ) : (
        <div className="aviso gris">
          <span>Tocá <strong>Escribir</strong> en cada contacto: se abre WhatsApp con el mensaje y el nombre puestos. Llevás <strong>{enviados.length} de {bloque.cantidad}</strong>.</span>
        </div>
      )}

      {r.purgado ? (
        <p className="tarjeta suave">Los teléfonos de este reparto ya se borraron (pasaron 7 días del día de contacto).</p>
      ) : (
        <section className="tarjeta" aria-labelledby="lis-t">
          <h2 id="lis-t">Tus contactos</h2>
          <ListaContactos bloqueId={bloque.id} contactos={bloque.contactos} enviados={enviados} mensaje={r.mensaje} yo={quien} puedeMarcar={puedeMarcar && !bloque.listo} />
          <div className="acciones">
            <Copiar texto={listaWhatsapp(bloque.contactos)} className="boton chico">Copiar la lista</Copiar>
          </div>
        </section>
      )}

      <section className="tarjeta" aria-labelledby="msj-t">
        <h2 id="msj-t">El mensaje</h2>
        <p className="texto-largo chico mensaje">{mensajeSinNombre}</p>
        <div className="acciones"><Copiar texto={mensajeSinNombre} className="boton chico">Copiar el mensaje</Copiar></div>
      </section>

      {puedeMarcar && (
        <form action={marcarBloqueListo} className="acciones">
          <input type="hidden" name="id" value={bloque.id} />
          <input type="hidden" name="listo" value={bloque.listo ? "no" : "si"} />
          <Enviar className={bloque.listo ? "boton" : "boton primario"}>{bloque.listo ? "Desmarcar" : "Listo, los mandé todos"}</Enviar>
        </form>
      )}
    </div>
  );
}
