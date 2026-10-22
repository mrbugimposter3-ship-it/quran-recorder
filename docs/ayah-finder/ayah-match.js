/* 🔎 Ayah Finder engine — English text → closest ayat (Pickthall English, public domain).
   Semantic: all 6236 Pickthall ayat were embedded offline with Xenova/all-MiniLM-L6-v2 (q8, mean pooling,
   normalized) by tools/build-ayah-embeddings.mjs and stored as int8 + one float32 scale per ayah
   (emb-minilm-int8.bin). In the browser the query is embedded with transformers.js (lazy-loaded from jsDelivr;
   the service worker caches it and the model). Score = 0.5·cosine + 0.5·keyword, where keyword is the
   IDF-weighted share of the query's concrete words (plus synonyms: coat → garment/raiment, leather → hides…)
   found in the ayah. If the model can't load (offline first run, old phone), it falls back to keyword-only.
   API: AyahMatch.match(text, {k}) → Promise<[{surah, ayah, score, en, keywords, cos, kw}]>
        AyahMatch.warm() → Promise (loads data + model), mode() → "semantic" | "keyword" | "loading"
        AyahMatch.setEmbedder(fn) for node tests (fn(text) → Float32Array(384), normalized). */
(function (root) {
  const isNode = typeof module !== "undefined" && module.exports && typeof window === "undefined";
  const D = 384, W_COS = 0.5, W_KW = 0.5;
  const TJS = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";
  const MODEL = "Xenova/all-MiniLM-L6-v2";
  const BASE = (() => {
    if (isNode) return __dirname + "/";
    const cs = document.currentScript; return cs ? cs.src.replace(/[^/]*$/, "") : "ayah-finder/";
  })();

  // ---------- words ----------
  const STOP = new Set("a an the and or of for to in on at by with from as is are was were be been it its this that these those i you he she we they my your our their me him her them us so not no but if then than very into onto over under up down out about who whom which what when where why how all any some such can will would shall should may might must do does did have has had am thou thee thy ye hath doth unto lo".split(" "));
  function stem(w) {
    if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
    if (w.length > 4 && /(ches|shes|sses|xes)$/.test(w)) return w.slice(0, -2);
    if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us")) w = w.slice(0, -1);
    if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
    if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
    return w;
  }
  const words = (t) => String(t).toLowerCase().replace(/[’']/g, "").split(/[^a-z]+/).filter((w) => w && !STOP.has(w));
  // query word → extra Pickthall words that carry the same concrete meaning
  const SYN = {
    coat: "garment raiment robe cloak clothe clothing attire wool fur", jacket: "garment raiment clothe clothing wool fur hide", shirt: "shirt garment raiment clothe",
    dress: "garment raiment robe clothe attire adorn", gown: "garment robe raiment", robe: "robe garment raiment", cloak: "cloak garment cloth",
    clothes: "garment raiment clothe clothing attire", clothing: "garment raiment clothe attire", cloth: "garment raiment clothe", outfit: "garment raiment attire adorn",
    garment: "raiment clothe robe", wear: "wear garment raiment clothe", apparel: "garment raiment attire", fabric: "garment raiment silk", textile: "garment raiment",
    scarf: "veil garment cloak", hijab: "veil cloak garment", veil: "veil cloak", hat: "garment", trousers: "garment raiment", pants: "garment raiment", suit: "garment raiment",
    wool: "wool fur hair", woolen: "wool fur hair", woollen: "wool fur hair", fur: "fur wool hair", knit: "wool", sweater: "wool garment warmth", jumper: "wool garment warmth",
    leather: "hide skin cattle", hide: "hide skin", suede: "hide skin", shoe: "shoe sandal", boot: "shoe sandal", sandal: "sandal shoe", sneaker: "shoe", footwear: "shoe sandal",
    silk: "silk brocade", satin: "silk brocade", velvet: "silk brocade", brocade: "brocade silk", embroidery: "brocade embroidery", cotton: "garment raiment", linen: "garment raiment",
    gold: "gold golden", golden: "gold", silver: "silver", bracelet: "bracelet armlet", bangle: "bracelet armlet", armlet: "armlet bracelet", jewellery: "pearl ornament coral ruby gold",
    jewelry: "pearl ornament coral ruby gold", jewel: "pearl ornament coral ruby", necklace: "pearl ornament", ring: "ornament", pearl: "pearl", gem: "pearl ruby coral", diamond: "pearl ruby",
    green: "green", white: "white", black: "black", red: "red", yellow: "yellow", colour: "hue colour", color: "hue colour", soft: "soft", perfume: "musk camphor ginger fragrance", scent: "musk fragrance",
    summer: "summer heat", hot: "heat", heat: "heat", winter: "winter cold", cold: "cold", warm: "warmth warm", warmth: "warmth",
    rain: "rain water sky", rainfall: "rain water", garden: "garden", gardens: "garden", tree: "tree", flower: "garden", plant: "vegetation herb", fruit: "fruit",
    orphan: "orphan", helping: "help feed", help: "help", charity: "alm spend", poor: "poor needy", needy: "needy poor",
    night: "night", sky: "sky heaven", star: "star", stars: "star", moon: "moon", sun: "sun",
    honey: "honey", bee: "bee", ship: "ship", boat: "ship ark", sea: "sea", ocean: "sea", sailing: "ship sea", sail: "ship",
    milk: "milk", date: "date palm", olive: "olive", grape: "grape vine", camel: "camel", horse: "horse", mountain: "mountain hill", river: "river",
  };

  // ---------- data ----------
  let EN = null, REF = null, Q8 = null, SCALE = null, POST = null, IDF = null, dataP = null;
  function buildIndex(json) {
    EN = json.en; REF = [];
    json.counts.forEach((c, i) => { for (let a = 1; a <= c; a++) REF.push([i + 1, a]); });
    POST = new Map(); const df = new Map();
    EN.forEach((t, i) => { for (const w of new Set(words(t).map(stem))) { if (!POST.has(w)) POST.set(w, new Set()); POST.get(w).add(i); } });
    IDF = (w) => { const p = POST.get(w); return p ? Math.log(1 + EN.length / p.size) : 0; };
  }
  function setEmb(buf) {
    const n = EN.length;
    Q8 = new Int8Array(buf, 0, n * D); SCALE = new Float32Array(buf.slice(n * D, n * D + n * 4));
  }
  function loadData() {
    if (dataP) return dataP;
    if (isNode) {
      const fs = require("fs");
      buildIndex(JSON.parse(fs.readFileSync(BASE + "pickthall.json", "utf8")));
      const b = fs.readFileSync(BASE + "emb-minilm-int8.bin"); setEmb(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
      return (dataP = Promise.resolve());
    }
    dataP = fetch(BASE + "pickthall.json?v=finder1").then((r) => r.json()).then(buildIndex)
      .then(() => fetch(BASE + "emb-minilm-int8.bin?v=finder1")).then((r) => r.arrayBuffer()).then(setEmb)
      .catch((e) => { dataP = null; throw e; });
    return dataP;
  }

  // ---------- model ----------
  let embed = null, modelP = null, modelFailed = false;
  function loadModel() {
    if (embed) return Promise.resolve(embed);
    if (modelP) return modelP;
    if (isNode) return Promise.reject(new Error("no embedder in node; call setEmbedder"));
    modelP = import(TJS).then(async (T) => {
      T.env.allowLocalModels = false;
      // The SW caches model files; only let transformers.js keep its own copy when no SW controls the page.
      T.env.useBrowserCache = !(navigator.serviceWorker && navigator.serviceWorker.controller);
      const ex = await T.pipeline("feature-extraction", MODEL, { dtype: "q8" });
      embed = async (t) => (await ex(t, { pooling: "mean", normalize: true })).data;
      return embed;
    }).catch((e) => { modelFailed = true; modelP = null; throw e; });
    return modelP;
  }

  // ---------- scoring ----------
  function keywordScores(text) {
    // concepts = distinct query words; each concept matches its own stem or any synonym stem
    const concepts = [];
    for (const w of new Set(words(text))) {
      const forms = new Set([stem(w), ...(SYN[w] || SYN[stem(w)] || "").split(" ").filter(Boolean).map(stem)]);
      const weight = Math.max(...[...forms].map(IDF));
      if (weight > 0) concepts.push({ w, forms: [...forms], weight, own: stem(w) });
    }
    const total = concepts.reduce((s, c) => s + c.weight, 0);
    const kw = new Float32Array(EN.length), hits = new Map();
    if (!total) return { kw, hits };
    for (const c of concepts) {
      const best = new Map(); // ayah → best idf among the concept's forms (own word counts fully, synonyms 0.8)
      for (const f of c.forms) {
        const p = POST.get(f); if (!p) continue;
        const v = Math.min(c.weight, IDF(f)) * (f === c.own ? 1 : 0.8);
        for (const i of p) if (!best.has(i) || best.get(i).v < v) best.set(i, { v, f });
      }
      for (const [i, { v, f }] of best) { kw[i] += v / total; if (!hits.has(i)) hits.set(i, []); hits.get(i).push(f === c.own ? c.w : c.w + "→" + f); }
    }
    // an ayah that covers several of the query's ideas (green + robe) beats one rare word alone (wool)
    for (const [i, h] of hits) {
      const m = new Set(h.map((x) => x.split("→").pop())).size; // distinct ayah words, so coat→wool + wool counts once
      if (m > 1) kw[i] = Math.min(1, kw[i] * (1 + 0.25 * (m - 1)));
    }
    return { kw, hits };
  }
  function cosines(v) {
    const n = EN.length, out = new Float32Array(n);
    for (let i = 0; i < n; i++) { let d = 0; const o = i * D; for (let k = 0; k < D; k++) d += Q8[o + k] * v[k]; out[i] = d * SCALE[i]; }
    return out;
  }
  async function match(text, opts) {
    const k = (opts && opts.k) || 5;
    text = String(text || "").trim(); if (!text) return [];
    await loadData();
    let v = null;
    try { v = await (embed ? embed : await loadModel())(text); } catch (e) { v = null; }
    const { kw, hits } = keywordScores(text);
    const cos = v ? cosines(v) : null;
    const n = EN.length, score = new Float32Array(n);
    for (let i = 0; i < n; i++) score[i] = cos ? W_COS * Math.max(0, cos[i]) + W_KW * kw[i] : kw[i] - EN[i].length * 1e-6; // offline: shorter ayah wins a tie
    const idx = [...Array(n).keys()].sort((a, b) => score[b] - score[a]).slice(0, k);
    return idx.filter((i) => score[i] > 0).map((i) => ({ surah: REF[i][0], ayah: REF[i][1], score: Math.max(0, Math.min(1, cos ? score[i] : kw[i])), en: EN[i],
      keywords: hits.get(i) || [], cos: cos ? +cos[i].toFixed(4) : null, kw: +kw[i].toFixed(4) }));
  }
  function mode() { return embed ? "semantic" : modelFailed ? "keyword" : "loading"; }
  async function warm() { await loadData(); try { await loadModel(); } catch (e) {} return api; }
  function ready() { return !!(EN && (embed || modelFailed)); }
  function setEmbedder(fn) { embed = fn; }

  const api = { match, warm, mode, ready, setEmbedder, words, stem, MODEL, TJS };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.AyahMatch = api;
})(typeof window !== "undefined" ? window : globalThis);
