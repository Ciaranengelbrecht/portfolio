import { useEffect, useMemo, useState, useRef, useLayoutEffect } from "react";
import { createPortal } from 'react-dom';
import { db } from "../lib/db";
import { getAllCached } from "../lib/dataCache";
import { waitForSession } from "../lib/supabase";
import {
  Exercise,
  Session,
  SessionEntry,
  SetEntry,
  Template,
  Settings,
} from "../lib/types";
import { buildSuggestions } from '../lib/progression';
import { useProgram } from "../state/program";
import { computeDeloadWeeks, programSummary } from "../lib/program";
import { buildPrevBestMap, getPrevBest } from "../lib/prevBest";
import { nanoid } from "nanoid";
import { getDeloadPrescription, getLastWorkingSets } from "../lib/helpers";
import { parseOptionalNumber, formatOptionalNumber } from '../lib/parse';
import { getSettings, setSettings } from "../lib/helpers";
import { motion, AnimatePresence } from 'framer-motion';
import { fadeSlideUp, maybeDisable } from '../lib/motion';
import PhaseStepper from "../components/PhaseStepper";
import ImportTemplateDialog from "../features/sessions/ImportTemplateDialog";
import { rollingPRs } from "../lib/helpers";
import { setLastAction, undo as undoLast } from "../lib/undo";
// Using global snack queue instead of legacy Snackbar
import { useSnack } from "../state/snackbar";

const DAYS = [
  "Upper A",
  "Lower A",
  "Upper B",
  "Lower B",
  "Upper C",
  "Lower C",
  "Rest",
];

