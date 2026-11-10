import Link from "next/link";
import { requerirAsistencia } from "@/lib/sesion";
import { personasActivas } from "@/lib/datos";
import { fechaDia, fechaLarga, hoyBA, semanaActual } from "@/lib/fechas";
import { completar } from "@/lib/mensajes";
import { Copiar, Enviar } from "@/components/Cliente";
import { ListaAsistencia, type FilaAsistencia } from "@/components/ListaAsistencia";
import { agregarANomina, crearReunionSemana, editarNomina, guardarLogistica, sumarIntegrantesANomina } from "../acciones";

const COLUMNA_URL = "https://columna-nexojup.web.app/";

type Nomina = { id: string; nombre: string; integrante_id: string | null; activo: boolean };
type Asis = { reunion_id: string; nomina_id: string; respuesta: string; motivo: string | null; insistir: boolean; llegada: string | null };

export default async function Columna({ searchParams }: { searchParams: Promise<{ reunion?: string }> }) {
  const { reunion: pedida } = await searchParams;
  const { supabase, yo } = await requerirAsistencia();
  const hoy = hoyBA();

  const consultaReunion = pedida
    ? supabase.from("reuniones").select("id, fecha, hora, estado").eq("id", pedida).maybeSingle()
    : supabase.from("reuniones").select("id, fecha, hora, estado").gte("fecha", hoy).order("fecha").limit(1).maybeSingle();

  const [{ data: reunion }, nominaR, personas, mensajesR, anterioresR] = await Promise.all([
    consultaReunion,
    supabase.from("nomina").select("id, nombre, integrante_id, activo").order("nombre"),
    personasActivas(supabase),
    supabase.from("mensajes_modelo").select("titulo, texto").eq("para", "reunion").order("orden"),
    supabase.from("reuniones").select("id, fecha").lt("fecha", hoy).order("fecha", { ascending: false }).limit(6),
  ]);

  const nomina = (nominaR.data ?? []) as Nomina[];
  const activos = nomina.filter((n) => n.activo);
  const vinculados = new Set(nomina.map((n) => n.integrante_id).filter(Boolean));
  const sinLista = personas.filter((p) => !vinculados.has(p.id) && p.rol !== "columna");
  const anteriores = (anterioresR.data ?? []) as { id: string; fecha: string }[];
  const mensajes = (mensajesR.data ?? []) as { titulo: string; texto: string }[];

  const encabezado = (
    <div className="encabezado">
      <div>
        <p className="suave">Columna</p>
        <h1>Asistencia a la reunión</h1>
        <p className="suave">Quién viene, quién no y por qué, a quién hay que insistirle y cómo llegó cada uno.</p>
      </div>
      <div className="acciones">
        <a href={COLUMNA_URL} target="_blank" rel="noreferrer" className="boton">Página de Columna ↗</a>
      </div>
    </div>
  );

  if (!reunion) {
    return (
      <>
        {encabezado}
        <section className="tarjeta">
          <h2>No hay una próxima reunión cargada</h2>
          <p className="suave">La creo para el {fechaLarga(semanaActual())} a las 18:30 y arrancás a relevar.</p>
          <form action={crearReunionSemana}>
            <Enviar>Crear la reunión del miércoles</Enviar>
          </form>
        </section>
      </>
    );
  }

  // Asistencia de esta reunión y de las 4 anteriores (para ver la constancia de cada uno).
  const previas = anteriores.filter((r) => r.fecha < reunion.fecha).slice(0, 4).reverse();
  const ids = [reunion.id, ...previas.map((r) => r.id)];
  const [{ data: asisData }, { data: logistica }] = await Promise.all([
    supabase.from("asistencias").select("reunion_id, nomina_id, respuesta, motivo, insistir, llegada").in("reunion_id", ids),
    supabase.from("reunion_logistica").select("aula, busca_aula_id, nota").eq("reunion_id", reunion.id).maybeSingle(),
  ]);
  const asis = (asisData ?? []) as Asis[];
  const de = (rid: string, nid: string) => asis.find((a) => a.reunion_id === rid && a.nomina_id === nid);

  const filas: FilaAsistencia[] = activos.map((n) => {
    const a = de(reunion.id, n.id);
    return {
      nominaId: n.id,
      nombre: n.nombre,
      tieneCuenta: !!n.integrante_id,
      respuesta: a?.respuesta ?? "sin_respuesta",
      motivo: a?.motivo ?? "",
      insistir: a?.insistir ?? false,
      llegada: a?.llegada ?? "",
      historial: previas.map((r) => {
        const p = de(r.id, n.id);
        const marca = p?.llegada ? (p.llegada as "a_horario" | "tarde" | "no_vino") : p?.respuesta === "no_viene" ? "aviso" : "sin";
        return { fecha: r.fecha, marca };
      }),
    };
  });

  const cuenta = (r: string) => filas.filter((f) => f.respuesta === r).length;
  const insistir = filas.filter((f) => f.insistir);
  const datos = { dia: fechaDia(reunion.fecha), hora: reunion.hora, aula: logistica?.aula ?? null };
  const convocatoria = mensajes.find((m) => /convocatoria/i.test(m.titulo)) ?? mensajes[0];
  const insistencia = mensajes.find((m) => /insistir/i.test(m.titulo));
  const busca = nomina.find((n) => n.id === logistica?.busca_aula_id);
  const esHoy = reunion.fecha === hoy;

  return (
    <>
      {encabezado}

      <div className="aviso gris" role="status">
        <span>
          <strong>Reunión del {fechaLarga(reunion.fecha)} · {reunion.hora}</strong>
          {esHoy && " · es hoy"}
        </span>
        <span className="acciones" style={{ marginLeft: "auto" }}>
          <span className="chip verde">{cuenta("viene")} {cuenta("viene") === 1 ? "viene" : "vienen"}</span>
          <span className="chip ambar">{cuenta("no_sabe")} no {cuenta("no_sabe") === 1 ? "sabe" : "saben"}</span>
          <span className="chip rojo">{cuenta("no_viene")} no {cuenta("no_viene") === 1 ? "viene" : "vienen"}</span>
          <span className="chip gris">{cuenta("sin_respuesta")} sin respuesta</span>
        </span>
      </div>

      <section className="tarjeta sin-relleno" aria-labelledby="lista-t">
          <div className="tarjeta-cabecera">
            <h2 id="lista-t">Quiénes vienen</h2>
            <span className="suave chico">Se guarda al tocar. “El día” se completa en la reunión.</span>
          </div>
          {filas.length ? (
            <ListaAsistencia reunionId={reunion.id} filas={filas} />
          ) : (
            <p className="vacio">Todavía no hay nombres en la lista. Cargalos abajo, en “Lista de compañeros”.</p>
          )}
      </section>

      <div className="grilla">
          <section className="tarjeta" aria-labelledby="dia-t">
            <h2 id="dia-t">El miércoles</h2>
            <ol className="linea-tiempo">
              <li><strong>18:00</strong> <span>{busca ? <>{busca.nombre} busca aula</> : <>Alguien busca aula <span className="chip ambar">Falta definir quién</span></>}</span></li>
              <li><strong>18:15</strong> <span>Todos en la puerta del aula{logistica?.aula ? ` ${logistica.aula}` : ""}</span></li>
              <li><strong>18:30</strong> <span>Adentro, arrancamos</span></li>
              <li><strong>18:35</strong> <span>Arranca sí o sí</span></li>
            </ol>
            <form action={guardarLogistica} className="formulario">
              <input type="hidden" name="reunion_id" value={reunion.id} />
              <div className="fila-campos">
                <div className="campo">
                  <label htmlFor="busca">Quién busca aula</label>
                  <select id="busca" name="busca_aula_id" defaultValue={logistica?.busca_aula_id ?? ""}>
                    <option value="">Sin definir</option>
                    {activos.map((n) => <option key={n.id} value={n.id}>{n.nombre}</option>)}
                  </select>
                </div>
                <div className="campo">
                  <label htmlFor="aula">Aula</label>
                  <input id="aula" name="aula" type="text" defaultValue={logistica?.aula ?? ""} placeholder="Ej.: 210" />
                </div>
              </div>
              <div className="campo">
                <label htmlFor="nota">Nota</label>
                <input id="nota" name="nota" type="text" defaultValue={logistica?.nota ?? ""} placeholder="Algo para tener en cuenta" />
              </div>
              <Enviar className="boton primario chico">Guardar</Enviar>
            </form>
          </section>

          {convocatoria && (
            <section className="tarjeta" aria-labelledby="conv-t">
              <h2 id="conv-t">Mensaje para el grupo</h2>
              <p className="texto-largo chico mensaje">{completar(convocatoria.texto, datos)}</p>
              <Copiar texto={completar(convocatoria.texto, datos)}>Copiar para WhatsApp</Copiar>
            </section>
          )}

          <section className="tarjeta" aria-labelledby="ins-t">
            <h2 id="ins-t">Para insistir</h2>
            {insistir.length ? (
              <ul className="lista">
                {insistir.map((f) => (
                  <li key={f.nominaId}>
                    <span className="cuerpo">
                      <strong>{f.nombre}</strong>
                      {f.motivo && <span className="suave chico">{f.motivo}</span>}
                    </span>
                    {insistencia && <Copiar texto={completar(insistencia.texto, { ...datos, nombre: f.nombre.split(" ")[0] })} className="boton chico">Mensaje</Copiar>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="suave chico">Marcá “Insistir” en la lista y acá aparece cada uno con su mensaje listo.</p>
            )}
          </section>
      </div>

      <section className="tarjeta" aria-labelledby="nom-t">
        <details>
          <summary id="nom-t">Lista de compañeros · {activos.length}</summary>
          <div className="formulario" style={{ paddingTop: 12 }}>
            <form action={agregarANomina} className="formulario">
              <div className="campo">
                <label htmlFor="nombres">Sumar nombres (uno por línea o separados por coma)</label>
                <textarea id="nombres" name="nombres" rows={3} placeholder={"Caro\nJuli\nTomi"} />
                <span className="ayuda">No hace falta que tengan cuenta en la página. Si después se registran, se vinculan acá abajo.</span>
              </div>
              <Enviar className="boton primario chico">Sumar a la lista</Enviar>
            </form>

            {sinLista.length > 0 && yo.llevaAsistencia && (
              <form action={sumarIntegrantesANomina} className="aviso ambar">
                <span>Tienen cuenta y no están en la lista: <strong>{sinLista.map((p) => p.nombre).join(", ")}</strong>.</span>
                {sinLista.map((p) => <input key={p.id} type="hidden" name="integrante_id" value={p.id} />)}
                <Enviar className="boton chico" pendiente="…">Sumarlos</Enviar>
              </form>
            )}

            <div className="tabla-caja">
              <table className="tabla">
                <thead><tr><th>Nombre</th><th>Cuenta en la página</th><th><span className="oculto">Acciones</span></th></tr></thead>
                <tbody>
                  {nomina.map((n) => (
                    <tr key={n.id} style={n.activo ? undefined : { opacity: 0.6 }}>
                      <td>
                        <form action={editarNomina} style={{ display: "flex", gap: 6 }}>
                          <input type="hidden" name="id" value={n.id} />
                          <label className="oculto" htmlFor={`n-${n.id}`}>Nombre</label>
                          <input id={`n-${n.id}`} name="nombre" type="text" defaultValue={n.nombre} style={{ minHeight: 34 }} />
                          <Enviar className="boton chico" pendiente="…">Guardar</Enviar>
                        </form>
                      </td>
                      <td>
                        <form action={editarNomina} style={{ display: "flex", gap: 6 }}>
                          <input type="hidden" name="id" value={n.id} />
                          <label className="oculto" htmlFor={`c-${n.id}`}>Cuenta de {n.nombre}</label>
                          <select id={`c-${n.id}`} name="integrante_id" defaultValue={n.integrante_id ?? ""} style={{ minHeight: 34, width: "auto" }}>
                            <option value="">Sin cuenta</option>
                            {personas.filter((p) => p.id === n.integrante_id || !vinculados.has(p.id)).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                          </select>
                          <Enviar className="boton chico" pendiente="…">Vincular</Enviar>
                        </form>
                      </td>
                      <td className="nowrap">
                        <form action={editarNomina} className="en-linea">
                          <input type="hidden" name="id" value={n.id} />
                          <input type="hidden" name="activo" value={n.activo ? "no" : "si"} />
                          <Enviar className="boton chico" pendiente="…">{n.activo ? "Sacar de la lista" : "Volver a sumar"}</Enviar>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      </section>

      {anteriores.length > 0 && (
        <nav className="tarjeta" aria-labelledby="ant-t">
          <h2 id="ant-t">Otras reuniones</h2>
          <div className="filtros">
            {pedida && <Link href="/columna">La próxima</Link>}
            {anteriores.map((r) => (
              <Link key={r.id} href={`/columna?reunion=${r.id}`} aria-current={r.id === reunion.id ? "true" : undefined}>
                {fechaDia(r.fecha)}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </>
  );
}
