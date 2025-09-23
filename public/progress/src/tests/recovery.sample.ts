// Simple manual harness to log recovery output (run in dev console by importing)
import { getRecovery } from '../lib/recovery';

(async ()=> {
  const rec = await getRecovery(true);
  console.table(rec.muscles.map(m=> ({ muscle: m.muscle, pct: m.percent.toFixed(1), status: m.status, eta: m.etaFull? new Date(m.etaFull).toLocaleTimeString(): 'now' })));
})();
