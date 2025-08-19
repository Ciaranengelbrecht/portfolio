import { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';

interface NavDrawerProps {
  open: boolean;
  onClose: () => void;
  authEmail: string | null;
  onSignOut: () => Promise<void> | void;
}

export default function NavDrawer({ open, onClose, authEmail, onSignOut }: NavDrawerProps){
  const ref = useRef<HTMLDivElement|null>(null);
  useEffect(()=>{ if(!open) return; const onKey=(e:KeyboardEvent)=>{ if(e.key==='Escape'){ onClose(); } }; document.addEventListener('keydown', onKey); return ()=> document.removeEventListener('keydown', onKey); },[open]);
  useEffect(()=>{ if(open){ requestAnimationFrame(()=>{ ref.current?.querySelector<HTMLElement>('a,button')?.focus?.(); }); } },[open]);
  if(!(open)) return null;
  return (
    <div className="fixed inset-0 z-[1200] flex" aria-modal="true" role="dialog">
      <button className="flex-1 bg-black/40 backdrop-blur-sm" aria-label="Close navigation" onClick={onClose}></button>
      <div ref={ref} className="w-[78%] max-w-[300px] h-full bg-slate-900/95 border-l border-white/10 shadow-xl flex flex-col animate-[drawerIn_.28s_cubic-bezier(.32,.72,.33,1)] focus:outline-none" tabIndex={-1}>
        <div className="p-4 pb-2 flex items-center justify-between">
          <span className="font-semibold text-lg">Menu</span>
          <button onClick={onClose} className="text-xs px-2 py-1 rounded bg-slate-700">Close</button>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          {[
            ['/', 'Dashboard'],
            ['/sessions','Sessions'],
            ['/measurements','Measurements'],
            ['/templates','Programs'],
            ['/store','Store'],
            ['/settings','Settings']
          ].map(([to,label])=> (
            <NavLink key={to} to={to} onClick={onClose} className={({isActive})=>`block px-3 py-2 rounded-lg text-sm ${isActive? 'bg-emerald-600 text-black font-medium':'hover:bg-white/5 text-gray-200'}`}>{label}</NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-white/5 text-xs flex items-center justify-between gap-2">
          {authEmail ? <span className="truncate text-emerald-400" title={authEmail}>{authEmail}</span> : <span className="text-gray-400">Signed out</span>}
          {authEmail && <button onClick={onSignOut} className="bg-red-600 px-2 py-1 rounded">Sign out</button>}
        </div>
      </div>
    </div>
  );
}
