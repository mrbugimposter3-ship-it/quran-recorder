/* Runs in the daily Action before the script build:
   collects the English number-words needed by today's recorded ayahs,
   translates any missing ones to Arabic (Google Translate free endpoint),
   and updates docs/word-translations.js (committed back to the repo). */

"use strict";

const fs = require("fs");
const path = require("path");
const NUMBER_WORDS = require("../docs/number-words.js");

const TZ = "America/New_York";
const MAX_NEW = 80; // stay well under free translation limits

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

const { dateKey, hour } = etNow();
if (process.env.FORCE !== "1" && hour !== 20) {
  console.log(`New York time is ${hour}:xx — not 8 PM, skipping translations.`);
  process.exit(0);
}

const logPath = path.join(__dirname, "..", "logs", `${dateKey}.json`);
if (!fs.existsSync(logPath)) {
  console.log(`No log for ${dateKey} — nothing to translate.`);
  process.exit(0);
}

const log = JSON.parse(fs.readFileSync(logPath, "utf8"));
const needed = new Set();
for (const e of log.entries || []) {
  if (e.type !== "recitation" && e.type !== "ayah-stamp") continue;
  for (const w of NUMBER_WORDS.words(e.surah, e.ayah)) {
    needed.add(NUMBER_WORDS.english(NUMBER_WORDS.val(w)));
  }
}

const cachePath = path.join(__dirname, "..", "docs", "word-translations.js");
const cache = require(cachePath);
const missing = [...needed].filter((w) => !(w in cache)).slice(0, MAX_NEW);
console.log(`Needed words: ${needed.size}, cached: ${needed.size - [...needed].filter((w) => !(w in cache)).length}, to translate: ${missing.length}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function translate(word) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ar&dt=t&q=${encodeURIComponent(word)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return (data[0] || []).map((seg) => seg[0]).join("").trim();
}

(async () => {
  let ok = 0;
  for (const w of missing) {
    try {
      const ar = await translate(w);
      if (ar && ar !== w) { cache[w] = ar; ok++; }
      await sleep(150);
    } catch (err) {
      console.log(`  ! failed: ${w} (${err.message})`);
    }
  }
  if (ok > 0) {
    const sorted = Object.keys(cache).sort();
    const body = sorted.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(cache[k])}`).join(",\n");
    fs.writeFileSync(cachePath,
      "// English → Arabic translation cache for the number-words buckets.\n" +
      "// Seeded with the most frequent Quran words' mappings; the daily GitHub\n" +
      "// Action (tools/translate-words.js) appends new translations here automatically.\n" +
      `const WORD_TRANSLATIONS = {\n${body}\n};\n` +
      'if (typeof module === "object" && module.exports) module.exports = WORD_TRANSLATIONS;\n' +
      'if (typeof window !== "undefined") window.WORD_TRANSLATIONS = WORD_TRANSLATIONS;\n',
      "utf8");
  }
  console.log(`✓ Translated ${ok} new words (cache now ${Object.keys(cache).length} entries)`);
})();
