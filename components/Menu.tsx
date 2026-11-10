"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconoCalendario, IconoCandado, IconoComision, IconoDocumento, IconoEnlace, IconoInicio, IconoMas, IconoPersonas, IconoReloj, IconoReunion, IconoTilde } from "./Iconos";

type Props = {
  nombre: string;
  rol: string;
  esCoord: boolean;
  esResponsable: boolean;
  esColumna: boolean;
  llevaAsistencia: boolean;
  pendientesAprobacion: number;
  salir: () => Promise<void>;
};

export function Menu({ nombre, rol, esCoord, esResponsable, esColumna, llevaAsistencia, pendientesAprobacion, salir }: Props) {
  const ruta = usePathname();
  const activo = (base: string) => (base === "/" ? ruta === "/" : ruta.startsWith(base)) ? "page" : undefined;

  return (
    <aside className="menu" aria-label="Menú">
      <div className="menu-marca">
        <strong>Actividades Académicas</strong>
        <span>Derecho · UBA</span>
      </div>
      <Link href="/cargar" className="menu-cargar">
        <IconoMas size={18} />
        Cargar idea o tarea
      </Link>
      <nav aria-label="Secciones">
        <Link href="/" aria-current={activo("/")}>
          <IconoInicio size={19} /> Inicio
        </Link>
        <Link href="/calendario" aria-current={activo("/calendario")}>
          <IconoCalendario size={19} /> Calendario
        </Link>
        <Link href="/comision" aria-current={activo("/comision") ?? activo("/proyectos") ?? activo("/actividades")}>
          <IconoComision size={19} /> Comisión
        </Link>
        <Link href="/reuniones" aria-current={activo("/reuniones")}>
          <IconoReunion size={19} /> Reuniones
        </Link>
        {llevaAsistencia && (
          <Link href="/columna" aria-current={activo("/columna")}>
            <IconoTilde size={19} /> Columna
          </Link>
        )}
        <Link href="/herramientas" aria-current={activo("/herramientas")}>
          <IconoEnlace size={19} /> Herramientas
        </Link>
        {!esColumna && (
          <Link href="/actualizacion" aria-current={activo("/actualizacion")}>
            <IconoReloj size={19} /> Mi actualización
          </Link>
        )}
        {esCoord && (
          <Link href="/coordinacion" aria-current={activo("/coordinacion")}>
            <IconoCandado size={19} /> Coordinación
          </Link>
        )}
        {esCoord && (
          <Link href="/ddo" aria-current={activo("/ddo")}>
            <IconoDocumento size={19} /> DDO
          </Link>
        )}
        {esResponsable && (
          <Link href="/integrantes" aria-current={activo("/integrantes")}>
            <IconoPersonas size={19} /> Integrantes
            {pendientesAprobacion > 0 && <span className="contador" aria-label={`${pendientesAprobacion} por aprobar`}>{pendientesAprobacion}</span>}
          </Link>
        )}
      </nav>
      <div className="menu-yo">
        <strong>{nombre}</strong>
        <span>{rol}</span>
        <form action={salir}>
          <button type="submit">Salir</button>
        </form>
      </div>
    </aside>
  );
}
