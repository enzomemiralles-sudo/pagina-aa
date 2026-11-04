import Link from "next/link";
import { Enviar } from "@/components/Cliente";
import { ingresar, registrarse } from "./acciones";

export default async function Login({ searchParams }: { searchParams: Promise<{ modo?: string; error?: string }> }) {
  const { modo, error } = await searchParams;
  const registro = modo === "registro";

  return (
    <div className="pantalla-sola">
      <div className="caja-login">
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <p className="suave chico">Comisión de Actividades Académicas</p>
          <h1>{registro ? "Crear cuenta" : "Ingresar"}</h1>
        </div>

        <div className="segmentado" role="group" aria-label="Elegí una opción">
          <Link href="/login" aria-current={!registro ? "page" : undefined}>Ingresar</Link>
          <Link href="/login?modo=registro" aria-current={registro ? "page" : undefined}>Crear cuenta</Link>
        </div>

        {error && (
          <p className={`aviso ${error.startsWith("Cuenta creada") ? "verde" : "rojo"}`} role="alert">
            {error}
          </p>
        )}

        <form action={registro ? registrarse : ingresar} className="formulario">
          {registro && (
            <div className="campo">
              <label htmlFor="nombre">Nombre y apellido</label>
              <input id="nombre" name="nombre" type="text" autoComplete="name" required />
            </div>
          )}
          <div className="campo">
            <label htmlFor="email">Mail</label>
            <input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="campo">
            <label htmlFor="password">Contraseña</label>
            <input id="password" name="password" type="password" autoComplete={registro ? "new-password" : "current-password"} minLength={registro ? 8 : undefined} required />
            {registro && <span className="ayuda">Al menos 8 caracteres.</span>}
          </div>
          <Enviar className="boton primario ancho" pendiente={registro ? "Creando…" : "Entrando…"}>
            {registro ? "Crear cuenta" : "Ingresar"}
          </Enviar>
        </form>

        {registro && (
          <p className="suave chico">Tu cuenta queda pendiente hasta que la persona responsable de la comisión la apruebe.</p>
        )}
      </div>
    </div>
  );
}
