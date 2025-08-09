import { motion } from 'framer-motion'
import { clsx } from 'clsx'

export default function GlassCard({ className, children }: { className?: string; children: React.ReactNode }){
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
      className={clsx('rounded-2xl p-4 shadow-soft bg-white/10 dark:bg-black/20 backdrop-blur-xl border border-white/10 relative overflow-hidden', className)}>
      <div className="pointer-events-none absolute inset-0 rounded-2xl" style={{ border: '1px solid rgba(255,255,255,0.08)', maskImage: 'linear-gradient(#000,transparent 85%)' }} />
      {children}
    </motion.div>
  )
}
