// node tools/test-books.js — 📚 Books کتابیں picker: Geronimo unchanged + 13 Geronimo-family series + 6 other works (number pairing only)
const fs = require("fs"), path = require("path"), cp = require("child_process");
const A = require(__dirname + "/../docs/approve.js");
const G = require(__dirname + "/../docs/geronimo-books.js");
const D = require(__dirname + "/../docs/books-data.js");
const B = require(__dirname + "/../docs/books.js");
let pass = 0; const fail = [];
const eq = (n, g, e) => { if (String(g) === String(e)) pass++; else fail.push([n, String(g), String(e)]); };
const S0 = (w, s) => { const p = B.pair(w, s, 1); return [p.unit, p.label, p.title].join(" | "); };
const AYAHS = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];

// works + sizes
const FAMILY = ["gs_cavemice", "gs_heromice", "gs_micekings", "gs_spacemice", "gs_graphic", "gs_fantasy", "gs_classics", "gs_special", "thea", "thea_special", "mouseford", "creepella", "journey"];
eq("picker order", B.WORKS.map((w) => w.id).join(","), ["geronimo"].concat(FAMILY, ["lotr", "shakespeare", "sonnets", "kashf", "artofwar", "fusus"]).join(","));
const N = { lotr: 62, shakespeare: 38, sonnets: 154, kashf: 25, artofwar: 13, fusus: 27,
  gs_cavemice: 15, gs_heromice: 2, gs_micekings: 7, gs_spacemice: 12, gs_graphic: 10, gs_fantasy: 17, gs_classics: 2, gs_special: 7,
  thea: 30, thea_special: 7, mouseford: 8, creepella: 9, journey: 8 };
