// Sitni pomoćnici za prikaz u React otocima. Novac i datumi su u ./format.ts (S3).

/** Odbrojavanje u gumbu: 3552 → „59:12”, 3600 → „60:00” (bez sati; prozor 429 je 60 min). */
export function mmss(sekunde: number): string {
  const s = Math.max(0, Math.ceil(sekunde));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
