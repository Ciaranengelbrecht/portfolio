import { useEffect, useState } from "react";
import { db } from "../../lib/db";
import { Exercise, Session, Template } from "../../lib/types";
import { importFromTemplate } from "../../lib/sessionOps";
import { useProgram } from "../../state/program";
import { computeDeloadWeeks } from "../../lib/program";

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
  const [append, setAppend] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const { program } = useProgram();
  const deloadWeeks = program ? computeDeloadWeeks(program) : undefined;

  useEffect(() => {
    if (open) {
      db.getAll<Template>("templates").then(setTemplates);
      db.getAll<Exercise>("exercises").then(setExercises);
    }
  }, [open]);

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
    onImported(updated, t.exerciseIds.length, t.name);
    onClose();
  };

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 bg-black/60 grid place-items-center"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl p-4 shadow-soft w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-medium mb-2">Import from Template</div>
        <label className="space-y-1 block mb-2">
          <div className="text-sm text-gray-300">Template</div>
          <select
            className="w-full bg-slate-800 rounded-xl px-3 py-2"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            <option value="">Select…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 mb-3 text-sm">
          <input
            type="checkbox"
            checked={append}
            onChange={(e) => setAppend(e.target.checked)}
          />
          Append to existing entries
        </label>
        {!append && confirming && (
          <div className="bg-amber-900/30 border border-amber-700 text-amber-300 text-sm rounded p-2 mb-2">
            This will replace all exercises for this session.
          </div>
        )}
        <div className="flex justify-end gap-2">
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
