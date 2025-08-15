import { useEffect, useState } from "react";
import { useProgram } from "../state/program";
import {
  UserProgram,
  WeeklySplitDay,
  DayLabel,
  DeloadConfig,
  Template,
} from "../lib/types";
import { defaultProgram } from "../lib/defaults";
import { validateProgram, programSummary, ensureProgram } from "../lib/program";
import {
  saveProfileProgram,
  archiveCurrentProgram,
  fetchUserProfile,
  restoreArchivedProgram,
} from "../lib/profile";
import { db } from "../lib/db";
import { Session, Exercise } from "../lib/types";

const LABELS: DayLabel[] = [
  "Upper",
  "Lower",
  "Push",
  "Pull",
  "Legs",
  "Full Body",
  "Arms",
  "Rest",
  "Custom",
];

export default function ProgramSettings() {
  const { program, setProgram } = useProgram();
  const [working, setWorking] = useState<UserProgram>(
    () => program || ensureProgram(defaultProgram)
  );
  const [templates, setTemplates] = useState<Template[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [volumeByWeek, setVolumeByWeek] = useState<number[]>([]);
  const [muscleVolume, setMuscleVolume] = useState<Record<string, number>>({});
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [showAllocator, setShowAllocator] = useState(false);
  const [weeklySetTargets, setWeeklySetTargets] = useState<Record<string, number>>({ chest:10, back:12, legs:12, shoulders:8, arms:6, core:6 });
  const [allocatorData, setAllocatorData] = useState<{current: Record<string, number>; diff: Record<string, number>; suggestions: { day: number; muscle: string; add: number }[]}>({ current:{}, diff:{}, suggestions:[] });
  const [showDiffConfirm, setShowDiffConfirm] = useState(false);
  const [diffItems, setDiffItems] = useState<string[]>([]);

  // derive simple historical volume (current mesocycle sessions)
  useEffect(()=>{ (async()=>{
    if(!program) return;
    const all = await db.getAll<Session>('sessions');
    const cur = all.filter(s=> (s.phaseNumber||s.phase||1) === (program as any).currentPhase || 1);
    const byWeek: Record<number, number> = {};
    const mv: Record<string, number> = {};
    const exMap = new Map((await db.getAll('exercises')).map((e:any)=>[e.id,e]));
    for(const s of cur){
      let sessionVol=0;
      for(const e of s.entries){
        const ex = exMap.get(e.exerciseId);
        const m = ex?.muscleGroup || 'other';
        for(const set of e.sets){
          const vol = (set.weightKg||0) * (set.reps||0);
          sessionVol += vol;
          mv[m] = (mv[m]||0)+vol;
        }
      }
      byWeek[s.weekNumber] = (byWeek[s.weekNumber]||0) + sessionVol;
    }
    const weeks = Array.from({length: program.mesoWeeks}, (_,i)=> byWeek[i+1]||0);
    setVolumeByWeek(weeks);
    setMuscleVolume(mv);
  })() }, [program?.id, program?.mesoWeeks]);

  useEffect(() => {
    if (program) setWorking(program);
  }, [program]);
  useEffect(() => {
    db.getAll<Template>("templates").then(setTemplates);
  }, []);
  useEffect(() => {
    (async () => {
      const prof = await fetchUserProfile();
      setHistory(prof?.program_history || []);
    })();
  }, [program]);

  const update = (patch: Partial<UserProgram>) => {
    setWorking((w) => ({
      ...w,
      ...patch,
      updatedAt: new Date().toISOString(),
    }));
  };
  const updateSplit = (idx: number, patch: Partial<WeeklySplitDay>) => {
    setWorking((w) => ({
      ...w,
      weeklySplit: w.weeklySplit.map((d, i) =>
        i === idx ? { ...d, ...patch } : d
      ),
    }));
  };
  const moveDay = (from: number, to: number) => {
    if (
      from === to ||
      from < 0 ||
      to < 0 ||
      from >= working.weeklySplit.length ||
      to >= working.weeklySplit.length
    )
      return;
    const arr = [...working.weeklySplit];
    const [m] = arr.splice(from, 1);
    arr.splice(to, 0, m);
    setWorking((w) => ({
      ...w,
      weeklySplit: arr,
      updatedAt: new Date().toISOString(),
    }));
  };
  const addPreset = (name: string) => {
    if (name === "default") {
      setWorking({
        ...working,
        ...defaultProgram,
        createdAt: working.createdAt,
        updatedAt: new Date().toISOString(),
      });
      return;
    }
    if (name === "ppl+rest") {
      const ws: WeeklySplitDay[] = [
        "Push",
        "Pull",
        "Legs",
        "Rest",
        "Push",
        "Pull",
        "Legs",
      ].map((t) => ({ type: t as DayLabel }));
      setWorking((w) => ({
        ...w,
        name: "PPL + Rest",
        weeklySplit: ws,
        weekLengthDays: 7,
      }));
    } else if (name === "fullbody6") {
      const ws: WeeklySplitDay[] = Array.from({ length: 7 }, (_, i) =>
        i < 6 ? { type: "Full Body" } : { type: "Rest" }
      );
      setWorking((w) => ({
        ...w,
        name: "Full Body 6",
        weeklySplit: ws,
        weekLengthDays: 7,
      }));
    }
  };
  const changeWeekLen = (len: number) => {
    if (len === working.weekLengthDays) return;
    let split = working.weeklySplit.slice(0, len);
    while (split.length < len) split.push({ type: "Rest" });
    update({ weekLengthDays: len, weeklySplit: split });
  };
  const save = async () => {
    const errs = validateProgram(working);
    setErrors(errs);
    if (errs.length) {
      setToast("Fix errors before saving");
      return;
    }
    setSaving(true);
    const ok = await saveProfileProgram(working);
    if (ok) {
      setProgram(working);
      setToast("Program saved");
    } else setToast("Save failed");
    setSaving(false);
  };
  const archiveAndSwitch = async () => {
    // compute diff vs existing program first; require user confirmation
    if(program){
      const diffs:string[] = [];
      if(program.weekLengthDays !== working.weekLengthDays){
        diffs.push(`Week length: ${program.weekLengthDays} → ${working.weekLengthDays}`);
      }
      const oldMode = program.deload.mode;
      const newMode = working.deload.mode;
      if(oldMode !== newMode){
        diffs.push(`Deload mode: ${oldMode} → ${newMode}`);
      } else if(oldMode==='interval' && newMode==='interval' && (program.deload as any).everyNWeeks !== (working.deload as any).everyNWeeks){
        diffs.push(`Deload interval: ${(program.deload as any).everyNWeeks} → ${(working.deload as any).everyNWeeks}`);
      }
      // day labels / order changes
  const oldDays = program.weeklySplit.map((d:WeeklySplitDay)=> d.customLabel || d.type).join('|');
  const newDays = working.weeklySplit.map((d:WeeklySplitDay)=> d.customLabel || d.type).join('|');
      if(oldDays !== newDays){
        diffs.push('Day order / labels changed');
      }
      // template attachments changes
      const tmplChanges:string[] = [];
      working.weeklySplit.forEach((d,i)=>{
        const prev = program.weeklySplit[i];
        if(!prev) return; // length difference handled above
        if(prev.templateId !== d.templateId) {
          tmplChanges.push(`Day ${i+1} template: ${prev.templateId||'–'} → ${d.templateId||'–'}`);
        }
      });
      if(tmplChanges.length) diffs.push(...tmplChanges);
      if(diffs.length && !showDiffConfirm){
        setDiffItems(diffs);
        setShowDiffConfirm(true);
        return; // wait for confirmation
      }
    }
    const errs = validateProgram(working);
    setErrors(errs);
    if (errs.length) {
      setToast("Fix errors before saving");
      return;
    }
    setSaving(true);
    const next: UserProgram = {
      ...working,
      id: working.id || `prog_${Math.random().toString(36).slice(2, 9)}`,
      createdAt: working.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const ok = await archiveCurrentProgram(next);
    if (ok) {
      setProgram(next);
      setToast("Archived previous and switched");
    } else setToast("Archive failed");
    setSaving(false);
  };
  const restore = async (id: string) => {
    setSaving(true);
    const p = await restoreArchivedProgram(id);
    if (p) {
      setProgram(p);
      setWorking(p);
      setToast("Program restored");
    } else setToast("Restore failed");
    setSaving(false);
  };

  // Allocation logic effect
  useEffect(()=>{ if(!showAllocator) return; (async()=>{
    const exercises = await db.getAll<Exercise>('exercises');
    const exMap = new Map(exercises.map(e=> [e.id, e]));
    // compute current planned sets per muscle using templates mapped in working.weeklySplit
    const templateMap = new Map(templates.map(t=> [t.id, t]));
    const current: Record<string, number> = {};
    const perDayMuscle: Record<number, Record<string, number>> = {};
    working.weeklySplit.forEach((day,i)=>{
      const t = day.templateId ? templateMap.get(day.templateId): null;
      const mv: Record<string, number> = {};
      if(t){
        t.exerciseIds.forEach(eid=>{ const ex = exMap.get(eid); if(!ex) return; const sets = ex.defaults.sets || 0; const m = ex.muscleGroup || 'other'; current[m] = (current[m]||0) + sets; mv[m]=(mv[m]||0)+sets; });
      }
      perDayMuscle[i]=mv;
    });
    const diff: Record<string, number> = {};
    Object.entries(weeklySetTargets).forEach(([m,target])=> { diff[m] = target - (current[m]||0); });
    // suggestions: allocate remaining diff across days lacking that muscle
    const suggestions: { day:number; muscle:string; add:number }[] = [];
    Object.entries(diff).forEach(([muscle, remain])=>{
      if(remain <= 0) return;
      // days sorted by existing volume ascending for that muscle
      const sortedDays = Object.entries(perDayMuscle).sort((a,b)=> (a[1][muscle]||0) - (b[1][muscle]||0));
      let left = remain;
      for(const [dIndexStr,_mv] of sortedDays){
        const dIndex = Number(dIndexStr);
        if(left<=0) break;
        const add = Math.min( Math.max(1, Math.ceil(remain / sortedDays.length)), left );
        suggestions.push({ day:dIndex, muscle, add });
        left -= add;
      }
    });
    setAllocatorData({ current, diff, suggestions });
  })() }, [showAllocator, templates, working.weeklySplit, weeklySetTargets]);
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Program</h2>
      {toast && <div className="text-xs text-emerald-400">{toast}</div>}
      <div className="glass-card rounded-2xl p-4 space-y-4">
        {/* Mesocycle timeline */}
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-gray-400">Mesocycle Timeline (Weekly Volume)</div>
          <div className="flex items-end gap-1 h-24">
            {volumeByWeek.map((v,i)=>{ const max=Math.max(1,...volumeByWeek); const pct=Math.round((v/max)*100); return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-slate-700/40 rounded relative h-full flex items-end">
                  <div className="w-full bg-gradient-to-t from-indigo-600/70 to-indigo-400/70 rounded transition-all" style={{height:`${pct}%`}} />
                </div>
                <div className="text-[9px] text-gray-500">W{i+1}</div>
              </div>
            )})}
          </div>
        </div>
        {/* Muscle group heatmap */}
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-gray-400">Muscle Volume Split</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(muscleVolume).sort((a,b)=> b[1]-a[1]).map(([m,v])=>{ const max=Math.max(1,...Object.values(muscleVolume)); const pct=(v/max)*100; return (
              <div key={m} className="bg-white/5 rounded-lg px-2 py-2 space-y-1">
                <div className="flex items-center justify-between text-[10px] text-gray-400">
                  <span className="capitalize">{m}</span><span className="tabular-nums">{Math.round(v)}</span>
                </div>
                <div className="h-2 w-full bg-slate-700/40 rounded overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{width:`${pct}%`}} />
                </div>
              </div>
            )})}
            {!Object.keys(muscleVolume).length && (
              <div className="col-span-full text-[11px] text-gray-500">No logged volume yet this phase.</div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="space-y-1">
            <span className="text-xs text-gray-400">Name</span>
            <input
              value={working.name}
              onChange={(e) => update({ name: e.target.value })}
              className="input-app rounded-xl px-3 py-2 bg-white/5 border border-white/10"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-gray-400">Mesocycle weeks</span>
            <input
              type="number"
              min={4}
              max={20}
              value={working.mesoWeeks}
              onChange={(e) => update({ mesoWeeks: Number(e.target.value) })}
              className="input-app rounded-xl px-3 py-2 w-28 bg-white/5 border border-white/10"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-gray-400">Week length (days)</span>
            <select
              value={working.weekLengthDays}
              onChange={(e) => changeWeekLen(Number(e.target.value))}
              className="input-app rounded-xl px-3 py-2 bg-white/5 border border-white/10"
            >
              {[5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <div className="space-y-1">
            <span className="text-xs text-gray-400">Deload</span>
            <div className="flex gap-2 text-xs">
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="dl"
                  checked={working.deload.mode === "none"}
                  onChange={() =>
                    update({ deload: { mode: "none" } as DeloadConfig })
                  }
                />
                None
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="dl"
                  checked={working.deload.mode === "last-week"}
                  onChange={() =>
                    update({ deload: { mode: "last-week" } as DeloadConfig })
                  }
                />
                Last week
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="dl"
                  checked={working.deload.mode === "interval"}
                  onChange={() =>
                    update({
                      deload: {
                        mode: "interval",
                        everyNWeeks:
                          working.deload.mode === "interval"
                            ? working.deload.everyNWeeks
                            : 5,
                      } as DeloadConfig,
                    })
                  }
                />
                Every N
              </label>
              {working.deload.mode === "interval" && (
                <input
                  type="number"
                  min={4}
                  max={12}
                  value={working.deload.everyNWeeks}
                  onChange={(e) =>
                    update({
                      deload: {
                        mode: "interval",
                        everyNWeeks: Number(e.target.value) || 4,
                      } as DeloadConfig,
                    })
                  }
                  className="w-16 input-app rounded px-2 py-1 text-xs bg-white/5 border border-white/10"
                />
              )}
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-gray-400">
            Weekly Split
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {working.weeklySplit.map((d, i) => (
              <div
                key={i}
                className="min-w-[170px] rounded-xl p-3 bg-white/5 border border-white/10 space-y-2"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", String(i));
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const from = Number(e.dataTransfer.getData("text/plain"));
                  if (!isNaN(from)) moveDay(from, i);
                }}
              >
                <div className="flex items-center justify-between text-[10px] text-gray-400">
                  <span className="cursor-grab select-none">≡ Day {i + 1}</span>
                  <div className="flex gap-1">
                    <button
                      aria-label="Move left"
                      disabled={i === 0}
                      className="px-1 rounded bg-white/10 disabled:opacity-30"
                      onClick={() => moveDay(i, i - 1)}
                    >
                      ←
                    </button>
                    <button
                      aria-label="Move right"
                      disabled={i === working.weeklySplit.length - 1}
                      className="px-1 rounded bg-white/10 disabled:opacity-30"
                      onClick={() => moveDay(i, i + 1)}
                    >
                      →
                    </button>
                  </div>
                </div>
                <select
                  aria-label={`Day ${i + 1} type`}
                  value={d.type}
                  onChange={(e) =>
                    updateSplit(i, {
                      type: e.target.value as DayLabel,
                      customLabel: undefined,
                    })
                  }
                  className="w-full rounded-lg bg-white/10 px-2 py-1 text-xs"
                >
                  {LABELS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
                {d.type === "Custom" && (
                  <input
                    aria-label="Custom label"
                    placeholder="Label"
                    value={d.customLabel || ""}
                    onChange={(e) =>
                      updateSplit(i, { customLabel: e.target.value })
                    }
                    className="w-full rounded-lg bg-white/10 px-2 py-1 text-xs"
                  />
                )}
                <select
                  aria-label="Template mapping"
                  value={d.templateId || ""}
                  onChange={(e) =>
                    updateSplit(i, { templateId: e.target.value || undefined })
                  }
                  className="w-full rounded-lg bg-white/10 px-2 py-1 text-[10px]"
                  onMouseEnter={() => {
                    if(d.templateId){ const t=templates.find(t=> t.id===d.templateId); if(t) setPreviewTemplate(t); }
                  }}
                  onMouseLeave={()=> setPreviewTemplate(null)}
                >
                  <option value="">No template</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                {d.templateId && (
                  <div className="text-[10px] text-gray-400">
                    {templates.find((t) => t.id === d.templateId)?.exerciseIds
                      .length || 0}{" "}
                    exercises
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              className="btn-outline px-3 py-1 rounded-lg"
              onClick={() => addPreset("default")}
            >
              Default UL x3
            </button>
            <button
              className="btn-outline px-3 py-1 rounded-lg"
              onClick={() => addPreset("ppl+rest")}
            >
              PPL + Rest
            </button>
            <button
              className="btn-outline px-3 py-1 rounded-lg"
              onClick={() => addPreset("fullbody6")}
            >
              Full Body 6
            </button>
          </div>
        </div>
        {!!errors.length && (
          <ul className="text-xs text-red-400 list-disc pl-5 space-y-1">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2 text-[10px] text-gray-400">
          <span>Planned Volume Allocator (beta)</span>
          <button className="btn-outline px-2 py-1 rounded-lg" onClick={()=> setShowAllocator(v=>!v)}>{showAllocator? 'Hide':'Open'}</button>
        </div>
        {showAllocator && (
          <div className="rounded-xl bg-white/5 border border-white/10 p-3 space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(weeklySetTargets).map(([m,val])=> (
                <label key={m} className="space-y-1">
                  <span className="text-[10px] uppercase tracking-wide text-gray-500 flex items-center justify-between">
                    <span>{m}</span>
                    <span className="opacity-60">{allocatorData.current[m]||0}</span>
                  </span>
                  <input type="number" min={0} max={40} value={val} onChange={e=> setWeeklySetTargets(ts=> ({...ts, [m]: Number(e.target.value)}))} className="w-full rounded bg-white/10 px-2 py-1 text-xs" />
                  <div className={`text-[10px] ${ (allocatorData.diff[m]||0) > 0 ? 'text-amber-400':'text-emerald-400'}`}>Δ {(allocatorData.diff[m]||0)}</div>
                </label>
              ))}
            </div>
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wide text-gray-500">Suggestions</div>
              {allocatorData.suggestions.length ? (
                <ul className="space-y-1 max-h-32 overflow-y-auto pr-1">
                  {allocatorData.suggestions.map((s,i)=> (
                    <li key={i} className="text-[11px] bg-white/5 rounded px-2 py-1 flex justify-between">
                      <span>Day {s.day+1}: add {s.add} {s.muscle} set{s.add>1?'s':''}</span>
                      <span className="opacity-60">need {(allocatorData.diff[s.muscle]||0)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-[11px] text-gray-500">Targets satisfied.</div>
              )}
            </div>
            <div className="text-[10px] text-gray-500">(Allocator suggests additional sets for under-target muscles. Apply manually by editing templates.)</div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="btn-primary rounded-xl px-4 py-2 text-sm disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save Program"}
          </button>
          <button
            onClick={archiveAndSwitch}
            disabled={saving}
            className="btn-outline rounded-xl px-4 py-2 text-sm disabled:opacity-40"
          >
            Archive & Switch
          </button>
          <span className="text-[11px] text-gray-400">
            {programSummary(working)}
          </span>
        </div>
      </div>
      {history.length > 0 && (
        <div className="glass-card rounded-2xl p-4 space-y-3">
          <div className="text-xs uppercase tracking-wide text-gray-400">
            Archived Programs
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {history.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between text-xs bg-white/5 rounded-xl px-3 py-2"
              >
                <div className="flex flex-col">
                  <span className="font-medium">{h.name}</span>
                  <span className="text-[10px] text-gray-400">
                    {h.summary || h.program?.mesoWeeks + "w"} ·{" "}
                    {new Date(h.archivedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn-outline px-2 py-1 rounded-lg"
                    disabled={saving}
                    onClick={() => restore(h.id)}
                  >
                    Restore
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {previewTemplate && (
        <div className="fixed bottom-4 right-4 z-50 max-w-xs bg-[var(--surface)]/90 backdrop-blur rounded-xl border border-[var(--border-subtle)] shadow-lg p-3 space-y-2 fade-in" onMouseLeave={()=> setPreviewTemplate(null)}>
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">{previewTemplate.name}</span>
            <button className="text-[10px] px-2 py-0.5 rounded bg-slate-700" onClick={()=> setPreviewTemplate(null)}>Close</button>
          </div>
          <ul className="space-y-1 max-h-40 overflow-y-auto pr-1 text-[11px]">
            {previewTemplate.exerciseIds.map(id=> (
              <li key={id} className="bg-white/5 rounded px-2 py-1 flex items-center justify-between">
                <span>{id.slice(0,6)}</span>
                <span className="opacity-60">set×?</span>
              </li>
            ))}
          </ul>
          <div className="text-[10px] text-gray-500">(Template preview placeholder; replace id slices with exercise names & planned sets)</div>
        </div>
      )}
      {showDiffConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border-subtle)] p-4 w-full max-w-md space-y-3 fade-in">
            <div className="text-sm font-medium">Confirm Archive & Switch</div>
            <div className="text-[11px] text-gray-400">Review changes before archiving current program:</div>
            <ul className="text-[11px] list-disc pl-4 space-y-1 max-h-40 overflow-y-auto pr-1">
              {diffItems.map((d,i)=> <li key={i}>{d}</li>)}
            </ul>
            <div className="flex gap-2 justify-end text-xs">
              <button className="btn-outline px-3 py-1 rounded-lg" onClick={()=> { setShowDiffConfirm(false); setDiffItems([]); }}>Cancel</button>
              <button className="btn-primary px-3 py-1 rounded-lg" onClick={()=> { setShowDiffConfirm(false); // run archive again will skip diff modal
                setTimeout(()=> archiveAndSwitch(), 0); }}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
