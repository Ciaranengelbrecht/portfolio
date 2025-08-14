import { motion } from "framer-motion";
import { clsx } from "clsx";

export default function GlassCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={clsx(
        "rounded-2xl p-4 card-surface border border-card relative overflow-hidden",
        className
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{
          border: "1px solid var(--card-border)",
          maskImage: "linear-gradient(#000,transparent 85%)",
        }}
      />
      {children}
    </motion.div>
  );
}
