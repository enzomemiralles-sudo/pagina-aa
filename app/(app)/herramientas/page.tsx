import { requerirMiembro } from "@/lib/sesion";
import { PARA_MENSAJE, TIPO_ENLACE } from "@/lib/etiquetas";
import { VARIABLES } from "@/lib/mensajes";
import { Confirmar, Copiar, Enviar } from "@/components/Cliente";
import { IconoDocumento } from "@/components/Iconos";
import { agregarDocumento, borrarDocumento, borrarMensaje, guardarMensaje } from "../acciones";

type Enlace = { id: string; titulo: string; url: string; tipo: string; nota: string | null; created_by: string | null };
type Mensaje = { id: string; titulo: string; para: string; texto: string };

const PREGUNTAS_FORM = [
  "Nombre y apellido",
  "WhatsApp con código de área, sin 0 ni 15 (ej.: 11 2345 6789)",
  "Mail",
  "¿En qué año de la carrera estás? (CBC · 1.° a 5.° año · Graduado/a)",
  "¿Cómo te enteraste? (Instagram · Grupo de WhatsApp · Un compañero · Otro)",
  "Casilla obligatoria: “Si no puedo ir, aviso hasta 24 h antes para que el lugar lo use otra persona.”",
];

const PREGUNTAS_ENCUESTA = [
  "¿Qué te pareció la actividad? (1 a 5)",
  "¿Qué fue lo que más te gustó?",
  "¿La organización fue clara? Punto de encuentro, horarios, mensajes (1 a 5)",
  "¿Qué otra visita o charla te gustaría que armemos?",
  "¿Querés que te avisemos de las próximas actividades? (Sí / No)",
];

