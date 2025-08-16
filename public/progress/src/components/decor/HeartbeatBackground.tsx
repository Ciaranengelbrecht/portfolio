import { useEffect, useRef } from 'react';

/** HeartbeatBackground renders a subtle animated ECG line behind app content. */
export default function HeartbeatBackground({ enabled = true }: { enabled?: boolean }) {
  const ref = useRef<HTMLDivElement|null>(null);
  useEffect(()=>{
    if(!enabled) return;
    const vis = ()=>{ if(document.hidden && ref.current){ ref.current.style.animationPlayState='paused'; } else if(ref.current){ ref.current.style.animationPlayState='running'; } };
    document.addEventListener('visibilitychange', vis);
    return ()=> document.removeEventListener('visibilitychange', vis);
  }, [enabled]);
  if(!enabled) return null;
  // Path: repeating baseline + mild spike pattern
  const path = 'M0 60 Q20 55 40 60 T80 60 T120 60 Q140 58 160 60 L170 58 180 72 190 54 200 60 Q220 55 240 60 T280 60 T320 60 Q340 58 360 60 L370 58 380 72 390 54 400 60 Q420 55 440 60 T480 60 T520 60 Q540 58 560 60 L570 58 580 72 590 54 600 60';
  return (
    <div className="ecg-layer" aria-hidden="true">
      <div ref={ref} className="ecg-scroll h-full flex">
        <svg className="ecg-svg" viewBox="0 0 600 120" preserveAspectRatio="none">
          <path className="ecg-glow" d={path} />
          <path className="ecg-line ecg-animate" d={path} />
        </svg>
        <svg className="ecg-svg" viewBox="0 0 600 120" preserveAspectRatio="none">
          <path className="ecg-glow" d={path} />
          <path className="ecg-line ecg-animate" d={path} />
        </svg>
        <svg className="ecg-svg" viewBox="0 0 600 120" preserveAspectRatio="none">
          <path className="ecg-glow" d={path} />
          <path className="ecg-line ecg-animate" d={path} />
        </svg>
      </div>
    </div>
  );
}
