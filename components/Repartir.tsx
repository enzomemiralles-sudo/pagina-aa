"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { crearReparto } from "@/app/(app)/acciones";
import { leerPegado, opcionParecida, repartir, type Contacto } from "@/lib/contactos";

type Persona = { id: string; nombre: string };
type Act = { id: string; nombre: string; titulo: string; mensajes: { titulo: string; texto: string }[] };

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export function Repartir({
  actividades,
  grilla,
  nomina,
  hoy,
  actividadInicial,
}: {
  actividades: Act[];
  grilla: Record<number, { titulares: Persona[]; suplentes: Persona[] }>;
  nomina: Persona[];
  hoy: string;
  actividadInicial?: string | null;
}) {
  const router = useRouter();
  const [actId, setActId] = useState(actividadInicial && actividades.some((a) => a.id === actividadInicial) ? actividadInicial : actividades[0]?.id ?? "");
  const act = actividades.find((a) => a.id === actId);
  const [fecha, setFecha] = useState(hoy);
  const [msjIdx, setMsjIdx] = useState(0);
  const [mensaje, setMensaje] = useState(act?.mensajes[0]?.texto ?? "");
  const [pegado, setPegado] = useState("");
  const [opcion, setOpcion] = useState<string | null>(null);
  const [asignados, setAsignados] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [enviando, empezar] = useTransition();

  const dow = new Date(`${fecha}T12:00:00`).getDay();
  const delDia = grilla[dow] ?? { titulares: [], suplentes: [] };

  const leido = useMemo(() => (pegado.trim() ? leerPegado(pegado) : null), [pegado]);
  const opciones = leido && !("error" in leido) ? leido.opciones : [];
  const sugerida = act ? opcionParecida(opciones.map((o) => o.texto), act.titulo) : null;
  const opcionUsada = opcion ?? sugerida;
  const filtrados = leido && !("error" in leido) ? (opciones.length ? leido.contactos.filter((c) => opcionUsada && c.actividades.includes(opcionUsada)) : leido.contactos) : [];

  const personas = delDia.titulares.length || 1;
  const bloques: Contacto[][] = useMemo(() => {
    const numerados = filtrados.map((c, i) => ({ n: i + 1, nombre: c.nombre, tel: c.tel }));
    return repartir(numerados, personas, 30);
  }, [filtrados, personas]);
  const porDefecto = (i: number) => [...delDia.titulares, ...delDia.suplentes][i]?.id ?? "";
  const asignado = (i: number) => (i in asignados ? asignados[i] : porDefecto(i));

  const cambiarActividad = (id: string) => {
    setActId(id);
    setOpcion(null);
    const a = actividades.find((x) => x.id === id);
    setMsjIdx(0);
    setMensaje(a?.mensajes[0]?.texto ?? "");
  };

  const confirmar = () => {
    setError(null);
    empezar(async () => {
      const r = await crearReparto({
        actividadId: act?.id ?? null,
        titulo: opcionUsada ?? act?.titulo ?? "Actividad",
        fechaContacto: fecha,
        mensaje,
        bloques: bloques.map((b, i) => ({ nominaId: asignado(i) || null, contactos: b })),
      });
      if (r.error) setError(r.error);
      else if (r.id) router.push(`/contactos/r/${r.id}`);
    });
  };

  if (!actividades.length) return <p className="suave">No hay actividades próximas cargadas. Creá la actividad primero.</p>;

  return (
    <div className="formulario">
      <div className="fila-campos">
        <div className="campo">
          <label htmlFor="rep-act">Actividad</label>
          <select id="rep-act" value={actId} onChange={(e) => cambiarActividad(e.target.value)}>
            {actividades.map((a) => <option key={a.id} value={a.id}>{a.titulo}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="rep-fecha">Día en que se contacta</label>
          <input id="rep-fecha" type="date" value={fecha} onChange={(e) => { setFecha(e.target.value); setAsignados({}); }} />
          <span className="ayuda">
            Le toca a {delDia.titulares.length ? delDia.titulares.map((p) => p.nombre).join(", ") : "nadie (cargá la grilla)"}
            {delDia.suplentes.length ? `. Suplente: ${delDia.suplentes.map((p) => p.nombre).join(", ")}` : ""} ({DIAS[dow]}).
          </span>
        </div>
      </div>

      {act && act.mensajes.length > 0 && (
        <div className="campo">
          <label htmlFor="rep-msj">Mensaje que van a mandar ({"{nombre}"} se completa con cada inscripto, {"{yo}"} con quien escribe)</label>
          {act.mensajes.length > 1 && (
            <select value={msjIdx} onChange={(e) => { const i = Number(e.target.value); setMsjIdx(i); setMensaje(act.mensajes[i].texto); }} aria-label="Elegir mensaje modelo">
              {act.mensajes.map((m, i) => <option key={i} value={i}>{m.titulo}</option>)}
            </select>
          )}
          <textarea id="rep-msj" rows={7} value={mensaje} onChange={(e) => setMensaje(e.target.value)} />
          {/\[falta/.test(mensaje) && <span className="ayuda texto-ambar">Falta un link en la actividad (Zoom o grupo). Cargalo en la actividad o escribilo acá.</span>}
        </div>
      )}

      <div className="campo">
        <label htmlFor="rep-pegado">Pegá las filas de la planilla</label>
        <textarea
          id="rep-pegado"
          rows={6}
          value={pegado}
          onChange={(e) => { setPegado(e.target.value); setOpcion(null); }}
          placeholder="En la planilla, seleccioná las últimas filas (con la fila de títulos si podés), copiá y pegá acá. No importa si sobran filas de otras actividades: se filtran solas."
          style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}
        />
        <span className="ayuda">Solo se guardan nombre y teléfono de cada inscripto, y se borran solos 7 días después del día de contacto.</span>
      </div>

      {leido && "error" in leido && <p className="aviso rojo">{leido.error}</p>}

      {leido && !("error" in leido) && (
        <>
          <p className="chico">
            Leí <strong>{leido.filas}</strong> filas: <strong>{leido.contactos.length}</strong> personas
            {leido.repetidos ? ` (${leido.repetidos} ${leido.repetidos === 1 ? "repetida" : "repetidas"})` : ""}{leido.sinTelefono ? `, ${leido.sinTelefono} sin teléfono válido` : ""}.
            <span className="suave"> Columnas: {leido.encontradas.nombre} · {leido.encontradas.telefono}{leido.encontradas.actividad ? ` · ${leido.encontradas.actividad}` : ""}</span>
          </p>
          {opciones.length > 0 && (
            <div className="campo">
              <label htmlFor="rep-opcion">Actividad en la planilla</label>
              <select id="rep-opcion" value={opcionUsada ?? ""} onChange={(e) => setOpcion(e.target.value || null)}>
                <option value="">Elegí la actividad…</option>
                {opciones.map((o) => <option key={o.texto} value={o.texto}>{o.cantidad} · {o.texto}</option>)}
              </select>
              {!opcionUsada && <span className="ayuda texto-ambar">No encontré “{act?.titulo}” en lo pegado. Elegila de la lista.</span>}
            </div>
          )}

          {filtrados.length > 0 && (
            <div className="formulario" style={{ gap: 10 }}>
              <h3>{filtrados.length} contactos en {bloques.length} {bloques.length === 1 ? "bloque" : "bloques"}</h3>
              {filtrados.length > 30 * Math.max(delDia.titulares.length, 1) && (
                <p className="chico texto-ambar">Hay más de 30 por persona: sumé bloques para el suplente o para asignar a mano.</p>
              )}
              <div className="grilla" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                {bloques.map((b, i) => (
                  <div key={i} className="tarjeta" style={{ gap: 8, padding: 14 }}>
                    <strong>B{i + 1} · {b.length} contactos</strong>
                    <label className="oculto" htmlFor={`asig-${i}`}>Quién manda el bloque {i + 1}</label>
                    <select id={`asig-${i}`} value={asignado(i)} onChange={(e) => setAsignados({ ...asignados, [i]: e.target.value })} style={{ minHeight: 36 }}>
                      <option value="">Sin asignar</option>
                      {nomina.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                    <details>
                      <summary className="chico">Ver lista</summary>
                      <ol className="chico" style={{ margin: "6px 0 0", paddingLeft: 20 }} start={b[0]?.n}>
                        {b.map((c) => <li key={c.n}>{c.nombre}</li>)}
                      </ol>
                    </details>
                  </div>
                ))}
              </div>
              {error && <p className="aviso rojo">{error}</p>}
              <div className="acciones">
                <button type="button" className="boton primario" onClick={confirmar} disabled={enviando}>
                  {enviando ? "Repartiendo…" : "Repartir y crear las tareas"}
                </button>
                <span className="suave chico">A cada uno con cuenta le aparece la tarea con su lista; a vos, la de seguimiento.</span>
              </div>
            </div>
          )}
          {filtrados.length === 0 && opcionUsada && <p className="suave">No hay inscriptos de esa actividad en lo pegado.</p>}
        </>
      )}
    </div>
  );
}
