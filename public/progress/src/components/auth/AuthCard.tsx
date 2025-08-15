import { useState } from "react";
import { signIn, signUp } from "../../lib/auth";
import { sendPasswordReset } from "../../lib/auth";

interface Props {
  onSignedIn: () => void;
  onForgot: () => void;
}

export default function AuthCard({ onSignedIn, onForgot }: Props) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const emailValid = /.+@.+/.test(email);
  const pwStrength =
    password.length >= 12 ? "strong" : password.length >= 8 ? "ok" : "weak";
  const canSubmit =
    emailValid &&
    password.length >= 6 &&
    !busy &&
    (mode === "login" || password === password2);

  const act = async () => {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await signIn(email, password);
        if (error) setError(error.message);
        else onSignedIn();
      } else {
        if (password !== password2) {
          setError("Passwords do not match");
          return;
        }
        const redirectTo = window.location.origin + window.location.pathname;
        const { data, error } = await signUp(email, password, redirectTo);
        if (error) setError(error.message);
        else if (!data.session)
          setInfo("Check your email to confirm your account");
        else onSignedIn();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass-card fade-in-pop rounded-2xl p-6 w-full max-w-md mx-auto text-sm relative">
      <div
        className="flex items-center gap-2 mb-6"
        role="tablist"
        aria-label="Authentication mode"
      >
        {(["login", "signup"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors ${
              mode === m
                ? "bg-white/10 text-white"
                : "text-gray-400 hover:text-white"
            }`}
            onClick={() => setMode(m)}
            disabled={busy}
          >
            {m === "login" ? "Login" : "Sign Up"}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) act();
        }}
        className="space-y-4"
      >
        <label className="block space-y-1">
          <span className="text-xs uppercase tracking-wide text-gray-400">
            Email
          </span>
          <input
            autoComplete="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-app w-full rounded-xl px-3 py-3 bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs uppercase tracking-wide text-gray-400">
            Password
          </span>
          <input
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-app w-full rounded-xl px-3 py-3 bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
          {mode === "signup" && (
            <div className="text-[10px] mt-1 flex items-center gap-2">
              <span
                className={`font-medium ${
                  pwStrength === "weak"
                    ? "text-red-400"
                    : pwStrength === "ok"
                    ? "text-amber-300"
                    : "text-emerald-400"
                }`}
              >
                {pwStrength}
              </span>
              <span className="text-gray-400">
                Use at least 12 chars for strong
              </span>
            </div>
          )}
        </label>
        {mode === "signup" && (
          <label className="block space-y-1">
            <span className="text-xs uppercase tracking-wide text-gray-400">
              Confirm Password
            </span>
            <input
              type="password"
              required
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              className="input-app w-full rounded-xl px-3 py-3 bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </label>
        )}
        {error && <div className="text-xs text-red-400">{error}</div>}
        {info && <div className="text-xs text-emerald-400">{info}</div>}
        <div className="flex items-center justify-between pt-2">
          <button
            type="submit"
            disabled={!canSubmit}
            className="btn-primary rounded-xl px-4 py-3 text-sm font-medium transition-transform disabled:opacity-40 hover:translate-y-[-2px] active:translate-y-[0]"
          >
            {busy ? "..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>
          {mode === "login" && (
            <button
              type="button"
              onClick={onForgot}
              className="text-xs text-gray-400 hover:text-gray-200 underline decoration-dotted"
            >
              Forgot password?
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
