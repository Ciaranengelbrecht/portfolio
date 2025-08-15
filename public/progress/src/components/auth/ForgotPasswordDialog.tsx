import { useState } from "react";
import { sendPasswordReset } from "../../lib/auth";

export default function ForgotPasswordDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);
  if (!open) return null;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    try {
      const redirectTo = window.location.origin + window.location.pathname;
      const { error } = await sendPasswordReset(email, redirectTo);
      if (error) {
        setError("Could not send reset");
        setStatus("error");
      } else {
        setStatus("sent");
      }
    } catch {
      setStatus("error");
      setError("Error");
    }
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Password reset"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="glass-card relative z-10 rounded-2xl p-6 w-full max-w-sm fade-in-pop">
        <h2 className="text-base font-semibold mb-2">Reset password</h2>
        <p className="text-xs text-gray-400 mb-4">
          Enter your email. If an account exists, a reset link will be sent.
        </p>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl px-3 py-3 bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
          {error && <div className="text-xs text-red-400">{error}</div>}
          {status === "sent" && (
            <div className="text-xs text-emerald-400">
              If that email exists, a reset has been sent.
            </div>
          )}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="text-xs px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10"
            >
              Close
            </button>
            <button
              disabled={status === "sending" || status === "sent"}
              className="btn-primary rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-40"
            >
              {status === "sending"
                ? "Sending…"
                : status === "sent"
                ? "Sent"
                : "Send reset"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
