/* ============================================================
   Arabic script builder — turns a day's log entries into a
   fully Arabic markdown script.
   Works in the browser (window.ScriptBuilder) and in Node
   (module.exports) so the GitHub Action uses the same code.
   ============================================================ */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./surah-data.js"), require("./quran-text.js"));
  } else {
    root.ScriptBuilder = factory(root.SURAHS, root.QURAN_TEXT);
  }
})(typeof self !== "undefined" ? self : this, function (SURAHS, QURAN_TEXT) {
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

  /* entries: log entries for one day (array). Returns markdown string. */
  function buildArabicScript(dateKey, entries) {
    var recs = entries.filter(function (e) { return e.type === "recitation"; })
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

    L.push("**عدد الآيات المُسجَّلة:** " + toArabicDigits(recs.length) +
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
      L.push("> 🎙 سُجِّلت الساعة " + arabicTime(e.ts) +
             "  ·  المدة: " + arabicDuration(e.durationMs) +
             "  ·  الكلمات: " + toArabicDigits(wordCount(text)));
      L.push("");
    });

    if (kalimaStamps.length || kalimaDone.length) {
      L.push("---");
      L.push("");
      var offset = (kalimaStamps[0] && kalimaStamps[0].offset) ||
                   (kalimaDone[0] && kalimaDone[0].offset) || 1;
      L.push("## 🕋 الكلمة — الإزاحة: السورة ١ = سورة " + surahName(offset) + " " + toArabicDigits(offset));
      L.push("");
      kalimaStamps.forEach(function (e) {
        L.push("- الموضع " + toArabicDigits(e.position) +
               " ← سورة " + surahName(e.surah) + " " + toArabicDigits(e.surah) +
               "  ·  ⏱ " + arabicTime(e.ts));
      });
      kalimaDone.forEach(function (e) {
        L.push("");
        L.push("✨ **اكتملت الكلمة كاملة** الساعة " + arabicTime(e.ts) +
               " — التسلسل: " + e.sequence.map(toArabicDigits).join(" · "));
      });
      L.push("");
    }

    L.push("---");
    L.push("");
    L.push("*أُنشئ هذا السكربت تلقائيًا بواسطة Quran Recorder*");
    L.push("");
    return L.join("\n");
  }

  return {
    buildArabicScript: buildArabicScript,
    toArabicDigits: toArabicDigits,
    arabicDate: arabicDate,
    arabicTime: arabicTime
  };
});
