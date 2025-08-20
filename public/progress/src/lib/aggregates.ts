import { getAllCached } from './dataCache';

// Version for sessionStorage persistence; bump when aggregate schema changes
const AGG_VERSION = 1;
const KEY = 'pp_aggregates_v'+AGG_VERSION;

export interface AggregatesBundle {
  weeklyVolume: Record<string, Record<string, number>>;
  exercisePRs: Record<string, { bestScore: number; est1RM: number }>;
  weeklyPRCounts: Record<string, number>;
  lastComputed: number;
  version: number;
}

let inFlight: Promise<AggregatesBundle> | null = null;

export function getCachedAggregates(): AggregatesBundle | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if(!raw) return null; const parsed = JSON.parse(raw);
    if(parsed?.version !== AGG_VERSION) return null;
    return parsed;
  } catch { return null; }
}

function persist(bundle: AggregatesBundle){
  try { sessionStorage.setItem(KEY, JSON.stringify(bundle)); } catch {}
}

export async function computeAggregates(force?: boolean): Promise<AggregatesBundle> {
  if(!force){ const cached = getCachedAggregates(); if(cached) return cached; }
  if(inFlight) return inFlight;
  inFlight = (async ()=> {
    const [sessions, exercises, measurements] = await Promise.all([
      getAllCached('sessions',{ swr:true }),
      getAllCached('exercises',{ swr:true }),
      getAllCached('measurements',{ swr:true })
    ]);
    return new Promise<AggregatesBundle>((resolve, reject)=> {
      try {
        const worker = new Worker(new URL('../workers/aggregateWorker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (evt)=> {
          const data = evt.data || {};
          if(data.error){ console.warn('[aggregates] worker error', data.error); worker.terminate(); reject(new Error(data.error)); return; }
          const bundle: AggregatesBundle = { weeklyVolume: data.weeklyVolume||{}, exercisePRs: data.exercisePRs||{}, weeklyPRCounts: data.weeklyPRCounts||{}, lastComputed: data.lastComputed||Date.now(), version: data.version||AGG_VERSION };
            persist(bundle); worker.terminate(); resolve(bundle);
        };
        worker.postMessage({ sessions, exercises, measurements });
      } catch(err){ reject(err as any); }
    });
  })();
  try { const r = await inFlight; return r; } finally { inFlight = null; }
}

// Convenience accessors
export async function getExercisePR(exerciseId: string){ const agg = await computeAggregates(); return agg.exercisePRs[exerciseId]; }
export async function getWeeklyVolume(){ const agg = await computeAggregates(); return agg.weeklyVolume; }

// Invalidate on realtime changes
if(typeof window !== 'undefined'){
  window.addEventListener('sb-change', (e:any)=> { const tbl = e?.detail?.table; if(['sessions','exercises'].includes(tbl)){ try { sessionStorage.removeItem(KEY); } catch {}; computeAggregates(true).catch(()=>{}); } });
}
