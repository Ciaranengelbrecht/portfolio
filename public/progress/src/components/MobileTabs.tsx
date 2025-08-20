import { NavLink, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../lib/motion';

interface TabDef { to: string; label: string; icon: (active:boolean)=> JSX.Element }

const Icon = ({ d, active }: { d: string; active: boolean }) => (
  <svg width={24} height={24} viewBox="0 0 24 24" className="shrink-0" aria-hidden focusable="false">
    <path d={d} className={active? 'transition-colors fill-emerald-400':'transition-colors fill-slate-400'} />
  </svg>
);

const tabs: TabDef[] = [
  { to: '/', label: 'Home', icon: a=> <Icon active={a} d="M3 11.2 12 3l9 8.2V21a1 1 0 0 1-1 1h-5v-6H10v6H4a1 1 0 0 1-1-1v-9.8Z" /> },
  { to: '/sessions', label: 'Train', icon: a=> <Icon active={a} d="M5 4h14v4H5V4Zm0 6h14v4H5v-4Zm0 6h14v4H5v-4Z" /> },
  { to: '/settings/program', label: 'Program', icon: a=> <Icon active={a} d="M12 2 4.5 6v12L12 22l7.5-4V6L12 2Zm0 2.3 5.5 3.1v.2L12 11 6.5 7.6v-.2L12 4.3ZM6.5 10.2 11 13v6.2l-4.5-2.4v-6.6Zm6.5 8V13l4.5-2.8v6.6L13 18.2Z" /> },
  { to: '/templates', label: 'Templates', icon: a=> <Icon active={a} d="M4 4h16v4H4V4Zm0 6h10v4H4v-4Zm0 6h16v4H4v-4Z" /> },
  { to: '/settings', label: 'Settings', icon: a=> <Icon active={a} d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8.94 2.88-.82-.65c.04-.25.06-.5.06-.76 0-.26-.02-.52-.06-.77l.82-.64a.5.5 0 0 0 .12-.65l-.94-1.63a.5.5 0 0 0-.6-.22l-.97.39a7.2 7.2 0 0 0-1.33-.77l-.15-1.04a.5.5 0 0 0-.5-.43h-1.88a.5.5 0 0 0-.5.43l-.15 1.04c-.48.2-.92.46-1.33.77l-.97-.39a.5.5 0 0 0-.6.22l-.94 1.63a.5.5 0 0 0 .12.65l.82.64c-.04.25-.06.51-.06.77 0 .26.02.51.06.76l-.82.65a.5.5 0 0 0-.12.65l.94 1.63c.14.24.43.34.69.22l.97-.39c.41.31.85.57 1.33.77l.15 1.04c.04.25.25.43.5.43h1.88c.25 0 .46-.18.5-.43l.15-1.04c.48-.2.92-.46 1.33-.77l.97.39c.26.12.55.02.69-.22l.94-1.63a.5.5 0 0 0-.12-.65Z" /> },
];

export default function MobileTabs(){
  const loc = useLocation();
  const containerRef = useRef<HTMLDivElement|null>(null);
  const indicatorRef = useRef<HTMLDivElement|null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(()=> { setMounted(true); },[]);
  useEffect(()=> {
    const active = containerRef.current?.querySelector<HTMLAnchorElement>('a[aria-current="page"]');
    if(active && indicatorRef.current){
      const r = active.getBoundingClientRect();
      const pr = containerRef.current!.getBoundingClientRect();
      const reduce = prefersReducedMotion();
      indicatorRef.current.style.transform = `translateX(${r.left - pr.left}px)`;
      indicatorRef.current.style.width = r.width + 'px';
      if(reduce){
        indicatorRef.current.style.transition = 'none';
      }
    }
  }, [loc.pathname, mounted]);

  return (
    <nav aria-label="Primary" className="fixed bottom-0 left-0 right-0 z-[1100] md:hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <div ref={containerRef} className="relative mx-auto flex justify-around rounded-t-xl bg-slate-950/80 backdrop-blur supports-[backdrop-filter]:bg-slate-950/55 border-t border-white/10 px-1 pt-0.5 pb-[calc(.25rem+env(safe-area-inset-bottom))] shadow-[0_-3px_12px_-6px_rgba(0,0,0,.65)] min-h-[46px]">
          <div ref={indicatorRef} aria-hidden className="absolute -z-10 h-[32px] rounded-lg bg-emerald-400/12 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.25),0_4px_10px_-6px_rgba(16,185,129,0.35)] transition-all duration-300 ease-[cubic-bezier(.35,.7,.25,1)]" />
        {tabs.map(t=> (
          <NavLink
            key={t.to}
            to={t.to}
              className={({isActive})=>`relative flex flex-col items-center justify-center gap-0.5 px-2.5 py-1 rounded-lg text-[10px] font-medium tracking-wide ${isActive? 'text-emerald-300':'text-slate-400 hover:text-slate-200'} transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-0 active:scale-95`}
          >
              <span className={loc.pathname===t.to? 'scale-110 transition-transform':'transition-transform'}>{t.icon(Boolean(loc.pathname === t.to))}</span>
            <span className="leading-none">{t.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
