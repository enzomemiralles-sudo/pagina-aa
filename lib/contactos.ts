// Contactos de inscriptos: lo que antes hacía la IA, lo hace la página.
// Se lee lo que se copia de la planilla (Sheets copia con tabulaciones), se filtra por actividad,
// se sacan repetidos y se reparte. Solo se queda con nombre y teléfono: DNI y mail no salen del navegador.

export type Contacto = { n: number; nombre: string; tel: string };
export type Leido = {
  contactos: { nombre: string; tel: string; actividades: string[] }[];
  opciones: { texto: string; cantidad: number }[];
  filas: number;
  sinTelefono: number;
  repetidos: number;
  encontradas: { nombre: string; telefono: string; actividad: string | null };
};

/** Teléfono argentino a 10 dígitos (código de área + número, sin 0 ni 15). */
export function normalizarTel(crudo: string): string | null {
  let d = (crudo || "").replace(/\D/g, "");
  if (d.startsWith("549") && d.length === 13) d = d.slice(3);
  else if (d.startsWith("54") && d.length === 12) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  // 11 15 1234 5678 → 11 1234 5678
  if (d.length === 12 && d.slice(2, 4) === "15") d = d.slice(0, 2) + d.slice(4);
  if (d.length === 11 && d.startsWith("15")) return null; // sin código de área: no se puede saber
  if (d.length < 10) return null;
  return d.slice(-10);
}

export function telLindo(t: string): string {
  return t.startsWith("11") ? `${t.slice(0, 2)} ${t.slice(2, 6)}-${t.slice(6)}` : `${t.slice(0, 4)} ${t.slice(4)}`;
}

export function linkWhatsapp(tel: string, texto: string): string {
  return `https://wa.me/549${tel}?text=${encodeURIComponent(texto)}`;
}

