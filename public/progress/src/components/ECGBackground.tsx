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
      const cfg = intensityCfg[intensity];
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
      const accent = cs.getPropertyValue('--accent').trim() || '#22c55e';
      const bg = cs.getPropertyValue('--bg').trim() || '#0b0f14';
      // Precompute color strings
      const lineColor = accent;
      const fadeFill = hexToRGBA(bg, cfg.fade);

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
        // Map to spike profile: rise, peak, drop below, recover
        const t = 1 - dist / spikeW; // 0..1
        // piecewise: first half up to peak, then dip then recover
        if(normX < center) {
          return mid - easeOutCubic(t) * h*0.26;
        } else {
          // after center: overshoot dip then recover
          const dipT = t;
          return mid + easeInOutQuad(dipT) * h*0.18 - dipT * h*0.26; // combine peak decay + dip
        }
      }

      function step(ts: number){
        if(stop) return;
        if(start==null) start = ts;
        if(!canvas || !ctx){ return; }
        const elapsed = ts - start;
        const w = canvas.width / (window.devicePixelRatio||1);
        const h = canvas.height / (window.devicePixelRatio||1);
        if(phase==='draw') {
          // fade previous trail lightly
          if(!ctx) return;
          ctx.fillStyle = fadeFill;
          ctx.fillRect(0,0,w,h);
          const progress = Math.min(1, elapsed / cfg.speed);
          const x = progress * w;
          const y = fx(progress);
          ctx.lineCap='round';
          ctx.lineJoin='round';
          ctx.strokeStyle = lineColor;
          ctx.shadowColor = lineColor;
            ctx.shadowBlur = cfg.glow;
          ctx.lineWidth = cfg.lineWidth;
          ctx.beginPath();
          if(lastX===0 && lastY===0) { lastX = x; lastY = y; }
          ctx.moveTo(lastX,lastY);
          ctx.lineTo(x,y);
          ctx.stroke();
          // pulse bubble
          ctx.beginPath();
          ctx.fillStyle = lineColor;
          ctx.arc(x,y, cfg.lineWidth*2.2, 0, Math.PI*2);
          ctx.fill();
          lastX = x; lastY = y;
          if(progress>=1){
            phase='pause';
            start = ts; // reset timer for pause
          }
        } else if(phase==='pause') {
          // continue fading out rest
          if(!ctx) return;
          ctx.fillStyle = fadeFill;
          ctx.fillRect(0,0,w,h);
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
