// Dynamically load pdfjs-dist and extract text from a PDF ArrayBuffer
// Keeps the heavy library out of the main bundle until needed.

export async function extractTextFromPdf(data: ArrayBuffer): Promise<string> {
  // Dynamic imports for better code-splitting
  const [{ getDocument, GlobalWorkerOptions }, workerUrl] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url').then((m: any) => m.default)
  ]);
  // Point pdf.js to its worker bundle
  (GlobalWorkerOptions as any).workerSrc = workerUrl;

  const loadingTask = getDocument({ data, useWorkerFetch: false, disableFontFace: true, verbosity: 0 as any });
  const pdf = await loadingTask.promise;
  try {
    const max = pdf.numPages;
    const all: string[] = [];
    for (let i = 1; i <= max; i++) {
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      // Join in reading order; use item.str and line breaks on y changes
      const items = tc.items as Array<any>;
      // Sort by y descending (pdf.js coordinate system) then x
      items.sort((a, b) => (b.transform[5] - a.transform[5]) || (a.transform[4] - b.transform[4]));
      const parts = items.map(it => (it.str ?? '') as string);
      const pageText = parts.join('\n');
      all.push(pageText);
    }
    return all.join('\n\n');
  } finally {
    await pdf.destroy();
  }
}