function nombrePropio(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/(^|[\s'-])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase());
}

export function primerNombre(nombre: string): string {
  return nombre.split(" ")[0] ?? nombre;
}

/** Separa una celda con varias actividades ("29/10 • 18 HS | A, 3/11 • 18 HS | B"). Los títulos pueden tener comas. */
export function separarActividades(celda: string): string[] {
  return celda
    .split(/,\s*(?=\d{1,2}\/\d{1,2}\s*[•\-–|])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function filasDe(texto: string): string[][] {
  const lineas = texto.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  const conTab = lineas.some((l) => l.includes("\t"));
  if (conTab) return lineas.map((l) => l.split("\t"));
  // CSV simple (por si copian de un .csv)
  return lineas.map((l) => {
    const celdas: string[] = [];
    let actual = "", comillas = false;
    for (let i = 0; i < l.length; i++) {
      const c = l[i];
      if (c === '"') {
        if (comillas && l[i + 1] === '"') { actual += '"'; i++; } else comillas = !comillas;
      } else if (c === "," && !comillas) { celdas.push(actual); actual = ""; }
      else actual += c;
    }
    celdas.push(actual);
    return celdas;
  });
}

const ES_FECHA = /^\d{1,2}\/\d{1,2}\/\d{2,4}/;
const ES_TEXTO = /^[\p{L}][\p{L}'´.\- ]{0,39}$/u;

/** Busca las columnas: por encabezado si lo hay; si no, por el contenido. */
function columnas(filas: string[][]) {
  const enc = filas[0].map((c) => c.trim().toLowerCase());
  const hayEncabezado = enc.some((c) => /whats|celular|tel[eé]fono/.test(c)) && enc.some((c) => /nombre/.test(c));
  if (hayEncabezado) {
    const tel = enc.findIndex((c) => /whats|celular|tel[eé]fono/.test(c));
    const n = enc.findIndex((c) => /nombre/.test(c));
    const ap = enc.findIndex((c, i) => i !== n && (/apellido/.test(c) || (c === "columna 4" && i === n + 1)));
    const actividades = enc.map((c, i) => (/actividad|charla/.test(c) ? i : -1)).filter((i) => i >= 0);
    return { encabezado: true, nombre: ap >= 0 ? [n, ap] : [n], tel, actividad: actividades };
  }
  const muestra = filas.slice(0, 80);
  const ancho = Math.max(...muestra.map((f) => f.length));
  const proporcion = (i: number, prueba: (v: string) => boolean) => {
    const vals = muestra.map((f) => (f[i] ?? "").trim()).filter(Boolean);
    return vals.length ? vals.filter(prueba).length / muestra.length : 0;
  };
  let tel = -1, mejor = 0;
  const actividad: number[] = [];
  const texto: number[] = [];
  for (let i = 0; i < ancho; i++) {
    const p = proporcion(i, (v) => { const d = v.replace(/\D/g, ""); return d.length >= 10 && d.length <= 13 && !/[a-z@]/i.test(v); });
    if (p > mejor && p >= 0.5) { mejor = p; tel = i; }
    if (proporcion(i, (v) => /^\d{1,2}\/\d{1,2}\s*[•\-–|]/.test(v) && /\bhs\b/i.test(v)) >= 0.3) actividad.push(i);
    if (proporcion(i, (v) => ES_TEXTO.test(v) && !ES_FECHA.test(v) && !v.includes("@")) >= 0.6) texto.push(i);
  }
  // Nombre y apellido: las primeras columnas de texto antes del teléfono.
  const antes = texto.filter((i) => tel < 0 || i < tel).slice(0, 2);
  return { encabezado: false, nombre: antes, tel, actividad };
}

/** Lee lo pegado de la planilla. */
export function leerPegado(texto: string): Leido | { error: string } {
  const filas = filasDe(texto);
  if (!filas.length) return { error: "No hay nada pegado." };
  const col = columnas(filas);
  if (col.tel < 0) return { error: "No encontré la columna del WhatsApp. Copiá también la fila de títulos de la planilla." };
  if (!col.nombre.length) return { error: "No encontré la columna del nombre. Copiá también la fila de títulos de la planilla." };
  const datos = col.encabezado ? filas.slice(1) : filas;

  const vistos = new Map<string, { nombre: string; tel: string; actividades: string[] }>();
  let sinTelefono = 0, repetidos = 0;
  for (const f of datos) {
    const tel = normalizarTel(f[col.tel] ?? "");
    const nombre = nombrePropio(col.nombre.map((i) => f[i] ?? "").join(" "));
    if (!tel) { if (nombre) sinTelefono++; continue; }
    const acts = col.actividad.flatMap((i) => separarActividades(f[i] ?? ""));
    const previo = vistos.get(tel);
    if (previo) {
      repetidos++;
      for (const a of acts) if (!previo.actividades.includes(a)) previo.actividades.push(a);
      continue;
    }
    vistos.set(tel, { nombre: nombre || "Sin nombre", tel, actividades: acts });
  }
  const contactos = [...vistos.values()];
  const cuenta = new Map<string, number>();
  for (const c of contactos) for (const a of c.actividades) cuenta.set(a, (cuenta.get(a) ?? 0) + 1);
  // Las más nuevas primero (las filas de abajo de la planilla son las últimas inscripciones).
  const opciones = [...cuenta.entries()].map(([texto, cantidad]) => ({ texto, cantidad })).reverse();
  const enc = filas[0];
  return {
    contactos,
    opciones,
    filas: datos.length,
    sinTelefono,
    repetidos,
    encontradas: {
      nombre: col.nombre.map((i) => (col.encabezado ? enc[i] : `columna ${i + 1}`)).join(" + "),
      telefono: col.encabezado ? enc[col.tel] : `columna ${col.tel + 1}`,
      actividad: col.actividad.length ? col.actividad.map((i) => (col.encabezado ? enc[i] : `columna ${i + 1}`)).join(", ") : null,
    },
  };
}

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** La opción del Form que más se parece al texto de la actividad. */
export function opcionParecida(opciones: string[], buscada: string | null): string | null {
  if (!buscada || !opciones.length) return null;
  const b = sinTildes(buscada);
  return opciones.find((o) => sinTildes(o) === b) ?? opciones.find((o) => sinTildes(o).includes(b) || b.includes(sinTildes(o))) ?? null;
}

/** Reparte en bloques lo más parejos posible, sin pasar de `max` por bloque. */
export function repartir<T>(lista: T[], personas: number, max = 30): T[][] {
  const n = Math.max(personas, Math.ceil(lista.length / max), 1);
  const bloques: T[][] = Array.from({ length: n }, () => []);
  const base = Math.floor(lista.length / n), resto = lista.length % n;
  let i = 0;
  for (let b = 0; b < n; b++) {
    const tam = base + (b < resto ? 1 : 0);
    bloques[b] = lista.slice(i, i + tam);
    i += tam;
  }
  return bloques.filter((b) => b.length);
}

/** "1.- Nombre Apellido - Tel: 11 2345-6789" (como lo mandamos por WhatsApp). */
export function listaWhatsapp(contactos: Contacto[]): string {
  return contactos.map((c) => `${c.n}.- ${c.nombre} - Tel: ${c.tel}`).join("\n");
}

/** Opción para el Form de actividades: "5/11 • 18 HS | CICLO DE CHARLAS: Tecnología, Delitos y Justicia III" */
export function opcionForm(fecha: string | null, hora: string | null, nombre: string): string {
  const dia = fecha ? `${Number(fecha.slice(8))}/${Number(fecha.slice(5, 7))}` : "D/M";
  const h = (hora ?? "").replace(/\s*(hs?|horas?)\.?$/i, "").trim() || "HH";
  return `${dia} • ${h} HS | ${nombre}`;
}

export const DIAS_GRILLA: [number, string][] = [[1, "LUNES"], [2, "MARTES"], [3, "MIÉRCOLES"], [4, "JUEVES"], [5, "VIERNES"], [6, "SÁBADO"], [0, "DOMINGO"]];

/** Texto de la grilla como circula: "📋 GRILLA DE MENSAJES – NEXO 💚 …" */
export function textoGrilla(grilla: Record<number, { titulares: string[]; suplentes: string[] }>): string {
  const partes = ["📋 GRILLA DE MENSAJES – NEXO 💚"];
  for (const [d, nombre] of DIAS_GRILLA) {
    const g = grilla[d];
    if (!g || (!g.titulares.length && !g.suplentes.length)) continue;
    partes.push("", `📅 ${nombre}`, ...g.titulares.map((t) => `* ${t}`));
    if (g.suplentes.length) partes.push(`🔄 Suplente: ${g.suplentes.join(", ")}`);
  }
  return partes.join("\n");
}
