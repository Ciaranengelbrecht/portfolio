import { useEffect, useState } from 'react'
import { db } from '../lib/db'
import { Exercise } from '../lib/types'
import { getDeloadPrescriptionsBulk } from '../lib/helpers'

export default function DashboardDeloadTable(){
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [rows, setRows] = useState<any[]>([])
  const [week, setWeek] = useState(1)
  useEffect(() => { db.getAll<Exercise>('exercises').then(setExercises) }, [])
  useEffect(() => { (async () => {
    if(!exercises.length){ setRows([]); return; }
    const nextWeek = week === 9 ? 1 : week + 1;
    const bulk = await getDeloadPrescriptionsBulk(exercises.map(e=> e.id), nextWeek, undefined, { exercises });
    const arr = exercises.map(e => ({ name: e.name, ...(bulk as any)[e.id] }));
    setRows(arr)
  })() }, [exercises, week])
  return (
    <div className="bg-card rounded-2xl p-4 shadow-soft">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium">Upcoming Deload Prescriptions</h3>
        <select className="bg-slate-800 rounded-xl px-2 py-1" value={week} onChange={e=>setWeek(Number(e.target.value))}>
          {Array.from({length:9},(_,i)=>i+1).map(w=>(<option key={w} value={w}>Week {w}</option>))}
        </select>
      </div>
      <div className="text-sm grid grid-cols-3 gap-2">
        <div className="text-gray-400">Exercise</div>
        <div className="text-gray-400">Weight</div>
        <div className="text-gray-400">Sets</div>
        {rows.map((r,i)=>(
          <>
            <div key={`n-${i}`}>{r.name}</div>
            <div key={`w-${i}`}>{r.targetWeight} kg</div>
            <div key={`s-${i}`}>{r.targetSets}</div>
          </>
        ))}
      </div>
    </div>
  )
}
