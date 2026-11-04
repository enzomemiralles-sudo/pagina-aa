import { requerirMiembro } from "@/lib/sesion";
import { listasBase } from "@/lib/datos";
import { FormProyecto } from "@/components/Formularios";
import { crearProyecto } from "../../acciones";

export default async function NuevoProyecto() {
  const { supabase, yo } = await requerirMiembro();
  const listas = await listasBase(supabase);
  return (
    <>
      <div className="encabezado">
        <div>
          <p className="suave">Comisión</p>
          <h1>Nuevo proyecto</h1>
        </div>
      </div>
      <FormProyecto accion={crearProyecto} listas={listas} yoId={yo.id} cancelar="/comision" />
    </>
  );
}
