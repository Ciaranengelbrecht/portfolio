import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { fadeSlideUp, maybeDisable } from '../lib/motion';

interface Snack { id: string; message: string; actionLabel?: string; onAction?: ()=>void; duration?: number }

interface SnackCtx { push: (s: Omit<Snack,'id'>) => void; }
const SnackContext = createContext<SnackCtx | null>(null);

export function useSnack(){
  const ctx = useContext(SnackContext);
  if(!ctx) throw new Error('useSnack outside provider');
  return ctx;
}

export function SnackProvider({ children }:{ children: React.ReactNode }){
  const [snacks,setSnacks] = useState<Snack[]>([]);
  const counter = useRef(0);
  const push = useCallback((s: Omit<Snack,'id'>)=> {
    const id = 'snk_'+(++counter.current);
    setSnacks(q=> [...q, { id, ...s }]);
    if(s.duration !== 0){
      const d = s.duration ?? 4000;
      setTimeout(()=> setSnacks(q=> q.filter(x=> x.id!==id)), d + 30);
    }
  },[]);
  const close = (id:string)=> setSnacks(q=> q.filter(s=> s.id!==id));
  return (
    <SnackContext.Provider value={{ push }}>
      {children}
      <div className="fixed inset-0 pointer-events-none flex flex-col items-center gap-2 px-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] justify-end z-[1300]">
        <AnimatePresence initial={false}>
          {snacks.map((s)=> (
            <motion.div
              key={s.id}
              layout
              className="pointer-events-auto w-full max-w-sm"
              variants={maybeDisable(fadeSlideUp)}
              initial="initial" animate="animate" exit="exit"
            >
              <div className="bg-slate-900/90 backdrop-blur border border-white/10 rounded-xl px-4 py-3 shadow-soft flex items-start gap-3">
                <div className="text-sm flex-1 leading-tight">{s.message}</div>
                {s.actionLabel && <button onClick={()=> { s.onAction?.(); close(s.id); }} className="text-xs font-semibold text-emerald-300 hover:text-emerald-200 transition-colors">{s.actionLabel}</button>}
                <button aria-label="Dismiss" onClick={()=> close(s.id)} className="text-slate-400 hover:text-slate-200 text-xs">×</button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </SnackContext.Provider>
  );
}
