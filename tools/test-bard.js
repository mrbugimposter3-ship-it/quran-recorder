// node tools/test-bard.js — 📖 Shakespeare reader: Macbeth / Othello / Hamlet full PD text, act/scene parse + surah→scene pairing
const fs = require("fs"), path = require("path");
const B = require(__dirname + "/../docs/bard.js");
const D = require(__dirname + "/../docs/books-data.js");
let pass = 0; const fail = [];
const eq = (n, g, e) => { if (String(g) === String(e)) pass++; else fail.push([n, String(g), String(e)]); };
const DOCS = path.join(__dirname, "..", "docs");
const load = (id) => JSON.parse(fs.readFileSync(path.join(DOCS, "books", "shakespeare", id + ".json"), "utf8"));
// counts as parsed from the Project Gutenberg editions (#1533, #1531, #1524)
const EXPECT = { macbeth: { spa: [7, 4, 6, 3, 8], N: 28 }, othello: { spa: [3, 3, 4, 3, 2], N: 15 }, hamlet: { spa: [5, 2, 4, 7, 2], N: 20 } };
const shake = D.works.find((w) => w.id === "shakespeare");
const sceneText = (p, a, s) => p.acts[a - 1].scenes[s - 1].items.map((i) => i[1]).join("\n");
for (const id of Object.keys(EXPECT)) {
  const p = load(id), meta = B.byId[id], spa = p.acts.map((a) => a.scenes.length);
  eq(id + " acts", p.acts.length, 5);
  eq(id + " scenes per act", spa.join(","), EXPECT[id].spa.join(","));
  eq(id + " total scenes", spa.reduce((x, y) => x + y, 0), EXPECT[id].N);
  eq(id + " bard.js spa matches JSON", meta.spa.join(","), spa.join(","));
  const unit = shake.units.find((u) => u.title.toLowerCase() === id);
  eq(id + " books-data spa matches JSON", unit.spa.join(","), spa.join(","));
  eq(id + " scenes numbered", p.acts.every((a, i) => a.n === i + 1 && a.scenes.every((s, j) => s.n === j + 1)), true);
  eq(id + " every scene has place + speech", p.acts.every((a) => a.scenes.every((s) => s.place && s.items.some((i) => i[0]))), true);
  eq(id + " items well-formed", p.acts.every((a) => a.scenes.every((s) => s.items.every((i) => Array.isArray(i) && i.length === 2 && typeof i[0] === "string" && i[1].length > 0))), true);
  eq(id + " dramatis personae", p.personae.length > 10, true);
  eq(id + " source = Gutenberg PD", /^https:\/\/www\.gutenberg\.org\/ebooks\/15(33|31|24)$/.test(p.source.url), true);
  const raw = JSON.stringify(p);
  eq(id + " licence header/footer stripped", /\*\*\* (START|END) OF|Project Gutenberg License|LIMITED TO WARRANTIES|Section [1-5]\./i.test(raw), false);
  eq(id + " no italics marks left", raw.includes("_"), false);
  eq(id + " no folger/annotations", /folger|footnote/i.test(raw), false);
  // pairing: scene = ((S-1) mod N)+1, all surahs in range
  const all = Array.from({ length: 114 }, (_, i) => B.pairScene(p, i + 1).k);
  eq(id + " pairing in range", all.every((k) => k >= 1 && k <= EXPECT[id].N), true);
  eq(id + " pairing rule", all.every((k, i) => k === (i % EXPECT[id].N) + 1), true);
  eq(id + " pairing from meta == from JSON", [1, 36, 114].map((S) => B.pairScene(meta, S).k).join(","), [1, 36, 114].map((S) => B.pairScene(p, S).k).join(","));
}
const M = load("macbeth"), O = load("othello"), H = load("hamlet");
eq("macbeth opens", JSON.stringify(M.acts[0].scenes[0].items[1]), JSON.stringify(["FIRST WITCH", "When shall we three meet again?\nIn thunder, lightning, or in rain?"]));
eq("macbeth dagger in 2.1", sceneText(M, 2, 1).includes("Is this a dagger which I see before me"), true);
eq("othello opens", O.acts[0].scenes[0].items[1][0], "RODERIGO");
eq("othello jealousy in 3.3", sceneText(O, 3, 3).includes("O, beware, my lord, of jealousy"), true);
eq("hamlet opens", JSON.stringify(H.acts[0].scenes[0].items[1]), JSON.stringify(["BARNARDO", "Who’s there?"]));
eq("hamlet to be in 3.1", sceneText(H, 3, 1).includes("To be, or not to be, that is the question"), true);
eq("hamlet dumb show is a stage direction", H.acts[2].scenes[1].items.some((i) => i[0] === "" && i[1].startsWith("Enter a King and a Queen very lovingly")), true);
const P = (id, S) => { const x = B.pairScene(B.byId[id], S); return x.k + " " + B.label(x); };
eq("macbeth S=1", P("macbeth", 1), "1 Act I, Scene I");
eq("macbeth S=36", P("macbeth", 36), "8 Act II, Scene I");
eq("macbeth S=114", P("macbeth", 114), "2 Act I, Scene II");
eq("othello S=1", P("othello", 1), "1 Act I, Scene I");
eq("othello S=36", P("othello", 36), "6 Act II, Scene III");
eq("othello S=114", P("othello", 114), "9 Act III, Scene III");
eq("hamlet S=1", P("hamlet", 1), "1 Act I, Scene I");
eq("hamlet S=36", P("hamlet", 36), "16 Act IV, Scene V");
eq("hamlet S=114", P("hamlet", 114), "14 Act IV, Scene III");
eq("formula text", B.pairScene(B.byId.macbeth, 36).formula, "((36 − 1) mod 28) + 1 = 8");
// wiring: lazy JSON (not in SW install shell), versioned script, Urdu buttons
const html = fs.readFileSync(path.join(DOCS, "index.html"), "utf8"), sw = fs.readFileSync(path.join(DOCS, "sw.js"), "utf8");
const bardSrc = fs.readFileSync(path.join(DOCS, "bard.js"), "utf8"), app = fs.readFileSync(path.join(DOCS, "app.js"), "utf8");
eq("bard.js versioned in html + SW", html.includes('src="bard.js?v=bard1"') && sw.includes('"./bard.js?v=bard1"'), true);
eq("play JSON not precached", /shakespeare\/\w+\.json/.test(sw), false);
eq("play JSON fetched lazily", bardSrc.includes("fetch(`books/shakespeare/${id}.json?v=${VER}`)"), true);
eq("three direct buttons", ["macbeth", "othello", "hamlet"].every((id) => html.includes(`data-bard="${id}"`)), true);
eq("Urdu read-the-play label", html.includes("ڈرامہ پڑھیں") && app.includes("ڈرامہ پڑھیں"), true);
eq("not-tafsir tag", html.includes("not Quran, not tafsir"), true);
eq("reader outside Quran panels", html.indexOf('id="bard-reader"') > html.lastIndexOf("</main>"), true);
console.log(`${pass} passed, ${fail.length} failed`);
for (const f of fail) console.log("✗", f[0], "\n   got:", f[1], "\n   exp:", f[2]);
process.exit(fail.length ? 1 : 0);
