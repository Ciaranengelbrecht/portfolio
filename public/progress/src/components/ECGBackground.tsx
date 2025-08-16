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
        if(!canvas) return 0; // fallback
        const h = canvas.height / (window.devicePixelRatio||1);
        const mid = h * 0.5;
        const spikeW = 0.08; // width of activity zone
        const center = 0.5;
        const dist = Math.abs(normX - center);
        if(shape==='minimal') return mid; // flat
        if(shape==='smooth') {
          // single smooth bell / dip pattern
            const bell = Math.exp(-((dist*8)**2));
            return mid - bell * h*0.18 + Math.sin(normX*12*Math.PI)*2; // subtle ripple
        }
        if(shape==='spikes') {
          // multiple smaller spikes around center
          const spikes = Math.max(0, 1 - (dist/0.25));
          const micro = Math.sin(normX*60*Math.PI)*0.5 + Math.sin(normX*14*Math.PI);
          return mid - spikes* h*0.15 + micro;
        }
        // classic: flat until near spike window
        if(dist > spikeW) return mid;
        // Sharp spike: construct a linear spike shape: rise -> peak -> plunge -> recover
        const local = (normX - (center-spikeW)) / (spikeW*2); // 0..1 across window
        if(local < 0.25) { // rising edge
          return mid - (local/0.25) * h*0.28; // linear rise
        } else if(local < 0.30) { // immediate peak plateau (very short)
          return mid - h*0.28;
        } else if(local < 0.45) { // drop sharply past baseline into dip
          const t = (local-0.30)/(0.15);
          return mid + t * h*0.20 - (1-t)*h*0.05; // drive downward
        } else if(local < 0.60) { // recover upward toward baseline
          const t = (local-0.45)/0.15; // 0..1
          return mid + (1-t) * h*0.15; // ascend
        } else { // settle flat remainder
          return mid;
        }
      }

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
        // compute fade alpha for this frame based on half-life decay
        const removalAlpha = 1 - Math.pow(0.5, dt / halfLife); // portion to erase this frame
        if(phase==='draw') {
          if(!ctx) return;
          // fade previous trail using destination-out to erase alpha gradually
          ctx.save();
          ctx.globalCompositeOperation = 'destination-out';
          ctx.fillStyle = `rgba(0,0,0,${removalAlpha})`;
          ctx.fillRect(0,0,w,h);
          ctx.restore();
          const progress = Math.min(1, elapsed / effectiveSpeed);
          const x = progress * w;
          const y = fx(progress);
          ctx.lineCap='round';
          ctx.lineJoin='round';
          ctx.strokeStyle = lineColor;
          ctx.shadowColor = lineColor;
            ctx.shadowBlur = base.glow;
            ctx.lineWidth = base.lineWidth;
          ctx.beginPath();
          if(lastX===0 && lastY===0) { lastX = x; lastY = y; }
          ctx.moveTo(lastX,lastY);
          ctx.lineTo(x,y);
          ctx.stroke();
          // pulse bubble
          ctx.beginPath();
          ctx.fillStyle = lineColor;
          ctx.arc(x,y, base.lineWidth*2.2, 0, Math.PI*2);
          ctx.fill();
          lastX = x; lastY = y;
          if(progress>=1){
            phase='pause';
            start = ts; // reset timer for pause
          }
        } else if(phase==='pause') {
          if(!ctx) return;
          ctx.save();
          ctx.globalCompositeOperation='destination-out';
          ctx.fillStyle = `rgba(0,0,0,${removalAlpha})`;
          ctx.fillRect(0,0,w,h);
          ctx.restore();
          if(elapsed > pauseMs){
            // reset for new loop
            phase='draw';
            start = ts;
            lastX=0; lastY=0;
          }
        }
        if(!stop) requestAnimationFrame(step);
      }
      if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        requestAnimationFrame(step);
      }

      return ()=> { stop=true; window.removeEventListener('resize', resize); };
    })();

    function easeOutCubic(t:number){ return 1-Math.pow(1-t,3); }
    function easeInOutQuad(t:number){ return t<0.5? 2*t*t : 1 - Math.pow(-2*t+2,2)/2; }
    function hexToRGBA(hex:string, alpha:number){
      if(hex.startsWith('rgba')) return hex;
      const h = hex.replace('#','');
      const bigint = parseInt(h.length===3? h.split('').map(c=>c+c).join(''): h,16);
      const r=(bigint>>16)&255, g=(bigint>>8)&255, b=bigint&255;
      return `rgba(${r},${g},${b},${alpha})`;
    }
  },[]);

  if(document.body.dataset.ecg==='off') return null;

  return (
    <div ref={wrapRef} aria-hidden className="ecg-root pointer-events-none">
      <canvas ref={canvasRef} className="ecg-canvas" />
    </div>
  );
}
