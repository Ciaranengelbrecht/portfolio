import { useState, useRef, useCallback } from "react";
import { db } from "../lib/db";
import { Measurement } from "../lib/types";
import { nanoid } from "nanoid";
import { motion, AnimatePresence } from "framer-motion";

interface QuickWeighInProps {
  onSave: () => void;
  lastWeight?: number;
  lastWaist?: number;
}

/**
 * QuickWeighIn - A streamlined weight entry component
 * Reduces friction for the most common measurement: daily weight
 */
const parsePositive = (value: string) => {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

export default function QuickWeighIn({
  onSave,
  lastWeight,
  lastWaist,
}: QuickWeighInProps) {
  const [weight, setWeight] = useState<string>("");
  const [waist, setWaist] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const weightRef = useRef<HTMLInputElement>(null);

  const handleSave = useCallback(async () => {
    const parsedWeight = parsePositive(weight);
    const parsedWaist = parsePositive(waist);
    if (parsedWeight == null && parsedWaist == null) return;

    setIsSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);

      // Check if there's already a measurement for today
      const all = await db.getAll<Measurement>("measurements");
      const todayEntry = all.find((m) => m.dateISO.slice(0, 10) === today);

      const patch: Partial<Measurement> = {};
      if (parsedWeight != null) patch.weightKg = Number(parsedWeight.toFixed(2));
      if (parsedWaist != null) patch.waist = Number(parsedWaist.toFixed(2));

      if (todayEntry) {
        // Update existing entry
        await db.put("measurements", {
          ...todayEntry,
          ...patch,
        });
      } else {
        // Get height from most recent entry if available
        const sorted = [...all].sort((a, b) =>
          b.dateISO.localeCompare(a.dateISO)
        );
        const lastHeight = sorted.find(
          (m) => typeof m.heightCm === "number"
        )?.heightCm;

        // Create new entry with available quick fields.
        const newEntry: Measurement = {
          id: nanoid(),
          dateISO: new Date().toISOString(),
          ...patch,
          ...(lastHeight && { heightCm: lastHeight }),
        };
        await db.put("measurements", newEntry);
      }

      setShowSuccess(true);
      setWeight("");
      setWaist("");
      onSave();

      // Reset success state after animation
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (err) {
      console.error("Quick weigh-in failed:", err);
    } finally {
      setIsSaving(false);
      if (parsedWeight == null) {
        weightRef.current?.focus();
      }
    }
  }, [weight, waist, onSave]);

  const handleKeyDown = (
    e: React.KeyboardEvent,
    field: "weight" | "waist"
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (field === "weight") {
        setWeight((prev) => {
          const val = parseFloat(prev) || lastWeight || 0;
          return (val + 0.1).toFixed(1);
        });
      } else {
        setWaist((prev) => {
          const val = parseFloat(prev) || lastWaist || 0;
          return Math.max(0, val + 0.5).toFixed(1);
        });
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (field === "weight") {
        setWeight((prev) => {
          const val = parseFloat(prev) || lastWeight || 0;
          return Math.max(0, val - 0.1).toFixed(1);
        });
      } else {
        setWaist((prev) => {
          const val = parseFloat(prev) || lastWaist || 0;
          return Math.max(0, val - 0.5).toFixed(1);
        });
      }
    }
  };

  const hasWeight = parsePositive(weight) != null;
  const hasWaist = parsePositive(waist) != null;
  const isValid = hasWeight || hasWaist;
  const weightDiff =
    lastWeight && hasWeight ? parseFloat(weight) - lastWeight : null;
  const waistDiff = lastWaist && hasWaist ? parseFloat(waist) - lastWaist : null;

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-emerald-950/35 to-slate-900/60 p-3.5">
      {/* Success overlay */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute inset-0 bg-emerald-900/90 backdrop-blur-sm flex items-center justify-center z-10"
          >
            <div className="text-center">
              <svg className="w-12 h-12 text-emerald-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-emerald-200 font-medium">Weight saved!</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mb-2.5 flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600/20">
          <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Quick measurements</h3>
          <p className="text-[11px] text-slate-400">Log weight and waist fast</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <label className="min-w-0 space-y-1">
          <span className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Weight</span>
          <div className="relative">
            <input
              ref={weightRef}
              type="text"
              inputMode="decimal"
              value={weight}
              onChange={(e) => {
                const v = e.target.value;
                if (!/^\d*(?:\.\d*)?$/.test(v)) return;
                setWeight(v);
              }}
              onKeyDown={(e) => handleKeyDown(e, "weight")}
              placeholder={lastWeight ? `${lastWeight.toFixed(1)}` : "kg"}
              className="h-10 w-full rounded-lg border border-white/10 bg-slate-800/80 px-3 pr-10 text-sm font-medium text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
              kg
            </span>
          </div>
        </label>

        <label className="min-w-0 space-y-1">
          <span className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Waist</span>
          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              value={waist}
              onChange={(e) => {
                const v = e.target.value;
                if (!/^\d*(?:\.\d*)?$/.test(v)) return;
                setWaist(v);
              }}
              onKeyDown={(e) => handleKeyDown(e, "waist")}
              placeholder={lastWaist ? `${lastWaist.toFixed(1)}` : "cm"}
              className="h-10 w-full rounded-lg border border-white/10 bg-slate-800/80 px-3 pr-10 text-sm font-medium text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
              cm
            </span>
          </div>
        </label>

        <button
          type="button"
          onClick={handleSave}
          disabled={!isValid || isSaving}
          className="h-10 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white transition-all hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>

      <AnimatePresence>
        {(weightDiff !== null || waistDiff !== null) && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]"
          >
            {weightDiff !== null && (
              <span className="inline-flex items-center gap-1">
                <span className="text-slate-400">Wt:</span>
                <span
                  className={
                    weightDiff > 0
                      ? "text-amber-400"
                      : weightDiff < 0
                        ? "text-emerald-400"
                        : "text-slate-400"
                  }
                >
                  {weightDiff > 0 ? "+" : ""}
                  {weightDiff.toFixed(1)} kg
                </span>
              </span>
            )}
            {waistDiff !== null && (
              <span className="inline-flex items-center gap-1">
                <span className="text-slate-400">Waist:</span>
                <span
                  className={
                    waistDiff > 0
                      ? "text-amber-400"
                      : waistDiff < 0
                        ? "text-emerald-400"
                        : "text-slate-400"
                  }
                >
                  {waistDiff > 0 ? "+" : ""}
                  {waistDiff.toFixed(1)} cm
                </span>
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <p className="mt-2 text-[10px] text-slate-500">
        Use arrow keys to nudge values, Enter to save.
      </p>
    </div>
  );
}
