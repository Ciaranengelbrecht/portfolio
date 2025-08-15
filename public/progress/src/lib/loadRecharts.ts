// Dynamic loader & cache for recharts to enable bundle splitting
let modPromise: Promise<any> | null = null;
export function loadRecharts() {
  if (!modPromise) {
    modPromise = import(/* webpackChunkName: "recharts-chunk" */ 'recharts');
  }
  return modPromise;
}
