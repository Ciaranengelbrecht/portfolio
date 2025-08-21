import { useEffect, useState } from 'react';
import { db } from '../../lib/db';
import { Session, Template } from '../../lib/types';
import { nanoid } from 'nanoid';

export default function SaveTemplateDialog({
  open,
  onClose,
  session,
  onSaved
}: {
  open: boolean;
  onClose: () => void;
  session: Session | null;
  onSaved: (template: Template) => void;
}) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(()=> {
    if(open && session){
      // Suggest a default name like "Workout {date}" or based on first exercise
      const base = (()=> {
        if(session.localDate) return `Workout ${session.localDate}`;
        const first = session.entries[0];
        return first? 'Custom Workout' : 'Empty Workout';
      })();
      setName(base);
    }
  }, [open, session?.id]);

  const disabled = !session || !session.entries.length || !name.trim();

  const save = async ()=> {
    if(disabled) return;
    setSaving(true);
    try {
      const exerciseIds: string[] = [];
      const plan: NonNullable<Template['plan']> = [];
      for(const entry of session!.entries){
        exerciseIds.push(entry.exerciseId);
        plan.push({
          exerciseId: entry.exerciseId,
          plannedSets: entry.sets.length,
          repRange: entry.targetRepRange || '?',
          progression: undefined
        });
      }
      const template: Template = {
        id: nanoid(),
        name: name.trim().slice(0,60),
        exerciseIds,
        plan
      };
      await db.put('templates', template);
      onSaved(template);
      onClose();
    } catch(e){
      console.warn('Save template failed', e);
    } finally {
      setSaving(false);
    }
  };

  if(!open) return null;
  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-center z-50" onClick={onClose}>
      <div className="bg-card rounded-2xl p-4 shadow-soft w-full max-w-sm" onClick={e=> e.stopPropagation()}>
        <div className="font-medium mb-2">Save as Template</div>
        <label className="space-y-1 block mb-3">
          <div className="text-sm text-gray-300">Template name</div>
          <input
            className="w-full bg-slate-800 rounded-xl px-3 py-2"
            value={name}
            onChange={e=> setName(e.target.value)}
            placeholder="My Push Day"
            maxLength={60}
            autoFocus
          />
        </label>
        <div className="text-xs text-gray-400 mb-4">
          {session?.entries.length} exercises will be saved with their set counts.
        </div>
        <div className="flex justify-end gap-2">
          <button className="bg-slate-700 px-3 py-2 rounded-xl" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="bg-brand-600 hover:bg-brand-700 px-3 py-2 rounded-xl disabled:opacity-50" disabled={disabled||saving} onClick={save}>{saving? 'Saving…':'Save'}</button>
        </div>
      </div>
    </div>
  );
}
