import { useEffect, useMemo, useState } from 'react'
import { db } from '../lib/db'
import { Measurement } from '../lib/types'
import { nanoid } from 'nanoid'
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts'
import MeasurementsInfoModal from './MeasurementsInfoModal'
import Snackbar from '../components/Snackbar'

const TIPS: Record<string, string> = {
  neck: 'Measure at the thickest point, relaxed.',
  chest: 'Tape at nipples level, relaxed.',
  waist: 'At navel, relaxed but not sucked in.',
  hips: 'Around glutes at the widest point.',
  thigh: 'Mid-thigh, stand tall.',
  calf: 'At the largest point standing.',
  upperArm: 'Upper arm cold, flexed lightly.',
  forearm: 'At the largest point, arm parallel to floor.'
}

export default function Measurements(){
  const [m, setM] = useState<Measurement>({ id: nanoid(), dateISO: new Date().toISOString() })
  const [data, setData] = useState<Measurement[]>([])
  const [snack, setSnack] = useState<{open:boolean; msg:string; undo?:()=>void}>({open:false,msg:''})

  useEffect(() => { db.getAll<Measurement>('measurements').then(setData) }, [])

  const save = async () => {
    await db.put('measurements', m)
    setData([m, ...data])
    setM({ id: nanoid(), dateISO: new Date().toISOString() })
  }

  const remove = async (id: string) => {
    const prev = data
    await db.delete('measurements', id)
    setData(data.filter(x=>x.id!==id))
    setSnack({ open:true, msg:'Measurement deleted', undo: async ()=>{ for(const it of prev) await db.put('measurements', it); setData(prev) } })
  }

  const update = async (id: string, patch: Partial<Measurement>) => {
    const next = data.map(x=> x.id===id? { ...x, ...patch }: x)
    setData(next)
    const target = next.find(x=>x.id===id)!
    await db.put('measurements', target)
  }

  const series = (key: keyof Measurement) => data.filter(x=>x[key]).map(x=>({ date:x.dateISO.slice(5), value: (x as any)[key] }))

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Measurements</h2>
      <div className="bg-card rounded-2xl p-4 shadow-soft space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {['weightKg','neck','chest','waist','hips','thigh','calf','upperArm','forearm'].map((k) => (
            <label key={k} className="space-y-1">
              <div className="text-sm text-gray-300 capitalize">{k}</div>
              <div className="flex items-center gap-1">
                <button className="text-xs bg-slate-700 rounded px-2" onClick={()=> setM(prev => ({ ...prev, [k]: Math.max(0, Number((prev as any)[k]||0) - 0.5) }))}>-</button>
                <input inputMode="decimal" className="w-full bg-slate-800 rounded-xl px-3 py-2" value={(m as any)[k]||''}
                  onKeyDown={e=>{ if(e.key==='ArrowUp'){ e.preventDefault(); setM(prev => ({ ...prev, [k]: Number((prev as any)[k]||0) + 0.5 })) } else if(e.key==='ArrowDown'){ e.preventDefault(); setM(prev => ({ ...prev, [k]: Math.max(0, Number((prev as any)[k]||0) - 0.5) })) } }}
                  onChange={e=>{ const v=e.target.value; if(!/^\d*(?:\.\d*)?$/.test(v)) return; setM({...m, [k]: v===''? undefined : Number(v) }) }} />
                <button className="text-xs bg-slate-700 rounded px-2" onClick={()=> setM(prev => ({ ...prev, [k]: Number((prev as any)[k]||0) + 0.5 }))}>+</button>
              </div>
              {TIPS[k] && <p className="text-xs text-gray-400">{TIPS[k]}</p>}
            </label>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button className="bg-brand-600 hover:bg-brand-700 px-3 py-2 rounded-xl" onClick={save}>Save</button>
          <MeasurementsInfoModal />
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <ChartCard title="Weight (kg)" data={series('weightKg')} color="#3b82f6" />
        <ChartCard title="Waist (cm)" data={series('waist')} color="#ef4444" />
        <ChartCard title="Upper Arm (cm)" data={series('upperArm')} color="#22c55e" />
      </div>

      <div className="bg-card rounded-2xl p-4 shadow-soft">
        <div className="font-medium mb-2">Entries</div>
        <div className="space-y-2">
          {data.map(row => (
            <div key={row.id} className="grid grid-cols-[auto,1fr,auto] items-center gap-2 bg-slate-800 rounded-xl px-3 py-2">
              <div className="text-xs text-gray-400">{row.dateISO.slice(0,10)}</div>
              <div className="grid grid-cols-3 gap-2">
                <div className="flex items-center gap-1">
                  <button className="text-xs bg-slate-800 rounded px-2" onClick={()=> update(row.id, { weightKg: Math.max(0, (row.weightKg||0) - 0.5) })}>-</button>
                  <input className="bg-slate-900 rounded px-2 py-1 w-24" inputMode="decimal" value={row.weightKg||''}
                    onKeyDown={e=>{ if(e.key==='ArrowUp'){ e.preventDefault(); update(row.id, { weightKg: (row.weightKg||0) + 0.5 }) } else if(e.key==='ArrowDown'){ e.preventDefault(); update(row.id, { weightKg: Math.max(0,(row.weightKg||0) - 0.5) }) } }}
                    onChange={e=>{ const v=e.target.value; if(!/^\d*(?:\.\d*)?$/.test(v)) return; update(row.id, { weightKg: v===''? undefined : Number(v) }) }} placeholder="kg" />
                  <button className="text-xs bg-slate-800 rounded px-2" onClick={()=> update(row.id, { weightKg: (row.weightKg||0) + 0.5 })}>+</button>
                </div>
                <div className="flex items-center gap-1">
                  <button className="text-xs bg-slate-800 rounded px-2" onClick={()=> update(row.id, { waist: Math.max(0, (row.waist||0) - 0.5) })}>-</button>
                  <input className="bg-slate-900 rounded px-2 py-1 w-24" inputMode="decimal" value={row.waist||''}
                    onKeyDown={e=>{ if(e.key==='ArrowUp'){ e.preventDefault(); update(row.id, { waist: (row.waist||0) + 0.5 }) } else if(e.key==='ArrowDown'){ e.preventDefault(); update(row.id, { waist: Math.max(0,(row.waist||0) - 0.5) }) } }}
                    onChange={e=>{ const v=e.target.value; if(!/^\d*(?:\.\d*)?$/.test(v)) return; update(row.id, { waist: v===''? undefined : Number(v) }) }} placeholder="waist" />
                  <button className="text-xs bg-slate-800 rounded px-2" onClick={()=> update(row.id, { waist: (row.waist||0) + 0.5 })}>+</button>
                </div>
                <div className="flex items-center gap-1">
                  <button className="text-xs bg-slate-800 rounded px-2" onClick={()=> update(row.id, { upperArm: Math.max(0, (row.upperArm||0) - 0.5) })}>-</button>
                  <input className="bg-slate-900 rounded px-2 py-1 w-24" inputMode="decimal" value={row.upperArm||''}
                    onKeyDown={e=>{ if(e.key==='ArrowUp'){ e.preventDefault(); update(row.id, { upperArm: (row.upperArm||0) + 0.5 }) } else if(e.key==='ArrowDown'){ e.preventDefault(); update(row.id, { upperArm: Math.max(0,(row.upperArm||0) - 0.5) }) } }}
                    onChange={e=>{ const v=e.target.value; if(!/^\d*(?:\.\d*)?$/.test(v)) return; update(row.id, { upperArm: v===''? undefined : Number(v) }) }} placeholder="arm" />
                  <button className="text-xs bg-slate-800 rounded px-2" onClick={()=> update(row.id, { upperArm: (row.upperArm||0) + 0.5 })}>+</button>
                </div>
              </div>
              <button className="text-xs bg-red-600 rounded px-2 py-1" onClick={()=>remove(row.id)}>Delete</button>
            </div>
          ))}
        </div>
      </div>

      <Snackbar open={snack.open} message={snack.msg} actionLabel={snack.undo? 'Undo': undefined} onAction={()=>{ snack.undo?.(); setSnack({open:false,msg:''}) }} onClose={()=>setSnack({open:false,msg:''})} />
    </div>
  )
}

function ChartCard({ title, data, color }: { title:string; data:any[]; color:string }){
  return (
    <div className="bg-card rounded-2xl p-4 shadow-soft">
      <h3 className="font-medium mb-2">{title}</h3>
      <div className="h-56">
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="date" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke={color} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
