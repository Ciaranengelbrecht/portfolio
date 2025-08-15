import { Navigate, useLocation } from 'react-router-dom'
import { waitForSession } from '../../lib/supabase'
import { useEffect, useState } from 'react'

export default function RequireAuth({ children }: { children: JSX.Element }){
  const loc = useLocation()
  const [checked, setChecked] = useState(false)
  const [authed, setAuthed] = useState(false)
  useEffect(()=>{ (async()=>{ const s = await waitForSession({ timeoutMs: 1200 }); setAuthed(!!s?.user); setChecked(true) })() },[])
  if(!checked) return <div className='p-6 text-sm text-gray-400'>Loading…</div>
  if(!authed) return <Navigate to='/auth' replace state={{ redirectTo: loc.pathname }} />
  return children
}
