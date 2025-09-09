// src/utils/number.ts

// parsea con coma/punto y asegura número
export function parseLocaleFloat(s: string): number {
  if (!s) return 0;
  const v = s.replace(",", ".");
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

// fija a 2 decimales SIN sorpresas visuales
export function to2(n: number): number {
  return Math.round(n * 100) / 100;
}

// muestra siempre 2 decimales (para inputs solo-lectura o textos)
export function show2(n: number | string): string {
  const num = typeof n === "string" ? parseLocaleFloat(n) : n || 0;
  return to2(num).toFixed(2);
}
