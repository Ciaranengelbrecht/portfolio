const preloaders: Record<string, () => Promise<unknown>> = {
  "/": () => import("../features/dashboard/Dashboard"),
  "/analytics": () => import("../features/analytics/Analytics"),
  "/sessions": () => import("../pages/Sessions"),
  "/recovery": () => import("../pages/Recovery"),
  "/measurements": () => import("../pages/Measurements"),
  "/templates": () => import("../pages/Templates"),
  "/settings": () => import("../pages/Settings"),
  "/settings/program": () => import("../pages/ProgramSettings"),
  "/welcome": () => import("../features/onboarding/FirstRunExperience"),
  "/auth": () => import("../pages/auth/IntroAuthPage"),
};

const preloaded = new Set<string>();
const MOBILE_APP_ROUTES = [
  "/",
  "/analytics",
  "/sessions",
  "/recovery",
  "/measurements",
  "/settings/program",
  "/templates",
  "/settings",
] as const;

function normalizeRoute(path: string): string {
  if (!path) return "/";
  if (path.startsWith("/auth")) return "/auth";
  if (path.startsWith("/welcome")) return "/welcome";
  return path;
}

export function preloadRoute(path: string) {
  const key = normalizeRoute(path);
  const preload = preloaders[key];
  if (!preload || preloaded.has(key)) return;

  preloaded.add(key);
  void preload().catch(() => {
    preloaded.delete(key);
  });
}

export function preloadMobileRoutes() {
  MOBILE_APP_ROUTES.forEach((route) => preloadRoute(route));
}
