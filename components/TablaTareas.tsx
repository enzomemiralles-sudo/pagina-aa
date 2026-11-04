import Link from "next/link";
import { cambiarEstadoTarea } from "@/app/(app)/acciones";
import { ESTADO_TAREA } from "@/lib/etiquetas";
import { vencimiento } from "@/lib/fechas";
import { contextoTarea, nombreDe, type Persona, type Tarea } from "@/lib/datos";
import { ChipDe } from "./Chip";
import { IconoAlerta, IconoCheck } from "./Iconos";

type Props = {
  tareas: Tarea[];
  personas?: Persona[];
  mostrarContexto?: boolean;
  mostrarResponsable?: boolean;
  puedeTildar?: (t: Tarea) => boolean;
  vacio?: string;
};

export function Vence({ fecha, hecha }: { fecha: string | null; hecha?: boolean }) {
  const v = vencimiento(fecha);
  if (hecha || v.nivel === "normal" || v.nivel === "sin") return <span className={v.nivel === "sin" ? "suave" : undefined}>{v.texto}</span>;
  if (v.nivel === "vencida")
    return (
      <span className="texto-rojo" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <IconoAlerta size={15} />
        {v.texto}
      </span>
    );
  return <span className="texto-ambar">{v.texto}</span>;
}

export function TablaTareas({ tareas, personas = [], mostrarContexto = true, mostrarResponsable = false, puedeTildar = () => true, vacio = "No hay tareas." }: Props) {
  if (!tareas.length) return <p className="vacio">{vacio}</p>;
  return (
    <div className="tabla-caja">
      <table className="tabla">
        <thead>
          <tr>
            <th style={{ width: 44 }}><span className="oculto">Hecha</span></th>
            <th>Tarea</th>
            {mostrarContexto && <th className="ocultar-movil">Proyecto o actividad</th>}
            {mostrarResponsable && <th>Quién</th>}
            <th>Vence</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {tareas.map((t) => {
            const hecha = t.estado === "hecha";
            return (
              <tr key={t.id}>
                <td>
                  {puedeTildar(t) ? (
                    <form action={cambiarEstadoTarea} className="en-linea">
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="estado" value={hecha ? "pendiente" : "hecha"} />
                      <button type="submit" className={`boton-check${hecha ? " hecho" : ""}`} aria-label={hecha ? "Marcar como pendiente" : "Marcar como hecha"} title={hecha ? "Marcar como pendiente" : "Marcar como hecha"}>
                        <IconoCheck size={14} />
                      </button>
                    </form>
                  ) : null}
                </td>
                <td>
                  <span className="nombre" style={hecha ? { textDecoration: "line-through", color: "var(--suave)" } : undefined}>{t.titulo}</span>
                  {t.estado === "trabada" && t.nota_trabada && <div className="chico texto-rojo" style={{ fontWeight: 500 }}>{t.nota_trabada}</div>}
                </td>
                {mostrarContexto && (
                  <td className="suave ocultar-movil">
                    {t.proyecto_id ? (
                      <Link href={`/proyectos/${t.proyecto_id}`}>{contextoTarea(t)}</Link>
                    ) : t.actividad_id ? (
                      <Link href={`/actividades/${t.actividad_id}`}>{contextoTarea(t)}</Link>
                    ) : (
                      contextoTarea(t)
                    )}
                  </td>
                )}
                {mostrarResponsable && <td>{nombreDe(personas, t.responsable_id)}</td>}
                <td className="nowrap"><Vence fecha={t.vence} hecha={hecha} /></td>
                <td><ChipDe mapa={ESTADO_TAREA} valor={t.estado} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