for (const w of D.works) {
  eq(w.id + " N", w.units.length, N[w.id]); eq(w.id + " N field", w.N, N[w.id]);
  eq(w.id + " numbered", w.units.every((u, i) => u.n === i + 1), true);
  if (FAMILY.includes(w.id)) eq(w.id + " titles + labels only", w.units.every((u) => u.title && u.label && !u.ar && !u.ja && !u.summary && !u.line && !u.lines), true);
  else eq(w.id + " has titles/ar/ja/summary", w.units.every((u) => u.title && u.ar && u.ja && u.summary), true);
}
// Geronimo-family series: copyrighted, titles only, no pd_line, no links to any file
eq("family all copyrighted", FAMILY.every((id) => B.byId[id].rights === "copyrighted" && B.byId[id].lineSource === null), true);
const dataSrc = fs.readFileSync(__dirname + "/../docs/books-data.js", "utf8");
eq("no Google Drive links in books-data.js", /drive\.google|docs\.google|\.pdf/i.test(dataSrc), false);
eq("family sources are the public fan wiki", FAMILY.every((id) => /^https:\/\/geronimostilton\.fandom\.com\/wiki\//.test(B.byId[id].source)), true);
eq("family never returns a line", FAMILY.every((id) => [1, 18, 112].every((s) => B.pair(id, s, 5).line === null && B.pair(id, s, 5).sub === null)), true);
eq("1:1 thea", S0("thea", 1), "1 | Book 1 | The Dragon's Code");
eq("9:1 thea skips missing #9", S0("thea", 9), "9 | Book 10 | Secret of the Old Castle");
eq("18:1 cavemice", S0("gs_cavemice", 18), "3 | Book 3 | Help, I'm in Hot Lava!");
eq("16:1 fantasy SE", S0("gs_fantasy", 16), "16 | Special Edition 1 | The Phoenix of Destiny");
eq("112:1 creepella", S0("creepella", 112), "4 | Book 4 | Return of the Vampire");
eq("114:1 journey", S0("journey", 114), "2 | Book 2 | Back in Time");
eq("mouseford #17 last", S0("mouseford", 8), "8 | Book 17 | The Puppy Problem");
// Geronimo: exactly the old behaviour for every ayah of the Quran
let same = true, holiday = 0, ghost = 0;
for (let s = 1; s <= 114; s++) for (let a = 1; a <= AYAHS[s - 1]; a++) {
  const old = A.geronimo(G, s, a), now = B.pair("geronimo", s, a);
  for (const k of Object.keys(old)) if (String(old[k]) !== String(now[k])) same = false;
  if (a === 1) { if (old.none) holiday++; if (old.theme === "ghost") ghost++; }
}
eq("geronimo identical to QApprove.geronimo (6236 ayat)", same, true);
eq("geronimo holiday surahs", holiday, 11); eq("geronimo ghost surahs", ghost, 10);
eq("11:1 holiday → no pairing", B.pair("geronimo", 11, 1).none, true);
eq("112:1 ghost kept", B.pair("geronimo", 112, 1).theme, "ghost");
eq("112:1 ghost book", B.pair("geronimo", 112, 1).unit, 26);

// rule unit = ((S-1) mod N)+1
for (const w of D.works) for (const s of [1, 18, 62, 63, 112, 114]) eq(`${w.id} unit ${s}`, B.pair(w.id, s, 1).unit, ((s - 1) % w.N) + 1);
// samples 1:1, 18:10, 112:1
const S = (w, s, a) => { const p = B.pair(w, s, a); return [p.unit, p.title, p.subLabel || ""].join(" | "); };
eq("1:1 lotr", S("lotr", 1, 1), "1 | A Long-expected Party | ");
eq("18:10 lotr", S("lotr", 18, 10), "18 | Lothlórien | ");
eq("112:1 lotr", S("lotr", 112, 1), "50 | The Pyre of Denethor | ");
eq("1:1 shakespeare", S("shakespeare", 1, 1), "1 | The Tempest | Act 1, Scene 1");
eq("18:10 shakespeare", S("shakespeare", 18, 10), "18 | Henry IV, Part 2 | Act 4, Scene 1");
eq("112:1 shakespeare", S("shakespeare", 112, 1), "36 | Cymbeline | Act 1, Scene 1");
eq("18:10 sonnets", S("sonnets", 18, 10), "18 | Shall I compare thee to a summer’s day? | line 10/14");
eq("112:1 sonnets", S("sonnets", 112, 1), "112 | Your love and pity doth the impression fill, | line 1/14");
eq("18:10 kashf", B.pair("kashf", 18, 10).unit, 18);
eq("112:1 kashf", B.pair("kashf", 112, 1).title, "Concerning the principal Súfís of recent times");
eq("18:10 artofwar", S("artofwar", 18, 10), "5 | Energy | verse 10/23");
eq("112:1 artofwar", S("artofwar", 112, 1), "8 | Variation of Tactics | verse 1/14");
eq("1:1 fusus", B.pair("fusus", 1, 1).title, "فص حكمة إلهية في كلمة آدمية");
eq("18:10 fusus", B.pair("fusus", 18, 10).title, "فص حكمة نفسية في كلمة يونسية");
eq("112:1 fusus", B.pair("fusus", 112, 1).title, "فص حكمة قدوسية في كلمة إدريسية");
eq("27 fusus = Muhammad", B.pair("fusus", 27, 1).title, "فص حكمة فردية في كلمة محمدية");

// structures
const W = Object.fromEntries(D.works.map((w) => [w.id, w]));
eq("lotr: no line anywhere (copyrighted)", W.lotr.units.every((u) => !u.line && !u.lines), true);
eq("lotr: never returns a line", [1, 18, 62, 112].every((s) => B.pair("lotr", s, 3).line === null), true);
eq("lotr books I-VI 12/10/11/10/10/9", ["I", "II", "III", "IV", "V", "VI"].map((b) => W.lotr.units.filter((u) => u.label.startsWith("Book " + b + " ")).length).join("/"), "12/10/11/10/10/9");
eq("shakespeare: 5 acts each", W.shakespeare.units.every((u) => u.spa.length === 5), true);
eq("shakespeare: subs = sum of scenes", W.shakespeare.units.every((u) => u.subs === u.spa.reduce((a, b) => a + b, 0)), true);
eq("Hamlet 20 scenes", W.shakespeare.units.find((u) => u.title === "Hamlet").subs, 20);
eq("actScene last", B.actScene([5, 2, 4, 7, 2], 20), "Act 5, Scene 2");
eq("actScene first of act 2", B.actScene([5, 2, 4, 7, 2], 6), "Act 2, Scene 1");
eq("shakespeare scene wraps", B.pair("shakespeare", 32, 21).subLabel, "Act 1, Scene 1");
eq("sonnet 99 has 15 lines", W.sonnets.units[98].subs, 15); eq("sonnet 126 has 12 lines", W.sonnets.units[125].subs, 12);
eq("sonnet line = opening line", B.pair("sonnets", 18, 5).line, "Shall I compare thee to a summer’s day?");
eq("artofwar verses (Giles)", W.artofwar.units.map((u) => u.subs).join(","), "26,20,18,20,23,34,37,14,45,31,68,22,27");
eq("artofwar 385 verses", W.artofwar.units.reduce((a, u) => a + u.lines.length, 0), 385);
eq("artofwar line = that verse", B.pair("artofwar", 1, 1).line, "Sun Tzŭ said: The art of war is of vital importance to the State.");
eq("artofwar verse wraps", B.pair("artofwar", 14, 27).sub, 1);
eq("fusus headings", W.fusus.units.every((u) => /^فص حكمة \S+ في كلمة \S+$/.test(u.title)), true);
eq("kashf 25 chapters ends with Audition", /Audition/.test(W.kashf.units[24].title), true);
eq("no sub without ayah", B.pair("artofwar", 1).sub, null);

// service worker VERSION and ?v= cache-busting move together
const html = fs.readFileSync(__dirname + "/../docs/index.html", "utf8"), sw = fs.readFileSync(__dirname + "/../docs/sw.js", "utf8");
const refs = [...html.matchAll(/(?:src|href)="([\w.-]+\.(?:js|css)\?v=[\w.-]+)"/g)].map((m) => "./" + m[1]);
eq("every ?v= asset is in the SW shell", refs.filter((r) => !sw.includes(`"${r}"`)).join(" ") || "ok", "ok");
eq("books files versioned", ["books-data.js?v=books2", "books.js?v=books2", "app.js?v=bard1"].every((r) => html.includes(r) && sw.includes(r)), true);
eq("SW version", /const VERSION = "v1\.8\.0"/.test(sw), true);
eq("Books button", /📚 Books <span class="ur" lang="ur">کتابیں<\/span>/.test(html), true);

// books-data.js matches the canonical JSON (when the tables are on this machine)
const dir = "/workspace/geronimo-map/books";
if (fs.existsSync(dir)) {
  for (const w of D.works) {
    const J = JSON.parse(fs.readFileSync(path.join(dir, w.id + ".json"), "utf8"));
    eq(w.id + " in sync with " + w.id + ".json", J.entries.map((e) => e.title + "|" + (e.summary || "")).join("\n") === w.units.map((u) => u.title + "|" + (u.summary || "")).join("\n"), true);
  }
  // and with pairing.py (the Python reference) for every surah at ayah 10 or the last ayah
  try {
    for (const s of [1, 18, 50, 112, 114]) {
      const a = Math.min(10, AYAHS[s - 1]);
      const py = JSON.parse(cp.execFileSync("python3", [path.join(dir, "pairing.py"), `${s}:${a}`, "--json"], { encoding: "utf8" }));
      for (const w of B.WORKS) {
        const p = B.pair(w.id, s, a), q = py[w.id];
        eq(`py ${w.id} ${s}:${a} unit`, p.unit, q.unit);
        if (w.id !== "geronimo") eq(`py ${w.id} ${s}:${a} sub`, p.sub || "", q.sub || "");
        if (w.id === "geronimo") eq(`py geronimo ${s}:${a} none`, !!p.none, q.paired === false && q.theme === "holiday");
      }
    }
  } catch (e) { fail.push(["pairing.py cross-check", e.message.split("\n")[0], "runs"]); }
}

console.log(`test-books: ${pass} passed, ${fail.length} failed`);
for (const f of fail) console.log("  ✗", f[0], "→ got", JSON.stringify(f[1]).slice(0, 200), "expected", JSON.stringify(f[2]).slice(0, 200));
process.exit(fail.length ? 1 : 0);
