#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const distDir = path.resolve(__dirname, "../dist");
  const indexPath = path.join(distDir, "index.html");
  const html = await fs.readFile(indexPath, "utf8");

  // Extract all asset href/src entries pointing to ./assets/
  const assetRefs = new Set();
  const re = /(href|src)=["']\.\/assets\/([^"'>]+)["']/g;
  let m;
  while ((m = re.exec(html))) {
    assetRefs.add(m[2]);
  }

  if (assetRefs.size === 0) {
    throw new Error("No ./assets/* references found in dist/index.html");
  }

  // Ensure each referenced file exists locally
  const missing = [];
  for (const rel of assetRefs) {
    const p = path.join(distDir, "assets", rel);
    try {
      await fs.access(p);
    } catch {
      missing.push(p);
    }
  }

  if (missing.length) {
    console.error("Missing assets referenced from index.html:");
    for (const p of missing)
      console.error(" -", path.relative(path.resolve(__dirname, ".."), p));
    process.exitCode = 1;
    return;
  }

  console.log(
    `OK: ${assetRefs.size} assets referenced by index.html exist locally.`
  );
}

main().catch((err) => {
  console.error("[verify-dist] Error:", err.message);
  process.exit(1);
});
