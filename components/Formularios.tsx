import Link from "next/link";
import { IDENTIDAD, TIPO_ACTIVIDAD } from "@/lib/etiquetas";
import type { Persona } from "@/lib/datos";
import { Enviar } from "./Cliente";

type Opcion = { id: string; nombre: string };
type Listas = { lineas: Opcion[]; mesas: Opcion[]; proyectos: Opcion[]; personas: Persona[] };

function Select({ id, etiqueta, nombre, opciones, valor, vacio }: { id: string; etiqueta: string; nombre: string; opciones: Opcion[]; valor?: string | null; vacio: string }) {
  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      <select id={id} name={nombre} defaultValue={valor ?? ""}>
        <option value="">{vacio}</option>
        {opciones.map((o) => (
          <option key={o.id} value={o.id}>{o.nombre}</option>
        ))}
      </select>
    </div>
  );
}

function Identidad({ valor }: { valor?: string }) {
  return (
    <div className="campo">
      <span className="etiqueta" id="identidad-l">Se comunica como</span>
      <div className="opciones" role="radiogroup" aria-labelledby="identidad-l">
        {Object.entries(IDENTIDAD).map(([k, v]) => (
          <label key={k}>
            <input type="radio" name="identidad" value={k} defaultChecked={(valor ?? "nexo") === k} /> {v}
          </label>
        ))}
      </div>
    </div>
  );
}

type Proyecto = { id?: string; nombre?: string; fundamento?: string | null; objetivos?: string | null; linea_id?: string | null; mesa_id?: string | null; responsable_id?: string | null; identidad?: string };

export function FormProyecto({ accion, p = {}, listas, yoId, cancelar }: { accion: (fd: FormData) => Promise<void>; p?: Proyecto; listas: Listas; yoId: string; cancelar: string }) {
  return (
    <form action={accion} className="tarjeta formulario">
      {p.id && <input type="hidden" name="id" value={p.id} />}
      <div className="campo">
        <label htmlFor="nombre">Nombre del proyecto</label>
        <input id="nombre" name="nombre" type="text" defaultValue={p.nombre} required />
      </div>
      <div className="campo">
        <label htmlFor="fundamento">Por qué: qué necesidad atiende</label>
        <textarea id="fundamento" name="fundamento" rows={4} defaultValue={p.fundamento ?? ""} />
      </div>
      <div className="campo">
        <label htmlFor="objetivos">Para qué: qué se quiere conseguir</label>
        <textarea id="objetivos" name="objetivos" rows={3} defaultValue={p.objetivos ?? ""} />
        <span className="ayuda">Un objetivo por línea.</span>
      </div>
      <div className="fila-campos">
        <Select id="responsable_id" etiqueta="Responsable" nombre="responsable_id" opciones={listas.personas} valor={p.responsable_id ?? yoId} vacio="Sin definir" />
        <Select id="mesa_id" etiqueta="Mesa" nombre="mesa_id" opciones={listas.mesas} valor={p.mesa_id} vacio="Sin mesa" />
        <Select id="linea_id" etiqueta="Línea de trabajo" nombre="linea_id" opciones={listas.lineas} valor={p.linea_id} vacio="Sin línea" />
      </div>
      <Identidad valor={p.identidad} />
      <div className="acciones">
        <Enviar>{p.id ? "Guardar cambios" : "Crear propuesta"}</Enviar>
        <Link href={cancelar} className="boton">Cancelar</Link>
      </div>
      {!p.id && <p className="suave chico">Queda como propuesta hasta que se apruebe. El plan de trabajo se arma después, con tareas y actividades.</p>}
    </form>
  );
}

type Actividad = {
  id?: string; nombre?: string; tipo?: string; descripcion?: string | null; proyecto_id?: string | null; linea_id?: string | null;
  mesa_id?: string | null; responsable_id?: string | null; fecha?: string | null; hora?: string | null; lugar?: string | null; identidad?: string;
};

export function FormActividad({ accion, a = {}, listas, yoId, cancelar }: { accion: (fd: FormData) => Promise<void>; a?: Actividad; listas: Listas; yoId: string; cancelar: string }) {
  return (
    <form action={accion} className="tarjeta formulario">
      {a.id && <input type="hidden" name="id" value={a.id} />}
      <div className="campo">
        <label htmlFor="nombre">Nombre de la actividad</label>
        <input id="nombre" name="nombre" type="text" defaultValue={a.nombre} required />
      </div>
      <div className="campo">
        <span className="etiqueta" id="tipo-l">Tipo</span>
        <div className="opciones" role="radiogroup" aria-labelledby="tipo-l">
          {Object.entries(TIPO_ACTIVIDAD).map(([k, v]) => (
            <label key={k}>
              <input type="radio" name="tipo" value={k} defaultChecked={(a.tipo ?? "charla") === k} /> {v}
            </label>
          ))}
        </div>
      </div>
      <div className="fila-campos">
        <div className="campo"><label htmlFor="fecha">Fecha</label><input id="fecha" name="fecha" type="date" defaultValue={a.fecha ?? ""} /></div>
        <div className="campo"><label htmlFor="hora">Hora</label><input id="hora" name="hora" type="text" placeholder="19 h" defaultValue={a.hora ?? ""} /></div>
        <div className="campo"><label htmlFor="lugar">Lugar o plataforma</label><input id="lugar" name="lugar" type="text" placeholder="Zoom, aula, institución…" defaultValue={a.lugar ?? ""} /></div>
      </div>
      <div className="campo">
        <label htmlFor="descripcion">De qué se trata</label>
        <textarea id="descripcion" name="descripcion" rows={3} defaultValue={a.descripcion ?? ""} />
      </div>
      <div className="fila-campos">
        <Select id="responsable_id" etiqueta="Responsable" nombre="responsable_id" opciones={listas.personas} valor={a.responsable_id ?? yoId} vacio="Sin definir" />
        <Select id="proyecto_id" etiqueta="Proyecto" nombre="proyecto_id" opciones={listas.proyectos} valor={a.proyecto_id} vacio="Actividad suelta" />
        <Select id="mesa_id" etiqueta="Mesa" nombre="mesa_id" opciones={listas.mesas} valor={a.mesa_id} vacio="Sin mesa" />
        <Select id="linea_id" etiqueta="Línea de trabajo" nombre="linea_id" opciones={listas.lineas} valor={a.linea_id} vacio="Sin línea" />
      </div>
      <Identidad valor={a.identidad} />
      {!a.id && (
        <label className="check">
          <input type="checkbox" name="plantilla" value="si" defaultChecked /> Cargar las tareas sugeridas (charla o visita). Después se pueden borrar o cambiar.
        </label>
      )}
      <div className="acciones">
        <Enviar>{a.id ? "Guardar cambios" : "Crear actividad"}</Enviar>
        <Link href={cancelar} className="boton">Cancelar</Link>
      </div>
      {!a.id && <p className="suave chico">Si es parte de un proyecto aprobado y sos de esa mesa, queda aprobada. Si no, queda como propuesta.</p>}
    </form>
  );
}
