import { useState } from "react";
import { resendSignupConfirmation, signIn, signUp } from "../../lib/auth";

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
  const [pendingSignupEmail, setPendingSignupEmail] = useState<string | null>(
    null
  );
  const [resending, setResending] = useState(false);

  const emailValid = /.+@.+/.test(email);
  const pwStrength =
    password.length >= 12 ? "strong" : password.length >= 8 ? "ok" : "weak";
  const confirmMismatch = mode === "signup" && password2.length > 0 && password !== password2;
  const isSignup = mode === "signup";
  const canSubmit =
    emailValid &&
    password.length >= 6 &&
    !busy &&
    (mode === "login" || password === password2);

  const act = async () => {
    setError(null);
    setInfo(null);
    setPendingSignupEmail(null);
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await signIn(email.trim().toLowerCase(), password);
        if (error) setError(error.message);
        else onSignedIn();
      } else {
        if (password !== password2) {
          setError("Passwords do not match");
          return;
        }
        const redirectTo = window.location.origin + window.location.pathname;
        const normalizedEmail = email.trim().toLowerCase();
        const { data, error } = await signUp(
          normalizedEmail,
          password,
          redirectTo
        );
        if (error) setError(error.message);
        else if (!data.session) {
          setPendingSignupEmail(normalizedEmail);
          setInfo(
            "Account created. Check your inbox and spam folder to confirm your email."
          );
        }
        else onSignedIn();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-card glass-card fade-in-pop rounded-3xl p-6 w-full max-w-md mx-auto text-sm relative">
      <div className="auth-card-head">
        <p className="auth-card-eyebrow">
          {isSignup ? "Start your progress journey" : "Training dashboard access"}
        </p>
        <h2 className="auth-card-title">
          {isSignup ? "Create your LiftLog account" : "Welcome back"}
        </h2>
        <p className="auth-card-description">
          {isSignup
            ? "Save sessions, monitor strength trends, and keep momentum week over week."
            : "Pick up where you left off and keep your performance data in sync."}
        </p>
      </div>

      <div className="auth-mode-switch" role="tablist" aria-label="Authentication mode">
        {(["login", "signup"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            className={`auth-mode-tab ${mode === m ? "is-active" : ""}`}
            onClick={() => {
              setMode(m);
              setError(null);
              setInfo(null);
              if (m === "login") setPendingSignupEmail(null);
            }}
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
        className="auth-form-grid"
      >
        <label className="auth-field block space-y-1">
          <span className="auth-field-label">Email</span>
          <input
            autoComplete="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`auth-input input-app w-full rounded-xl px-3 py-3 bg-white/5 border focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${
              email.length === 0
                ? "border-white/10"
                : emailValid
                ? "border-emerald-500/40"
                : "border-rose-500/45"
            }`}
          />
          {email.length > 0 && !emailValid && (
            <span className="auth-input-note text-[10px] text-rose-300">Enter a valid email address.</span>
          )}
        </label>
        <label className="auth-field block space-y-1">
          <span className="auth-field-label">Password</span>
          <input
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`auth-input input-app w-full rounded-xl px-3 py-3 bg-white/5 border focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${
              mode === "signup" && password.length > 0 && password.length < 8
                ? "border-amber-500/45"
                : "border-white/10"
            }`}
          />
          {mode === "signup" && (
            <div className="auth-input-note text-[10px] mt-1 flex items-center gap-2">
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
          <label className="auth-field block space-y-1">
            <span className="auth-field-label">Confirm Password</span>
            <input
              type="password"
              required
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              className={`auth-input input-app w-full rounded-xl px-3 py-3 bg-white/5 border focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${
                confirmMismatch ? "border-rose-500/45" : "border-white/10"
              }`}
            />
            {confirmMismatch && (
              <span className="auth-input-note text-[10px] text-rose-300">Passwords do not match yet.</span>
            )}
          </label>
        )}
        {error && <div className="auth-message auth-message-error text-xs">{error}</div>}
        {info && <div className="auth-message auth-message-info text-xs">{info}</div>}
        {mode === "signup" && pendingSignupEmail && (
          <div className="auth-resend-panel flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <div className="text-[10px] text-gray-300">
              Not seeing it? Check Junk/Spam or resend confirmation.
            </div>
            <button
              type="button"
              disabled={resending || busy}
              className="auth-resend-btn text-[11px] font-medium text-emerald-300 underline decoration-dotted disabled:opacity-50"
              onClick={async () => {
                setError(null);
                setResending(true);
                const redirectTo =
                  window.location.origin + window.location.pathname;
                const { error } = await resendSignupConfirmation(
                  pendingSignupEmail,
                  redirectTo
                );
                if (error) {
                  setError("Could not resend confirmation: " + error.message);
                } else {
                  setInfo(
                    "Confirmation email resent. Check inbox, promotions, and spam."
                  );
                }
                setResending(false);
              }}
            >
              {resending ? "Resending..." : "Resend email"}
            </button>
          </div>
        )}
        <div className="auth-actions pt-2">
          <button
            type="submit"
            disabled={!canSubmit}
            className="auth-submit btn-primary min-h-[48px] rounded-xl px-4 py-3 text-sm font-medium disabled:opacity-40"
          >
            {busy ? "Please wait..." : mode === "login" ? "Sign in to LiftLog" : "Create my account"}
          </button>
          {mode === "login" && (
            <button
              type="button"
              onClick={onForgot}
              className="auth-forgot text-xs text-gray-400 hover:text-gray-200 underline decoration-dotted"
            >
              Forgot password?
            </button>
          )}
        </div>

        <div className="auth-pill-row" aria-hidden="true">
          <span>Offline-first logging</span>
          <span>Progress analytics</span>
          <span>Cloud sync ready</span>
        </div>
      </form>
    </div>
  );
}
