import { useEffect, useMemo, useState } from "react";
import GlassCard from "./GlassCard";
import { loadRecharts } from "../lib/loadRecharts";
import { db } from "../lib/db";
import { Exercise, Measurement } from "../lib/types";
import {
  getDashboardPrefs,
  getExerciseTimeSeries,
  getMeasurementTimeSeries,
  setDashboardPrefs,
  RangeKey,
  rollingPRs,
} from "../lib/helpers";

const RANGE_OPTS: RangeKey[] = ["4w", "8w", "12w", "all"];
const EX_SERIES_KEYS = [
  { key: "topWeight", label: "Top Weight" },
  { key: "avgWeight", label: "Avg Weight" },
  { key: "repsTotal", label: "Reps" },
  { key: "volume", label: "Volume" },
];

type ExercisePoint = {
  date: string;
  topWeight: number;
  avgWeight: number;
  repsTotal: number;
  volume: number;
};
type MeasurementPoint = { date: string; value: number };

export default function ChartPanel({
  kind,
}: {
  kind: "exercise" | "measurement";
}) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [measurementKey, setMeasurementKey] =
    useState<keyof Measurement>("waist");
  const [exerciseId, setExerciseId] = useState<string>("");
  const [range, setRange] = useState<RangeKey>("8w");
  const [series, setSeries] = useState<string[]>(["topWeight"]);
  const [data, setData] = useState<(ExercisePoint | MeasurementPoint)[]>([]);
  const [prs, setPrs] = useState<number[]>([]);
  const [, setThemeTick] = useState(0);

  useEffect(() => {
    (async () => {
      setExercises(await db.getAll("exercises"));
      const prefs = await getDashboardPrefs();
      if (prefs.exerciseId) setExerciseId(prefs.exerciseId);
      if (prefs.measurementKey) setMeasurementKey(prefs.measurementKey);
      if (prefs.range) setRange(prefs.range);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (kind === "exercise") {
        const id = exerciseId || exercises[0]?.id;
        if (!id) return;
        setExerciseId(id);
        const d = (await getExerciseTimeSeries(id, range)) as ExercisePoint[];
        setData(d);
        const pr = await rollingPRs(id);
        const tops = d.map((x: any) => x.topWeight);
        const max = Math.max(0, ...tops);
        setPrs(d.map((x: any) => (x.topWeight >= max ? x.topWeight : 0)));
        await setDashboardPrefs({ exerciseId: id, range });
      } else {
        const d = (await getMeasurementTimeSeries(
          measurementKey,
          range
        )) as MeasurementPoint[];
        setData(d);
        await setDashboardPrefs({ measurementKey, range });
      }
    })();
  }, [kind, exerciseId, measurementKey, range, exercises]);

  // Re-render on theme changes to pick up CSS variable values for charts
  useEffect(() => {
    const fn = () => setThemeTick((t) => t + 1);
    window.addEventListener("theme-change", fn as any);
    return () => window.removeEventListener("theme-change", fn as any);
  }, []);

  const css = getComputedStyle(document.documentElement);
  const chart1 = css.getPropertyValue("--chart-1").trim() || "#3b82f6";
  const chart2 = css.getPropertyValue("--chart-2").trim() || "#22c55e";
  const grid = css.getPropertyValue("--chart-grid").trim() || "#1f2937";
  const axis =
    getComputedStyle(document.documentElement)
      .getPropertyValue("--text-muted")
      .trim() || "#9ca3af";
  const keys =
    kind === "exercise" ? EX_SERIES_KEYS : [{ key: "value", label: "Value" }];
  const glow = css.getPropertyValue("--glow").trim();

  // Lazy-load recharts
  const [RC, setRC] = useState<any | null>(null);
  useEffect(() => {
    let active = true;
    loadRecharts().then((m) => {
      if (active) setRC(m);
    });
    return () => {
      active = false;
    };
  }, []);

  const Loading = (
    <div className="h-60 flex items-center justify-center text-xs text-gray-500">
      Loading chart…
    </div>
  );

  return (
    <GlassCard>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {kind === "exercise" ? (
          <select
            className="input-app rounded-xl px-2 py-1"
            value={exerciseId}
            onChange={(e) => setExerciseId(e.target.value)}
          >
            {exercises.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        ) : (
          <select
            className="input-app rounded-xl px-2 py-1"
            value={measurementKey}
            onChange={(e) => setMeasurementKey(e.target.value as any)}
          >
            {["weightKg", "waist", "upperArm", "chest", "thigh", "calf"].map(
              (k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              )
            )}
          </select>
        )}
        <div className="flex gap-1 ml-auto flex-wrap">
          {RANGE_OPTS.map((r) => (
            <button
              key={r}
              className={`text-xs px-2 py-1 rounded-xl ${
                range === r ? "btn-primary" : "btn-outline"
              }`}
              onClick={() => setRange(r)}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2 mb-2 flex-wrap">
        {keys.map((s) => (
          <label
            key={s.key}
            className="text-xs input-app rounded-xl px-2 py-1 flex items-center gap-1"
          >
            <input
              type="checkbox"
              checked={series.includes(s.key)}
              onChange={(e) =>
                setSeries(
                  e.target.checked
                    ? [...series, s.key]
                    : series.filter((k) => k !== s.key)
                )
              }
            />{" "}
            {s.label}
          </label>
        ))}
      </div>
      <div className="h-60">
        {!RC && Loading}
        {RC && (
          <RC.ResponsiveContainer>
            <RC.LineChart
              data={data}
              margin={{ left: 8, right: 8, top: 8, bottom: 8 }}
            >
              <RC.CartesianGrid strokeDasharray="3 3" stroke={grid} />
              <RC.XAxis dataKey="date" stroke={axis} />
              <RC.YAxis stroke={axis} />
              <RC.Tooltip />
              {kind === "exercise" ? (
                series.map((k, i) => (
                  <RC.Line
                    key={k}
                    type="monotone"
                    dataKey={k}
                    stroke={i % 2 === 0 ? chart1 : chart2}
                    dot={false}
                    strokeWidth={i === 0 ? 2 : 1.5}
                    filter={i === 0 && glow ? "url(#glow)" : undefined}
                  />
                ))
              ) : (
                <RC.Line
                  type="monotone"
                  dataKey="value"
                  stroke={chart1}
                  dot={false}
                  strokeWidth={2}
                />
              )}
              {kind === "exercise" && prs.some(Boolean) && (
                <RC.Scatter
                  data={
                    (data as ExercisePoint[])
                      .map((d, i) =>
                        prs[i] ? { date: d.date, y: d.topWeight } : null
                      )
                      .filter(Boolean) as any
                  }
                  fill={chart2}
                />
              )}
              <defs>
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
            </RC.LineChart>
          </RC.ResponsiveContainer>
        )}
      </div>
    </GlassCard>
  );
}
