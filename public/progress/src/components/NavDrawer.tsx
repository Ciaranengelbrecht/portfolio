import { useEffect, useRef, useCallback } from 'react';
import { NavLink } from 'react-router-dom';

interface NavDrawerProps {
  open: boolean;
  onClose: () => void;
  authEmail: string | null;
  onSignOut: () => Promise<void> | void;
}

export default function NavDrawer({ open, onClose, authEmail, onSignOut }: NavDrawerProps){
  const panelRef = useRef<HTMLDivElement|null>(null);
  const lastFocused = useRef<HTMLElement|null>(null);

  // Track previously focused element for restoration
  useEffect(()=>{ if(open){ lastFocused.current = document.activeElement as HTMLElement | null; } },[open]);

  // Escape key handling & focus trapping
  useEffect(()=>{
    if(!open) return;
    const onKey=(e:KeyboardEvent)=>{
      if(e.key==='Escape'){ onClose(); }
      else if(e.key==='Tab' && panelRef.current){
        const focusables = panelRef.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),[tabindex="0"]');
        if(!focusables.length) return;
        const first = focusables[0]; const last = focusables[focusables.length-1];
        if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
        else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return ()=> document.removeEventListener('keydown', onKey);
  },[open,onClose]);

  // Autofocus first element
  useEffect(()=>{ if(open){ requestAnimationFrame(()=>{ panelRef.current?.querySelector<HTMLElement>('a,button')?.focus?.(); }); } },[open]);

  // Restore focus when closed
  useEffect(()=>{ if(!open && lastFocused.current){ lastFocused.current.focus(); } },[open]);

  const handleBackdrop = useCallback((e:React.MouseEvent)=>{ e.stopPropagation(); onClose(); },[onClose]);

  if(!open) return null;
  return (
    <div className="fixed inset-0 z-[1200]" aria-modal="true" role="dialog" aria-label="Navigation drawer">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm opacity-100 transition-opacity" onClick={handleBackdrop} />
      <div className="absolute inset-y-0 right-0 flex max-w-full pointer-events-none">
        <div
          ref={panelRef}
          className="pointer-events-auto w-[78vw] max-w-[320px] h-full bg-gradient-to-b from-slate-900/95 to-slate-950/95 border-l border-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_10px_40px_-8px_rgba(0,0,0,.6)] flex flex-col outline-none translate-x-0 animate-[drawerSlide_.4s_cubic-bezier(.32,.72,.33,1)]"
          tabIndex={-1}
        >
          <div className="p-4 pb-3 flex items-center justify-between gap-3">
            <span className="font-semibold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-200">Menu</span>
            <button onClick={onClose} className="GlossyButton inline-flex h-8 items-center rounded-md px-3 text-xs font-medium bg-slate-700/60 hover:bg-slate-600/70 text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60">
              Close
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-1" aria-label="Primary">
            {[
              ['/', 'Dashboard'],
              ['/analytics','Analytics'],
              ['/sessions','Sessions'],
              ['/recovery','Recovery'],
              ['/measurements','Measurements'],
              ['/templates','Programs'],
              ['/store','Store'],
              ['/settings','Settings']
            ].map(([to,label])=> (
              <NavLink
                key={to}
                to={to}
                onClick={onClose}
                className={({isActive})=>`group flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium tracking-wide transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 ${isActive? 'bg-emerald-500/20 text-emerald-200 shadow-inner shadow-emerald-500/10':'text-slate-200/80 hover:text-slate-100 hover:bg-white/5'}`}
              >
                <span className="relative flex-1">{label}</span>
                {to === '/store' && <span className="text-[10px] rounded bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5">New</span>}
              </NavLink>
            ))}
          </nav>
          <div className="p-4 border-t border-white/5 text-xs flex items-center justify-between gap-2 bg-slate-950/40">
            {authEmail ? <span className="truncate text-emerald-400" title={authEmail}>{authEmail}</span> : <span className="text-slate-400">Signed out</span>}
            {authEmail && <button onClick={onSignOut} className="inline-flex items-center rounded-md bg-red-600/80 hover:bg-red-600 px-2 py-1 text-[11px] font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60">Sign out</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
