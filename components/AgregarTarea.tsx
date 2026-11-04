import { crearTarea } from "@/app/(app)/acciones";
import type { Persona } from "@/lib/datos";
import { Enviar } from "./Cliente";

type Props = {
  personas: Persona[];
  responsableInicial?: string | null;
  proyectoId?: string | null;
  actividadId?: string | null;
  reunionId?: string | null;
  temaId?: string | null;
  sufijo: string;
};

/** Fila para cargar una tarea en el lugar: qué, quién y para cuándo. */
export function AgregarTarea({ personas, responsableInicial, proyectoId, actividadId, reunionId, temaId, sufijo }: Props) {
  return (
    <form action={crearTarea} className="fila-tarea">
      {proyectoId && <input type="hidden" name="proyecto_id" value={proyectoId} />}
      {actividadId && <input type="hidden" name="actividad_id" value={actividadId} />}
      {reunionId && <input type="hidden" name="reunion_id" value={reunionId} />}
      {temaId && <input type="hidden" name="tema_id" value={temaId} />}
      <div className="campo">
        <label htmlFor={`t-${sufijo}`}>Nueva tarea</label>
        <input id={`t-${sufijo}`} name="titulo" type="text" placeholder="¿Qué hay que hacer?" required />
      </div>
      <div className="campo">
        <label htmlFor={`q-${sufijo}`}>Quién</label>
        <select id={`q-${sufijo}`} name="responsable_id" defaultValue={responsableInicial ?? ""}>
          <option value="">Sin asignar</option>
          {personas.map((p) => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>
      </div>
      <div className="campo">
        <label htmlFor={`f-${sufijo}`}>Para cuándo</label>
        <input id={`f-${sufijo}`} name="vence" type="date" />
      </div>
      <Enviar className="boton primario" pendiente="…">Agregar</Enviar>
    </form>
  );
}
