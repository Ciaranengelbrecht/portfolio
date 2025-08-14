import ChartPanel from "../../components/ChartPanel";
import GlassCard from "../../components/GlassCard";
import ProgressBars from "../../components/ProgressBars";
import { useEffect, useState } from "react";
import { getDashboardPrefs } from "../../lib/helpers";

export default function Dashboard() {
  const [phase, setPhase] = useState(1);
  const [week, setWeek] = useState(1);
  useEffect(() => {
    (async () => {
      const prefs = await getDashboardPrefs();
      if (prefs.lastLocation) {
        setPhase(prefs.lastLocation.phaseNumber);
        setWeek(prefs.lastLocation.weekNumber);
      }
    })();
  }, []);
  return (
    <div className="space-y-4">
      <ProgressBars />
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <div className="font-medium mb-2">Training</div>
          <ChartPanel kind="exercise" />
        </div>
        <div>
          <div className="font-medium mb-2">Body</div>
          <ChartPanel kind="measurement" />
        </div>
      </div>
    </div>
  );
}
