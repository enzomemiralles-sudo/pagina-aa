// Mensajes modelo: se completan con los datos de la actividad o la reunión.
// WhatsApp sigue siendo el canal: la página arma el texto y la planilla arma el link de cada persona.

export type DatosMensaje = Partial<Record<Variable, string | null>>;

export const VARIABLES = {
  nombre: "Nombre de la persona a la que le escribís (lo completa la planilla)",
  yo: "Quien escribe (en la planilla: la columna del compañero asignado)",
  actividad: "Nombre de la actividad",
  dia: "Día y fecha: miércoles 25/11",
  hora: "Hora de la actividad",
  lugar: "Lugar o dirección",
  zoom: "Link de Zoom de la actividad",
  grupo: "Link al grupo de WhatsApp de la actividad",
  encuesta: "Link a la encuesta posterior",
  inscripcion: "Link al Form de inscripción",
  aula: "Aula de la reunión",
} as const;
export type Variable = keyof typeof VARIABLES;

const FALTA: Partial<Record<Variable, string>> = {
  zoom: "[falta el link de Zoom]",
  grupo: "[falta el link del grupo]",
  encuesta: "[falta el link de la encuesta]",
  inscripcion: "[falta el link de inscripción]",
  lugar: "[falta el lugar]",
  hora: "[falta la hora]",
  dia: "[falta la fecha]",
  aula: "(avisamos cuál)",
};

/** Variables que el texto usa y que no tienen dato (sin contar nombre y yo, que dependen de a quién le escribís). */
export function faltantes(texto: string, d: DatosMensaje): Variable[] {
  const usadas = [...texto.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((v): v is Variable => v in VARIABLES);
  return [...new Set(usadas)].filter((v) => v !== "nombre" && v !== "yo" && v !== "aula" && !d[v]);
}

/**
 * Completa las variables. Si no hay nombre, lo saca sin dejar el hueco ("Buenas {nombre}," → "Buenas,").
 * Lo que falta queda marcado entre corchetes para que se vea antes de mandarlo.
 */
export function completar(texto: string, d: DatosMensaje): string {
  let t = texto;
  if (!d.nombre) t = t.replace(/ \{nombre\}/g, "").replace(/\{nombre\}/g, "");
  return t.replace(/\{(\w+)\}/g, (todo, v: string) => {
    if (!(v in VARIABLES)) return todo;
    const valor = d[v as Variable];
    if (valor) return valor;
    return FALTA[v as Variable] ?? todo;
  });
}

// ---------- Planilla de Google: fórmula que arma el link de WhatsApp de cada inscripto ----------
export type Columnas = { nombre: string; telefono: string; companero: string; estado: string };
export const COLUMNAS_SUGERIDAS: Columnas = { nombre: "B", telefono: "C", companero: "H", estado: "J" };

function literal(s: string): string {
  // Comillas dobladas y saltos de línea como CHAR(10).
  return s
    .split("\n")
    .map((linea) => `"${linea.replace(/"/g, '""')}"`)
    .join("&CHAR(10)&");
}

/**
 * Fórmula para la fila 2 (se arrastra hacia abajo). `texto` ya viene completado con los datos de la actividad,
 * pero conserva {nombre} y {yo}. `sep` es ";" en planillas en español y "," en inglés.
 */
export function formulaWhatsapp(texto: string, c: Columnas, sep: ";" | ","): string {
  const L = (x: string) => x.trim().toUpperCase() || "B";
  const nombre = `PROPER(REGEXEXTRACT(TRIM(TO_TEXT(${L(c.nombre)}2))${sep}"^\\S+"))`;
  const yo = `${L(c.companero)}2`;
  const partes = texto.split(/(\{nombre\}|\{yo\})/);
  const expr = partes
    .filter((p) => p !== "")
    .map((p) => (p === "{nombre}" ? nombre : p === "{yo}" ? yo : literal(p)))
    .join("&");
  const tel = `RIGHT(REGEXREPLACE(TO_TEXT(${L(c.telefono)}2)${sep}"[^0-9]"${sep}"")${sep}10)`;
  return `=IF(${L(c.telefono)}2=""${sep}""${sep}HYPERLINK("https://wa.me/549"&${tel}&"?text="&ENCODEURL(${expr})${sep}"Escribir"))`;
}

/** Columna "Lugar": Cupo o Espera según el orden de inscripción, sin contar a quienes cancelaron. */
export function formulaLugar(c: Columnas, cupo: number, sep: ";" | ","): string {
  const e = c.estado.trim().toUpperCase() || "J";
  const n = c.nombre.trim().toUpperCase() || "B";
  return `=IF(${n}2=""${sep}""${sep}IF(${e}2="Canceló"${sep}"—"${sep}IF(COUNTIF(${e}$2:${e}2${sep}"<>Canceló")<=${cupo}${sep}"Cupo"${sep}"Espera")))`;
}

export const ESTADOS_PLANILLA = ["Sin escribir", "Escrito", "Confirmó", "Canceló", "Asistió", "No vino"];

/** "Visita a la Morgue Judicial" → "visita a la Morgue Judicial", para que entre en "Te confirmo para la {actividad}". */
export function actividadEnFrase(nombre: string): string {
  return /^(visita|charla|jornada|presentaci[oó]n|actividad|taller|encuentro)\b/i.test(nombre) ? nombre.charAt(0).toLowerCase() + nombre.slice(1) : nombre;
}
