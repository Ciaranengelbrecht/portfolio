#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const origin = process.env.LIVE_ORIGIN || "https://ciaranengelbrecht.com";
const indexUrl = `${origin}/progress/dist/index.html`;

async function fetchText(url) {
  const r = await fetch(url, { redirect: "follow" });
  if (!r.ok) throw new Error(`${url} -> ${r.status} ${r.statusText}`);
  return r.text();
}

async function head(url) {
  const r = await fetch(url, { method: "HEAD", redirect: "follow" });
  return r.ok;
}

async function main() {
  console.log(`[verify-live] Checking ${indexUrl}`);
  let html;
  try {
    html = await fetchText(indexUrl);
  } catch (e) {
    console.error("[verify-live] Failed to load index.html:", e.message);
    process.exit(1);
  }

  const assetRefs = new Set();
  const re = /(href|src)=["']\.\/assets\/([^"'>]+)["']/g;
  let m;
  while ((m = re.exec(html))) assetRefs.add(m[2]);

  if (assetRefs.size === 0) {
    console.warn(
      "[verify-live] No assets referenced as ./assets/* in index.html"
    );
  }

  const failures = [];
  for (const rel of assetRefs) {
    const url = `${origin}/progress/dist/assets/${rel}`;
    const ok = await head(url).catch(() => false);
    console.log(`${ok ? "OK " : "ERR"} ${url}`);
    if (!ok) failures.push(url);
  }

  const legacyAliases = [
    "index-C-gkLcDY.js",
    "index-BZO3Pnt1.css",
    "manifest-xkBwkjBY.webmanifest",
  ];

  for (const legacy of legacyAliases) {
    const url = `${origin}/progress/dist/assets/${legacy}`;
    const ok = await head(url).catch(() => false);
    console.log(`${ok ? "OK " : "ERR"} ${url}`);
    if (!ok) failures.push(url);
  }

  if (failures.length) {
    console.error(
      `\n[verify-live] ${failures.length} missing assets on production:`
    );
    failures.forEach((u) => console.error(" -", u));
    process.exit(1);
  }

  console.log(
    `\n[verify-live] Success: ${
      assetRefs.size + legacyAliases.length
    } required assets exist on production.`
  );
}

main().catch((e) => {
  console.error("[verify-live] Error:", e);
  process.exit(1);
});
