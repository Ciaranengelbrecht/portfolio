import React from 'react';

interface UnifiedTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string | number;
  labelFormatter?: (label:any)=>string;
  // data meta can be passed via chart's content prop using closure
  context?: {
    seriesMinMax?: Record<string,{min:number;max:number}>;
    previousPointLookup?: (series:string,label:any)=>number|undefined;
    percentChangeBaseKey?: string; // field used to compute WoW %
  }
}

// Heuristic formatting for numbers
function fmt(v:any){ if(v==null || v!==v) return '—'; if(typeof v==='number'){ if(Math.abs(v)>=1000) return Math.round(v).toString(); if(Math.abs(v)>=100) return v.toFixed(1); if(Math.abs(v)>=10) return v.toFixed(2); return v.toFixed(2); } return v; }

const UnifiedTooltip: React.FC<UnifiedTooltipProps> = ({ active, payload, label, labelFormatter, context }) => {
  if(!active || !payload || !payload.length) return null;
  const lines = payload.filter(p=> p && p.value!=null);
  if(!lines.length) return null;
  const isWeek = /^\d{4}-?W?/.test(String(label)) || /week/i.test(String(label));
  return (
    <div className="text-[10px] bg-slate-900/90 backdrop-blur rounded-lg border border-white/10 px-2 py-1.5 space-y-1 shadow-lg max-w-[220px]">
      <div className="font-semibold text-[10px] text-white/80">{labelFormatter? labelFormatter(label): label}</div>
      <div className="space-y-0.5">
    {lines.map((l,i)=>{ const name=l.name || l.dataKey; const v=l.value; const mm=context?.seriesMinMax?.[name]; const isMin= mm && v===mm.min; const isMax= mm && v===mm.max; let delta: string | null = null; let pct: string | null = null; if(context?.previousPointLookup){ const prev = context.previousPointLookup(name,label); if(prev!=null){ const d = v - prev; if(Math.abs(d) > 0){ const sign = d>0? '+':''; delta = sign + fmt(d); if(prev!==0){ const pchg = (d/prev)*100; pct = (pchg>0? '+':'') + (Math.abs(pchg)>=10? pchg.toFixed(1): pchg.toFixed(2)) + '%'; } } } }
          return <div key={i} className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background:l.color || l.stroke || l.fill || '#888' }} />
            <span className="truncate max-w-[90px]">{name}</span>
            <span className="ml-auto font-medium">{fmt(v)}</span>
      {delta && <span className={`ml-1 ${delta.startsWith('+')?'text-emerald-400':'text-red-400'}`}>{delta}</span>}
      {pct && <span className={`ml-1 ${pct.startsWith('+')?'text-emerald-300':'text-red-300'}`}>{pct}</span>}
            {(isMin || isMax) && <span className={`ml-1 ${isMax?'text-amber-400':'text-sky-400'}`}>{isMax? '▲':'▼'}</span>}
          </div>
        })}
      </div>
    </div>
  );
};

export default UnifiedTooltip;