export default function Sessions() {
  const { program } = useProgram();
  const [week, setWeek] = useState<any>(1);
  const [phase, setPhase] = useState<number>(1);
  const [day, setDay] = useState(0);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [suggestions, setSuggestions] = useState<Map<string,{weightKg?:number; reps?:number}>>(new Map());
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [query, setQuery] = useState("");
  const [dragEntryIdx, setDragEntryIdx] = useState<number | null>(null);
  const { push } = useSnack();
  const [showImport, setShowImport] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [prevBestMap, setPrevBestMap] = useState<{
    [id: string]: { week: number; set: SetEntry };
  } | null>(null);
  const [settingsState, setSettingsState] = useState<Settings | null>(null);
  const [autoNavDone, setAutoNavDone] = useState(false);
  const lastRealSessionAppliedRef = useRef(false);
  // Per-exercise rest timers keyed by entry.id (single timer per exercise)
  const [restTimers, setRestTimers] = useState<Record<string,{start:number;elapsed:number;running:boolean;finished?:boolean;alerted?:boolean}>>({});
  const REST_TIMER_MAX = 300000; // 5 minutes auto-reset (was 3min)
  const [readinessPct, setReadinessPct] = useState(0);
  // Manual date editing UI state
  const [editingDate, setEditingDate] = useState(false);
  const [dateEditValue, setDateEditValue] = useState("");
  // Stamp animation state
  const [stampAnimating, setStampAnimating] = useState(false);
  // Scroll state for hiding mobile More button after user scrolls
  const [scrolled, setScrolled] = useState(false);
  const toolbarRef = useRef<HTMLDivElement|null>(null);
  const [toolbarHeight, setToolbarHeight] = useState(56);
  // Ephemeral weight input strings (to allow user to type trailing '.')
  const weightInputEditing = useRef<Record<string,string>>({});
  // Ephemeral reps input strings (avoid lag & flicker when clearing digits)
  const repsInputEditing = useRef<Record<string,string>>({});
  // Collapsed exercise card state (entry.id -> collapsed?)
  const [collapsedEntries, setCollapsedEntries] = useState<Record<string,boolean>>({});
  const toggleEntryCollapsed = (id:string)=> setCollapsedEntries(prev=> ({ ...prev, [id]: !prev[id] }));
  // Track if we have already auto-picked a latest session to avoid settings lastLocation race overriding it
  const pickedLatestRef = useRef(false);
  // Persist collapsed state per-session (mobile UX enhancement)
  useEffect(()=> {
    if(!session?.id) return;
    try { const raw = sessionStorage.getItem(`collapsedEntries:${session.id}`); if(raw) setCollapsedEntries(JSON.parse(raw)); } catch {}
  }, [session?.id]);
  useEffect(()=> {
    if(!session?.id) return; try { sessionStorage.setItem(`collapsedEntries:${session.id}`, JSON.stringify(collapsedEntries)); } catch {}
  }, [collapsedEntries, session?.id]);
  const collapseAll = ()=> { if(!session) return; const next:Record<string,boolean>={}; for(const e of session.entries){ next[e.id]=true; } setCollapsedEntries(next); };
  const expandAll = ()=> { if(!session) return; const next:Record<string,boolean>={}; for(const e of session.entries){ next[e.id]=false; } setCollapsedEntries(next); };
  const anyCollapsed = useMemo(()=> Object.values(collapsedEntries).some(v=> v), [collapsedEntries]);
  const allCollapsed = useMemo(()=> session?.entries.length? session.entries.every(e=> collapsedEntries[e.id]) : false, [collapsedEntries, session?.entries.length]);
  // Enable verbose session selection debugging by setting localStorage.debugSessions = '1'
  const debugSessions = useRef<boolean>(false);
  useEffect(()=> { try { debugSessions.current = localStorage.getItem('debugSessions')==='1'; } catch {} }, []);

  useEffect(() => {
    (async () => {
      const s = await getSettings();
      // Only apply stored lastLocation if we haven't already picked the most recent session
      if (!pickedLatestRef.current) {
        setPhase(s.currentPhase || 1);
        const last = s.dashboardPrefs?.lastLocation;
        if (last) {
          setWeek(last.weekNumber as any);
          setDay(last.dayId);
        }
      }
      // Build suggestions map (lightweight) if enabled
      if(s.progress?.autoProgression){
        try {
          const ex = await db.getAll<Exercise>('exercises');
          const sess = await db.getAll<Session>('sessions');
          setSuggestions(buildSuggestions(ex, sess));
        } catch {}
      } else setSuggestions(new Map());
    })();
  }, []);

  // Track scroll position to toggle More button visibility
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY || document.documentElement.scrollTop;
      setScrolled(y > 40);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Measure toolbar height for spacer (updates on resize)
  useLayoutEffect(() => {
    const measure = () => {
      if (toolbarRef.current) setToolbarHeight(toolbarRef.current.offsetHeight);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  // Re-measure shortly after mount to catch font / async layout shifts (prevents overlap on mobile)
  useEffect(()=> { const t = setTimeout(()=> { if(toolbarRef.current) setToolbarHeight(toolbarRef.current.offsetHeight); }, 340); return ()=> clearTimeout(t); }, []);

  // After initial mount, choose the most recently ACTIVE session with data.
  // Priority order:
  // 1. Latest calendar date (localDate or dateISO day) that has any non-zero set
  // 2. Within same date, latest activity timestamp (loggedEndAt > loggedStartAt > updatedAt > createdAt > dateISO)
  // 3. Tie-breaker: higher weekNumber then higher day index (parsed from id)
  // Also retroactively backfill missing loggedStart/End stamps.
  useEffect(()=>{ (async()=> {
    if(lastRealSessionAppliedRef.current) return;
    try {
      const all = await db.getAll<Session>('sessions');
      let mutated = false;
      const hasWork = (s:Session)=> s.entries?.some(e=> e.sets.some(st=> (st.weightKg||0)>0 || (st.reps||0)>0));
      for(const s of all){
        if(hasWork(s) && !s.loggedEndAt){ (s as any).loggedEndAt = s.updatedAt || s.createdAt || s.dateISO; mutated = true; }
        if(hasWork(s) && !s.loggedStartAt){ (s as any).loggedStartAt = s.loggedEndAt || s.updatedAt || s.createdAt || s.dateISO; mutated = true; }
      }
      if(mutated){
        for(const s of all){ if(s.loggedEndAt && s.loggedStartAt){ try{ await db.put('sessions', s); }catch{} } }
      }
  const dayVal = (s:Session)=> { const d = (s.localDate || s.dateISO?.slice(0,10) || '').replace(/-/g,''); return /^\d{8}$/.test(d)? Number(d): 0; };
      const activityMs = (s:Session)=> { const t = (v?:string)=> v? new Date(v).getTime() || 0 : 0; return Math.max(t(s.loggedEndAt), t(s.loggedStartAt), t(s.updatedAt), t(s.createdAt), t(s.dateISO)); };
      const withData = all.filter(hasWork);
      if(!withData.length){ lastRealSessionAppliedRef.current=true; return; }
      withData.sort((a,b)=> {
        const dv = dayVal(b) - dayVal(a); if(dv!==0) return dv;
        const av = activityMs(b) - activityMs(a); if(av!==0) return av;
        if((b.weekNumber||0)!==(a.weekNumber||0)) return (b.weekNumber||0)-(a.weekNumber||0);
        const ad = Number(a.id.split('-')[2]||0); const bd = Number(b.id.split('-')[2]||0); return bd - ad;
      });
      const chosen = withData[0];
      if(debugSessions.current){
        // Sanity: ensure no candidate has strictly newer calendar day than chosen
        const newer = withData.find(s=> dayVal(s) > dayVal(chosen));
        if(newer){ console.warn('[Sessions debug] Found newer calendar session not chosen', { chosen: chosen.id, newer: newer.id }); }
      }
      if(debugSessions.current){
        try {
          console.groupCollapsed('[Sessions debug] selection');
          console.log('Candidates (top 12):');
          withData.slice(0,12).forEach(s=> console.log(s.id, { localDate: s.localDate, dateISO: s.dateISO?.slice(0,10), dayVal: dayVal(s), loggedStartAt: s.loggedStartAt, loggedEndAt: s.loggedEndAt, updatedAt: s.updatedAt, createdAt: s.createdAt, activity: activityMs(s) }));
          console.log('Chosen:', chosen.id);
          console.groupEnd();
        } catch {}
      }
      const parts = chosen.id.split('-');
      if(parts.length===3){ const p=Number(parts[0]); const w=Number(parts[1]); const d=Number(parts[2]); if(!isNaN(p)&&!isNaN(w)&&!isNaN(d)){ setPhase(p); setWeek(w as any); setDay(d); } }
      lastRealSessionAppliedRef.current=true; pickedLatestRef.current=true;
      // Persist immediately so settings don't point to an older session later
      try {
        const settings = await getSettings();
        await setSettings({
          ...settings,
          dashboardPrefs: {
            ...(settings.dashboardPrefs||{}),
            lastLocation: {
              phaseNumber: Number(parts[0])||chosen.phaseNumber||chosen.phase||1,
              weekNumber: Number(parts[1])||chosen.weekNumber,
              dayId: Number(parts[2])||0,
              sessionId: chosen.id
            }
          }
        });
      } catch {}
    } catch(e){ console.warn('Failed picking last active session', e); }
  })(); },[]);

  // Auto navigation logic: stay on the most recent week within current phase that has ANY real data (weight or reps > 0).
  // Do not auto-advance to next phase until user manually creates data in week 1 of the next phase.
  useEffect(() => {
    (async () => {
      if (autoNavDone) return;
      const all = await db.getAll<Session>("sessions");
      if (!all.length) {
        setAutoNavDone(true);
        return;
      }
      // Filter by current phase (legacy sessions may store phase or phaseNumber)
      const byPhase = all.filter(
        (s) => (s.phaseNumber || s.phase || 1) === phase
      );
      // Determine weeks with real data (any set with weight>0 or reps>0)
      const weekHasData = new Map<number, boolean>();
      for (const s of byPhase) {
        const real = s.entries.some((e) =>
          e.sets.some((st) => (st.weightKg || 0) > 0 || (st.reps || 0) > 0)
        );
        if (real) {
          weekHasData.set(s.weekNumber, true);
        }
      }
      if (weekHasData.size === 0) {
        // stay on current (default 1)
        setAutoNavDone(true);
        return;
      }
      // Highest week in this phase with data
      const targetWeek = [...weekHasData.keys()].sort((a, b) => a - b).pop()!;
      if (targetWeek !== week) {
        setWeek(targetWeek);
      }
      setAutoNavDone(true);
    })();
  }, [phase, autoNavDone]);

  // Guard against accidental phase increment: override phase if settings jumped forward without week1 data in next phase
  useEffect(() => {
    (async () => {
      const all = await db.getAll<Session>("sessions");
      const curPhaseSessions = all.filter(
        (s) => (s.phaseNumber || s.phase || 1) === phase
      );
      // If user is beyond phase 1 and there is zero real data in phase weeks, revert to previous phase with data
      if (phase > 1) {
        const haveReal = curPhaseSessions.some((s) =>
          s.entries.some((e) =>
            e.sets.some((st) => (st.weightKg || 0) > 0 || (st.reps || 0) > 0)
          )
        );
        if (!haveReal) {
          // find latest phase that has data
          const phasesWithData = new Set<number>();
          for (const s of all) {
            if (
              s.entries.some((e) =>
                e.sets.some(
                  (st) => (st.weightKg || 0) > 0 || (st.reps || 0) > 0
                )
              )
            )
              phasesWithData.add(s.phaseNumber || s.phase || 1);
          }
          if (phasesWithData.size) {
            const back = [...phasesWithData].sort((a, b) => b - a)[0];
            if (back !== phase) {
              setPhase(back);
              const settings = await getSettings();
              await setSettings({ ...settings, currentPhase: back });
            }
          }
        }
      }
    })();
  }, [phase]);

  // Phase readiness calculation
  useEffect(()=>{ (async()=>{
    if(!program){ setReadinessPct(0); return }
    const all = await db.getAll<Session>('sessions');
    const cur = all.filter(s=> (s.phaseNumber||s.phase||1)===phase);
    const weeks = new Set<number>();
    for(const s of cur){ if(s.entries.some(e=> e.sets.some(st=> (st.weightKg||0)>0 || (st.reps||0)>0))) weeks.add(s.weekNumber) }
    setReadinessPct(Math.min(100, Math.round((weeks.size/(program.mesoWeeks||1))*100)));
  })() }, [phase, week, session?.id, program]);

  // Keyboard shortcuts
  useEffect(()=>{ const handler=(e:KeyboardEvent)=>{ if(e.key==='/'&&!e.metaKey&&!e.ctrlKey){ e.preventDefault(); setShowAdd(true) } if(e.key==='Enter'&&e.shiftKey){ const active=document.activeElement as HTMLElement|null; if(active?.tagName==='INPUT'){ const inputs=[...document.querySelectorAll('input[data-set-input="true"]')] as HTMLInputElement[]; const idx=inputs.indexOf(active as HTMLInputElement); if(idx>=0&&idx<inputs.length-1){ inputs[idx+1].focus(); e.preventDefault(); } } } if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='d'){ const active=document.activeElement as HTMLElement|null; const entryId=active?.dataset.entryId; const setNumber=Number(active?.dataset.setNumber); if(entryId&&setNumber){ const ent=session?.entries.find(en=>en.id===entryId); const src=ent?.sets.find(s=> s.setNumber===setNumber); if(ent&&src){ const clone: SetEntry={...src,setNumber: ent.sets.length+1}; updateEntryPatched({...ent, sets:[...ent.sets, clone]}); e.preventDefault(); } } } }; window.addEventListener('keydown', handler); return ()=> window.removeEventListener('keydown', handler) }, [session]);

  // Rest timer: periodic update & alert when target reached (per-exercise single timer)
  useEffect(()=>{ let frame:number; const tick=()=>{ setRestTimers(prev=>{ const now=Date.now(); const targetMs=(settingsState?.restTimerTargetSeconds||90)*1000; const next: typeof prev = {}; for(const [k,v] of Object.entries(prev)){
          if(v.finished){ // keep briefly for finish pulse then drop
            if(now - (v.start + v.elapsed) < 1200){ next[k]=v; }
            continue;
          }
          if(!v.running){ next[k]=v; continue; }
          // If start came from performance.now() (very small number) migrate to Date.now() baseline
          let start = v.start;
          if(start < 1e10){ // treat as perf timestamp, remap
            start = now - v.elapsed; // approximate
          }
          const elapsed = now - start;
          if(elapsed >= REST_TIMER_MAX){
            next[k] = { ...v, start, elapsed: REST_TIMER_MAX, running:false, finished:true, alerted: true };
            continue;
          }
          // trigger alert when crossing target threshold once
          if(elapsed >= targetMs && !v.alerted){ if(settingsState?.haptics !== false){ try{ navigator.vibrate?.([16,70,18,70,18]); }catch{} } next[k] = { ...v, start, elapsed, alerted:true }; }
          else { next[k] = { ...v, start, elapsed }; }
        } return next }) ; frame = requestAnimationFrame(tick); }; frame=requestAnimationFrame(tick); return ()=> cancelAnimationFrame(frame) },[settingsState?.restTimerTargetSeconds, settingsState?.haptics])
  // Restart (or start) rest timer in a single tap; always resets elapsed to 0 and runs
  const restartRestTimer = (entryId:string)=>{
    setRestTimers(()=> ({ [entryId]: { start: Date.now(), elapsed:0, running:true } }));
    if(settingsState?.haptics !== false){ try{ navigator.vibrate?.([8,30,14]); }catch{} }
  };
  // Stop & clear rest timer (remove entirely)
  const stopRestTimer = (entryId:string)=>{
    setRestTimers(prev=>{ const next={...prev}; if(next[entryId]) delete next[entryId]; return next; });
    if(settingsState?.haptics !== false){ try{ navigator.vibrate?.(12);}catch{} }
  };
  const restTimerDisplay = (entryId:string)=>{ const t=restTimers[entryId]; if(!t) return null; const ms = t.elapsed; const totalSecs = ms/1000; const mm = Math.floor(totalSecs/60); const ss = Math.floor(totalSecs)%60; const cs = Math.floor((ms%1000)/10); const target=(settingsState?.restTimerTargetSeconds||90); const strong=settingsState?.restTimerStrongAlert!==false; const flash=settingsState?.restTimerScreenFlash===true; const reached = totalSecs >= target; const basePulse = reached && !t.finished ? 'animate-[timerPulseFast_900ms_ease-in-out_infinite]' : t.finished ? 'animate-[timerFinishPop_900ms_ease-in-out_forwards]' : (t.running? 'animate-[timerPulse_1800ms_ease-in-out_infinite]':'');
    // On first reach event add screen flash if enabled
    if(reached && !t.alerted && flash){ try { document.body.classList.add('rest-screen-flash'); setTimeout(()=> document.body.classList.remove('rest-screen-flash'), 520); } catch {} }
    return (
      <span
        aria-live={reached? 'polite':'off'}
        aria-label={`Rest time ${mm} minutes ${ss} seconds ${cs} centiseconds${reached? ' target reached':''}`}
        className={`rest-timer relative font-mono tabular-nums select-none text-[12px] px-2 py-0.5 rounded-md min-w-[72px] text-center leading-none ${reached? 'text-rose-300':'text-emerald-300'} ${basePulse} ${reached && strong ? 'rest-strong-alert':''} bg-slate-800/60 shadow-inner`}
      >
        <span className={`rest-timer-value relative z-10 font-semibold tracking-tight ${reached? 'drop-shadow-[0_0_10px_rgba(255,255,255,0.6)] transition-transform':'transition-transform'}`}>{mm}:{String(ss).padStart(2,'0')}.<span className="opacity-70">{String(cs).padStart(2,'0')}</span></span>
      </span>
    ); }
  const duplicateLastSet = (entry: SessionEntry)=>{ const last=[...entry.sets].pop(); if(!last) return; const clone: SetEntry={...last, setNumber: entry.sets.length+1}; updateEntry({ ...entry, sets:[...entry.sets, clone] }) }

  // Adjust week clamp if program changes
  useEffect(() => {
    if (program) {
      if (week > program.mesoWeeks) setWeek(1);
      if (day >= program.weekLengthDays) setDay(0);
    }
  }, [program]);

  useEffect(() => {
    (async () => {
      const id = `${phase}-${week}-${day}`;
      let s = await db.get<Session>("sessions", id);
      if (!s) {
        // fallback: try old id format (week-day) and migrate
        const oldId = `${week}-${day}`;
        const old = await db.get<Session>("sessions", oldId);
        if (old) {
          s = { ...old, id, phase };
          await db.delete("sessions", oldId);
          await db.put("sessions", s);
        }
      }
      if (!s) {
        // Duplicate guard: ensure not creating second session for same phase-week-day within same UTC date
        const allToday = (await db.getAll<Session>('sessions')).filter(x=> x.dateISO?.slice(0,10) === new Date().toISOString().slice(0,10));
        const existingSame = allToday.find(x=> x.id === id);
        if(existingSame){
          s = existingSame; // another timezone path already created it
        }
      }
      if (!s) {
        const templateMeta = program ? program.weeklySplit[day] : undefined;
        const templateName = templateMeta
          ? templateMeta.customLabel || templateMeta.type || "Day"
          : DAYS[day];
        const now = new Date();
        const localDayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
        const nowISO = new Date().toISOString();
        s = {
          id,
          dateISO: (()=> { const d=new Date(); d.setHours(0,0,0,0); return d.toISOString(); })(),
            localDate: localDayStr,
            weekNumber: week,
            phase,
            phaseNumber: phase,
            dayName: templateName,
            entries: [],
            templateId: templateMeta?.templateId,
            programId: program?.id,
            createdAt: nowISO,
            updatedAt: nowISO,
        } as Session;
        await db.put("sessions", s);
        // If there is a templateId, auto-import it
        if (templateMeta?.templateId) {
          try {
            const t = await db.get("templates", templateMeta.templateId);
            if (t) {
              // Reuse import logic manually (append false since brand new)
              const exs = await db.getAll("exercises");
              const settings = await getSettings();
              const exMap = new Map(exs.map((e: any) => [e.id, e]));
              const rows = (exId: string) =>
                Math.max(
                  1,
                  Math.min(
                    6,
                    settings.defaultSetRows ??
                      exMap.get(exId)?.defaults.sets ??
                      3
                  )
                );
              const newEntries = (t.exerciseIds || []).map((exId: string) => ({
                id: nanoid(),
                exerciseId: exId,
                sets: Array.from({ length: rows(exId) }, (_, i) => ({
                  setNumber: i + 1,
                  weightKg: 0,
                  reps: 0,
                })),
              }));
              s = {
                ...s,
                entries: newEntries,
                autoImportedTemplateId: templateMeta.templateId,
              };
              await db.put("sessions", s);
            }
          } catch (e) {
            console.warn("[Sessions] auto-import template failed", e);
          }
        }
      }
  setSession(s);
      const settings = await getSettings();
      await setSettings({
        ...settings,
        dashboardPrefs: {
          ...(settings.dashboardPrefs || {}),
          lastLocation: {
            phaseNumber: phase,
            weekNumber: week,
            dayId: day,
            sessionId: s.id,
          },
        },
      });
    })();
  }, [phase, week, day]);

  // Wrap entry update to stamp loggedStartAt / loggedEndAt
  const stampActivity = async (sess: Session, updated: Session) => {
    const now = new Date().toISOString();
    let changed = false;
    const hadDataBefore = sess.entries.some(e=> e.sets.some(st=> (st.weightKg||0)>0 || (st.reps||0)>0));
    const hasDataAfter = updated.entries.some(e=> e.sets.some(st=> (st.weightKg||0)>0 || (st.reps||0)>0));
    if(hasDataAfter && !hadDataBefore && !updated.loggedStartAt){ (updated as any).loggedStartAt = now; changed=true; }
    if(hasDataAfter){ (updated as any).loggedEndAt = now; changed=true; }
    (updated as any).updatedAt = now; changed=true;
    if(changed){ await db.put('sessions', updated); }
    setSession(updated);
  };

  // Monkey patch updateEntry references by defining function used below via closure
  function updateEntryPatched(entry: SessionEntry){
    if(!session) return;
    const next: Session = { ...session, entries: session.entries.map(e=> e.id===entry.id? entry: e) };
    stampActivity(session, next);
  }

  const [initialLoading,setInitialLoading] = useState(true);
  useEffect(() => {
    (async () => {
      console.log("[Sessions] init: waitForSession then fetch lists");
      await waitForSession({ timeoutMs: 4000 });
      const [t,e] = await Promise.all([
        getAllCached('templates'),
        getAllCached('exercises')
      ]);
      console.log(
        "[Sessions] init: templates",
        t.length,
        "exercises",
        e.length
      );
      setTemplates(t);
      setExercises(e);
      // Preload sessions for prev best map
      const allSessions = await getAllCached<Session>('sessions');
      setPrevBestMap(buildPrevBestMap(allSessions, week, phase));
      const st = await getSettings();
      setSettingsState(st as any);
      setInitialLoading(false);
    })();
  }, []);

  // Refetch data when auth session changes (e.g., token refresh or resume)
  useEffect(() => {
    const onAuth = () => {
      (async () => {
        console.log("[Sessions] sb-auth: waitForSession then refetch lists");
        await waitForSession({ timeoutMs: 4000 });
        const [t,e] = await Promise.all([
          getAllCached('templates', { force: true }),
          getAllCached('exercises', { force: true })
        ]);
        console.log(
          "[Sessions] sb-auth: templates",
          t.length,
          "exercises",
          e.length
        );
        setTemplates(t);
        setExercises(e);
        if (session) {
          const fresh = await db.get<Session>("sessions", session.id); // single fetch; not cached (ensure latest entry data)
          console.log(
            "[Sessions] sb-auth: refreshed session entries",
            fresh?.entries?.length || 0
          );
          if (fresh) setSession(fresh);
        }
      })();
    };
    window.addEventListener("sb-auth", onAuth);
    return () => window.removeEventListener("sb-auth", onAuth);
  }, [session?.id]);

  // Lightweight realtime auto-refresh: refetch lists when tables change
  useEffect(() => {
    const onChange = (e: any) => {
      const tbl = e?.detail?.table;
      if (tbl === "templates") db.getAll("templates").then(setTemplates);
      if (tbl === "exercises") db.getAll("exercises").then(setExercises);
      if (tbl === "sessions" && session)
        db.get<Session>("sessions", session.id).then((s) => s && setSession(s));
    };
    window.addEventListener("sb-change", onChange as any);
    return () => window.removeEventListener("sb-change", onChange as any);
  }, [session?.id]);

  // Recompute prev best map whenever week or phase changes
  useEffect(() => {
    (async () => {
      const allSessions = await db.getAll<Session>("sessions");
      setPrevBestMap(buildPrevBestMap(allSessions, week, phase));
    })();
  }, [week, phase]);

  const deloadWeeks = program ? computeDeloadWeeks(program) : new Set<number>();
  const isDeloadWeek = deloadWeeks.has(week);

  // Backfill programId on existing loaded session if missing (one-time effect per session)
  useEffect(() => {
    (async () => {
      if (session && program && !session.programId) {
        const updated = { ...session, programId: program.id };
        await db.put("sessions", updated);
        setSession(updated);
      }
    })();
  }, [session?.id, program?.id]);

  const addSet = (entry: SessionEntry) => {
    const last = [...entry.sets].sort((a,b)=> (a.setNumber||0)-(b.setNumber||0)).slice(-1)[0];
    const next: SetEntry = {
      setNumber: entry.sets.length + 1,
      weightKg: last?.weightKg ?? null,
      reps: last?.reps ?? null,
      rpe: last?.rpe
    };
    updateEntry({ ...entry, sets: [...entry.sets, next] });
  };

  const deleteSet = (entry: SessionEntry, idx: number) => {
    const removed = entry.sets[idx];
    const after = entry.sets
      .filter((_, i) => i !== idx)
      .map((s, i) => ({ ...s, setNumber: i + 1 }));
    const prev = session;
    updateEntry({ ...entry, sets: after });
    push({
      message: "Set deleted",
      actionLabel: "Undo",
      onAction: async () => {
        if (prev) {
          await db.put("sessions", prev);
          setSession(prev);
        }
      }
    });
  };

  const reorderSet = (entry: SessionEntry, from: number, to: number) => {
    const arr = [...entry.sets];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    const renum = arr.map((s, i) => ({ ...s, setNumber: i + 1 }));
    updateEntry({ ...entry, sets: renum });
  };

  // Debounced write buffer for session updates to avoid lag while typing
  const pendingRef = useRef<number | null>(null);
  const latestSessionRef = useRef<Session | null>(null);
  useEffect(()=>{ latestSessionRef.current = session || null; }, [session]);
  const flushSession = async ()=> {
    const sToWrite = latestSessionRef.current; if(!sToWrite) return;
    await db.put('sessions', sToWrite);
    try { window.dispatchEvent(new CustomEvent('sb-change',{ detail:{ table:'sessions' }})); } catch {}
    const s = await getSettings();
    await setSettings({
      ...s,
      dashboardPrefs: {
        ...(s.dashboardPrefs || {}),
        lastLocation: {
          phaseNumber: phase,
          weekNumber: week,
          dayId: day,
          sessionId: sToWrite.id,
        },
      },
    });
  };
  const scheduleFlush = ()=> {
    if(pendingRef.current) window.clearTimeout(pendingRef.current);
    pendingRef.current = window.setTimeout(()=> { flushSession(); pendingRef.current = null; }, 750); // 750ms debounce
  };
  // Flush pending session edits when page becomes hidden or before unload to preserve latest activity timestamps
  useEffect(()=> {
    const onVis = ()=> { if(document.hidden && pendingRef.current){ flushSession(); } };
    const onBefore = ()=> { if(pendingRef.current){ flushSession(); } };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('beforeunload', onBefore);
    return ()=> { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('beforeunload', onBefore); };
  }, []);
  const updateEntry = (entry: SessionEntry) => {
    if (!session) return;
    const prevSession = session;
    const prevEntry = session.entries.find(e=> e.id===entry.id);
    const newEntries = session.entries.map((e) => e.id === entry.id ? entry : e);
    let updated = { ...session, entries: newEntries } as Session;
    // If session previously had no working sets and now has at least one, re-stamp date to today
    const hadWorkBefore = prevSession.entries.some(en => en.sets.some(s=> (s.reps||0)>0 || (s.weightKg||0)>0));
    const hasWorkNow = newEntries.some(en => en.sets.some(s=> (s.reps||0)>0 || (s.weightKg||0)>0));
    if(!hadWorkBefore && hasWorkNow){
      const today = new Date();
      const localDayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
      const prevLocal = prevSession.localDate || prevSession.dateISO.slice(0,10);
      if(prevLocal !== localDayStr){
        const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
        updated = { ...updated, dateISO: startOfDay.toISOString(), localDate: localDayStr };
      }
    }
    // Stamp activity (debounced write later)
    if(hasWorkNow){
      const nowIso = new Date().toISOString();
      if(!updated.loggedStartAt) (updated as any).loggedStartAt = nowIso;
      (updated as any).loggedEndAt = nowIso;
    }
    (updated as any).updatedAt = new Date().toISOString();
  setSession(updated);
  latestSessionRef.current = updated;
  scheduleFlush();
  };

  const removeEntry = async (entryId: string) => {
    if (!session) return;
    const cfg = await getSettings();
    if (cfg.confirmDestructive) {
      const exName =
        exercises.find(
          (e) =>
            e.id === session.entries.find((x) => x.id === entryId)?.exerciseId
        )?.name || "exercise";
      if (!window.confirm(`Remove ${exName} from this session?`)) return;
    }
    const prev = session;
    const updated = {
      ...session,
      entries: session.entries.filter((e) => e.id !== entryId),
    };
    setSession(updated);
    await db.put("sessions", updated);
    const undo = async () => {
      setSession(prev);
      await db.put("sessions", prev);
    };
  setLastAction({ undo });
  push({ message: "Exercise removed", actionLabel: "Undo", onAction: undo });
  };

  const addExerciseToSession = async (ex: Exercise) => {
    if (!session) return;
    let sets: SetEntry[] = [];
    const lastSets = await getLastWorkingSets(ex.id, week, phase);
    if (isDeloadWeek) {
      const dl = await getDeloadPrescription(ex.id, week, { deloadWeeks });
      const avgReps = lastSets.length
        ? Math.round(
            lastSets.reduce((a, b) => a + (b.reps || 8), 0) / lastSets.length
          )
        : 8;
      sets = Array.from({ length: dl.targetSets }, (_, i) => ({
        setNumber: i + 1,
        weightKg: dl.targetWeight,
        reps: avgReps,
      }));
    } else {
      sets = lastSets.length
        ? lastSets
        : [{ setNumber: 1, weightKg: 0, reps: 0 }];
    }
    const entry: SessionEntry = { id: nanoid(), exerciseId: ex.id, sets };
    const updated = { ...session, entries: [...session.entries, entry] };
    // If this addition brings in working data immediately, stamp
    const hasWorkNow = updated.entries.some(en => en.sets.some(s=> (s.reps||0)>0 || (s.weightKg||0)>0));
    if(hasWorkNow){
      const nowIso = new Date().toISOString();
      if(!updated.loggedStartAt) (updated as any).loggedStartAt = nowIso;
      (updated as any).loggedEndAt = nowIso;
    }
    (updated as any).updatedAt = new Date().toISOString();
    setSession(updated);
    await db.put("sessions", updated);
    try {
      window.dispatchEvent(
        new CustomEvent("sb-change", { detail: { table: "sessions" } })
      );
    } catch {}
    const s = await getSettings();
    await setSettings({
      ...s,
      dashboardPrefs: {
        ...(s.dashboardPrefs || {}),
        lastLocation: {
          phaseNumber: phase,
          weekNumber: week,
          dayId: day,
          sessionId: updated.id,
        },
      },
    });
  };

  const createCustomExercise = async (name: string) => {
    const clean = name.trim().replace(/\s+/g,' ').slice(0,60);
    if(!clean){ return; }
    const ex: Exercise = {
      id: nanoid(),
      name: clean,
      muscleGroup: "other",
      defaults: { sets: 3, targetRepRange: "8-12" },
    };
    await db.put("exercises", ex);
    setExercises([ex, ...exercises]);
    await addExerciseToSession(ex);
  };

  const deloadInfo = async (exerciseId: string) =>
    getDeloadPrescription(exerciseId, week, { deloadWeeks });

  const reorderEntry = async (from: number, to: number) => {
    if (
      !session ||
      from === to ||
      from < 0 ||
      to < 0 ||
      from >= session.entries.length ||
      to >= session.entries.length
    )
      return;
    const arr = [...session.entries];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    const updated = { ...session, entries: arr };
    setSession(updated);
    await db.put("sessions", updated);
  };

  // Manually stamp the session with today's local date (overrides previous date)
  const stampToday = async () => {
    if (!session) return;
    const today = new Date();
    const localDayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
    if (session.localDate === localDayStr) {
      push({ message: "Already stamped for today" });
      return;
    }
    const prev = session;
    const updated: Session = { ...session, dateISO: startOfDay.toISOString(), localDate: localDayStr };
    setSession(updated);
    await db.put('sessions', updated);
    try { window.dispatchEvent(new CustomEvent('sb-change', { detail: { table: 'sessions' } })); } catch {}
    try { navigator.vibrate?.(15); } catch {}
    push({
      message: `Session dated ${displayDate(localDayStr)}`,
      actionLabel: 'Undo',
      onAction: async () => {
        await db.put('sessions', prev);
        setSession(prev);
      }
    });
  };

  // Save manually selected date (subtle edit control)
  const saveManualDate = async () => {
    if(!session) return;
  if(!/\d{4}-\d{2}-\d{2}/.test(dateEditValue)) { push({ message:'Invalid date' }); return; }
    if(session.localDate === dateEditValue) { setEditingDate(false); return; }
    const prev = session;
    const d = new Date(dateEditValue + 'T00:00:00');
    d.setHours(0,0,0,0);
    const updated: Session = { ...session, dateISO: d.toISOString(), localDate: dateEditValue };
    setSession(updated);
    await db.put('sessions', updated);
    try { window.dispatchEvent(new CustomEvent('sb-change', { detail: { table: 'sessions' } })); } catch {}
    setEditingDate(false);
  push({ message:`Date set to ${dateEditValue}`, actionLabel:'Undo', onAction: async ()=> { await db.put('sessions', prev); setSession(prev); try { window.dispatchEvent(new CustomEvent('sb-change',{detail:{table:'sessions'}})); } catch {} } });
  };

  // Display helper: convert yyyy-mm-dd to dd/mm/yyyy for UI
  const displayDate = (isoLike?: string) => {
    if(!isoLike) return '';
    if(/\d{4}-\d{2}-\d{2}/.test(isoLike)) { const [y,m,d] = isoLike.split('-'); return `${d}/${m}/${y}`; }
    return isoLike;
  };

  const sessionDuration = (()=> {
    if(!session?.loggedStartAt || !session.loggedEndAt) return null;
    const start = new Date(session.loggedStartAt).getTime();
    const end = new Date(session.loggedEndAt).getTime();
    if(isNaN(start)||isNaN(end)|| end < start) return null;
    const ms = end - start;
    const mins = Math.floor(ms/60000);
    const hrs = Math.floor(mins/60);
    const remMins = mins % 60;
    if(hrs>0) return `${hrs}h ${remMins}m`;
    return `${mins}m`;
  })();

  return (
    <div className="space-y-4 overflow-x-hidden">
  {/* Removed mobile floating Add Exercise button (user preference) */}
      {/* Fixed selectors bar under main app header */}
      <div className="fixed left-0 right-0" style={{ top: 'calc(var(--app-header-h) + 4px)' }} ref={toolbarRef}>
        <div className="flex flex-wrap items-center gap-2 px-4 pt-2 pb-1 bg-[rgba(17,24,39,0.80)] backdrop-blur border-b border-white/10 rounded-b-2xl shadow-sm">
          <h2 className="text-xl font-semibold">Sessions</h2>
          <PhaseStepper value={phase} onChange={async (p)=> { setPhase(p); const s=await getSettings(); await setSettings({ ...s, currentPhase: p }); }} />
          <div className="flex items-center gap-2">
            <select className="bg-card rounded-xl px-2 py-1" value={week} onChange={(e)=> setWeek(Number(e.target.value))}>
              {(program ? Array.from({length: program.mesoWeeks},(_,i)=> i+1) : Array.from({length:9},(_,i)=> i+1)).map(w=> <option key={w} value={w}>Week {w}{program && deloadWeeks.has(w) ? ' (Deload)' : ''}</option>)}
            </select>
            <DaySelector
              labels={(program ? program.weeklySplit.map((d:any)=> d.customLabel || d.type) : DAYS)}
              value={day}
              onChange={setDay}
            />
            {program && <button className="text-xs px-2 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10" onClick={()=> (window.location.hash = '#/settings/program')} title="Edit program">{programSummary(program)}</button>}
            {session?.autoImportedTemplateId && <span className="badge" title="Auto-imported template applied">Template</span>}
            {/* Mobile expand/collapse all toggle */}
            {session && !!session.entries.length && (
              <button
                className="sm:hidden w-8 h-8 rounded-lg border border-white/15 bg-slate-800/90 hover:bg-slate-700 active:scale-95 flex items-center justify-center text-[15px] shadow-sm"
                aria-label={allCollapsed? 'Expand all exercises' : 'Collapse all exercises'}
                title={allCollapsed? 'Expand all exercises' : 'Collapse all exercises'}
                onClick={()=> { if(allCollapsed) expandAll(); else collapseAll(); try { navigator.vibrate?.(8);} catch{} }}
              >
                <span className="leading-none select-none">{allCollapsed? '↓':'↑'}</span>
              </button>
            )}
          </div>
          {/* Date / stamp block */}
          {session && (
            <div className="flex items-center gap-1 text-[11px] bg-slate-800 rounded-xl px-2 py-1 ml-auto" title="Current assigned date (edit or stamp)">
              {!editingDate && (
                <span className="font-mono tracking-tight" title={session.localDate || session.dateISO.slice(0,10)}>{displayDate(session.localDate || session.dateISO.slice(0,10))}</span>
              )}
              {editingDate && (
                <div className="flex items-center gap-1">
                  <input
                    type="date"
                    className="bg-slate-900 rounded px-1 py-0.5 text-[11px]"
                    value={dateEditValue}
                    onChange={(e) => setDateEditValue(e.target.value)}
                  />
                  <button
                    className="text-[10px] bg-emerald-700 rounded px-2 py-0.5"
                    onClick={saveManualDate}
                  >
                    Save
                  </button>
                  <button
                    className="text-[10px] bg-slate-700 rounded px-2 py-0.5"
                    onClick={() => setEditingDate(false)}
                  >
                    Cancel
                  </button>
                </div>
              )}
              {!editingDate && (
                <>
                  <button
                    className={`text-[10px] bg-slate-700 rounded px-2 py-0.5 hover:bg-slate-600 relative overflow-hidden ${stampAnimating? 'animate-stamp':''}`}
                    onClick={() => { setStampAnimating(true); setTimeout(()=> setStampAnimating(false), 360); stampToday(); }}
                    aria-label="Stamp with today's date"
                  >
                    <span className="pointer-events-none select-none">Stamp</span>
                  </button>
                  <button
                    aria-label="Edit date"
                    className="text-[10px] bg-slate-700 rounded px-2 py-0.5 hover:bg-slate-600"
                    onClick={() => {
                      setDateEditValue(
                        session.localDate || session.dateISO.slice(0, 10)
                      );
                      setEditingDate(true);
                    }}
                  >
                    ✎
                  </button>
                </>
              )}
              {sessionDuration && !editingDate && (
                <span className="ml-1 px-2 py-0.5 rounded bg-indigo-600/40 text-indigo-200 font-medium" title="Active logging duration (first to last non-zero set)">⏱ {sessionDuration}</span>
              )}
            </div>
          )}
        </div>
      </div>
  {/* Spacer dynamic */}
  <div style={{ height: `calc(var(--app-header-h) + ${toolbarHeight}px + 14px)` }} aria-hidden="true" />
  {/* Non-sticky actions */}
  <div className="flex flex-wrap items-center gap-2 mt-2">
        <div className="hidden sm:flex items-center gap-2">
          <button className="bg-brand-600 hover:bg-brand-700 px-3 py-2 rounded-xl" onClick={()=> setShowImport(true)}>Import from Template</button>
          <button className="bg-emerald-700 px-3 py-2 rounded-xl" title="Start next 9-week phase" onClick={async ()=> {
            const all = await db.getAll<Session>('sessions');
            const curPhaseSessions = all.filter(s=> (s.phaseNumber||s.phase||1)===phase);
            const hasReal = curPhaseSessions.some(s=> s.entries.some(e=> e.sets.some(st=> (st.weightKg||0)>0 || (st.reps||0)>0)));
            if(!hasReal){ if(!window.confirm('No real training data logged in this phase. Advance anyway?')) return; } else { if(!window.confirm('Advance to next phase? This will reset week to 1.')) return; }
            const s = await getSettings(); const next=(s.currentPhase||1)+1; await setSettings({ ...s, currentPhase: next }); setPhase(next as number); setWeek(1 as any); setDay(0);
          }}>Next phase →</button>
          {phase>1 && <button className="bg-slate-700 px-3 py-2 rounded-xl" title="Revert to previous phase" onClick={async ()=> { if(!window.confirm('Revert to phase '+(phase-1)+'?')) return; const s=await getSettings(); const prev=Math.max(1,(s.currentPhase||1)-1); await setSettings({ ...s, currentPhase: prev }); setPhase(prev); setWeek(1 as any); setDay(0); }}>← Prev phase</button>}
          <button className="bg-slate-700 px-3 py-2 rounded-xl" onClick={async ()=> { if(!session) return; const prevId = `${phase}-${Math.max(1,(week as number)-1)}-${day}`; let prev = await db.get<Session>('sessions', prevId); if(!prev && week===1 && phase>1){ prev = await db.get<Session>('sessions', `${phase-1}-9-${day}`); } if(prev){ const copy: Session={ ...session, entries: prev.entries.map(e=> ({ ...e, id: nanoid(), sets: e.sets.map((s,i)=> ({ ...s, setNumber: i+1 })) })) }; setSession(copy); await db.put('sessions', copy); } }}>Copy last session</button>
        </div>
        {/* Mobile inline compact tools */}
        <div className="w-full sm:hidden relative mt-2">
          <div className="flex items-center">
            <button
              className={`inline-flex items-center justify-center h-9 w-9 rounded-xl border border-white/10 bg-slate-800/80 backdrop-blur shadow-sm active:scale-95 transition-all ${moreOpen? 'rotate-180 text-emerald-300':'text-slate-300'}`}
              onClick={()=> setMoreOpen(o=> !o)}
              aria-expanded={moreOpen}
              aria-controls="mobile-tools-panel"
              aria-label={moreOpen? 'Hide tools' : 'Show tools'}
            >
              <span className="text-base leading-none select-none">▾</span>
            </button>
          </div>
          <div
            id="mobile-tools-panel"
            className={`transition-all overflow-hidden ${moreOpen? 'mt-3 max-h-[420px] opacity-100':'max-h-0 opacity-0'} duration-300`}
            aria-hidden={!moreOpen}
          >
            <div className="grid grid-cols-2 gap-2 text-[11px] p-1 rounded-2xl bg-slate-800/70 border border-white/10 backdrop-blur-sm">
              {session && <button className="tool-btn" onClick={()=> { stampToday(); setMoreOpen(false); }} title="Stamp with today's date">Stamp</button>}
              <button className="tool-btn" onClick={()=> { setShowImport(true); setMoreOpen(false); }} title="Import from template">Import</button>
              <button className="tool-btn" onClick={async ()=> { const s=await getSettings(); const next=(s.currentPhase||1)+1; await setSettings({ ...s, currentPhase: next }); setPhase(next as number); setWeek(1 as any); setDay(0); setMoreOpen(false); }} title="Next phase">Next →</button>
              {phase>1 && <button className="tool-btn" onClick={async ()=> { if(!window.confirm('Revert to phase '+(phase-1)+'?')) return; const s=await getSettings(); const prev=Math.max(1,(s.currentPhase||1)-1); await setSettings({ ...s, currentPhase: prev }); setPhase(prev); setWeek(1 as any); setDay(0); setMoreOpen(false); }} title="Previous phase">← Prev</button>}
              {session && <button className="tool-btn col-span-2" onClick={async ()=> { const prevId=`${phase}-${Math.max(1,(week as number)-1)}-${day}`; let prev = await db.get<Session>('sessions', prevId); if(!prev && week===1 && phase>1){ prev = await db.get<Session>('sessions', `${phase-1}-9-${day}`); } if(prev){ const copy: Session={...session, entries: prev.entries.map(e=> ({...e, id: nanoid(), sets: e.sets.map((s,i)=> ({...s, setNumber: i+1}))}))}; setSession(copy); await db.put('sessions', copy);} setMoreOpen(false); }} title="Copy previous session">Copy Last</button>}
              {session && <button className="tool-btn" onClick={()=> { collapseAll(); }} title="Collapse all exercises">Collapse All</button>}
              {session && <button className="tool-btn" onClick={()=> { expandAll(); }} title="Expand all exercises">Expand All</button>}
              {sessionDuration && <div className="col-span-2 text-center text-indigo-300 bg-indigo-500/10 rounded-lg py-1">⏱ {sessionDuration}</div>}
            </div>
          </div>
        </div>
      </div>
      {/* Legacy floating more panel removed in favor of inline collapsible */}
      {isDeloadWeek && (
        <div
          className="text-xs text-amber-300 fade-in inline-flex items-center gap-1"
          data-shape="deload"
          aria-label="Deload week adjustments are active"
        >
          Deload adjustments active
        </div>
      )}

  <div className="space-y-3">
        {initialLoading && <div className="space-y-2">
          <div className="h-6 w-40 bg-white/5 rounded animate-pulse" />
          <div className="h-24 bg-white/5 rounded animate-pulse" />
        </div>}
  {session?.entries.map((entry, entryIdx) => {
          const ex = exercises.find((e) => e.id === entry.exerciseId);
          // derive previous best + nudge
          const prev = prevBestMap
            ? getPrevBest(prevBestMap, entry.exerciseId)
            : undefined;
          const currentBest = (() => {
            const best = [...entry.sets].sort((a, b) => {
              if ((b.weightKg ?? 0) !== (a.weightKg ?? 0)) return (b.weightKg ?? 0) - (a.weightKg ?? 0);
              return (b.reps || 0) - (a.reps || 0);
            })[0];
            return best;
          })();
          const showPrevHints = settingsState?.progress?.showPrevHints ?? true;
          const showNudge = !!(
            showPrevHints &&
            prev &&
            currentBest &&
            currentBest.weightKg === prev.set.weightKg &&
            currentBest.reps === prev.set.reps
          );
          const isCollapsed = !!collapsedEntries[entry.id];
          // quick metrics for collapsed overview
          const setsLogged = entry.sets.filter(s=> (s.reps||0)>0 || (s.weightKg||0)>0);
          const tonnage = setsLogged.reduce((a,s)=> a + (s.weightKg||0)*(s.reps||0),0);
          const bestSet = setsLogged.slice().sort((a,b)=> ((b.weightKg||0)*(b.reps||0)) - ((a.weightKg||0)*(a.reps||0)))[0];
          return (
            <div
              key={entry.id}
              className="bg-card rounded-2xl p-4 shadow-soft fade-in reorder-anim group"
              draggable
              onDragStart={(e) => { setDragEntryIdx(entryIdx); e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain', String(entryIdx)); }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const from = dragEntryIdx ?? Number(e.dataTransfer.getData('text/plain'));
                if (from != null) {
                  reorderEntry(from, entryIdx);
                  setDragEntryIdx(null);
                  try { if('vibrate' in navigator) (navigator as any).vibrate?.(10); } catch {}
                }
              }}
              onTouchStart={(e)=> {
                // Long press (550ms) to start reorder; provides haptic feedback
                const target = e.currentTarget; let started=false; const idx=entryIdx;
                const timer = window.setTimeout(()=> {
                  started=true; setDragEntryIdx(idx);
                  target.classList.add('ring-app');
                  try { if('vibrate' in navigator) (navigator as any).vibrate?.(18); } catch {}
                  setTimeout(()=> target.classList.remove('ring-app'), 900);
                }, 550);
                const cancel = ()=> { clearTimeout(timer); if(!started) target.classList.remove('ring-app'); target.removeEventListener('touchend', cancel); target.removeEventListener('touchmove', cancel); target.removeEventListener('touchcancel', cancel); };
                target.addEventListener('touchend', cancel, { passive:true });
                target.addEventListener('touchmove', cancel, { passive:true });
                target.addEventListener('touchcancel', cancel, { passive:true });
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium flex items-center gap-2 flex-wrap cursor-pointer select-none" onClick={()=> toggleEntryCollapsed(entry.id)} aria-expanded={!isCollapsed} aria-controls={`entry-${entry.id}-sets`} role="button" tabIndex={0} onKeyDown={(e)=> { if(e.key==='Enter' || e.key===' '){ e.preventDefault(); toggleEntryCollapsed(entry.id); } }}>
                  <span className="hidden sm:inline-block cursor-grab select-none opacity-40 group-hover:opacity-100 drag-handle" title="Drag to reorder" aria-label="Drag to reorder">⋮⋮</span>
                  <span className="inline-flex items-center gap-1">
                    <span>{ex?.name || "Exercise"}</span>
                    <span className={`transition-transform text-xs opacity-70 ${isCollapsed? 'rotate-180':''}`}>▾</span>
                  </span>
                  {ex?.isOptional && (
                    <span className="text-[10px] text-gray-400">optional</span>
                  )}
                  {isCollapsed && (
                    <span className="ml-2 text-[10px] px-2 py-1 rounded bg-slate-700/60 text-slate-200 flex items-center gap-2">
                      <span>{entry.sets.length} sets</span>
                      {tonnage>0 && <span className="opacity-70">• {(tonnage).toLocaleString()}</span>}
                      {bestSet && <span className="opacity-70">• {bestSet.weightKg}×{bestSet.reps}</span>}
                    </span>
                  )}
                  {/* Mobile reorder buttons */}
                  <div className="flex sm:hidden items-center gap-1 text-[10px] ml-auto">
                    <button disabled={entryIdx===0} className="px-2 py-1 rounded bg-slate-700 disabled:opacity-40" onClick={()=> reorderEntry(entryIdx, Math.max(0, entryIdx-1))}>Up</button>
                    <button disabled={entryIdx=== (session.entries.length-1)} className="px-2 py-1 rounded bg-slate-700 disabled:opacity-40" onClick={()=> reorderEntry(entryIdx, Math.min(session.entries.length-1, entryIdx+1))}>Down</button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isDeloadWeek && (
                    <span data-shape="deload">
                      <AsyncChip promise={deloadInfo(entry.exerciseId)} />
                    </span>
                  )}
                  <button
                    aria-label="Remove exercise"
                    className="text-xs bg-slate-800 rounded-xl px-2 py-1"
                    onClick={() => removeEntry(entry.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
              <AnimatePresence initial={false}>
              {!isCollapsed && showPrevHints && prev && (
                <motion.div
                  className="mt-1 flex items-center gap-2 flex-wrap"
                  key="prevhints"
                  variants={maybeDisable(fadeSlideUp)}
                  initial="initial" animate="animate" exit="exit"
                >
                  <span
                    className="prev-hint-pill"
                    aria-label={`Previous best set: ${prev.set.weightKg} kilograms for ${prev.set.reps} reps`}
                    title="Last logged best set"
                  >
                    <span className="opacity-70">Prev:</span>
                    <span>{prev.set.weightKg}</span>
                    <span>×</span>
                    <span>{prev.set.reps}</span>
                  </span>
                  {showNudge && (
                    <span className="prev-hint-pill" data-nudge="true">
                      Try +1 rep or +2.5kg?
                    </span>
                  )}
                </motion.div>
              )}
              </AnimatePresence>
              <AnimatePresence initial={false}>
              {!isCollapsed && (
                <motion.div key="setsBlock" initial={{height:0, opacity:0}} animate={{height:'auto', opacity:1}} exit={{height:0, opacity:0}} transition={{duration:.28, ease:[0.32,0.72,0.33,1]}} style={{overflow:'hidden'}}>
              {/* Sets - mobile friendly list */}
              <div id={`entry-${entry.id}-sets`} className="mt-3 sm:hidden space-y-2">
                {entry.sets.map((set, idx) => (
                  <div key={idx} className="rounded-xl bg-slate-800 px-2 py-2">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium flex items-center gap-2">
                        <span className="text-gray-300">
                          Set {set.setNumber}
                        </span>
                        {idx===0 && (set.weightKg||0)===0 && (set.reps||0)===0 && suggestions.get(entry.exerciseId) && (
                          <span className="text-[10px] text-emerald-300 bg-emerald-600/20 px-1.5 py-0.5 rounded" title="Suggested progression (enter manually to apply)">
                            {(() => { const s = suggestions.get(entry.exerciseId)!; return `${s.weightKg ?? ''}${s.weightKg? 'kg':''}${s.reps? ` x ${s.reps}`:''}`; })()}
                          </span>
                        )}
                        <PRChip
                          exerciseId={entry.exerciseId}
                          score={(set.weightKg ?? 0) * (set.reps ?? 0)}
                          week={week}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="text-[11px] bg-slate-700 rounded px-2 py-1"
                          disabled={idx === 0}
                          onClick={() => reorderSet(entry, idx, idx - 1)}
                        >
                          Up
                        </button>
                        <button
                          className="text-[11px] bg-slate-700 rounded px-2 py-1"
                          disabled={idx === entry.sets.length - 1}
                          onClick={() => reorderSet(entry, idx, idx + 1)}
                        >
                          Down
                        </button>
                        <button
                          className="text-[11px] bg-red-600 rounded px-2 py-1"
                          onClick={() => deleteSet(entry, idx)}
                        >
                          Del
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-slate-900/40 rounded-xl px-2 py-2">
                        <div className="text-[11px] text-gray-400 mb-1">
                          Weight
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            className="bg-slate-700 rounded px-3 py-2"
                            onClick={() =>
                              updateEntry({
                                ...entry,
                                sets: entry.sets.map((s, i) =>
                                  i === idx
                                    ? {
                                        ...s,
                                        weightKg: Math.max(
                                          0,
                                          (s.weightKg || 0) - 2.5
                                        ),
                                      }
                                    : s
                                ),
                              })
                            }
                          >
                            -
                          </button>
                          <input
                            type="text"
                            inputMode="decimal"
                            pattern="[0-9]*[.,]?[0-9]*"
                            aria-label="Weight"
                            className="bg-slate-900 rounded-xl px-3 py-2 w-full text-center"
                            data-set-input="true"
                            data-entry-id={entry.id}
                            data-set-number={set.setNumber}
                            value={weightInputEditing.current[`${entry.id}:${set.setNumber}`] ?? formatOptionalNumber(set.weightKg)}
                            placeholder="0"
                            onKeyDown={(e) => {
                              if (e.key === 'ArrowUp') { e.preventDefault(); updateEntry({ ...entry, sets: entry.sets.map((s,i)=> i===idx? { ...s, weightKg: (s.weightKg||0)+2.5 }: s) }); }
                              else if (e.key === 'ArrowDown') { e.preventDefault(); updateEntry({ ...entry, sets: entry.sets.map((s,i)=> i===idx? { ...s, weightKg: Math.max(0,(s.weightKg||0)-2.5) }: s) }); }
                            }}
                            onChange={(e)=> {
                              let v=e.target.value; if(v.includes(',')) v=v.replace(',','.'); if(!/^\d*(?:[.,]\d*)?$/.test(v)) return; weightInputEditing.current[`${entry.id}:${set.setNumber}`]=v; if(v===''||/[.,]$/.test(v)) return; const num = parseOptionalNumber(v); updateEntry({ ...entry, sets: entry.sets.map((s,i)=> i===idx? { ...s, weightKg: num }: s) });
                            }}
                            onBlur={(e)=> { let v=e.target.value; if(v.includes(',')) v=v.replace(',','.'); const num = parseOptionalNumber(v.replace(/\.$/,'')); updateEntry({ ...entry, sets: entry.sets.map((s,i)=> i===idx? { ...s, weightKg: num }: s) }); delete weightInputEditing.current[`${entry.id}:${set.setNumber}`]; }}
                          />
                          <button
                            className="bg-slate-700 rounded px-3 py-2"
                            onClick={() =>
                              updateEntry({
                                ...entry,
                                sets: entry.sets.map((s, i) =>
                                  i === idx
                                    ? {
                                        ...s,
                                        weightKg: (s.weightKg || 0) + 2.5,
                                      }
                                    : s
                                ),
                              })
                            }
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div className="bg-slate-900/40 rounded-xl px-2 py-2">
                        <div className="text-[11px] text-gray-400 mb-1">
                          Reps
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            className="bg-slate-700 rounded px-3 py-2"
                            onClick={() =>
                              updateEntry({
                                ...entry,
                                sets: entry.sets.map((s, i) =>
                                  i === idx
                                    ? {
                                        ...s,
                                        reps: Math.max(0, (s.reps || 0) - 1),
                                      }
                                    : s
                                ),
                              })
                            }
                          >
                            -
                          </button>
                          <input
                            inputMode="numeric"
                            aria-label="Reps"
                            className="bg-slate-900 rounded-xl px-3 py-2 w-full text-center"
                            data-set-input="true"
                            data-entry-id={entry.id}
                            data-set-number={set.setNumber}
                            value={repsInputEditing.current[`${entry.id}:${set.setNumber}`] ?? (set.reps == null ? '' : String(set.reps))}
                            placeholder="0"
                            onKeyDown={(e)=> {
                              if(e.key==='ArrowUp'){
                                e.preventDefault();
                                updateEntry({ ...entry, sets: entry.sets.map((s,i)=> i===idx? { ...s, reps: (s.reps||0)+1 }: s) });
                              } else if(e.key==='ArrowDown'){
                                e.preventDefault();
                                updateEntry({ ...entry, sets: entry.sets.map((s,i)=> i===idx? { ...s, reps: Math.max(0,(s.reps||0)-1) }: s) });
                              } else if(e.key==='Enter'){
                                const buf = repsInputEditing.current[`${entry.id}:${set.setNumber}`];
                                if(buf!==undefined){
                                  const num = buf===''? null: Number(buf);
                                  updateEntry({ ...entry, sets: entry.sets.map((s,i)=> i===idx? { ...s, reps: num }: s) });
                                  delete repsInputEditing.current[`${entry.id}:${set.setNumber}`];
                                }
                              }
                            }}
                            onChange={(e)=> { const v=e.target.value; if(!/^\d*$/.test(v)) return; repsInputEditing.current[`${entry.id}:${set.setNumber}`]=v; if(v==='') return; updateEntry({ ...entry, sets: entry.sets.map((s,i)=> i===idx? { ...s, reps: Number(v) }: s) }); }}
                            onBlur={(e)=> { const v=e.target.value; const num = v===''? null: Number(v); updateEntry({ ...entry, sets: entry.sets.map((s,i)=> i===idx? { ...s, reps: num }: s) }); delete repsInputEditing.current[`${entry.id}:${set.setNumber}`]; }}
                          />
                          <button
                            className="bg-slate-700 rounded px-3 py-2"
                            onClick={() =>
                              updateEntry({
                                ...entry,
                                sets: entry.sets.map((s, i) =>
                                  i === idx ? { ...s, reps: (s.reps || 0) + 1 } : s
                                ),
                              })
                            }
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                    {/* Removed per-set rest controls */}
                  </div>
                ))}
                <button
                  className="w-full text-center text-[11px] bg-slate-700 rounded-xl px-3 py-2"
                  onClick={()=> addSet(entry)}
                >Add Set</button>
                {/* Exercise-level rest control (mobile) */}
                <div className="pt-1 flex items-center justify-end gap-3">
                  <button
                    className={`px-3 py-1.5 rounded-lg bg-slate-700 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/60 text-xs ${restTimers[entry.id]?.running? 'bg-emerald-700 text-emerald-50 shadow-inner':''}`}
                    onClick={()=> restartRestTimer(entry.id)}
                    aria-label={restTimers[entry.id]? 'Restart rest timer':'Start rest timer'}
                  >{restTimers[entry.id]? 'Restart Rest':'Start Rest'}</button>
                  <div className="flex items-center gap-1 ml-1">
                    {restTimerDisplay(entry.id)}
                    {restTimers[entry.id] && (
                      <button
                        className="px-2 py-1 rounded-md bg-slate-700 hover:bg-slate-600 text-[10px] text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/60"
                        aria-label="Stop rest timer"
                        onClick={()=> stopRestTimer(entry.id)}
                      >×</button>
                    )}
                  </div>
                </div>
              </div>

              {/* Sets grid with drag-and-drop (desktop) */}
              <div className="mt-3 hidden sm:grid grid-cols-[auto,1fr,1fr,auto] gap-2 items-center" role="list" aria-label={`Sets for exercise ${entry.exerciseId}`}> 
                <div className="text-sm text-gray-400">Set</div>
                <div className="text-sm text-gray-400">Weight</div>
                <div className="text-sm text-gray-400">Reps</div>
                <div></div>
                {entry.sets.map((set, idx) => (
                  <div
                    key={idx}
                    className="contents"
                    role="listitem"
                    aria-roledescription="Draggable set row"
                    aria-label={`Set ${set.setNumber} weight ${set.weightKg||0} reps ${set.reps||0}`}
                    draggable
                    onDragStart={(ev) => {
                      (entry as any)._dragSet = idx;
                      ev.dataTransfer.setData('text/plain', String(idx));
                      ev.currentTarget.setAttribute('aria-grabbed','true');
                    }}
                    onDragEnd={(ev)=> ev.currentTarget.removeAttribute('aria-grabbed')}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      const from = (entry as any)._dragSet;
                      if (typeof from === "number") {
                        reorderSet(entry, from, idx);
                        (entry as any)._dragSet = undefined;
                      }
                    }}
                  >
                    <div className="px-2">{set.setNumber}</div>
                    <div className="flex items-center gap-1">
                      <button
                        className="text-xs bg-slate-700 rounded px-2"
                        onClick={() =>
                          updateEntry({
                            ...entry,
                            sets: entry.sets.map((s, i) =>
                              i === idx
                                ? {
                                    ...s,
                                    weightKg: Math.max(
                                      0,
                                      (s.weightKg || 0) - 2.5
                                    ),
                                  }
                                : s
                            ),
                          })
                        }
                      >
                        -
                      </button>
                      <div className="relative w-24">
                        <input
                          inputMode="decimal"
                          pattern="[0-9]*[.,]?[0-9]*"
                          aria-label="Weight"
                          className="bg-slate-800 rounded-xl px-3 py-2 w-full text-center"
                          data-set-input="true"
                          data-entry-id={entry.id}
                          data-set-number={set.setNumber}
                          value={weightInputEditing.current[`${entry.id}:${set.setNumber}`] ?? (set.weightKg || set.weightKg===0 ? String(set.weightKg) : '')}
                          placeholder={(() => { if((set.weightKg||0)>0) return '0'; const sug = suggestions.get(entry.exerciseId); return sug?.weightKg ? String(sug.weightKg) : '0.0'; })()}
                          onKeyDown={(e) => {
                            if (e.key === "ArrowUp") {
                              e.preventDefault();
                              updateEntry({
                                ...entry,
                                sets: entry.sets.map((s, i) =>
                                  i === idx
                                    ? { ...s, weightKg: (s.weightKg || 0) + 2.5 }
                                    : s
                                ),
                              });
                            } else if (e.key === "ArrowDown") {
                              e.preventDefault();
                              updateEntry({
                                ...entry,
                                sets: entry.sets.map((s, i) =>
                                  i === idx
                                    ? {
                                        ...s,
                                        weightKg: Math.max(
                                          0,
                                          (s.weightKg || 0) - 2.5
                                        ),
                                      }
                                    : s
                                ),
                              });
                            }
                          }}
                          onChange={(e) => {
                            let v = e.target.value;
                            if(v.includes(',')) v = v.replace(',','.');
                            if (!/^\d*(?:[.,]\d*)?$/.test(v)) return;
                            weightInputEditing.current[`${entry.id}:${set.setNumber}`] = v;
                            if(v === '' || /[.,]$/.test(v)) return;
                            const num = Number(v);
                            if(!isNaN(num)){
                              updateEntry({
                                ...entry,
                                sets: entry.sets.map((s, i) => i===idx ? { ...s, weightKg: num } : s)
                              });
                            }
                          }}
                          onBlur={(e)=> {
                            let v = e.target.value;
                            if(v.includes(',')) v = v.replace(',','.');
                            if(!/^\d*(?:[.,]\d*)?$/.test(v)) return;
                            const num = v === ''? 0 : Number(v.replace(/\.$/,''));
                            updateEntry({
                              ...entry,
                              sets: entry.sets.map((s,i)=> i===idx ? { ...s, weightKg: isNaN(num)? 0 : num } : s)
                            });
                            delete weightInputEditing.current[`${entry.id}:${set.setNumber}`];
                          }}
                        />
                        {(!set.weightKg || set.weightKg===0) && suggestions.get(entry.exerciseId)?.weightKg && (
                          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] text-emerald-500/40 font-medium">
                            {suggestions.get(entry.exerciseId)?.weightKg}kg
                          </span>
                        )}
                      </div>
                      <button
                        className="text-xs bg-slate-700 rounded px-2"
                        onClick={() =>
                          updateEntry({
                            ...entry,
                            sets: entry.sets.map((s, i) =>
                              i === idx
                                ? { ...s, weightKg: (s.weightKg || 0) + 2.5 }
                                : s
                            ),
                          })
                        }
                      >
                        +
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        className="text-xs bg-slate-700 rounded px-2"
                        onClick={() =>
                          updateEntry({
                            ...entry,
                            sets: entry.sets.map((s, i) =>
                              i === idx
                                ? { ...s, reps: Math.max(0, (s.reps || 0) - 1) }
                                : s
                            ),
                          })
                        }
                      >
                        -
                      </button>
                      <div className="relative w-20">
                        <input
                          inputMode="numeric"
                          aria-label="Reps"
                          className="bg-slate-800 rounded-xl px-3 py-2 w-full text-center"
                          data-set-input="true"
                          data-entry-id={entry.id}
                          data-set-number={set.setNumber}
                          value={repsInputEditing.current[`${entry.id}:${set.setNumber}`] ?? (set.reps == null ? '' : String(set.reps))}
                          placeholder={(() => { if((set.reps||0)>0) return '0'; const sug = suggestions.get(entry.exerciseId); return sug?.reps ? String(sug.reps) : (entry.targetRepRange? entry.targetRepRange : '0'); })()}
                          onKeyDown={(e)=> {
                            if(e.key==='ArrowUp'){
                              e.preventDefault();
                              updateEntry({ ...entry, sets: entry.sets.map((s,i)=> i===idx? { ...s, reps: (s.reps||0)+1 }: s) });
                            } else if(e.key==='ArrowDown'){
                              e.preventDefault();
                              updateEntry({ ...entry, sets: entry.sets.map((s,i)=> i===idx? { ...s, reps: Math.max(0,(s.reps||0)-1) }: s) });
                            } else if(e.key==='Enter'){
                              const buf = repsInputEditing.current[`${entry.id}:${set.setNumber}`];
                              if(buf!==undefined){
                                const num = buf===''? null: Number(buf);
                                updateEntry({ ...entry, sets: entry.sets.map((s,i)=> i===idx? { ...s, reps: num }: s) });
                                delete repsInputEditing.current[`${entry.id}:${set.setNumber}`];
                              }
                            }
                          }}
                          onChange={(e)=> { const v=e.target.value; if(!/^\d*$/.test(v)) return; repsInputEditing.current[`${entry.id}:${set.setNumber}`]=v; if(v==='') return; updateEntry({ ...entry, sets: entry.sets.map((s,i)=> i===idx? { ...s, reps: Number(v) }: s) }); }}
                          onBlur={(e)=> { const v=e.target.value; const num = v===''? null: Number(v); updateEntry({ ...entry, sets: entry.sets.map((s,i)=> i===idx? { ...s, reps: num }: s) }); delete repsInputEditing.current[`${entry.id}:${set.setNumber}`]; }}
                        />
                        {(!set.reps || set.reps===0) && (suggestions.get(entry.exerciseId)?.reps || entry.targetRepRange) && (
                          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] text-emerald-400/35 font-medium">
                            {suggestions.get(entry.exerciseId)?.reps ?? entry.targetRepRange}
                          </span>
                        )}
                      </div>
                      <button
                        className="text-xs bg-slate-700 rounded px-2"
                        onClick={() =>
                          updateEntry({
                            ...entry,
                            sets: entry.sets.map((s, i) =>
                              i === idx ? { ...s, reps: (s.reps || 0) + 1 } : s
                            ),
                          })
                        }
                      >
                        +
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <PRChip
                        exerciseId={entry.exerciseId}
                        score={(set.weightKg ?? 0) * (set.reps ?? 0)}
                        week={week}
                      />
                      <button
                        className="text-[10px] bg-slate-700 rounded px-2 py-0.5"
                        disabled={idx === 0}
                        onClick={() => reorderSet(entry, idx, idx - 1)}
                      >
                        Up
                      </button>
                      <button
                        className="text-[10px] bg-slate-700 rounded px-2 py-0.5"
                        disabled={idx === entry.sets.length - 1}
                        onClick={() => reorderSet(entry, idx, idx + 1)}
                      >
                        Down
                      </button>
                      <button
                        className="text-[10px] bg-red-600 rounded px-2 py-0.5"
                        onClick={() => deleteSet(entry, idx)}
                      >
                        Del
                      </button>
                      {/* Removed per-set rest controls in desktop grid */}
                      {idx===entry.sets.length-1 && <button className="text-[10px] bg-emerald-700 rounded px-2 py-0.5" onClick={()=>duplicateLastSet(entry)}>Dup</button>}
                    </div>
                  </div>
                ))}
                <div className="contents">
                  <div></div>
                  <div></div>
                  <div></div>
                  <div>
                    <button
                      className="text-[10px] bg-emerald-700 rounded px-2 py-0.5"
                      onClick={()=> addSet(entry)}
                    >Add Set</button>
                  </div>
                </div>
                {/* Exercise-level rest control (desktop) */}
                <div className="col-span-4 mt-2 flex items-center justify-end gap-3 text-[11px]">
                  <div className="flex items-center gap-1">
                    {restTimerDisplay(entry.id)}
                    {restTimers[entry.id] && (
                      <button
                        className="px-2 py-1 rounded-md bg-slate-700 hover:bg-slate-600 text-[10px] text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/60"
                        aria-label="Stop rest timer"
                        onClick={()=> stopRestTimer(entry.id)}
                      >×</button>
                    )}
                  </div>
                </div>
              </div>
              </motion.div>
              )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Session summary footer */}
      {session && !!session.entries.length && (
        <SessionSummary session={session} exercises={exercises} />
      )}
      {/* Spacer for mobile summary bar & FAB */}
      <div className="h-40 sm:h-0" aria-hidden="true" />
      {/* Mobile sticky summary bar */}
      {session && !!session.entries.length && (
        <MobileSummaryFader visibleThreshold={0.5}>
          <MobileSessionMetrics session={session} exercises={exercises} />
        </MobileSummaryFader>
       )}

       <div className="bg-card rounded-2xl p-3">
         <div className="flex items-center justify-between mb-2">
           <div className="text-sm">Add exercise</div>
           <button
             className="text-xs sm:text-sm bg-slate-800 rounded-xl px-3 py-2"
             onClick={() => setShowAdd(true)}
           >
             Search
           </button>
         </div>
        {/* Removed full exercise chip list to avoid rendering hundreds; user opens Search to query */}
       </div>

      {/* Add dialog */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur flex items-start sm:items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface)] rounded-2xl w-full max-w-lg p-4 shadow-xl border border-[var(--border)]">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">Add exercise</div>
              <button
                className="text-xs bg-slate-800 rounded px-2 py-1"
                onClick={() => setShowAdd(false)}
              >
                Close
              </button>
            </div>
            <input
              className="w-full bg-slate-800 rounded-xl px-3 py-2"
              placeholder="Search or type a new exercise name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && query.trim()) {
                  createCustomExercise(query.trim());
                  setShowAdd(false);
                  setQuery("");
                }
              }}
            />
            <div className="mt-3 max-h-[60vh] overflow-y-auto space-y-2">
              {exercises
                .filter((e) =>
                  e.name.toLowerCase().includes(query.toLowerCase())
                )
                .map((e) => (
                  <button
                    key={e.id}
                    className="w-full text-left px-3 py-3 bg-slate-800 rounded-xl"
                    onClick={() => {
                      addExerciseToSession(e);
                      setShowAdd(false);
                      setQuery("");
                    }}
                  >
                    {e.name}
                  </button>
                ))}
              {query && (
                <button
                  className="w-full text-left px-3 py-3 bg-brand-600 rounded-xl"
                  onClick={() => {
                    createCustomExercise(query.trim());
                    setShowAdd(false);
                    setQuery("");
                  }}
                >
                  Create "{query}"
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div>
        <button className="text-xs underline" onClick={() => undoLast()}>
          Undo last action
        </button>
      </div>

  {/* Snackbar removed; using global queue */}
      <ImportTemplateDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        session={session as any}
        weekNumber={week}
        onImported={(updated, count, name) => {
          setSession(updated);
          push({ message: `Imported ${count} exercises from "${name}"` });
        }}
      />
    </div>
  );
}

// Adaptive Workout Day Selector Component
function DaySelector({ labels, value, onChange }: { labels:string[]; value:number; onChange:(v:number)=>void }){
  const [open,setOpen] = useState(false);
  const [rendered,setRendered] = useState(false); // for exit animation
  const [mobile,setMobile] = useState(false);
  const triggerRef = useRef<HTMLButtonElement|null>(null);
  const listRef = useRef<HTMLDivElement|null>(null);
  const touchStartY = useRef<number|null>(null);
  const liveRef = useRef<HTMLDivElement|null>(null);
  // Guard against stale index (e.g., program shrink) so selector always has a valid label
  useEffect(()=> { if(value >= labels.length && labels.length){ onChange(0); } }, [value, labels.length]);
  // Persist last selection across reload (sessionStorage scope)
  useEffect(()=> { try { sessionStorage.setItem('lastDayIdx', String(value)); } catch {} },[value]);
  useEffect(()=> { if(value===0){ try { const v = sessionStorage.getItem('lastDayIdx'); if(v) onChange(Number(v)); } catch {} } },[]);
  useEffect(()=> { const mq = window.matchMedia('(max-width:768px)'); const handler=()=> setMobile(mq.matches); handler(); mq.addEventListener('change',handler); return ()=> mq.removeEventListener('change',handler); },[]);
  useEffect(()=> { if(open){ setRendered(true); requestAnimationFrame(()=> { const el=listRef.current?.querySelector(`[data-idx='${value}']`) as HTMLElement|undefined; el?.scrollIntoView({block:'center'}); try{ navigator.vibrate?.(12);}catch{}; }); } else { // closing
    if(rendered){ const t = setTimeout(()=> setRendered(false), 180); return ()=> clearTimeout(t); }
    triggerRef.current?.focus();
  } },[open,value,rendered]);
  const openList = ()=> setOpen(true);
  const closeList = ()=> setOpen(false);
  const choose = (i:number)=> { onChange(i); closeList(); if(liveRef.current){ liveRef.current.textContent = `Selected ${labels[i]}`; } };
  const onTriggerKey = (e:React.KeyboardEvent)=> { if(['Enter',' ','ArrowDown','ArrowUp'].includes(e.key)){ e.preventDefault(); openList(); } };
  const onOptionKey = (e:React.KeyboardEvent, idx:number)=> { if(e.key==='Enter'){ e.preventDefault(); choose(idx);} else if(e.key==='ArrowDown'){ e.preventDefault(); const n = listRef.current?.querySelector(`[data-idx='${idx+1}']`) as HTMLElement|undefined; n?.focus(); } else if(e.key==='ArrowUp'){ e.preventDefault(); const p = listRef.current?.querySelector(`[data-idx='${idx-1}']`) as HTMLElement|undefined; p?.focus(); } else if(e.key==='Escape'){ e.preventDefault(); closeList(); } };
  const sheetTouchStart = (e:React.TouchEvent)=> { touchStartY.current = e.touches[0].clientY; };
  const sheetTouchMove = (e:React.TouchEvent)=> { if(touchStartY.current!=null){ const dy = e.touches[0].clientY - touchStartY.current; if(dy>90){ closeList(); touchStartY.current=null; } } };
  // Close on outside click (desktop)
  useEffect(()=> { if(!open) return; const onDown = (e:MouseEvent|TouchEvent)=> { const t=e.target as Node; if(listRef.current && listRef.current.contains(t)) return; if(triggerRef.current && triggerRef.current.contains(t)) return; setOpen(false); }; document.addEventListener('mousedown', onDown, true); document.addEventListener('touchstart', onDown, true); return ()=> { document.removeEventListener('mousedown', onDown, true); document.removeEventListener('touchstart', onDown, true); }; },[open]);

  const overlay = (rendered || open) && (
    <div className={mobile? 'fixed inset-0 z-[1000] flex flex-col justify-end':'fixed inset-0 z-[1000] pointer-events-none'}>
      {mobile && <div className={`absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-180 ${open? 'opacity-100':'opacity-0'} anim-motion-safe`} onClick={closeList} />}
      <div
        className={mobile?
          `relative w-full rounded-t-2xl border border-white/10 bg-slate-900/95 backdrop-blur max-h-[70vh] overflow-hidden flex flex-col shadow-xl will-change-transform transition-transform duration-180 ease-[cubic-bezier(.32,.72,.33,1)] ${open? 'translate-y-0 opacity-100':'translate-y-full opacity-0'} anim-motion-safe`:
          `absolute pointer-events-auto rounded-lg border border-white/10 bg-slate-900/95 backdrop-blur shadow-xl max-h-[48vh] overflow-hidden flex flex-col will-change-transform transition-all duration-160 ease-out ${open? 'scale-100 opacity-100 translate-y-0':'scale-95 opacity-0 -translate-y-1'} anim-motion-safe`}
        style={!mobile? (()=> { const r=triggerRef.current?.getBoundingClientRect(); if(!r) return { top:0,left:0 }; const top=Math.min(window.innerHeight- (window.innerHeight*0.4), r.bottom+4); const left=Math.min(window.innerWidth-260, Math.max(8,r.left)); return { position:'absolute', top, left, width:Math.min(260, window.innerWidth-16) }; })(): {}}
        role="dialog"
        aria-modal={mobile? 'true': undefined}
        onKeyDown={(e)=> { if(e.key==='Escape'){ e.preventDefault(); closeList(); } }}
        onTouchStart={mobile? sheetTouchStart: undefined}
        onTouchMove={mobile? sheetTouchMove: undefined}
      >
        {mobile && (
          <div className="h-6 flex items-center justify-center relative">
            <div className="w-10 h-1.5 rounded-full bg-slate-600" />
            <button className="absolute right-2 top-1 text-xs text-gray-400 px-2 py-1" onClick={closeList}>Close</button>
          </div>
        )}
        <div ref={listRef} className="relative selector-scroll overflow-y-auto px-1 pb-2 focus:outline-none max-h-full" role="listbox" aria-activedescendant={`day-opt-${value}`} tabIndex={-1}>
          <div className="pointer-events-none absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-[rgba(15,23,42,0.95)] to-transparent" />
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-[rgba(15,23,42,0.95)] to-transparent" />
          {labels.map((l,i)=> { const selected = i===value; return (
            <button
              key={i}
              id={`day-opt-${i}`}
              data-idx={i}
              role="option"
              aria-selected={selected}
              className={`w-full text-left px-3 py-3 flex items-center justify-between gap-2 rounded-md mt-1 first:mt-0 focus:outline-none transition-colors duration-120 ${selected? 'bg-emerald-600/90 text-black font-medium':'hover:bg-white/5 text-gray-200'}`}
              onClick={()=> choose(i)}
              onKeyDown={(e)=> onOptionKey(e,i)}
            >
              <span className="flex-1 text-sm break-words leading-snug max-w-[200px]">{l}</span>
              {selected && <span className="text-xs">✓</span>}
            </button>
          ); })}
        </div>
      </div>
    </div>
  );
  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={()=> setOpen(o=> !o)}
        onKeyDown={onTriggerKey}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="day-selector"
        className="inline-flex w-full sm:w-auto max-w-full items-center justify-between gap-2 rounded-md border border-white/10 bg-slate-800/70 hover:bg-slate-700/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
        title={labels[value]}
      >
        <span className="truncate max-w-[140px]">{labels[value]}</span>
        <span className="opacity-70 text-[10px]">▼</span>
      </button>
  {/* Mobile pills removed: only dropdown selector retained */}
  {overlay && createPortal(overlay, document.body)}
  <div ref={liveRef} className="sr-only" aria-live="polite" />
    </div>
  );
}

// Lightweight summary component
function SessionSummary({ session, exercises }: { session: Session; exercises: Exercise[] }) {
  const exMap = useMemo(()=> new Map(exercises.map(e=>[e.id,e])), [exercises])
  const totals = useMemo(()=>{
    let sets = 0, volume = 0, prs = 0
    for(const entry of session.entries){
      for(const s of entry.sets){
        sets++
        const ton = (s.weightKg||0) * (s.reps||0)
        volume += ton
        // naive PR heuristic: ton > 0 & reps*weight above simple threshold
        if(ton > 0 && ton >=  (exMap.get(entry.exerciseId)?.defaults.sets||3) * 50) prs++
      }
    }
    return { sets, volume, prs }
  }, [session, exMap])
  const estTonnage = totals.volume
  return (
    <div className="bg-card rounded-2xl p-4 shadow-soft mt-4 fade-in">
      <div className="flex flex-wrap gap-4 text-xs">
        <div><span className="text-muted">Sets:</span> {totals.sets}</div>
        <div><span className="text-muted">Volume:</span> {estTonnage}</div>
        <div><span className="text-muted">PR Signals:</span> {totals.prs}</div>
      </div>
    </div>
  )
}

function AsyncChip({ promise }: { promise: Promise<any> }) {
  const [text, setText] = useState("…");
  useEffect(() => {
    promise.then((r) =>
      setText(`DL: ${Math.round(r.loadPct * 100)}% × ${r.targetSets} sets`)
    );
  }, [promise]);
  return (
    <span className="text-xs bg-slate-800 rounded-xl px-2 py-1">{text}</span>
  );
}

function PRChip({
  exerciseId,
  score,
  week,
}: {
  exerciseId: string;
  score: number;
  week: number;
}) {
  const [best, setBest] = useState(0);
  useEffect(() => {
    (async () => {
      const r = await rollingPRs(exerciseId);
      setBest(r.bestTonnageSet);
    })();
  }, [exerciseId, week]);
  if (score <= 0 || best <= 0 || score < best) return null;
  return (
    <span className="text-[10px] rounded px-2 py-0.5 inline-flex items-center gap-1 bg-yellow-500 text-black border border-yellow-300" data-shape="pr" aria-label="Personal record set">
      <span className="w-2 h-2 rounded-full bg-black" aria-hidden="true"></span>
      PR
    </span>
  );
}

// Compact metrics bar for mobile (mirrors SessionSummary but denser)
function MobileSessionMetrics({ session, exercises }: { session: Session; exercises: Exercise[] }){
  const exMap = useMemo(()=> new Map(exercises.map(e=> [e.id,e])), [exercises]);
  const stats = useMemo(()=> {
    let sets=0, volume=0, prs=0;
    for(const entry of session.entries){
      for(const s of entry.sets){
        if((s.reps||0)>0 || (s.weightKg||0)>0){
          sets++;
          const ton=(s.weightKg||0)*(s.reps||0); volume+=ton;
          if(ton>0 && ton >= (exMap.get(entry.exerciseId)?.defaults.sets||3)*50) prs++;
        }
      }
    }
    return { sets, volume, prs };
  }, [session, exMap]);
  return (
    <div className="flex items-center gap-4 text-[11px] font-medium">
      <span><span className="opacity-60">Sets</span> {stats.sets}</span>
      <span><span className="opacity-60">Vol</span> {stats.volume}</span>
      <span><span className="opacity-60">PR</span> {stats.prs}</span>
    </div>
  );
}

// Add helper component near bottom before export (or after existing components)
function MobileSummaryFader({ children, visibleThreshold = 0.5 }: { children: React.ReactNode; visibleThreshold?: number }) {
  const [visible, setVisible] = useState(true);
  useEffect(()=> {
    const onScroll = ()=> {
      const doc = document.documentElement;
      const max = (doc.scrollHeight - window.innerHeight) || 1;
      const ratio = window.scrollY / max;
      setVisible(ratio < visibleThreshold);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return ()=> window.removeEventListener('scroll', onScroll);
  }, [visibleThreshold]);
  return (
    <div
      className={`fixed sm:hidden bottom-0 left-0 right-0 z-30 px-4 py-3 flex items-center gap-4 overflow-x-auto transition-all duration-500 ease-out will-change-transform backdrop-blur border-t border-white/10 bg-slate-900/80 ${visible? 'opacity-100 translate-y-0':'opacity-0 translate-y-4 pointer-events-none'}`}
      aria-hidden={visible? undefined: 'true'}
    >
      {children}
    </div>
  );
}
