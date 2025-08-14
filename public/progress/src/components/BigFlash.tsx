import React from "react";

export default function BigFlash({
  open,
  message,
  kind = "success",
  onClose,
}: {
  open: boolean;
  message: string;
  kind?: "success" | "info" | "error";
  onClose: () => void;
}) {
  if (!open) return null;
  const colors =
    kind === "success"
      ? "from-emerald-500/20 to-emerald-400/10 border-emerald-400/30"
      : kind === "error"
      ? "from-red-500/20 to-red-400/10 border-red-400/30"
      : "from-blue-500/20 to-blue-400/10 border-blue-400/30";
  const icon = kind === "success" ? "✅" : kind === "error" ? "⚠️" : "ℹ️";
  return (
    <div className="fixed inset-0 z-[60] pointer-events-none flex items-start justify-center">
      <div
        className={`mt-20 px-6 py-4 rounded-2xl backdrop-blur-lg bg-gradient-to-b ${colors} text-white shadow-2xl border pointer-events-auto flex items-center gap-3 ring-1 ring-white/10`}
        style={{ maxWidth: 520 }}
        role="status"
      >
        <div className={`text-2xl`} aria-hidden>
          {icon}
        </div>
        <div className="text-lg font-semibold tracking-wide">{message}</div>
      </div>
    </div>
  );
}
