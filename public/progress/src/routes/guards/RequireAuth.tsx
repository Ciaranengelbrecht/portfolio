import { Navigate, useLocation } from "react-router-dom";
import { waitForSession } from "../../lib/supabase";
import { useEffect, useState } from "react";
import { SkeletonPage } from "../../components/Skeleton";

export default function RequireAuth({ children }: { children: JSX.Element }) {
  const loc = useLocation();
  const [checked, setChecked] = useState(false);
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    (async () => {
      const s = await waitForSession({ timeoutMs: 1200 });
      setAuthed(!!s?.user);
      setChecked(true);
    })();
  }, []);
  if (!checked)
    return <SkeletonPage cards={2} />;
  if (!authed)
    return <Navigate to="/auth" replace state={{ redirectTo: loc.pathname }} />;
  return children;
}
