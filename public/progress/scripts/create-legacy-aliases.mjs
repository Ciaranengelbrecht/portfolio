#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.resolve(__dirname, "../dist");
const assetsDir = path.join(distDir, "assets");
const indexHtmlPath = path.join(distDir, "index.html");

async function readIndexHtml() {
  try {
    return await fs.readFile(indexHtmlPath, "utf8");
  } catch (err) {
    throw new Error(
      `Unable to read dist/index.html. Did you run the build first? (${err.message})`
    );
  }
}

function extractAsset(html, pattern, description) {
  const match = html.match(pattern);
  if (!match || !match[1]) {
    throw new Error(`Could not locate ${description} in dist/index.html.`);
  }
  return match[1];
}

async function ensureExists(relPath) {
  const p = path.join(assetsDir, relPath);
  try {
    await fs.access(p);
  } catch {
    throw new Error(
      `Expected asset ${relPath} is missing from dist/assets. Was the build successful?`
    );
  }
  return p;
}

async function writeJsAlias(legacyName, targetName) {
  const aliasPath = path.join(assetsDir, legacyName);
  const content = `// Auto-generated legacy alias.\n// Ensures stale clients requesting ${legacyName} receive the current bundle.\nimport * as mod from "./${targetName}";\nexport * from "./${targetName}";\nexport default mod;\n`;
  await fs.writeFile(aliasPath, content, "utf8");
  return aliasPath;
}

async function writeCssAlias(legacyName, targetName) {
  const aliasPath = path.join(assetsDir, legacyName);
  const content = `/* Auto-generated legacy alias */\n@import "./${targetName}";\n`;
  await fs.writeFile(aliasPath, content, "utf8");
  return aliasPath;
}

async function copyManifestAlias(legacyName, targetName) {
  const aliasPath = path.join(assetsDir, legacyName);
  const sourcePath = path.join(assetsDir, targetName);
  await fs.copyFile(sourcePath, aliasPath);
  return aliasPath;
}

async function main() {
  const html = await readIndexHtml();

  const currentJs = extractAsset(
    html,
    /<script[^>]+src=["']\.\/assets\/(index-[^"'>]+\.js)["'][^>]*>/i,
    "main JS bundle"
  );
  const currentCss = extractAsset(
    html,
    /<link[^>]+rel=["']stylesheet["'][^>]*href=["']\.\/assets\/(index-[^"'>]+\.css)["'][^>]*>/i,
    "main CSS bundle"
  );
  const currentManifest = extractAsset(
    html,
    /<link[^>]+rel=["']manifest["'][^>]*href=["']\.\/assets\/(manifest-[^"'>]+\.webmanifest)["'][^>]*>/i,
    "web manifest"
  );

  await Promise.all([
    ensureExists(currentJs),
    ensureExists(currentCss),
    ensureExists(currentManifest),
  ]);

  const legacyJsAliases = ["index-C-gkLcDY.js"];
  const legacyCssAliases = ["index-BZO3Pnt1.css"];
  const legacyManifestAliases = ["manifest-xkBwkjBY.webmanifest"];

  const created = [];

  for (const legacy of legacyJsAliases) {
    const p = await writeJsAlias(legacy, currentJs);
    created.push(path.relative(distDir, p));
  }

  for (const legacy of legacyCssAliases) {
    const p = await writeCssAlias(legacy, currentCss);
    created.push(path.relative(distDir, p));
  }

  for (const legacy of legacyManifestAliases) {
    const p = await copyManifestAlias(legacy, currentManifest);
    created.push(path.relative(distDir, p));
  }

  if (created.length) {
    console.log(
      `[create-legacy-aliases] Generated ${created.length} legacy alias file(s):`
    );
    for (const rel of created) console.log(` - ${rel}`);
  } else {
    console.log("[create-legacy-aliases] No legacy aliases configured.");
  }
}

main().catch((err) => {
  console.error("[create-legacy-aliases] Error:", err.message);
  process.exit(1);
});
