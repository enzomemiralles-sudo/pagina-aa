"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { moverEnCalendario } from "@/app/(app)/acciones";

export type ItemCal = {
  clave: string;
  id: string;
  tipo: "tarea" | "actividad" | "reunion" | "evento" | "otra";
  fecha: string;
  titulo: string;
  /** Color de estado (código de la página) o "reunion"/"otra" para lo estructural. */
  color: "rojo" | "ambar" | "azul" | "verde" | "gris" | "reunion" | "evento" | "otra";
  estado: string;
  href?: string;
  movible: boolean;
};

const ETIQUETA_TIPO: Record<ItemCal["tipo"], string> = { tarea: "Tarea", actividad: "Actividad", reunion: "Reunión", evento: "Agrupación", otra: "Otra comisión" };
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MAX_POR_DIA = 4;

export function Calendario({
  semanas,
  mes,
  hoy,
  items: iniciales,
  diaSel,
  base,
}: {
  semanas: string[][];
  mes: string;
  hoy: string;
  items: ItemCal[];
  diaSel: string | null;
  base: string; // query sin "dia"
}) {
  const router = useRouter();
  const [items, mover] = useOptimistic(iniciales, (lista: ItemCal[], m: { clave: string; fecha: string }) =>
    lista.map((i) => (i.clave === m.clave ? { ...i, fecha: m.fecha } : i)),
  );
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, empezar] = useTransition();

  const porDia = new Map<string, ItemCal[]>();
  for (const i of items) {
    const l = porDia.get(i.fecha) ?? [];
    l.push(i);
    porDia.set(i.fecha, l);
  }
  const orden = { evento: 0, reunion: 1, actividad: 2, tarea: 3, otra: 4 } as const;

  const elegir = (dia: string) => router.push(`/calendario?${base}&dia=${dia}`, { scroll: false });

  const soltar = (dia: string, clave: string) => {
    const it = items.find((i) => i.clave === clave);
    setSobre(null);
    setArrastrando(null);
    if (!it || it.fecha === dia || !it.movible) return;
    empezar(async () => {
      mover({ clave, fecha: dia });
      const r = await moverEnCalendario(it.tipo as "tarea" | "actividad" | "reunion", it.id, dia);
      setError(r.error);
    });
  };

  return (
    <div className="calendario">
      {error && <p className="aviso rojo" role="alert">{error}</p>}
      <div className="cal-grilla" role="grid" aria-label="Calendario del mes">
        <div className="cal-fila cal-cabecera" role="row">
          {DIAS.map((d) => (
            <div key={d} role="columnheader">{d}</div>
          ))}
        </div>
        {semanas.map((semana) => (
          <div key={semana[0]} className="cal-fila" role="row">
            {semana.map((dia) => {
              const lista = (porDia.get(dia) ?? []).sort((a, b) => orden[a.tipo] - orden[b.tipo]);
              const propias = lista.filter((i) => i.tipo !== "otra");
              const otras = lista.length - propias.length;
              const fuera = !dia.startsWith(mes);
              const clases = ["cal-dia", fuera && "fuera", dia === hoy && "hoy", dia === diaSel && "elegido", sobre === dia && "sobre"].filter(Boolean).join(" ");
              return (
                <div
                  key={dia}
                  role="gridcell"
                  className={clases}
                  aria-selected={dia === diaSel}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("a")) return;
                    elegir(dia);
                  }}
                  onDragOver={(e) => {
                    if (!arrastrando) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (sobre !== dia) setSobre(dia);
                  }}
                  onDragLeave={() => setSobre((s) => (s === dia ? null : s))}
                  onDrop={(e) => {
                    e.preventDefault();
                    soltar(dia, e.dataTransfer.getData("text/plain"));
                  }}
                >
                  <button type="button" className="cal-numero" onClick={() => elegir(dia)} aria-label={`Ver el ${Number(dia.slice(8))}/${Number(dia.slice(5, 7))}`}>
                    {Number(dia.slice(8))}
                  </button>
                  <ul>
                    {propias.slice(0, MAX_POR_DIA).map((i) => (
                      <li key={i.clave}>
                        <Link
                          href={i.href ?? `/calendario?${base}&dia=${dia}`}
                          scroll={!!i.href}
                          className={`cal-item ${i.color} ${i.tipo}${arrastrando === i.clave ? " arrastrando" : ""}`}
                          draggable={i.movible}
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", i.clave);
                            e.dataTransfer.effectAllowed = "move";
                            setArrastrando(i.clave);
                          }}
                          onDragEnd={() => {
                            setArrastrando(null);
                            setSobre(null);
                          }}
                          title={`${ETIQUETA_TIPO[i.tipo]} · ${i.estado} · ${i.titulo}${i.movible ? " (arrastrala para cambiar el día)" : ""}`}
                        >
                          <span className="oculto">{ETIQUETA_TIPO[i.tipo]}: </span>
                          {i.titulo}
                          <span className="oculto"> ({i.estado})</span>
                        </Link>
                      </li>
                    ))}
                    {propias.length > MAX_POR_DIA && (
                      <li><button type="button" className="cal-mas" onClick={() => elegir(dia)}>+{propias.length - MAX_POR_DIA} más</button></li>
                    )}
                    {otras > 0 && (
                      <li><button type="button" className="cal-mas" onClick={() => elegir(dia)}>{otras} de otras comisiones</button></li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
