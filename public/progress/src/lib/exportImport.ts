// @ts-ignore - types may not be present; runtime lib used for zip packaging
import JSZip from 'jszip';
import { db } from './db';
import { Exercise, Session, Measurement, Template, Settings, UserProgram } from './types';

// Schema version for export format (independent from DBVersion)
export const EXPORT_SCHEMA_VERSION = 1;

export interface ExportOptions {
  includeRawJson?: boolean; // include full-fidelity JSON snapshot
  prettyJson?: boolean; // indent JSON
  excludeEmptySessions?: boolean; // drop sessions with zero logged data
}

interface Manifest {
  schemaVersion: number;
  generatedAt: string; // ISO
  app: 'liftlog';
  counts: Record<string, number>;
  notes: string;
  files: string[]; // list of included relative paths
}

const esc = (v: any) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
};

function hasLoggedData(sess: Session){
  return sess.entries?.some(e=> e.sets.some(st => (st.weightKg||0)>0 || (st.reps||0)>0));
}

export async function buildExportZip(opts: ExportOptions = {}){
  const [exercises, sessions, measurements, templates, settings] = await Promise.all([
    db.getAll<Exercise>('exercises'),
    db.getAll<Session>('sessions'),
    db.getAll<Measurement>('measurements'),
    db.getAll<Template>('templates'),
    db.get<Settings>('settings','app')
  ]);
  // Program extracted from settings if present
  const program: UserProgram | undefined = (settings as any)?.program;

  const exerciseMap = new Map(exercises.map(e=> [e.id, e] as const));
  const filteredSessions = sessions.filter(s=> !opts.excludeEmptySessions || hasLoggedData(s));

  // --- CSV builders ---
  const exercisesCsv = [
    ['id','name','muscleGroup','secondaryMuscles','tags','defaultSets','defaultRepRange','deloadLoadPct','deloadSetPct','active','isOptional'].join(','),
    ...exercises.map(e=> [
      e.id,
      e.name,
      e.muscleGroup,
      (e.secondaryMuscles||[]).join('|'),
      (e.tags||[]).join('|'),
      e.defaults?.sets ?? '',
      e.defaults?.targetRepRange ?? '',
      e.defaults?.deloadLoadPct ?? '',
      e.defaults?.deloadSetPct ?? '',
      e.active === false? 'false':'true',
      e.isOptional? 'true':'false'
    ].map(esc).join(','))
  ].join('\n');

  const measurementsCsv = [
    ['id','dateISO','weightKg','neck','chest','waist','hips','thigh','calf','upperArm','forearm','bodyFatPct','leanMassKg','fatMassKg','skeletalMuscleMassKg','visceralFatRating'].join(','),
    ...measurements.sort((a,b)=> a.dateISO.localeCompare(b.dateISO)).map(m=> [
      m.id,m.dateISO,m.weightKg??'',m.neck??'',m.chest??'',m.waist??'',m.hips??'',m.thigh??'',m.calf??'',m.upperArm??'',m.forearm??'',m.bodyFatPct??'',m.leanMassKg??'',m.fatMassKg??'',m.skeletalMuscleMassKg??'',m.visceralFatRating??''
    ].map(esc).join(','))
  ].join('\n');

  const sessionSetsCsv = [
    ['sessionId','dateISO','localDate','phaseNumber','weekNumber','dayName','exerciseOrder','exerciseId','exerciseName','muscleGroup','setNumber','weightKg','reps','rpe','completedAt','targetRepRange'].join(','),
    ...filteredSessions.flatMap(sess => (sess.entries||[]).map((entry, ei)=> (entry.sets||[]).map(set => {
      const ex = exerciseMap.get(entry.exerciseId);
      return [
        sess.id,
        sess.dateISO,
        sess.localDate||'',
        sess.phaseNumber||sess.phase||'',
        sess.weekNumber,
        sess.dayName||'',
        ei+1,
        entry.exerciseId,
        ex?.name||'',
        ex?.muscleGroup||'',
        set.setNumber,
        set.weightKg??'',
        set.reps??'',
        set.rpe??'',
        set.completedAt||'',
        entry.targetRepRange||''
      ].map(esc).join(',');
    })).flat())
  ].join('\n');

  const sessionSummaryCsv = [
    ['sessionId','dateISO','localDate','phaseNumber','weekNumber','dayName','exerciseCount','setCount','workLogDays','loggedStartAt','loggedEndAt','durationMinutes'].join(','),
    ...filteredSessions.map(sess=> {
      const exerciseCount = (sess.entries||[]).length;
      const setCount = sess.entries.reduce((a,e)=> a + (e.sets?.length||0),0);
      const workLogDays = Object.keys(sess.workLog||{}).length;
      let durationMinutes = '';
      if(sess.loggedStartAt && sess.loggedEndAt){
        const ms = new Date(sess.loggedEndAt).getTime() - new Date(sess.loggedStartAt).getTime();
        if(ms>0) durationMinutes = (ms/60000).toFixed(1);
      }
      return [sess.id,sess.dateISO,sess.localDate||'',sess.phaseNumber||sess.phase||'',sess.weekNumber,sess.dayName||'',exerciseCount,setCount,workLogDays,sess.loggedStartAt||'',sess.loggedEndAt||'',durationMinutes].map(esc).join(',');
    })
  ].join('\n');

  const templatesCsv = [
    ['id','name','exerciseCount','exerciseNames','plan'].join(','),
    ...templates.map(t=> {
      const names = (t.exerciseIds||[]).map(id=> exerciseMap.get(id)?.name || id).join('|');
      const plan = (t.plan||[]).map(p=> {
        const ex = exerciseMap.get(p.exerciseId);
        return `${ex?.name||p.exerciseId}:${p.plannedSets}x${p.repRange}`;
      }).join('|');
      return [t.id,t.name,(t.exerciseIds||[]).length,names,plan].map(esc).join(',');
    })
  ].join('\n');

  const programJson = program ? JSON.stringify(program, null, 2) : '';

  // Manifest
  const manifest: Manifest = {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    app: 'liftlog',
    counts: {
      exercises: exercises.length,
      sessions: filteredSessions.length,
      measurements: measurements.length,
      templates: templates.length,
      program: program? 1:0
    },
    notes: 'CSV files are normalized for spreadsheet analysis. Use manifest + raw.json for full-fidelity restore. All times ISO-8601.',
    files: ['exercises.csv','session_sets.csv','session_summary.csv','measurements.csv','templates.csv'].concat(program? ['program.json']:[]).concat(opts.includeRawJson? ['raw.json']:[])
  };

  const zip = new JSZip();
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('exercises.csv', exercisesCsv);
  zip.file('session_sets.csv', sessionSetsCsv);
  zip.file('session_summary.csv', sessionSummaryCsv);
  zip.file('measurements.csv', measurementsCsv);
  zip.file('templates.csv', templatesCsv);
  if(program) zip.file('program.json', programJson);
  if(opts.includeRawJson){
    const raw = { exercises, sessions: filteredSessions, measurements, templates, settings, program, manifest };
  zip.file('raw.json', JSON.stringify(raw, undefined, opts.prettyJson? 2: undefined));
  }
  // Friendly README
  const readme = `LiftLog Export\n\nContents:\n- manifest.json (schema, counts, file list)\n- exercises.csv\n- session_sets.csv (one row per set)\n- session_summary.csv (one row per session)\n- measurements.csv\n- templates.csv\n${program? '- program.json\n':''}${opts.includeRawJson? '- raw.json (full snapshot for lossless import)\n':''}\nImport: Use the in-app Import tool and select either raw.json (preferred) or the entire zip.\n`;
  zip.file('README.txt', readme);

  const blob = await zip.generateAsync({ type: 'blob' });
  return { blob, manifest };
}

