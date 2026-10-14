#!/usr/bin/env node
// Restores a backup made by backup-db.js. See README-backups.md before using this on the live database.
//
// Test a backup safely (restores into a separate database, the live one is untouched):
//   node --env-file=.env scripts/restore-db.js /var/backups/cleaniq_ng/cleaniq_ng-2026-10-15-0300.archive.gz --into cleaniq_ng_restore_test
//
// Replace the live database with a backup (stop the API first: pm2 stop cleaniq-ng-api):
//   node --env-file=.env scripts/restore-db.js <file> --replace-live --yes
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--into");
const intoIdx = args.indexOf("--into");
const into = intoIdx >= 0 ? args[intoIdx + 1] : null;
const replaceLive = args.includes("--replace-live");
const confirmed = args.includes("--yes");
const uri = process.env.MONGODB_URI;
const SOURCE_DB = "cleaniq_ng";

function fail(msg) {
  console.error(`[restore] ${msg}`);
  process.exit(1);
}

if (!uri) fail("MONGODB_URI is not set");
if (!file || !fs.existsSync(file)) fail("Give the path of a backup file (…archive.gz) that exists.");
if (!into && !replaceLive) fail("Choose --into <test_database_name> (safe) or --replace-live --yes (overwrites live data).");
if (into && replaceLive) fail("Use either --into or --replace-live, not both.");
if (into && (into === SOURCE_DB || !/^[a-zA-Z0-9_]+$/.test(into))) fail("--into must be a different database name (letters, numbers, _).");
if (replaceLive && !confirmed) fail("Replacing live data needs --yes as well. Stop the API first (pm2 stop cleaniq-ng-api).");

const cmd = ["--uri=" + uri, `--archive=${file}`, "--gzip", "--drop"];
if (into) cmd.push(`--nsFrom=${SOURCE_DB}.*`, `--nsTo=${into}.*`);
console.log(`[restore] Restoring ${file} ${into ? `into ${into}` : "over the LIVE database"}…`);
const r = spawnSync("mongorestore", cmd, { stdio: ["ignore", "inherit", "inherit"] });
if (r.error) fail(`could not run mongorestore (${r.error.message}). Install MongoDB Database Tools.`);
if (r.status !== 0) fail(`mongorestore exited with code ${r.status}`);
console.log("[restore] Done.");
