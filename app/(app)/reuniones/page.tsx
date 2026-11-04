import Link from "next/link";
import { requerirMiembro } from "@/lib/sesion";
import { nombreDe, personasActivas } from "@/lib/datos";
import { ESTADO_REUNION } from "@/lib/etiquetas";
import { fechaLarga, semanaActual } from "@/lib/fechas";
import { ChipDe } from "@/components/Chip";
import { Enviar } from "@/components/Cliente";
import { crearReunion } from "../acciones";

export default async function Reuniones() {
  const { supabase, yo } = await requerirMiembro();
  const [reuniones, personas] = await Promise.all([
    supabase.from("reuniones").select("id, fecha, hora, estado, acta_por, reunion_temas(id)").order("fecha", { ascending: false }).limit(60),
    personasActivas(supabase),
  ]);
  const lista = reuniones.data ?? [];
  const abiertas = lista.filter((r) => r.estado !== "cerrada").reverse();
  const cerradas = lista.filter((r) => r.estado === "cerrada");

  const fila = (r: (typeof lista)[number]) => (
    <tr key={r.id}>
      <td><Link href={`/reuniones/${r.id}`} className="nombre">{fechaLarga(r.fecha).replace(/^./, (c) => c.toUpperCase())}</Link></td>
      <td className="suave">{r.hora}</td>
      <td>{(r.reunion_temas ?? []).length}</td>
      <td>{r.acta_por ? nombreDe(personas, r.acta_por) : <span className="suave">Sin definir</span>}</td>
      <td><ChipDe mapa={ESTADO_REUNION} valor={r.estado} /></td>
    </tr>
  );

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Reuniones</h1>
          <p className="suave">Punteo, acta, decisiones y tareas de cada miércoles.</p>
        </div>
      </div>

      {yo.esCoord && (
        <form action={crearReunion} className="tarjeta" style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", gap: 12 }}>
          <div className="campo" style={{ minWidth: 180 }}>
            <label htmlFor="fecha">Nueva reunión</label>
            <input id="fecha" name="fecha" type="date" defaultValue={semanaActual()} required />
          </div>
          <div className="campo" style={{ width: 110 }}>
            <label htmlFor="hora">Hora</label>
            <input id="hora" name="hora" type="text" defaultValue="18:30" />
          </div>
          <Enviar>Crear</Enviar>
        </form>
      )}

      <section className="tarjeta sin-relleno" aria-labelledby="prox-t">
        <div className="tarjeta-cabecera"><h2 id="prox-t">Próximas y en curso</h2></div>
        {abiertas.length ? (
          <div className="tabla-caja">
            <table className="tabla">
              <thead><tr><th>Fecha</th><th>Hora</th><th>Temas</th><th>Toma el acta</th><th>Estado</th></tr></thead>
              <tbody>{abiertas.map(fila)}</tbody>
            </table>
          </div>
        ) : (
          <p className="vacio">No hay reuniones próximas cargadas.</p>
        )}
      </section>

      <section className="tarjeta sin-relleno" aria-labelledby="actas-t">
        <div className="tarjeta-cabecera"><h2 id="actas-t">Actas publicadas</h2></div>
        {cerradas.length ? (
          <div className="tabla-caja">
            <table className="tabla">
              <thead><tr><th>Fecha</th><th>Hora</th><th>Temas</th><th>Tomó el acta</th><th>Estado</th></tr></thead>
              <tbody>{cerradas.map(fila)}</tbody>
            </table>
          </div>
        ) : (
          <p className="vacio">Todavía no hay actas.</p>
        )}
      </section>
    </>
  );
}
