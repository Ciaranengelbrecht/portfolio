import { useEffect, useState } from "react";
import { clampPhase } from "../lib/sessionOps";
import { getSettings, setSettings } from "../lib/helpers";

export default function PhaseStepper({
  value,
  onChange,
}: {
  value?: number;
  onChange?: (n: number) => void;
}) {
  const [n, setN] = useState<number>(value ?? 1);
  const [hint, setHint] = useState<string>("");

  useEffect(() => {
    if (typeof value === "number") setN(value);
  }, [value]);

  const commit = async (v: number) => {
    const prevPhase = value ?? n;
    const c = clampPhase(v);
    if(c > prevPhase){
      if(!window.confirm('Move to phase '+c+'? You should only advance after completing current phase.')) return;
    } else if(c < prevPhase){
      if(!window.confirm('Revert to phase '+c+'? Progress indicators will recalc based on earlier data.')) return;
    }
    setN(c);
    setHint(c !== v ? "Min phase is 1" : "");
    onChange?.(c);
    const s = await getSettings();
    await setSettings({
      ...s,
      currentPhase: c,
      dashboardPrefs: {
        ...(s.dashboardPrefs || {}),
        lastLocation: {
          ...(s.dashboardPrefs?.lastLocation || { weekNumber: 1, dayId: 0 }),
          phaseNumber: c,
        },
      },
    });
  };

  return (
    <div className="flex items-center gap-1">
      <button
        className="bg-slate-700 px-3 py-2 rounded"
        onClick={() => commit(n - 1)}
      >
        -
      </button>
      <input
        className="w-14 sm:w-16 bg-slate-800 rounded px-2 py-2 text-center"
        inputMode="numeric"
        value={n}
        onChange={(e) => {
          const v = e.target.value;
          if (!/^\d*$/.test(v)) return;
          setN(Number(v || "1"));
        }}
        onBlur={() => commit(n)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit(n);
          if (e.key === "ArrowUp") commit(n + 1);
          if (e.key === "ArrowDown") commit(n - 1);
        }}
      />
      <button
        className="bg-slate-700 px-3 py-2 rounded"
        onClick={() => commit(n + 1)}
      >
        +
      </button>
      {hint && <div className="text-xs text-amber-400 ml-2">{hint}</div>}
    </div>
  );
}
