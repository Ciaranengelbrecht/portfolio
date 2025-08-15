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
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Program</h2>
      {toast && <div className="text-xs text-emerald-400">{toast}</div>}
      <div className="glass-card rounded-2xl p-4 space-y-4">
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
    </div>
  );
}
