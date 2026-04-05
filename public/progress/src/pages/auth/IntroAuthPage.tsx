import { useEffect, useState } from "react";
import AuthCard from "../../components/auth/AuthCard";
import ForgotPasswordDialog from "../../components/auth/ForgotPasswordDialog";
import "../../styles/auth-hero.css";
import { useNavigate, useLocation } from "react-router-dom";
import { waitForSession } from "../../lib/supabase";

const TRAINING_FEATURES = [
  "Track lifts & deloads automatically",
  "Visualise progress with charts",
  "Templates for Upper / Lower",
  "Body measurements guidance",
  "Theme presets & sync",
];

const TRAINING_STATS = [
  { value: "4x", label: "Faster weekly planning" },
  { value: "24/7", label: "Offline workout logging" },
  { value: "100%", label: "Personal progress ownership" },
];

const PROGRESS_PREVIEW = [
  { label: "Consistency", value: 86 },
  { label: "Strength trend", value: 73 },
  { label: "Recovery readiness", value: 64 },
];

export default function IntroAuthPage() {
  const nav = useNavigate();
  const loc = useLocation();
  const [forgotOpen, setForgotOpen] = useState(false);

  useEffect(() => {
    // if already authed, redirect to dashboard or stored redirect
    (async () => {
      const s = await waitForSession({ timeoutMs: 1200 });
      if (s?.user) {
        const next = (loc.state as any)?.redirectTo || "/";
        nav(next);
      }
    })();
  }, []);

  return (
    <div className="auth-hero">
      <div className="auth-shell">
        <section className="auth-story-panel" aria-label="LiftLog highlights">
          <p className="auth-kicker">LiftLog Training System</p>
          <h1 className="auth-title">Train with intent. Progress with proof.</h1>
          <p className="auth-subtitle">
            Built for lifters who want cleaner sessions, better feedback loops,
            and visible progress every week.
          </p>

          <div className="auth-stat-grid" role="list" aria-label="App stats">
            {TRAINING_STATS.map((item) => (
              <article key={item.label} role="listitem" className="auth-stat-tile">
                <div className="auth-stat-value">{item.value}</div>
                <div className="auth-stat-label">{item.label}</div>
              </article>
            ))}
          </div>

          <div className="auth-meter-panel" aria-label="Progress preview">
            {PROGRESS_PREVIEW.map((item) => (
              <div key={item.label} className="auth-meter-row">
                <div className="auth-meter-label-row">
                  <span>{item.label}</span>
                  <span>{item.value}%</span>
                </div>
                <div className="auth-meter-track">
                  <span
                    className="auth-meter-fill"
                    style={{ width: `${item.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <ul className="auth-feature-list">
            {TRAINING_FEATURES.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        </section>

        <section className="auth-form-panel" aria-label="Sign in or create account">
          <div className="auth-form-header">
            <span className="auth-brand-pill">LIFTLOG</span>
            <p className="auth-form-copy">
              Your training data, synced and ready across every workout.
            </p>
          </div>

          <AuthCard
            onSignedIn={() => {
              const next = (loc.state as any)?.redirectTo || "/";
              nav(next);
            }}
            onForgot={() => setForgotOpen(true)}
          />

          <p className="auth-legal-note">
            By continuing, you agree to this app&apos;s terms and privacy
            settings. Keep regular backups of your training data.
          </p>
        </section>
      </div>

      <ForgotPasswordDialog
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
      />
    </div>
  );
}
