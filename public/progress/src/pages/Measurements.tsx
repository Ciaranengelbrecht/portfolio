import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import type { PointerEvent, MouseEvent } from "react";
import { db } from "../lib/db";
import { getSettings, setSettings } from "../lib/helpers";
import { Measurement } from "../lib/types";
import { nanoid } from "nanoid";
import { loadRecharts } from "../lib/loadRecharts";
import MeasurementsInfoModal from "./MeasurementsInfoModal";
import UnifiedTooltip from "../components/UnifiedTooltip";
import { useSnack } from "../state/snackbar";
import { parseEvoltTextToMeasurement } from "../lib/evoltImport";
import { extractTextFromPdf } from "../lib/pdf";

const TIPS: Record<string, string> = {
  neck: "Measure at the thickest point, relaxed.",
  chest: "Tape at nipples level, relaxed.",
  waist: "At navel, relaxed but not sucked in.",
  hips: "Around glutes at the widest point.",
  thigh: "Mid-thigh, stand tall.",
  calf: "At the largest point standing.",
  upperArm: "Upper arm cold, flexed lightly.",
  forearm: "At the largest point, arm parallel to floor.",
  heightCm:
    "Stand tall without shoes, heels together, back against the wall. Measure to the nearest 0.5 cm.",
};

const FIELD_LABEL_OVERRIDES: Record<string, string> = {
  weightKg: "Weight (kg)",
  heightCm: "Height (cm)",
  upperArm: "Upper arm",
  bodyFatPct: "Body fat %",
  leanMassKg: "Lean mass (kg)",
  fatMassKg: "Fat mass (kg)",
  ffmi: "FFMI",
  ffmiAdjusted: "Adj. FFMI",
};

const FIELD_UNIT_OVERRIDES: Record<string, string> = {
  weightKg: "kg",
  heightCm: "cm",
  neck: "cm",
  chest: "cm",
  waist: "cm",
  hips: "cm",
  thigh: "cm",
  calf: "cm",
  upperArm: "cm",
  forearm: "cm",
};

const formatMeasurementLabel = (key: string) => {
  if (FIELD_LABEL_OVERRIDES[key]) return FIELD_LABEL_OVERRIDES[key];
  const withSpaces = key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .trim();
  if (!withSpaces) return key;
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
};

const getUnitForKey = (key: string) => FIELD_UNIT_OVERRIDES[key] || "";

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});

const LONG_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const formatChartDateTick = (value: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return SHORT_DATE_FORMATTER.format(date);
};

const formatChartTooltipLabel = (value: string | number) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return LONG_DATE_FORMATTER.format(date);
};

const OVERLAY_COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#a855f7"];

const buildTickValues = (points: Array<{ date: string }>) => {
  if (!points || points.length === 0) return [] as string[];
  if (points.length <= 3) return Array.from(new Set(points.map((p) => p.date)));
  const desired = Math.min(6, points.length);
  const step = Math.max(1, Math.floor(points.length / desired));
  const ticks: string[] = [];
  for (let i = 0; i < points.length; i += step) {
    ticks.push(points[i].date);
  }
  const last = points[points.length - 1].date;
  const first = points[0].date;
  if (!ticks.includes(first)) ticks.unshift(first);
  if (!ticks.includes(last)) ticks.push(last);
  return Array.from(new Set(ticks));
};

type SkinfoldKey =
  | "skinfoldChest"
  | "skinfoldAbdomen"
  | "skinfoldThigh"
  | "skinfoldSuprailiac"
  | "skinfoldTricep"
  | "skinfoldSubscapular"
  | "skinfoldAxilla"
  | "skinfoldBicep";

const SKINFOLD_SITES: Array<{
  key: SkinfoldKey;
  label: string;
  short?: string;
  description: string;
}> = [
  {
    key: "skinfoldChest",
    label: "Chest",
    description:
      "Diagonal fold taken halfway between the nipple and anterior axillary line. Pinch firmly and place caliper 1cm below fingers.",
  },
  {
    key: "skinfoldAxilla",
    label: "Mid-axilla",
    description:
      "Vertical fold on the mid-axillary line at the level of the xiphoid process (just below the sternum).",
  },
  {
    key: "skinfoldTricep",
    label: "Tricep",
    description:
      "Vertical fold on the back of the upper arm, halfway between shoulder and elbow. Arm relaxed at side.",
  },
  {
    key: "skinfoldSubscapular",
    label: "Subscapular",
    description:
      "Diagonal fold just below the shoulder blade, angled at ~45° following the natural skin crease.",
  },
  {
    key: "skinfoldAbdomen",
    label: "Abdomen",
    description:
      "Vertical fold 2cm to the right of the navel. Exhale softly before measuring.",
  },
  {
    key: "skinfoldSuprailiac",
    label: "Suprailiac",
    description:
      "Diagonal fold just above the hip bone along the natural line of the iliac crest, angled toward the groin.",
  },
  {
    key: "skinfoldThigh",
    label: "Thigh",
    description:
      "Vertical fold on the front of the thigh, midway between hip and knee. Shift weight to the opposite leg.",
  },
  {
    key: "skinfoldBicep",
    label: "Bicep",
    description:
      "Vertical fold on the front of the upper arm, halfway between shoulder and elbow, arm relaxed.",
  },
];
const SKINFOLD_GENERAL_TIPS: string[] = [
  "Always measure on the right side of the body for consistency.",
  "Take at least two readings per site and use the average when possible.",
  "Pinch the skinfold firmly before applying the caliper 1cm below your fingers.",
  "Allow the caliper to settle for ~2 seconds before reading the value in millimetres.",
  "Stay relaxed — flexing or twisting can change the thickness of the fold.",
];

const JACKSON_POLLACK_SEVEN: SkinfoldKey[] = [
  "skinfoldChest",
  "skinfoldAxilla",
  "skinfoldTricep",
  "skinfoldSubscapular",
  "skinfoldAbdomen",
  "skinfoldSuprailiac",
  "skinfoldThigh",
];

const JACKSON_POLLACK_MALE_THREE: SkinfoldKey[] = [
  "skinfoldChest",
  "skinfoldAbdomen",
  "skinfoldThigh",
];

const JACKSON_POLLACK_FEMALE_THREE: SkinfoldKey[] = [
  "skinfoldTricep",
  "skinfoldSuprailiac",
  "skinfoldThigh",
];

const MEASUREMENT_COLLAPSE_KEY = "measurements:collapsedState";

type BodyFatComputationResult =
  | {
      ok: true;
      method: string;
      sum: number;
      usedSites: SkinfoldKey[];
      density: number;
      bodyFatPct: number;
      leanMassKg?: number;
      fatMassKg?: number;
    }
  | {
      ok: false;
      reason: "age" | "sites";
      missingSites?: SkinfoldKey[];
    };

type FfmiComputationResult =
  | {
      ok: true;
      ffmi: number;
      ffmiAdjusted: number;
      heightCm: number;
      heightM: number;
      leanMassKg: number;
      source: "recorded" | "bodyFatMeasurement" | "bodyFatEstimate";
      bodyFatPctUsed?: number;
    }
  | {
      ok: false;
      reason: "height" | "leanMass";
    };

function calculateBodyFatFromCalipers({
  sex,
  age,
  calipers,
  weightKg,
}: {
  sex: "male" | "female";
  age: number;
  calipers: Partial<Record<SkinfoldKey, number>>;
  weightKg?: number;
}): BodyFatComputationResult {
  const getValue = (key: SkinfoldKey) => {
    const raw = calipers[key];
    return typeof raw === "number" && !Number.isNaN(raw) ? raw : undefined;
  };
  const hasAll = (keys: SkinfoldKey[]) =>
    keys.every((key) => getValue(key) != null);
  const sumOf = (keys: SkinfoldKey[]) =>
    keys.reduce((total, key) => total + (getValue(key) ?? 0), 0);

  if (!age || Number.isNaN(age) || age <= 0) {
    return { ok: false, reason: "age" };
  }

  const computeDensity = (
    sum: number,
    formula: "seven" | "male3" | "female3"
  ) => {
    const ageTerm = age;
    if (formula === "seven") {
      if (sex === "male") {
        return (
          1.112 -
          0.00043499 * sum +
          0.00000055 * sum * sum -
          0.00028826 * ageTerm
        );
      }
      return (
        1.097 - 0.00046971 * sum + 0.00000056 * sum * sum - 0.00012828 * ageTerm
      );
    }
    if (formula === "male3") {
      return (
        1.10938 - 0.0008267 * sum + 0.0000016 * sum * sum - 0.0002574 * ageTerm
      );
    }
    // female3
    return (
      1.0994921 - 0.0009929 * sum + 0.0000023 * sum * sum - 0.0001392 * ageTerm
    );
  };

  const buildResult = (
    usedSites: SkinfoldKey[],
    formula: "seven" | "male3" | "female3"
  ) => {
    const sum = sumOf(usedSites);
    const density = computeDensity(sum, formula);
    if (!density || Number.isNaN(density) || density <= 0) {
      return {
        ok: false,
        reason: "sites",
        missingSites: usedSites,
      } as BodyFatComputationResult;
    }
    const bodyFatPct = 495 / density - 450;
    const bfClamped = Math.max(2, Math.min(70, bodyFatPct));
    const leanMassKg =
      typeof weightKg === "number"
        ? Number((weightKg * (1 - bfClamped / 100)).toFixed(2))
        : undefined;
    const fatMassKg =
      typeof weightKg === "number"
        ? Number((weightKg * (bfClamped / 100)).toFixed(2))
        : undefined;
    return {
      ok: true,
      method:
        formula === "seven"
          ? "Jackson & Pollock 7-site"
          : formula === "male3"
          ? "Jackson & Pollock 3-site (male)"
          : "Jackson & Pollock 3-site (female)",
      sum,
      usedSites,
      density,
      bodyFatPct: Number(bfClamped.toFixed(2)),
      leanMassKg,
      fatMassKg,
    } as BodyFatComputationResult;
  };

  if (hasAll(JACKSON_POLLACK_SEVEN)) {
    return buildResult(JACKSON_POLLACK_SEVEN, "seven");
  }
  if (sex === "male" && hasAll(JACKSON_POLLACK_MALE_THREE)) {
    return buildResult(JACKSON_POLLACK_MALE_THREE, "male3");
  }
  if (sex === "female" && hasAll(JACKSON_POLLACK_FEMALE_THREE)) {
    return buildResult(JACKSON_POLLACK_FEMALE_THREE, "female3");
  }

  const missing: SkinfoldKey[] = [];
  const targetKeys =
    sex === "male" ? JACKSON_POLLACK_MALE_THREE : JACKSON_POLLACK_FEMALE_THREE;
  targetKeys.forEach((key) => {
    if (getValue(key) == null) missing.push(key);
  });
  return { ok: false, reason: "sites", missingSites: missing };
}

