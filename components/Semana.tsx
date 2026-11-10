import Link from "next/link";
import { fechaCorta, sumarDias } from "@/lib/fechas";

export type ItemSemana = {
  clave: string;
  fecha: string;
  etiqueta: string; // comisión o canal, siempre visible
  texto: string;
  detalle?: string;
  clase: string; // color (por comisión o por estado)
  href?: string;
};

/** Semana de lunes a domingo en columnas. */
export function Semana({ lunes, hoy, items, vacio = "—" }: { lunes: string; hoy: string; items: ItemSemana[]; vacio?: string }) {
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
  return (
    <div className="semana" role="list" aria-label="Semana">
      {dias.map((d) => {
        const del = items.filter((i) => i.fecha === d);
        return (
          <section key={d} className={`semana-dia${d === hoy ? " hoy" : ""}`} role="listitem" aria-label={fechaCorta(d)}>
            <h3>{fechaCorta(d)}{d === hoy ? " · hoy" : ""}</h3>
            {del.length ? (
              <ul>
                {del.map((i) => {
                  const cuerpo = (
                    <>
                      <span className="semana-etiqueta">{i.etiqueta}</span>
                      <span className="semana-texto">{i.texto}</span>
                      {i.detalle && <span className="semana-detalle">{i.detalle}</span>}
                    </>
                  );
                  return (
                    <li key={i.clave} className={`semana-item ${i.clase}`}>
                      {i.href ? <Link href={i.href}>{cuerpo}</Link> : <div>{cuerpo}</div>}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="suave chico">{vacio}</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
