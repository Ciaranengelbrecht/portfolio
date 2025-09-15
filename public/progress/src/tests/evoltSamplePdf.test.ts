import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { getDocument } from 'pdfjs-dist';
import { parseEvoltTextToMeasurement } from '../lib/evoltImport';

async function extractPdfText(ab: ArrayBuffer) {
  const loadingTask = getDocument({ data: ab, useWorkerFetch: false, disableFontFace: true, verbosity: 0 as any });
  const pdf = await loadingTask.promise;
  try {
    let out = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      const items = tc.items as any[];
      items.sort((a,b)=> (b.transform[5] - a.transform[5]) || (a.transform[4] - b.transform[4]));
      const pageText = items.map(it => (it.str ?? '') as string).join('\n');
      out += pageText + '\n\n';
    }
    return out;
  } finally {
    await pdf.destroy();
  }
}

describe('Evolt PDF sample parsing', () => {
  it('aligns Lean Body Mass, Body Fat Mass, and Total Body Fat % correctly', async () => {
    const path = '/Users/CiaranIMCC/Downloads/downloadfile.PDF';
    const buf = await readFile(path);
    const text = await extractPdfText(new Uint8Array(buf).buffer);
  const { measurement, found } = parseEvoltTextToMeasurement(text);
  // Debug output to verify alignment
  // eslint-disable-next-line no-console
  console.log('Parsed fields:', JSON.stringify(measurement, null, 2));

    // Primary checks requested
    expect(measurement.leanMassKg).toBeDefined();
    expect(measurement.fatMassKg).toBeDefined();
    expect(measurement.bodyFatPct).toBeDefined();

    expect(measurement.leanMassKg!).toBeCloseTo(68.8, 1);
    expect(measurement.fatMassKg!).toBeCloseTo(12.7, 1);
    expect(measurement.bodyFatPct!).toBeCloseTo(15.6, 1);

    // Sanity: these should’ve been found by the parser
    expect(found).toEqual(expect.arrayContaining(['leanMassKg','fatMassKg','bodyFatPct']));
  }, 30000);
});
