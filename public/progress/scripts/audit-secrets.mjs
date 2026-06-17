#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const cwd = process.cwd();
function getGitRoot() {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return cwd;
  }
}

const root = getGitRoot();
const scanRoot = args[0] ? path.resolve(cwd, args[0]) : root;
const trackedOnly = !args[0] && existsSync(path.join(root, ".git"));
const skippedDirs = new Set([
  ".git",
  ".next",
  ".vite",
  ".cache",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "build",
  ".gradle",
  "android",
]);
const binaryExts = new Set([
  ".aab",
  ".apk",
  ".gif",
  ".ico",
  ".idsig",
  ".jar",
  ".jpg",
  ".jpeg",
  ".keystore",
  ".pdf",
  ".png",
  ".webp",
  ".zip",
]);
const placeholderValue = /^(your-|<|$|changeme|example|placeholder)/i;
const findings = [];

function listTrackedFiles() {
  const output = execFileSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
  });
  return output
    .split("\0")
    .filter(Boolean)
    .map((file) => path.join(root, file));
}

function listFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    if (skippedDirs.has(entry)) continue;
    const full = path.join(dir, entry);
    const stat = lstatSync(full);
    if (stat.isSymbolicLink()) continue;
    if (stat.isDirectory()) {
      files.push(...listFiles(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

function rel(file) {
  return path.relative(root, file) || file;
}

function add(file, line, message) {
  findings.push(`${rel(file)}:${line}: ${message}`);
}

function lineNumber(content, index) {
  return content.slice(0, index).split("\n").length;
}

function decodeJwtPayload(token) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "="
    );
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function checkEnvAssignments(file, content) {
  const assignment =
    /^\s*([A-Z0-9_]*(?:SECRET|SERVICE_ROLE|DATABASE_URL|JWT_SECRET|PRIVATE|TOKEN|PASSWORD)[A-Z0-9_]*)\s*=\s*(.+?)\s*$/gm;
  for (const match of content.matchAll(assignment)) {
    const key = match[1];
    const value = match[2].replace(/^["']|["']$/g, "").trim();
    if (key === "VITE_SUPABASE_ANON_KEY") continue;
    if (placeholderValue.test(value)) continue;
    add(file, lineNumber(content, match.index), `sensitive env assignment: ${key}`);
  }
}

function checkJwtTokens(file, content) {
  const jwtPattern = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
  for (const match of content.matchAll(jwtPattern)) {
    const token = match[0];
    const payload = decodeJwtPayload(token);
    const role = payload?.role;
    if (role === "anon") continue;
    add(
      file,
      lineNumber(content, match.index),
      role
        ? `JWT token committed with role "${role}"`
        : "JWT-like token committed"
    );
  }
}

function checkContent(file, content) {
  const relativePath = rel(file);
  const isAuditScript = relativePath === "public/progress/scripts/audit-secrets.mjs";
  const checks = [
    {
      pattern: /SUPABASE_SERVICE_ROLE_KEY\s*=\s*(?!$|your-|<|changeme|placeholder)/i,
      message: "service role key value must not be committed",
    },
    {
      pattern: /\bservice_role\b.+eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/i,
      message: "service role JWT must not be committed",
    },
    {
      pattern: /\bsb_secret_[A-Za-z0-9_-]+/i,
      message: "Supabase secret key must not be committed",
    },
    {
      pattern: /\bpostgres(?:ql)?:\/\/[^"'\s)]+/i,
      message: "database connection URL must not be committed",
    },
    {
      pattern: /\bJWT_SECRET\s*=\s*(?!$|your-|<|changeme|placeholder)/i,
      message: "JWT secret value must not be committed",
    },
    {
      pattern: /liftlog_auth_backup/i,
      message: "private auth-token backup storage code must not be present",
      skipSelf: true,
    },
    {
      pattern:
        /localStorage\.setItem\([^)]*(access_token|refresh_token)|(?:access_token|refresh_token)[^;\n]+localStorage\.setItem/i,
      message: "auth access/refresh tokens must not be copied into localStorage",
      skipSelf: true,
    },
    {
      pattern: /BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY/i,
      message: "private key material must not be committed",
    },
  ];
  for (const check of checks) {
    if (check.skipSelf && isAuditScript) continue;
    const match = content.match(check.pattern);
    if (match?.index !== undefined) {
      add(file, lineNumber(content, match.index), check.message);
    }
  }
  checkEnvAssignments(file, content);
  checkJwtTokens(file, content);
}

function checkPath(file) {
  const basename = path.basename(file).toLowerCase();
  const ext = path.extname(file).toLowerCase();
  if (
    basename.endsWith(".jks") ||
    basename.endsWith(".keystore") ||
    basename.endsWith(".p12") ||
    basename === "keystore.properties" ||
    basename === "upload.jks"
  ) {
    add(file, 1, "signing key or keystore file must not be committed");
  }
  return !binaryExts.has(ext);
}

const files = trackedOnly ? listTrackedFiles() : listFiles(scanRoot);
for (const file of files) {
  if (!checkPath(file)) continue;
  let content = "";
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  checkContent(file, content);
}

if (findings.length) {
  console.error("Secret audit failed:\n");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(
  `Secret audit passed (${files.length} ${trackedOnly ? "tracked" : "filesystem"} files scanned).`
);
