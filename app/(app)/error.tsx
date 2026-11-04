"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="tarjeta">
      <h1>Algo salió mal</h1>
      <p>No se pudo cargar esta pantalla. Probá de nuevo; si sigue pasando, avisale a la persona responsable.</p>
      <div className="acciones">
        <button type="button" className="boton primario" onClick={reset}>
          Reintentar
        </button>
        <a className="boton" href="/">
          Ir al inicio
        </a>
      </div>
    </div>
  );
}
