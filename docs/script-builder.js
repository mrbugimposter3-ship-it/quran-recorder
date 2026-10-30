/* ============================================================
   Arabic script builder — turns a day's log entries into a
   fully Arabic markdown script.
   Works in the browser (window.ScriptBuilder) and in Node
   (module.exports) so the GitHub Action uses the same code.
   ============================================================ */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(
      require("./surah-data.js"),
      require("./quran-text.js"),
      require("./number-words.js"),
      require("./word-translations.js"),
      require("./word-translations-ur.js")
    );
  } else {
    root.ScriptBuilder = factory(root.SURAHS, root.QURAN_TEXT, root.NUMBER_WORDS, root.WORD_TRANSLATIONS, root.WORD_TRANSLATIONS_UR);
  }
})(typeof self !== "undefined" ? self : this, function (SURAHS, QURAN_TEXT, NUMBER_WORDS, WORD_TRANSLATIONS, WORD_TRANSLATIONS_UR) {
  "use strict";

  var TZ = "America/New_York";
  var AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
  var AR_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو",
                   "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  var BASMALA = "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ";

  function toArabicDigits(s) {
    return String(s).replace(/[0-9]/g, function (d) { return AR_DIGITS[+d]; });
  }

  function arabicDate(dateKey) {
    var p = dateKey.split("-");
    return toArabicDigits(+p[2]) + " " + AR_MONTHS[+p[1] - 1] + " " + toArabicDigits(p[0]);
  }

  function arabicTime(iso) {
    var d = new Date(iso);
    var s;
    try {
      s = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ });
    } catch (e) {
      s = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    }
    var m = s.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!m) return toArabicDigits(s);
    return toArabicDigits(+m[1]) + ":" + toArabicDigits(m[2]) + " " + (m[3].toUpperCase() === "AM" ? "ص" : "م");
  }

  function arabicDuration(ms) {
    var s = Math.floor((ms || 0) / 1000);
    return toArabicDigits(Math.floor(s / 60)) + ":" + toArabicDigits(String(s % 60).padStart(2, "0"));
  }

  function ayahText(surah, ayah) {
    var arr = QURAN_TEXT[String(surah)];
    return (arr && arr[ayah - 1]) || "";
  }

  function wordCount(text) {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  function surahName(n) {
    var s = SURAHS[n - 1];
    return s ? s.ar : String(n);
  }

  /* Word-by-word analysis from the quran-number-words app:
     each word's abjad-style letter-sum, its bucket (sum mod 28),
     the mapped English word, and its Arabic translation. */
  function wordTable(surah, ayah) {
    if (!NUMBER_WORDS) return "";
    var ws = NUMBER_WORDS.words(surah, ayah);
    if (!ws.length) return "";
    var T = WORD_TRANSLATIONS || {};
    var rows = [
      "**تحليل الكلمات — حساب الجُمَّل (٪ ٢٨):**",
      "",
      "| الكلمة | الجُمَّل | الحقيبة | English | بالعربية |",
      "|---|---|---|---|---|"
    ];
    ws.forEach(function (w) {
      var sum = NUMBER_WORDS.val(w);
      var en = NUMBER_WORDS.english(sum);
      var ar = T[en] || "—";
      rows.push("| " + w + " | " + toArabicDigits(sum) +
                " | " + toArabicDigits(NUMBER_WORDS.bucket(sum)) +
                " | " + en + " | " + ar + " |");
    });
    rows.push("");
    return rows.join("\n");
  }

  var PATTERN_AR = { kalima: "الكلمة", fibonacci: "فيبوناتشي" };

  /* entries: log entries for one day (array). Returns markdown string. */
  function buildArabicScript(dateKey, entries) {
    var recs = entries.filter(function (e) { return e.type === "recitation" || e.type === "ayah-stamp"; })
                      .sort(function (a, b) { return a.global - b.global || a.ts.localeCompare(b.ts); });
    var kalimaStamps = entries.filter(function (e) { return e.type === "kalima"; })
                              .sort(function (a, b) { return a.position - b.position; });
    var kalimaDone = entries.filter(function (e) { return e.type === "kalima-complete"; });

    var L = [];
    L.push("# وِرد اليوم — " + arabicDate(dateKey));
    L.push("");
    L.push(BASMALA);
    L.push("");

    var totalWords = 0;
    recs.forEach(function (e) { totalWords += wordCount(ayahText(e.surah, e.ayah)); });
    var recCount = recs.filter(function (e) { return e.type === "recitation"; }).length;
    var stampCount = recs.length - recCount;

    L.push("**التلاوات المُسجَّلة:** " + toArabicDigits(recCount) +
           "  ·  **آيات مختومة بالوقت:** " + toArabicDigits(stampCount) +
           "  ·  **عدد الكلمات:** " + toArabicDigits(totalWords));
    L.push("");
    L.push("---");
    L.push("");

    var lastSurah = null;
    recs.forEach(function (e) {
      var text = ayahText(e.surah, e.ayah);
      if (e.surah !== lastSurah) {
        L.push("## سورة " + surahName(e.surah) + " " + toArabicDigits(e.surah));
        L.push("");
        lastSurah = e.surah;
      }
      L.push("### الآية " + toArabicDigits(e.ayah) +
             "  ·  ترتيبها في المصحف: " + toArabicDigits(e.global));
      L.push("");
      L.push(text + " ﴿" + toArabicDigits(e.ayah) + "﴾");
      L.push("");
      if (e.type === "recitation") {
        L.push("> 🎙 سُجِّلت الساعة " + arabicTime(e.ts) +
               "  ·  المدة: " + arabicDuration(e.durationMs) +
               "  ·  الكلمات: " + toArabicDigits(wordCount(text)));
      } else {
        L.push("> ⏱ خُتِمت بالوقت الساعة " + arabicTime(e.ts) +
               "  ·  الكلمات: " + toArabicDigits(wordCount(text)));
      }
      L.push("");
      L.push(wordTable(e.surah, e.ayah));
    });

    if (kalimaStamps.length || kalimaDone.length) {
      // Group by pattern (kalima / fibonacci / …), surahs only (1–114)
      var groups = {};
      kalimaStamps.forEach(function (e) {
        var p = e.pattern || "kalima";
        (groups[p] = groups[p] || { stamps: [], done: [] }).stamps.push(e);
      });
      kalimaDone.forEach(function (e) {
        var p = e.pattern || "kalima";
        (groups[p] = groups[p] || { stamps: [], done: [] }).done.push(e);
      });
      Object.keys(groups).forEach(function (p) {
        var g = groups[p];
        var offset = (g.stamps[0] && g.stamps[0].offset) || (g.done[0] && g.done[0].offset) || 1;
        L.push("---");
        L.push("");
        L.push("## 🕋 نمط " + (PATTERN_AR[p] || p) +
               " — الإزاحة: السورة ١ = سورة " + surahName(offset) + " " + toArabicDigits(offset));
        L.push("");
        g.stamps.forEach(function (e) {
          L.push("- الموضع " + toArabicDigits(e.position) +
                 " ← سورة " + surahName(e.surah) + " " + toArabicDigits(e.surah) +
                 "  ·  ⏱ " + arabicTime(e.ts));
        });
        g.done.forEach(function (e) {
          L.push("");
          L.push("✨ **اكتمل النمط كاملًا** الساعة " + arabicTime(e.ts) +
                 " — التسلسل: " + e.sequence.map(toArabicDigits).join(" · "));
        });
        L.push("");
      });
    }

    L.push("---");
    L.push("");
    L.push("*أُنشئ هذا السكربت تلقائيًا بواسطة Quran Recorder*");
    L.push("");
    return L.join("\n");
  }

  /* ---------------- YouTube-ready script ----------------
     Matches the youtube-channel-kit format: timed sections,
     « » voiceover text, [B-ROLL] AI prompts, description block. */

  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function fmtClock(sec) { return Math.floor(sec / 60) + ":" + pad2(sec % 60); }
  function ayahWord(n) { return n === 1 ? "آية" : n === 2 ? "آيتان" : n <= 10 ? "آيات" : "آية"; }

  function buildYouTubeScript(dateKey, entries) {
    var recs = entries.filter(function (e) { return e.type === "recitation" || e.type === "ayah-stamp"; })
                      .sort(function (a, b) { return a.global - b.global || a.ts.localeCompare(b.ts); });
    if (!recs.length) return "";
    var kalimaDone = entries.filter(function (e) { return e.type === "kalima-complete"; });

    var WPM = 130;           // narration pace (per production guide: 15 min ≈ 1950 words)
    var HOOK_S = 45, OUTRO_S = 60, KALIMA_S = 35;
    var t = 0;
    var chapters = [];
    var narrationWords = 90 + 80; // hook + outro approx

    function seg(dur, title) {
      var start = t;
      t += dur;
      chapters.push({ time: fmtClock(start), title: title });
      return "[" + fmtClock(start) + "–" + fmtClock(t) + "]";
    }

    var L = [];
    var totalAyahWords = 0;
    recs.forEach(function (e) { totalAyahWords += wordCount(ayahText(e.surah, e.ayah)); });
    var estWords = narrationWords + totalAyahWords + recs.length * 55;
    var estMin = Math.max(1, Math.round(estWords / WPM));

    L.push("# 🎬 سكريبت — وِرد اليوم | " + arabicDate(dateKey));
    L.push("**السلسلة:** 🕯️ نور | **المدة التقديرية:** ~" + toArabicDigits(estMin) + " دقيقة (~" + toArabicDigits(estWords) +
           " كلمة) | **النبرة:** خاشعة، هادئة، تدبّرية");
    L.push("**موسيقى:** ناي/عود خافت مقام نهوند (−22dB) | **سرعة الصوت:** 0.92");
    L.push("**المصدر:** سجل تلاوات " + dateKey + " — " + toArabicDigits(recs.length) + " " + ayahWord(recs.length));
    L.push("");
    L.push("---");
    L.push("");

    // HOOK
    L.push("## " + seg(HOOK_S, "الخطاف") + " الخطاف (HOOK)");
    L.push("> 🎙️ صوت فقط على شاشة سوداء، ثم مصباح يشتعل ببطء");
    L.push("");
    L.push("«بسم الله الرحمن الرحيم. في يوم " + arabicDate(dateKey) + "… تُليت " + toArabicDigits(recs.length) +
           " " + ayahWord(recs.length) + " من كتاب الله… آيةً آية، وسُجِّلت كل واحدة بوقتها. الليلة نتوقف عند كل آية: نسمعها… نتدبّرها… ونفكّ شيفرة كلماتها بحساب الجُمَّل، حرفًا حرفًا. ابقَ معنا.»");
    L.push("");
    L.push("**[B-ROLL — للمونتاج/الذكاء الاصطناعي]:**");
    L.push("1. `Cinematic macro shot: an oil lamp igniting in darkness, warm golden light, slow motion, film grain, royal dark navy and gold palette, 4K, 16:9`");
    L.push("2. `Slow dolly through an old Arabic library at dusk, dust particles in golden light rays`");
    L.push("3. `Text overlay (خط أميري ذهبي #E9CE7A على كحلي #101A2B): \"وِرد " + arabicDate(dateKey) + "\"`");
    L.push("");
    L.push("---");
    L.push("");

    // one section per ayah
    recs.forEach(function (e) {
      var text = ayahText(e.surah, e.ayah);
      var wc = wordCount(text);
      var dur = Math.max(30, Math.round((wc + 55) / WPM * 60 / 5) * 5);
      var title = "سورة " + surahName(e.surah) + " — الآية " + e.ayah;
      L.push("## " + seg(dur, title) + " " + title);
      L.push("> 🎙️ " + (e.type === "recitation"
        ? "ابدأ بالتسجيل الأصلي للتلاوة إن وُجد، ثم التعليق بنبرة أهدأ"
        : "تلاوة خاشعة أولاً، ثم تعليق هادئ"));
      L.push("");

      // narration
      var narr = ["«" + text + " ﴿" + toArabicDigits(e.ayah) + "﴾", "",
        "صدق الله العظيم. من سورة " + surahName(e.surah) + "… الآية " + toArabicDigits(e.ayah) +
        "… وترتيبها في المصحف الآية " + toArabicDigits(e.global) + "."];

      // word-code highlights: up to 3 distinct highest-sum words
      if (NUMBER_WORDS) {
        var seen = {}, cand = [];
        NUMBER_WORDS.words(e.surah, e.ayah).forEach(function (w) {
          if (seen[w]) return;
          seen[w] = 1;
          cand.push({ w: w, sum: NUMBER_WORDS.val(w) });
        });
        cand.sort(function (a, b) { return b.sum - a.sum; });
        var picks = cand.slice(0, 3);
        if (picks.length) {
          var T = WORD_TRANSLATIONS || {};
          var parts = picks.map(function (p) {
            var en = NUMBER_WORDS.english(p.sum);
            var s = "«" + p.w + "» مجموعها " + toArabicDigits(p.sum) +
                    " فتقع في الحقيبة " + toArabicDigits(NUMBER_WORDS.bucket(p.sum));
            if (T[en]) s += " مرتبطةً بكلمة \"" + en + "\" أي «" + T[en] + "»";
            return s;
          });
          narr.push("وبحساب الجُمَّل نفكّ شيفرة كلماتها: " + parts.join("… ") + ".");
        }
      }
      narr.push("»");
      L.push(narr.join("\n"));
      L.push("");

      L.push("**[B-ROLL]:**");
      L.push("1. `Golden Arabic calligraphy of the verse materializing letter by letter on dark royal navy parchment, cinematic, film grain, 4K, 16:9`");
      L.push("2. `AI image: مشهد هادئ مستوحى من معنى الآية، ألوان كحلية وذهبية ملكية، إضاءة شمعة`");
      L.push("3. Text overlay: جدول تحليل الكلمات كاملاً (انظر سكريبت اليوم)");
      if (e.type === "recitation") {
        L.push("");
        L.push("> ⏱ ملاحظة إنتاج: التلاوة الأصلية سُجِّلت الساعة " + arabicTime(e.ts) +
               " — الملف: `recordings/" + dateKey + "/surah" + e.surah + "-ayah" + e.ayah + "-" + e.id + ".webm`");
      }
      L.push("");
      L.push("---");
      L.push("");
    });

    // kalima completion section
    kalimaDone.forEach(function (e) {
      var pat = (e.pattern || "kalima");
      var patAr = PATTERN_AR[pat] || pat;
      L.push("## " + seg(KALIMA_S, "اكتمال نمط " + patAr) + " خبر اليوم: اكتمال نمط " + patAr);
      L.push("«ولخبرٍ جميل يُختم اليوم: اكتمل نمط " + patAr + " كاملًا الساعة " + arabicTime(e.ts) +
             "… بتسلسل السور: " + e.sequence.map(toArabicDigits).join(" · ") + ".»");
      L.push("");
      L.push("**[B-ROLL]:** `Numbers of the sequence glowing one by one in gold on navy, particles, cinematic`");
      L.push("");
      L.push("---");
      L.push("");
    });

    // OUTRO
    L.push("## " + seg(OUTRO_S, "الخاتمة") + " الخاتمة ودعوة للتفاعل");
    L.push("> 🎙️ بنبرة أهدأ وأبطأ — الموسيقى ترتفع قليلاً ثم تخفت");
    L.push("");
    L.push("«هذا كان وِرد يوم " + arabicDate(dateKey) + "… " + toArabicDigits(recs.length) +
           " " + ayahWord(recs.length) + " نزلت على القلب حرفًا حرفًا. إن نفعك هذا التدبّر… فاشترك في القناة وفعّل الجرس، فغدًا — بإذن الله — وِردٌ جديد. تقبّل الله منا ومنكم صالح الأعمال.»");
    L.push("");
    L.push("**[B-ROLL]:**");
    L.push("1. `Candle flame gently fading to embers, dark royal background, slow motion`");
    L.push("2. شاشة نهاية 20 ثانية + بطاقة الفيديو السابق");
    L.push("");
    L.push("---");
    L.push("");

    // YouTube description block
    L.push("## 📋 جاهز للصق في وصف الفيديو");
    L.push("");
    L.push("**العنوان المقترح:** وِرد اليوم " + arabicDate(dateKey) + " — تدبّر " + toArabicDigits(recs.length) +
           " " + ayahWord(recs.length) + " بحساب الجُمَّل 🕯️");
    L.push("");
    L.push("**أول سطرين من الوصف:** في يوم " + arabicDate(dateKey) + " تُليت " + toArabicDigits(recs.length) +
           " " + ayahWord(recs.length) + " من كتاب الله وسُجِّلت بوقتها… نتدبّرها ونفكّ شيفرة كلماتها بحساب الجُمَّل.");
    L.push("");
    L.push("```");
    chapters.forEach(function (c) { L.push(c.time + " " + c.title); });
    L.push("```");
    L.push("");
    var surahNamesAr = [];
    recs.forEach(function (e) { var n = surahName(e.surah); if (surahNamesAr.indexOf(n) < 0) surahNamesAr.push(n); });
    L.push("**الوسوم:** قرآن، تدبر، حساب الجمل، ورد يومي، " + surahNamesAr.join("، "));
    L.push("**الهاشتاغات:** #ورد_اليوم #قرآن #تدبر #حساب_الجمل");
    L.push("");
    L.push("*أُنشئ هذا السكريبت تلقائيًا بواسطة Quran Recorder — جاهز لدليل الإنتاج (ElevenLabs → B-Roll → CapCut)*");
    L.push("");
    return L.join("\n");
  }


  /* ---------------- Urdu YouTube script (آیت اور الفاظ) ----------------
     Same day's log and the same timing model as buildYouTubeScript, but
     every human-facing string is Urdu. Channel rules:
       - the voiceover («…») never speaks a Quran word (Arabic or
         transliterated): ayah text, basmala and the Arabic words of the
         word table are ON-SCREEN ONLY; surahs are named by number in voice;
       - recitation audio = H. Muammar (CC0);
       - a closing charity ayah on screen only, and a DIFFERENT rotating
         charity ayah (text only) in the description + referral line;
       - B-roll: no faces, no people, no prophets.
     A placeholder poem section sits between the URDU_POEM markers. */

  var UR_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
  var UR_MONTHS = ["جنوری","فروری","مارچ","اپریل","مئی","جون",
                   "جولائی","اگست","ستمبر","اکتوبر","نومبر","دسمبر"];
  var UR_REFERRAL = "Referral: https://postiz.pro/mr-bug";
  var UR_RECITER = "ایچ. معمر (H. Muammar) — CC0";
  // Charity / giving ayat (text comes from QURAN_TEXT; no translation bundled).
  var UR_CHARITY = [[2,261],[2,267],[2,274],[2,43],[2,110],[2,271],[3,92],[8,60],
                    [47,38],[57,7],[61,11],[63,10],[64,16],[2,254],[9,103]];
  var UR_NO_FACES = "no faces, no people, no human figures, no prophets";

  function toUrduDigits(s) {
    return String(s).replace(/[0-9]/g, function (d) { return UR_DIGITS[+d]; });
  }
  function urduDate(dateKey) {
    var p = dateKey.split("-");
    return toUrduDigits(+p[2]) + " " + UR_MONTHS[+p[1] - 1] + " " + toUrduDigits(p[0]);
  }
  function urduTime(iso) {
    var d = new Date(iso), s;
    try {
      s = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: false, timeZone: TZ });
    } catch (e) {
      s = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: false });
    }
    var m = s.match(/(\d+):(\d+)/);
    if (!m) return toUrduDigits(s);
    var h = (+m[1]) % 24;
    var part = h < 5 ? "رات" : h < 12 ? "صبح" : h < 16 ? "دوپہر" : h < 19 ? "شام" : "رات";
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return part + " " + toUrduDigits(h12) + ":" + toUrduDigits(m[2]) + " بجے";
  }
  function urAyahWord(n) { return n === 1 ? "آیت" : "آیات"; }
  function dayIndex(dateKey) {
    var p = dateKey.split("-");
    return Math.floor(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000);
  }
  function charityPair(dateKey) {
    var n = UR_CHARITY.length, d = dayIndex(dateKey);
    var a = ((d % n) + n) % n;
    var b = (a + 7) % n;              // 7 is coprime with 15 → always different
    return { closing: UR_CHARITY[a], desc: UR_CHARITY[b] };
  }
  function urWord(en) {
    var T = WORD_TRANSLATIONS_UR || {};
    return T[en] || "";
  }
  // Distinct words of an ayah, highest letter-sum first.
  function rankedWords(surah, ayah) {
    if (!NUMBER_WORDS) return [];
    var seen = {}, cand = [];
    NUMBER_WORDS.words(surah, ayah).forEach(function (w) {
      if (seen[w]) return;
      seen[w] = 1;
      var sum = NUMBER_WORDS.val(w);
      cand.push({ w: w, sum: sum, bucket: NUMBER_WORDS.bucket(sum), en: NUMBER_WORDS.english(sum) });
    });
    cand.sort(function (a, b) { return b.sum - a.sum; });
    return cand;
  }
  function urduWordTable(surah, ayah) {
    if (!NUMBER_WORDS) return "";
    var ws = NUMBER_WORDS.words(surah, ayah);
    if (!ws.length) return "";
    var rows = [
      "**الفاظ کا تجزیہ — حسابِ جُمَّل (٪ ۲۸) — 🖥️ صرف اسکرین پر:**",
      "",
      "| لفظ | جُمَّل | خانہ | English | اردو |",
      "|---|---|---|---|---|"
    ];
    ws.forEach(function (w) {
      var sum = NUMBER_WORDS.val(w);
      var en = NUMBER_WORDS.english(sum);
      rows.push("| " + w + " | " + toUrduDigits(sum) + " | " + toUrduDigits(NUMBER_WORDS.bucket(sum)) +
                " | " + en + " | " + (urWord(en) || "—") + " |");
    });
    rows.push("");
    return rows.join("\n");
  }
  function ref(sa) { return toUrduDigits(sa[0]) + ":" + toUrduDigits(sa[1]); }

  var PATTERN_UR = { kalima: "کلمہ", fibonacci: "فبوناچی" };

  function buildUrduScript(dateKey, entries) {
    var recs = entries.filter(function (e) { return e.type === "recitation" || e.type === "ayah-stamp"; })
                      .sort(function (a, b) { return a.global - b.global || a.ts.localeCompare(b.ts); });
    if (!recs.length) return "";
    var kalimaDone = entries.filter(function (e) { return e.type === "kalima-complete"; });

    // Same timing model as buildYouTubeScript.
    var WPM = 130;
    var HOOK_S = 45, OUTRO_S = 60, KALIMA_S = 35;
    var t = 0;
    var chapters = [];
    var narrationWords = 90 + 80;
    function seg(dur, title) {
      var start = t;
      t += dur;
      chapters.push({ time: fmtClock(start), title: title });
      return "[" + fmtClock(start) + "–" + fmtClock(t) + "]";
    }

    var totalAyahWords = 0;
    recs.forEach(function (e) { totalAyahWords += wordCount(ayahText(e.surah, e.ayah)); });
    var estWords = narrationWords + totalAyahWords + recs.length * 55;
    var estMin = Math.max(1, Math.round(estWords / WPM));
    var n = recs.length;
    var dU = urduDate(dateKey);
    var pair = charityPair(dateKey);

    // Day-specific material for title / description / tags.
    var surahNums = [];
    recs.forEach(function (e) { if (surahNums.indexOf(e.surah) < 0) surahNums.push(e.surah); });
    var themes = [];
    recs.forEach(function (e) {
      rankedWords(e.surah, e.ayah).forEach(function (p) {
        var u = urWord(p.en);
        if (u && themes.indexOf(u) < 0) themes.push(u);
      });
    });
    var topThemes = themes.slice(0, 3);
    var biggest = null;
    recs.forEach(function (e) {
      var r = rankedWords(e.surah, e.ayah)[0];
      if (r && (!biggest || r.sum > biggest.sum)) biggest = r;
    });

    var L = [];
    L.push("# 🎬 اسکرپٹ — آیت اور الفاظ | " + dU);
    L.push("**چینل:** آیت اور الفاظ | **اندازاً دورانیہ:** ~" + toUrduDigits(estMin) + " منٹ (~" + toUrduDigits(estWords) +
           " الفاظ) | **لہجہ:** پُرسکون، دھیما، غور و فکر والا");
    L.push("**موسیقی:** ہلکی بانسری/ستار (−22dB) | **آواز کی رفتار:** 0.92");
    L.push("**تلاوت (آڈیو):** " + UR_RECITER + " — بیانیہ کبھی قرآن کا کوئی لفظ نہیں پڑھتا");
    L.push("**ماخذ:** تلاوتوں کا ریکارڈ " + dateKey + " — " + toUrduDigits(n) + " " + urAyahWord(n));
    L.push("");
    L.push("> 📌 قواعد: «…» کے اندر صرف اردو بیانیہ ہے۔ عربی آیات، بسم اللہ اور عربی الفاظ صرف اسکرین پر دکھائیں، آواز میں نہ پڑھیں۔ B-roll میں چہرے، انسان یا انبیاء کی تصویر نہیں۔");
    L.push("");
    L.push("---");
    L.push("");

    // HOOK
    L.push("## " + seg(HOOK_S, "آغاز") + " آغاز (HOOK)");
    L.push("> 🎙️ سیاہ اسکرین پر صرف آواز، پھر آہستہ آہستہ ایک چراغ روشن ہوتا ہے");
    L.push("> 🖥️ صرف اسکرین پر: " + BASMALA);
    L.push("");
    L.push("«" + dU + " کو کلامِ پاک کی " + toUrduDigits(n) + " " + urAyahWord(n) +
           " تلاوت ہوئیں، اور ہر ایک اپنے وقت کے ساتھ محفوظ کی گئی۔ آج ہم ہر آیت پر ٹھہریں گے: پہلے تلاوت سنیں گے، پھر اس کے الفاظ کے اعداد کو حسابِ جُمَّل سے کھولیں گے، حرف بہ حرف۔" +
           (topThemes.length ? " آج کے اعداد ہمیں " + topThemes.map(function (x) { return "«" + x + "»"; }).join("، ") + " جیسے الفاظ تک لے جاتے ہیں۔" : "") +
           " ہمارے ساتھ رہیے۔»");
    L.push("");
    L.push("**[B-ROLL — ایڈیٹنگ/اے آئی کے لیے]:**");
    L.push("1. `Cinematic macro shot: an oil lamp igniting in darkness, warm golden light, slow motion, film grain, deep green and gold palette, " + UR_NO_FACES + ", 4K, 16:9`");
    L.push("2. `Slow dolly through an empty old library at dusk, dust particles in golden light rays, " + UR_NO_FACES + "`");
    L.push("3. `Text overlay (سنہری نستعلیق خط، گہرے سبز پس منظر پر): \"آیت اور الفاظ — " + dU + "\"`");
    L.push("");
    L.push("---");
    L.push("");

    recs.forEach(function (e, i) {
      var text = ayahText(e.surah, e.ayah);
      var wc = wordCount(text);
      var dur = Math.max(30, Math.round((wc + 55) / WPM * 60 / 5) * 5);
      var title = "سورت " + toUrduDigits(e.surah) + " (" + surahName(e.surah) + ") — آیت " + toUrduDigits(e.ayah);
      L.push("## " + seg(dur, title) + " " + title);
      L.push("> 🔊 پہلے تلاوت: " + UR_RECITER + " — پھر دھیمے لہجے میں اردو بیانیہ");
      L.push("");
      L.push("**🖥️ صرف اسکرین پر (آواز میں نہ پڑھیں):**");
      L.push("");
      L.push("> " + text + " ﴿" + toArabicDigits(e.ayah) + "﴾");
      L.push("");

      var narr = ["«یہ سورت نمبر " + toUrduDigits(e.surah) + " کی آیت نمبر " + toUrduDigits(e.ayah) +
                  " تھی، جو مصحف کی ترتیب میں آیت نمبر " + toUrduDigits(e.global) + " ہے، اور یہ آیت " +
                  toUrduDigits(wc) + " الفاظ پر مشتمل ہے۔"];
      var picks = rankedWords(e.surah, e.ayah).slice(0, 3);
      if (picks.length) {
        var parts = picks.map(function (p, k) {
          var ord = ["سب سے بڑے", "دوسرے", "تیسرے"][k];
          var s = ord + " عدد والے لفظ کا مجموعہ " + toUrduDigits(p.sum) + " ہے، جو خانہ " + toUrduDigits(p.bucket) + " میں آتا ہے";
          var u = urWord(p.en);
          if (u) s += " اور ہمیں «" + u + "» کے مفہوم تک لے جاتا ہے";
          return s;
        });
        narr.push("حسابِ جُمَّل سے اس کے الفاظ کھولیں تو: " + parts.join("؛ ") + "۔");
      }
      narr.push("اسکرین پر لکھی آیت کو ایک لمحہ دیکھیے اور اس کے معنی پر غور کیجیے۔»");
      L.push(narr.join("\n"));
      L.push("");
      L.push(urduWordTable(e.surah, e.ayah));
      L.push("**[B-ROLL]:**");
      L.push("1. `Golden Arabic calligraphy of the verse materializing letter by letter on deep green parchment, cinematic, film grain, " + UR_NO_FACES + ", 4K, 16:9`");
      L.push("2. `Calm nature scene inspired by the verse's meaning (sky, water, trees or light), deep green and gold, candlelight, " + UR_NO_FACES + "`");
      L.push("3. Text overlay: الفاظ کے تجزیے کا جدول (اوپر دیکھیں)");
      if (e.type === "recitation") {
        L.push("");
        L.push("> ⏱ پروڈکشن نوٹ: اصل تلاوت " + urduTime(e.ts) + " ریکارڈ ہوئی — فائل: `recordings/" +
               dateKey + "/surah" + e.surah + "-ayah" + e.ayah + "-" + e.id + ".webm`");
      } else {
        L.push("");
        L.push("> ⏱ پروڈکشن نوٹ: یہ آیت " + urduTime(e.ts) + " وقت کے ساتھ محفوظ ہوئی");
      }
      L.push("");
      L.push("---");
      L.push("");
    });

    kalimaDone.forEach(function (e) {
      var pat = e.pattern || "kalima";
      var patU = PATTERN_UR[pat] || pat;
      L.push("## " + seg(KALIMA_S, patU + " کا سلسلہ مکمل") + " آج کی خبر: " + patU + " کا سلسلہ مکمل");
      L.push("«آج کی ایک خوب صورت خبر: " + patU + " کا پورا سلسلہ " + urduTime(e.ts) +
             " مکمل ہوا، سورتوں کی ترتیب یہ رہی: " + e.sequence.map(toUrduDigits).join(" · ") + "۔»");
      L.push("");
      L.push("**[B-ROLL]:** `Numbers of the sequence glowing one by one in gold on deep green, particles, cinematic, " + UR_NO_FACES + "`");
      L.push("");
      L.push("---");
      L.push("");
    });

    // OUTRO (closing charity ayah on screen only)
    L.push("## " + seg(OUTRO_S, "اختتام") + " اختتام اور دعوتِ شمولیت");
    L.push("> 🎙️ اور بھی دھیما اور آہستہ — موسیقی ذرا بلند ہو کر مدھم ہو جائے");
    L.push("");
    L.push("«یہ تھا " + dU + " کا سفر: " + toUrduDigits(n) + " " + urAyahWord(n) +
           "، حرف بہ حرف۔ اگر یہ سلسلہ آپ کو پسند آیا، چینل کو سبسکرائب کیجیے اور گھنٹی والا نشان دبائیے؛ کل پھر ملاقات ہوگی۔ اسکرین پر عطیہ دینے کے بارے میں ایک آیت ہے، اسے پڑھیے اور اپنی کمائی میں سے کچھ کسی ضرورت مند کو دیجیے۔»");
    L.push("");
    L.push("**🖥️ اختتامی آیتِ خیرات — صرف اسکرین پر (آواز میں نہ پڑھیں) — " + surahName(pair.closing[0]) + " " + ref(pair.closing) + ":**");
    L.push("");
    L.push("> " + ayahText(pair.closing[0], pair.closing[1]) + " ﴿" + toArabicDigits(pair.closing[1]) + "﴾");
    L.push("");
    L.push("**[B-ROLL]:**");
    L.push("1. `Candle flame gently fading to embers, dark green background, slow motion, " + UR_NO_FACES + "`");
    L.push("2. ۲۰ سیکنڈ کی اینڈ اسکرین + پچھلی ویڈیو کا کارڈ");
    L.push("");
    L.push("---");
    L.push("");

    // Poem placeholder — filled nightly by UrduBot; keep the markers exactly.
    L.push("## آج کی نظم");
    L.push("<!-- URDU_POEM_START -->");
    L.push("*(یہاں آج کی نظم شامل کی جائے گی)*");
    L.push("<!-- URDU_POEM_END -->");
    L.push("");
    L.push("---");
    L.push("");

    // Description block
    var surahLabel = surahNums.map(function (s) { return surahName(s); }).join("، ");
    var titleTheme = biggest ? " | سب سے بڑا عدد " + toUrduDigits(biggest.sum) : "";
    L.push("## 📋 ویڈیو کی تفصیل میں چسپاں کرنے کے لیے");
    L.push("");
    L.push("**تجویز کردہ عنوان:** آیت اور الفاظ | " + dU + " — " + toUrduDigits(n) + " " + urAyahWord(n) +
           " (" + surahLabel + ")" + titleTheme + " 🕯️");
    L.push("");
    L.push("**تفصیل:**");
    L.push("");
    L.push(dU + " کو " + toUrduDigits(n) + " " + urAyahWord(n) + " کی تلاوت ریکارڈ ہوئی — سورتیں: " +
           surahLabel + "۔ ہر آیت کے الفاظ کو حسابِ جُمَّل (٪ ۲۸) سے کھول کر اعداد اور معانی کا سفر۔" +
           (biggest ? " آج کا سب سے بڑا عدد: " + toUrduDigits(biggest.sum) + (urWord(biggest.en) ? " («" + urWord(biggest.en) + "»)" : "") + "۔" : ""));
    L.push("");
    L.push("🔊 تلاوت: " + UR_RECITER);
    L.push("");
    L.push("💛 خیرات کی آیت — " + surahName(pair.desc[0]) + " " + ref(pair.desc) + ":");
    L.push(ayahText(pair.desc[0], pair.desc[1]) + " ﴿" + toArabicDigits(pair.desc[1]) + "﴾");
    L.push("");
    L.push(UR_REFERRAL);
    L.push("");
    L.push("**ابواب (Chapters):**");
    L.push("```");
    chapters.forEach(function (c) { L.push(c.time + " " + c.title); });
    L.push("```");
    L.push("");
    var tags = ["آیت اور الفاظ", "قرآن", "تلاوت", "حساب جمل", "اردو", "روزانہ آیات", dU];
    surahNums.forEach(function (s) { tags.push("سورۃ " + surahName(s)); });
    topThemes.forEach(function (x) { if (tags.indexOf(x) < 0) tags.push(x); });
    L.push("**ٹیگز:** " + tags.join("، "));
    L.push("**ہیش ٹیگز:** #آیت_اور_الفاظ #قرآن #حساب_جمل #" + UR_MONTHS[+dateKey.split("-")[1] - 1] + "_" + toUrduDigits(+dateKey.split("-")[2]));
    L.push("");
    L.push("*یہ اسکرپٹ Quran Recorder نے خودکار طور پر تیار کیا — پروڈکشن کے لیے تیار (ElevenLabs → B-Roll → CapCut)*");
    L.push("");
    return L.join("\n");
  }

  return {
    buildArabicScript: buildArabicScript,
    buildUrduScript: buildUrduScript,
    buildYouTubeScript: buildYouTubeScript,
    toArabicDigits: toArabicDigits,
    arabicDate: arabicDate,
    arabicTime: arabicTime,
    toUrduDigits: toUrduDigits,
    urduDate: urduDate
  };
});
