#!/usr/bin/env node
/* 📖 Build docs/books/shakespeare/{macbeth,othello,hamlet}.json from public-domain Project Gutenberg plain text.
   Usage: node tools/build-shakespeare.js [srcDir]   (srcDir holds pg1533.txt, pg1531.txt, pg1524.txt;
   download them from https://www.gutenberg.org/cache/epub/<n>/pg<n>.txt). Only the play text between the
   "*** START" / "*** END" markers is kept — the Gutenberg licence header/footer is stripped; a short source note stays.
   Output per play: { id, title, ar, ur, source, personae[], setting, acts:[{ n, scenes:[{ n, place, items }] }] }
   items: [speaker, text] — speaker "" means a stage direction. Lines are "\n"-joined; "\n\n" = paragraph break. */
const fs = require("fs"), path = require("path");
const PLAYS = [
  { id: "macbeth", n: 1533, title: "Macbeth", ar: "ماكبث", ur: "میکبتھ" },
  { id: "othello", n: 1531, title: "Othello", ar: "عطيل", ur: "اوتھیلو" },
  { id: "hamlet", n: 1524, title: "Hamlet", ar: "هاملت", ur: "ہیملٹ" },
];
const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };
const NAME = "[A-Z][A-Z0-9 ’'&,-]*(?: and [A-Z][A-Z0-9 ’'&,-]*)?";
const SPEAKER = new RegExp("^" + NAME + "\\.$"), SPEAKER_INLINE = new RegExp("^(" + NAME + ")\\.\\s+(\\[.*)$");
const DIRECTION = /^(_|\[|The King rises\b|Enter\b|Re-enter\b|Exit\b|Exeunt\b|Flourish\b|Alarum|Alarums\b|Sennet\b|Trumpets?\b|Thunder\b|Drum\b|Retreat\b|Knocking\b|A (?:march|flourish|tucket|trumpet))/;
function parse(raw, meta) {
  let t = raw.replace(/\r/g, "");
  const a = t.indexOf("*** START OF"), b = t.indexOf("*** END OF");
  if (a < 0 || b < 0) throw new Error(meta.id + ": Gutenberg markers not found");
  t = t.slice(t.indexOf("\n", a) + 1, b);
  const lines = t.split("\n");
  const dp = lines.findIndex((l) => /^Dramatis Person/.test(l.trim()));
  if (dp < 0) throw new Error(meta.id + ": no Dramatis Personæ");
  const act1 = lines.findIndex((l, i) => i > dp && /^ACT I$/.test(l.trim()));
  const personae = [], setting = [];
  let inSetting = false;
  for (const l of lines.slice(dp + 1, act1)) {
    const s = l.trim(); if (!s) { inSetting = false; continue; }
    if (/^SCENE[.:]/.test(s)) { inSetting = true; setting.push(s.replace(/^SCENE[.:]\s*/, "")); continue; }
    if (inSetting) setting.push(s); else personae.push(s);
  }
  // body → blocks separated by blank lines
  const blocks = []; let cur = [];
  for (const l of lines.slice(act1)) { if (l.trim()) cur.push(l); else if (cur.length) { blocks.push(cur); cur = []; } }
  if (cur.length) blocks.push(cur);
  const acts = []; let act = null, scene = null;
  const clean = (s) => s.replace(/_/g, "").replace(/\s+$/, "");
  for (const blk of blocks) {
    const first = blk[0].trim();
    let m;
    if ((m = first.match(/^ACT ([IVX]+)$/)) && blk.length === 1) { act = { n: ROMAN[m[1]], scenes: [] }; acts.push(act); scene = null; continue; }
    if ((m = first.match(/^SCENE ([IVX]+)\.\s*(.*)$/))) {
      scene = { n: ROMAN[m[1]], place: clean([m[2]].concat(blk.slice(1).map((x) => x.trim())).join(" ").trim()), items: [] };
      act.scenes.push(scene); continue;
    }
    if (!scene) throw new Error(meta.id + ": text before first scene: " + first);
    if (SPEAKER.test(first)) { scene.items.push([first.slice(0, -1), blk.slice(1).map(clean).join("\n")]); continue; }
    if ((m = first.match(SPEAKER_INLINE))) { scene.items.push([m[1], [clean(m[2])].concat(blk.slice(1).map(clean)).join("\n")]); continue; }
    const last = scene.items[scene.items.length - 1];
    const prevSpeech = [...scene.items].reverse().find((x) => x[0]);
    if (/^\s/.test(blk[0]) || DIRECTION.test(first) || !prevSpeech) scene.items.push(["", blk.map((x) => clean(x.trim())).join(" ")]);
    else if (last === prevSpeech) last[1] += "\n\n" + blk.map(clean).join("\n");
    else { scene.items.push([prevSpeech[0], blk.map(clean).join("\n")]); if (process.env.BARD_DEBUG) console.error(meta.id, "cont:", first); }
  }
  return {
    id: meta.id, title: meta.title, ar: meta.ar, ur: meta.ur, author: "William Shakespeare",
    source: { url: `https://www.gutenberg.org/ebooks/${meta.n}`, text: `https://www.gutenberg.org/cache/epub/${meta.n}/pg${meta.n}.txt`, ebook: meta.n,
      note: `Public-domain text, transcribed by the PG Shakespeare Team (gutenberg.org eBook #${meta.n}). Licence header/footer removed; text otherwise unchanged apart from italics marks.` },
    personae, setting: setting.join(" "), acts,
  };
}
if (require.main === module) {
  const src = process.argv[2] || "/workspace/bard-src";
  const out = path.join(__dirname, "..", "docs", "books", "shakespeare");
  fs.mkdirSync(out, { recursive: true });
  for (const p of PLAYS) {
    const play = parse(fs.readFileSync(path.join(src, `pg${p.n}.txt`), "utf8"), p);
    fs.writeFileSync(path.join(out, p.id + ".json"), JSON.stringify(play));
    const sc = play.acts.map((a) => a.scenes.length);
    console.log(p.id, "acts", play.acts.length, "scenes", sc.reduce((x, y) => x + y, 0), JSON.stringify(sc), "items", play.acts.flatMap((a) => a.scenes).reduce((x, s) => x + s.items.length, 0));
  }
}
module.exports = { parse, PLAYS };
