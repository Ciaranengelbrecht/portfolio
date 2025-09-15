import { readFile } from 'node:fs/promises';
import { getDocument } from 'pdfjs-dist';

async function extract(path) {
  const data = await readFile(path);
  const loadingTask = getDocument({ data: new Uint8Array(data).buffer, useWorkerFetch: false, disableFontFace: true, verbosity: 0 });
  const pdf = await loadingTask.promise;
  const all = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    const items = tc.items;
    // Sort roughly by y desc then x asc
    items.sort((a, b) => (b.transform[5] - a.transform[5]) || (a.transform[4] - b.transform[4]));
    const parts = items.map(it => it.str || '').filter(Boolean);
    const pageText = parts.join('\n');
    all.push(pageText);
  }
  await pdf.destroy();
  return all.join('\n\n');
}

function probe(text) {
  const grab = (name, re) => {
    const m = text.match(re);
    if (m) console.log(`${name}:`, m[1] ?? m[0]);
    else console.log(`${name}: <not found>`);
  };
  grab('Weight', /(Weight|Body Weight)\s*[:\-]?\s*(\d+(?:\.\d+)?)(?:\s*kg)?/i);
  grab('Body Fat %', /(Body\s*Fat\s*%|BF\s*%)\s*[:\-]?\s*(\d+(?:\.\d+)?)/i);
  grab('Fat Mass', /Fat\s*Mass\s*[:\-]?\s*(\d+(?:\.\d+)?)(?:\s*kg)?/i);
  grab('Lean Mass', /(Lean\s*Mass|Lean\s*Body\s*Mass|LBM)\s*[:\-]?\s*(\d+(?:\.\d+)?)(?:\s*kg)?/i);
  grab('SMM', /(Skeletal\s*Muscle\s*Mass|SMM)\s*[:\-]?\s*(\d+(?:\.\d+)?)(?:\s*kg)?/i);
  grab('VFR', /(Visceral\s*Fat(?:\s*Rating)?|VFR)\s*[:\-]?\s*(\d+(?:\.\d+)?)/i);
  grab('BMR', /(BMR|Basal\s*Metabolic\s*Rate)\s*[:\-]?\s*(\d+(?:\.\d+)?)/i);
}

const path = process.argv[2];
if (!path) {
  console.error('Usage: node scripts/pdf-text.mjs <pdf-path>');
  process.exit(1);
}
extract(path).then(text => {
  console.log('Length:', text.length);
  console.log('--- First 4000 chars ---');
  console.log(text.slice(0, 4000));
  console.log('\n--- Probes ---');
  probe(text);
}).catch(err => {
  console.error('Failed to extract PDF text:', err);
  process.exit(2);
});
