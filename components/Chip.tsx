import type { Color } from "@/lib/etiquetas";

export function Chip({ color, children }: { color: Color; children: React.ReactNode }) {
  return <span className={`chip ${color}`}>{children}</span>;
}

export function ChipDe({ mapa, valor }: { mapa: Record<string, { texto: string; color: Color }>; valor: string }) {
  const e = mapa[valor] ?? { texto: valor, color: "gris" as Color };
  return <span className={`chip ${e.color}`}>{e.texto}</span>;
}
