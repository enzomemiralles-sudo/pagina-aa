import { cambiarSeguimiento } from "@/app/(app)/acciones";
import { Enviar } from "./Cliente";
import { IconoEscudo } from "./Iconos";

/** Botones de seguimiento (solo coordinación). */
export function BotonesSeguimiento({ tabla, id, estado }: { tabla: "proyectos" | "actividades" | "decisiones"; id: string; estado: string }) {
  const boton = (valor: string, texto: React.ReactNode, clase = "boton chico") => (
    <form action={cambiarSeguimiento} className="en-linea">
      <input type="hidden" name="tabla" value={tabla} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="seguimiento" value={valor} />
      <Enviar className={clase} pendiente="…">{texto}</Enviar>
    </form>
  );
  if (estado === "pendiente")
    return (
      <>
        {boton("validado", <><IconoEscudo size={15} /> Marcar validado</>, "boton primario chico")}
        {boton("devuelto", "Devolver")}
      </>
    );
  if (estado === "validado") return boton("pendiente", "Volver a seguimiento");
  return boton("pendiente", "Mandar a seguimiento");
}
