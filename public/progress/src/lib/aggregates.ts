import { getAllCached } from "./dataCache";

// Version for sessionStorage persistence; bump when aggregate schema changes
// Incremented to 3 to align with updated weekly set weighting and worker VERSION.
const AGG_VERSION = 3;
const KEY = "pp_aggregates_v" + AGG_VERSION;

export interface AggregatesBundle {
  weeklyVolume: Record<string, Record<string, number>>; // key P{phase}-W{week}
  exercisePRs: Record<
    string,
    { bestScore: number; est1RM: number; sessionId?: string; dateISO?: string }
  >;
  weeklyPRCounts: Record<string, number>; // key P#-W# -> count of new PRs that week
  lastComputed: number;
  version: number;
  inputSignature?: string;
}

let inFlight: Promise<AggregatesBundle> | null = null;
let scheduledRefresh: number | null = null;

export function getCachedAggregates(): AggregatesBundle | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== AGG_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

function persist(bundle: AggregatesBundle) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(bundle));
  } catch {}
}

function latestRowStamp(row: any): number {
  if (!row || typeof row !== "object") return 0;
  const candidates = [
    row.updatedAt,
    row.loggedEndAt,
    row.loggedStartAt,
    row.completedAt,
    row.createdAt,
    row.dateISO,
    row.localDate,
  ];
  for (const raw of candidates) {
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string") {
      const parsed = Date.parse(raw);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
}

function hashText(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function buildAggregateInputSignature(input: {
  sessions?: any[];
  exercises?: any[];
  measurements?: any[];
}) {
  const parts = (["sessions", "exercises", "measurements"] as const).map(
    (store) => {
      const rows = Array.isArray(input[store]) ? input[store]! : [];
      let latest = 0;
      let fallbackHash = 0;
      for (const row of rows) {
        const stamp = latestRowStamp(row);
        latest = Math.max(latest, stamp);
        if (!stamp) {
          fallbackHash = (fallbackHash + hashText(JSON.stringify(row))) >>> 0;
        }
      }
      return `${store}:${rows.length}:${latest}:${fallbackHash}`;
    }
  );
  return parts.join("|");
}

export async function computeAggregates(
  force?: boolean
): Promise<AggregatesBundle> {
  if (!force) {
    const cached = getCachedAggregates();
    if (cached) return cached;
  }
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const [sessions, exercises, measurements] = await Promise.all([
      getAllCached("sessions", { swr: true }),
      getAllCached("exercises", { swr: true }),
      getAllCached("measurements", { swr: true }),
    ]);
    const inputSignature = buildAggregateInputSignature({
      sessions,
      exercises,
      measurements,
    });
    const cached = getCachedAggregates();
    if (cached?.inputSignature === inputSignature) {
      return cached;
    }
    return new Promise<AggregatesBundle>((resolve, reject) => {
      try {
        const worker = new Worker(
          new URL("../workers/aggregateWorker.ts", import.meta.url),
          { type: "module" }
        );
        worker.onmessage = (evt) => {
          const data = evt.data || {};
          if (data.error) {
            console.warn("[aggregates] worker error", data.error);
            worker.terminate();
            reject(new Error(data.error));
            return;
          }
          const bundle: AggregatesBundle = {
            weeklyVolume: data.weeklyVolume || {},
            exercisePRs: data.exercisePRs || {},
            weeklyPRCounts: data.weeklyPRCounts || {},
            lastComputed: data.lastComputed || Date.now(),
            version: data.version || AGG_VERSION,
            inputSignature,
          };
          persist(bundle);
          // Broadcast so hooks/components can refresh immediately
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("aggregates-updated", {
                detail: { source: "worker", at: Date.now() },
              })
            );
          }
          worker.terminate();
          resolve(bundle);
        };
        worker.postMessage({ sessions, exercises, measurements });
      } catch (err) {
        reject(err as any);
      }
    });
  })();
  try {
    const r = await inFlight;
    return r;
  } finally {
    inFlight = null;
  }
}

// Convenience accessors
export async function getExercisePR(exerciseId: string) {
  const agg = await computeAggregates();
  return agg.exercisePRs[exerciseId];
}
export async function getWeeklyVolume() {
  const agg = await computeAggregates();
  return agg.weeklyVolume;
}

export function scheduleAggregatesRefresh(delayMs = 300) {
  if (typeof window === "undefined") {
    computeAggregates(true).catch(() => {});
    return;
  }
  if (scheduledRefresh != null) {
    window.clearTimeout(scheduledRefresh);
  }
  scheduledRefresh = window.setTimeout(() => {
    scheduledRefresh = null;
    computeAggregates(true).catch(() => {});
  }, delayMs);
}

// Invalidate on realtime changes
if (typeof window !== "undefined") {
  window.addEventListener("sb-change", (e: any) => {
    const tbl = e?.detail?.table;
    if (["sessions", "exercises", "measurements"].includes(tbl)) {
      scheduleAggregatesRefresh();
    }
  });
}
