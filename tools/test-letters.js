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
// Real clothes: every one of the 28 properties has a real product for each slot (84 links, no images)
const P = D.products;
assert(P && P.as_of === "2026-10-21" && /may change/.test(P.note));
const urls = new Set();
for (const r of D.letters) for (const slot of ["top", "outerwear", "bottom"]) {
  const e = P.by_property[r.property] && P.by_property[r.property][slot];
  assert(e, `missing product ${r.property}/${slot}`);
  assert(/^https:\/\/[^\s"'<>]+$/.test(e.url), e.url);
  assert(e.name && e.store && /^(CA|US)\$[\d,]+\.\d\d$/.test(e.price), JSON.stringify(e));
  assert(!Object.keys(e).some((k) => /image|img|photo|thumb/i.test(k)), "no retailer images");
  urls.add(e.url);
}
assert.strictEqual(urls.size, 84);
const bis = LW.outfitFor("بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ"), pf = LW.productsFor(bis);
assert.deepStrictEqual(pf.map((x) => x.slot), ["top", "outerwear", "bottom"]);
for (const x of pf) assert.strictEqual(x.url, P.by_property[bis[x.slot].property][x.slot].url);
const html = LW.shopHTML(bis);
assert(/Prices as of Oct 21, 2026, may change/.test(html) && !/<img/i.test(html) && (html.match(/<a /g) || []).length === 3);
assert(/rel="noopener noreferrer nofollow"/.test(html));
console.log(`ok — ${n} ayahs, ${ids.size} distinct outfits, 28 letters ↔ 28 properties, ${urls.size} real product links`);
