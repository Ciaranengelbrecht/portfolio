import { APP_VERSION, MONITORING_ENDPOINT, RELEASE_CHANNEL } from "./config";

type MonitoringPayload = {
  type: "event" | "error" | "metric";
  name: string;
  ts: string;
  appVersion: string;
  releaseChannel: string;
  details?: Record<string, unknown>;
};

function send(payload: MonitoringPayload) {
  if (!MONITORING_ENDPOINT || typeof window === "undefined") return;
  try {
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(MONITORING_ENDPOINT, blob);
      return;
    }
    fetch(MONITORING_ENDPOINT, {
      method: "POST",
      body,
      headers: { "content-type": "application/json" },
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Monitoring must never affect app behavior.
  }
}

function basePayload(
  type: MonitoringPayload["type"],
  name: string,
  details?: Record<string, unknown>
): MonitoringPayload {
  return {
    type,
    name,
    ts: new Date().toISOString(),
    appVersion: APP_VERSION,
    releaseChannel: RELEASE_CHANNEL,
    details,
  };
}

export function trackEvent(name: string, details?: Record<string, unknown>) {
  send(basePayload("event", name, details));
}

export function trackMetric(name: string, value: number, details?: Record<string, unknown>) {
  send(basePayload("metric", name, { ...details, value }));
}

export function trackError(error: unknown, details?: Record<string, unknown>) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  send(basePayload("error", "runtime_error", { ...details, message, stack }));
}

export function initMonitoring() {
  if (typeof window === "undefined") return;
  trackEvent("app_start", {
    standalone:
      window.matchMedia?.("(display-mode: standalone)").matches || false,
  });
  window.addEventListener("error", (event) => {
    trackError(event.error || event.message, { source: "window.error" });
  });
  window.addEventListener("unhandledrejection", (event) => {
    trackError(event.reason, { source: "unhandledrejection" });
  });
}
