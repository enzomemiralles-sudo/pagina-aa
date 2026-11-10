"use client";

import { useState } from "react";
import { COLUMNAS_SUGERIDAS, ESTADOS_PLANILLA, formulaLugar, formulaWhatsapp, type Columnas } from "@/lib/mensajes";
import { Copiar } from "./Cliente";

/** Arma las fórmulas para la planilla de inscriptos: link de WhatsApp con el mensaje de cada persona y cupo / espera. */
export function Planilla({ mensajes, cupo }: { mensajes: { titulo: string; texto: string }[]; cupo: number }) {
  const [cols, setCols] = useState<Columnas>(COLUMNAS_SUGERIDAS);
  const [sep, setSep] = useState<";" | ",">(";");
  const [elegido, setElegido] = useState(0);
  const msj = mensajes[elegido];
  const campo = (k: keyof Columnas, etiqueta: string) => (
    <div className="campo" style={{ minWidth: 0 }}>
      <label htmlFor={`col-${k}`}>{etiqueta}</label>
      <input
        id={`col-${k}`}
        type="text"
        value={cols[k]}
        maxLength={2}
        onChange={(e) => setCols({ ...cols, [k]: e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase() })}
        style={{ textTransform: "uppercase" }}
      />
    </div>
  );

  return (
    <div className="formulario">
      <ol className="pasos">
        <li>Las respuestas del Form van a una planilla. Al lado de las columnas del Form agregá: <strong>Compañero que escribe</strong>, <strong>Mensaje</strong>, <strong>Estado</strong> y <strong>Lugar</strong>.</li>
        <li>Indicá en qué columna quedó cada cosa (si usaste las preguntas sugeridas, ya está bien).</li>
        <li>Copiá la fórmula, pegala en la fila 2 de la columna <strong>Mensaje</strong> y arrastrala hacia abajo. Cada fila queda con un link “Escribir” que abre WhatsApp con el mensaje y el nombre puestos.</li>
        <li>En <strong>Estado</strong> poné una lista desplegable (Datos → Validación de datos) con: {ESTADOS_PLANILLA.join(", ")}.</li>
        <li>La columna <strong>Lugar</strong> dice “Cupo” o “Espera”. Si alguien cancela, el primero en espera pasa a “Cupo” solo: escribile con el mensaje “Se liberó un lugar”.</li>
      </ol>

      <div className="fila-campos" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}>
        {campo("nombre", "Nombre")}
        {campo("telefono", "WhatsApp")}
        {campo("companero", "Compañero que escribe")}
        {campo("estado", "Estado")}
      </div>

      {mensajes.length > 1 && (
        <div className="campo">
          <label htmlFor="msj-planilla">Mensaje</label>
          <select id="msj-planilla" value={elegido} onChange={(e) => setElegido(Number(e.target.value))}>
            {mensajes.map((m, i) => <option key={i} value={i}>{m.titulo}</option>)}
          </select>
        </div>
      )}

      <div className="opciones" role="radiogroup" aria-label="Separador de la planilla">
        <label><input type="radio" name="sep" checked={sep === ";"} onChange={() => setSep(";")} /> Planilla en español ( ; )</label>
        <label><input type="radio" name="sep" checked={sep === ","} onChange={() => setSep(",")} /> Planilla en inglés ( , )</label>
      </div>

      {msj && (
        <div className="campo">
          <span className="etiqueta">Fórmula para la columna Mensaje (fila 2)</span>
          <code className="formula">{formulaWhatsapp(msj.texto, cols, sep)}</code>
          <Copiar texto={formulaWhatsapp(msj.texto, cols, sep)} className="boton chico">Copiar fórmula</Copiar>
        </div>
      )}
      <div className="campo">
        <span className="etiqueta">Fórmula para la columna Lugar (cupo de {cupo})</span>
        <code className="formula">{formulaLugar(cols, cupo, sep)}</code>
        <Copiar texto={formulaLugar(cols, cupo, sep)} className="boton chico">Copiar fórmula</Copiar>
      </div>
      <p className="suave chico">Si la fórmula da error, probá con el otro separador. El WhatsApp tiene que estar con código de área, sin 0 ni 15 (ej.: 11 2345 6789).</p>
    </div>
  );
}
