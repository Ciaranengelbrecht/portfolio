// Evolt 360 PDF importer: parse text and map to Measurement fields
// Strategy: extract text from PDF pages, then apply regex patterns for known labels.
// Note: We avoid bundling heavy pdfjs for now; accept a text blob from caller, or fall back to a dynamic import path if needed later.

import type { Measurement } from "./types";

export interface EvoltParseResult {
  measurement: Partial<Measurement>;
  found: string[]; // labels captured
  warnings: string[];
}

// Parse a plain text string extracted from an Evolt 360 PDF
export function parseEvoltTextToMeasurement(text: string): EvoltParseResult {
  const found: string[] = [];
  const warn: string[] = [];
  const m: Partial<Measurement> = {};

  const grab = (label: string, re: RegExp, map: (v: number) => void) => {
    const match = text.match(re);
    if (match) {
      const v = Number((match[1] || match[2] || match[0]).toString().replace(/[^0-9.\-]/g, ""));
      if (!isNaN(v)) {
        map(v);
        found.push(label);
      }
    }
  };

  // Common labels observed on Evolt360 reports (may vary slightly by version)
  grab("weightKg", /(?:Weight|Body Weight)\s*[:\-]?\s*(\d+(?:\.\d+)?)(?:\s*kg)?/i, (v) => (m.weightKg = v));
  grab("bodyFatPct", /(?:Body\s*Fat\s*%|BF\s*%)\s*[:\-]?\s*(\d+(?:\.\d+)?)/i, (v) => (m.bodyFatPct = v));
  grab("fatMassKg", /(?:Fat\s*Mass)\s*[:\-]?\s*(\d+(?:\.\d+)?)(?:\s*kg)?/i, (v) => (m.fatMassKg = v));
  grab("leanMassKg", /(?:Lean\s*Mass|Lean\s*Body\s*Mass|LBM)\s*[:\-]?\s*(\d+(?:\.\d+)?)(?:\s*kg)?/i, (v) => (m.leanMassKg = v));
  grab("skeletalMuscleMassKg", /(?:Skeletal\s*Muscle\s*Mass|SMM)\s*[:\-]?\s*(\d+(?:\.\d+)?)(?:\s*kg)?/i, (v) => (m.skeletalMuscleMassKg = v));
  grab("visceralFatRating", /(?:Visceral\s*Fat(?:\s*Rating)?|VFR)\s*[:\-]?\s*(\d+(?:\.\d+)?)/i, (v) => (m.visceralFatRating = v));
  grab("bmrKcal", /(?:BMR|Basal\s*Metabolic\s*Rate)\s*[:\-]?\s*(\d+(?:\.\d+)?)(?:\s*k?cal)?/i, (v) => (m.bmrKcal = v));

  // Segmental lean (kg)
  grab("trunkLeanKg", /(?:Trunk\s*Lean|Torso\s*Lean)\s*[:\-]?\s*(\d+(?:\.\d+)?)/i, (v) => (m.trunkLeanKg = v));
  grab("leftArmLeanKg", /(?:Left\s*Arm\s*Lean)\s*[:\-]?\s*(\d+(?:\.\d+)?)/i, (v) => (m.leftArmLeanKg = v));
  grab("rightArmLeanKg", /(?:Right\s*Arm\s*Lean)\s*[:\-]?\s*(\d+(?:\.\d+)?)/i, (v) => (m.rightArmLeanKg = v));
  grab("leftLegLeanKg", /(?:Left\s*Leg\s*Lean)\s*[:\-]?\s*(\d+(?:\.\d+)?)/i, (v) => (m.leftLegLeanKg = v));
  grab("rightLegLeanKg", /(?:Right\s*Leg\s*Lean)\s*[:\-]?\s*(\d+(?:\.\d+)?)/i, (v) => (m.rightLegLeanKg = v));

  // Fallbacks: If both weight and bodyFatPct present, and fatMass/leanMass missing, compute estimates
  if (m.weightKg != null && m.bodyFatPct != null) {
    if (m.fatMassKg == null) m.fatMassKg = +(m.weightKg * (m.bodyFatPct / 100)).toFixed(2);
    if (m.leanMassKg == null) m.leanMassKg = +(m.weightKg - (m.fatMassKg || 0)).toFixed(2);
  }

  // If nothing found, warn
  if (found.length === 0) warn.push("No recognizable Evolt 360 fields found");

  return { measurement: m, found, warnings: warn };
}

// Optional: simple text extractor for PDFs using the native browser API (if available via FileReader + PDF to text externally)
// For now we keep the responsibility of turning the PDF into text outside, to avoid bundling heavy PDF libs in the app chunk.
