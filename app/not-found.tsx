import Link from "next/link";

export default function NoEncontrado() {
  return (
    <div className="pantalla-sola">
      <div className="caja-login">
        <h1>No encontramos esa página</h1>
        <p>Puede que se haya borrado o que el enlace esté mal.</p>
        <Link href="/" className="boton primario">Ir al inicio</Link>
      </div>
    </div>
  );
}
