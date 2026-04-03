type RecentSelectionStore = Record<string, string[]>;

const STORAGE_KEY = "progress:recent-selections:v1";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function normalizeId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function sanitizeIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    const id = normalizeId(item);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function readStore(): RecentSelectionStore {
  if (!canUseStorage()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const result: RecentSelectionStore = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof key !== "string" || !key.trim()) continue;
      result[key] = sanitizeIds(value);
    }
    return result;
  } catch {
    return {};
  }
}

function writeStore(store: RecentSelectionStore): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage quota / privacy mode failures.
  }
}

export function readRecentSelections(scope: string): string[] {
  const key = scope.trim();
  if (!key) return [];
  const store = readStore();
  return sanitizeIds(store[key]);
}

export function rememberRecentSelection(
  scope: string,
  id: string,
  maxItems = 12
): string[] {
  const key = scope.trim();
  const normalizedId = normalizeId(id);
  if (!key || !normalizedId) return [];

  const cappedMax = Math.max(1, Math.min(50, Math.floor(maxItems || 12)));
  const store = readStore();
  const current = sanitizeIds(store[key]);
  const next = [normalizedId, ...current.filter((value) => value !== normalizedId)].slice(
    0,
    cappedMax
  );
  store[key] = next;
  writeStore(store);
  return next;
}

export function clearRecentSelections(scope?: string): void {
  if (!scope) {
    writeStore({});
    return;
  }
  const key = scope.trim();
  if (!key) return;
  const store = readStore();
  delete store[key];
  writeStore(store);
}

export function sortByRecentSelection<T>(
  items: T[],
  getId: (item: T) => string,
  recentIds: string[],
  fallbackCompare?: (a: T, b: T) => number
): T[] {
  const rank = new Map<string, number>();
  recentIds.forEach((id, index) => {
    if (!rank.has(id)) rank.set(id, index);
  });

  return [...items]
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const idA = getId(a.item);
      const idB = getId(b.item);
      const rankA = rank.has(idA) ? (rank.get(idA) as number) : Number.MAX_SAFE_INTEGER;
      const rankB = rank.has(idB) ? (rank.get(idB) as number) : Number.MAX_SAFE_INTEGER;

      if (rankA !== rankB) return rankA - rankB;
      if (fallbackCompare) {
        const compared = fallbackCompare(a.item, b.item);
        if (compared !== 0) return compared;
      }
      return a.index - b.index;
    })
    .map((entry) => entry.item);
}
