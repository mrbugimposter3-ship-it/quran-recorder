/* Speak / smart-search parser: "يس ٤٩", "Yasin 49", "36 49", "surah 2 ayah 255" → {surah, ayah}
   Works in the browser (window.parsePick) and in node (module.exports) for tests. */
(function (root) {
  const AR_DIG = { "٠":0,"١":1,"٢":2,"٣":3,"٤":4,"٥":5,"٦":6,"٧":7,"٨":8,"٩":9,"۰":0,"۱":1,"۲":2,"۳":3,"۴":4,"۵":5,"۶":6,"۷":7,"۸":8,"۹":9 };
  function normAr(s) {
    return s.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, "")
      .replace(/[إأآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي");
  }
  // Arabic number words (normalized forms)
  const AR_UNITS = { "صفر":0,"واحد":1,"واحده":1,"احد":1,"اثنان":2,"اثنين":2,"اثنتان":2,"اثنتين":2,"اثنا":2,"اثنتا":2,"ثلاث":3,"ثلاثه":3,"اربع":4,"اربعه":4,
    "خمس":5,"خمسه":5,"ست":6,"سته":6,"سبع":7,"سبعه":7,"ثمان":8,"ثماني":8,"ثمانيه":8,"تسع":9,"تسعه":9 };
  const AR_TENS = { "عشر":10,"عشره":10,"عشرون":20,"عشرين":20,"ثلاثون":30,"ثلاثين":30,"اربعون":40,"اربعين":40,"خمسون":50,"خمسين":50,"ستون":60,"ستين":60,
    "سبعون":70,"سبعين":70,"ثمانون":80,"ثمانين":80,"تسعون":90,"تسعين":90 };
  const AR_HUND = { "مائه":100,"مئه":100,"ميه":100,"مايه":100,"مئتان":200,"مئتين":200,"مائتان":200,"مائتين":200,"ميتين":200 };
  const EN_NUM = { zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,
    sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90 };
  const AR_ORD = { "اول":1,"اولي":1,"ثاني":2,"ثانيه":2,"ثالث":3,"ثالثه":3,"رابع":4,"رابعه":4,"خامس":5,"خامسه":5,"سادس":6,"سادسه":6,
    "سابع":7,"سابعه":7,"ثامن":8,"ثامنه":8,"تاسع":9,"تاسعه":9,"عاشر":10,"عاشره":10 };
  function arWordVal(w) {
    const o = w.replace(/^ال/, "");
    if (w !== o && o in AR_ORD) return { v: AR_ORD[o], k: "u" };
    if (w in AR_UNITS) return { v: AR_UNITS[w], k: "u" };
    if (w in AR_TENS) return { v: AR_TENS[w], k: w.startsWith("عشر") && w.length <= 4 ? "teen" : "t" };
    if (w in AR_HUND) return { v: AR_HUND[w], k: "h" };
    const m = w.match(/^(ثلاث|اربع|خمس|ست|سبع|ثمان|تسع)(مائه|مئه)$/);       // ثلاثمائة …
    if (m) return { v: AR_UNITS[m[1]] * 100, k: "h" };
    return null;
  }
  // turn runs of number words into digit tokens
  function wordsToNums(tokens) {
    const out = []; let cur = null, last = null;
    const flush = () => { if (cur !== null) out.push(String(cur)); cur = null; last = null; };
    for (let t of tokens) {
      let w = t, joined = false;
      if (cur !== null && /^و./.test(w) && (arWordVal(w.slice(1)))) { w = w.slice(1); joined = true; }
      if (cur !== null && (w === "and" || w === "و")) continue;
      let a = arWordVal(w);
      if (!a && w in EN_NUM) a = { v: EN_NUM[w], k: EN_NUM[w] >= 20 ? "t" : "u" };
      if (!a && w === "hundred" && cur !== null) { cur = (cur % 100 || 1) * 100 + Math.floor(cur / 100) * 0; last = "h"; continue; }
      if (!a) { flush(); out.push(t); continue; }
      if (cur === null) { cur = a.v; last = a.k; continue; }
      if (a.k === "teen" && last === "u") { cur += 10; last = "t"; continue; }       // ثلاث عشرة
      if (joined || last === "h" || (last === "t" && a.k === "u") || (last === "u" && a.k === "t")) { cur += a.v; last = a.k; continue; }
      flush(); cur = a.v; last = a.k;
    }
    flush(); return out;
  }
  // English name skeleton for fuzzy compare
  function skel(s) {
    return s.toLowerCase().replace(/^(surah|sura|surat|soorah)\s*/, "")
      .replace(/^(a[lnrstdzh]{1,2}|ash|ad|adh|az)[-\s']+/, "").replace(/[^a-z]/g, "")
      .replace(/ee|ie/g, "i").replace(/oo|ou|ow/g, "u").replace(/aa/g, "a").replace(/e/g, "a").replace(/q|c/g, "k")
      .replace(/(.)\1+/g, "$1").replace(/h$/, "");
  }
  function lev(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
    return d[a.length][b.length];
  }
  const EN_ALIAS = { yasin:36, yaseen:36, yasiin:36, "ya sin":36, "ya seen":36, taha:20, "ta ha":20, sad:38, saad:38, qaf:50, kaf:50, nun:68, noon:68, qalam:68,
    fatiha:1, fateha:1, alhamd:1, opening:1, cow:2, bakara:2, imran:3, women:4, table:5, cattle:6, heights:7, spoils:8, tauba:9, repentance:9, jonah:10, younus:10,
    joseph:12, yousuf:12, yousef:12, thunder:13, abraham:14, bee:16, isra:17, israa:17, "bani israil":17, cave:18, kahaf:18, mary:19, mariam:19, prophets:21,
    pilgrimage:22, believers:23, light:24, criterion:25, poets:26, ant:27, ants:27, story:28, spider:29, romans:30, rum:30, lukman:31, prostration:32, sajda:32,
    sajdah:32, confederates:33, ahzab:33, saba:34, sheba:34, originator:35, fatir:35, rangers:37, saffat:37, groups:39, zumar:39, forgiver:40, ghafir:40, mumin:40,
    fussilat:41, consultation:42, shura:42, ornaments:43, zukhruf:43, smoke:44, dukhan:44, kneeling:45, jathiya:45, dunes:46, ahqaf:46, muhammad:47, victory:48,
    fath:48, rooms:49, hujurat:49, winds:51, dhariyat:51, mount:52, tur:52, star:53, najm:53, moon:54, qamar:54, rahman:55, rehman:55, merciful:55, event:56,
    waqia:56, waqiah:56, waqiya:56, waqiyah:56, iron:57, hadid:57, mujadila:58, exile:59, hashr:59, mumtahina:60, saff:61, ranks:61, friday:62, jumuah:62, jumua:62,
    jummah:62, hypocrites:63, munafiqun:63, taghabun:64, divorce:65, talaq:65, tahrim:66, kingdom:67, sovereignty:67, mulk:67, pen:68, reality:69, haqqa:69,
    maarij:70, noah:71, nooh:71, nuh:71, jinn:72, muzzammil:73, muddaththir:74, mudathir:74, muddathir:74, resurrection:75, qiyama:75, qiyamah:75, insan:76, dahr:76,
    human:76, mursalat:77, naba:78, tidings:78, naziat:79, abasa:80, frowned:80, takwir:81, infitar:82, mutaffifin:83, inshiqaq:84, buruj:85, constellations:85,
    tabarak:67, tabaraka:67, kursi:2, tariq:86, tarik:86, ala:87, alaa:87, most:87, ghashiya:88, ghashiyah:88, fajr:89, dawn:89, balad:90, city:90, shams:91, sun:91, layl:92, lail:92, night:92,
    duha:93, dhuha:93, morning:93, sharh:94, inshirah:94, tin:95, teen:95, fig:95, alaq:96, clot:96, iqra:96, qadr:97, power:97, bayyina:98, bayyinah:98,
    zalzala:99, zilzal:99, zalzalah:99, earthquake:99, adiyat:100, qaria:101, qariah:101, takathur:102, asr:103, time:103, humaza:104, fil:105, feel:105,
    elephant:105, quraish:106, quraysh:106, maun:107, kawthar:108, kausar:108, kauthar:108, kawsar:108, kafirun:109, kafiroon:109, disbelievers:109, nasr:110,
    masad:111, lahab:111, ikhlas:112, ikhlaas:112, sincerity:112, falaq:113, daybreak:113, nas:114, naas:114, mankind:114 };
  const AR_ALIAS = { "ياسين":36, "يس":36, "يا سين":36, "طه":20, "طاها":20, "ص":38, "صاد":38, "ق":50, "قاف":50, "ن":68, "نون":68, "القلم":68, "الحمد":1,
    "الاسراء":17, "بني اسرائيل":17, "الدهر":76, "تبارك":67, "عم":78, "الانشراح":94, "الشرح":94, "المسد":111, "تبت":111, "الهمزه":104, "اقرا":96 };
  let IDX = null;
  function buildIdx(S) {
    IDX = S.map((s) => ({ n: s.n, en: skel(s.name), ar: normAr(s.ar).replace(/^ال/, "").replace(/\s+/g, "") }));
    for (const k in EN_ALIAS) IDX.push({ n: EN_ALIAS[k], en: skel(k), alias: true });
    for (const k in AR_ALIAS) IDX.push({ n: AR_ALIAS[k], ar: normAr(k).replace(/^ال/, "").replace(/\s+/g, ""), alias: true });
  }
  function matchName(text) {
    const t = text.trim(); if (!t) return null;
    if (/[\u0600-\u06FF]/.test(t)) {
      const a = normAr(t).replace(/\s+/g, "").replace(/^ال/, "");
      let best = null;
      for (const e of IDX) { if (!e.ar) continue; const d = lev(a, e.ar);
        const lim = e.ar.length <= 2 ? 0 : e.ar.length <= 4 ? 1 : 2;
        if (d <= lim && (!best || d < best.d)) best = { n: e.n, d }; }
      return best;
    }
    const k = skel(t); if (!k) return null;
    let best = null;
    for (const e of IDX) { if (!e.en) continue; const d = lev(k, e.en);
      const lim = e.en.length <= 3 ? 0 : e.en.length <= 6 ? 1 : 2;
      if (d <= lim && (!best || d < best.d || (d === best.d && !e.alias))) best = { n: e.n, d }; }
    return best;
  }
  const FILLER = /^(surah|sura|surat|soorah|chapter|ayah|aya|ayat|ayaat|verse|number|no|of|the|and|in|to|go|open|stamp|please|ok|okay|سجل|لو|سمحت|سوره|سورت|سورة|ايه|الايه|ايات|رقم|من|في|اية|آية|افتح|اذهب)$/;
  function parsePick(input, S) {
    S = S || root.SURAHS; if (!IDX) buildIdx(S);
    let s = String(input || "").replace(/[٠-٩۰-۹]/g, (c) => AR_DIG[c]);
    s = normAr(s).toLowerCase().replace(/[،,:؛;.\-–—\/]+/g, " ").replace(/(\d)([^\d\s])/g, "$1 $2").replace(/([^\d\s])(\d)/g, "$1 $2");
    // "ayah X of surah Y" ordering
    const ayahFirst = /^\s*(ayah|aya|ayat|verse|ايه|الايه|اية)\b/.test(s);
    let toks = s.split(/\s+/).filter(Boolean).map((w) => w.replace(/^ال(?=\S)/, (m) => m)); // keep
    toks = wordsToNums(toks);
    const nums = [], words = [];
    for (const t of toks) { if (/^\d+$/.test(t)) nums.push(Number(t)); else if (!FILLER.test(t) && !(/^و$/.test(t))) words.push(t); }
    let surah = null, ayah = null;
    const nameText = words.join(" ");
    const m = nameText ? matchName(nameText) || words.map(matchName).filter(Boolean).sort((a, b) => a.d - b.d)[0] : null;
    if (m) { surah = m.n; ayah = nums.length ? nums[0] : null; }
    else if (nameText && nums.length < 2) return { ok: false, reason: `لم أتعرف على السورة «${nameText}»` };
    else if (nums.length >= 2) { [surah, ayah] = ayahFirst ? [nums[1], nums[0]] : [nums[0], nums[1]]; }
    else if (nums.length === 1) {
      if (nums[0] >= 1 && nums[0] <= 114) surah = nums[0];
      else if (nums[0] <= 6236) { let g = nums[0]; for (const x of S) { if (g <= x.ayahs) return { surah: x.n, ayah: g, global: nums[0], ok: true }; g -= x.ayahs; } }
    }
    if (!surah || surah < 1 || surah > 114) return { ok: false, reason: nameText ? `لم أتعرف على السورة «${nameText}»` : "no surah found" };
    const cnt = S[surah - 1].ayahs;
    if (ayah == null) ayah = 1;
    if (ayah < 1 || ayah > cnt) return { ok: false, surah, reason: `${S[surah - 1].ar} has ${cnt} ayat` };
    return { surah, ayah, ok: true };
  }
  const api = { parsePick, skel, normAr, wordsToNums, _reset: () => { IDX = null; } };
  if (typeof module !== "undefined") module.exports = api; else Object.assign(root, api);
})(typeof window !== "undefined" ? window : globalThis);
