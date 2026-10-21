// 🤲 «الإنفاق في سبيل الله» — Spending in Allah's cause (Urdu: اللہ کی راہ میں خرچ)
// One ayah (or pair) per day, rotating by local calendar date.
// Arabic comes from the bundled QURAN_TEXT (Tanzil Uthmani); checked letter-for-letter against
// api.alquran.cloud quran-uthmani on 2026-10-21 (only pause/annotation marks differ).
// English: M. M. Pickthall, "The Meaning of the Glorious Koran" (1930) — public domain.
// This section is ayat only. The Postiz referral link lives separately in the footer.
(function (root) {
  const ITEMS = [ { "surah": 2, "from": 261, "to": 261, "en": "The likeness of those who spend their wealth in Allah's way is as the likeness of a grain which groweth seven ears, in every ear a hundred grains. Allah giveth increase manifold to whom He will. Allah is All-Embracing, All-Knowing." }, { "surah": 2, "from": 245, "to": 245, "en": "Who is it that will lend unto Allah a goodly loan, so that He may give it increase manifold? Allah straiteneth and enlargeth. Unto Him ye will return." }, { "surah": 2, "from": 274, "to": 274, "en": "Those who spend their wealth by night and day, by stealth and openly, verily their reward is with their Lord, and there shall no fear come upon them neither shall they grieve." }, { "surah": 9, "from": 60, "to": 60, "en": "The alms are only for the poor and the needy, and those who collect them, and those whose hearts are to be reconciled, and to free the captives and the debtors, and for the cause of Allah, and (for) the wayfarer; a duty imposed by Allah. Allah is Knower, Wise." }, { "surah": 9, "from": 103, "to": 103, "en": "Take alms of their wealth, wherewith thou mayst purify them and mayst make them grow, and pray for them. Lo! thy prayer is an assuagement for them. Allah is Hearer, Knower." }, { "surah": 57, "from": 7, "to": 7, "en": "Believe in Allah and His messenger, and spend of that whereof He hath made you trustees; and such of you as believe and spend (aright), theirs will be a great reward." }, { "surah": 57, "from": 11, "to": 11, "en": "Who is he that will lend unto Allah a goodly loan, that He may double it for him and his may be a rich reward?" }, { "surah": 57, "from": 18, "to": 18, "en": "Lo! those who give alms, both men and women, and lend unto Allah a goodly loan, it will be doubled for them, and theirs will be a rich reward." }, { "surah": 61, "from": 10, "to": 11, "en": "O ye who believe! Shall I show you a commerce that will save you from a painful doom? Ye should believe in Allah and His messenger, and should strive for the cause of Allah with your wealth and your lives. That is better for you, if ye did but know." }, { "surah": 63, "from": 10, "to": 10, "en": "And spend of that wherewith We have provided you before death cometh unto one of you and he saith: My Lord! If only thou wouldst reprieve me for a little while, then I would give alms and be among the righteous." }, { "surah": 64, "from": 16, "to": 16, "en": "So keep your duty to Allah as best ye can, and listen, and obey, and spend; that is better for your souls. And whoso is saved from his own greed, such are the successful." }, { "surah": 3, "from": 92, "to": 92, "en": "Ye will not attain unto piety until ye spend of that which ye love. And whatsoever ye spend, Allah is Aware thereof." } ];
  // days since 1970-01-01 in the *local* calendar, so it flips at local midnight
  function dayNumber(d) {
    d = d || new Date();
    return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  }
  function forDate(d) {
    const n = ITEMS.length;
    return ITEMS[((dayNumber(d) % n) + n) % n];
  }
  function ref(it) { return it.surah + ":" + it.from + (it.to !== it.from ? "–" + it.to : ""); }
  function arabic(it, qt) {
    const arr = (qt || {})[String(it.surah)] || [];
    const out = [];
    for (let a = it.from; a <= it.to; a++) if (arr[a - 1]) out.push(arr[a - 1] + " ﴿" + toArabicDigits(a) + "﴾");
    return out.join(" ");
  }
  function toArabicDigits(n) { return String(n).replace(/\d/g, (c) => "٠١٢٣٤٥٦٧٨٩"[c]); }
  const api = { ITEMS, dayNumber, forDate, ref, arabic, toArabicDigits };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.QSpend = api;
})(typeof window !== "undefined" ? window : globalThis);
