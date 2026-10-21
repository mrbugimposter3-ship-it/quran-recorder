// node tools/test-letters.js — Letters mode (wardrobe.js) checks.
const fs = require("fs"), path = require("path"), assert = require("assert");
const docs = path.join(__dirname, "..", "docs");
eval(fs.readFileSync(path.join(docs, "wardrobe-data.js"), "utf8") + ";globalThis.LW_DATA=LW_DATA;");
eval(fs.readFileSync(path.join(docs, "quran-text.js"), "utf8").replace(/^const QURAN_TEXT/m, "globalThis.QURAN_TEXT"));
const LW = require(path.join(docs, "wardrobe.js"));
const D = LW_DATA;
// 1-to-1 table: 28 letters, 28 distinct properties, each with a reason
assert.strictEqual(D.letters.length, 28);
assert.strictEqual(new Set(D.letters.map((r) => r.letter)).size, 28);
assert.strictEqual(new Set(D.letters.map((r) => r.property)).size, 28);
assert(D.letters.every((r) => r.reason && r.sifat.length && D.textures[r.property]));
assert(D.sources.length >= 2);
let n = 0; const ids = new Set();
for (const s of Object.keys(QURAN_TEXT)) for (const t of QURAN_TEXT[s]) {
  const a = LW.outfitFor(t);
  assert.deepStrictEqual(a, LW.outfitFor(t));                 // deterministic
  assert.strictEqual(a.view, "back");                         // never a face
  const seq = LW.letterOrders(t);
  assert.strictEqual(a.top.order, seq[0]);                    // first letter -> top
  assert.strictEqual(a.bottom.order, seq[seq.length - 1]);    // last letter -> bottom
  assert.strictEqual(a.outerwear.order, seq[Math.floor((seq.length - 1) / 2)]); // middle -> outerwear
  ids.add(a.id); n++;
}
assert.strictEqual(n, 6236);
const { masks, W } = D;  // head skin fully covered by hair (back of head only)
for (let y = 0; y < 19; y++) for (let x = 0; x < W; x++)
  assert(!(masks.skin[y][x] === "1" && masks.hair[y][x] === "0"), `face risk at ${x},${y}`);
assert.strictEqual(LW.outfitFor("بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ").id, "965e3afc");
console.log(`ok — ${n} ayahs, ${ids.size} distinct outfits, 28 letters ↔ 28 properties`);
