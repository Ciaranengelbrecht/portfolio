import { useEffect, useRef, useState } from "react";
import GlassCard from "./GlassCard";
import GlossyButton from "./GlossyButton";
import { supabase, waitForSession } from "../lib/supabase";

export default function AuthModal({
  open,
  onClose,
  onSignedIn,
}: {
  open: boolean;
  onClose: () => void;
  onSignedIn: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    doneRef.current = false;
    setEmail("");
    setPassword("");
    setPassword2("");
    setOtp("");
    setBusy(null);
    setMsg(null);
  }, [open]);

  // Close modal as soon as a session is detected (faster feedback)
  useEffect(() => {
    if (!open) return;
    let mounted = true;
    const handle = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      onSignedIn();
    };
    // Immediate check in case session already exists (avoid Safari hang)
    waitForSession({ timeoutMs: 1000 }).then((s) => {
      if (!mounted) return;
      if (s) handle();
    });
    const sub = supabase.auth.onAuthStateChange((_evt, session) => {
      if (!mounted) return;
      if (session) handle();
    });
    return () => {
      mounted = false;
      sub.data.subscription.unsubscribe();
    };
  }, [open]);

  if (!open) return null;

  const resetRedirect = () => {
    const base = window.location.origin + window.location.pathname;
    return base.includes("/dist") ? base : base.replace(/\/?$/, "/") + "dist/";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <GlassCard className="relative w-full max-w-md z-10">
        <div className="flex items-center justify-between mb-2">
          <div className="text-lg font-semibold">Sign in</div>
          <button
            className="text-sm text-gray-300 hover:text-white"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        {msg && (
          <div className="mb-3 text-xs text-gray-300 bg-white/10 rounded-lg px-3 py-2 border border-white/10">
            {msg}
          </div>
        )}
        <div className="space-y-2">
          <input
            className="bg-slate-800 rounded-xl px-3 py-2 w-full"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="bg-slate-800 rounded-xl px-3 py-2 w-full"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <GlossyButton
              disabled={busy === "signin"}
              className={`${busy === "signin" ? "opacity-70" : ""}`}
              onClick={async () => {
                if (!email || !password)
                  return setMsg("Enter email and password");
                setBusy("signin");
                const { data, error } = await supabase.auth.signInWithPassword({
                  email,
                  password,
                });
                if (error) setMsg("Sign-in error: " + error.message);
                else {
                  setMsg("Signed in");
                  if (!doneRef.current) {
                    doneRef.current = true;
                    onSignedIn();
                  }
                }
                setBusy(null);
              }}
            >
              Sign in
            </GlossyButton>
            <GlossyButton
              disabled={busy === "signup"}
              className={`${busy === "signup" ? "opacity-70" : ""}`}
              onClick={async () => {
                if (!email || !password)
                  return setMsg("Enter email and password");
                if (password !== password2)
                  return setMsg("Passwords do not match");
                setBusy("signup");
                const redirectTo =
                  window.location.origin + window.location.pathname;
                const { data, error } = await supabase.auth.signUp({
                  email,
                  password,
                  options: { emailRedirectTo: redirectTo },
                });
                if (error) setMsg("Sign-up error: " + error.message);
                else if (!data.session)
                  setMsg("Check your email to confirm your account");
                else {
                  setMsg("Account created");
                  onSignedIn();
                }
                setBusy(null);
              }}
            >
              Create account
            </GlossyButton>
            <GlossyButton
              disabled={busy === "magic"}
              className={`${busy === "magic" ? "opacity-70" : ""}`}
              onClick={async () => {
                if (!email) return setMsg("Enter your email");
                setBusy("magic");
                const redirectTo =
                  window.location.origin + window.location.pathname;
                const { error } = await supabase.auth.signInWithOtp({
                  email,
                  options: { emailRedirectTo: redirectTo },
                });
                if (error) setMsg("Magic link error: " + error.message);
                else setMsg("Magic link sent. Check your email");
                setBusy(null);
              }}
            >
              Send magic link
            </GlossyButton>
          </div>
          <div className="flex items-center gap-2">
            <input
              className="bg-slate-800 rounded-xl px-3 py-2 flex-1"
              placeholder="OTP code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
            />
            <GlossyButton
              disabled={busy === "verify"}
              className={`${busy === "verify" ? "opacity-70" : ""}`}
              onClick={async () => {
                if (!email || !otp) return setMsg("Enter email and OTP");
                setBusy("verify");
                const { data, error } = await supabase.auth.verifyOtp({
                  email,
                  token: otp,
                  type: "email" as any,
                });
                if (error) setMsg("OTP error: " + error.message);
                else {
                  setMsg("Signed in via OTP");
                  if (!doneRef.current) {
                    doneRef.current = true;
                    onSignedIn();
                  }
                }
                setBusy(null);
              }}
            >
              Verify
            </GlossyButton>
          </div>
          <div className="flex items-center gap-2">
            <input
              className="bg-slate-800 rounded-xl px-3 py-2 w-full"
              placeholder="Confirm password (for create)"
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
            />
          </div>
          <div>
            <button
              className="text-xs underline text-gray-300 hover:text-white"
              onClick={async () => {
                if (!email) return setMsg("Enter your email");
                const redirectTo = resetRedirect();
                const { error } = await supabase.auth.resetPasswordForEmail(
                  email,
                  { redirectTo }
                );
                if (error) setMsg("Reset error: " + error.message);
                else setMsg("Password reset email sent");
              }}
            >
              Forgot password?
            </button>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
