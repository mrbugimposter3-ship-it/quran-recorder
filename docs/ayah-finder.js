/* 🔎 Ayah Finder آیت تلاش — English text (e.g. a clothes description) → the 5 closest ayat by meaning.
   This file is the screen + Copy button. The matching engine is docs/ayah-finder/ayah-match.js,
   loaded lazily the first time the tab opens (so the rest of the app stays light).
   Interface used: AyahMatch.match(text) → Promise<[{surah, ayah, score, en, keywords}]>.
   Arabic: bundled QURAN_TEXT (Tanzil Uthmani). English: M. M. Pickthall (1930, public domain). */
(function (root) {
  const isNode = typeof module !== "undefined" && module.exports;
  const TOP = 5;
  const ENGINE_SRC = "ayah-finder/ayah-match.js?v=finder1";

  const num = (x) => (x === undefined || x === null || x === "" ? NaN : Number(x));
  // Accept {surah,ayah} | {s,a} | {ref:"S:A"} | {key:"S:A"}
  function refOf(r) {
    let s = num(r.surah !== undefined ? r.surah : r.s), a = num(r.ayah !== undefined ? r.ayah : r.a);
    const k = r.ref || r.key || r.verse_key;
    if ((isNaN(s) || isNaN(a)) && typeof k === "string" && /^\d+:\d+$/.test(k)) [s, a] = k.split(":").map(Number);
    return isNaN(s) || isNaN(a) ? null : { s, a };
  }
  function normalize(results, ctx) {
    ctx = ctx || {};
    const QT = ctx.QURAN_TEXT || root.QURAN_TEXT || {}, SU = ctx.SURAHS || root.SURAHS || [];
    const out = [];
    for (const r of results || []) {
      const ref = r && refOf(r); if (!ref) continue;
      const su = SU.find((x) => x.n === ref.s) || {};
      const sc = num(r.score !== undefined ? r.score : r.sim !== undefined ? r.sim : r.similarity);
      out.push({
        s: ref.s, a: ref.a, ref: ref.s + ":" + ref.a,
        name: su.name || r.surahName || "", nameAr: su.ar || r.surahAr || "",
        ar: ((QT[String(ref.s)] || [])[ref.a - 1]) || r.ar || r.arabic || "",
        en: r.en || r.english || r.pickthall || r.text || "",
        score: isNaN(sc) ? null : sc,
        why: Array.isArray(r.keywords) && r.keywords.length ? r.keywords : null,
      });
      if (out.length >= TOP) break;
    }
    return out;
  }
  // 0..1 → "87%"; already-percent numbers pass through
  function pct(score) {
    if (score === null || score === undefined || isNaN(score)) return "";
    const p = score <= 1 ? score * 100 : score;
    return Math.round(Math.max(0, Math.min(100, p))) + "%";
  }
  // For video / product descriptions
  function copyText(r) { return `${r.ar} — ${r.en} (Pickthall) — Quran ${r.s}:${r.a}`; }

  // ---------- engine loading (browser) ----------
  let enginePromise = null;
  function findEngine() { return root.AyahMatch || null; }
  function loadEngine() {
    if (findEngine()) return Promise.resolve(findEngine());
    if (enginePromise) return enginePromise;
    enginePromise = new Promise((res, rej) => {
      const sc = document.createElement("script");
      sc.src = ENGINE_SRC; sc.async = true;
      sc.onload = () => (findEngine() ? res(findEngine()) : rej(new Error("engine missing")));
      sc.onerror = () => { enginePromise = null; rej(new Error("could not load the finder")); };
      document.head.appendChild(sc);
    });
    return enginePromise;
  }
  async function find(text, engine) {
    const eng = engine || (await loadEngine());
    const raw = await eng.match(String(text || "").trim(), { k: TOP });
    return normalize(Array.isArray(raw) ? raw : (raw && raw.results) || []);
  }

  async function copy(str) {
    try { await navigator.clipboard.writeText(str); return true; } catch (e) {
      const t = document.createElement("textarea"); t.value = str; t.style.position = "fixed"; t.style.opacity = "0";
      document.body.appendChild(t); t.select(); let ok = false; try { ok = document.execCommand("copy"); } catch (_) {}
      t.remove(); return ok;
    }
  }

  // ---------- UI ----------
  function el(tag, cls, text, attrs) {
    const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text;
    for (const k in attrs || {}) e.setAttribute(k, attrs[k]); return e;
  }
  function renderResults(box, list) {
    box.replaceChildren();
    if (!list.length) { box.appendChild(el("p", "muted", "No match found · کوئی آیت نہیں ملی")); return; }
    list.forEach((r, i) => {
      const card = el("article", "af-hit");
      const head = el("div", "af-head");
      head.appendChild(el("span", "af-rank", String(i + 1)));
      head.appendChild(el("span", "af-ref", `${r.ref} · ${r.name}${r.nameAr ? " · " + r.nameAr : ""}`));
      if (r.score !== null) head.appendChild(el("span", "af-score", pct(r.score), { title: "Match score · مماثلت" }));
      card.appendChild(head);
      card.appendChild(el("p", "af-ar", r.ar, { lang: "ar", dir: "rtl" }));
      card.appendChild(el("p", "af-en", r.en));
      if (r.why) card.appendChild(el("p", "af-why muted", "Words matched · ملتے الفاظ: " + r.why.join(", ")));
      const btn = el("button", "icon-btn af-copy", "📋 Copy کاپی");
      btn.addEventListener("click", async () => {
        const ok = await copy(copyText(r));
        btn.textContent = ok ? "✓ Copied کاپی ہو گیا" : "✗ Copy failed";
        setTimeout(() => (btn.textContent = "📋 Copy کاپی"), 1800);
      });
      card.appendChild(btn);
      box.appendChild(card);
    });
  }
  function modeLabel(eng) {
    const m = eng && eng.mode && eng.mode();
    return m === "semantic" ? "by meaning · معنی کے لحاظ سے" : m === "keyword" ? "offline word match · آف لائن الفاظ سے" : "";
  }
  function init() {
    const $ = (s) => document.querySelector(s);
    if (!$("#tab-ayahfind")) return;
    const input = $("#af-text"), go = $("#af-go"), status = $("#af-status"), box = $("#af-results");
    const tabBtn = document.querySelector('.tab[data-tab="ayahfind"]');
    const warm = () => {
      if (findEngine() && findEngine().ready()) return;
      status.textContent = "Loading finder (first time ~25 MB, then offline)… · پہلی بار لوڈ ہو رہا ہے";
      loadEngine().then((e) => e.warm()).then((e) => (status.textContent = "Ready · تیار — " + modeLabel(findEngine())))
        .catch((e) => (status.textContent = "Finder could not load (" + e.message + ") · لوڈ نہیں ہو سکا"));
    };
    if (tabBtn) tabBtn.addEventListener("click", warm);
    let seq = 0;
    const run = async () => {
      const text = input.value.trim(); if (!text) { input.focus(); return; }
      const my = ++seq; go.disabled = true; status.textContent = "Searching… · تلاش جاری ہے";
      try {
        const list = await find(text);
        if (my !== seq) return;
        renderResults(box, list);
        status.textContent = `Top ${list.length} ` + modeLabel(findEngine());
      } catch (e) { status.textContent = "Search failed: " + e.message + " · تلاش ناکام"; }
      finally { if (my === seq) go.disabled = false; }
    };
    go.addEventListener("click", run);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); run(); } });
    document.querySelectorAll(".af-eg").forEach((b) => b.addEventListener("click", () => { input.value = b.dataset.q; run(); }));
  }

  const api = { TOP, ENGINE_SRC, refOf, normalize, pct, copyText, find };
  if (isNode) module.exports = api;
  else { root.QAyahFinder = api; if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init(); }
})(typeof window !== "undefined" ? window : globalThis);
