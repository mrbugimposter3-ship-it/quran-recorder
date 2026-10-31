/* 12-month surah-series wardrobe: one outfit per set of letters, same method as wardrobe.js.
   Months: 12 series of 9 surahs (1–9, 10–18 … 100–108). Each month has TWO outfits that never mix:
   one from only the odd-numbered surahs of its series, one from only the even-numbered surahs.
   Short surahs 109–114 are outside the months: each gets TWO outfits, one from its odd ayahs,
   one from its even ayahs. For every set, all its ayahs are joined into one text and the letters
   decide the clothes: top = first letter, outerwear = middle letter (cut by its strength),
   bottom = last letter, hair = word count mod 3. Letter sounds only; implies nothing about meaning. */
(function (root) {
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const SERIES_SIZE = 9, SHORT_START = 109, SHORT_END = 114;
  const inRange = (n, a, b) => n >= a && n <= b;

  /* Exact-colour matching: the 28 letter colours as human colour names (fashion terms for store
     searches). Every hex in wardrobe-data.js is listed; anything else falls back to the nearest. */
  const COLOUR_NAMES = {
    "#f4ecd8": "cream", "#d4a72c": "mustard gold", "#9a5e2c": "chestnut brown", "#b2682c": "copper",
    "#3d7f58": "forest green", "#416a99": "steel blue", "#387494": "teal blue", "#8f6a2a": "bronze",
    "#a5522e": "rust terracotta", "#547c43": "moss green", "#c07f2a": "amber tan", "#2f7f8f": "teal",
    "#367f74": "pine green", "#6b7a2e": "olive", "#7d722c": "olive gold", "#4a5f9e": "indigo blue"
  };
  function colourName(hex) {
    if (COLOUR_NAMES[hex]) return COLOUR_NAMES[hex];
    const h = (hex || "").replace("#", "");
    if (!/^[0-9a-f]{6}$/i.test(h)) return "";
    let best = "", d = 1e9;
    for (const [k, v] of Object.entries(COLOUR_NAMES)) {
      const a = k.replace("#", ""), dd = [0, 2, 4].reduce((s, i) => s + Math.abs(parseInt(h.slice(i, i + 2), 16) - parseInt(a.slice(i, i + 2), 16)), 0);
      if (dd < d) { d = dd; best = v; }
    }
    return best;
  }

  /* Plain store searches that include the colour (links only, no affiliate codes, no images):
     "<fabric> <garment> <colour name>" — Google Shopping also gets the exact hex. */
  const EXACT_STORES = [
    { id: "temu", name: "Temu", url: (q) => `https://www.temu.com/search_result.html?search_key=${q}` },
    { id: "macys", name: "Macy's", url: (q) => `https://www.macys.com/shop/search?keyword=${q}` },
    { id: "ebay", name: "eBay", url: (q) => `https://www.ebay.com/sch/i.html?_nkw=${q}` },
    { id: "etsy", name: "Etsy", url: (q) => `https://www.etsy.com/search?q=${q}` },
    { id: "amazon", name: "Amazon", url: (q) => `https://www.amazon.com/s?k=${q}` },
    { id: "walmart", name: "Walmart", url: (q) => `https://www.walmart.com/search?q=${q}` },
    { id: "asos", name: "ASOS", url: (q) => `https://www.asos.com/search/?q=${q}` },
    { id: "gshop", name: "Google Shopping", url: (q) => `https://www.google.com/search?tbm=shop&q=${q}`, hex: true }
  ];
  function exactSearchLinks(LW, spec, slot) {
    const base = LW.searchQuery(spec, slot), colour = colourName(spec[slot].colour);
    const plain = encodeURIComponent(`${base} ${colour}`);
    const withHex = encodeURIComponent(`${base} ${colour} ${spec[slot].colour}`);
    return EXACT_STORES.map((s) => ({ store: s.name, query: s.hex ? `${base} ${colour} ${spec[slot].colour}` : `${base} ${colour}`, url: s.url(s.hex ? withHex : plain) }));
  }

  /* Custom clothing makers (links + facts from their own pages; MOQs as published, Oct 2026, may change).
     tier "one-off" = a single garment in your exact colour (print fabric in the exact hex, then sew);
     "mtm" = made-to-measure tailors, closest colourway from fabric books;
     "batch" = small-batch manufacturers that dye fabric to your exact Pantone/RGB. */
  const CUSTOM_MAKERS = [
    { tier: "one-off", name: "Spoonflower", url: "https://www.spoonflower.com/", makes: "custom-printed fabric by the yard", note: "Upload a solid swatch of the exact hex — printed on silk, linen, rib knit and more. No minimum, then a sewist makes the garment." },
    { tier: "one-off", name: "Little Cocalico", url: "https://littlecocalico.com/custom-fabric", makes: "print-on-demand natural-fibre fabric", note: "Upload your colour in RGB; true-to-colour printing, order by the yard, no minimums." },
    { tier: "one-off", name: "Etsy custom clothing makers", url: "https://www.etsy.com/search?q=custom+made+to+measure+clothing", makes: "handmade made-to-measure garments", note: "Sewists make one garment to your measurements in the fabric/colour you send; results also have a colour filter." },
    { tier: "one-off", name: "MadeApt", url: "https://www.madeapt.com/custom-made-dresses", makes: "custom-made dresses", note: "Start from a colour reference, adjust fabric and shape; each dress is made to your measurements." },
    { tier: "mtm", name: "Hockerty", url: "https://www.hockerty.com/", makes: "made-to-measure suits, jackets, shirts", note: "Pick fabric and details online; closest colourway from their fabric books (not arbitrary hex)." },
    { tier: "mtm", name: "Sumissura", url: "https://www.sumissura.com/", makes: "made-to-measure womenswear", note: "Made-to-measure jackets, trousers, shirts; choose from their fabric collections." },
    { tier: "batch", name: "Banana Moon Clothing (UK)", url: "https://banana-moon-clothing.co.uk/pages/services-pantone-dyed-match", makes: "Pantone-dyed tees, sweats, hoodies, joggers", note: "Custom-dye raw garments to your exact Pantone (TCX best), lab-dip sign-off; MOQ 50 per colour." },
    { tier: "batch", name: "Create Fashion Brand (Portugal)", url: "https://createfashionbrand.com/private-label/customize-hq-clothes/", makes: "custom sweats & knits, Pantone TCX colours", note: "Custom colours by Pantone TCX; MOQ ≈100–150 per style." },
    { tier: "batch", name: "Impact Trading (UK)", url: "https://www.impacttrading.co.uk/information/what-we-do/pantone-matched-t-shirts--polo-shirts-and-aprons", makes: "Pantone-matched t-shirts, polos, aprons", note: "Fabric dyed to your Pantone/CMYK, swatch approval before dyeing; MOQ 150." },
    { tier: "batch", name: "Fabriclore", url: "https://fabriclore.com/blogs/have-your-own-custom-color-and-want-us-to-dye-fabric-for-you", makes: "custom fabric dyeing (silk, cotton, linen, viscose)", note: "Send Pantone, RGB or a hex and they dye fabric to match, lab dips first; MOQ 100 m per shade — then any cut & sew." }
  ];

  /* Month m (1–12) → the 9 surahs of its series, e.g. m=3 → 19..27. */
  function seriesSurahs(m) {
    if (!inRange(m, 1, 12)) return null;
    const start = (m - 1) * SERIES_SIZE + 1;
    return Array.from({ length: SERIES_SIZE }, (_, i) => start + i);
  }

  /* Joined Uthmani text of the set: whole surahs, or an ayah-number filter (odd/even ayahs). */
  function textOf(Q, surahs, ayahFilter) {
    let t = "";
    for (const s of surahs) (Q[s] || []).forEach((a, i) => { if (!ayahFilter || ayahFilter(i + 1)) t += " " + a; });
    return t.trim();
  }

  function oneOutfit(LW, Q, surahs, ayahFilter) {
    const text = textOf(Q, surahs, ayahFilter);
    return { text, spec: LW.outfitFor(text) };
  }

  /* One month: { odd: {surahs, spec…}, even: {surahs, spec…} } — odd and even never mix. */
  function monthOutfits(LW, Q, m) {
    const all = seriesSurahs(m);
    if (!all) return null;
    const odd = all.filter((n) => n % 2 === 1), even = all.filter((n) => n % 2 === 0);
    return {
      type: "month", month: m, name: MONTHS[m - 1], surahs: all,
      odd: Object.assign({ surahs: odd, ayahs: null }, oneOutfit(LW, Q, odd)),
      even: Object.assign({ surahs: even, ayahs: null }, oneOutfit(LW, Q, even)),
    };
  }

  /* One short surah (109–114): { odd: {ayahs list, spec…}, even: {ayahs list, spec…} }. */
  function shortOutfits(LW, Q, S, n) {
    const meta = S.find((s) => s.n === n);
    if (!meta || !inRange(n, SHORT_START, SHORT_END)) return null;
    const odd = [], even = [];
    for (let a = 1; a <= meta.ayahs; a++) (a % 2 ? odd : even).push(a);
    return {
      type: "short", surah: n, name: meta.name, ar: meta.ar, ayahs: meta.ayahs,
      odd: Object.assign({ surahs: [n], ayahs: odd }, oneOutfit(LW, Q, [n], (a) => a % 2 === 1)),
      even: Object.assign({ surahs: [n], ayahs: even }, oneOutfit(LW, Q, [n], (a) => a % 2 === 0)),
    };
  }

  /* Everything: 12 months × 2 + 6 short surahs × 2 = 36 outfits. */
  function allOutfits(LW, Q, S) {
    const months = [], shorts = [];
    for (let m = 1; m <= 12; m++) months.push(monthOutfits(LW, Q, m));
    for (let n = SHORT_START; n <= SHORT_END; n++) shorts.push(shortOutfits(LW, Q, S, n));
    return { months, shorts, count: months.length * 2 + shorts.length * 2 };
  }

  const api = { MONTHS, SERIES_SIZE, SHORT_START, SHORT_END, seriesSurahs, textOf, oneOutfit, monthOutfits, shortOutfits, allOutfits, COLOUR_NAMES, colourName, EXACT_STORES, exactSearchLinks, CUSTOM_MAKERS };
  if (typeof module !== "undefined") module.exports = api;
  root.WardrobeCalendar = api;
})(typeof window !== "undefined" ? window : globalThis);
