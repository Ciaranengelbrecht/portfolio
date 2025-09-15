// Evolt 360 PDF importer: parse text and map to Measurement fields
// Strategy: extract text from PDF pages, then apply regex patterns for known labels.
// Note: We avoid bundling heavy pdfjs for now; accept a text blob from caller, or fall back to a dynamic import path if needed later.

import type { Measurement } from "./types";

export interface EvoltParseResult {
  measurement: Partial<Measurement>;
  found: string[]; // labels captured
  warnings: string[];
  scanDateISO?: string; // derived from header date if available
}

// Parse a plain text string extracted from an Evolt 360 PDF
export function parseEvoltTextToMeasurement(text: string): EvoltParseResult {
  const found: string[] = [];
  const warn: string[] = [];
  const m: Partial<Measurement> = {};

  // Normalize and remove bracketed ranges to avoid capturing them
  const cleaned = text.replace(/\[[^\]]+\]/g, "");
  const U = cleaned.toUpperCase();

  // Helpers to scan for numbers in order
  const scanNext = (from: number, re: RegExp): { v: number; at: number } | undefined => {
    const m2 = re.exec(U.slice(from));
    if (!m2) return undefined;
    const raw = m2[1] ?? m2[0];
    const v = Number(raw.replace(/[^0-9.\-]/g, ''));
    if (isNaN(v)) return undefined;
    return { v, at: from + (m2.index ?? 0) + raw.length };
  };
  const RE = {
    status: /(\d+(?:\.\d+)?)\s*\/\s*(?:OPTIMAL|BALANCED|HIGH|UNDER|OVER|LOW)/i,
    percentStatus: /(\d+(?:\.\d+)?)\s*%\s*\/\s*(?:OPTIMAL|BALANCED|HIGH|UNDER|OVER|LOW)/i,
    plain: /(?:^|\s)(\d+(?:\.\d+)?)(?!\s*%)(?!\s*K?CAL)/i,
    kcal: /(\d+(?:\.\d+)?)\s*K?CAL\b/i,
    cm: /(\d+(?:\.\d+)?)\s*CM\b/i,
  } as const;

  // Scan date: e.g., 13-09-2025 02:41
  {
    const dm = U.match(/\b(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})\b/);
    if (dm) {
      const dd = Number(dm[1]), mm = Number(dm[2]), yyyy = Number(dm[3]);
      // store noon local to preserve the intended calendar date after UTC conversion
      const d = new Date(yyyy, mm - 1, dd, 12, 0, 0);
      // add to result after all parsing
      (m as any).__SCAN_DATE_ISO__ = d.toISOString();
    }
  }

  // Weight (nearest number with kg near 'WEIGHT')
  {
    const wIdx = U.indexOf('WEIGHT');
    if (wIdx >= 0) {
      const seg = cleaned.slice(wIdx, wIdx + 120);
      const mkg = seg.match(/(\d+(?:\.\d+)?)\s*kg/i);
      if (mkg) { m.weightKg = Number(mkg[1]); found.push('weightKg'); }
    }
  }

  // Triad mapper utility
  const triad = (
    labels: string[],
    kinds: Array<'status'|'plain'|'percentStatus'|'kcal'>,
    setters: Array<(v:number)=>void>
  ) => {
    const idxs = labels.map(L => U.indexOf(L));
    if (idxs.some(i=> i<0)) return;
    let cursor = Math.max(...idxs);
    const regs = kinds.map(k => RE[k]);
    for (let i=0;i<regs.length;i++){
      const r = scanNext(cursor, regs[i]);
      if (!r) return; // abort mapping if missing
      setters[i](r.v);
      cursor = r.at;
    }
  };

  // 1st triad: LBM, Body Fat Mass, Visceral Fat Level
  triad(
    ['LEAN BODY MASS', 'BODY FAT MASS', 'VISCERAL FAT LEVEL'],
    ['status','status','status'],
    [
      (v)=>{ m.leanMassKg = v; found.push('leanMassKg'); },
      (v)=>{ m.fatMassKg = v; found.push('fatMassKg'); },
      (v)=>{ m.visceralFatRating = v; found.push('visceralFatRating'); },
    ]
  );

  // 2nd triad: SMM (status), Subcutaneous Fat Mass (plain), ICF (plain)
  triad(
    ['SKELETAL MUSCLE MASS', 'SUBCUTANEOUS FAT MASS', 'INTRACELLULAR FLUID'],
    ['status','plain','plain'],
    [
      (v)=>{ m.skeletalMuscleMassKg = v; found.push('skeletalMuscleMassKg'); },
      (v)=>{ m.subcutaneousFatMassKg = v; found.push('subcutaneousFatMassKg'); },
      (v)=>{ /* ICF ignored for now */ },
    ]
  );

  // 3rd triad: Protein (status), Visceral Fat Mass (plain), ECF (plain)
  triad(
    ['PROTEIN', 'VISCERAL FAT MASS', 'EXTRACELLULAR FLUID'],
    ['status','plain','plain'],
    [
      (v)=>{ m.proteinKg = v; found.push('proteinKg'); },
      (v)=>{ m.visceralFatMassKg = v; found.push('visceralFatMassKg'); },
      (v)=>{ /* ECF ignored */ },
    ]
  );

  // 4th triad: Mineral (status), Visceral Fat Area (status), BMR (kcal)
  triad(
    ['MINERAL', 'VISCERAL FAT AREA', 'BMR'],
    ['status','status','kcal'],
    [
      (v)=>{ m.mineralKg = v; found.push('mineralKg'); },
      (v)=>{ m.visceralFatAreaCm2 = v; found.push('visceralFatAreaCm2'); },
      (v)=>{ m.bmrKcal = v; found.push('bmrKcal'); },
    ]
  );

  // 5th triad: Total Body Water (status), Total Body Fat Percentage (percentStatus), TEE (kcal)
  triad(
    ['TOTAL BODY WATER', 'TOTAL BODY FAT PERCENTAGE', 'TEE'],
    ['status','percentStatus','kcal'],
    [
      (v)=>{ m.totalBodyWaterKg = v; found.push('totalBodyWaterKg'); },
      (v)=>{ m.bodyFatPct = v; found.push('bodyFatPct'); },
      (v)=>{ /* TEE ignored */ },
    ]
  );

  // Waist-related
  {
    const idx = U.indexOf('ABDOMINAL CIRCUMFERENCE');
    if (idx>=0){
      const win = cleaned.slice(idx, idx + 220);
      const cms = Array.from(win.matchAll(/(\d+(?:\.\d+)?)\s*cm/gi)).map(m=> Number(m[1])).filter(n=> !isNaN(n));
      if (cms.length) { m.waist = cms[cms.length-1]; found.push('waist'); }
    }
  }
  {
    const idx = U.indexOf('WAIST TO HIP RATIO');
    if (idx>=0){
      const win = cleaned.slice(idx, idx + 220);
      const stats = Array.from(win.matchAll(/(\d+(?:\.\d+)?)\s*\/\s*(?:Optimal|Balanced|High|Under|Over|Low)/gi)).map(m=> Number(m[1])).filter(n=> !isNaN(n));
      // pick the ratio-like value (<= 2)
      const cand = stats.find(v=> v <= 2) ?? stats[0];
      if (cand != null) { m.waistToHipRatio = cand; found.push('waistToHipRatio'); }
    }
  }

  // Segmental sections
  const segVal = (section: string, keyLean: keyof Measurement, keyFat: keyof Measurement, which: 'first'|'last'='first') => {
    const start = U.indexOf(section);
    if (start < 0) return;
    const nextCandidates = ['LEFT ARM','RIGHT ARM','TORSO','TRUNK','LEFT LEG','RIGHT LEG','ABDOMINAL CIRCUMFERENCE','SEGMENTAL ANALYSIS'];
    let end = cleaned.length;
    for (const c of nextCandidates) {
      const i = U.indexOf(c, start + 1);
      if (i > start && i < end) end = i;
    }
    const block = cleaned.slice(start, end).toUpperCase();
    const leans = Array.from(block.matchAll(/LEAN\s*MASS[\s\S]{0,80}?(\d+(?:\.\d+)?)\s*\//g)).map(x=> Number(x[1])).filter(n=> !isNaN(n));
    const fats = Array.from(block.matchAll(/FAT\s*MASS[\s\S]{0,80}?(\d+(?:\.\d+)?)\s*\//g)).map(x=> Number(x[1])).filter(n=> !isNaN(n));
    const pickLean = which==='last' ? leans[leans.length-1] : leans[0];
    const pickFat = which==='last' ? fats[fats.length-1] : fats[0];
    if (pickLean != null) { (m as any)[keyLean] = pickLean; found.push(keyLean as string); }
    if (pickFat != null) { (m as any)[keyFat] = pickFat; found.push(keyFat as string); }
  };

  segVal('LEFT ARM', 'leftArmLeanKg', 'leftArmFatKg' as any, 'first');
  segVal('RIGHT ARM', 'rightArmLeanKg', 'rightArmFatKg' as any, 'last');
  segVal('TORSO', 'trunkLeanKg', 'trunkFatKg' as any);
  segVal('TRUNK', 'trunkLeanKg', 'trunkFatKg' as any);
  segVal('LEFT LEG', 'leftLegLeanKg', 'leftLegFatKg' as any, 'first');
  segVal('RIGHT LEG', 'rightLegLeanKg', 'rightLegFatKg' as any, 'last');

  // Fallbacks: If both weight and bodyFatPct present, and fatMass/leanMass missing, compute estimates
  if (m.weightKg != null && m.bodyFatPct != null) {
    if (m.fatMassKg == null) m.fatMassKg = +(m.weightKg * (m.bodyFatPct / 100)).toFixed(2);
    if (m.leanMassKg == null) m.leanMassKg = +(m.weightKg - (m.fatMassKg || 0)).toFixed(2);
  }

  // If nothing found, warn
  if (found.length === 0) warn.push("No recognizable Evolt 360 fields found");

  const scanDateISO = (m as any).__SCAN_DATE_ISO__ as string | undefined;
  if (scanDateISO) delete (m as any).__SCAN_DATE_ISO__;
  return { measurement: m, found, warnings: warn, scanDateISO };
}

// Optional: simple text extractor for PDFs using the native browser API (if available via FileReader + PDF to text externally)
// For now we keep the responsibility of turning the PDF into text outside, to avoid bundling heavy PDF libs in the app chunk.
