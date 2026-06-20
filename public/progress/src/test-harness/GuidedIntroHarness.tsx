import { useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";
import GuidedAppIntro, {
  type GuidedAppIntroPage,
} from "../components/GuidedAppIntro";
import { withAppIntroPending } from "../lib/appIntro";
import { defaultSettings } from "../lib/defaults";
import type { Settings } from "../lib/types";

const routeOne = "/__guided-intro-test";
const routeTwo = "/__guided-intro-test/next";

export default function GuidedIntroHarness() {
  const location = useLocation();
  const settingsRef = useRef<Settings>(withAppIntroPending(defaultSettings));
  const pages = useMemo<GuidedAppIntroPage[]>(
    () => [
      {
        pageId: "sessions",
        label: "Training",
        route: routeOne,
        steps: [
          {
            id: "top-target",
            title: "Top target",
            body: "The card should sit below this target without covering it.",
            targetIds: ["harness-top-target"],
          },
          {
            id: "low-target",
            title: "Low target",
            body: "The card should move above lower content on compact screens.",
            targetIds: ["harness-low-target"],
          },
        ],
      },
      {
        pageId: "dashboard",
        label: "Dashboard",
        route: routeTwo,
        steps: [
          {
            id: "route-target",
            title: "Route target",
            body: "This step verifies route changes keep the tour active.",
            targetIds: ["harness-route-target"],
          },
        ],
      },
    ],
    []
  );

  return (
    <div className="min-h-[1500px] bg-slate-950 px-5 py-12 text-white">
      {location.pathname.endsWith("/next") ? (
        <section className="pt-72">
          <button
            type="button"
            className="rounded-xl border border-cyan-300/50 bg-cyan-300/15 px-5 py-4 text-sm font-semibold text-cyan-100"
            data-tour-id="harness-route-target"
          >
            Route transition target
          </button>
        </section>
      ) : (
        <section className="space-y-[520px]">
          <button
            type="button"
            className="rounded-xl border border-emerald-300/50 bg-emerald-300/15 px-5 py-4 text-sm font-semibold text-emerald-100"
            data-tour-id="harness-top-target"
          >
            Upper viewport target
          </button>
          <button
            type="button"
            className="rounded-xl border border-amber-300/50 bg-amber-300/15 px-5 py-4 text-sm font-semibold text-amber-100"
            data-tour-id="harness-low-target"
          >
            Lower viewport target
          </button>
        </section>
      )}
      <GuidedAppIntro
        pages={pages}
        settingsApi={{
          getSettings: async () => settingsRef.current,
          setSettings: async (next) => {
            settingsRef.current =
              typeof next === "function"
                ? await next(settingsRef.current)
                : next;
          },
        }}
      />
    </div>
  );
}
