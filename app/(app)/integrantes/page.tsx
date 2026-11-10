import { redirect } from "next/navigation";
import { requerirMiembro } from "@/lib/sesion";
import { ESTADO_INTEGRANTE, ROL } from "@/lib/etiquetas";
import { haceCuanto } from "@/lib/fechas";
import { ChipDe } from "@/components/Chip";
import { Confirmar, Enviar } from "@/components/Cliente";
import { cambiarIntegrante } from "../acciones";

type Fila = { id: string; nombre: string; email: string; rol: string; estado: string; created_at: string };

export default async function Integrantes() {
  const { supabase, yo } = await requerirMiembro();
  if (!yo.esResponsable) redirect("/");
  const { data } = await supabase.rpc("integrantes_admin");
  const filas = (data ?? []) as Fila[];
  const pendientes = filas.filter((f) => f.estado === "pendiente");
  const resto = filas.filter((f) => f.estado !== "pendiente");

  const boton = (id: string, campo: "estado" | "rol", valor: string, texto: string, clase = "boton chico") => (
    <form action={cambiarIntegrante} className="en-linea">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name={campo} value={valor} />
      <Enviar className={clase} pendiente="…">{texto}</Enviar>
    </form>
  );

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Integrantes</h1>
          <p className="suave">Quién entra a la página y con qué rol. Solo lo ve la persona responsable.</p>
        </div>
      </div>

      <section className="tarjeta sin-relleno" aria-labelledby="pend-t">
        <div className="tarjeta-cabecera">
          <h2 id="pend-t">Esperan aprobación</h2>
          {pendientes.length > 0 && <span className="chip ambar">{pendientes.length}</span>}
        </div>
        {pendientes.length ? (
          <div className="tabla-caja">
            <table className="tabla">
              <thead><tr><th>Nombre</th><th>Mail</th><th>Se registró</th><th><span className="oculto">Acciones</span></th></tr></thead>
              <tbody>
                {pendientes.map((f) => (
                  <tr key={f.id}>
                    <td className="nombre">{f.nombre}</td>
                    <td className="suave">{f.email}</td>
                    <td className="suave">{haceCuanto(f.created_at)}</td>
                    <td className="nowrap">
                      <div className="acciones">
                        <form action={cambiarIntegrante} style={{ display: "flex", gap: 6 }}>
                          <input type="hidden" name="id" value={f.id} />
                          <input type="hidden" name="estado" value="activo" />
                          <label htmlFor={`rolp-${f.id}`} className="oculto">Rol de {f.nombre}</label>
                          <select id={`rolp-${f.id}`} name="rol" defaultValue="integrante" style={{ minHeight: 34, width: "auto" }}>
                            <option value="integrante">Integrante</option>
                            <option value="columna">Columna</option>
                            <option value="seguimiento">Seguimiento</option>
                          </select>
                          <Enviar className="boton primario chico" pendiente="…">Aprobar</Enviar>
                        </form>
                        <form action={cambiarIntegrante} className="en-linea">
                          <input type="hidden" name="id" value={f.id} />
                          <input type="hidden" name="estado" value="baja" />
                          <Confirmar mensaje={`¿Rechazar a ${f.nombre}? No va a poder entrar.`}>Rechazar</Confirmar>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="vacio">Nadie esperando. Pasales la dirección de la página para que se registren.</p>
        )}
      </section>

      <section className="tarjeta sin-relleno" aria-labelledby="todos-t">
        <div className="tarjeta-cabecera"><h2 id="todos-t">Integrantes</h2><span className="suave chico">{resto.length}</span></div>
        <div className="tabla-caja">
          <table className="tabla" style={{ minWidth: 760 }}>
            <thead><tr><th>Nombre</th><th>Mail</th><th>Rol</th><th>Estado</th><th><span className="oculto">Acciones</span></th></tr></thead>
            <tbody>
              {resto.map((f) => (
                <tr key={f.id}>
                  <td className="nombre">{f.nombre}{f.id === yo.id && <span className="suave"> (vos)</span>}</td>
                  <td className="suave">{f.email}</td>
                  <td>
                    {f.id === yo.id ? (
                      ROL[f.rol]
                    ) : (
                      <form action={cambiarIntegrante} style={{ display: "flex", gap: 6 }}>
                        <input type="hidden" name="id" value={f.id} />
                        <label htmlFor={`rol-${f.id}`} className="oculto">Rol de {f.nombre}</label>
                        <select id={`rol-${f.id}`} name="rol" defaultValue={f.rol} style={{ minHeight: 34, width: "auto" }}>
                          {Object.entries(ROL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                        <Enviar className="boton chico" pendiente="…">Cambiar</Enviar>
                      </form>
                    )}
                  </td>
                  <td><ChipDe mapa={ESTADO_INTEGRANTE} valor={f.estado} /></td>
                  <td className="nowrap">
                    {f.id !== yo.id && (
                      <div className="acciones">
                        {f.estado === "activo" && boton(f.id, "estado", "en_pausa", "Poner en pausa")}
                        {(f.estado === "en_pausa" || f.estado === "baja") && boton(f.id, "estado", "activo", "Activar")}
                        {f.estado !== "baja" && (
                          <form action={cambiarIntegrante} className="en-linea">
                            <input type="hidden" name="id" value={f.id} />
                            <input type="hidden" name="estado" value="baja" />
                            <Confirmar mensaje={`¿Dar de baja a ${f.nombre}? No va a poder entrar, pero su historial queda.`}>Dar de baja</Confirmar>
                          </form>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="vacio" style={{ paddingTop: 0 }}>
          “En pausa” sigue entrando y viendo todo, pero no cuenta en las actualizaciones que faltan. Seguimiento ve la coordinación, pero no esta pantalla. Columna lleva la asistencia a las reuniones: ve la comisión, no administra y no carga actualización semanal.
        </p>
      </section>
    </>
  );
}
