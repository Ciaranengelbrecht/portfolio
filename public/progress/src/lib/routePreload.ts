const preloaders: Record<string, () => Promise<unknown>> = {
  "/": () => import("../features/dashboard/Dashboard"),
  "/analytics": () => import("../features/analytics/Analytics"),
  "/sessions": () => import("../pages/Sessions"),
  "/recovery": () => import("../pages/Recovery"),
  "/measurements": () => import("../pages/Measurements"),
  "/templates": () => import("../pages/Templates"),
  "/settings": () => import("../pages/Settings"),
  "/settings/program": () => import("../pages/ProgramSettings"),
  "/auth": () => import("../pages/auth/IntroAuthPage"),
};

const preloaded = new Set<string>();

function normalizeRoute(path: string): string {
  if (!path) return "/";
  if (path.startsWith("/auth")) return "/auth";
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
