import { useEffect, useMemo, useState } from "react";
import { db } from "../../lib/db";
import { Exercise, Session, Template } from "../../lib/types";
import { importFromTemplate } from "../../lib/sessionOps";
import { useProgram } from "../../state/program";
import { computeDeloadWeeks } from "../../lib/program";
import {
  readRecentSelections,
  rememberRecentSelection,
  sortByRecentSelection,
} from "../../lib/recentSelections";

const RECENT_IMPORT_SCOPE = "sessions:import-template";

export default function ImportTemplateDialog({
  open,
  onClose,
  session,
  weekNumber,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  session: Session;
  weekNumber: number;
  onImported: (updated: Session, count: number, name: string) => void;
}) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [templateId, setTemplateId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [recentTemplateIds, setRecentTemplateIds] = useState<string[]>([]);
  const [append, setAppend] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const { program } = useProgram();
  const deloadWeeks = program ? computeDeloadWeeks(program) : undefined;

  useEffect(() => {
    if (open) {
      db.getAll<Template>("templates").then(setTemplates);
      db.getAll<Exercise>("exercises").then(setExercises);
      setRecentTemplateIds(readRecentSelections(RECENT_IMPORT_SCOPE));
      setQuery("");
    }
  }, [open]);

  const filteredTemplates = useMemo(() => {
    const term = query.trim().toLowerCase();
    const pool = term
      ? templates.filter((template) =>
          template.name.toLowerCase().includes(term)
        )
      : templates;
    return sortByRecentSelection(
      pool,
      (template) => template.id,
      recentTemplateIds,
      (left, right) => left.name.localeCompare(right.name)
    );
  }, [templates, query, recentTemplateIds]);

  useEffect(() => {
    if (!open) return;
    if (!filteredTemplates.length) {
      setTemplateId("");
      return;
    }
    if (!templateId || !filteredTemplates.some((template) => template.id === templateId)) {
      setTemplateId(filteredTemplates[0].id);
    }
  }, [open, filteredTemplates, templateId]);

  const doImport = async () => {
    const t = templates.find((t) => t.id === templateId);
    if (!t) return;
    if (!append && !confirming) {
      setConfirming(true);
      return;
    }
    const updated = await importFromTemplate(session, t, exercises, {
      append,
      weekNumber,
      deloadWeeks,
    });
    await db.put("sessions", updated);
    setRecentTemplateIds(rememberRecentSelection(RECENT_IMPORT_SCOPE, t.id, 10));
    onImported(updated, t.exerciseIds.length, t.name);
    onClose();
  };

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-card shadow-soft max-h-[min(92dvh,calc(100dvh-1.5rem))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 overflow-y-auto p-4 pb-3">
          <div className="font-medium mb-2">Import from Template</div>
          <label className="space-y-1 block mb-2">
            <div className="text-sm text-gray-300">Search templates</div>
            <input
              autoFocus
              className="w-full rounded-xl bg-slate-800 px-3 py-2 text-sm"
              placeholder="Search templates"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="search"
              spellCheck={false}
            />
          </label>
          <div className="rounded-xl border border-white/10 bg-slate-900/40 p-1">
            <div className="max-h-[min(46dvh,320px)] overflow-y-auto pb-2">
              {filteredTemplates.length ? (
                filteredTemplates.map((template) => {
                  const selected = template.id === templateId;
                  const isRecent = recentTemplateIds.includes(template.id);
                  return (
                    <button
                      key={template.id}
                      type="button"
                      className={`mb-1.5 w-full rounded-lg px-3 py-2 text-left text-sm transition last:mb-0 ${
                        selected
                          ? "border border-emerald-400/50 bg-emerald-500/20 text-white"
                          : "border border-transparent bg-slate-800/70 text-slate-100 hover:bg-slate-700/70"
                      }`}
                      onClick={() => setTemplateId(template.id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{template.name}</span>
                        {isRecent && (
                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/70">
                            Recent
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-lg px-3 py-6 text-center text-sm text-slate-300/70">
                  No templates match your search.
                </div>
              )}
            </div>
          </div>
          <label className="flex items-center gap-2 mb-3 mt-3 text-sm">
            <input
              type="checkbox"
              checked={append}
              onChange={(e) => setAppend(e.target.checked)}
            />
            Append to existing entries
          </label>
          {!append && confirming && (
            <div className="mb-2 rounded border border-amber-700 bg-amber-900/30 p-2 text-sm text-amber-300">
              This will replace all exercises for this session.
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-white/10 bg-slate-950/40 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3">
          <button
            className="bg-slate-700 px-3 py-2 rounded-xl"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="bg-brand-600 hover:bg-brand-700 px-3 py-2 rounded-xl disabled:opacity-50"
            disabled={!templateId}
            onClick={doImport}
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
