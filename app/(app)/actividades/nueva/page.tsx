import { requerirMiembro } from "@/lib/sesion";
import { listasBase } from "@/lib/datos";
import { FormActividad } from "@/components/Formularios";
import { crearActividad } from "../../acciones";

export default async function NuevaActividad({ searchParams }: { searchParams: Promise<{ proyecto?: string }> }) {
  const { proyecto } = await searchParams;
  const { supabase, yo } = await requerirMiembro();
  const listas = await listasBase(supabase);
  let mesa: string | null = null;
  if (proyecto) {
    const { data } = await supabase.from("proyectos").select("mesa_id, linea_id").eq("id", proyecto).maybeSingle();
    mesa = data?.mesa_id ?? null;
  }
  return (
    <>
      <div className="encabezado">
        <div>
          <p className="suave">Comisión</p>
          <h1>Nueva actividad</h1>
        </div>
      </div>
      <FormActividad
        accion={crearActividad}
        a={{ proyecto_id: proyecto ?? null, mesa_id: mesa }}
        listas={listas}
        yoId={yo.id}
        cancelar={proyecto ? `/proyectos/${proyecto}` : "/comision"}
      />
    </>
  );
}
