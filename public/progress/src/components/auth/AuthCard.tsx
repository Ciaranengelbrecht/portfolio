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
  const confirmMismatch = mode === "signup" && password2.length > 0 && password !== password2;
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
    <div className="auth-card glass-card fade-in-pop rounded-2xl p-4 sm:p-5 w-full max-w-[360px] mx-auto text-sm relative">
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
            {busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
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
      </form>
    </div>
  );
}
