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
  const ref = useRef<HTMLDivElement|null>(null);
  const [shape,setShape]=useState<'classic'|'smooth'|'spikes'|'minimal'>('classic');

  useEffect(()=>{
    (async()=>{
      const s= await getSettings();
      const ecg = s.ecg || { enabled:false };
      if(!ecg.enabled){ return; }
      const root = document.documentElement;
      // Intensity mapping: opacity, speed, strokeWidth, dash pattern
      const intensity = ecg.intensity || 'low';
      const map: Record<string,{opacity:string; speed:string; strokeWidth:string; dash:string}> = {
        low:{ opacity:'0.15', speed:'46s', strokeWidth:'1.6', dash:'5 7' },
        med:{ opacity:'0.25', speed:'34s', strokeWidth:'2', dash:'5 5' },
        high:{ opacity:'0.35', speed:'26s', strokeWidth:'2.4', dash:'4 4' },
      };
      const cfg = map[intensity];
      root.style.setProperty('--ecg-opacity', cfg.opacity);
      root.style.setProperty('--ecg-speed', cfg.speed);
      root.style.setProperty('--ecg-stroke-w', cfg.strokeWidth);
      root.style.setProperty('--ecg-dash', cfg.dash);
      setShape(ecg.shape || 'classic');
    })();
  },[]);

  if(document.body.dataset.ecg==='off') return null;

  const polyPoints: Record<string,string> = {
    classic: "0,100 60,100 80,60 95,140 110,100 250,100 270,40 285,160 300,100 450,100 470,70 490,130 510,100 700,100 715,45 730,155 745,100 900,100 915,70 930,130 945,100 1100,100 1115,60 1130,140 1150,100 1200,100",
    smooth:  "0,110 80,90 140,105 200,95 260,100 320,92 380,108 440,96 500,100 560,90 620,110 680,95 740,105 800,100 860,92 920,108 980,96 1040,100 1100,90 1160,110 1200,100",
    spikes:  "0,100 40,100 55,40 70,160 85,100 170,100 185,50 200,150 215,100 300,100 320,60 335,140 350,100 500,100 520,45 535,155 550,100 700,100 715,60 730,140 745,100 900,100 915,40 930,160 945,100 1100,100 1115,55 1130,145 1145,100 1200,100",
    minimal: "0,100 200,100 400,100 600,100 800,100 1000,100 1200,100"
  };

  const renderSegment = (i:number)=> (
    <svg key={i} className="ecg-seg" viewBox="0 0 1200 200" preserveAspectRatio="none">
      <polyline className="ecg-line" fill="none" strokeWidth="var(--ecg-stroke-w,2)" strokeLinecap="round" strokeLinejoin="round"
        points={polyPoints[shape]} />
    </svg>
  );

  return (
    <div ref={ref} aria-hidden className="ecg-root pointer-events-none">
      <div className="ecg-track">
        {renderSegment(0)}
        {renderSegment(1)}
      </div>
    </div>
  );
}
