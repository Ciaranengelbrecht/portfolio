import { useEffect, useRef, useState } from "react";
import AuthCard from "../../components/auth/AuthCard";
import ForgotPasswordDialog from "../../components/auth/ForgotPasswordDialog";
import "../../styles/auth-hero.css";
import { useNavigate, useLocation } from "react-router-dom";
import { waitForSession } from "../../lib/supabase";

const FEATURES = [
  "Track lifts & deloads automatically",
  "Visualise progress with charts",
  "Templates for Upper / Lower",
  "Body measurements guidance",
  "Theme presets & sync",
];

export default function IntroAuthPage() {
  const nav = useNavigate();
  const loc = useLocation();
  const [forgotOpen, setForgotOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReduced) return;
    c.dataset.parallax = "on";
    const handler = (e: MouseEvent) => {
      const xs = e.clientX / window.innerWidth - 0.5;
      const ys = e.clientY / window.innerHeight - 0.5;
      c.querySelectorAll(".feature-float").forEach((el, idx) => {
        const depth = (idx + 1) / FEATURES.length;
        (el as HTMLElement).style.transform = `translate3d(${
          xs * 16 * depth
        }px, ${ys * 16 * depth}px,0)`;
      });
    };
    window.addEventListener("pointermove", handler);
    return () => window.removeEventListener("pointermove", handler);
  }, []);

  return (
    <div
      ref={containerRef}
      className="auth-hero flex items-center justify-center px-4"
    >
      {FEATURES.map((f, i) => (
        <div
          key={i}
          className="feature-float"
          style={{ top: `${12 + i * 12}%`, left: i % 2 ? "66%" : "14%" }}
        >
          {f}
        </div>
      ))}
      <div className="relative z-10 w-full max-w-md py-24">
        <h1 className="text-center text-3xl font-semibold mb-8 tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
          LiftLog
        </h1>
        <AuthCard
          onSignedIn={() => {
            const next = (loc.state as any)?.redirectTo || "/";
            nav(next);
          }}
          onForgot={() => setForgotOpen(true)}
        />
        <p className="mt-6 text-center text-[11px] text-gray-500">
          By continuing you agree to the implicit terms of using a hobby
          project. Keep local backups.
        </p>
      </div>
      <ForgotPasswordDialog
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
      />
    </div>
  );
}
