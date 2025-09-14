import { useEffect, useMemo, useState, useRef } from "react";
import { db } from "../lib/db";
import { getSettings, setSettings } from "../lib/helpers";
import { Measurement } from "../lib/types";
import { nanoid } from "nanoid";
import { loadRecharts } from "../lib/loadRecharts";
import MeasurementsInfoModal from "./MeasurementsInfoModal";
import UnifiedTooltip from "../components/UnifiedTooltip";
import { useSnack } from "../state/snackbar";
import { parseEvoltTextToMeasurement } from "../lib/evoltImport";

const TIPS: Record<string, string> = {
  neck: "Measure at the thickest point, relaxed.",
  chest: "Tape at nipples level, relaxed.",
  waist: "At navel, relaxed but not sucked in.",
  hips: "Around glutes at the widest point.",
  thigh: "Mid-thigh, stand tall.",
  calf: "At the largest point standing.",
  upperArm: "Upper arm cold, flexed lightly.",
  forearm: "At the largest point, arm parallel to floor.",
};

export default function Measurements() {
  const [m, setM] = useState<Measurement>({
    id: nanoid(),
    dateISO: new Date().toISOString(),
  });
  const [data, setData] = useState<Measurement[]>([]);
  const { push } = useSnack();
  const fileRef = useRef<HTMLInputElement|null>(null);

  useEffect(() => {
    (async()=>{
      const list = await db.getAll<Measurement>("measurements")
      const sorted = [...list].sort((a,b)=> b.dateISO.localeCompare(a.dateISO))
      setData(sorted)
      // today guard
      const today = new Date().toISOString().slice(0,10)
      const existingToday = sorted.find(r=> r.dateISO.slice(0,10) === today)
      if(existingToday) setM(existingToday)
    })()
  }, []);

  const save = async () => {
    await db.put("measurements", m);
    // refresh list
    const list = await db.getAll<Measurement>('measurements')
    const sorted = [...list].sort((a,b)=> b.dateISO.localeCompare(a.dateISO))
    setData(sorted)
    // if we just saved today's entry keep editing it; provide add another option
    const today = new Date().toISOString().slice(0,10)
    const todayEntry = sorted.find(r=> r.dateISO.slice(0,10) === today)
    if(todayEntry) setM(todayEntry); else setM({ id: nanoid(), dateISO: new Date().toISOString() })
  };

  // Import Evolt 360 PDF/Text
  const onChooseEvolt = ()=> fileRef.current?.click();
  const handleEvoltFile = async (file: File) => {
    try {
      const isTxt = /\.txt$/i.test(file.name);
      let text = "";
      if (isTxt) {
        text = await file.text();
      } else if (/\.pdf$/i.test(file.name)) {
        // PDFs are binary; without a PDF parser we'll likely get unreadable text. Prefer users export as text for now.
        // We attempt a naive decode; if it fails to match patterns, we'll prompt the user.
        const buf = await file.arrayBuffer();
        text = new TextDecoder().decode(new Uint8Array(buf));
      } else {
        push({ message: "Unsupported file. Upload .pdf or .txt" });
        return;
      }
      const { measurement: parsed, found, warnings } = parseEvoltTextToMeasurement(text || "");
      if (!found.length) {
        push({ message: warnings[0] || "No recognizable Evolt fields. Try exporting the PDF as text." });
        return;
      }
      const today = new Date().toISOString().slice(0,10);
      const existing = data.find(r=> r.dateISO.slice(0,10) === today);
      const base: Measurement = existing ? { ...existing } : { id: nanoid(), dateISO: new Date().toISOString() } as Measurement;
      const merged: Measurement = { ...base, ...parsed } as Measurement;
      await db.put('measurements', merged);
      const list = await db.getAll<Measurement>('measurements');
      const sorted = [...list].sort((a,b)=> b.dateISO.localeCompare(a.dateISO));
      setData(sorted);
      setM(merged);
      push({ message: `Imported Evolt: ${found.join(', ')}` });
    } catch (e) {
      console.warn('Evolt import failed', e);
      push({ message: 'Import failed' });
    }
  };

  const remove = async (id: string) => {
    const cfg = await getSettings();
    if (
      cfg.confirmDestructive &&
      !window.confirm("Delete this measurement entry?")
    )
      return;
    const prev = data;
    await db.delete("measurements", id);
    setData(data.filter((x) => x.id !== id));
    push({
      message: "Measurement deleted",
      actionLabel: 'Undo',
      onAction: async () => {
        for (const it of prev) await db.put("measurements", it);
        setData(prev);
      }
    });
  };

  const update = async (id: string, patch: Partial<Measurement>) => {
    const next = data.map((x) => (x.id === id ? { ...x, ...patch } : x));
    setData(next);
    const target = next.find((x) => x.id === id)!;
    await db.put("measurements", target);
  };

  const [overlayKeys, setOverlayKeys] = useState<(keyof Measurement)[]>([
    "weightKg",
    "waist",
  ]);
  const [smoothing, setSmoothing] = useState(false);
  useEffect(()=> { (async()=>{ const s = await getSettings(); setSmoothing(!!s.ui?.smoothingDefault); })() },[]);
  const toggleOverlay = (k: keyof Measurement) => {
    setOverlayKeys((prev) =>
      prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]
    );
  };
  const series = (key: keyof Measurement) =>
    data
      .filter((x) => x[key] != null)
      .map((x) => ({
        date: x.dateISO.slice(5),
        value: Number((x as any)[key]),
        ts: new Date(x.dateISO).getTime(),
      }));

  const weightSeries = series("weightKg");
  // 7-day rolling average for weight
  const weight7 = useMemo(() => {
    const out: any[] = [];
    for (let i = 0; i < weightSeries.length; i++) {
      const slice = weightSeries.slice(Math.max(0, i - 6), i + 1);
      const avg =
        slice.reduce((acc, cur) => acc + (cur.value || 0), 0) / slice.length;
      out.push({ ...weightSeries[i], avg });
    }
    return out;
  }, [weightSeries]);
  // Linear regression (least squares) for weight
  const weightTrend = useMemo(() => {
    if (weightSeries.length < 2) return [] as any[];
    const xs = weightSeries.map((p) => p.ts);
    const ys = weightSeries.map((p) => p.value);
    const n = xs.length;
    const meanX = xs.reduce((a, b) => a + b, 0) / n;
    const meanY = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0,
      den = 0;
    for (let i = 0; i < n; i++) {
      num += (xs[i] - meanX) * (ys[i] - meanY);
      den += (xs[i] - meanX) ** 2;
    }
    const slope = den === 0 ? 0 : num / den;
    const intercept = meanY - slope * meanX;
    return weightSeries.map((p) => ({ date: p.date, value: slope * p.ts + intercept }));
  }, [weightSeries]);

  const [RC, setRC] = useState<any | null>(null);
  useEffect(()=> { loadRecharts().then(m=> setRC(m)); }, []);

  // Lightweight moving average smoothing (window = 3)
  const movingAvg = (arr: { date: string; value: number }[], win = 3) => {
    if(!arr.length) return [] as any[];
    return arr.map((p,i)=> {
      const slice = arr.slice(Math.max(0, i-(win-1)), i+1);
      const avg = slice.reduce((a,b)=> a + (b.value||0), 0)/slice.length;
      return { ...p, avg };
    });
  };

  const overlaySeries = useMemo(()=> {
    const out: Record<string, { raw:any[]; avg:any[] }> = {};
    overlayKeys.forEach(k => {
      const s = series(k);
      out[k as string] = { raw: s, avg: movingAvg(s) };
    });
    return out;
  }, [overlayKeys, data]);

  // Provide previous point lookup for UnifiedTooltip
  const prevLookup = (seriesName:string, label:any) => {
    const src = overlaySeries[seriesName]?.[smoothing? 'avg':'raw'] || weightSeries;
    const idx = src.findIndex((r:any)=> r.date === label);
    if(idx>0){ const prev = src[idx-1]; return prev?.avg ?? prev?.value; }
    return undefined;
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Measurements</h2>
  <div className="bg-card rounded-2xl p-4 shadow-soft space-y-3 fade-in">
  {/* Hidden file input for Evolt import */}
  <input ref={fileRef} type="file" accept=".pdf,.txt" className="hidden" onChange={(e)=> { const f=e.target.files?.[0]; if(f) handleEvoltFile(f); e.currentTarget.value=''; }} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            "weightKg",
            "neck",
            "chest",
            "waist",
            "hips",
            "thigh",
            "calf",
            "upperArm",
            "forearm",
          ].map((k) => (
            <label key={k} className="space-y-1">
              <div className="text-sm text-gray-300 capitalize">{k}</div>
              <div className="flex items-center gap-2">
                <button
                  className="bg-slate-700 rounded px-3 py-2"
                  onClick={() =>
                    setM((prev) => ({
                      ...prev,
                      [k]: Math.max(0, Number((prev as any)[k] || 0) - 0.5),
                    }))
                  }
                >
                  -
                </button>
                <input
                  inputMode="decimal"
                  className="w-full bg-slate-800 rounded-xl px-3 py-3"
                  value={(m as any)[k] || ""}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setM((prev) => ({
                        ...prev,
                        [k]: Number((prev as any)[k] || 0) + 0.5,
                      }));
                    } else if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setM((prev) => ({
                        ...prev,
                        [k]: Math.max(0, Number((prev as any)[k] || 0) - 0.5),
                      }));
                    }
                  }}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!/^\d*(?:\.\d*)?$/.test(v)) return;
                    setM({ ...m, [k]: v === "" ? undefined : Number(v) });
                  }}
                />
                <button
                  className="bg-slate-700 rounded px-3 py-2"
                  onClick={() =>
                    setM((prev) => ({
                      ...prev,
                      [k]: Number((prev as any)[k] || 0) + 0.5,
                    }))
                  }
                >
                  +
                </button>
              </div>
              {TIPS[k] && <p className="text-xs text-gray-400">{TIPS[k]}</p>}
            </label>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button
            className="w-full sm:w-auto bg-brand-600 hover:bg-brand-700 px-3 py-3 rounded-xl"
            onClick={save}
          >
            Save
          </button>
          <button
            className="w-full sm:w-auto bg-indigo-700 hover:bg-indigo-600 px-3 py-3 rounded-xl"
            onClick={onChooseEvolt}
            title="Import Evolt 360 PDF or exported .txt"
          >Import Evolt 360</button>
          <button
            className="w-full sm:w-auto bg-slate-700 hover:bg-slate-600 px-3 py-3 rounded-xl"
            onClick={()=> setM({ id: nanoid(), dateISO: new Date().toISOString() })}
          >Add another</button>
          <MeasurementsInfoModal />
        </div>
      </div>

      <div className="bg-card rounded-2xl p-4 shadow-soft space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="uppercase tracking-wide text-gray-400">Overlays:</span>
          {["weightKg","waist","chest","hips","upperArm","bodyFatPct","leanMassKg","fatMassKg"].map(k => (
            <button key={k} onClick={()=> toggleOverlay(k as keyof Measurement)} className={`px-2 py-1 rounded-lg border ${overlayKeys.includes(k as any)?'bg-emerald-600 border-emerald-500':'bg-white/5 border-white/10'}`}>{k}</button>
          ))}
          <button onClick={async ()=> { setSmoothing(s=> { const next=!s; (async()=>{ const st=await getSettings(); await setSettings({ ...st, ui:{ ...(st.ui||{}), smoothingDefault: next } }) })(); return next }); }} className={`px-2 py-1 rounded-lg border ${smoothing? 'bg-indigo-600 border-indigo-500':'bg-white/5 border-white/10'}`}>{smoothing? 'Smoothing On':'Smoothing Off'}</button>
          <span className="ml-auto text-[10px] text-gray-500 hidden sm:inline">Tooltip shows Δ vs prev day • Toggle smoothing for rolling avg (w=3)</span>
        </div>
        <div className="h-72">
          {!RC && <div className="h-full flex items-center justify-center text-xs text-gray-500">Loading…</div>}
          {RC && (
            <RC.ResponsiveContainer>
              <RC.LineChart data={weightSeries.length? weightSeries: series(overlayKeys[0]||'weightKg')}>
                <RC.CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <RC.XAxis dataKey="date" stroke="#9ca3af" interval={Math.ceil((weightSeries.length||30)/12)} />
                <RC.YAxis stroke="#9ca3af" />
                <RC.Tooltip content={({active,payload,label}:any)=> <UnifiedTooltip active={active} payload={payload} label={label} context={{ previousPointLookup: prevLookup }} />} />
                <RC.Legend />
                {overlayKeys.map((k,i)=> {
                  const sObj = overlaySeries[k];
                  const s = sObj?.raw || series(k);
                  const palette = ['#3b82f6','#ef4444','#22c55e','#f59e0b','#a855f7'];
                  return <RC.Line key={k} type="monotone" name={k} data={smoothing? sObj.avg: s} dataKey={smoothing? 'avg':'value'} stroke={palette[i%palette.length]} dot={false} />
                })}
                {overlayKeys.includes('weightKg') && (
                  <>
                    <RC.Line type="monotone" name="7d avg" data={weight7} dataKey="avg" stroke="#ffffff" strokeDasharray="4 4" dot={false} />
                    {weightTrend.length>0 && <RC.Line type="monotone" name="trend" data={weightTrend} dataKey="value" stroke="#22c55e" strokeDasharray="2 6" dot={false} />}
                  </>
                )}
              </RC.LineChart>
            </RC.ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="bg-card rounded-2xl p-4 shadow-soft">
        <div className="font-medium mb-2">Entries</div>
        {!data.length && (
          <div className="text-xs text-muted py-6 text-center">No measurements yet. Track your first bodyweight to begin a trend.</div>
        )}
        <div className="space-y-2">
          {data.map((row) => (
            <div key={row.id} className="bg-slate-800 rounded-xl px-3 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-gray-400">
                  {row.dateISO.slice(0, 10)}
                </div>
                <button
                  className="text-xs bg-red-600 rounded px-3 py-2"
                  onClick={() => remove(row.id)}
                >
                  Delete
                </button>
              </div>
              {/* Mobile stacked fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="bg-slate-900/50 rounded-xl px-2 py-2">
                  <div className="text-[11px] text-gray-400 mb-1">Weight</div>
                  <div className="flex items-center gap-2">
                    <button
                      className="bg-slate-700 rounded px-3 py-2"
                      onClick={() =>
                        update(row.id, {
                          weightKg: Math.max(0, (row.weightKg || 0) - 0.5),
                        })
                      }
                    >
                      -
                    </button>
                    <input
                      className="bg-slate-900 rounded px-3 py-2 w-full text-center"
                      inputMode="decimal"
                      value={row.weightKg || ""}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowUp") {
                          e.preventDefault();
                          update(row.id, {
                            weightKg: (row.weightKg || 0) + 0.5,
                          });
                        } else if (e.key === "ArrowDown") {
                          e.preventDefault();
                          update(row.id, {
                            weightKg: Math.max(0, (row.weightKg || 0) - 0.5),
                          });
                        }
                      }}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!/^\d*(?:\.\d*)?$/.test(v)) return;
                        update(row.id, {
                          weightKg: v === "" ? undefined : Number(v),
                        });
                      }}
                      placeholder="kg"
                    />
                    <button
                      className="bg-slate-700 rounded px-3 py-2"
                      onClick={() =>
                        update(row.id, { weightKg: (row.weightKg || 0) + 0.5 })
                      }
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="bg-slate-900/50 rounded-xl px-2 py-2">
                  <div className="text-[11px] text-gray-400 mb-1">Waist</div>
                  <div className="flex items-center gap-2">
                    <button
                      className="bg-slate-700 rounded px-3 py-2"
                      onClick={() =>
                        update(row.id, {
                          waist: Math.max(0, (row.waist || 0) - 0.5),
                        })
                      }
                    >
                      -
                    </button>
                    <input
                      className="bg-slate-900 rounded px-3 py-2 w-full text-center"
                      inputMode="decimal"
                      value={row.waist || ""}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowUp") {
                          e.preventDefault();
                          update(row.id, { waist: (row.waist || 0) + 0.5 });
                        } else if (e.key === "ArrowDown") {
                          e.preventDefault();
                          update(row.id, {
                            waist: Math.max(0, (row.waist || 0) - 0.5),
                          });
                        }
                      }}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!/^\d*(?:\.\d*)?$/.test(v)) return;
                        update(row.id, {
                          waist: v === "" ? undefined : Number(v),
                        });
                      }}
                      placeholder="waist"
                    />
                    <button
                      className="bg-slate-700 rounded px-3 py-2"
                      onClick={() =>
                        update(row.id, { waist: (row.waist || 0) + 0.5 })
                      }
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="bg-slate-900/50 rounded-xl px-2 py-2">
                  <div className="text-[11px] text-gray-400 mb-1">
                    Upper Arm
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="bg-slate-700 rounded px-3 py-2"
                      onClick={() =>
                        update(row.id, {
                          upperArm: Math.max(0, (row.upperArm || 0) - 0.5),
                        })
                      }
                    >
                      -
                    </button>
                    <input
                      className="bg-slate-900 rounded px-3 py-2 w-full text-center"
                      inputMode="decimal"
                      value={row.upperArm || ""}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowUp") {
                          e.preventDefault();
                          update(row.id, {
                            upperArm: (row.upperArm || 0) + 0.5,
                          });
                        } else if (e.key === "ArrowDown") {
                          e.preventDefault();
                          update(row.id, {
                            upperArm: Math.max(0, (row.upperArm || 0) - 0.5),
                          });
                        }
                      }}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!/^\d*(?:\.\d*)?$/.test(v)) return;
                        update(row.id, {
                          upperArm: v === "" ? undefined : Number(v),
                        });
                      }}
                      placeholder="arm"
                    />
                    <button
                      className="bg-slate-700 rounded px-3 py-2"
                      onClick={() =>
                        update(row.id, { upperArm: (row.upperArm || 0) + 0.5 })
                      }
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

  {/* Snackbar migrated to global snack queue */}
    </div>
  );
}

function ChartCard({
  title,
  data,
  color,
}: {
  title: string;
  data: any[];
  color: string;
}) {
  const [RC, setRC] = useState<any | null>(null);
  useEffect(()=> { loadRecharts().then(m=> setRC(m)); }, []);
  return (
    <div className="bg-card rounded-2xl p-4 shadow-soft">
      <h3 className="font-medium mb-2">{title}</h3>
      <div className="h-56">
        {!RC && <div className="h-full flex items-center justify-center text-xs text-gray-500">Loading…</div>}
        {RC && (
          <RC.ResponsiveContainer>
            <RC.LineChart data={data}>
              <RC.CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <RC.XAxis dataKey="date" stroke="#9ca3af" />
              <RC.YAxis stroke="#9ca3af" />
              <RC.Tooltip />
              <RC.Line type="monotone" dataKey="value" stroke={color} dot={false} />
            </RC.LineChart>
          </RC.ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
