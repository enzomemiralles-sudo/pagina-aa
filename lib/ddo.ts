// DDO (lo que cada comisión hace en la semana): se pega el texto tal como circula por WhatsApp
// y la página lo ordena por día. Lo de Comunicación ("COMU:") se separa.
import { diaSemana, fechaDdo, sumarDias } from "./fechas";

export type ItemDdo = { texto: string; comu: boolean };
export type DiaDdo = { fecha: string; titulo: string; items: ItemDdo[]; aviso?: string };
export type DdoLeido = {
  comision: string;
  objetivos: string[];
  dias: DiaDdo[];
  otras: { titulo: string; items: ItemDdo[] }[];
};

const INVISIBLES = /[\u2060\u200b\u200c\u200d\u200e\u200f\ufeff\u00ad]/g;
const DIAS: Record<string, number> = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
const VIÑETA = /^[-*•·–]\s*/;

function sinTildes(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function limpiar(l: string) {
  return l.replace(INVISIBLES, "").replace(/\s+$/, "").trim();
}

/** "DDO - SUMABLES 🫂" → "Sumables"; "DDO CGT 🥸" → "CGT"; "DDO – Actividades Académicas⚖️💙" → "Actividades Académicas" */
export function nombreComision(encabezado: string): string {
  let s = encabezado.replace(/^\s*ddo\b/i, "");
  s = s.replace(/[\p{Extended_Pictographic}\u2600-\u27bf\ufe0f\u200d]/gu, "");
  s = s.replace(/^[\s\-–—:·]+/, "").replace(/[\s:\-–—]+$/, "").trim();
  if (!s) return "Sin nombre";
  return s
    .split(/\s+/)
    .map((p) => (p.length <= 4 && p === p.toUpperCase() ? p : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()))
    .join(" ");
}

/** Separa un texto con varios DDO pegados juntos (cada uno empieza con una línea "DDO …"). */
export function separarDdos(texto: string): { comision: string; texto: string }[] {
  const lineas = texto.replace(/\r/g, "").split("\n");
  const bloques: { comision: string; lineas: string[] }[] = [];
  for (const cruda of lineas) {
    const l = limpiar(cruda);
    if (/^ddo\b/i.test(l)) {
      bloques.push({ comision: nombreComision(l), lineas: [cruda] });
    } else if (bloques.length) {
      bloques[bloques.length - 1].lineas.push(cruda);
    } else if (l) {
      bloques.push({ comision: "Sin nombre", lineas: [cruda] });
    }
  }
  return bloques.map((b) => ({ comision: b.comision, texto: b.lineas.join("\n").trim() }));
}

function cercanoConDia(base: string, dow: number): string {
  // La fecha con ese día de la semana más cercana a `base` (±3 días).
  for (const d of [0, -1, 1, -2, 2, -3, 3]) {
    const f = sumarDias(base, d);
    if (diaSemana(f) === dow) return f;
  }
  return base;
}

const UN_DIA = 86400000;
function ymd(y: number, m: number, d: number): string | null {
  const f = new Date(Date.UTC(y, m - 1, d));
  if (f.getUTCMonth() !== m - 1) return null; // 31/11, etc.
  return f.toISOString().slice(0, 10);
}
const distancia = (a: string, b: string) => Math.abs(new Date(a).getTime() - new Date(b).getTime()) / UN_DIA;

function resolverFecha(dow: number, dia: number | null, mes: number | null, ref: string): { fecha: string; aviso?: string } {
  if (dia) {
    const [ry, rm] = ref.split("-").map(Number);
    const m = mes ?? rm;
    const cerca = (lista: (string | null)[]) =>
      lista.filter((x): x is string => !!x).sort((a, b) => distancia(a, ref) - distancia(b, ref))[0];
    // Año más cercano a la fecha de carga (por diciembre/enero).
    const escrita = cerca([ry - 1, ry, ry + 1].map((y) => ymd(y, m, dia)));
    const textoEscrito = `${dia}/${m}`;
    if (escrita && diaSemana(escrita) === dow && distancia(escrita, ref) <= 21) return { fecha: escrita };
    // Mes mal puesto ("Viernes 13/12" en noviembre): probar ese número en el mes de la carga o los vecinos.
    const mismoNumero = cerca(
      [-1, 0, 1].map((k) => {
        const total = ry * 12 + (rm - 1) + k;
        return ymd(Math.floor(total / 12), (total % 12) + 1, dia);
      }),
    );
    if (mismoNumero && diaSemana(mismoNumero) === dow && (!escrita || distancia(mismoNumero, ref) < distancia(escrita, ref))) {
      return { fecha: mismoNumero, aviso: `Dice ${textoEscrito}; lo tomé como ${fechaDdo(mismoNumero).toLowerCase()}.` };
    }
    if (escrita && distancia(escrita, ref) <= 21) {
      const fecha = cercanoConDia(escrita, dow);
      const realmente = fechaDdo(escrita).split(" ")[0].toLowerCase();
      return { fecha, aviso: `Dice ${textoEscrito}, pero ese día es ${realmente}. Lo puse el ${fechaDdo(fecha).toLowerCase()}.` };
    }
  }
  return { fecha: cercanoConDia(ref, dow) };
}

/** Lee un DDO. `ref` es la fecha en que se cargó (para ubicar los días sin fecha). */
export function leerDdo(texto: string, ref: string, comision?: string): DdoLeido {
  const r: DdoLeido = { comision: comision ?? "Sin nombre", objetivos: [], dias: [], otras: [] };
  type Seccion = { tipo: "obj" } | { tipo: "dia"; dia: DiaDdo } | { tipo: "otra"; i: number } | null;
  let sec: Seccion = null;
  let comu = false;

  for (const cruda of texto.replace(/\r/g, "").split("\n")) {
    const l = limpiar(cruda);
    if (!l) continue;
    if (/^ddo\b/i.test(l)) {
      if (!comision) r.comision = nombreComision(l);
      continue;
    }
    if (/^[-—–_=.\s]{5,}$/.test(l)) continue;

    const plano = sinTildes(l).toLowerCase();
    const tieneViñeta = VIÑETA.test(l);

    if (!tieneViñeta && /^objetivos\b/.test(plano)) {
      sec = { tipo: "obj" };
      comu = false;
      continue;
    }

    const md = !tieneViñeta && plano.match(/^(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b[\s,]*(\d{1,2})?(?:\s*\/\s*(\d{1,2}))?/);
    if (md) {
      const { fecha, aviso } = resolverFecha(DIAS[md[1]], md[2] ? Number(md[2]) : null, md[3] ? Number(md[3]) : null, ref);
      let dia = r.dias.find((d) => d.fecha === fecha);
      if (!dia) {
        dia = { fecha, titulo: l.replace(/:$/, ""), items: [], aviso };
        r.dias.push(dia);
      }
      // Lo que viene en la misma línea después del día ("Sábado 07/11 Marcha del orgullo") es un ítem.
      const resto = l.slice(md[0].length).replace(/^[\s:\-–]+/, "").trim();
      if (resto) dia.items.push({ texto: resto, comu: false });
      sec = { tipo: "dia", dia };
      comu = false;
      continue;
    }

    if (!tieneViñeta && /^comu(nicacion)?\s*:?$/.test(plano)) {
      comu = true;
      continue;
    }

    const esTitulo = !tieneViñeta && (/:$/.test(l) || (l === l.toUpperCase() && /[A-ZÁÉÍÓÚÑ]{3}/.test(l) && !/\d/.test(l)));
    if (esTitulo) {
      r.otras.push({ titulo: l.replace(/:$/, ""), items: [] });
      sec = { tipo: "otra", i: r.otras.length - 1 };
      comu = false;
      continue;
    }

    const item = { texto: l.replace(VIÑETA, "").trim(), comu };
    if (!item.texto) continue;
    if (sec?.tipo === "obj") r.objetivos.push(item.texto);
    else if (sec?.tipo === "dia") sec.dia.items.push(item);
    else if (sec?.tipo === "otra") r.otras[sec.i].items.push(item);
    else r.objetivos.push(item.texto);
  }

  r.dias.sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  return r;
}

/** "18:30" → "18.30 hs"; "18" → "18 hs"; deja como está lo que ya dice "h". */
export function horaDdo(hora: string | null | undefined): string {
  if (!hora) return "";
  const h = hora.trim();
  if (/h/i.test(h)) return h;
  return `${h.replace(":", ".")} hs`;
}

/** Arma el texto del DDO de AA con el formato que circula. */
export function armarDdoAA(objetivos: string[], dias: { fecha: string; items: string[] }[]): string {
  const partes = ["DDO – Actividades Académicas⚖️💙", ""];
  if (objetivos.length) {
    partes.push("Objetivos semanales:", ...objetivos.map((o) => `- ${o}`), "");
  }
  for (const d of dias) {
    if (!d.items.length) continue;
    partes.push(fechaDdo(d.fecha), ...d.items.map((i) => `- ${i}`), "");
  }
  return partes.join("\n").trim();
}
