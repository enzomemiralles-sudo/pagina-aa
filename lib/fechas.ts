// Fechas en hora de Buenos Aires. Las fechas "de calendario" se guardan como 'YYYY-MM-DD'.
const ZONA = "America/Argentina/Buenos_Aires";
const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DIAS_LARGOS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function partesBA(fecha: Date) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(fecha);
  const v = (t: string) => f.find((p) => p.type === t)?.value ?? "00";
  return {
    ymd: `${v("year")}-${v("month")}-${v("day")}`,
    hora: Number(v("hour")) % 24,
    minuto: Number(v("minute")),
  };
}

export function hoyBA(): string {
  return partesBA(new Date()).ymd;
}

export function ahoraBA() {
  return partesBA(new Date());
}

function aUTC(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function sumarDias(ymd: string, dias: number): string {
  const f = aUTC(ymd);
  f.setUTCDate(f.getUTCDate() + dias);
  return f.toISOString().slice(0, 10);
}

export function diaSemana(ymd: string): number {
  return aUTC(ymd).getUTCDay();
}

/** "Jue 5/11" */
export function fechaCorta(ymd: string | null | undefined): string {
  if (!ymd) return "—";
  const f = aUTC(ymd);
  return `${DIAS[f.getUTCDay()]} ${f.getUTCDate()}/${f.getUTCMonth() + 1}`;
}

/** "miércoles 25/11" (como lo escribimos en los mensajes) */
export function fechaDia(ymd: string | null | undefined): string {
  if (!ymd) return "";
  const f = aUTC(ymd);
  return `${DIAS_LARGOS[f.getUTCDay()]} ${f.getUTCDate()}/${f.getUTCMonth() + 1}`;
}

/** "Miércoles 11/11" (encabezado de día en un DDO) */
export function fechaDdo(ymd: string): string {
  const t = fechaDia(ymd);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Lunes de la semana (lunes a domingo) de una fecha. */
export function lunesDe(ymd: string): string {
  return sumarDias(ymd, -((diaSemana(ymd) + 6) % 7));
}

/** "noviembre 2026" */
export function mesTitulo(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MESES[m - 1]} ${y}`;
}

export const NOMBRES_DIAS = DIAS_LARGOS;

/** "miércoles 4 de noviembre" */
export function fechaLarga(ymd: string): string {
  const f = aUTC(ymd);
  return `${DIAS_LARGOS[f.getUTCDay()]} ${f.getUTCDate()} de ${MESES[f.getUTCMonth()]}`;
}

/** Fecha de hoy para el encabezado: "Martes 3 de noviembre" */
export function hoyTitulo(): string {
  const t = fechaLarga(hoyBA());
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Texto y urgencia de un vencimiento */
export function vencimiento(ymd: string | null | undefined): { texto: string; nivel: "vencida" | "hoy" | "normal" | "sin" } {
  if (!ymd) return { texto: "Sin fecha", nivel: "sin" };
  const hoy = hoyBA();
  if (ymd < hoy) {
    const ayer = sumarDias(hoy, -1);
    return { texto: ymd === ayer ? "Vencida · ayer" : `Vencida · ${fechaCorta(ymd)}`, nivel: "vencida" };
  }
  if (ymd === hoy) return { texto: "Hoy", nivel: "hoy" };
  if (ymd === sumarDias(hoy, 1)) return { texto: "Mañana", nivel: "normal" };
  return { texto: fechaCorta(ymd), nivel: "normal" };
}

/**
 * La semana de trabajo termina en la reunión de los miércoles.
 * La clave de la semana es la fecha del próximo miércoles (hoy, si es miércoles).
 */
export function semanaActual(): string {
  const hoy = hoyBA();
  const dow = diaSemana(hoy);
  return sumarDias(hoy, (3 - dow + 7) % 7);
}

/** Estado de la actualización semanal: cierra el martes a las 22 h anterior a la reunión. */
export function estadoCierre(): "abierta" | "cierra_hoy" | "cerrada" {
  const semana = semanaActual();
  const martes = sumarDias(semana, -1);
  const { ymd, hora } = ahoraBA();
  if (ymd < martes) return "abierta";
  if (ymd === martes) return hora < 22 ? "cierra_hoy" : "cerrada";
  return "cerrada";
}

export function haceCuanto(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 60) return min <= 1 ? "Recién" : `Hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `Hace ${h} h`;
  const d = Math.round(h / 24);
  if (d === 1) return "Ayer";
  if (d < 7) return `Hace ${d} días`;
  return fechaCorta(partesBA(new Date(iso)).ymd);
}
