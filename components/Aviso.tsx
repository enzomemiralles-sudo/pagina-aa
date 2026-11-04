"use client";

import { useEffect, useState } from "react";

/** Muestra el aviso que dejó una acción (error o confirmación) y lo borra. */
export function Aviso({ texto, tipo }: { texto: string; tipo: "rojo" | "verde" }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    document.cookie = "aviso=; Max-Age=0; path=/";
  }, [texto]);
  if (!visible) return null;
  return (
    <div className={`aviso ${tipo}`} role={tipo === "rojo" ? "alert" : "status"}>
      <span>{texto}</span>
      <button type="button" className="boton chico" onClick={() => setVisible(false)}>
        Cerrar
      </button>
    </div>
  );
}
