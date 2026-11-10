"use client";

import { useOptimistic, useTransition } from "react";
import { marcarContacto } from "@/app/(app)/acciones";
import { linkWhatsapp, primerNombre, telLindo, type Contacto } from "@/lib/contactos";
import { completar } from "@/lib/mensajes";

/** Lista del bloque: cada contacto con su botón de WhatsApp (mensaje y nombre puestos) y su tilde de enviado. */
export function ListaContactos({ bloqueId, contactos, enviados: iniciales, mensaje, yo, puedeMarcar }: {
  bloqueId: string;
  contactos: Contacto[];
  enviados: number[];
  mensaje: string;
  yo: string;
  puedeMarcar: boolean;
}) {
  const [enviados, aplicar] = useOptimistic(iniciales, (lista: number[], c: { n: number; si: boolean }) =>
    c.si ? [...new Set([...lista, c.n])] : lista.filter((x) => x !== c.n),
  );
  const [, empezar] = useTransition();
  const marcar = (n: number, si: boolean) =>
    empezar(async () => {
      aplicar({ n, si });
      await marcarContacto(bloqueId, n, si);
    });

  return (
    <ul className="lista contactos">
      {contactos.map((c) => {
        const hecho = enviados.includes(c.n);
        const texto = completar(mensaje, { nombre: primerNombre(c.nombre), yo });
        return (
          <li key={c.n} className={hecho ? "hecho" : undefined}>
            {puedeMarcar && (
              <label className="check" style={{ minHeight: 0 }}>
                <input type="checkbox" checked={hecho} onChange={(e) => marcar(c.n, e.target.checked)} />
                <span className="oculto">Ya le escribí a {c.nombre}</span>
              </label>
            )}
            <span className="cuerpo">
              <strong>{c.n}. {c.nombre}</strong>
              <span className="suave chico">{telLindo(c.tel)}</span>
            </span>
            <a
              href={linkWhatsapp(c.tel, texto)}
              target="_blank"
              rel="noreferrer"
              className={`boton chico${hecho ? "" : " verde"}`}
              onClick={() => { if (puedeMarcar && !hecho) marcar(c.n, true); }}
            >
              {hecho ? "Escribir de nuevo" : "Escribir"}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
