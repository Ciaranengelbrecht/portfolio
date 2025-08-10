export default function BackgroundFX(){
  // If theme provides a bg-layer, BackgroundFX can be minimal; otherwise fallback blobs
  if (getComputedStyle(document.documentElement).getPropertyValue('--bg-layer').trim() && document.body.getAttribute('data-bg-layer') === 'on') return null
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
   <div className="absolute -top-40 -left-40 w-[60vw] h-[60vw] rounded-full blur-3xl opacity-20"
     style={{ background: 'radial-gradient(closest-side, var(--chart-1), transparent 70%)' }} />
   <div className="absolute -bottom-40 -right-40 w-[50vw] h-[50vw] rounded-full blur-3xl opacity-20"
     style={{ background: 'radial-gradient(closest-side, var(--accent), transparent 70%)' }} />
   <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[40vw] h-[40vw] rounded-full blur-[100px] opacity-10"
     style={{ background: 'radial-gradient(closest-side, var(--success), transparent 70%)' }} />
    </div>
  )
}
