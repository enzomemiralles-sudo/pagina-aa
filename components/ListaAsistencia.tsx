"use client";

import { useOptimistic, useState, useTransition } from "react";
import { marcarAsistencia } from "@/app/(app)/acciones";
import { RESPUESTA, LLEGADA } from "@/lib/etiquetas";
import { fechaCorta } from "@/lib/fechas";

export type FilaAsistencia = {
  nominaId: string;
  nombre: string;
  tieneCuenta: boolean;
  respuesta: string;
  motivo: string;
  insistir: boolean;
  llegada: string;
  historial: { fecha: string; marca: "a_horario" | "tarde" | "no_vino" | "aviso" | "sin" }[];
};

const MARCA: Record<FilaAsistencia["historial"][number]["marca"], { texto: string; corto: string; color: string }> = {
  a_horario: { texto: "Vino a horario", corto: "✓", color: "verde" },
  tarde: { texto: "Llegó tarde", corto: "T", color: "ambar" },
  no_vino: { texto: "No vino", corto: "✗", color: "rojo" },
  aviso: { texto: "Avisó que no venía", corto: "A", color: "gris" },
  sin: { texto: "Sin dato", corto: "–", color: "gris" },
};

const FILTROS = [
  { clave: "todos", texto: "Todos" },
  { clave: "sin_respuesta", texto: "Sin respuesta" },
  { clave: "viene", texto: "Vienen" },
  { clave: "no", texto: "No vienen o no saben" },
  { clave: "insistir", texto: "Insistir" },
] as const;

export function ListaAsistencia({ reunionId, filas: iniciales }: { reunionId: string; filas: FilaAsistencia[] }) {
  // Lo marcado se ve al instante; al guardar, la página trae los datos de la base (incluso lo que marcó otra persona).
  const [filas, aplicar] = useOptimistic(iniciales, (fs: FilaAsistencia[], c: { nominaId: string; cambios: Partial<FilaAsistencia> }) =>
    fs.map((f) => (f.nominaId === c.nominaId ? { ...f, ...c.cambios } : f)),
  );
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["clave"]>("todos");
  const [error, setError] = useState<string | null>(null);
  const [, empezar] = useTransition();

  const cambiar = (nominaId: string, cambios: Partial<Pick<FilaAsistencia, "respuesta" | "motivo" | "insistir" | "llegada">>) => {
    empezar(async () => {
      aplicar({ nominaId, cambios });
      const r = await marcarAsistencia(reunionId, nominaId, cambios);
      setError(r.error);
    });
  };

  const visibles = filas.filter((f) =>
    filtro === "todos"
      ? true
      : filtro === "insistir"
        ? f.insistir
        : filtro === "no"
          ? f.respuesta === "no_viene" || f.respuesta === "no_sabe"
          : f.respuesta === filtro,
  );
  const cuenta = (clave: string) =>
    clave === "todos" ? filas.length : clave === "insistir" ? filas.filter((f) => f.insistir).length : clave === "no" ? filas.filter((f) => f.respuesta === "no_viene" || f.respuesta === "no_sabe").length : filas.filter((f) => f.respuesta === clave).length;

  return (
    <>
      <div className="filtros" style={{ padding: "0 18px 14px" }} role="group" aria-label="Filtrar la lista">
        {FILTROS.map((f) => (
          <button
            key={f.clave}
            type="button"
            className="filtro"
            aria-pressed={filtro === f.clave}
            onClick={() => setFiltro(f.clave)}
          >
            {f.texto} · {cuenta(f.clave)}
          </button>
        ))}
      </div>
      {error && <p className="aviso rojo" style={{ margin: "0 18px 12px" }}>{error}</p>}
      <div className="tabla-caja">
        <table className="tabla tabla-asistencia">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>¿Viene?</th>
              <th>Motivo</th>
              <th>Insistir</th>
              <th>El día</th>
              <th className="ocultar-movil">Últimas</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((f) => (
              <tr key={f.nominaId} className={f.insistir ? "fila-insistir" : undefined}>
                <td className="nombre">
                  {f.nombre}
                  {!f.tieneCuenta && <span className="suave chico" style={{ display: "block", fontWeight: 400 }}>sin cuenta</span>}
                </td>
                <td>
                  <div className="botonera" role="group" aria-label={`¿${f.nombre} viene?`}>
                    {(["viene", "no_sabe", "no_viene"] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        className={`opcion ${RESPUESTA[r].color}`}
                        aria-pressed={f.respuesta === r}
                        onClick={() => cambiar(f.nominaId, { respuesta: f.respuesta === r ? "sin_respuesta" : r })}
                      >
                        {r === "viene" ? "✓ Viene" : RESPUESTA[r].texto}
                      </button>
                    ))}
                  </div>
                </td>
                <td>
                  <label className="oculto" htmlFor={`mot-${f.nominaId}`}>Motivo de {f.nombre}</label>
                  <input
                    id={`mot-${f.nominaId}`}
                    type="text"
                    defaultValue={f.motivo}
                    placeholder={f.respuesta === "no_viene" || f.respuesta === "no_sabe" ? "¿Por qué?" : ""}
                    onBlur={(e) => {
                      if (e.target.value.trim() !== f.motivo) cambiar(f.nominaId, { motivo: e.target.value.trim() });
                    }}
                    style={{ minHeight: 36, minWidth: 140 }}
                  />
                </td>
                <td>
                  <label className="check" style={{ minHeight: 36 }}>
                    <input type="checkbox" checked={f.insistir} onChange={(e) => cambiar(f.nominaId, { insistir: e.target.checked })} />
                    <span className="oculto">Insistirle a {f.nombre}</span>
                    <span aria-hidden="true" className="chico">Sí</span>
                  </label>
                </td>
                <td>
                  <label className="oculto" htmlFor={`lle-${f.nominaId}`}>Cómo llegó {f.nombre}</label>
                  <select
                    id={`lle-${f.nominaId}`}
                    value={f.llegada}
                    onChange={(e) => cambiar(f.nominaId, { llegada: e.target.value })}
                    className={f.llegada ? `select-${LLEGADA[f.llegada]?.color}` : undefined}
                    style={{ minHeight: 36, width: "auto" }}
                  >
                    <option value="">—</option>
                    <option value="a_horario">A horario</option>
                    <option value="tarde">Tarde</option>
                    <option value="no_vino">No vino</option>
                  </select>
                </td>
                <td className="ocultar-movil">
                  <span className="historial">
                    {f.historial.map((h) => (
                      <span key={h.fecha} className={`chip ${MARCA[h.marca].color}`} title={`${fechaCorta(h.fecha)}: ${MARCA[h.marca].texto}`}>
                        <span aria-hidden="true">{MARCA[h.marca].corto}</span>
                        <span className="oculto">{fechaCorta(h.fecha)}: {MARCA[h.marca].texto}</span>
                      </span>
                    ))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {visibles.length === 0 && <p className="vacio">Nadie en este filtro.</p>}
    </>
  );
}
