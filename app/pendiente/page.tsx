import { redirect } from "next/navigation";
import { crearCliente } from "@/lib/supabase/server";
import { salir } from "@/app/login/acciones";

export default async function Pendiente() {
  const supabase = await crearCliente();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase.from("integrantes").select("nombre, estado").eq("id", user.id).single();
  if (data && (data.estado === "activo" || data.estado === "en_pausa")) redirect("/");

  const baja = data?.estado === "baja";

  return (
    <div className="pantalla-sola">
      <div className="caja-login">
        <h1>{baja ? "Tu cuenta está dada de baja" : "Tu cuenta espera aprobación"}</h1>
        <p>
          {baja
            ? "Si es un error, hablá con la persona responsable de la comisión."
            : `Hola${data?.nombre ? `, ${data.nombre}` : ""}. La persona responsable de la comisión tiene que aprobar tu cuenta. Cuando lo haga, vas a poder entrar desde esta misma dirección.`}
        </p>
        <form action={salir}>
          <button type="submit" className="boton">Salir</button>
        </form>
      </div>
    </div>
  );
}