export default function Measurements() {
  const [m, setM] = useState<Measurement>({
    id: nanoid(),
    dateISO: new Date().toISOString(),
  });
  const [data, setData] = useState<Measurement[]>([]);
  const { push } = useSnack();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<null | {
    parsed: Partial<Measurement>;
    found: string[];
    warnings: string[];
    fileName: string;
    scanDateISO?: string;
  }>(null);
  const [bodyFatPrefs, setBodyFatPrefs] = useState<{
    sex: "male" | "female";
    age: number;
  }>(() => {
    if (typeof window === "undefined") {
      return { sex: "male", age: 30 };
    }
    try {
      const raw = window.localStorage.getItem("bodyFatPrefs");
      if (raw) {
        const parsed = JSON.parse(raw);
        const sex = parsed.sex === "female" ? "female" : "male";
        const age = Number(parsed.age);
        return { sex, age: Number.isFinite(age) && age > 0 ? age : 0 };
      }
    } catch {}
    return { sex: "male", age: 30 };
  });
  const [caliperRowsOpen, setCaliperRowsOpen] = useState<
    Record<string, boolean>
  >({});
  const [collapsedRows, setCollapsedRows] = useState<Record<string, boolean>>(
    () => {
      if (typeof window === "undefined") return {};
      try {
        const raw = window.localStorage.getItem(MEASUREMENT_COLLAPSE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") return parsed;
        }
      } catch {}
      return {};
    }
  );

  useEffect(() => {
    (async () => {
      const list = await db.getAll<Measurement>("measurements");
      const sorted = [...list].sort((a, b) =>
        b.dateISO.localeCompare(a.dateISO)
      );
      setData(sorted);
      // today guard
      const today = new Date().toISOString().slice(0, 10);
      const existingToday = sorted.find(
        (r) => r.dateISO.slice(0, 10) === today
      );
      if (existingToday) setM(existingToday);
      else if (sorted.length) {
        setM((prev) => ({
          ...prev,
          heightCm:
            typeof prev.heightCm === "number" && !Number.isNaN(prev.heightCm)
              ? prev.heightCm
              : sorted[0]?.heightCm,
        }));
      }
    })();
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("bodyFatPrefs", JSON.stringify(bodyFatPrefs));
    } catch {}
  }, [bodyFatPrefs]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        MEASUREMENT_COLLAPSE_KEY,
        JSON.stringify(collapsedRows)
      );
    } catch {}
  }, [collapsedRows]);

  useEffect(() => {
    setCollapsedRows((prev) => {
      if (!data.length && Object.keys(prev).length === 0) return prev;
      const next: Record<string, boolean> = {};
      for (const row of data) {
        next[row.id] = prev[row.id] ?? true;
      }
      if (Object.keys(prev).length === Object.keys(next).length) {
        const same = Object.entries(next).every(
          ([key, value]) => prev[key] === value
        );
        if (same) return prev;
      }
      return next;
    });
  }, [data]);

  const toggleMeasurementCollapsed = (id: string, forced?: boolean) => {
    const nextValue =
      typeof forced === "boolean" ? forced : !(collapsedRows[id] ?? true);
    if (nextValue) {
      setCaliperRowsOpen((prev) => {
        if (!prev[id]) return prev;
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }
    setCollapsedRows((prev) => ({ ...prev, [id]: nextValue }));
  };

  const handleMeasurementSurfaceClick = (
    event: MouseEvent<HTMLDivElement>,
    id: string
  ) => {
    const current = collapsedRows[id] ?? true;
    if (!current) return;
    const target = event.target as HTMLElement | null;
    if (
      target?.closest(
        "button, input, textarea, select, a, label, [data-prevent-card-toggle='true'], [contenteditable='true']"
      )
    ) {
      return;
    }
    toggleMeasurementCollapsed(id, false);
  };

  const caliperValues = useMemo(() => {
    const result: Partial<Record<SkinfoldKey, number>> = {};
    SKINFOLD_SITES.forEach(({ key }) => {
      const value = (m as any)[key];
      if (typeof value === "number" && !Number.isNaN(value)) {
        result[key] = value;
      }
    });
    return result;
  }, [m]);

  const caliperSummary = useMemo(() => {
    const values = Object.values(caliperValues).filter(
      (v): v is number => typeof v === "number" && !Number.isNaN(v)
    );
    const sum = values.reduce((total, v) => total + v, 0);
    return { count: values.length, sum };
  }, [caliperValues]);

  const bodyFatResult = useMemo(
    () =>
      calculateBodyFatFromCalipers({
        sex: bodyFatPrefs.sex,
        age: bodyFatPrefs.age,
        calipers: caliperValues,
        weightKg: m.weightKg,
      }),
    [bodyFatPrefs.sex, bodyFatPrefs.age, caliperValues, m.weightKg]
  );

  const ffmiResult: FfmiComputationResult = useMemo(() => {
    const rawHeight =
      typeof m.heightCm === "number" && !Number.isNaN(m.heightCm)
        ? m.heightCm
        : undefined;
    if (!rawHeight || rawHeight <= 0) {
      return { ok: false, reason: "height" };
    }
    const heightCm = Number(rawHeight.toFixed(1));
    const heightM = heightCm / 100;
    if (!heightM || Number.isNaN(heightM) || heightM <= 0) {
      return { ok: false, reason: "height" };
    }

    let leanMass: number | undefined;
    let source:
      | "recorded"
      | "bodyFatMeasurement"
      | "bodyFatEstimate"
      | undefined;
    let bodyFatPctUsed: number | undefined;

    if (typeof m.leanMassKg === "number" && m.leanMassKg > 0) {
      leanMass = m.leanMassKg;
      source = "recorded";
    } else if (
      typeof m.weightKg === "number" &&
      m.weightKg > 0 &&
      typeof m.bodyFatPct === "number"
    ) {
      leanMass = m.weightKg * (1 - m.bodyFatPct / 100);
      source = "bodyFatMeasurement";
      bodyFatPctUsed = m.bodyFatPct;
    } else if (
      bodyFatResult.ok &&
      typeof bodyFatResult.leanMassKg === "number"
    ) {
      leanMass = bodyFatResult.leanMassKg;
      source = "bodyFatEstimate";
      bodyFatPctUsed = bodyFatResult.bodyFatPct;
    } else if (
      typeof m.weightKg === "number" &&
      m.weightKg > 0 &&
      bodyFatResult.ok
    ) {
      leanMass = m.weightKg * (1 - bodyFatResult.bodyFatPct / 100);
      source = "bodyFatEstimate";
      bodyFatPctUsed = bodyFatResult.bodyFatPct;
    }

    if (!leanMass || Number.isNaN(leanMass) || leanMass <= 0) {
      return { ok: false, reason: "leanMass" };
    }

    const leanMassKg = Number(leanMass.toFixed(2));
    const ffmi = Number((leanMassKg / (heightM * heightM)).toFixed(2));
    const ffmiAdjusted = Number((ffmi + 6 * (1.8 - heightM)).toFixed(2));

    return {
      ok: true,
      ffmi,
      ffmiAdjusted,
      heightCm,
      heightM: Number(heightM.toFixed(3)),
      leanMassKg,
      source: source ?? "recorded",
      bodyFatPctUsed:
        typeof bodyFatPctUsed === "number"
          ? Number(bodyFatPctUsed.toFixed(2))
          : undefined,
    };
  }, [bodyFatResult, m.bodyFatPct, m.heightCm, m.leanMassKg, m.weightKg]);

  const save = async () => {
    await db.put("measurements", m);
    // refresh list
    const list = await db.getAll<Measurement>("measurements");
    const sorted = [...list].sort((a, b) => b.dateISO.localeCompare(a.dateISO));
    setData(sorted);
    // if we just saved today's entry keep editing it; provide add another option
    const today = new Date().toISOString().slice(0, 10);
    const todayEntry = sorted.find((r) => r.dateISO.slice(0, 10) === today);
    if (todayEntry) setM(todayEntry);
    else
      setM({
        id: nanoid(),
        dateISO: new Date().toISOString(),
        heightCm:
          typeof m.heightCm === "number" && !Number.isNaN(m.heightCm)
            ? m.heightCm
            : sorted[0]?.heightCm,
      });
  };

  // Import Evolt 360 PDF/Text
  const onChooseEvolt = () => fileRef.current?.click();
  const handleEvoltFile = async (file: File) => {
    try {
      const isTxt = /\.txt$/i.test(file.name);
      let text = "";
      if (isTxt) {
        text = await file.text();
      } else if (/\.pdf$/i.test(file.name)) {
        const buf = await file.arrayBuffer();
        // Use pdf.js to extract text content robustly
        text = await extractTextFromPdf(buf);
      } else {
        push({ message: "Unsupported file. Upload .pdf or .txt" });
        return;
      }
      const {
        measurement: parsed,
        found,
        warnings,
        scanDateISO,
      } = parseEvoltTextToMeasurement(text || "");
      if (!found.length) {
        push({ message: warnings[0] || "No recognizable Evolt fields found." });
        return;
      }
      // Show preview modal to confirm before saving
      setPreview({ parsed, found, warnings, fileName: file.name, scanDateISO });
    } catch (e) {
      console.warn("Evolt import failed", e);
      push({ message: "Import failed" });
    }
  };

  const confirmEvoltImport = async () => {
    if (!preview) return;
    const { parsed, found, scanDateISO } = preview;
    const stamp = scanDateISO || new Date().toISOString();
    const targetDay = stamp.slice(0, 10);
    const existing = data.find((r) => r.dateISO.slice(0, 10) === targetDay);
    const base: Measurement = existing
      ? { ...existing }
      : ({ id: nanoid(), dateISO: stamp } as Measurement);
    const merged: Measurement = { ...base, ...parsed } as Measurement;
    await db.put("measurements", merged);
    const list = await db.getAll<Measurement>("measurements");
    const sorted = [...list].sort((a, b) => b.dateISO.localeCompare(a.dateISO));
    setData(sorted);
    setM(merged);
    setPreview(null);
    push({ message: `Imported Evolt: ${found.join(", ")}` });
  };

  const remove = async (id: string) => {
    const cfg = await getSettings();
    if (
      cfg.confirmDestructive &&
      !window.confirm("Delete this measurement entry?")
    )
      return;
    const prev = data;
    await db.delete("measurements", id);
    setData(data.filter((x) => x.id !== id));
    push({
      message: "Measurement deleted",
      actionLabel: "Undo",
      onAction: async () => {
        for (const it of prev) await db.put("measurements", it);
        setData(prev);
      },
    });
  };

  const update = async (id: string, patch: Partial<Measurement>) => {
    const next = data.map((x) => (x.id === id ? { ...x, ...patch } : x));
    setData(next);
    const target = next.find((x) => x.id === id)!;
    await db.put("measurements", target);
  };

  const [overlayKeys, setOverlayKeys] = useState<(keyof Measurement)[]>([
    "weightKg",
    "waist",
  ]);
  const [smoothing, setSmoothing] = useState(false);
  useEffect(() => {
    (async () => {
      const s = await getSettings();
      setSmoothing(!!s.ui?.smoothingDefault);
    })();
  }, []);
  const toggleOverlay = (k: keyof Measurement) => {
    setOverlayKeys((prev) =>
      prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]
    );
  };
  const series = (key: keyof Measurement) =>
    data
      .filter((x) => x[key] != null)
      .map((x) => {
        const iso = x.dateISO || new Date().toISOString();
        const timestamp = new Date(iso).getTime();
        return {
          date: iso,
          value: Number((x as any)[key]),
          ts: Number.isNaN(timestamp) ? 0 : timestamp,
        };
      })
      .sort((a, b) => a.ts - b.ts);

  const weightSeries = series("weightKg");
  // 7-day rolling average for weight
  const weight7 = useMemo(() => {
    const out: any[] = [];
    for (let i = 0; i < weightSeries.length; i++) {
      const slice = weightSeries.slice(Math.max(0, i - 6), i + 1);
      const avg =
        slice.reduce((acc, cur) => acc + (cur.value || 0), 0) / slice.length;
      out.push({ ...weightSeries[i], avg });
    }
    return out;
  }, [weightSeries]);
  // Linear regression (least squares) for weight
  const weightTrend = useMemo(() => {
    if (weightSeries.length < 2) return [] as any[];
    const xs = weightSeries.map((p) => p.ts);
    const ys = weightSeries.map((p) => p.value);
    const n = xs.length;
    const meanX = xs.reduce((a, b) => a + b, 0) / n;
    const meanY = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0,
      den = 0;
    for (let i = 0; i < n; i++) {
      num += (xs[i] - meanX) * (ys[i] - meanY);
      den += (xs[i] - meanX) ** 2;
    }
    const slope = den === 0 ? 0 : num / den;
    const intercept = meanY - slope * meanX;
    return weightSeries.map((p) => ({
      date: p.date,
      value: slope * p.ts + intercept,
    }));
  }, [weightSeries]);

  const [RC, setRC] = useState<any | null>(null);
  useEffect(() => {
    loadRecharts().then((m) => setRC(m));
  }, []);

  // Lightweight moving average smoothing (window = 3)
  const movingAvg = (arr: { date: string; value: number }[], win = 3) => {
    if (!arr.length) return [] as any[];
    return arr.map((p, i) => {
      const slice = arr.slice(Math.max(0, i - (win - 1)), i + 1);
      const avg = slice.reduce((a, b) => a + (b.value || 0), 0) / slice.length;
      return { ...p, avg };
    });
  };

  const overlaySeries = useMemo(() => {
    const out: Record<string, { raw: any[]; avg: any[] }> = {};
    overlayKeys.forEach((k) => {
      const s = series(k);
      out[k as string] = { raw: s, avg: movingAvg(s) };
    });
    return out;
  }, [overlayKeys, data]);

  const primaryKey = (overlayKeys[0] || "weightKg") as keyof Measurement;
  const primarySeries = useMemo(() => {
    const current = overlaySeries[primaryKey as string]?.raw;
    if (current && current.length) return current;
    if (primaryKey !== "weightKg" && weightSeries.length) return weightSeries;
    return weightSeries;
  }, [overlaySeries, primaryKey, weightSeries]);

  const chartSeries = primarySeries.length ? primarySeries : weightSeries;
  const xTickValues = useMemo(
    () => buildTickValues(chartSeries),
    [chartSeries]
  );
  const primaryOverlayData = overlaySeries[primaryKey as string];
  const areaSource = useMemo(() => {
    const candidate = smoothing
      ? primaryOverlayData?.avg
      : primaryOverlayData?.raw;
    const dataset = candidate?.length ? candidate : chartSeries;
    const hasAvg = Boolean(
      smoothing &&
        candidate?.some((point: any) => typeof point.avg === "number")
    );
    return {
      data: dataset,
      key: hasAvg ? "avg" : "value",
    };
  }, [chartSeries, primaryOverlayData, smoothing]);

  const overlayRef = useRef<HTMLDivElement | null>(null);
  const pointerActiveRef = useRef(false);
  const [scrub, setScrub] = useState<{
    date: string;
    label: string;
    payload: any[];
    cursorX: number;
  } | null>(null);

  const computePayloadForDate = useCallback(
    (dateISO: string, basePoint: { value: number }) => {
      const payload: any[] = [];
      overlayKeys.forEach((key, idx) => {
        const sObj = overlaySeries[key as string];
        if (!sObj) return;
        const dataset = smoothing ? sObj.avg : sObj.raw;
        const entry = dataset?.find((p: any) => p.date === dateISO);
        if (!entry) return;
        const color = OVERLAY_COLORS[idx % OVERLAY_COLORS.length];
        payload.push({
          name: formatMeasurementLabel(key as string),
          value: smoothing ? entry.avg : entry.value,
          color,
          stroke: color,
          dataKey: key,
        });
      });
      if (!payload.length && basePoint) {
        payload.push({
          name: formatMeasurementLabel(primaryKey as string),
          value: basePoint.value,
          color: OVERLAY_COLORS[0],
          stroke: OVERLAY_COLORS[0],
          dataKey: primaryKey,
        });
      }
      if (overlayKeys.includes("weightKg")) {
        const avgPoint = weight7.find((p) => p.date === dateISO);
        if (avgPoint) {
          payload.push({
            name: "7d avg",
            value: avgPoint.avg,
            color: "rgba(59,130,246,0.9)",
            stroke: "rgba(59,130,246,0.9)",
            dataKey: "weight7",
          });
        }
        const trendPoint = weightTrend.find((p) => p.date === dateISO);
        if (trendPoint) {
          payload.push({
            name: "Trend",
            value: trendPoint.value,
            color: "rgba(96,165,250,0.85)",
            stroke: "rgba(96,165,250,0.85)",
            dataKey: "weightTrend",
          });
        }
      }
      return payload;
    },
    [overlayKeys, overlaySeries, primaryKey, smoothing, weight7, weightTrend]
  );

  const updateScrubFromClientX = useCallback(
    (clientX: number) => {
      const rect = overlayRef.current?.getBoundingClientRect();
      if (!rect || !chartSeries.length) return;
      const relative = clientX - rect.left;
      const clamped = Math.min(Math.max(relative, 0), rect.width);
      const ratio = rect.width === 0 ? 0 : clamped / rect.width;
      const idx = Math.min(
        chartSeries.length - 1,
        Math.max(0, Math.round(ratio * (chartSeries.length - 1)))
      );
      const point = chartSeries[idx];
      if (!point) return;
      const payload = computePayloadForDate(point.date, point);
      setScrub({
        date: point.date,
        label: point.date,
        payload,
        cursorX: Math.min(Math.max(clamped, 12), Math.max(rect.width - 12, 12)),
      });
    },
    [chartSeries, computePayloadForDate]
  );

  const handlePointerDown = useCallback(
    (ev: PointerEvent<HTMLDivElement>) => {
      if (!chartSeries.length) return;
      pointerActiveRef.current = true;
      ev.currentTarget.setPointerCapture(ev.pointerId);
      if (ev.pointerType === "touch") ev.preventDefault();
      updateScrubFromClientX(ev.clientX);
    },
    [chartSeries.length, updateScrubFromClientX]
  );

  const handlePointerMove = useCallback(
    (ev: PointerEvent<HTMLDivElement>) => {
      if (ev.pointerType === "mouse" && ev.buttons === 0) {
        updateScrubFromClientX(ev.clientX);
        return;
      }
      if (!pointerActiveRef.current) return;
      updateScrubFromClientX(ev.clientX);
    },
    [updateScrubFromClientX]
  );

  const handlePointerUp = useCallback((ev: PointerEvent<HTMLDivElement>) => {
    if (!pointerActiveRef.current) return;
    pointerActiveRef.current = false;
    if (ev.currentTarget.hasPointerCapture(ev.pointerId)) {
      ev.currentTarget.releasePointerCapture(ev.pointerId);
    }
  }, []);

  const handlePointerLeave = useCallback(() => {
    if (pointerActiveRef.current) return;
    setScrub(null);
  }, []);

  // Provide previous point lookup for UnifiedTooltip
  const prevLookup = (seriesName: string, label: any) => {
    const src =
      overlaySeries[seriesName]?.[smoothing ? "avg" : "raw"] || weightSeries;
    const idx = src.findIndex((r: any) => r.date === label);
    if (idx > 0) {
      const prev = src[idx - 1];
      return prev?.avg ?? prev?.value;
    }
    return undefined;
  };

  const adjustCurrentCaliper = (key: SkinfoldKey, delta: number) => {
    setM((prev) => {
      const currentRaw = (prev as any)[key];
      const current = typeof currentRaw === "number" ? currentRaw : 0;
      const next = Math.max(0, Number((current + delta).toFixed(1)));
      return { ...prev, [key]: next } as Measurement;
    });
  };

  const setCurrentCaliper = (key: SkinfoldKey, value: number | undefined) => {
    setM((prev) => ({ ...prev, [key]: value } as Measurement));
  };

  const leanMassDisplay = ffmiResult.ok
    ? ffmiResult.leanMassKg
    : typeof m.leanMassKg === "number" && m.leanMassKg > 0
    ? Number(m.leanMassKg.toFixed(2))
    : bodyFatResult.ok && typeof bodyFatResult.leanMassKg === "number"
    ? Number(bodyFatResult.leanMassKg.toFixed(2))
    : typeof m.weightKg === "number" &&
      typeof m.bodyFatPct === "number" &&
      m.weightKg > 0
    ? Number((m.weightKg * (1 - m.bodyFatPct / 100)).toFixed(2))
    : undefined;

  const leanMassSourceLabel = (() => {
    if (ffmiResult.ok) {
      if (ffmiResult.source === "recorded") return "Recorded lean mass";
      if (ffmiResult.source === "bodyFatMeasurement")
        return "Weight × recorded body fat";
      return "Weight × current body-fat estimate";
    }
    if (typeof m.leanMassKg === "number" && m.leanMassKg > 0)
      return "Recorded lean mass";
    if (typeof m.weightKg === "number" && typeof m.bodyFatPct === "number")
      return "Weight × recorded body fat";
    if (bodyFatResult.ok && typeof bodyFatResult.leanMassKg === "number")
      return "Body-fat estimate";
    return null;
  })();

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Measurements</h2>
      <div className="bg-card rounded-2xl p-4 shadow-soft space-y-3 fade-in">
        {/* Hidden file input for Evolt import */}
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.txt"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleEvoltFile(f);
            e.currentTarget.value = "";
          }}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            "weightKg",
            "heightCm",
            "neck",
            "chest",
            "waist",
            "hips",
            "thigh",
            "calf",
            "upperArm",
            "forearm",
          ].map((k) => {
            const label = formatMeasurementLabel(k);
            const unit = getUnitForKey(k);
            return (
              <label key={k} className="space-y-1">
                <div className="flex items-center justify-between text-sm text-gray-300">
                  <span>{label}</span>
                  {unit && (
                    <span className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
                      {unit}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="bg-slate-700 rounded px-3 py-2"
                    onClick={() =>
                      setM((prev) => ({
                        ...prev,
                        [k]: Math.max(0, Number((prev as any)[k] || 0) - 0.5),
                      }))
                    }
                  >
                    -
                  </button>
                  <input
                    inputMode="decimal"
                    className="w-full input-number-enhanced"
                    value={(m as any)[k] ?? ""}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setM((prev) => ({
                          ...prev,
                          [k]: Number((prev as any)[k] || 0) + 0.5,
                        }));
                      } else if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setM((prev) => ({
                          ...prev,
                          [k]: Math.max(0, Number((prev as any)[k] || 0) - 0.5),
                        }));
                      }
                    }}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!/^\d*(?:\.\d*)?$/.test(v)) return;
                      setM({ ...m, [k]: v === "" ? undefined : Number(v) });
                    }}
                    placeholder={unit}
                  />
                  <button
                    className="bg-slate-700 rounded px-3 py-2"
                    onClick={() =>
                      setM((prev) => ({
                        ...prev,
                        [k]: Number((prev as any)[k] || 0) + 0.5,
                      }))
                    }
                  >
                    +
                  </button>
                </div>
                {TIPS[k] && <p className="text-xs text-gray-400">{TIPS[k]}</p>}
              </label>
            );
          })}
        </div>
        <div className="pt-3 border-t border-white/5 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                Skinfold calipers
              </h3>
              <p className="text-xs text-slate-400/80">
                Enter skinfold thickness in millimetres to enable the body-fat
                calculator.
              </p>
            </div>
            <div className="text-[11px] text-slate-400/80 whitespace-nowrap">
              {caliperSummary.count > 0 ? (
                <span>
                  {caliperSummary.count} site
                  {caliperSummary.count === 1 ? "" : "s"}
                  {caliperSummary.sum > 0
                    ? ` • Σ ${caliperSummary.sum.toFixed(1)} mm`
                    : ""}
                </span>
              ) : (
                <span>No calipers logged yet</span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {SKINFOLD_SITES.map((site) => {
              const value = (m as any)[site.key] as number | undefined;
              return (
                <label key={site.key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm text-gray-200">
                    <span>{site.label}</span>
                    <span className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
                      mm
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="bg-slate-700 rounded px-2.5 py-1.5 text-sm"
                      onClick={() => adjustCurrentCaliper(site.key, -0.5)}
                    >
                      -
                    </button>
                    <input
                      inputMode="decimal"
                      className="w-full input-number-enhanced"
                      value={value ?? ""}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowUp") {
                          e.preventDefault();
                          adjustCurrentCaliper(site.key, 0.5);
                        } else if (e.key === "ArrowDown") {
                          e.preventDefault();
                          adjustCurrentCaliper(site.key, -0.5);
                        }
                      }}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!/^\d*(?:\.\d*)?$/.test(v)) return;
                        const next = v === "" ? undefined : Number(v);
                        setCurrentCaliper(site.key, next);
                      }}
                      placeholder="mm"
                    />
                    <button
                      type="button"
                      className="bg-slate-700 rounded px-2.5 py-1.5 text-sm"
                      onClick={() => adjustCurrentCaliper(site.key, 0.5)}
                    >
                      +
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 leading-snug">
                    {site.description}
                  </p>
                </label>
              );
            })}
          </div>
          <details className="group rounded-2xl border border-white/10 bg-slate-900/40 px-4 py-3 text-sm text-slate-200">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.28em] text-white/60 group-open:text-white">
              Caliper measuring guide
            </summary>
            <div className="mt-3 space-y-3">
              <ul className="list-disc space-y-1 pl-4 text-xs text-slate-300/90">
                {SKINFOLD_GENERAL_TIPS.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SKINFOLD_SITES.map((site) => (
                  <div
                    key={site.key}
                    className="rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2"
                  >
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
                      {site.label}
                    </div>
                    <p className="mt-1 text-[11px] leading-5 text-slate-300/90">
                      {site.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </details>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="w-full sm:w-auto bg-brand-600 hover:bg-brand-700 px-3 py-3 rounded-xl"
            onClick={save}
          >
            Save
          </button>
          <button
            className="w-full sm:w-auto bg-indigo-700 hover:bg-indigo-600 px-3 py-3 rounded-xl"
            onClick={onChooseEvolt}
            title="Import Evolt 360 PDF or exported .txt"
          >
            Import Evolt 360
          </button>
          <button
            className="w-full sm:w-auto bg-slate-700 hover:bg-slate-600 px-3 py-3 rounded-xl"
            onClick={() =>
              setM({
                id: nanoid(),
                dateISO: new Date().toISOString(),
                heightCm:
                  typeof m.heightCm === "number" && !Number.isNaN(m.heightCm)
                    ? m.heightCm
                    : undefined,
              })
            }
          >
            Add another
          </button>
          <MeasurementsInfoModal />
        </div>
      </div>

      <div className="bg-card rounded-2xl p-4 shadow-soft space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">
              Body fat estimator
            </h3>
            <p className="text-sm text-slate-300/80">
              Jackson & Pollock formulas using your recorded skinfold sites.
            </p>
          </div>
          <div className="text-xs text-slate-400">
            Current entry:{" "}
            {typeof m.bodyFatPct === "number"
              ? `${m.bodyFatPct.toFixed(1)}%`
              : "—"}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="space-y-1 text-sm text-slate-200">
            <span className="block text-xs uppercase tracking-[0.28em] text-slate-400">
              Sex
            </span>
            <select
              className="input-number-enhanced bg-slate-900/70"
              value={bodyFatPrefs.sex}
              onChange={(e) =>
                setBodyFatPrefs((prev) => ({
                  ...prev,
                  sex: e.target.value === "female" ? "female" : "male",
                }))
              }
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </label>
          <label className="space-y-1 text-sm text-slate-200">
            <span className="block text-xs uppercase tracking-[0.28em] text-slate-400">
              Age
            </span>
            <input
              className="input-number-enhanced"
              inputMode="numeric"
              value={bodyFatPrefs.age ? String(bodyFatPrefs.age) : ""}
              onChange={(e) => {
                const raw = e.target.value;
                const next = raw === "" ? 0 : Number(raw);
                if (raw !== "" && (!/^\d+$/.test(raw) || Number.isNaN(next)))
                  return;
                setBodyFatPrefs((prev) => ({ ...prev, age: next }));
              }}
              placeholder="years"
            />
          </label>
          <div className="space-y-1 text-sm text-slate-200">
            <span className="block text-xs uppercase tracking-[0.28em] text-slate-400">
              Caliper summary
            </span>
            <div className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
              {caliperSummary.count > 0 ? (
                <div>
                  <div>
                    {caliperSummary.count} site
                    {caliperSummary.count === 1 ? "" : "s"} logged
                  </div>
                  <div className="text-[11px] text-emerald-300">
                    Σ {caliperSummary.sum.toFixed(1)} mm
                  </div>
                </div>
              ) : (
                <div>No skinfold data yet.</div>
              )}
            </div>
          </div>
        </div>
        {bodyFatResult.ok ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2">
              <div className="text-xs uppercase tracking-[0.24em] text-emerald-200">
                Estimated body fat
              </div>
              <div className="text-2xl font-semibold text-emerald-100">
                {bodyFatResult.bodyFatPct.toFixed(2)}%
              </div>
              <div className="text-[11px] text-emerald-200/70">
                {bodyFatResult.method}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 space-y-1 text-xs text-slate-300">
              <div>Sum of sites: {bodyFatResult.sum.toFixed(1)} mm</div>
              <div>Density: {bodyFatResult.density.toFixed(4)} g/cm³</div>
              <div>
                Used sites:{" "}
                {bodyFatResult.usedSites
                  .map(
                    (key) =>
                      SKINFOLD_SITES.find((s) => s.key === key)?.label || key
                  )
                  .join(", ")}
              </div>
            </div>
            {typeof bodyFatResult.leanMassKg === "number" && (
              <div className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
                  Lean mass
                </div>
                <div className="text-lg font-semibold text-slate-100">
                  {bodyFatResult.leanMassKg.toFixed(2)} kg
                </div>
              </div>
            )}
            {typeof bodyFatResult.fatMassKg === "number" && (
              <div className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
                  Fat mass
                </div>
                <div className="text-lg font-semibold text-slate-100">
                  {bodyFatResult.fatMassKg.toFixed(2)} kg
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            {bodyFatResult.reason === "age"
              ? "Enter your age to calculate body fat percentage."
              : bodyFatResult.missingSites?.length
              ? `Add measurements for: ${bodyFatResult.missingSites
                  .map(
                    (key) =>
                      SKINFOLD_SITES.find((s) => s.key === key)?.label || key
                  )
                  .join(", ")}`
              : "Add a few skinfold measurements to unlock the calculator."}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="bg-brand-600 hover:bg-brand-700 px-3 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!bodyFatResult.ok}
            onClick={() => {
              if (!bodyFatResult.ok) return;
              setM((prev) => ({
                ...prev,
                bodyFatPct: Number(bodyFatResult.bodyFatPct.toFixed(2)),
                leanMassKg:
                  typeof bodyFatResult.leanMassKg === "number"
                    ? Number(bodyFatResult.leanMassKg.toFixed(2))
                    : prev.leanMassKg,
                fatMassKg:
                  typeof bodyFatResult.fatMassKg === "number"
                    ? Number(bodyFatResult.fatMassKg.toFixed(2))
                    : prev.fatMassKg,
                bodyDensity: Number(bodyFatResult.density.toFixed(4)),
              }));
              push({
                message: "Body fat estimate applied to current measurement.",
              });
            }}
          >
            Apply estimate to measurement
          </button>
          <span className="text-[11px] text-slate-400">
            Save to persist the updated entry.
          </span>
        </div>
      </div>

      <div className="bg-card rounded-2xl p-4 shadow-soft space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">
              FFMI calculator
            </h3>
            <p className="text-sm text-slate-300/80">
              Uses height and lean mass to estimate your fat-free mass index.
            </p>
          </div>
          <div className="text-xs text-slate-400">
            Current entry:{" "}
            {typeof m.ffmi === "number"
              ? `${m.ffmi.toFixed(2)}${
                  typeof m.ffmiAdjusted === "number"
                    ? ` (${m.ffmiAdjusted.toFixed(2)} adj)`
                    : ""
                }`
              : "—"}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
            <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
              Height
            </div>
            <div className="text-lg font-semibold text-slate-100">
              {typeof m.heightCm === "number"
                ? `${m.heightCm.toFixed(1)} cm`
                : "—"}
            </div>
            {typeof m.heightCm === "number" && (
              <div className="text-[11px] text-slate-400/80">
                {(m.heightCm / 100).toFixed(2)} m
              </div>
            )}
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
            <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
              Lean mass
            </div>
            <div className="text-lg font-semibold text-slate-100">
              {typeof leanMassDisplay === "number"
                ? `${leanMassDisplay.toFixed(2)} kg`
                : "—"}
            </div>
            {leanMassSourceLabel && (
              <div className="text-[11px] text-slate-400/80">
                {leanMassSourceLabel}
              </div>
            )}
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
            <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
              Weight
            </div>
            <div className="text-lg font-semibold text-slate-100">
              {typeof m.weightKg === "number"
                ? `${m.weightKg.toFixed(2)} kg`
                : "—"}
            </div>
            {typeof m.bodyFatPct === "number" && (
              <div className="text-[11px] text-slate-400/80">
                Body fat: {m.bodyFatPct.toFixed(1)}%
              </div>
            )}
          </div>
        </div>
        {ffmiResult.ok ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-sky-400/30 bg-sky-500/10 px-3 py-2">
              <div className="text-xs uppercase tracking-[0.24em] text-sky-200">
                FFMI
              </div>
              <div className="text-2xl font-semibold text-sky-100">
                {ffmiResult.ffmi.toFixed(2)}
              </div>
              <div className="text-[11px] text-sky-200/70">
                Lean mass ÷ height²
              </div>
            </div>
            <div className="rounded-xl border border-sky-400/30 bg-sky-500/10 px-3 py-2">
              <div className="text-xs uppercase tracking-[0.24em] text-sky-200">
                Adjusted FFMI
              </div>
              <div className="text-2xl font-semibold text-sky-100">
                {ffmiResult.ffmiAdjusted.toFixed(2)}
              </div>
              <div className="text-[11px] text-sky-200/70">
                Normalized to 1.80 m
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-slate-300 space-y-1">
              <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
                Inputs used
              </div>
              <div>Height: {ffmiResult.heightCm.toFixed(1)} cm</div>
              <div>Lean mass: {ffmiResult.leanMassKg.toFixed(2)} kg</div>
              {typeof ffmiResult.bodyFatPctUsed === "number" && (
                <div>Body fat ref: {ffmiResult.bodyFatPctUsed.toFixed(1)}%</div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            {ffmiResult.reason === "height"
              ? "Add your height measurement to calculate FFMI."
              : "Provide lean mass (or weight with body-fat data) to compute FFMI."}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="bg-sky-600 hover:bg-sky-700 px-3 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!ffmiResult.ok}
            onClick={() => {
              if (!ffmiResult.ok) return;
              setM((prev) => ({
                ...prev,
                ffmi: ffmiResult.ffmi,
                ffmiAdjusted: ffmiResult.ffmiAdjusted,
                leanMassKg: ffmiResult.leanMassKg,
              }));
              push({
                message: "FFMI calculated and applied to the measurement.",
              });
            }}
          >
            Apply FFMI to measurement
          </button>
          <span className="text-[11px] text-slate-400">
            Save to persist the updated entry.
          </span>
        </div>
      </div>

      <div className="bg-card rounded-2xl p-4 shadow-soft space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="uppercase tracking-wide text-gray-400">
            Overlays:
          </span>
          {[
            "weightKg",
            "waist",
            "chest",
            "hips",
            "upperArm",
            "bodyFatPct",
            "leanMassKg",
            "fatMassKg",
            "ffmi",
            "ffmiAdjusted",
          ].map((k) => (
            <button
              key={k}
              onClick={() => toggleOverlay(k as keyof Measurement)}
              className={`px-3 py-2 min-h-[36px] text-sm rounded-lg border ${
                overlayKeys.includes(k as any)
                  ? "bg-emerald-600 border-emerald-500"
                  : "bg-white/5 border-white/10"
              }`}
            >
              {formatMeasurementLabel(k)}
            </button>
          ))}
          <button
            onClick={async () => {
              setSmoothing((s) => {
                const next = !s;
                (async () => {
                  const st = await getSettings();
                  await setSettings({
                    ...st,
                    ui: { ...(st.ui || {}), smoothingDefault: next },
                  });
                })();
                return next;
              });
            }}
            className={`px-3 py-2 min-h-[36px] text-sm rounded-lg border ${
              smoothing
                ? "bg-indigo-600 border-indigo-500"
                : "bg-white/5 border-white/10"
            }`}
          >
            {smoothing ? "Smoothing On" : "Smoothing Off"}
          </button>
          <span className="ml-auto text-[10px] text-gray-500 hidden sm:inline">
            Tooltip shows Δ vs prev day • Toggle smoothing for rolling avg (w=3)
          </span>
        </div>
        <div className="h-72">
          {!RC && (
            <div className="h-full flex items-center justify-center text-xs text-gray-500">
              Loading…
            </div>
          )}
          {RC && (
            <div className="relative h-full">
              <div className="relative h-full rounded-2xl border border-white/10 bg-slate-950/30">
                <RC.ResponsiveContainer width="100%" height="100%">
                  <RC.ComposedChart
                    data={areaSource.data}
                    margin={{ left: 8, right: 16, top: 10, bottom: 0 }}
                  >
                    <RC.CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(148,163,184,0.15)"
                    />
                    <RC.XAxis
                      dataKey="date"
                      stroke="rgba(226,232,240,0.65)"
                      tick={{ fill: "rgba(226,232,240,0.85)", fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={12}
                      interval={0}
                      ticks={xTickValues}
                      tickFormatter={formatChartDateTick}
                    />
                    <RC.YAxis
                      stroke="rgba(226,232,240,0.65)"
                      tick={{ fill: "rgba(226,232,240,0.85)", fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      width={48}
                    />
                    <RC.Tooltip
                      active={!!scrub && !!scrub.payload.length}
                      payload={scrub?.payload || []}
                      label={scrub?.label}
                      position={scrub ? { x: scrub.cursorX, y: 32 } : undefined}
                      wrapperStyle={{ outline: "none", borderRadius: 12 }}
                      cursor={false}
                      content={
                        <UnifiedTooltip
                          labelFormatter={formatChartTooltipLabel}
                          context={{ previousPointLookup: prevLookup }}
                        />
                      }
                    />
                    {areaSource.data.length > 0 && (
                      <RC.Area
                        type="monotone"
                        dataKey={areaSource.key}
                        stroke="rgba(248,113,113,0.9)"
                        fill="rgba(248,113,113,0.2)"
                        strokeWidth={2.4}
                        dot={false}
                        name={formatMeasurementLabel(primaryKey as string)}
                        isAnimationActive={false}
                      />
                    )}
                    {scrub && (
                      <RC.ReferenceLine
                        x={scrub.date}
                        stroke="rgba(148,163,184,0.3)"
                        strokeDasharray="3 3"
                      />
                    )}
                    {overlayKeys.map((k, i) => {
                      const sObj = overlaySeries[k as string];
                      const lineData = smoothing ? sObj?.avg : sObj?.raw;
                      const strokeColor =
                        OVERLAY_COLORS[i % OVERLAY_COLORS.length];
                      if (!lineData) return null;
                      return (
                        <RC.Line
                          key={k}
                          type="monotone"
                          name={formatMeasurementLabel(k as string)}
                          data={lineData}
                          dataKey={smoothing ? "avg" : "value"}
                          stroke={strokeColor}
                          strokeWidth={2.4}
                          dot={false}
                        />
                      );
                    })}
                    {overlayKeys.includes("weightKg") && (
                      <>
                        <RC.Line
                          type="monotone"
                          name="7d avg"
                          data={weight7}
                          dataKey="avg"
                          stroke="rgba(59,130,246,0.9)"
                          strokeDasharray="5 4"
                          strokeWidth={2.2}
                          dot={false}
                        />
                        {weightTrend.length > 0 && (
                          <RC.Line
                            type="monotone"
                            name="Trend"
                            data={weightTrend}
                            dataKey="value"
                            stroke="rgba(96,165,250,0.85)"
                            strokeDasharray="6 5"
                            strokeWidth={2}
                            dot={false}
                          />
                        )}
                      </>
                    )}
                    {scrub &&
                      overlayKeys.map((k, i) => {
                        const sObj = overlaySeries[k as string];
                        if (!sObj) return null;
                        const dataset = smoothing ? sObj.avg : sObj.raw;
                        const entry = dataset?.find(
                          (p: any) => p.date === scrub.date
                        );
                        if (!entry) return null;
                        const value = smoothing ? entry.avg : entry.value;
                        if (value == null) return null;
                        return (
                          <RC.ReferenceDot
                            key={`dot-${k}`}
                            x={scrub.date}
                            y={value}
                            r={4.5}
                            fill={OVERLAY_COLORS[i % OVERLAY_COLORS.length]}
                            stroke="rgba(15,23,42,0.85)"
                            strokeWidth={1.5}
                          />
                        );
                      })}
                  </RC.ComposedChart>
                </RC.ResponsiveContainer>
                <div
                  ref={overlayRef}
                  className={`absolute inset-0 z-10 ${
                    chartSeries.length
                      ? "cursor-crosshair"
                      : "pointer-events-none"
                  }`}
                  style={{ touchAction: chartSeries.length ? "pan-y" : "auto" }}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerLeave}
                  onPointerCancel={handlePointerUp}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setPreview(null)}
          />
          <div className="relative bg-slate-900 rounded-2xl shadow-xl w-[90vw] max-w-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">Import preview</div>
              <button
                className="text-xs text-gray-400"
                onClick={() => setPreview(null)}
              >
                Close
              </button>
            </div>
            <div className="text-xs text-gray-400">
              File: {preview.fileName}
              {preview.scanDateISO
                ? ` • Scan date: ${preview.scanDateISO.slice(0, 10)}`
                : ""}
            </div>
            <div className="max-h-72 overflow-auto bg-slate-800/60 rounded-xl p-3">
              <table className="w-full text-sm">
                <tbody>
                  {Object.entries(preview.parsed).map(([k, v]) => (
                    <tr key={k} className="border-b border-white/5">
                      <td className="py-1 pr-2 text-gray-300 capitalize">
                        {k}
                      </td>
                      <td className="py-1 text-right">
                        {typeof v === "number" ? v.toFixed(2) : String(v)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!!preview.warnings.length && (
              <div className="text-xs text-amber-400">
                {preview.warnings.join(" • ")}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button
                className="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg"
                onClick={() => setPreview(null)}
              >
                Cancel
              </button>
              <button
                className="bg-brand-600 hover:bg-brand-700 px-3 py-2 rounded-lg"
                onClick={confirmEvoltImport}
              >
                Confirm import
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-card rounded-2xl p-4 shadow-soft">
        <div className="font-medium mb-2">Entries</div>
        {!data.length && (
          <div className="text-xs text-muted py-6 text-center">
            No measurements yet. Track your first bodyweight to begin a trend.
          </div>
        )}
        <div className="space-y-2">
          {data.map((row) => {
            const rowCalipers = SKINFOLD_SITES.map((site) => ({
              site,
              value: (row as any)[site.key] as number | undefined,
            })).filter(
              (entry) =>
                typeof entry.value === "number" && !Number.isNaN(entry.value)
            ) as Array<{
              site: (typeof SKINFOLD_SITES)[number];
              value: number;
            }>;
            const rowCaliperSum = rowCalipers.reduce(
              (total, entry) => total + entry.value,
              0
            );
            const isCaliperOpen = !!caliperRowsOpen[row.id];
            const isCollapsed = collapsedRows[row.id] ?? true;
            const formattedDate = row.dateISO.slice(0, 10);
            const summaryParts: string[] = [];
            if (typeof row.weightKg === "number" && !Number.isNaN(row.weightKg)) {
              summaryParts.push(`Weight ${row.weightKg.toFixed(1)} kg`);
            }
            if (
              typeof row.bodyFatPct === "number" &&
              !Number.isNaN(row.bodyFatPct)
            ) {
              summaryParts.push(`Body fat ${row.bodyFatPct.toFixed(1)}%`);
            }
            if (typeof row.waist === "number" && !Number.isNaN(row.waist)) {
              summaryParts.push(`Waist ${row.waist.toFixed(1)} cm`);
            }
            return (
              <div
                key={row.id}
                className={`bg-slate-800 rounded-xl px-3 py-3 space-y-3 transition-colors ${
                  isCollapsed ? "cursor-pointer hover:bg-slate-800/75" : ""
                }`}
                onClick={(event) => handleMeasurementSurfaceClick(event, row.id)}
                aria-expanded={!isCollapsed}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      className="text-xs bg-slate-700 hover:bg-slate-600 rounded px-2 py-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMeasurementCollapsed(row.id);
                      }}
                      aria-label={
                        isCollapsed ? "Expand measurement" : "Collapse measurement"
                      }
                    >
                      {isCollapsed ? "▶" : "▼"}
                    </button>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-100">
                        {formattedDate}
                      </div>
                      <div className="text-[11px] text-gray-400 truncate">
                        {summaryParts.length
                          ? summaryParts.join(" • ")
                          : "No metrics recorded"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {row.bodyFatPct != null && (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-200">
                        Body fat: {row.bodyFatPct.toFixed(1)}%
                      </span>
                    )}
                    {row.ffmi != null && (
                      <span className="rounded-full bg-sky-500/10 px-2 py-1 text-[11px] font-medium text-sky-200">
                        FFMI: {row.ffmi.toFixed(2)}
                        {row.ffmiAdjusted != null
                          ? ` (adj ${row.ffmiAdjusted.toFixed(2)})`
                          : ""}
                      </span>
                    )}
                    <button
                      className="text-xs bg-red-600 hover:bg-red-500 rounded px-3 py-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(row.id);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {!isCollapsed && (
                  <>
                    <div className="flex flex-wrap items-center justify-end gap-2 text-[11px] text-slate-300">
                      <button
                        className="text-xs bg-slate-700 hover:bg-slate-600 rounded px-3 py-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCaliperRowsOpen((prev) => ({
                            ...prev,
                            [row.id]: !prev[row.id],
                          }));
                        }}
                      >
                        {isCaliperOpen ? "Hide calipers" : "Calipers"}
                        {rowCalipers.length ? ` (${rowCalipers.length})` : ""}
                      </button>
                      {rowCalipers.length > 0 && !isCaliperOpen && (
                        <span className="text-slate-400">
                          Σ skinfolds: {rowCaliperSum.toFixed(1)} mm
                        </span>
                      )}
                    </div>
                    {/* Mobile stacked fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <div className="bg-slate-900/50 rounded-xl px-2 py-2">
                    <div className="text-[11px] text-gray-400 mb-1">Weight</div>
                    <div className="flex items-center gap-2">
                      <button
                        className="bg-slate-700 rounded px-3 py-2"
                        onClick={() =>
                          update(row.id, {
                            weightKg: Math.max(0, (row.weightKg || 0) - 0.5),
                          })
                        }
                      >
                        -
                      </button>
                      <input
                        className="input-number-enhanced w-full"
                        inputMode="decimal"
                        value={row.weightKg || ""}
                        onKeyDown={(e) => {
                          if (e.key === "ArrowUp") {
                            e.preventDefault();
                            update(row.id, {
                              weightKg: (row.weightKg || 0) + 0.5,
                            });
                          } else if (e.key === "ArrowDown") {
                            e.preventDefault();
                            update(row.id, {
                              weightKg: Math.max(0, (row.weightKg || 0) - 0.5),
                            });
                          }
                        }}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (!/^\d*(?:\.\d*)?$/.test(v)) return;
                          update(row.id, {
                            weightKg: v === "" ? undefined : Number(v),
                          });
                        }}
                        placeholder="kg"
                      />
                      <button
                        className="bg-slate-700 rounded px-3 py-2"
                        onClick={() =>
                          update(row.id, {
                            weightKg: (row.weightKg || 0) + 0.5,
                          })
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="bg-slate-900/50 rounded-xl px-2 py-2">
                    <div className="text-[11px] text-gray-400 mb-1">Height</div>
                    <div className="flex items-center gap-2">
                      <button
                        className="bg-slate-700 rounded px-3 py-2"
                        onClick={() =>
                          update(row.id, {
                            heightCm: Math.max(0, (row.heightCm || 0) - 0.5),
                          })
                        }
                      >
                        -
                      </button>
                      <input
                        className="input-number-enhanced w-full"
                        inputMode="decimal"
                        value={row.heightCm || ""}
                        onKeyDown={(e) => {
                          if (e.key === "ArrowUp") {
                            e.preventDefault();
                            update(row.id, {
                              heightCm: (row.heightCm || 0) + 0.5,
                            });
                          } else if (e.key === "ArrowDown") {
                            e.preventDefault();
                            update(row.id, {
                              heightCm: Math.max(0, (row.heightCm || 0) - 0.5),
                            });
                          }
                        }}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (!/^\d*(?:\.\d*)?$/.test(v)) return;
                          update(row.id, {
                            heightCm: v === "" ? undefined : Number(v),
                          });
                        }}
                        placeholder="cm"
                      />
                      <button
                        className="bg-slate-700 rounded px-3 py-2"
                        onClick={() =>
                          update(row.id, {
                            heightCm: (row.heightCm || 0) + 0.5,
                          })
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="bg-slate-900/50 rounded-xl px-2 py-2">
                    <div className="text-[11px] text-gray-400 mb-1">Waist</div>
                    <div className="flex items-center gap-2">
                      <button
                        className="bg-slate-700 rounded px-3 py-2"
                        onClick={() =>
                          update(row.id, {
                            waist: Math.max(0, (row.waist || 0) - 0.5),
                          })
                        }
                      >
                        -
                      </button>
                      <input
                        className="input-number-enhanced w-full"
                        inputMode="decimal"
                        value={row.waist || ""}
                        onKeyDown={(e) => {
                          if (e.key === "ArrowUp") {
                            e.preventDefault();
                            update(row.id, { waist: (row.waist || 0) + 0.5 });
                          } else if (e.key === "ArrowDown") {
                            e.preventDefault();
                            update(row.id, {
                              waist: Math.max(0, (row.waist || 0) - 0.5),
                            });
                          }
                        }}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (!/^\d*(?:\.\d*)?$/.test(v)) return;
                          update(row.id, {
                            waist: v === "" ? undefined : Number(v),
                          });
                        }}
                        placeholder="waist"
                      />
                      <button
                        className="bg-slate-700 rounded px-3 py-2"
                        onClick={() =>
                          update(row.id, { waist: (row.waist || 0) + 0.5 })
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="bg-slate-900/50 rounded-xl px-2 py-2">
                    <div className="text-[11px] text-gray-400 mb-1">
                      Upper Arm
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="bg-slate-700 rounded px-3 py-2"
                        onClick={() =>
                          update(row.id, {
                            upperArm: Math.max(0, (row.upperArm || 0) - 0.5),
                          })
                        }
                      >
                        -
                      </button>
                      <input
                        className="input-number-enhanced w-full"
                        inputMode="decimal"
                        value={row.upperArm || ""}
                        onKeyDown={(e) => {
                          if (e.key === "ArrowUp") {
                            e.preventDefault();
                            update(row.id, {
                              upperArm: (row.upperArm || 0) + 0.5,
                            });
                          } else if (e.key === "ArrowDown") {
                            e.preventDefault();
                            update(row.id, {
                              upperArm: Math.max(0, (row.upperArm || 0) - 0.5),
                            });
                          }
                        }}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (!/^\d*(?:\.\d*)?$/.test(v)) return;
                          update(row.id, {
                            upperArm: v === "" ? undefined : Number(v),
                          });
                        }}
                        placeholder="arm"
                      />
                      <button
                        className="bg-slate-700 rounded px-3 py-2"
                        onClick={() =>
                          update(row.id, {
                            upperArm: (row.upperArm || 0) + 0.5,
                          })
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
                    {rowCalipers.length > 0 && !isCaliperOpen && (
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                        <span>
                          Σ skinfolds: {rowCaliperSum.toFixed(1)} mm (
                          {rowCalipers.length} site
                          {rowCalipers.length === 1 ? "" : "s"})
                        </span>
                        {row.bodyFatPct != null && row.weightKg != null && (
                          <span>
                            Lean mass ≈{" "}
                            {(
                              row.weightKg * (1 - row.bodyFatPct / 100)
                            ).toFixed(2)}{" "}
                            kg
                          </span>
                        )}
                        {row.ffmi != null && (
                          <span>
                            FFMI {row.ffmi.toFixed(2)}
                            {row.ffmiAdjusted != null
                              ? ` (adj ${row.ffmiAdjusted.toFixed(2)})`
                              : ""}
                          </span>
                        )}
                      </div>
                    )}
                    {isCaliperOpen && (
                      <div className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-3 space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-slate-300">
                          <span>
                            Σ {rowCaliperSum.toFixed(1)} mm across{" "}
                            {rowCalipers.length} site
                            {rowCalipers.length === 1 ? "" : "s"}
                          </span>
                          <span className="text-slate-500">Values in mm</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {SKINFOLD_SITES.map((site) => {
                            const value = (row as any)[site.key] as
                              | number
                              | undefined;
                            return (
                              <label
                                key={site.key}
                                className="space-y-1 text-xs text-slate-200"
                              >
                                <div className="flex items-center justify-between text-[11px] text-gray-300">
                                  <span>{site.label}</span>
                                  <span className="uppercase tracking-[0.24em] text-slate-500">
                                    mm
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    className="bg-slate-800 rounded px-2 py-1"
                                    onClick={() =>
                                      update(row.id, {
                                        [site.key]: Math.max(
                                          0,
                                          Number(
                                            ((value ?? 0) - 0.5).toFixed(1)
                                          )
                                        ),
                                      } as Partial<Measurement>)
                                    }
                                  >
                                    -
                                  </button>
                                  <input
                                    className="input-number-enhanced w-full"
                                    inputMode="decimal"
                                    value={value ?? ""}
                                    onKeyDown={(e) => {
                                      if (e.key === "ArrowUp") {
                                        e.preventDefault();
                                        update(row.id, {
                                          [site.key]: Number(
                                            ((value ?? 0) + 0.5).toFixed(1)
                                          ),
                                        } as Partial<Measurement>);
                                      } else if (e.key === "ArrowDown") {
                                        e.preventDefault();
                                        update(row.id, {
                                          [site.key]: Math.max(
                                            0,
                                            Number(
                                              ((value ?? 0) - 0.5).toFixed(1)
                                            )
                                          ),
                                        } as Partial<Measurement>);
                                      }
                                    }}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      if (!/^\d*(?:\.\d*)?$/.test(v)) return;
                                      const patch: Partial<Measurement> = {
                                        [site.key]:
                                          v === "" ? undefined : Number(v),
                                      } as Partial<Measurement>;
                                      update(row.id, patch);
                                    }}
                                    placeholder="mm"
                                  />
                                  <button
                                    type="button"
                                    className="bg-slate-800 rounded px-2 py-1"
                                    onClick={() =>
                                      update(row.id, {
                                        [site.key]: Number(
                                          ((value ?? 0) + 0.5).toFixed(1)
                                        ),
                                      } as Partial<Measurement>)
                                    }
                                  >
                                    +
                                  </button>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Snackbar migrated to global snack queue */}
    </div>
  );
}

function ChartCard({
  title,
  data,
  color,
}: {
  title: string;
  data: Array<{ date?: string; dateISO?: string; ts?: number; value: number }>;
  color: string;
}) {
  const [RC, setRC] = useState<any | null>(null);
  useEffect(() => {
    loadRecharts().then((m) => setRC(m));
  }, []);

  const sortedData = useMemo(() => {
    return [...data]
      .map((point) => {
        const ts =
          point.ts ?? new Date(point.date ?? point.dateISO ?? 0).getTime();
        const iso =
          point.date ??
          point.dateISO ??
          new Date(ts || Date.now()).toISOString();
        return {
          ...point,
          date: iso,
          ts: Number.isNaN(ts) ? 0 : ts,
        };
      })
      .sort((a, b) => a.ts - b.ts);
  }, [data]);

  const tickValues = useMemo(() => buildTickValues(sortedData), [sortedData]);

  const overlayRef = useRef<HTMLDivElement | null>(null);
  const pointerActiveRef = useRef(false);
  const [scrub, setScrub] = useState<{
    index: number;
    date: string;
    payload: any[];
    cursorX: number;
  } | null>(null);

  const updateScrubFromClientX = useCallback(
    (clientX: number) => {
      const rect = overlayRef.current?.getBoundingClientRect();
      if (!rect || !sortedData.length) return;
      const relative = clientX - rect.left;
      const clamped = Math.min(Math.max(relative, 0), rect.width);
      const ratio = rect.width === 0 ? 0 : clamped / rect.width;
      const idx = Math.min(
        sortedData.length - 1,
        Math.max(0, Math.round(ratio * (sortedData.length - 1)))
      );
      const point = sortedData[idx];
      if (!point) return;
      const payload = [
        {
          name: title,
          value: point.value,
          color,
          stroke: color,
          dataKey: "value",
        },
      ];
      setScrub({
        index: idx,
        date: point.date,
        cursorX: Math.min(Math.max(clamped, 12), Math.max(rect.width - 12, 12)),
        payload,
      });
    },
    [color, sortedData, title]
  );

  const handlePointerDown = useCallback(
    (ev: PointerEvent<HTMLDivElement>) => {
      if (!sortedData.length) return;
      pointerActiveRef.current = true;
      ev.currentTarget.setPointerCapture(ev.pointerId);
      if (ev.pointerType === "touch") ev.preventDefault();
      updateScrubFromClientX(ev.clientX);
    },
    [sortedData.length, updateScrubFromClientX]
  );

  const handlePointerMove = useCallback(
    (ev: PointerEvent<HTMLDivElement>) => {
      if (ev.pointerType === "mouse" && ev.buttons === 0) {
        updateScrubFromClientX(ev.clientX);
        return;
      }
      if (!pointerActiveRef.current) return;
      updateScrubFromClientX(ev.clientX);
    },
    [updateScrubFromClientX]
  );

  const handlePointerUp = useCallback((ev: PointerEvent<HTMLDivElement>) => {
    if (!pointerActiveRef.current) return;
    pointerActiveRef.current = false;
    if (ev.currentTarget.hasPointerCapture(ev.pointerId)) {
      ev.currentTarget.releasePointerCapture(ev.pointerId);
    }
  }, []);

  const handlePointerLeave = useCallback(() => {
    if (pointerActiveRef.current) return;
    setScrub(null);
  }, []);

  return (
    <div className="bg-card rounded-2xl p-4 shadow-soft">
      <h3 className="font-medium mb-2">{title}</h3>
      <div className="h-56">
        {!RC && (
          <div className="h-full flex items-center justify-center text-xs text-gray-500">
            Loading…
          </div>
        )}
        {RC && (
          <div className="relative h-full rounded-xl border border-white/10 bg-slate-950/30">
            <RC.ResponsiveContainer width="100%" height="100%">
              <RC.ComposedChart
                data={sortedData}
                margin={{ left: 8, right: 12, top: 12, bottom: 8 }}
              >
                <RC.CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(148,163,184,0.15)"
                />
                <RC.XAxis
                  dataKey="date"
                  stroke="rgba(226,232,240,0.65)"
                  tick={{ fill: "rgba(226,232,240,0.8)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  interval={0}
                  ticks={tickValues}
                  tickFormatter={formatChartDateTick}
                />
                <RC.YAxis
                  stroke="rgba(226,232,240,0.65)"
                  tick={{ fill: "rgba(226,232,240,0.8)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                />
                <RC.Tooltip
                  active={!!scrub}
                  payload={scrub?.payload || []}
                  label={scrub?.date}
                  position={scrub ? { x: scrub.cursorX, y: 24 } : undefined}
                  wrapperStyle={{ outline: "none", borderRadius: 12 }}
                  cursor={false}
                  content={
                    <UnifiedTooltip labelFormatter={formatChartTooltipLabel} />
                  }
                />
                {scrub && (
                  <RC.ReferenceLine
                    x={scrub.date}
                    stroke="rgba(148,163,184,0.3)"
                    strokeDasharray="3 3"
                  />
                )}
                <RC.Line
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  strokeWidth={2.4}
                  dot={false}
                />
                {scrub && (
                  <RC.ReferenceDot
                    x={scrub.date}
                    y={sortedData[scrub.index]?.value}
                    r={4.5}
                    fill={color}
                    stroke="rgba(15,23,42,0.85)"
                    strokeWidth={1.5}
                  />
                )}
              </RC.ComposedChart>
            </RC.ResponsiveContainer>
            <div
              ref={overlayRef}
              className={`absolute inset-0 z-10 ${
                sortedData.length ? "cursor-crosshair" : "pointer-events-none"
              }`}
              style={{ touchAction: sortedData.length ? "pan-y" : "auto" }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerLeave}
              onPointerCancel={handlePointerUp}
            />
          </div>
        )}
      </div>
    </div>
  );
}
