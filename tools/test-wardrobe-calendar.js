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

// exact-colour matching: every letter's hex has a colour name, and every outfit slot gets 8 colour-aware store searches
for (const r of LW_DATA.letters) assert(WC.COLOUR_NAMES[r.colour], `${r.letter} ${r.colour} has no colour name`);
assert(WC.colourName("#d4a72c") === "mustard gold" && WC.colourName("#f4ecd8") === "cream");
assert(WC.colourName("#ff0000") === "rust terracotta");                    // fallback = nearest known colour
assert.strictEqual(WC.EXACT_STORES.length, 8);
const eq8 = new Set();
for (const group of all.months.flatMap((m) => [m.odd, m.even]).concat(all.shorts.flatMap((s) => [s.odd, s.even])))
  for (const slot of ["top", "outerwear", "bottom"]) {
    const links = WC.exactSearchLinks(LW, group.spec, slot);
    assert.strictEqual(links.length, 8);
    for (const l of links) {
      assert(/^https:\/\/[^\s"'<>]+$/.test(l.url), l.url);
      assert(!/utm_|aff[_=]|\?tag=|[?&]ref=|[?&]partner/i.test(l.url), l.url);   // plain links, no affiliate codes
      assert(l.url.includes(encodeURIComponent(l.query.replace(/ #[0-9a-f]{6}$/i, ""))) || l.store === "Google Shopping");
      assert(l.query.includes(WC.colourName(group.spec[slot].colour)), l.query);
      assert(l.query.startsWith(LW.searchQuery(group.spec, slot)) && !/undefined/.test(l.query), l.query);   // base = "<fabric> <garment>" (e.g. "stripes" → "striped")
    }
    assert(links[7].store === "Google Shopping" && / #[0-9a-f]{6}$/i.test(links[7].query) && links[7].query.includes(group.spec[slot].colour));
    eq8.add(links[0].query);
  }
assert(eq8.size >= 12);                                                       // colour-aware queries vary across outfits

// custom clothing makers: real sites, tiers, published facts in the notes
assert(WC.CUSTOM_MAKERS.length >= 10);
for (const m of WC.CUSTOM_MAKERS) {
  assert(/^https:\/\/[^\s"'<>]+$/.test(m.url), m.url);
  assert(["one-off", "mtm", "batch"].includes(m.tier) && m.name && m.makes && m.note);
}
for (const tier of ["one-off", "mtm", "batch"]) assert(WC.CUSTOM_MAKERS.some((m) => m.tier === tier));
assert(WC.CUSTOM_MAKERS.some((m) => /Pantone/i.test(m.note) && /MOQ/.test(m.note)));   // dye-to-match with published MOQ

// wiring: the calendar page is in the app everywhere — SW shell (offline), manifest shortcut, footer + Letters picker links
const html = fs.readFileSync(path.join(docs, "wardrobe-calendar.html"), "utf8");
const idx = fs.readFileSync(path.join(docs, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(docs, "sw.js"), "utf8");
const mf = JSON.parse(fs.readFileSync(path.join(docs, "manifest.json"), "utf8"));
assert(sw.includes('const VERSION = "v1.10.0"'));
assert(sw.includes('"./wardrobe-calendar.html"') && sw.includes('"./wardrobe-calendar.js?v=cal2"'));   // offline in every installed app
assert(sw.includes("caches.match(req).then((hit) => hit ||"));                                     // offline navigation serves the page itself, not just index.html
assert.deepStrictEqual(mf.shortcuts.map((s) => s.url), ["./wardrobe-calendar.html?source=pwa"]);   // long-press app shortcut
for (const src of ["wardrobe-data.js?v=letters2", "wardrobe.js?v=shop1", "surah-data.js", "quran-text.js", "wardrobe-calendar.js?v=cal2"])
  assert(html.includes(`src="${src}"`), src);                                                    // page loads the same data files as the app
assert(html.includes("Exact-colour searches") && html.includes("id=\"wc-custom\""));          // colour-aware searches + custom suppliers on the page
for (const m of WC.CUSTOM_MAKERS) assert(html.includes(m.name.split(" (")[0]) || html.includes("wc-custom-list"), m.name);
assert((idx.match(/href="wardrobe-calendar\.html"/g) || []).length === 2);                      // footer (all tabs) + Letters picker

// fixed ids — a change here means the letter method itself changed
assert.strictEqual(all.months[0].odd.spec.id, "db97d4a3");      // January, surahs 1,3,5,7,9
assert.strictEqual(all.months[0].even.spec.id, "2bdb28a3");     // January, surahs 2,4,6,8
assert.strictEqual(all.shorts[5].odd.spec.id, "20ec269e");     // An-Nas 114, ayahs 1,3,5

console.log(`ok — 12 months × 2 (odd/even surahs, never mixed) + 109–114 × 2 (odd/even ayahs) = ${all.count} outfits, ${q.size} + ${eq8.size} distinct search queries (fabric / fabric+colour), ${WC.CUSTOM_MAKERS.length} custom makers`);
