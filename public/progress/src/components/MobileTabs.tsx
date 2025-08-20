import { NavLink } from 'react-router-dom';

const tabs: { to: string; label: string; icon?: string }[] = [
  { to: '/', label: 'Home' },
  { to: '/sessions', label: 'Train' },
  { to: '/settings/program', label: 'Program' },
  { to: '/templates', label: 'Templates' },
  { to: '/settings', label: 'Settings' }
];

export default function MobileTabs(){
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[1100] md:hidden backdrop-blur bg-slate-950/70 border-t border-white/10 flex justify-around py-1 px-1">
      {tabs.map(t=> (
        <NavLink
          key={t.to}
          to={t.to}
          className={({isActive})=>`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-medium tracking-wide ${isActive? 'text-emerald-300 bg-emerald-500/10':'text-gray-400'} transition-colors`}
        >{t.label}</NavLink>
      ))}
    </nav>
  );
}
