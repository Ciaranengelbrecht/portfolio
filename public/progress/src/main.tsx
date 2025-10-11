import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

const bootDiag = (message: string, detail?: unknown) => {
  try {
    const hook = (window as any).__LL_BOOT_DIAG;
    if (typeof hook === "function") hook(message, detail ?? null);
  } catch (_) {
    // ignore
  }
};

bootDiag("main.tsx evaluating", {
  userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
  href: typeof location !== "undefined" ? location.href : "unknown",
});
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);

// Signal to any startup watchdog that the app has mounted successfully
queueMicrotask(() => {
  bootDiag("React root rendered");
  try {
    (window as any).__LL_MOUNTED = true;
    bootDiag("window.__LL_MOUNTED set", true);
  } catch (e) {
    bootDiag("Failed setting __LL_MOUNTED", (e as Error)?.message ?? e);
  }
});
