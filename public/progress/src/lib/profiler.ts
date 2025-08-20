// Lightweight profiling helpers (dev only)
// Usage: const stop = prof('sessionsLoad'); ... await thing ...; stop();
export function prof(label: string){
  const t0 = performance.now();
  return () => {
    const dt = performance.now() - t0;
    if(process.env.NODE_ENV !== 'production'){
      // eslint-disable-next-line no-console
      console.log(`[prof] ${label} ${dt.toFixed(1)}ms`);
    }
    return dt;
  };
}

export async function profAsync<T>(label: string, fn: ()=> Promise<T>): Promise<T>{
  const stop = prof(label);
  try { return await fn(); } finally { stop(); }
}
