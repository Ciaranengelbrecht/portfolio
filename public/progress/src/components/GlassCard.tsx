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
        "rounded-2xl p-4 card-surface border border-card relative overflow-hidden shadow-[0_18px_34px_-18px_rgba(0,0,0,0.55)]",
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
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-x-[-40%] top-[-55%] h-[160%] opacity-60 bg-[radial-gradient(circle_at_top,var(--accent)_0%,transparent_60%)]"
          style={{ mixBlendMode: "lighten" }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_120%,rgba(148,163,255,0.12),transparent_60%)]" />
      </div>
      {children}
    </motion.div>
  );
}
