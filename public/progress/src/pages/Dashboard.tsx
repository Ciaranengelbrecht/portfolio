import { useEffect, useState } from 'react'
import { volumeByMuscleGroup } from '../lib/helpers'
import { db } from '../lib/db'
import { Measurement, Session } from '../lib/types'
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, BarChart, Bar } from 'recharts'
import DashboardDeloadTable from './DashboardDeloadTable'

export default function Dashboard() {
  const [week, setWeek] = useState(1)
  const [volume, setVolume] = useState<Record<string,{tonnage:number,sets:number}>>({})
  const [weights, setWeights] = useState<{date:string, weight:number}[]>([])
  const [waist, setWaist] = useState<{date:string, value:number}[]>([])
  const [arm, setArm] = useState<{date:string, value:number}[]>([])

  useEffect(() => { volumeByMuscleGroup(week).then(setVolume) }, [week])
  useEffect(() => { (async () => {
    const m = await db.getAll<Measurement>('measurements')
    setWeights(m.filter(x=>x.weightKg).map(x=>({ date:x.dateISO.slice(5), weight:x.weightKg! })))
    setWaist(m.filter(x=>x.waist).map(x=>({ date:x.dateISO.slice(5), value:x.waist! })))
    setArm(m.filter(x=>x.upperArm).map(x=>({ date:x.dateISO.slice(5), value:x.upperArm! })))
  })() }, [])

  const volData = Object.entries(volume).map(([k,v]) => ({ group:k, tonnage:v.tonnage, sets:v.sets }))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold">Dashboard</h2>
        <select className="bg-card rounded-xl px-2 py-1" value={week} onChange={e=>setWeek(Number(e.target.value))}>
          {Array.from({length:9},(_,i)=>i+1).map(w=>(<option key={w} value={w}>Week {w}</option>))}
        </select>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-card rounded-2xl p-4 shadow-soft">
          <h3 className="font-medium mb-2">Weekly Volume by Muscle Group</h3>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={volData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="group" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip />
                <Bar dataKey="tonnage" fill="#3b82f6" name="Tonnage" />
                <Bar dataKey="sets" fill="#f59e0b" name="Sets" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-card rounded-2xl p-4 shadow-soft">
          <h3 className="font-medium mb-2">Bodyweight (kg)</h3>
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={weights}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip />
                <Line type="monotone" dataKey="weight" stroke="#3b82f6" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-card rounded-2xl p-4 shadow-soft">
          <h3 className="font-medium mb-2">Waist (cm)</h3>
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={waist}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#ef4444" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-card rounded-2xl p-4 shadow-soft">
          <h3 className="font-medium mb-2">Upper Arm (cm)</h3>
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={arm}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#22c55e" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

  <DashboardDeloadTable />
    </div>
  )
}
