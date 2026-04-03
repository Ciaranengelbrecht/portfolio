import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  readRecentSelections,
  rememberRecentSelection,
  sortByRecentSelection,
} from "../lib/recentSelections";
import {
  getAxisDensity,
  getChartMargin,
  getChartTooltipProps,
  useIsCompactChartScreen,
} from "../lib/chartUi";
import { SkeletonChart } from "./Skeleton";

const RANGE_OPTS: RangeKey[] = ["4w", "8w", "12w", "all"];
const EX_SERIES_KEYS = [
  { key: "topWeight", label: "Top Weight" },
  { key: "avgWeight", label: "Avg Weight" },
  { key: "repsTotal", label: "Reps" },
  { key: "volume", label: "Volume" },
];
const CHART_EXERCISE_RECENT_SCOPE = "charts:exercise-picker";
const SERIES_LABEL_MAP = Object.fromEntries(
  EX_SERIES_KEYS.map((item) => [item.key, item.label])
) as Record<string, string>;

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
  const [exerciseQuery, setExerciseQuery] = useState("");
  const [recentExerciseIds, setRecentExerciseIds] = useState<string[]>([]);
  const [range, setRange] = useState<RangeKey>("8w");
  const [series, setSeries] = useState<string[]>(["topWeight"]);
  const [data, setData] = useState<(ExercisePoint | MeasurementPoint)[]>([]);
  const [prs, setPrs] = useState<number[]>([]);
  const [, setThemeTick] = useState(0);
  const compact = useIsCompactChartScreen();

  useEffect(() => {
    (async () => {
      setExercises(await db.getAll("exercises"));
      setRecentExerciseIds(readRecentSelections(CHART_EXERCISE_RECENT_SCOPE));
      const prefs = await getDashboardPrefs();
      if (prefs.exerciseId) setExerciseId(prefs.exerciseId);
      if (prefs.measurementKey) setMeasurementKey(prefs.measurementKey);
      if (prefs.range) setRange(prefs.range);
    })();
  }, []);

  const handleExerciseSelect = useCallback(
    (id: string, persist = true) => {
      setExerciseId(id);
      if (!persist) return;
      setRecentExerciseIds(
        rememberRecentSelection(CHART_EXERCISE_RECENT_SCOPE, id, 14)
      );
    },
    []
  );

  const filteredExerciseOptions = useMemo(() => {
    const term = exerciseQuery.trim().toLowerCase();
    const pool = term
      ? exercises.filter((exercise) =>
          exercise.name.toLowerCase().includes(term)
        )
      : exercises;
    return sortByRecentSelection(
      pool,
      (exercise) => exercise.id,
      recentExerciseIds,
      (left, right) => left.name.localeCompare(right.name)
    );
  }, [exerciseQuery, exercises, recentExerciseIds]);

  const exerciseSelectOptions = useMemo(() => {
    if (!exerciseId) return filteredExerciseOptions;
    if (filteredExerciseOptions.some((exercise) => exercise.id === exerciseId)) {
      return filteredExerciseOptions;
    }
    const selected = exercises.find((exercise) => exercise.id === exerciseId);
    if (!selected) return filteredExerciseOptions;
    return [
      selected,
      ...filteredExerciseOptions.filter((exercise) => exercise.id !== selected.id),
    ];
  }, [exerciseId, filteredExerciseOptions, exercises]);

  useEffect(() => {
    (async () => {
      if (kind === "exercise") {
        const id = exerciseId || exercises[0]?.id;
        if (!id) return;
        handleExerciseSelect(id, false);
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
  }, [kind, exerciseId, measurementKey, range, exercises, handleExerciseSelect]);

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
  const chartMargin = useMemo(() => getChartMargin(compact, "standard"), [compact]);
  const axisDensity = useMemo(
    () => getAxisDensity(data.length, compact),
    [data.length, compact]
  );
  const tooltipProps = useMemo(() => getChartTooltipProps(compact), [compact]);

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

  const Loading = <SkeletonChart height={compact ? "h-56" : "h-60"} />;

  return (
    <GlassCard>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {kind === "exercise" ? (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[260px]">
            <input
              className="input-app rounded-xl px-3 py-2 text-sm"
              type="search"
              spellCheck={false}
              placeholder="Search exercises"
              value={exerciseQuery}
              onChange={(e) => setExerciseQuery(e.target.value)}
            />
            <select
              className="input-app rounded-xl px-3 py-2 text-sm"
              value={exerciseSelectOptions.length ? exerciseId : ""}
              onChange={(e) => handleExerciseSelect(e.target.value)}
              disabled={!exerciseSelectOptions.length}
            >
              {exerciseSelectOptions.length ? (
                exerciseSelectOptions.map((exercise) => (
                  <option key={exercise.id} value={exercise.id}>
                    {exercise.name}
                  </option>
                ))
              ) : (
                <option value="" disabled>
                  No exercises found
                </option>
              )}
            </select>
          </div>
        ) : (
          <select
            className="input-app rounded-xl px-3 py-2 text-sm"
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
        <div className="flex flex-wrap gap-1.5 sm:justify-end">
          {RANGE_OPTS.map((r) => (
            <button
              key={r}
              className={`rounded-xl px-2.5 py-1.5 text-xs ${
                range === r ? "btn-primary" : "btn-outline"
              }`}
              onClick={() => setRange(r)}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {keys.map((s) => (
          <label
            key={s.key}
            className="text-xs input-app rounded-xl px-2.5 py-1.5 flex items-center gap-1.5 text-white/85"
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
      <div className="h-56 sm:h-64">
        {!RC && Loading}
        {RC && (
          <RC.ResponsiveContainer>
            <RC.LineChart
              data={data}
              margin={chartMargin}
            >
              <RC.CartesianGrid strokeDasharray="3 3" stroke={grid} />
              <RC.XAxis
                dataKey="date"
                stroke={axis}
                tick={{ fontSize: axisDensity.fontSize }}
                interval={axisDensity.interval}
                angle={axisDensity.angle}
                height={axisDensity.height}
                tickMargin={axisDensity.tickMargin}
              />
              <RC.YAxis
                stroke={axis}
                tick={{ fontSize: axisDensity.fontSize }}
                width={compact ? 36 : 44}
              />
              <RC.Tooltip {...tooltipProps} />
              {kind === "exercise" ? (
                series.map((k, i) => (
                  <RC.Line
                    key={k}
                    type="monotone"
                    dataKey={k}
                    name={SERIES_LABEL_MAP[k] || k}
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
                  name="Value"
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
