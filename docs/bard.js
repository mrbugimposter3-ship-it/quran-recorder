/* 📖 Shakespeare reader · ڈرامہ پڑھیں — full public-domain text of Macbeth, Othello and Hamlet
   (Project Gutenberg plain text, built by tools/build-shakespeare.js into docs/books/shakespeare/<id>.json).
   The JSON is fetched only when a play is opened (lazy; the service worker caches it at runtime, not on install).
   Pairing: scene = ((S-1) mod scenes)+1 over the play's scene list, S = selected surah. Number pairing only —
   the play text is never Quran and never tafsir. Pure helpers work in node (tools/test-bard.js). */
(function (root) {
  const isNode = typeof module !== "undefined";
  const PLAYS = [
    { id: "macbeth", title: "Macbeth", ar: "ماكبث", ur: "میکبتھ", spa: [7, 4, 6, 3, 8] },
    { id: "othello", title: "Othello", ar: "عطيل", ur: "اوتھیلو", spa: [3, 3, 4, 3, 2] },
    { id: "hamlet", title: "Hamlet", ar: "هاملت", ur: "ہیملٹ", spa: [5, 2, 4, 7, 2] },
  ];
  const byId = Object.fromEntries(PLAYS.map((p) => [p.id, p]));
  const byTitle = Object.fromEntries(PLAYS.map((p) => [p.title.toLowerCase(), p]));
  const VER = "bard1";
  const mod = (x, n) => ((x % n) + n) % n;
  const ROM = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  /** flat scene list [{k, act, scene}] from scenes-per-act */
  function sceneList(spa) { const out = []; spa.forEach((n, a) => { for (let s = 1; s <= n; s++) out.push({ k: out.length + 1, act: a + 1, scene: s }); }); return out; }
  function spaOf(play) { return play.spa || play.acts.map((a) => a.scenes.length); }
  /** pair surah S → scene k (1-based) and its act/scene */
  function pairScene(play, S) {
    const L = sceneList(spaOf(play)), N = L.length, k = mod(Math.floor(S) - 1, N) + 1;
    return Object.assign({ S: Math.floor(S), N, formula: `((${Math.floor(S)} − 1) mod ${N}) + 1 = ${k}` }, L[k - 1]);
  }
  const label = (x) => `Act ${ROM[x.act]}, Scene ${ROM[x.scene]}`;
  const api = { PLAYS, byId, byTitle, sceneList, pairScene, label, VER };
  if (isNode) { module.exports = api; return; }
  root.QBard = api;

  /* ---------------- browser reader ---------------- */
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const ital = (s) => esc(s).replace(/\[([^\]]*)\]/g, '<i class="bard-sd">[$1]</i>');
  const cache = {};
  const FS_KEY = "quranRecorder.bard.fs";
  let cur = null, curK = 1, curS = 1;
  function load(id) {
    if (!cache[id]) cache[id] = fetch(`books/shakespeare/${id}.json?v=${VER}`).then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .catch((e) => { delete cache[id]; throw e; });
    return cache[id];
  }
  const el = (id) => document.getElementById(id);
  function surahNow() { try { return typeof selectedSurah !== "undefined" ? selectedSurah : 1; } catch (e) { return 1; } }
  function fs(d) { const v = Math.min(1.6, Math.max(0.85, (Number(localStorage.getItem(FS_KEY)) || 1.05) + (d || 0))); localStorage.setItem(FS_KEY, String(v)); el("bard-text").style.fontSize = v + "rem"; }
  function renderPair() {
    const p = pairScene(cur, curS);
    el("bard-pair").innerHTML = `🔢 Surah ${p.S} → scene = ${esc(p.formula)} → <b>${label(p)}</b>
      <button type="button" id="bard-go-pair" class="icon-btn">Open paired scene <span class="ur" lang="ur">جوڑی والا منظر</span></button>
      <span class="muted">· number pairing only, not tafsir <span class="ur" lang="ur">صرف عددی جوڑی، تفسیر نہیں</span></span>`;
    el("bard-go-pair").onclick = () => show(p.k);
  }
  function show(k) {
    const L = sceneList(spaOf(cur)); curK = Math.min(L.length, Math.max(1, k));
    const x = L[curK - 1], sc = cur.acts[x.act - 1].scenes[x.scene - 1];
    el("bard-scene").value = String(curK);
    el("bard-prev").disabled = curK === 1; el("bard-next").disabled = curK === L.length;
    const paired = pairScene(cur, curS).k === curK;
    el("bard-text").innerHTML = `<h3 class="bard-h">${label(x)}${paired ? ' <span class="bard-paired">🔢 paired · جوڑی</span>' : ""}</h3>
      <div class="bard-place muted">${esc(sc.place)}</div>` +
      sc.items.map(([who, t]) => who
        ? `<div class="bard-sp"><div class="bard-who">${esc(who)}</div><div class="bard-ln">${ital(t)}</div></div>`
        : `<div class="bard-dir">${ital(t)}</div>`).join("") +
      `<div class="bard-end muted">— end of ${label(x)} · <span class="ur" lang="ur">منظر ختم</span></div>`;
    el("bard-text").scrollTop = 0; el("bard-body").scrollTop = 0;
  }
  async function open(id, S) {
    const meta = byId[id]; if (!meta) return;
    curS = Math.min(114, Math.max(1, Math.floor(S || surahNow()) || 1));
    const box = el("bard-reader"); box.classList.remove("hidden"); document.body.classList.add("bard-open");
    el("bard-title").innerHTML = `📖 ${esc(meta.title)} <span lang="ar" dir="rtl">${esc(meta.ar)}</span> <span class="ur" lang="ur">${esc(meta.ur)}</span>`;
    el("bard-text").innerHTML = `<div class="muted">Loading the play… <span class="ur" lang="ur">ڈرامہ لوڈ ہو رہا ہے</span></div>`;
    el("bard-s").value = String(curS);
    try { cur = await load(id); }
    catch (e) { el("bard-text").innerHTML = `<div class="muted">✗ Could not load ${esc(meta.title)} (${esc(e.message)}). Check the connection and try again. <span class="ur" lang="ur">دوبارہ کوشش کریں</span></div>`; return; }
    el("bard-src").innerHTML = `${esc(cur.author)} · public domain <span class="ur" lang="ur">عوامی ملکیت</span> · <a href="${esc(cur.source.url)}" target="_blank" rel="noopener">source: gutenberg.org #${cur.source.ebook}</a>`;
    el("bard-personae").innerHTML = cur.personae.map((p) => `<li>${esc(p)}</li>`).join("") + (cur.setting ? `<li class="muted"><b>Scene:</b> ${esc(cur.setting)}</li>` : "");
    el("bard-scene").innerHTML = sceneList(spaOf(cur)).map((x) => `<option value="${x.k}">${x.k}. ${label(x)} — ${esc(cur.acts[x.act - 1].scenes[x.scene - 1].place)}</option>`).join("");
    fs(0); renderPair(); show(pairScene(cur, curS).k);
  }
  function close() { el("bard-reader").classList.add("hidden"); document.body.classList.remove("bard-open"); }
  function init() {
    if (!el("bard-reader")) return;
    document.addEventListener("click", (e) => { const b = e.target.closest("[data-bard]"); if (b) { e.preventDefault(); open(b.dataset.bard); } });
    el("bard-x").onclick = close;
    el("bard-prev").onclick = () => show(curK - 1);
    el("bard-next").onclick = () => show(curK + 1);
    el("bard-scene").onchange = (e) => show(Number(e.target.value));
    el("bard-s").onchange = (e) => { curS = Math.min(114, Math.max(1, Math.floor(Number(e.target.value)) || 1)); e.target.value = String(curS); if (cur) { renderPair(); show(pairScene(cur, curS).k); } };
    el("bard-fs-minus").onclick = () => fs(-0.1);
    el("bard-fs-plus").onclick = () => fs(0.1);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !el("bard-reader").classList.contains("hidden")) close(); });
  }
  root.QBard.open = open; root.QBard.close = close;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})(typeof window !== "undefined" ? window : globalThis);
