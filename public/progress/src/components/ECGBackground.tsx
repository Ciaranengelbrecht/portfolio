import { useEffect, useRef, useState } from 'react';
import { getSettings } from '../lib/helpers';

/**
 * ECGBackground renders a subtle animated ECG line scrolling horizontally.
 * Implementation details:
 * - Fixed full-viewport container with -z index inside an isolation root to avoid stacking conflicts.
 * - Two duplicated SVG wave segments inside a flex row translateX to create seamless loop.
 * - CSS variables control opacity, speed, and color; respects reduced motion.
 */
export default function ECGBackground(){
  const wrapRef = useRef<HTMLDivElement|null>(null);
  const canvasRef = useRef<HTMLCanvasElement|null>(null);
  const [shape,setShape]=useState<'classic'|'smooth'|'spikes'|'minimal'>('classic');

  useEffect(()=>{
    let stop=false;
    (async()=>{
      const s = await getSettings();
      if(!s.ecg?.enabled) return; // disabled
      setShape(s.ecg.shape || 'classic');
  const intensity = s.ecg.intensity || 'low';
      const intensityCfg = {
        low:  { speed: 60_000, lineWidth: 1.4, fade: 0.055, glow: 4 }, // duration ms for full sweep
        med:  { speed: 42_000, lineWidth: 1.8, fade: 0.045, glow: 6 },
        high: { speed: 30_000, lineWidth: 2.2, fade: 0.035, glow: 8 }
      } as const;
      const base = intensityCfg[intensity];
      let effectiveSpeed = s.ecg.speedMs || base.speed;
      // Interpret stored speedMs as control value (higher => faster). If within expected control range, remap.
      const CTRL_MIN = 8000, CTRL_MAX = 90000;
      if(s.ecg.speedMs && s.ecg.speedMs >= CTRL_MIN && s.ecg.speedMs <= CTRL_MAX){
        const control = s.ecg.speedMs;
        const factor = (control - CTRL_MIN) / (CTRL_MAX - CTRL_MIN); // 0..1
        const fastest = base.speed * 0.3; // 30% of base
        const slowest = base.speed * 2;   // 200% of base
        effectiveSpeed = slowest - factor * (slowest - fastest); // invert so higher control => faster (shorter duration)
      }
      const canvas = canvasRef.current;
      if(!canvas) return;
      const ctx = canvas.getContext('2d');
      if(!ctx) return;

      const resize = ()=>{
        if(!canvas || !ctx) return; const dpr = window.devicePixelRatio||1;
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        canvas.style.width = window.innerWidth+'px';
        canvas.style.height = window.innerHeight+'px';
        ctx.setTransform(1,0,0,1,0,0);
        ctx.scale(dpr,dpr);
      };
      resize();
      window.addEventListener('resize', resize);

  const cs = getComputedStyle(document.documentElement);
  const accent = (s.ecg?.color || cs.getPropertyValue('--ecg-custom-color').trim() || cs.getPropertyValue('--accent').trim() || '#22c55e');
  // Instead of drawing semi-transparent bg (which tints), we manually fade previous pixels by drawing a translucent rectangle using composite 'destination-out'
      const halfLife = ( ()=>{
        // derive half-life from base.fade heuristic (smaller fade -> longer half-life)
        // Map base.fade (approx 0.035-0.055) to ms range 1400-2600
        const norm = (base.fade - 0.035) / (0.055 - 0.035); // 0..1
        return 1400 + (1-norm) * 1200;
      })();
      let lastFrameTs: number | null = null;
  const lineColor = accent;

      let start: number | null = null;
      const pauseMs = 900; // pause before restarting
      let phase: 'draw' | 'pause' = 'draw';
      let lastX = 0, lastY = 0;

      function fx(normX: number): number {
        // Flat baseline with single sharp spike at center; no dips or curvature.
        if(!canvas) return 0;
        const h = canvas.height / (window.devicePixelRatio||1);
        const mid = h * 0.5;
        const spikeTotal = 0.10; // width of total spike window (10% of width)
        const center = 0.5;
        const left = center - spikeTotal/2;
        const right = center + spikeTotal/2;
        if(normX < left || normX > right) return mid; // baseline outside spike window
        const local = (normX - left) / spikeTotal; // 0..1 across spike window
        // Define quick linear rise (0..0.25), brief plateau (0.25..0.35), linear fall (0.35..0.55), then baseline.
        if(local < 0.25) {
          return mid - (local/0.25) * h * 0.28; // rise
        } else if(local < 0.35) {
          return mid - h * 0.28; // plateau
        } else if(local < 0.55) {
          const t = (local - 0.35) / 0.20; // 0..1
          return mid - (1 - t) * h * 0.28; // descend back to baseline
        }
        return mid; // rest of window baseline
      }

  // Point history for trail fade (2s lifespan)
  const points: {x:number; y:number; t:number}[] = [];
  const trailDuration = 2000; // ms for full disappearance

  function step(ts: number){
        if(stop) return;
        if(start==null) start = ts;
        if(!canvas || !ctx){ return; }
        const elapsed = ts - start;
        // dynamic speed update if CSS variable changed (user moved slider)
        try {
          const cssVal = getComputedStyle(document.documentElement).getPropertyValue('--ecg-custom-speed-ms').trim();
          if(cssVal){
            const v = parseInt(cssVal,10);
            if(!isNaN(v)){
              const factor = Math.min(1, Math.max(0, (v-CTRL_MIN)/(CTRL_MAX-CTRL_MIN)));
              const fastest = base.speed * 0.3;
              const slowest = base.speed * 2;
              effectiveSpeed = slowest - factor * (slowest - fastest);
            }
          }
        } catch {}
        const w = canvas.width / (window.devicePixelRatio||1);
        const h = canvas.height / (window.devicePixelRatio||1);
        const dt = lastFrameTs==null ? 16 : (ts - lastFrameTs);
        lastFrameTs = ts;
        if(phase==='draw') {
          const progress = Math.min(1, elapsed / effectiveSpeed);
          const x = progress * w;
          const y = fx(progress);
          points.push({x,y,t:ts});
          // clear fully
          ctx.clearRect(0,0,w,h);
          // prune old
          while(points.length && ts - points[0].t > trailDuration) points.shift();
          // draw trail segments with fading alpha
          ctx.lineCap='butt';
          ctx.lineJoin='miter';
          ctx.shadowColor = lineColor;
          ctx.shadowBlur = base.glow;
          for(let i=1;i<points.length;i++){
            const p0 = points[i-1];
            const p1 = points[i];
            const age = ts - p1.t;
            const alpha = Math.max(0, 1 - age / trailDuration);
            if(alpha<=0) continue;
            ctx.strokeStyle = withAlpha(lineColor, alpha);
            ctx.lineWidth = base.lineWidth;
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            // interpolate if large gap to avoid dotted look
            const dx = p1.x - p0.x; const dy = p1.y - p0.y;
            const dist = Math.hypot(dx,dy);
            if(dist > 40){
              const steps = Math.ceil(dist / 30);
              let prevx=p0.x, prevy=p0.y;
              for(let sIdx=1; sIdx<=steps; sIdx++){
                const tfrac = sIdx/steps;
                const ix = p0.x + dx*tfrac; const iy = p0.y + dy*tfrac;
                ctx.moveTo(prevx, prevy);
                ctx.lineTo(ix, iy);
                prevx=ix; prevy=iy;
              }
            } else {
              ctx.lineTo(p1.x, p1.y);
            }
            ctx.stroke();
          }
          // draw leading pulse bubble
          ctx.beginPath();
          ctx.fillStyle = lineColor;
          ctx.shadowColor = lineColor;
          ctx.shadowBlur = base.glow * 1.2;
          ctx.arc(x,y, base.lineWidth*1.4, 0, Math.PI*2);
          ctx.fill();
          if(progress>=1){
            phase='pause';
            start = ts;
          }
        } else if(phase==='pause') {
          // continue fading existing trail
          if(points.length){
            ctx.clearRect(0,0,w,h);
            while(points.length && ts - points[0].t > trailDuration) points.shift();
            for(let i=1;i<points.length;i++){
              const p0 = points[i-1];
              const p1 = points[i];
              const age = ts - p1.t;
              const alpha = Math.max(0, 1 - age / trailDuration);
              if(alpha<=0) continue;
              ctx.strokeStyle = withAlpha(lineColor, alpha);
              ctx.lineWidth = base.lineWidth;
              ctx.beginPath();
              ctx.moveTo(p0.x, p0.y);
              ctx.lineTo(p1.x, p1.y);
              ctx.stroke();
            }
          }
          if(elapsed > pauseMs){
            phase='draw'; start = ts; lastX=0; lastY=0; points.length=0;
          }
        }
        if(!stop) requestAnimationFrame(step);
      }
      if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        requestAnimationFrame(step);
      }

      return ()=> { stop=true; window.removeEventListener('resize', resize); };
    })();

    function withAlpha(hex:string, a:number){
      if(hex.startsWith('rgb')) return hex.replace(/rgba?\(([^)]+)\)/, (_,vals)=>`rgba(${vals.split(',').slice(0,3).join(',')},${a})`);
      const h = hex.replace('#','');
      const full = h.length===3? h.split('').map(c=>c+c).join(''): h;
      const num = parseInt(full,16);
      const r=(num>>16)&255,g=(num>>8)&255,b=num&255;
      return `rgba(${r},${g},${b},${a})`;
    }
  },[]);

  if(document.body.dataset.ecg==='off') return null;

  return (
    <div ref={wrapRef} aria-hidden className="ecg-root pointer-events-none">
      <canvas ref={canvasRef} className="ecg-canvas" />
    </div>
  );
}
