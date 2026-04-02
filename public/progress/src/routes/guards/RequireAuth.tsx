import { Navigate, useLocation } from "react-router-dom";
import {
  AppBootstrapError,
  AppBootstrapScreen,
} from "../../components/AppBootstrapScreen";
import { useBootstrap } from "../../state/bootstrap";
import { useProgram } from "../../state/program";

export default function RequireAuth({ children }: { children: JSX.Element }) {
  const loc = useLocation();
  const boot = useBootstrap();
  const program = useProgram();

  if (boot.status === "booting") {
    return <AppBootstrapScreen phase={boot.phase} />;
  }

  if (boot.status === "error") {
    return (
      <AppBootstrapError
        message={boot.error || "Startup failed"}
        onRetry={boot.retry}
      />
    );
  }

  if (!boot.authed)
    return <Navigate to="/auth" replace state={{ redirectTo: loc.pathname }} />;

  if (program.loading) {
    return <AppBootstrapScreen phase="program" />;
  }

  if (program.error) {
    return <AppBootstrapError message={program.error} onRetry={boot.retry} />;
  }

  return children;
}