export async function triggerExportDownload(opts: ExportOptions = {}){
  const { blob } = await buildExportZip(opts);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `liftlog_export_${new Date().toISOString().slice(0,10)}.zip`;
  a.click();
  setTimeout(()=> URL.revokeObjectURL(url), 4000);
}

export interface ImportResult { inserted: Record<string, number>; skipped: Record<string, number>; errors: number; }

export async function importFromRawJson(text: string): Promise<ImportResult> {
  const json = JSON.parse(text);
  const inserted: Record<string, number> = { exercises:0, sessions:0, measurements:0, templates:0, program:0, settings:0 };
  const skipped: Record<string, number> = {};
  // Basic validation
  if(json.exercises){ for(const e of json.exercises){ await db.put('exercises', e); inserted.exercises++; } }
  if(json.sessions){ for(const s of json.sessions){ await db.put('sessions', s); inserted.sessions++; } }
  if(json.measurements){ for(const m of json.measurements){ await db.put('measurements', m); inserted.measurements++; } }
  if(json.templates){ for(const t of json.templates){ await db.put('templates', t); inserted.templates++; } }
  if(json.settings){ await db.put('settings', { ...json.settings, id: 'app' }); inserted.settings++; }
  if(json.program){ const st = await db.get<Settings>('settings','app') || {} as Settings; await db.put('settings', { ...(st as any), program: json.program, id: 'app' }); inserted.program = 1; }
  return { inserted, skipped, errors: 0 };
}
