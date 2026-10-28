// node tools/test-wardrobe-calendar.js — 12-month wardrobe (wardrobe-calendar.js) checks.
const fs = require("fs"), path = require("path"), assert = require("assert");
const docs = path.join(__dirname, "..", "docs");
eval(fs.readFileSync(path.join(docs, "wardrobe-data.js"), "utf8") + ";globalThis.LW_DATA=LW_DATA;");
eval(fs.readFileSync(path.join(docs, "quran-text.js"), "utf8").replace(/^const QURAN_TEXT/m, "globalThis.QURAN_TEXT"));
eval(fs.readFileSync(path.join(docs, "surah-data.js"), "utf8").replace(/^const SURAHS/m, "globalThis.SURAHS"));
const LW = require(path.join(docs, "wardrobe.js"));
const WC = require(path.join(docs, "wardrobe-calendar.js"));

// 12 series of 9 surahs cover 1..108 exactly, in order, disjoint
const series = [];
for (let m = 1; m <= 12; m++) series.push(WC.seriesSurahs(m));
assert.deepStrictEqual(series.flat(), Array.from({ length: 108 }, (_, i) => i + 1));
assert.deepStrictEqual(series[0], [1, 2, 3, 4, 5, 6, 7, 8, 9]);
assert.deepStrictEqual(series[11], [100, 101, 102, 103, 104, 105, 106, 107, 108]);
assert.strictEqual(WC.seriesSurahs(0), null);

// odd + even never mix and together are exactly the series
const all = WC.allOutfits(LW, QURAN_TEXT, SURAHS);
assert.strictEqual(all.count, 36);           // 12 months × 2 + 6 short surahs × 2
assert.strictEqual(all.months.length, 12);
assert.strictEqual(all.shorts.length, 6);
for (const m of all.months) {
  const surahs = WC.seriesSurahs(m.month);
  assert.deepStrictEqual(m.odd.surahs, surahs.filter((n) => n % 2 === 1));
  assert.deepStrictEqual(m.even.surahs, surahs.filter((n) => n % 2 === 0));
  assert.deepStrictEqual([...m.odd.surahs, ...m.even.surahs].sort((a, b) => a - b), surahs);
  for (const half of [m.odd, m.even]) {
    // deterministic, and the letters really come only from that half's surahs
    assert.deepStrictEqual(half.spec, LW.outfitFor(half.text));
    const seq = LW.letterOrders(half.text);
    assert.strictEqual(half.spec.top.order, seq[0]);
    assert.strictEqual(half.spec.bottom.order, seq[seq.length - 1]);
    assert.strictEqual(half.spec.outerwear.order, seq[Math.floor((seq.length - 1) / 2)]);
    assert.strictEqual(half.spec.stats.letters, seq.length);
  }
  // no letter of an excluded surah's text can leak: recompute from the raw sets
  const rebuilt = WC.oneOutfit(LW, QURAN_TEXT, m.odd.surahs, null);
  assert.strictEqual(rebuilt.spec.id, m.odd.spec.id);
}

// short surahs 109–114: odd ayahs + even ayahs = full ayah count, never mixed
const expected = { 109: 6, 110: 3, 111: 5, 112: 4, 113: 5, 114: 6 };
for (const sh of all.shorts) {
  assert.strictEqual(sh.ayahs, expected[sh.surah]);
  assert.strictEqual(sh.odd.ayahs.length + sh.even.ayahs.length, sh.ayahs);
  assert(sh.odd.ayahs.every((a) => a % 2 === 1) && sh.even.ayahs.every((a) => a % 2 === 0));
  for (const half of [sh.odd, sh.even]) {
    assert.deepStrictEqual(half.spec, LW.outfitFor(half.text));
    const seq = LW.letterOrders(half.text);
    assert.strictEqual(half.spec.top.order, seq[0]);
    assert.strictEqual(half.spec.bottom.order, seq[seq.length - 1]);
    assert.strictEqual(half.spec.outerwear.order, seq[Math.floor((seq.length - 1) / 2)]);
  }
}

// Temu + Macy's search links for every one of the 36 × 3 slots: same method as wardrobe.js
const q = new Set();
for (const group of [all.months.flatMap((m) => [m.odd, m.even]), all.shorts.flatMap((s) => [s.odd, s.even])].flat())
  for (const slot of ["top", "outerwear", "bottom"]) {
    const L = LW.searchLinks(group.spec, slot), e = encodeURIComponent(L.query);
    assert.strictEqual(L.temu, `https://www.temu.com/search_result.html?search_key=${e}`);
    assert.strictEqual(L.macys, `https://www.macys.com/shop/search?keyword=${e}`);
    assert(!/utm_|aff[_=]|\?tag=|[?&]ref=|[?&]partner/i.test(L.temu + L.macys));   // real affiliate params only ("waffle" is not one)
    assert(L.query && !/undefined/.test(L.query));
    q.add(L.query);
  }
assert.strictEqual(q.size, 29);   // deduped "<fabric> <garment>" queries across all 36 outfits

// fixed ids — a change here means the letter method itself changed
assert.strictEqual(all.months[0].odd.spec.id, "db97d4a3");      // January, surahs 1,3,5,7,9
assert.strictEqual(all.months[0].even.spec.id, "2bdb28a3");     // January, surahs 2,4,6,8
assert.strictEqual(all.shorts[5].odd.spec.id, "20ec269e");     // An-Nas 114, ayahs 1,3,5

console.log(`ok — 12 months × 2 (odd/even surahs, never mixed) + 109–114 × 2 (odd/even ayahs) = ${all.count} outfits, ${q.size} distinct search queries`);
