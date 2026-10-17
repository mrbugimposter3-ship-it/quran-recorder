/* Quran Recorder service worker — caches the app shell only.
   Bump VERSION with every release so phones pick up the new files. */
const VERSION = "v1.1.0";
const CACHE = "quran-recorder-" + VERSION;
const SHELL = [
  "./", "./index.html", "./styles.css?v=seq1", "./app.js?v=seq1", "./speak-parse.js?v=seq1", "./sequences.js?v=seq1",
  "./surah-data.js", "./quran-text.js", "./number-words.js", "./script-builder.js", "./word-translations.js",
  "./tree-picker.html?v=seq1", "./manifest.json",
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
  // Only same-origin GETs. GitHub API, api.alquran.cloud, archive.org etc. always go to the network.
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
