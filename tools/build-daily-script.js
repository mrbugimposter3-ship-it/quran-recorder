/* Daily 8 PM ET job: read logs/YYYY-MM-DD.json (pushed from the phone app),
   build a fully Arabic markdown script of the recorded ayahs,
   write it to scripts/YYYY-MM-DD.md, plus the YouTube variants
   scripts/YYYY-MM-DD-youtube.md (Arabic) and
   scripts/YYYY-MM-DD-urdu-youtube.md (Urdu, channel «آیت اور الفاظ»).
   DATE=YYYY-MM-DD (with FORCE=1) rebuilds a specific day. */

"use strict";

const fs = require("fs");
const path = require("path");
const { buildArabicScript, buildYouTubeScript, buildUrduScript } = require("../docs/script-builder.js");

const TZ = "America/New_York";

function etNow() {
  const parts = {};
  for (const p of new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "numeric", hour12: false
  }).formatToParts(new Date())) {
    parts[p.type] = p.value;
  }
  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour) % 24
  };
}

const now = etNow();
const dateKey = process.env.DATE || now.dateKey;
const hour = now.hour;

if (process.env.FORCE !== "1" && hour !== 20) {
  console.log(`New York time is ${hour}:xx — not 8 PM, skipping (this is the other cron slot).`);
  process.exit(0);
}

const logPath = path.join(__dirname, "..", "logs", `${dateKey}.json`);
if (!fs.existsSync(logPath)) {
  console.log(`No log pushed for ${dateKey} (logs/${dateKey}.json). Nothing to build.`);
  process.exit(0);
}

const log = JSON.parse(fs.readFileSync(logPath, "utf8"));
const entries = log.entries || [];

if (!entries.some((e) => e.type === "recitation" || e.type === "ayah-stamp")) {
  console.log(`Log for ${dateKey} has no recitations or ayah timestamps — skipping script.`);
  process.exit(0);
}

const md = buildArabicScript(dateKey, entries);
const outDir = path.join(__dirname, "..", "scripts");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `${dateKey}.md`);
fs.writeFileSync(outPath, md, "utf8");
console.log(`✓ Wrote scripts/${dateKey}.md (${md.length} chars)`);

const yt = buildYouTubeScript(dateKey, entries);
if (yt) {
  fs.writeFileSync(path.join(outDir, `${dateKey}-youtube.md`), yt, "utf8");
  console.log(`✓ Wrote scripts/${dateKey}-youtube.md (${yt.length} chars) — YouTube-ready`);
}

const ur = buildUrduScript(dateKey, entries);
if (ur) {
  fs.writeFileSync(path.join(outDir, `${dateKey}-urdu-youtube.md`), ur, "utf8");
  console.log(`✓ Wrote scripts/${dateKey}-urdu-youtube.md (${ur.length} chars) — Urdu YouTube-ready`);
}
