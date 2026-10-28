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

  const api = { MONTHS, SERIES_SIZE, SHORT_START, SHORT_END, seriesSurahs, textOf, oneOutfit, monthOutfits, shortOutfits, allOutfits };
  if (typeof module !== "undefined") module.exports = api;
  root.WardrobeCalendar = api;
})(typeof window !== "undefined" ? window : globalThis);
