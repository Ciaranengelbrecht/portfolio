import { registerSW as viteRegister } from "virtual:pwa-register";

const bustServiceWorker = () => {
  try {
    const url = new URL("../sw.js", import.meta.url);
    url.search = "cb=" + Date.now();
    return fetch(url.toString(), { cache: "no-store" });
  } catch (err) {
    return Promise.resolve(undefined);
  }
};

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
        try {
          updateSW();
        } catch {}
        if (registration) {
          registration.update().catch(() => {});
        }
        bustServiceWorker().catch(() => {});
      };

      tick();
      window.setInterval(tick, 60_000);
    } catch {}
  };

  bustServiceWorker()
    .catch(() => {})
    .finally(scheduleTick);
}
