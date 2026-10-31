// node tools/test-ayah-finder.js — 🔎 Ayah Finder آیت تلاش: data, engine, screen, Copy text, SW caching, quality.
// Keyword (offline fallback) mode always runs. For the semantic mode too, point AF_TJS at a folder that has
// @huggingface/transformers@3.8.1 installed:  AF_TJS=/workspace/af-build node tools/test-ayah-finder.js
// SHOW=1 prints the top 3 for every quality query.
const fs = require("fs"), path = require("path");
const D = __dirname + "/../docs/";
const F = require(D + "ayah-finder.js");
const E = require(D + "ayah-finder/ayah-match.js");
const QT = require(D + "quran-text.js");
let pass = 0; const fail = [];
const eq = (n, g, e) => { if (String(g) === String(e)) pass++; else fail.push([n, String(g), String(e)]); };
const SURAHS = new Function(fs.readFileSync(D + "surah-data.js", "utf8") + ";return SURAHS;")();
const ctx = { QURAN_TEXT: QT, SURAHS };

// ---- data files ----
const PK = JSON.parse(fs.readFileSync(D + "ayah-finder/pickthall.json", "utf8"));
const bin = fs.statSync(D + "ayah-finder/emb-minilm-int8.bin").size;
eq("6236 Pickthall ayat", PK.en.length, 6236);
eq("counts = surah-data", PK.counts.join(","), SURAHS.map((s) => s.ayahs).join(","));
eq("Pickthall credited", /Pickthall.*public domain/.test(PK.source), true);
eq("16:80 is Pickthall", PK.en[SURAHS.slice(0, 15).reduce((a, s) => a + s.ayahs, 0) + 79].startsWith("And Allah hath given you in your houses an abode"), true);
eq("emb size = 6236×384 int8 + 6236 float32", bin, 6236 * 384 + 6236 * 4);
eq("payload under 5 MB", fs.statSync(D + "ayah-finder/pickthall.json").size + bin + fs.statSync(D + "ayah-finder/ayah-match.js").size + fs.statSync(D + "ayah-finder.js").size < 5e6, true);

// ---- UI helpers ----
const n = F.normalize([{ surah: 16, ayah: 80, score: 0.71, en: "E1", keywords: ["wool"] }, { s: "18", a: "31", sim: 0.5 }, { ref: "22:23", score: 63 }, { key: "x" },
  { surah: 1, ayah: 1 }, { surah: 1, ayah: 2 }, { surah: 1, ayah: 3 }], ctx);
eq("top 5 only", n.length, 5);
eq("bad ref skipped", n.map((r) => r.ref).join(","), "16:80,18:31,22:23,1:1,1:2");
eq("surah name", n[0].name + "|" + n[0].nameAr, "An-Nahl|النحل");
eq("arabic from QURAN_TEXT", n[0].ar, QT["16"][79]);
eq("en + keywords kept", n[0].en + "|" + n[0].why, "E1|wool");
eq("score 0..1 → %", F.pct(n[0].score), "71%");
eq("score already %", F.pct(n[2].score), "63%");
eq("no score → blank", F.pct(n[3].score), "");
eq("copy format", F.copyText({ s: 16, a: 80, ar: "AR", en: "EN" }), "AR — EN (Pickthall) — Quran 16:80");
eq("empty input", F.normalize(null, ctx).length, 0);
eq("stem", ["bracelets", "garments", "sailing", "stories", "clothes"].map(E.stem).join(","), "bracelet,garment,sail,story,clothe");

// ---- screen, Urdu labels, release wiring ----
const html = fs.readFileSync(D + "index.html", "utf8"), sw = fs.readFileSync(D + "sw.js", "utf8");
eq("tab button", /<button class="tab" data-tab="ayahfind">🔎 Ayah Finder <span class="ur" lang="ur">آیت تلاش<\/span><\/button>/.test(html), true);
eq("panel", /<section id="tab-ayahfind" class="panel">/.test(html), true);
for (const id of ["af-text", "af-go", "af-status", "af-results"]) eq("has #" + id, html.includes(`id="${id}"`), true);
eq("Urdu find label", html.includes("تلاش کریں"), true);
eq("Pickthall credit on screen", /Pickthall \(1930, public domain\)/.test(html), true);
eq("ui script versioned", html.includes('src="ayah-finder.js?v=finder1"') && sw.includes('"./ayah-finder.js?v=finder1"'), true);
eq("styles versioned", html.includes('href="styles.css?v=bard1"') && sw.includes('"./styles.css?v=bard1"'), true);
eq("engine lazy (not a page script)", /<script[^>]+ayah-match/.test(html), false);
eq("engine src versioned", F.ENGINE_SRC, "ayah-finder/ayah-match.js?v=finder1");
eq("SW version", /const VERSION = "v1\.9\.0"/.test(sw), true);
eq("SW model cache survives bumps", /MODEL_CACHE = "ayah-finder-model/.test(sw) && !/MODEL_CACHE = "quran-recorder-/.test(sw), true);
eq("SW caches model CDNs", /huggingface\\\.co/.test(sw) && /cdn\\\.jsdelivr\\\.net/.test(sw), true);
eq("transformers.js pinned", /@huggingface\/transformers@3\.8\.1/.test(E.TJS), true);

