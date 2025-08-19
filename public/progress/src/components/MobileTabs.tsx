import { NavLink } from 'react-router-dom';

const tabs: { to: string; label: string; icon?: string }[] = [
  { to: '/', label: 'Dashboard' },
  { to: '/sessions', label: 'Sessions' },
  { to: '/templates', label: 'Programs' },
  { to: '/store', label: 'Store' },
  { to: '/settings', label: 'Settings' }
];

export default function MobileTabs(){
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[1100] md:hidden backdrop-blur bg-slate-950/70 border-t border-white/10 flex justify-around py-1">
      {tabs.map(t=> (
        <NavLink key={t.to} to={t.to} className={({isActive})=>`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] ${isActive? 'text-emerald-400':'text-gray-400'}`}>{t.label}</NavLink>
      ))}
    </nav>
  );
}
