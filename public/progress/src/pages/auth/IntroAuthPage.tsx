import { useEffect, useState } from "react";
import AuthCard from "../../components/auth/AuthCard";
import ForgotPasswordDialog from "../../components/auth/ForgotPasswordDialog";
import "../../styles/auth-hero.css";
import { useNavigate, useLocation } from "react-router-dom";
import { waitForSession } from "../../lib/supabase";

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
        <AuthCard
          onSignedIn={() => {
            const next = (loc.state as any)?.redirectTo || "/";
            nav(next);
          }}
          onForgot={() => setForgotOpen(true)}
        />
      </div>

      <ForgotPasswordDialog
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
      />
    </div>
  );
}
