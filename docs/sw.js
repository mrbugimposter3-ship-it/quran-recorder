/* Quran Recorder service worker — caches the app shell only.
   Bump VERSION with every release so phones pick up the new files. */
const VERSION = "v1.8.0";
const CACHE = "quran-recorder-" + VERSION;
// 🔎 Ayah Finder: transformers.js + the sentence model come from CDNs. Cache-first in a cache that survives
// version bumps, so the ~23 MB model downloads once. The finder's own data (docs/ayah-finder/) is
// same-origin and gets cached on first use by the handler below (it is not in SHELL, to keep installs light).
// 📖 Same for the Shakespeare play texts (docs/books/shakespeare/*.json, ~110–190 KB each): runtime-cached when first opened.
const MODEL_CACHE = "ayah-finder-model-v1";
const MODEL_HOSTS = /(^|\.)(huggingface\.co|hf\.co|cdn\.jsdelivr\.net)$/;
const SHELL = [
  "./", "./index.html", "./styles.css?v=bard1", "./ayah-finder.js?v=finder1", "./bard.js?v=bard1", "./app.js?v=bard1", "./spend.js?v=spend1", "./wardrobe-data.js?v=letters2", "./wardrobe.js?v=shop1", "./speak-parse.js?v=ghost1", "./sequences.js?v=ghost1", "./approve.js?v=ghost1", "./geronimo-books.js?v=ghost1", "./books-data.js?v=books2", "./books.js?v=books2",
  "./surah-data.js", "./quran-text.js", "./number-words.js", "./script-builder.js", "./word-translations.js",
  "./tree-picker.html?v=ghost1", "./manifest.json",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/maskable-192.png", "./icons/maskable-512.png", "./icons/apple-touch-icon.png"
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("quran-recorder-") && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  // Otherwise only same-origin GETs. GitHub API, api.alquran.cloud, archive.org etc. always go to the network.
  if (req.method === "GET" && url.origin !== self.location.origin && MODEL_HOSTS.test(url.hostname)) {
    e.respondWith(caches.open(MODEL_CACHE).then((c) => c.match(req).then((hit) => hit || fetch(req).then((r) => {
      if (r.ok) c.put(req, r.clone());
      return r;
    }))));
    return;
  }
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (req.mode === "navigate") {           // network-first for the page so updates show up
    e.respondWith(fetch(req).then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put("./index.html", cp)); return r; })
      .catch(() => caches.match("./index.html")));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => {
    if (r.ok && r.type === "basic") { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); }
    return r;
  })));
});
