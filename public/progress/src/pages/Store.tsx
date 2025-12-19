import { useEffect, useState } from 'react';
import { Exercise, UserProgram } from '../lib/types';
import { db } from '../lib/db';
import { PRESET_PROGRAMS, resolvePreset } from '../lib/presets';
import { archiveCurrentProgram } from '../lib/profile';
import { ensureProgram } from '../lib/program';
import { nanoid } from 'nanoid';
import { useProgram } from '../state/program';
import { SkeletonCard } from '../components/Skeleton';

interface DisplayPreset {
  id: string;
  name: string;
  category: string;
  headline: string;
  description: string;
  days: number;
  weeks: number;
  deload: string;
  volumeTargets: Record<string, number>;
  templates: { name: string; exerciseNames: string[] }[];
  variants?: string[];
}

export default function Store() {
  const [presets,setPresets] = useState<DisplayPreset[]>([]);
  const [open,setOpen] = useState<string | null>(null);
  const [loading,setLoading] = useState(true);
  const [importing,setImporting] = useState<string|null>(null);
  const [toast,setToast] = useState<string|null>(null);
  const { program } = useProgram();
  useEffect(()=> {
    (async ()=> {
      try {
        const exercises = await db.getAll<Exercise>('exercises');
        const exerciseMap = new Map(exercises.map(e=> [e.id,e]));
        const list: DisplayPreset[] = PRESET_PROGRAMS.map(p=> {
          const resolved = resolvePreset(p, exercises);
            return {
              id: p.id,
              name: p.name,
              category: p.category,
              headline: p.headline,
              description: p.description,
              days: p.weekLengthDays - p.weeklySplit.filter(d=> d.type==='Rest').length,
              weeks: p.weeks,
              deload: p.deload,
              volumeTargets: p.volumeTargets,
              templates: resolved.templates.map(t=> ({ name: t.name.split(': ').pop() || t.name, exerciseNames: t.exerciseIds.map(id=> exerciseMap.get(id)?.name || '–') })),
              variants: p.variants
            };
        });
        setPresets(list);
      } finally { setLoading(false); }
    })();
  },[]);

  const musclesOrder = ['chest','lats','traps','delts','reardelts','quads','hamstrings','glutes','biceps','triceps','calves','core'];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <h2 className="text-2xl font-semibold">Program Store</h2>
      <p className="text-sm text-gray-400">Browse curated preset programs. Purchase & import functionality coming soon — for now these are previews with suggested volume targets, splits, and exercise day templates.</p>
      {loading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} showHeader={false} lines={4} className="min-h-[200px]" />
          ))}
        </div>
      ) : (
      <div className="grid md:grid-cols-2 gap-4">
        {presets.map(p=> {
          const isOpen = open===p.id;
          return (
            <div key={p.id} className="relative rounded-xl border border-white/10 bg-[var(--surface)]/60 backdrop-blur p-4 flex flex-col gap-3 shadow-sm">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-lg leading-tight">{p.name}</h3>
                  <div className="text-xs uppercase tracking-wide text-emerald-400/80">{p.category}</div>
                  <div className="text-sm text-gray-300 mt-1">{p.headline}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-[10px] font-medium">
                <span className="px-2 py-1 rounded bg-slate-800/70">Days: {p.days}</span>
                <span className="px-2 py-1 rounded bg-slate-800/70">Meso: {p.weeks}w</span>
                <span className="px-2 py-1 rounded bg-slate-800/70">Deload: {p.deload}</span>
              </div>
              <div className="flex flex-wrap gap-1 text-[10px] text-gray-400">
                {musclesOrder.map(m=> p.volumeTargets[m] ? (
                  <span key={m} className="px-1.5 py-0.5 rounded bg-slate-900/60 border border-white/5">{m}:{p.volumeTargets[m]}</span>
                ) : null)}
              </div>
              <div className="mt-auto flex items-center gap-2 pt-2">
                <button disabled className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-green-500 text-black text-sm font-semibold opacity-60 cursor-not-allowed" title="Purchases coming soon">Purchase</button>
                <button onClick={()=> setOpen(isOpen? null : p.id)} className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm">{isOpen? 'Hide' : 'Preview'}</button>
                {isOpen && (
                  <button
                    disabled={!!importing}
                    onClick={async ()=> {
                      setImporting(p.id);
                      try {
                        // Resolve raw preset again to capture program specification
                        const raw = PRESET_PROGRAMS.find(pr=> pr.id===p.id);
                        if(!raw) throw new Error('Preset not found');
                        // Build new program object
                        const deload = raw.deload === 'none' ? { mode: 'none' } : (raw.deload === 'last-week' ? { mode: 'last-week' } : { mode: 'interval', everyNWeeks: 5 });
                        const newProgram: UserProgram = ensureProgram({
                          id: `prog_${nanoid(8)}`,
                          name: raw.name,
                          weekLengthDays: raw.weekLengthDays,
                          weeklySplit: raw.weeklySplit.map(d=> ({ ...d })),
                          mesoWeeks: raw.weeks,
                          deload,
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString(),
                          version: 1
                        } as any);
                        const ok = await archiveCurrentProgram(newProgram);
                        if(ok){
                          setToast('Archived current (if existed) & switched to '+raw.name);
                        } else setToast('Archive failed');
                      } catch(e:any){
                        console.warn('[store] import failed', e);
                        setToast(e.message||'Import failed');
                      } finally { setImporting(null); }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold disabled:opacity-50"
                  >{importing===p.id? 'Importing...' : program?.name===p.name? 'Active' : 'Use'}</button>
                )}
              </div>
              {isOpen && (
                <div className="mt-2 space-y-3 text-sm border-t border-white/10 pt-3">
                  <p className="text-gray-300 leading-relaxed text-[13px] whitespace-pre-line">{p.description}</p>
                  {p.variants && <p className="text-[11px] text-amber-300">Variants: {p.variants.join('; ')}</p>}
                  <div className="space-y-2">
                    {p.templates.map(t=> (
                      <div key={t.name} className="bg-slate-800/50 rounded-lg p-2">
                        <div className="font-medium text-[13px] mb-1">{t.name}</div>
                        <div className="flex flex-wrap gap-1 text-[11px]">
                          {t.exerciseNames.map((n,i)=> <span key={i} className="px-1.5 py-0.5 rounded bg-slate-900/60 border border-white/5">{n}</span>)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}
      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur px-4 py-2 rounded-lg text-sm shadow-lg border border-white/10" role="status" onAnimationEnd={()=> setTimeout(()=> setToast(null), 2500)}>{toast}</div>
      )}
    </div>
  );
}
