import { useEffect, useState } from "react";

export type ChartMarginPreset = "tight" | "standard" | "roomy";

export type ChartMargin = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export type AxisDensity = {
  fontSize: number;
  interval: number;
  angle: number;
  height: number;
  tickMargin: number;
};

export function useIsCompactChartScreen(maxWidth = 640): boolean {
  const [compact, setCompact] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }
    return window.matchMedia(`(max-width: ${maxWidth}px)`).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const query = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const apply = (event?: MediaQueryListEvent) => {
      setCompact(event ? event.matches : query.matches);
    };
    apply();
    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", apply);
      return () => query.removeEventListener("change", apply);
    }
    query.addListener(apply);
    return () => query.removeListener(apply);
  }, [maxWidth]);

  return compact;
}

export function getChartMargin(
  compact: boolean,
  preset: ChartMarginPreset = "standard"
): ChartMargin {
  if (compact) {
    if (preset === "tight") return { left: 4, right: 6, top: 8, bottom: 4 };
    if (preset === "roomy") return { left: 8, right: 10, top: 10, bottom: 6 };
    return { left: 6, right: 8, top: 8, bottom: 4 };
  }
  if (preset === "tight") return { left: 6, right: 8, top: 10, bottom: 6 };
  if (preset === "roomy") return { left: 16, right: 20, top: 12, bottom: 8 };
  return { left: 10, right: 14, top: 10, bottom: 6 };
}

export function getAxisDensity(pointCount: number, compact: boolean): AxisDensity {
  const count = Math.max(0, pointCount);
  const fontSize = compact ? 10 : 12;
  const base = {
    fontSize,
    interval: 0,
    angle: 0,
    height: compact ? 36 : 32,
    tickMargin: compact ? 7 : 9,
  };

  const maxVisible = compact ? 4 : 7;
  if (count <= maxVisible) return base;

  const interval = Math.max(1, Math.ceil(count / maxVisible) - 1);
  return {
    ...base,
    interval,
    angle: compact ? -30 : -24,
    height: compact ? 54 : 48,
    tickMargin: compact ? 9 : 11,
  };
}

export function getChartTooltipProps(compact: boolean) {
  return {
    cursor: { fill: "rgba(148,163,184,0.14)" },
    contentStyle: {
      background: "rgba(15,23,42,0.94)",
      border: "1px solid rgba(148,163,184,0.26)",
      borderRadius: 12,
      boxShadow: "0 16px 36px -24px rgba(2,6,23,0.95)",
      padding: compact ? "8px 10px" : "10px 12px",
    },
    labelStyle: {
      color: "rgba(226,232,240,0.95)",
      fontWeight: 600,
      fontSize: compact ? 11 : 12,
      marginBottom: 3,
    },
    itemStyle: {
      color: "rgba(226,232,240,0.86)",
      fontSize: compact ? 11 : 12,
      padding: 0,
    },
    wrapperStyle: {
      outline: "none",
    },
  };
}
