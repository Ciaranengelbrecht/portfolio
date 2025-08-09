import { useEffect, useState } from 'react'
import { db } from '../lib/db'
import { Exercise, Template } from '../lib/types'
import { nanoid } from 'nanoid'

export default function Templates(){
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [name, setName] = useState('')
  const [showAddFor, setShowAddFor] = useState<string|null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => { (async () => {
    setExercises(await db.getAll('exercises'))
    setTemplates(await db.getAll('templates'))
  })() }, [])

  const addTemplate = async () => {
    const t: Template = { id: nanoid(), name: name || `Template ${templates.length+1}`, exerciseIds: exercises.slice(0,4).map(e=>e.id) }
    await db.put('templates', t)
    setTemplates([t, ...templates])
    setName('')
  }

  const toggle = async (t: Template) => {
    const nt = { ...t, hidden: !t.hidden }
    await db.put('templates', nt)
    setTemplates(templates.map(x => x.id===t.id? nt: x))
  }

  const duplicate = async (t: Template) => {
    const copy: Template = { id: nanoid(), name: `${t.name} (copy)`, exerciseIds: [...t.exerciseIds] }
    await db.put('templates', copy)
    setTemplates([copy, ...templates])
  }

  const moveExercise = async (t: Template, from: number, to: number) => {
    const arr = [...t.exerciseIds]
    const [m] = arr.splice(from,1)
    arr.splice(to,0,m)
    const nt = { ...t, exerciseIds: arr }
    await db.put('templates', nt)
    setTemplates(templates.map(x=>x.id===t.id? nt: x))
  }

  const addExerciseToTemplate = async (t: Template, ex: Exercise) => {
    const nt = { ...t, exerciseIds: [...t.exerciseIds, ex.id] }
    await db.put('templates', nt)
    setTemplates(templates.map(x=>x.id===t.id? nt: x))
    setShowAddFor(null); setQuery('')
  }

  const removeExerciseFromTemplate = async (t: Template, id: string) => {
    const nt = { ...t, exerciseIds: t.exerciseIds.filter(x=>x!==id) }
    await db.put('templates', nt)
    setTemplates(templates.map(x=>x.id===t.id? nt: x))
  }

  const toggleOptional = async (ex: Exercise) => {
    const next = { ...ex, isOptional: !ex.isOptional }
    await db.put('exercises', next)
    setExercises(exercises.map(e=> e.id===ex.id? next: e))
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Templates</h2>
      <div className="bg-card rounded-2xl p-3">
        <div className="flex gap-2">
          <input className="bg-slate-800 rounded-xl px-3 py-2 flex-1" placeholder="New template name" value={name} onChange={e=>setName(e.target.value)} />
          <button className="bg-brand-600 hover:bg-brand-700 px-3 py-2 rounded-xl" onClick={addTemplate}>Add</button>
        </div>
      </div>
      <div className="space-y-3">
        {templates.map(t => (
          <div key={t.id} className="bg-card rounded-2xl p-4 shadow-soft">
            <div className="flex items-center justify-between">
              <input className="bg-transparent font-medium" value={t.name} onChange={e=>{ const nt={...t, name:e.target.value}; setTemplates(templates.map(x=>x.id===t.id?nt:x)); db.put('templates', nt) }} />
              <div className="flex items-center gap-2">
                <button className="text-xs bg-slate-800 rounded-xl px-2 py-1" onClick={()=>duplicate(t)}>Duplicate</button>
                <button className="text-xs bg-slate-800 rounded-xl px-2 py-1" onClick={()=>toggle(t)}>{t.hidden? 'Show':'Hide'}</button>
              </div>
            </div>
            <div className="mt-2 text-sm text-gray-300">Exercises: {t.exerciseIds.length}</div>
            <div className="mt-3 space-y-2">
              {t.exerciseIds.map((id, idx) => {
                const ex = exercises.find(e=>e.id===id)
                return (
                  <div key={id} className="flex items-center gap-2 bg-slate-800 rounded-xl px-3 py-2">
                    <div className="flex-1 truncate">{ex?.name || 'Unknown'}</div>
                    <button className="text-xs bg-slate-700 rounded-xl px-2 py-1" disabled={idx===0} onClick={()=>moveExercise(t, idx, idx-1)}>Up</button>
                    <button className="text-xs bg-slate-700 rounded-xl px-2 py-1" disabled={idx===t.exerciseIds.length-1} onClick={()=>moveExercise(t, idx, idx+1)}>Down</button>
                    <button className="text-xs bg-slate-700 rounded-xl px-2 py-1" onClick={()=>ex && toggleOptional(ex)}>{ex?.isOptional? 'Optional ✓':'Optional'}</button>
                    <button className="text-xs bg-red-600 rounded-xl px-2 py-1" onClick={()=>removeExerciseFromTemplate(t, id)}>Remove</button>
                  </div>
                )
              })}
            </div>
            <div className="mt-3">
              <button className="text-xs bg-slate-800 rounded-xl px-2 py-1" onClick={()=>setShowAddFor(t.id)}>Add exercise</button>
            </div>
          </div>
        ))}
      </div>

      {showAddFor && (
        <div className="fixed inset-0 bg-black/60 grid place-items-center" onClick={()=>setShowAddFor(null)}>
          <div className="bg-card rounded-2xl p-4 shadow-soft w-full max-w-md" onClick={e=>e.stopPropagation()}>
            <div className="font-medium mb-2">Add exercise</div>
            <input autoFocus className="w-full bg-slate-800 rounded-xl px-3 py-2" placeholder="Search exercise" value={query} onChange={e=>setQuery(e.target.value)} />
            <div className="mt-3 max-h-60 overflow-y-auto space-y-1">
              {exercises.filter(e=> e.name.toLowerCase().includes(query.toLowerCase())).map(e => (
                <button key={e.id} className="w-full text-left px-3 py-2 bg-slate-800 rounded-xl" onClick={()=>{
                  const t = templates.find(x=>x.id===showAddFor)!; addExerciseToTemplate(t, e)
                }}>{e.name}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
