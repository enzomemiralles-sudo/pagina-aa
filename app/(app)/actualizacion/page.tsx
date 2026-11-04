import { requerirMiembro } from "@/lib/sesion";
import { contextoTarea, ordenarTareas, SELECT_TAREA, type Tarea } from "@/lib/datos";
import { estadoCierre, fechaCorta, haceCuanto, semanaActual, sumarDias } from "@/lib/fechas";
import { Enviar } from "@/components/Cliente";
import { Vence } from "@/components/TablaTareas";
import { IconoCheck } from "@/components/Iconos";
import { cambiarEstadoTarea, cambiarVenceTarea, guardarActualizacion } from "../acciones";

export default async function Actualizacion() {
  const { supabase, yo } = await requerirMiembro();
  const semana = semanaActual();
  const desde = sumarDias(semana, -6);
  const cierre = estadoCierre();

  const [abiertasR, hechasR, actR] = await Promise.all([
    supabase.from("tareas").select(SELECT_TAREA).eq("responsable_id", yo.id).not("estado", "in", "(hecha,cancelada)"),
    supabase.from("tareas").select(SELECT_TAREA).eq("responsable_id", yo.id).eq("estado", "hecha").gte("hecha_at", `${desde}T03:00:00Z`),
    supabase.from("actualizaciones").select("necesito, sin_novedades, updated_at").eq("integrante_id", yo.id).eq("semana", semana).maybeSingle(),
  ]);
  const abiertas = ((abiertasR.data ?? []) as unknown as Tarea[]).sort(ordenarTareas);
  const hechas = (hechasR.data ?? []) as unknown as Tarea[];
  const act = actR.data;

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Actualización de la semana</h1>
          <p className="suave">
            {fechaCorta(desde)} al {fechaCorta(semana)} ·{" "}
            {cierre === "cierra_hoy" ? <strong className="texto-ambar">cierra hoy a las 22 h</strong> : cierre === "cerrada" ? "ya cerró, pero todavía la podés cargar" : "cierra el martes a las 22 h"}
          </p>
        </div>
      </div>

      {act && (
        <div className="aviso verde" role="status">
          <IconoCheck size={18} />
          <span>Ya la enviaste ({haceCuanto(act.updated_at).toLowerCase()}). Si algo cambió, la podés corregir abajo.</span>
        </div>
      )}

      <p style={{ maxWidth: 720 }}>Lo que hiciste y lo que te queda sale de tus tareas. Tildá lo que terminaste, avisá si algo se trabó y contá si necesitás algo.</p>

      <section className="tarjeta" aria-labelledby="tus-t" style={{ maxWidth: 820 }}>
        <h2 id="tus-t">Tus tareas abiertas</h2>
        {abiertas.length === 0 && <p className="suave">No tenés tareas abiertas.</p>}
        <ul className="lista">
          {abiertas.map((t) => (
            <li key={t.id} style={{ alignItems: "flex-start", background: t.estado === "trabada" ? "var(--rojo-f)" : undefined, borderRadius: t.estado === "trabada" ? 8 : undefined, padding: t.estado === "trabada" ? 10 : undefined }}>
              <form action={cambiarEstadoTarea} className="en-linea">
                <input type="hidden" name="id" value={t.id} />
                <input type="hidden" name="estado" value="hecha" />
                <button type="submit" className="boton-check" aria-label={`Marcar "${t.titulo}" como hecha`} title="Marcar como hecha" style={{ marginTop: 2 }}>
                  <IconoCheck size={14} />
                </button>
              </form>
              <div className="cuerpo" style={{ gap: 6 }}>
                <span style={{ fontWeight: 600 }}>{t.titulo}</span>
                <span className="chico suave">{contextoTarea(t)} · <Vence fecha={t.vence} /></span>
                {t.estado === "trabada" ? (
                  <>
                    <span className="chico texto-rojo">Trabada{t.nota_trabada ? `: ${t.nota_trabada}` : ""}</span>
                    <form action={cambiarEstadoTarea}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="estado" value="en_curso" />
                      <Enviar className="boton chico">Ya se destrabó</Enviar>
                    </form>
                  </>
                ) : (
                  <div className="acciones">
                    <details>
                      <summary className="chico">Me trabé</summary>
                      <form action={cambiarEstadoTarea} style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingTop: 6 }}>
                        <input type="hidden" name="id" value={t.id} />
                        <input type="hidden" name="estado" value="trabada" />
                        <label htmlFor={`nota-${t.id}`} className="oculto">Qué te frena</label>
                        <input id={`nota-${t.id}`} name="nota_trabada" type="text" placeholder="Qué te frena o qué necesitás" style={{ flex: "1 1 240px", width: "auto" }} />
                        <Enviar className="boton chico">Avisar</Enviar>
                      </form>
                    </details>
                    <details>
                      <summary className="chico">Otra fecha</summary>
                      <form action={cambiarVenceTarea} style={{ display: "flex", gap: 8, paddingTop: 6 }}>
                        <input type="hidden" name="id" value={t.id} />
                        <label htmlFor={`vence-${t.id}`} className="oculto">Nueva fecha</label>
                        <input id={`vence-${t.id}`} name="vence" type="date" defaultValue={t.vence ?? ""} style={{ width: "auto" }} />
                        <Enviar className="boton chico">Cambiar</Enviar>
                      </form>
                    </details>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
        {hechas.length > 0 && (
          <details>
            <summary>Hechas esta semana · {hechas.length}</summary>
            <ul className="lista" style={{ paddingTop: 8 }}>
              {hechas.map((t) => (
                <li key={t.id}>
                  <span className="chip verde"><IconoCheck size={12} /> Hecha</span>
                  <span className="cuerpo">{t.titulo}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <form action={guardarActualizacion} className="tarjeta formulario" style={{ maxWidth: 820 }}>
        <div className="campo">
          <label htmlFor="necesito" style={{ fontSize: 17, color: "var(--tinta)" }}>¿Necesitás algo?</label>
          <textarea id="necesito" name="necesito" rows={3} defaultValue={act?.necesito ?? ""} placeholder="Una decisión, una mano, un contacto… (opcional)" />
          <span className="ayuda">Esto lo leen la persona responsable y seguimiento antes de la reunión.</span>
        </div>
        <label className="check">
          <input type="checkbox" name="sin_novedades" value="si" defaultChecked={act?.sin_novedades ?? false} /> No tuve novedades esta semana
        </label>
        <div className="acciones">
          <Enviar>{act ? "Guardar cambios" : "Enviar actualización"}</Enviar>
        </div>
      </form>
    </>
  );
}
