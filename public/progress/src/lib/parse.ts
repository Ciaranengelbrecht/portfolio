// Helper to parse optional numeric inputs where blank -> null
export function parseOptionalNumber(raw: string): number | null {
  if (raw == null) return null;
  const v = raw.trim().replace(',', '.');
  if (v === '') return null;
  // Disallow trailing solitary decimal point -> treat as null until completed
  if (/^[+-]?\d+\.$/.test(v)) return null;
  if (!/^[-+]?\d*(?:\.\d+)?$/.test(v)) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

export function formatOptionalNumber(v: number | null | undefined): string {
  if (v == null) return '';
  return String(v);
}
