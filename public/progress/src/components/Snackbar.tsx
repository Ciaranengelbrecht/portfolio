import { useEffect } from 'react'

export default function Snackbar({ open, message, actionLabel, onAction, onClose, duration=4000 }:{
  open: boolean
  message: string
  actionLabel?: string
  onAction?: () => void
  onClose?: () => void
  duration?: number
}){
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => onClose && onClose(), duration)
    return () => clearTimeout(t)
  }, [open, duration])
  if (!open) return null
  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-6 z-50">
      <div className="bg-slate-900/90 border border-white/10 rounded-xl px-4 py-2 shadow-soft flex items-center gap-3">
        <div className="text-sm">{message}</div>
        {actionLabel && (
          <button className="text-xs underline" onClick={onAction}>{actionLabel}</button>
        )}
      </div>
    </div>
  )
}
