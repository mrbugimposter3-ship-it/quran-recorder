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
      require("./word-translations.js")
    );
  } else {
    root.ScriptBuilder = factory(root.SURAHS, root.QURAN_TEXT, root.NUMBER_WORDS, root.WORD_TRANSLATIONS);
  }
})(typeof self !== "undefined" ? self : this, function (SURAHS, QURAN_TEXT, NUMBER_WORDS, WORD_TRANSLATIONS) {
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

  return {
    buildArabicScript: buildArabicScript,
    buildYouTubeScript: buildYouTubeScript,
    toArabicDigits: toArabicDigits,
    arabicDate: arabicDate,
    arabicTime: arabicTime
  };
});