export default async function Herramientas() {
  const { supabase, yo } = await requerirMiembro();
  const [enlacesR, mensajesR] = await Promise.all([
    supabase.from("documentos").select("id, titulo, url, tipo, nota, created_by").is("proyecto_id", null).is("actividad_id", null).order("created_at"),
    supabase.from("mensajes_modelo").select("id, titulo, para, texto").order("para").order("orden"),
  ]);
  const enlaces = (enlacesR.data ?? []) as Enlace[];
  const mensajes = (mensajesR.data ?? []) as Mensaje[];
  const grupos = Object.keys(PARA_MENSAJE).filter((p) => mensajes.some((m) => m.para === p));

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Herramientas</h1>
          <p className="suave">Los links que usamos siempre, los mensajes modelo y cómo contactamos a los inscriptos. Lo de cada actividad está en su página.</p>
        </div>
      </div>

      <section className="tarjeta" aria-labelledby="enl-t">
        <h2 id="enl-t">Links de la comisión</h2>
        {enlaces.length ? (
          <ul className="lista">
            {enlaces.map((e) => (
              <li key={e.id}>
                <IconoDocumento size={18} />
                <span className="cuerpo">
                  <a href={e.url} target="_blank" rel="noreferrer" style={{ fontWeight: 700 }}>{e.titulo}</a>
                  {e.nota && <span className="suave chico">{e.nota}</span>}
                </span>
                <span className="chip gris">{TIPO_ENLACE[e.tipo]?.texto ?? "Otro"}</span>
                {(yo.esCoord || e.created_by === yo.id) && (
                  <form action={borrarDocumento} className="en-linea">
                    <input type="hidden" name="id" value={e.id} />
                    <Confirmar mensaje={`¿Sacar "${e.titulo}"? El archivo original no se borra.`} className="boton texto chico">Quitar</Confirmar>
                  </form>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="suave">Todavía no hay links. Sumá la carpeta de Drive, la planilla general, el Canva…</p>
        )}
        <details>
          <summary>+ Agregar link</summary>
          <form action={agregarDocumento} className="formulario" style={{ paddingTop: 8 }}>
            <div className="fila-campos">
              <div className="campo"><label htmlFor="h-titulo">Nombre</label><input id="h-titulo" name="titulo" type="text" placeholder="Drive de AA, Canva de Nexo…" required /></div>
              <div className="campo"><label htmlFor="h-url">Link</label><input id="h-url" name="url" type="url" required /></div>
              <div className="campo">
                <label htmlFor="h-tipo">Qué es</label>
                <select id="h-tipo" name="tipo" defaultValue="carpeta">
                  {Object.entries(TIPO_ENLACE).map(([k, v]) => <option key={k} value={k}>{v.texto}</option>)}
                </select>
              </div>
            </div>
            <div className="campo"><label htmlFor="h-nota">Para qué sirve (opcional)</label><input id="h-nota" name="nota" type="text" /></div>
            <Enviar className="boton primario chico">Agregar</Enviar>
          </form>
        </details>
      </section>

      <section className="tarjeta" aria-labelledby="msj-t">
        <h2 id="msj-t">Mensajes modelo</h2>
        <p className="suave chico">
          Son la base. En cada actividad aparecen completos con sus datos; en la planilla, con el nombre de cada persona. Cualquiera de la comisión puede mejorarlos.
        </p>
        <details>
          <summary>Qué se completa solo</summary>
          <dl className="datos" style={{ paddingTop: 8 }}>
            {Object.entries(VARIABLES).map(([k, v]) => (
              <div key={k} style={{ display: "contents" }}><dt><code>{`{${k}}`}</code></dt><dd style={{ fontWeight: 400 }}>{v}</dd></div>
            ))}
          </dl>
        </details>
        {grupos.map((g) => (
          <div key={g} className="formulario" style={{ gap: 10 }}>
            <h3>{PARA_MENSAJE[g]}</h3>
            <div className="grilla">
              {mensajes.filter((m) => m.para === g).map((m) => (
                <div key={m.id} className="tarjeta" style={{ gap: 8 }}>
                  <strong>{m.titulo}</strong>
                  <p className="texto-largo chico mensaje">{m.texto}</p>
                  <div className="acciones">
                    <Copiar texto={m.texto} className="boton chico">Copiar</Copiar>
                  </div>
                  <details>
                    <summary>Editar</summary>
                    <form action={guardarMensaje} className="formulario" style={{ paddingTop: 8 }}>
                      <input type="hidden" name="id" value={m.id} />
                      <div className="campo"><label htmlFor={`mt-${m.id}`}>Nombre</label><input id={`mt-${m.id}`} name="titulo" type="text" defaultValue={m.titulo} required /></div>
                      <div className="campo">
                        <label htmlFor={`mp-${m.id}`}>Para</label>
                        <select id={`mp-${m.id}`} name="para" defaultValue={m.para}>
                          {Object.entries(PARA_MENSAJE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </div>
                      <div className="campo"><label htmlFor={`mx-${m.id}`}>Texto</label><textarea id={`mx-${m.id}`} name="texto" rows={8} defaultValue={m.texto} required /></div>
                      <div className="acciones">
                        <Enviar className="boton primario chico">Guardar</Enviar>
                      </div>
                    </form>
                    {yo.esCoord && (
                      <form action={borrarMensaje} style={{ paddingTop: 8 }}>
                        <input type="hidden" name="id" value={m.id} />
                        <Confirmar mensaje={`¿Borrar el mensaje "${m.titulo}"?`}>Borrar mensaje</Confirmar>
                      </form>
                    )}
                  </details>
                </div>
              ))}
            </div>
          </div>
        ))}
        <details>
          <summary>+ Nuevo mensaje</summary>
          <form action={guardarMensaje} className="formulario" style={{ paddingTop: 8 }}>
            <div className="fila-campos">
              <div className="campo"><label htmlFor="nm-t">Nombre</label><input id="nm-t" name="titulo" type="text" placeholder="Ej.: Aviso de cambio de horario" required /></div>
              <div className="campo">
                <label htmlFor="nm-p">Para</label>
                <select id="nm-p" name="para" defaultValue="visita">
                  {Object.entries(PARA_MENSAJE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div className="campo"><label htmlFor="nm-x">Texto</label><textarea id="nm-x" name="texto" rows={6} placeholder="Buenas {nombre}, ¿cómo va? Acá {yo} de Nexo💚" required /></div>
            <Enviar className="boton primario chico">Guardar</Enviar>
          </form>
        </details>
      </section>

      <section className="tarjeta" aria-labelledby="con-t">
        <h2 id="con-t">Cómo contactamos a los inscriptos</h2>
        <p className="suave">
          Los datos de los inscriptos viven en la planilla de Google, no en la página. La página guarda los links y arma los mensajes y las fórmulas.
        </p>
        <ol className="pasos">
          <li><strong>Form de inscripción</strong> con las preguntas de abajo. Cupo habitual por visita: 30.</li>
          <li><strong>Planilla</strong> con las respuestas. Se reparte: cada compañero se pone en la columna “Compañero que escribe” de unas 10 filas.</li>
          <li><strong>Mensaje</strong>: cada fila tiene un link “Escribir” que abre WhatsApp con el mensaje ya armado. La fórmula está en la página de cada actividad.</li>
          <li><strong>Grupo de WhatsApp</strong> de la actividad: el link va en la confirmación. Ahí van los recordatorios.</li>
          <li><strong>Cancelaciones</strong>: se puede cancelar hasta 24 h antes (está en el Form y en la confirmación). Si alguien cancela, el primero en espera pasa a cupo solo y se le escribe “Se liberó un lugar”.</li>
          <li><strong>El día</strong>: en Estado se marca quién asistió. Después se manda la encuesta.</li>
        </ol>
        <div className="grilla">
          <div>
            <h3 style={{ marginBottom: 8 }}>Preguntas del Form de inscripción</h3>
            <ol className="pasos">
              {PREGUNTAS_FORM.map((p) => <li key={p}>{p}</li>)}
            </ol>
            <Copiar texto={PREGUNTAS_FORM.join("\n")} className="boton chico">Copiar preguntas</Copiar>
          </div>
          <div>
            <h3 style={{ marginBottom: 8 }}>Encuesta posterior (borrador para la reunión)</h3>
            <ol className="pasos">
              {PREGUNTAS_ENCUESTA.map((p) => <li key={p}>{p}</li>)}
            </ol>
            <Copiar texto={PREGUNTAS_ENCUESTA.join("\n")} className="boton chico">Copiar preguntas</Copiar>
          </div>
        </div>
      </section>
    </>
  );
}
