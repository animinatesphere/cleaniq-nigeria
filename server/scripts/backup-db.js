#!/usr/bin/env node
// Daily database backup: mongodump → one compressed archive, keep the newest BACKUP_KEEP copies on
// the VPS, and upload each new copy off the VPS with BACKUP_UPLOAD_CMD. See README-backups.md.
//
//   node --env-file=.env scripts/backup-db.js
//
// Exit code is non-zero if anything fails, so cron can email/alert on it.
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const uri = process.env.MONGODB_URI;
const dir = process.env.BACKUP_DIR || path.join(__dirname, "..", "backups");
const keep = Math.max(1, Number(process.env.BACKUP_KEEP) || 14);
const uploadCmd = (process.env.BACKUP_UPLOAD_CMD || "").trim();
const PREFIX = "cleaniq_ng-";

function fail(msg) {
  console.error(`[backup] FAILED: ${msg}`);
  process.exit(1);
}

if (!uri) fail("MONGODB_URI is not set");
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });

// Lagos time stamp, e.g. cleaniq_ng-2026-10-15-030000.archive.gz
const lagos = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const stamp = `${lagos.slice(0, 10)}-${lagos.slice(11, 13)}${lagos.slice(14, 16)}${lagos.slice(17, 19)}`;
const file = path.join(dir, `${PREFIX}${stamp}.archive.gz`);

console.log(`[backup] Dumping database to ${file}`);
const dump = spawnSync("mongodump", [`--uri=${uri}`, `--archive=${file}`, "--gzip"], { stdio: ["ignore", "inherit", "inherit"] });
if (dump.error) fail(`could not run mongodump (${dump.error.message}). Install MongoDB Database Tools.`);
if (dump.status !== 0) fail(`mongodump exited with code ${dump.status}`);
const size = fs.statSync(file).size;
if (size < 100) fail(`backup file is suspiciously small (${size} bytes)`);
fs.chmodSync(file, 0o600);
console.log(`[backup] Done: ${(size / 1024 / 1024).toFixed(2)} MB`);

// Keep only the newest copies on the VPS.
const copies = fs.readdirSync(dir).filter((f) => f.startsWith(PREFIX) && f.endsWith(".archive.gz")).sort();
for (const old of copies.slice(0, Math.max(0, copies.length - keep))) {
  fs.unlinkSync(path.join(dir, old));
  console.log(`[backup] Removed old copy ${old}`);
}

// Copy off the VPS (a backup that only lives on the same machine is not a backup).
if (!uploadCmd) {
  console.warn("[backup] WARNING: BACKUP_UPLOAD_CMD is empty — this copy is only on the VPS.");
  process.exit(0);
}
console.log(`[backup] Uploading off the VPS…`);
const up = spawnSync(`${uploadCmd} "${file}"`, { shell: true, stdio: ["ignore", "inherit", "inherit"] });
if (up.status !== 0) fail(`upload command exited with code ${up.status}`);
console.log("[backup] Uploaded.");
