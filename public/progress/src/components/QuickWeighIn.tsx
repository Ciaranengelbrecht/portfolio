import { useState, useEffect, useRef, useCallback } from "react";
import { db } from "../lib/db";
import { Measurement } from "../lib/types";
import { nanoid } from "nanoid";
import { motion, AnimatePresence } from "framer-motion";

interface QuickWeighInProps {
  onSave: () => void;
  lastWeight?: number;
}

/**
 * QuickWeighIn - A streamlined weight entry component
 * Reduces friction for the most common measurement: daily weight
 */
export default function QuickWeighIn({ onSave, lastWeight }: QuickWeighInProps) {
  const [weight, setWeight] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount for quick entry
  useEffect(() => {
    // Small delay to avoid focus issues on page load
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  const handleSave = useCallback(async () => {
    const val = parseFloat(weight);
    if (isNaN(val) || val <= 0) return;

    setIsSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      
      // Check if there's already a measurement for today
      const all = await db.getAll<Measurement>("measurements");
      const todayEntry = all.find((m) => m.dateISO.slice(0, 10) === today);

      if (todayEntry) {
        // Update existing entry
        await db.put("measurements", {
          ...todayEntry,
          weightKg: val,
        });
      } else {
        // Get height from most recent entry if available
        const sorted = [...all].sort((a, b) => b.dateISO.localeCompare(a.dateISO));
        const lastHeight = sorted.find((m) => typeof m.heightCm === "number")?.heightCm;

        // Create new entry with just weight
        const newEntry: Measurement = {
          id: nanoid(),
          dateISO: new Date().toISOString(),
          weightKg: val,
          ...(lastHeight && { heightCm: lastHeight }),
        };
        await db.put("measurements", newEntry);
      }

      setShowSuccess(true);
      setWeight("");
      onSave();

      // Reset success state after animation
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (err) {
      console.error("Quick weigh-in failed:", err);
    } finally {
      setIsSaving(false);
    }
  }, [weight, onSave]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setWeight((prev) => {
        const val = parseFloat(prev) || lastWeight || 0;
        return (val + 0.1).toFixed(1);
      });
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setWeight((prev) => {
        const val = parseFloat(prev) || lastWeight || 0;
        return Math.max(0, val - 0.1).toFixed(1);
      });
    }
  };

  const isValid = !isNaN(parseFloat(weight)) && parseFloat(weight) > 0;
  const diff = lastWeight && isValid ? parseFloat(weight) - lastWeight : null;

  return (
    <div className="relative rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-950/40 to-slate-900/60 p-4 overflow-hidden">
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

      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-600/20 flex items-center justify-center">
          <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Quick Weigh-in</h3>
          <p className="text-xs text-slate-400">Log today's weight in seconds</p>
        </div>
      </div>

      <div className="flex items-stretch gap-2">
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={weight}
            onChange={(e) => {
              const v = e.target.value;
              if (!/^\d*(?:\.\d*)?$/.test(v)) return;
              setWeight(v);
            }}
            onKeyDown={handleKeyDown}
            placeholder={lastWeight ? `${lastWeight.toFixed(1)}` : "Weight"}
            className="w-full h-12 px-4 pr-12 rounded-xl bg-slate-800/80 border border-white/10 
                       text-lg font-medium text-white placeholder:text-slate-500
                       focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50
                       transition-all"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-500">
            kg
          </span>
        </div>

        <button
          onClick={handleSave}
          disabled={!isValid || isSaving}
          className="h-12 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 
                     disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed
                     text-white font-medium transition-all
                     flex items-center gap-2"
        >
          {isSaving ? (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          Save
        </button>
      </div>

      {/* Weight difference indicator */}
      <AnimatePresence>
        {diff !== null && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-2 flex items-center gap-2 text-xs"
          >
            <span className="text-slate-400">vs. last:</span>
            <span className={diff > 0 ? "text-amber-400" : diff < 0 ? "text-emerald-400" : "text-slate-400"}>
              {diff > 0 ? "+" : ""}{diff.toFixed(1)} kg
            </span>
            {diff !== 0 && (
              <span className={diff > 0 ? "text-amber-400/60" : "text-emerald-400/60"}>
                ({diff > 0 ? "↑" : "↓"} {Math.abs((diff / lastWeight!) * 100).toFixed(1)}%)
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hint text */}
      <p className="mt-3 text-[11px] text-slate-500 flex items-center gap-1.5">
        <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-[10px]">↑</kbd>
        <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-[10px]">↓</kbd>
        <span>to adjust • </span>
        <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-[10px]">Enter</kbd>
        <span>to save</span>
      </p>
    </div>
  );
}
