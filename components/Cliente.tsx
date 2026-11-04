"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { IconoCopiar } from "./Iconos";

/** Botón de envío que se deshabilita mientras guarda. */
export function Enviar({
  children,
  className = "boton primario",
  pendiente = "Guardando…",
  ...resto
}: { children: React.ReactNode; className?: string; pendiente?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} {...resto}>
      {pending ? pendiente : children}
    </button>
  );
}

/** Copia un texto al portapapeles (para pegar en WhatsApp). */
export function Copiar({ texto, children, className = "boton" }: { texto: string; children: React.ReactNode; className?: string }) {
  const [hecho, setHecho] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setHecho(true);
          setTimeout(() => setHecho(false), 2000);
        } catch {
          window.prompt("Copiá el texto:", texto);
        }
      }}
    >
      <IconoCopiar size={16} />
      {hecho ? "Copiado" : children}
    </button>
  );
}

/** Pide confirmación antes de enviar un formulario destructivo. */
export function Confirmar({ mensaje, children, className = "boton peligro chico" }: { mensaje: string; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(mensaje)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
