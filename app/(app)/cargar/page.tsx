import Link from "next/link";
import { requerirMiembro } from "@/lib/sesion";
import { listasBase } from "@/lib/datos";
import { TIPO_IDEA } from "@/lib/etiquetas";
import { Enviar } from "@/components/Cliente";
import { crearIdea, crearTarea } from "../acciones";

export default async function Cargar({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const { tipo } = await searchParams;
  const esTarea = tipo === "tarea";
  const { supabase, yo } = await requerirMiembro();
  const listas = await listasBase(supabase);
  const { data: actividades } = await supabase
    .from("actividades")
    .select("id, nombre")
    .not("estado", "in", "(cancelada,cerrada)")
    .order("fecha", { nullsFirst: false });

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Cargar</h1>
        </div>
      </div>

      <div className="segmentado" role="group" aria-label="Qué querés cargar" style={{ alignSelf: "flex-start" }}>
        <Link href="/cargar" aria-current={!esTarea ? "page" : undefined}>Idea</Link>
        <Link href="/cargar?tipo=tarea" aria-current={esTarea ? "page" : undefined}>Tarea</Link>
      </div>

      {!esTarea ? (
        <form action={crearIdea} className="tarjeta formulario" style={{ maxWidth: 720 }}>
          <div className="campo">
            <label htmlFor="titulo" style={{ fontSize: 20, color: "var(--tinta)" }}>¿Cuál es la idea?</label>
            <input id="titulo" name="titulo" type="text" placeholder="Ej.: guía de becas y convocatorias de la facu" required autoFocus />
            <span className="ayuda">Con el título alcanza. Va al banco de ideas y se trata en una reunión.</span>
          </div>
          <details>
            <summary>Agregar detalle (opcional)</summary>
            <div className="formulario" style={{ paddingTop: 10 }}>
              <div className="campo">
                <label htmlFor="descripcion">Contala en dos líneas</label>
                <textarea id="descripcion" name="descripcion" rows={2} placeholder="Qué es y por qué serviría" />
              </div>
              <div className="campo">
                <span className="etiqueta" id="tipo-l">¿Qué es?</span>
                <div className="opciones" role="radiogroup" aria-labelledby="tipo-l">
                  {Object.entries(TIPO_IDEA).map(([k, v]) => (
                    <label key={k}><input type="radio" name="tipo" value={k} defaultChecked={k === "idea"} /> {v}</label>
                  ))}
                </div>
              </div>
              <div className="campo">
                <label htmlFor="linea_id">Línea de trabajo</label>
                <select id="linea_id" name="linea_id" defaultValue="">
                  <option value="">No sé / ninguna</option>
                  {listas.lineas.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                </select>
              </div>
            </div>
          </details>
          <p className="suave chico">Después: se trata en la reunión → si se aprueba, pasa a propuesta.</p>
          <div className="acciones"><Enviar>Guardar idea</Enviar></div>
        </form>
      ) : (
        <form action={crearTarea} className="tarjeta formulario" style={{ maxWidth: 720 }}>
          <input type="hidden" name="ir_a" value="/" />
          <div className="campo">
            <label htmlFor="titulo" style={{ fontSize: 20, color: "var(--tinta)" }}>¿Qué hay que hacer?</label>
            <input id="titulo" name="titulo" type="text" required autoFocus />
          </div>
          <div className="fila-campos">
            <div className="campo">
              <label htmlFor="responsable_id">Quién</label>
              <select id="responsable_id" name="responsable_id" defaultValue={yo.id}>
                {listas.personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="vence">Para cuándo</label>
              <input id="vence" name="vence" type="date" />
            </div>
          </div>
          <div className="fila-campos">
            <div className="campo">
              <label htmlFor="proyecto_id">Proyecto</label>
              <select id="proyecto_id" name="proyecto_id" defaultValue="">
                <option value="">Ninguno</option>
                {listas.proyectos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="actividad_id">o actividad</label>
              <select id="actividad_id" name="actividad_id" defaultValue="">
                <option value="">Ninguna</option>
                {(actividades ?? []).map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </div>
          </div>
          <div className="acciones"><Enviar>Guardar tarea</Enviar></div>
        </form>
      )}
    </>
  );
}
