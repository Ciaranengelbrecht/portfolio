import { motion } from 'framer-motion'
import { clsx } from 'clsx'

export default function GlossyButton({ children, className, ...props }: any){
  return (
    <motion.button whileTap={{ scale: 0.98 }} whileHover={{ y: -1 }} {...props}
      className={clsx('rounded-xl px-3 py-2 bg-gradient-to-b from-white/10 to-white/5 dark:from-white/5 dark:to-white/0 shadow-soft border border-white/10', className)}>
      {children}
    </motion.button>
  )
}
