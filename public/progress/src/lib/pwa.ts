import { registerSW as viteRegister } from "virtual:pwa-register";

const SW_UPDATE_INTERVAL_MS = 5 * 60_000;

const bustServiceWorker = () => {
  try {
    const url = new URL(/* @vite-ignore */ "../sw.js", import.meta.url);
    url.search = "cb=" + Date.now();
    return fetch(url.toString(), { cache: "no-store" });
  } catch (err) {
    return Promise.resolve(undefined);
  }
};

const isLiftLogRegistration = (registration: ServiceWorkerRegistration) => {
  if (typeof window === "undefined") return false;
  try {
    const currentUrl = window.location.href;
    const scopeUrl = new URL(registration.scope);
    return (
      currentUrl.startsWith(registration.scope) ||
      scopeUrl.pathname.includes("/progress/")
    );
  } catch {
    return false;
  }
};

const deleteAppShellCaches = async () => {
  if (typeof window === "undefined" || !("caches" in window)) return;
  const cacheKeys = await caches.keys();
  await Promise.all(
    cacheKeys
      .filter((key) =>
        /liftlog|workbox|precache|vite|progress/i.test(key)
      )
      .map((key) => caches.delete(key).catch(() => false))
  );
};

export async function refreshAppShell() {
  if (typeof window === "undefined") return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new Error("You need to be online to refresh the app version.");
  }

  await bustServiceWorker().catch(() => undefined);
  await fetch(window.location.href, { cache: "no-store" }).catch(() => undefined);

  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const appRegistrations = registrations.filter(isLiftLogRegistration);
    await Promise.all(
      appRegistrations.map(async (registration) => {
        await registration.update().catch(() => undefined);
        await registration.unregister().catch(() => false);
      })
    );
  }

  await deleteAppShellCaches();

  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("app_refresh", String(Date.now()));
  window.location.replace(nextUrl.toString());
}

export function registerSW() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  let registration: ServiceWorkerRegistration | undefined;

  const scheduleTick = () => {
    try {
      const updateSW = viteRegister({
        immediate: true,
        onRegisteredSW(_swUrl: string, reg: ServiceWorkerRegistration | undefined) {
          registration = reg;
          if (reg) {
            reg.update().catch(() => {});
          }
        },
        onNeedRefresh() {
          try {
            updateSW(true);
          } catch {}
        },
      });

      const tick = () => {
        if (
          typeof document !== "undefined" &&
          document.visibilityState === "hidden"
        ) {
          return;
        }
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          return;
        }
        try {
          updateSW();
        } catch {}
        if (registration) {
          registration.update().catch(() => {});
        }
        bustServiceWorker().catch(() => {});
      };

      tick();
      window.setInterval(tick, SW_UPDATE_INTERVAL_MS);
    } catch {}
  };

  bustServiceWorker()
    .catch(() => {})
    .finally(scheduleTick);
}
