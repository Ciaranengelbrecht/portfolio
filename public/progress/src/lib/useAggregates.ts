import { useEffect, useState } from 'react';
import { computeAggregates, getCachedAggregates, AggregatesBundle } from './aggregates';

/**
 * useAggregates: React hook to access precomputed aggregate metrics.
 * Returns { data, loading, refresh } with stale-while-revalidate behavior.
 */
export function useAggregates() {
  const [data,setData] = useState<AggregatesBundle | null>(()=> getCachedAggregates());
  const [loading,setLoading] = useState(!data);
  const refresh = async(force?: boolean) => {
    try { setLoading(true); const res = await computeAggregates(force); setData(res); } finally { setLoading(false); }
  };
  useEffect(()=> { let mounted = true; if(!data){ computeAggregates().then(r=> { if(mounted) setData(r); }).finally(()=> mounted && setLoading(false)); } else { // background refresh
    computeAggregates().then(r=> { if(mounted) setData(r); }); setLoading(false); }
    const onUpd = () => { const cached = getCachedAggregates(); if(cached) setData(cached); };
    window.addEventListener('aggregates-updated', onUpd as any);
    return ()=> { mounted=false; window.removeEventListener('aggregates-updated', onUpd as any); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { data, loading, refresh };
}

export type UseAggregatesReturn = ReturnType<typeof useAggregates>;
