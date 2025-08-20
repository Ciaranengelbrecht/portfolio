import { motion } from "framer-motion";
import { clsx } from "clsx";
import { fadeSlideUp, maybeDisable } from "../lib/motion";

export default function GlassCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      variants={maybeDisable(fadeSlideUp)}
      initial="initial"
      animate="animate"
      exit="exit"
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
