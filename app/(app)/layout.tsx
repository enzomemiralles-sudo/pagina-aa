import { cookies } from "next/headers";
import { Aviso } from "@/components/Aviso";
import { Menu } from "@/components/Menu";
import { ROL } from "@/lib/etiquetas";
import { requerirMiembro } from "@/lib/sesion";
import { salir } from "@/app/login/acciones";

function leerAviso(valor: string | undefined): { texto: string; tipo: "rojo" | "verde" } | null {
  if (!valor) return null;
  try {
    const a = JSON.parse(valor);
    if (typeof a?.texto === "string") return { texto: a.texto, tipo: a.tipo === "verde" ? "verde" : "rojo" };
  } catch {}
  return null;
}

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const { supabase, yo } = await requerirMiembro();
  const aviso = leerAviso((await cookies()).get("aviso")?.value);

  let pendientes = 0;
  if (yo.esResponsable) {
    const { count } = await supabase.from("integrantes").select("id", { count: "exact", head: true }).eq("estado", "pendiente");
    pendientes = count ?? 0;
  }

  return (
    <div className="app">
      <Menu
        nombre={yo.nombre}
        rol={ROL[yo.rol] ?? yo.rol}
        esCoord={yo.esCoord}
        esResponsable={yo.esResponsable}
        pendientesAprobacion={pendientes}
        salir={salir}
      />
      <main className="contenido">
        <div className="contenido-interno">
          {aviso && <Aviso key={aviso.texto} texto={aviso.texto} tipo={aviso.tipo} />}
          {children}
        </div>
      </main>
    </div>
  );
}
