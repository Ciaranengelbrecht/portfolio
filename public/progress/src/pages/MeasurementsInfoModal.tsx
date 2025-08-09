import { useState } from 'react'
import SVG from './MeasurementsInfo.svg?url'

export default function MeasurementsInfoModal(){
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button className="text-xs underline" onClick={()=>setOpen(true)}>How to measure</button>
      {open && (
        <div className="fixed inset-0 bg-black/60 grid place-items-center" onClick={()=>setOpen(false)}>
          <div className="bg-card rounded-2xl p-4 shadow-soft max-w-md" onClick={e=>e.stopPropagation()}>
            <div className="font-medium mb-2">How to measure</div>
            <img src={SVG} alt="illustrations" className="rounded-xl" />
            <div className="text-xs text-gray-400 mt-2">Illustrations placeholder</div>
          </div>
        </div>
      )}
    </div>
  )
}