// ---- quality ----
const QUERIES = ["soft green wool coat", "silk dress", "leather shoes", "gold bracelet", "cotton shirt for summer", "rain and gardens",
  "helping orphans", "night sky stars", "pearls and jewellery", "warm clothes for winter", "honey and bees", "ships sailing on the sea"];
const TOP5 = { // any of these in the top 5, in both modes
  "soft green wool coat": ["16:80", "18:31", "76:21"], "silk dress": ["18:31", "22:23", "35:33", "44:53", "76:12", "76:21"],
  "leather shoes": ["20:12", "16:80"], "gold bracelet": ["18:31", "22:23", "35:33", "43:53", "76:21"], "cotton shirt for summer": ["12:93", "12:18", "12:25", "16:81", "24:58"],
  "rain and gardens": ["50:9", "6:99", "36:34", "2:265", "78:16"], "helping orphans": ["76:8", "93:9", "2:220", "90:15", "107:2", "89:17"],
  "night sky stars": ["6:76", "7:54", "16:12", "52:49", "67:5", "37:6", "86:1", "86:3"], "pearls and jewellery": ["55:22", "56:23", "52:24", "76:19", "35:33"],
  "warm clothes for winter": ["16:5", "16:81", "106:2"], "honey and bees": ["16:68", "16:69", "47:15"], "ships sailing on the sea": ["10:22", "55:24", "42:32", "17:66", "35:12"],
};
async function quality(label) {
  const lines = [];
  for (const q of QUERIES) {
    const r = F.normalize(await E.match(q, { k: 5 }), ctx);
    eq(`${label} "${q}" gives ${label === "semantic" ? "5" : "1–5"}`, label === "semantic" ? r.length === 5 : r.length >= 1 && r.length <= 5, true);
    eq(`${label} "${q}" Arabic+English`, r.every((x) => x.ar.length > 5 && x.en.length > 5), true);
    eq(`${label} "${q}" best first`, r.every((x, i) => i === 0 || x.score <= r[i - 1].score + 1e-9), true);
    eq(`${label} "${q}" top 5 has one of ${TOP5[q].join("/")}`, r.some((x) => TOP5[q].includes(x.ref)), true);
    lines.push(`  ${q.padEnd(25)} ` + r.slice(0, 3).map((x) => `${x.ref} ${F.pct(x.score)}`).join(", "));
  }
  if (process.env.SHOW) console.log(label + ":\n" + lines.join("\n"));
}
(async () => {
  eq("empty query → []", (await E.match("   ")).length, 0);
  eq("mode before model", E.mode(), "loading");
  await quality("keyword"); // no embedder in node → offline fallback path
  if (process.env.AF_TJS) {
    const M = await import(require.resolve("@huggingface/transformers", { paths: [process.env.AF_TJS] })), T = M.pipeline ? M : M.default;
    const ex = await T.pipeline("feature-extraction", E.MODEL, { dtype: "q8", session_options: { intraOpNumThreads: 1, interOpNumThreads: 1 } });
    E.setEmbedder(async (t) => Float32Array.from((await ex(t, { pooling: "mean", normalize: true })).data));
    eq("mode semantic", E.mode(), "semantic");
    const r = await E.match("soft green wool coat");
    eq("semantic gives cosine", r.every((x) => typeof x.cos === "number"), true);
    eq("16:80 or 18:31 in top 3 (wool coat)", r.slice(0, 3).some((x) => ["16:80", "18:31"].includes(x.surah + ":" + x.ayah)), true);
    await quality("semantic");
  } else console.log("(semantic mode skipped: set AF_TJS)");
  console.log(`test-ayah-finder: ${pass} passed, ${fail.length} failed`);
  for (const f of fail) console.log("  ✗", f[0], "→ got", f[1].slice(0, 200), "expected", f[2].slice(0, 200));
  process.exit(fail.length ? 1 : 0);
})();
