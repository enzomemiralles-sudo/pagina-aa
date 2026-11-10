"use client";

import { useState } from "react";
import { armarDdoAA } from "@/lib/ddo";
import { guardarDdoAA } from "@/app/(app)/acciones";
import { Copiar, Enviar } from "./Cliente";

/** Arma el DDO de AA con lo cargado en la página; los objetivos se escriben a mano. */
export function DdoAA({ dias, objetivosIniciales }: { dias: { fecha: string; items: string[] }[]; objetivosIniciales: string[] }) {
  const [objetivos, setObjetivos] = useState(objetivosIniciales.join("\n"));
  const texto = armarDdoAA(
    objetivos.split("\n").map((o) => o.replace(/^[-*•]\s*/, "").trim()).filter(Boolean),
    dias,
  );
  return (
    <div className="columnas">
      <div className="col-lateral formulario">
        <div className="campo">
          <label htmlFor="obj-aa">Objetivos de la semana (uno por línea)</label>
          <textarea id="obj-aa" rows={5} value={objetivos} onChange={(e) => setObjetivos(e.target.value)} placeholder="Planificar 2027" />
          <span className="ayuda">Los días salen solos de las tareas con fecha, las actividades y las reuniones de esta semana.</span>
        </div>
      </div>
      <div className="col-principal formulario" style={{ gap: 10 }}>
        <p className="texto-largo chico mensaje">{texto}</p>
        <form action={guardarDdoAA} className="acciones">
          <input type="hidden" name="texto" value={texto} />
          <Copiar texto={texto} className="boton primario chico">Copiar para WhatsApp</Copiar>
          <Enviar className="boton chico" pendiente="…">Guardar en la semana</Enviar>
        </form>
      </div>
    </div>
  );
}
