/* ============================================================
   Quran Recorder — surah/ayah recorder, scroll finder,
   kalima tracker, per-day timestamped logs.
   Data: localStorage (log entries) + IndexedDB (audio blobs).
   ============================================================ */

"use strict";

const $ = (sel) => document.querySelector(sel);
const PATTERNS = {
  kalima: [1, 6, 8, 10, 12, 23, 24, 27],
  fibonacci: [1, 2, 3, 5, 8, 13, 21, 34, 55, 89]
};
const LOG_KEY = "quranRecorder.logs.v1";
const KALIMA_OFFSET_KEY = "quranRecorder.kalimaOffset";
const KALIMA_PATTERN_KEY = "quranRecorder.kalimaPattern";
const GH_KEY = "quranRecorder.gh.v1";

console.assert(TOTAL_VERSES === 6236, "Surah ayah counts must total 6236, got " + TOTAL_VERSES);

/* ---------------- date / log helpers ---------------- */

function dayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function timeStr(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function loadLogs() {
  try { return JSON.parse(localStorage.getItem(LOG_KEY)) || {}; }
  catch { return {}; }
}
function saveLogs(logs) { localStorage.setItem(LOG_KEY, JSON.stringify(logs)); }
function addLogEntry(entry) {
  const logs = loadLogs();
  const key = dayKey();
  if (!logs[key]) logs[key] = [];
  logs[key].push(entry);
  saveLogs(logs);
  return entry;
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

/* ---------------- IndexedDB for audio ---------------- */

const idb = {
  db: null,
  open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("quran-recorder", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("audio");
      req.onsuccess = () => { idb.db = req.result; resolve(); };
      req.onerror = () => reject(req.error);
    });
  },
  put(id, blob) {
    return new Promise((resolve, reject) => {
      const tx = idb.db.transaction("audio", "readwrite");
      tx.objectStore("audio").put(blob, id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  },
  get(id) {
    return new Promise((resolve, reject) => {
      const tx = idb.db.transaction("audio", "readonly");
      const req = tx.objectStore("audio").get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  del(id) {
    return new Promise((resolve, reject) => {
      const tx = idb.db.transaction("audio", "readwrite");
      tx.objectStore("audio").delete(id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }
};

/* ---------------- surah helpers ---------------- */

function surahByNum(n) { return SURAHS[n - 1]; }
function surahLabel(s) { return `${s.n}. ${s.name} (${s.ar})`; }
function globalVerse(surahNum, ayah) { return surahByNum(surahNum).start + ayah - 1; }
function findByGlobalVerse(v) {
  for (const s of SURAHS) {
    if (v >= s.start && v <= s.end) return { surah: s, ayah: v - s.start + 1 };
  }
  return null;
}
function ayahText(surahNum, ayah) {
  const arr = (window.QURAN_TEXT || {})[String(surahNum)];
  return (arr && arr[ayah - 1]) || "";
}

/* Arabic text normalization for searching (strip diacritics, unify letters) */
function normalizeArabic(s) {
  return s
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, "")
    .replace(/[\u0623\u0625\u0622\u0671]/g, "\u0627")
    .replace(/\u0649/g, "\u064A")
    .replace(/\u0629/g, "\u0647");
}

/* ---------------- tabs ---------------- */

document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b === btn));
    document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === "tab-" + btn.dataset.tab));
    if (btn.dataset.tab === "log") renderLog();
    if (btn.dataset.tab === "recorder") renderRecordings();
  });
});

/* ---------------- recorder tab ---------------- */

const recSurahSel = $("#rec-surah");
const recAyahInput = $("#rec-ayah");
const recVerseInput = $("#rec-verse");

function fillSurahSelect(sel) {
  sel.innerHTML = SURAHS.map((s) => `<option value="${s.n}">${surahLabel(s)} — ${s.ayahs} ayahs</option>`).join("");
}
fillSurahSelect(recSurahSel);

let selectedSurah = 1;
let selectedAyah = 1;

function refreshSelection() {
  const s = surahByNum(selectedSurah);
  selectedAyah = Math.min(Math.max(1, selectedAyah), s.ayahs);
  recAyahInput.value = selectedAyah;
  recAyahInput.max = s.ayahs;
  $("#rec-ayah-max").textContent = `(1–${s.ayahs})`;
  const gv = globalVerse(selectedSurah, selectedAyah);
  $("#rec-global").textContent = gv;
  recVerseInput.value = gv;
  $("#rec-ayah-text").textContent = ayahText(selectedSurah, selectedAyah);
  renderWordMap();
  syncSurahStrip();
  syncAyahDial();
  $("#rec-surah-info").textContent =
    `${s.name} spans global verses ${s.start}–${s.end}.`;
}

recSurahSel.addEventListener("change", () => {
  selectedSurah = Number(recSurahSel.value);
  selectedAyah = 1;
  refreshSelection();
  highlightFinderRow();
});
recAyahInput.addEventListener("change", () => {
  selectedAyah = Number(recAyahInput.value) || 1;
  refreshSelection();
});
$("#ayah-prev").addEventListener("click", () => { selectedAyah--; refreshSelection(); });
$("#ayah-next").addEventListener("click", () => { selectedAyah++; refreshSelection(); });

/* --- surah strip dial (swipe 1–114) --- */

const STRIP_W = 52;
let stripBuilt = false;
let stripLock = false;

function buildSurahStrip() {
  if (stripBuilt) return;
  stripBuilt = true;
  const strip = $("#surah-strip");
  for (let n = 1; n <= 114; n++) {
    const c = document.createElement("div");
    c.className = "surah-chip";
    c.textContent = n;
    c.dataset.n = n;
    c.addEventListener("click", () => selectSurah(n));
    strip.appendChild(c);
  }
  strip.addEventListener("scroll", () => {
    if (stripLock) return;
    clearTimeout(strip._t);
    strip._t = setTimeout(() => {
      const idx = Math.round((strip.scrollLeft + strip.clientWidth / 2) / STRIP_W - 0.5);
      const n = Math.min(Math.max(1, idx + 1), 114);
      if (n !== selectedSurah) selectSurah(n);
    }, 90);
  });
}

function syncSurahStrip() {
  if (!stripBuilt) return;
  const strip = $("#surah-strip");
  strip.querySelectorAll(".surah-chip").forEach((c) =>
    c.classList.toggle("active", Number(c.dataset.n) === selectedSurah));
  const chip = strip.querySelector(".surah-chip.active");
  if (chip && strip._centeredFor !== selectedSurah) {   // only when the surah actually changes
    strip._centeredFor = selectedSurah;
    stripLock = true;
    // scroll the strip horizontally only — never the page
    const cr = chip.getBoundingClientRect(), sr = strip.getBoundingClientRect();
    strip.scrollTo({ left: strip.scrollLeft + (cr.left - sr.left) - (strip.clientWidth - cr.width) / 2, behavior: "smooth" });
    clearTimeout(strip._lt);
    strip._lt = setTimeout(() => { stripLock = false; }, 350);
  }
}

/* --- ayah wheel dial (spin to the exact ayah) --- */

const DIAL_ROW = 44, DIAL_PAD = 2;
let dialFor = 0;
let dialLock = false;

function buildAyahDial() {
  const s = surahByNum(selectedSurah);
  if (dialFor === selectedSurah) return;
  dialFor = selectedSurah;
  const dial = $("#ayah-dial");
  dial.innerHTML = "";
  for (let i = 0; i < DIAL_PAD; i++) {
    const p = document.createElement("div");
    p.className = "dial-pad";
    dial.appendChild(p);
  }
  for (let a = 1; a <= s.ayahs; a++) {
    const r = document.createElement("div");
    r.className = "dial-row";
    r.dataset.a = a;
    const dn = document.createElement("span");
    dn.className = "dn";
    dn.textContent = a;
    const dg = document.createElement("span");
    dg.className = "dg";
    dg.textContent = "verse " + (s.start + a - 1);
    r.appendChild(dn);
    r.appendChild(dg);
    r.addEventListener("click", () => { selectedAyah = a; refreshSelection(); });
    dial.appendChild(r);
  }
  for (let i = 0; i < DIAL_PAD; i++) {
    const p = document.createElement("div");
    p.className = "dial-pad";
    dial.appendChild(p);
  }
}

function syncAyahDial() {
  buildAyahDial();
  const dial = $("#ayah-dial");
  dial.querySelectorAll(".dial-row").forEach((r) =>
    r.classList.toggle("active", Number(r.dataset.a) === selectedAyah));
  const target = (DIAL_PAD + selectedAyah - 1) * DIAL_ROW + DIAL_ROW / 2 - dial.clientHeight / 2;
  dialLock = true;
  dial.scrollTo({ top: target, behavior: "smooth" });
  clearTimeout(dial._lt);
  dial._lt = setTimeout(() => { dialLock = false; }, 350);
}

function initAyahDialScroll() {
  const dial = $("#ayah-dial");
  dial.addEventListener("scroll", () => {
    if (dialLock) return;
    clearTimeout(dial._t);
    dial._t = setTimeout(() => {
      const max = surahByNum(selectedSurah).ayahs;
      const rowIdx = Math.round((dial.scrollTop + dial.clientHeight / 2) / DIAL_ROW - 0.5) - DIAL_PAD;
      const a = Math.min(Math.max(1, rowIdx + 1), max);
      if (a !== selectedAyah) { selectedAyah = a; refreshSelection(); }
    }, 80);
  });
}

/* --- global verse # selector (1–6236) --- */

function selectGlobalVerse(v) {
  v = Math.min(Math.max(1, Math.round(v) || 1), TOTAL_VERSES);
  const hit = findByGlobalVerse(v);
  selectedSurah = hit.surah.n;
  selectedAyah = hit.ayah;
  recSurahSel.value = String(selectedSurah);
  refreshSelection();
  highlightFinderRow();
}

recVerseInput.addEventListener("change", () => selectGlobalVerse(Number(recVerseInput.value)));
recVerseInput.addEventListener("keydown", (e) => { if (e.key === "Enter") selectGlobalVerse(Number(recVerseInput.value)); });
$("#verse-prev").addEventListener("click", () => selectGlobalVerse(globalVerse(selectedSurah, selectedAyah) - 1));
$("#verse-next").addEventListener("click", () => selectGlobalVerse(globalVerse(selectedSurah, selectedAyah) + 1));

/* --- number-words chips for the selected ayah (letter-sum mod 28) --- */

function renderWordMap() {
  const box = $("#rec-word-map");
  box.innerHTML = "";
  if (typeof NUMBER_WORDS === "undefined") return;
  const T = (typeof WORD_TRANSLATIONS !== "undefined") ? WORD_TRANSLATIONS : {};
  for (const w of NUMBER_WORDS.words(selectedSurah, selectedAyah)) {
    const sum = NUMBER_WORDS.val(w);
    const en = NUMBER_WORDS.english(sum);
    const chip = document.createElement("span");
    chip.className = "word-chip";
    chip.title = w + " = " + sum + " → bucket " + (sum % 28) + " → \"" + en + "\"" + (T[en] ? " → " + T[en] : "");
    const word = document.createElement("span");
    word.textContent = w + " ";
    const cs = document.createElement("span");
    cs.className = "cs";
    cs.textContent = sum + "⇒" + (sum % 28);
    chip.appendChild(word);
    chip.appendChild(cs);
    box.appendChild(chip);
  }
}

/* --- ⏱ timestamp an ayah (1–6236) without recording --- */

$("#btn-stamp").addEventListener("click", () => {
  const gv = globalVerse(selectedSurah, selectedAyah);
  const s = surahByNum(selectedSurah);
  addLogEntry({
    id: uid(),
    type: "ayah-stamp",
    ts: new Date().toISOString(),
    surah: selectedSurah,
    ayah: selectedAyah,
    global: gv
  });
  $("#rec-status").textContent =
    `⏱ Timestamped ✓ verse ${gv} — ${s.name} ${selectedSurah}:${selectedAyah} at ${timeStr(new Date().toISOString())}`;
  renderLog();
  maybeAutoPush();
});

function maybeAutoPush() {
  if (ghSettings().autopush && ghSettings().token) {
    pushDayToGitHub(dayKey()).catch((err) => ghStatus("Auto-push failed: " + err.message, false));
  }
}

/* --- MediaRecorder --- */

let mediaRecorder = null;
let chunks = [];
let recStart = 0;
let timerInt = null;

function fmtDur(ms) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

$("#btn-record").addEventListener("click", async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
    mediaRecorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    chunks = [];
    mediaRecorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    mediaRecorder.onstop = onRecordingStopped;
    mediaRecorder.start();
    recStart = Date.now();
    timerInt = setInterval(() => { $("#rec-timer").textContent = fmtDur(Date.now() - recStart); }, 250);
    $("#btn-record").disabled = true;
    $("#btn-stop").disabled = false;
    const st = $("#rec-status");
    st.textContent = `Recording ${surahByNum(selectedSurah).name} ${selectedSurah}:${selectedAyah}…`;
    st.classList.add("recording");
  } catch (err) {
    $("#rec-status").textContent = "Microphone error: " + err.message;
  }
});

$("#btn-stop").addEventListener("click", () => {
  if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
  mediaRecorder?.stream.getTracks().forEach((t) => t.stop());
});

async function onRecordingStopped() {
  clearInterval(timerInt);
  const duration = Date.now() - recStart;
  const blob = new Blob(chunks, { type: mediaRecorder.mimeType || "audio/webm" });
  const id = uid();
  await idb.put(id, blob);

  addLogEntry({
    id,
    type: "recitation",
    ts: new Date().toISOString(),
    surah: selectedSurah,
    ayah: selectedAyah,
    global: globalVerse(selectedSurah, selectedAyah),
    durationMs: duration,
    mime: blob.type
  });

  $("#btn-record").disabled = false;
  $("#btn-stop").disabled = true;
  $("#rec-timer").textContent = "00:00";
  const st = $("#rec-status");
  st.textContent = `Saved ✓ ${surahByNum(selectedSurah).name} ${selectedSurah}:${selectedAyah} (${fmtDur(duration)})`;
  st.classList.remove("recording");
  renderRecordings();
  maybeAutoPush();
}

/* --- recordings list (per day) --- */

async function renderRecordings() {
  const key = dayKey();
  $("#rec-day-label").textContent = key;
  const logs = loadLogs();
  const items = (logs[key] || []).filter((e) => e.type === "recitation");
  const box = $("#rec-list");
  if (!items.length) {
    box.innerHTML = `<p class="muted">No recordings yet today.</p>`;
    return;
  }
  box.innerHTML = "";
  for (const e of items.slice().reverse()) {
    const s = surahByNum(e.surah);
    const row = document.createElement("div");
    row.className = "rec-item";
    const blob = await idb.get(e.id);
    const url = blob ? URL.createObjectURL(blob) : "";
    row.innerHTML = `
      <div class="meta">
        <div><strong>${s.n}. ${s.name}</strong> — ayah ${e.ayah} <span class="muted">(verse ${e.global})</span></div>
        <div class="time">${timeStr(e.ts)} · ${fmtDur(e.durationMs || 0)}</div>
      </div>
      ${url ? `<audio controls src="${url}"></audio>` : `<span class="muted">audio missing</span>`}
      <a class="icon-btn" download="surah${e.surah}-ayah${e.ayah}-${e.id}.webm" href="${url}">⬇</a>
      <button class="icon-btn del" title="Delete">🗑</button>`;
    row.querySelector(".del").addEventListener("click", async () => {
      await idb.del(e.id);
      const logs2 = loadLogs();
      logs2[key] = (logs2[key] || []).filter((x) => x.id !== e.id);
      saveLogs(logs2);
      renderRecordings();
    });
    box.appendChild(row);
  }
}

/* ---------------- scroll finder tab ---------------- */

const scrollBox = $("#surah-scroll");

function buildFinder() {
  scrollBox.innerHTML = "";
  for (const s of SURAHS) {
    const row = document.createElement("div");
    row.className = "surah-row";
    row.dataset.n = s.n;
    row.innerHTML = `
      <span class="num">${s.n}</span>
      <span>${s.name} <span class="ar">${s.ar}</span></span>
      <span class="muted">${s.ayahs} ayahs</span>
      <span class="range">verses ${s.start}–${s.end}</span>`;
    row.addEventListener("click", () => selectSurah(s.n));
    scrollBox.appendChild(row);
  }
}

function highlightFinderRow() {
  scrollBox.querySelectorAll(".surah-row").forEach((r) =>
    r.classList.toggle("selected", Number(r.dataset.n) === selectedSurah));
  const sel = scrollBox.querySelector(".surah-row.selected");
  if (sel) sel.scrollIntoView({ block: "center", behavior: "smooth" });
}

function selectSurah(n, ayah = 1) {
  selectedSurah = n;
  selectedAyah = ayah;
  recSurahSel.value = String(n);
  refreshSelection();
  highlightFinderRow();
  const s = surahByNum(n);
  $("#finder-result").textContent =
    `Selected ${surahLabel(s)} — ayahs 1–${s.ayahs}, global verses ${s.start}–${s.end}.`;
  renderAyahBrowser(n);
}

/* --- exact-ayah browser: every ayah of the surah with its Arabic text --- */

function renderAyahBrowser(n) {
  const s = surahByNum(n);
  $("#ayah-browser").classList.remove("hidden");
  $("#ayah-browser-title").textContent = `${surahLabel(s)} — tap the exact ayah`;
  const list = $("#ayah-list");
  list.innerHTML = "";
  const texts = (window.QURAN_TEXT || {})[String(n)] || [];
  texts.forEach((t, i) => {
    const row = document.createElement("div");
    row.className = "ayah-row" + (n === selectedSurah && i + 1 === selectedAyah ? " selected" : "");
    const num = document.createElement("span");
    num.className = "anum";
    num.textContent = i + 1;
    const txt = document.createElement("span");
    txt.className = "atext";
    txt.textContent = t;
    row.appendChild(num);
    row.appendChild(txt);
    row.addEventListener("click", () => {
      selectSurah(n, i + 1);
      renderAyahBrowser(n);
    });
    list.appendChild(row);
  });
  const sel = list.querySelector(".ayah-row.selected");
  if (sel) sel.scrollIntoView({ block: "center" });
}

/* --- full-text search across all 6236 ayahs (Arabic, diacritic-insensitive) --- */

let normIndex = null;
function buildNormIndex() {
  if (normIndex) return normIndex;
  normIndex = [];
  for (const s of SURAHS) {
    const texts = (window.QURAN_TEXT || {})[String(s.n)] || [];
    texts.forEach((t, i) => normIndex.push({ s: s.n, a: i + 1, norm: normalizeArabic(t), text: t }));
  }
  return normIndex;
}

$("#finder-text").addEventListener("input", (e) => {
  const box = $("#search-results");
  const q = normalizeArabic(e.target.value.trim());
  if (q.length < 2) { box.innerHTML = ""; return; }
  const hits = [];
  for (const item of buildNormIndex()) {
    if (item.norm.includes(q)) {
      hits.push(item);
      if (hits.length >= 40) break;
    }
  }
  box.innerHTML = "";
  if (!hits.length) {
    box.innerHTML = `<p class="muted" style="padding:0.4rem">لا نتائج — no matching ayahs.</p>`;
    return;
  }
  for (const h of hits) {
    const s = surahByNum(h.s);
    const row = document.createElement("div");
    row.className = "search-row";
    const loc = document.createElement("span");
    loc.className = "loc";
    loc.textContent = `${s.name} ${h.s}:${h.a}`;
    const txt = document.createElement("span");
    txt.className = "atext";
    txt.dir = "rtl";
    txt.textContent = h.text.length > 120 ? h.text.slice(0, 120) + "…" : h.text;
    row.appendChild(loc);
    row.appendChild(txt);
    row.addEventListener("click", () => {
      selectSurah(h.s, h.a);
      $("#finder-result").textContent =
        `Found: ${surahLabel(s)}, ayah ${h.a} — global verse ${s.start + h.a - 1}.`;
    });
    box.appendChild(row);
  }
});

$("#finder-search").addEventListener("input", (e) => {
  const q = e.target.value.trim().toLowerCase();
  scrollBox.querySelectorAll(".surah-row").forEach((r) => {
    const s = surahByNum(Number(r.dataset.n));
    const hit = !q || s.name.toLowerCase().includes(q) || s.ar.includes(q) || String(s.n) === q;
    r.classList.toggle("hidden", !hit);
  });
});

$("#finder-go").addEventListener("click", jumpToVerse);
$("#finder-verse").addEventListener("keydown", (e) => { if (e.key === "Enter") jumpToVerse(); });

function jumpToVerse() {
  const v = Number($("#finder-verse").value);
  const resEl = $("#finder-result");
  if (!v || v < 1 || v > TOTAL_VERSES) {
    resEl.textContent = `Enter a verse number between 1 and ${TOTAL_VERSES}.`;
    return;
  }
  const hit = findByGlobalVerse(v);
  selectSurah(hit.surah.n, hit.ayah);
  resEl.textContent =
    `Verse ${v} → ${surahLabel(hit.surah)}, ayah ${hit.ayah} of ${hit.surah.ayahs}.`;
}

/* ---------------- kalima / patterns tab ---------------- */

const kalimaOffsetSel = $("#kalima-offset");
const kalimaPatternSel = $("#kalima-pattern");
fillSurahSelect(kalimaOffsetSel);
kalimaOffsetSel.value = localStorage.getItem(KALIMA_OFFSET_KEY) || "27";
kalimaPatternSel.value = localStorage.getItem(KALIMA_PATTERN_KEY) || "kalima";

function kalimaOffset() { return Number(kalimaOffsetSel.value) || 1; }
function kalimaPattern() { return PATTERNS[kalimaPatternSel.value] ? kalimaPatternSel.value : "kalima"; }
function patternPositions() { return PATTERNS[kalimaPattern()]; }
/* Patterns produce surahs only: every position maps into 1–114. */
function kalimaMap(k) { return ((kalimaOffset() - 1 + (k - 1)) % 114) + 1; }

function kalimaStampsToday() {
  const logs = loadLogs();
  const pat = kalimaPattern();
  return (logs[dayKey()] || []).filter((e) =>
    e.type === "kalima" && e.offset === kalimaOffset() && (e.pattern || "kalima") === pat);
}

function renderKalima() {
  const off = kalimaOffset();
  const pat = kalimaPattern();
  localStorage.setItem(KALIMA_OFFSET_KEY, String(off));
  localStorage.setItem(KALIMA_PATTERN_KEY, pat);
  const stamps = kalimaStampsToday();
  const stampedPositions = new Set(stamps.map((s) => s.position));
  const positions = patternPositions();

  const body = $("#kalima-body");
  body.innerHTML = "";
  positions.forEach((k) => {
    const sn = kalimaMap(k);
    const s = surahByNum(sn);
    const stamp = stamps.find((x) => x.position === k);
    const tr = document.createElement("tr");
    if (stamp) tr.classList.add("done");
    tr.innerHTML = `
      <td><strong>${k}</strong></td>
      <td>${sn}</td>
      <td>${s.name} <span class="ar">${s.ar}</span></td>
      <td>${s.ayahs}</td>
      <td>
        <button class="stamp-btn ${stamp ? "stamped" : ""}">${stamp ? "Stamped" : "Stamp"}</button>
        ${stamp ? `<span class="stamp-time">${timeStr(stamp.ts)}</span>` : ""}
      </td>`;
    tr.querySelector(".stamp-btn").addEventListener("click", () => {
      addLogEntry({
        id: uid(),
        type: "kalima",
        pattern: pat,
        ts: new Date().toISOString(),
        offset: off,
        position: k,
        surah: sn
      });
      // Check completion: every pattern position stamped today for this offset
      const after = kalimaStampsToday();
      const done = new Set(after.map((x) => x.position));
      const alreadyLogged = (loadLogs()[dayKey()] || []).some(
        (e) => e.type === "kalima-complete" && e.offset === off && (e.pattern || "kalima") === pat);
      if (done.size === positions.length && !alreadyLogged) {
        addLogEntry({
          id: uid(),
          type: "kalima-complete",
          pattern: pat,
          ts: new Date().toISOString(),
          offset: off,
          sequence: positions.map(kalimaMap)
        });
      }
      renderKalima();
      maybeAutoPush();
    });
    body.appendChild(tr);
  });

  const count = stampedPositions.size;
  $("#kalima-progress-bar").style.width = `${(count / positions.length) * 100}%`;
  $("#kalima-status").textContent =
    `Pattern: ${pat} · Offset: surah 1 = ${surahLabel(surahByNum(off))} · Sequence: ` +
    positions.map(kalimaMap).join(" · ") +
    ` · ${count}/${positions.length} stamped today` +
    (count === positions.length ? " — ✨ Pattern complete!" : "");
}

kalimaOffsetSel.addEventListener("change", renderKalima);
kalimaPatternSel.addEventListener("change", renderKalima);
document.querySelectorAll(".preset").forEach((b) =>
  b.addEventListener("click", () => { kalimaOffsetSel.value = b.dataset.off; renderKalima(); }));

/* ---------------- daily log tab ---------------- */

$("#log-date").value = dayKey();
$("#log-date").addEventListener("change", renderLog);

function describeEntry(e) {
  if (e.type === "ayah-stamp") {
    const s = surahByNum(e.surah);
    return `⏱ Timestamped <strong>${s.n}. ${s.name}</strong> ayah ${e.ayah} (verse ${e.global})`;
  }
  if (e.type === "recitation") {
    const s = surahByNum(e.surah);
    return `Recorded <strong>${s.n}. ${s.name}</strong> ayah ${e.ayah} (verse ${e.global}) — ${fmtDur(e.durationMs || 0)}`;
  }
  if (e.type === "kalima") {
    const s = surahByNum(e.surah);
    const pat = e.pattern || "kalima";
    return `${pat === "fibonacci" ? "Fibonacci" : "Kalima"} stamp — position ${e.position} → <strong>${s.n}. ${s.name}</strong> (offset: surah 1 = ${e.offset})`;
  }
  if (e.type === "kalima-complete") {
    const pat = e.pattern || "kalima";
    return `✨ Complete ${pat} finished (offset: surah 1 = ${e.offset}) — sequence ${e.sequence.join(" · ")}`;
  }
  return e.type;
}

function renderLog() {
  const key = $("#log-date").value || dayKey();
  const logs = loadLogs();
  const items = logs[key] || [];
  const box = $("#log-entries");
  const recs = items.filter((e) => e.type === "recitation").length;
  const ayahStamps = items.filter((e) => e.type === "ayah-stamp").length;
  const stamps = items.filter((e) => e.type === "kalima").length;
  const completes = items.filter((e) => e.type === "kalima-complete").length;
  $("#log-stats").textContent =
    `${items.length} entries · ${recs} recitations · ${ayahStamps} ayah timestamps · ${stamps} pattern stamps · ${completes} complete patterns`;
  if (!items.length) {
    box.innerHTML = `<p class="muted">No entries for ${key}.</p>`;
    return;
  }
  box.innerHTML = items.map((e) => `
    <div class="log-item">
      <span class="t">${timeStr(e.ts)}</span>
      <span class="badge ${e.type}">${e.type.replace("-", " ")}</span>
      <span>${describeEntry(e)}</span>
    </div>`).join("");
}

function downloadJSON(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

$("#log-export").addEventListener("click", () => {
  const key = $("#log-date").value || dayKey();
  downloadJSON({ date: key, entries: loadLogs()[key] || [] }, `quran-log-${key}.json`);
});
$("#log-export-all").addEventListener("click", () => {
  downloadJSON(loadLogs(), "quran-log-all.json");
});

/* ---------------- Arabic script download ---------------- */

function downloadMd(md, filename) {
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

$("#log-script").addEventListener("click", () => {
  const key = $("#log-date").value || dayKey();
  downloadMd(ScriptBuilder.buildArabicScript(key, loadLogs()[key] || []), `quran-script-${key}.md`);
});

$("#log-yt-script").addEventListener("click", () => {
  const key = $("#log-date").value || dayKey();
  const md = ScriptBuilder.buildYouTubeScript(key, loadLogs()[key] || []);
  if (!md) { alert("No recitations or ayah timestamps for this day yet."); return; }
  downloadMd(md, `quran-youtube-${key}.md`);
});

/* ---------------- GitHub sync ---------------- */

function ghSettings() {
  try { return JSON.parse(localStorage.getItem(GH_KEY)) || {}; }
  catch { return {}; }
}

function ghStatus(msg, ok) {
  const el = $("#gh-status");
  el.textContent = msg;
  el.className = ok ? "ok" : "err";
}

function loadGhForm() {
  const s = ghSettings();
  $("#gh-owner").value = s.owner || "mrbugimposter3-ship-it";
  $("#gh-repo").value = s.repo || "quran-recorder";
  $("#gh-token").value = s.token || "";
  $("#gh-autopush").checked = !!s.autopush;
  $("#gh-audio").checked = !!s.audio;
  $("#gh-auto10").checked = s.auto10 !== false;
}

$("#gh-save").addEventListener("click", () => {
  const s = {
    owner: $("#gh-owner").value.trim(),
    repo: $("#gh-repo").value.trim(),
    token: $("#gh-token").value.trim(),
    autopush: $("#gh-autopush").checked,
    audio: $("#gh-audio").checked,
    auto10: $("#gh-auto10").checked
  };
  localStorage.setItem(GH_KEY, JSON.stringify(s));
  ghStatus("Settings saved in this browser ✓", true);
});

function utf8ToB64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
function blobToB64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/* Merge-safe sync: never overwrite another device's entries.
   entries are unioned by id (fallback: type+ts+surah+ayah) and sorted by ts. */
function entryKey(e) {
  return e.id || `${e.type}|${e.ts}|${e.surah ?? ""}|${e.ayah ?? ""}`;
}
function mergeEntries(...lists) {
  const map = new Map();
  for (const list of lists) for (const e of list || []) { const k = entryKey(e); if (!map.has(k)) map.set(k, e); }
  return [...map.values()].sort((a, b) => String(a.ts || "").localeCompare(String(b.ts || "")));
}
function b64ToUtf8(b64) {
  return decodeURIComponent(escape(atob(String(b64).replace(/\s/g, ""))));
}
function ghHeaders(s) {
  return {
    Authorization: `Bearer ${s.token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json"
  };
}
async function ghGetFile(s, path) {
  const api = `https://api.github.com/repos/${s.owner}/${s.repo}/contents/${path}`;
  const res = await fetch(api + `?t=${Date.now()}`, { headers: ghHeaders(s), cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || `HTTP ${res.status}`); }
  return res.json();
}

async function ghPutFile(s, path, base64Content, message, sha) {
  const api = `https://api.github.com/repos/${s.owner}/${s.repo}/contents/${path}`;
  if (sha === undefined) { const cur = await ghGetFile(s, path); sha = cur ? cur.sha : null; }
  const res = await fetch(api, {
    method: "PUT",
    headers: ghHeaders(s),
    body: JSON.stringify({ message, content: base64Content, ...(sha ? { sha } : {}) })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const e = new Error(err.message || `HTTP ${res.status}`);
    e.status = res.status;
    throw e;
  }
  return res.json();
}

/* fetch remote day log → merge with local → PUT with sha; retry on sha conflicts. */
async function syncDayLog(s, dateKeyStr) {
  const path = `logs/${dateKeyStr}.json`;
  for (let attempt = 0; attempt <= 3; attempt++) {
    const remote = await ghGetFile(s, path);
    let remoteLog = null;
    if (remote && remote.content) { try { remoteLog = JSON.parse(b64ToUtf8(remote.content)); } catch { remoteLog = null; } }
    const logs = loadLogs();
    const merged = mergeEntries(remoteLog && remoteLog.entries, logs[dateKeyStr]);
    logs[dateKeyStr] = merged;           // each phone now sees every device's entries
    saveLogs(logs);
    const now = new Date().toISOString();
    const exportedAt = remoteLog && remoteLog.exportedAt > now ? remoteLog.exportedAt : now;
    const payload = { date: dateKeyStr, exportedAt, entries: merged };
    try {
      await ghPutFile(s, path, utf8ToB64(JSON.stringify(payload, null, 2)),
        `Daily log ${dateKeyStr} (${merged.length} entries)`, remote ? remote.sha : null);
      markSynced(dateKeyStr);
      return merged;
    } catch (err) {
      if ((err.status === 409 || err.status === 422) && attempt < 3) continue; // someone pushed in between — refetch & merge
      throw err;
    }
  }
}

/* pull-only merge (on app open), so a phone sees the other device's stamps */
async function pullDayLog(dateKeyStr) {
  const s = ghSettings();
  if (!s.token || !s.owner || !s.repo) return;
  const remote = await ghGetFile(s, `logs/${dateKeyStr}.json`);
  if (!remote || !remote.content) return;
  const remoteLog = JSON.parse(b64ToUtf8(remote.content));
  const logs = loadLogs();
  const before = (logs[dateKeyStr] || []).length;
  logs[dateKeyStr] = mergeEntries(remoteLog.entries, logs[dateKeyStr]);
  saveLogs(logs);
  if (logs[dateKeyStr].length !== before) renderLog();
}

async function pushDayToGitHub(dateKeyStr) {
  const s = ghSettings();
  if (!s.token || !s.owner || !s.repo) {
    ghStatus("Set owner, repo and token below, then save settings.", false);
    return;
  }
  ghStatus("Syncing log (merge)…", true);
  const entries = await syncDayLog(s, dateKeyStr);
  renderLog();

  if (s.audio) {
    const recs = entries.filter((e) => e.type === "recitation");
    for (let i = 0; i < recs.length; i++) {
      const e = recs[i];
      const blob = await idb.get(e.id);
      if (!blob) continue;               // recorded on another device
      const path = `recordings/${dateKeyStr}/surah${e.surah}-ayah${e.ayah}-${e.id}.webm`;
      if (await ghGetFile(s, path)) continue; // already uploaded — never overwrite
      ghStatus(`Uploading audio ${i + 1}/${recs.length}…`, true);
      await ghPutFile(s, path, await blobToB64(blob), `Recording ${dateKeyStr} — ${e.surah}:${e.ayah}`, null);
    }
  }
  ghStatus(`Synced ✓ logs/${dateKeyStr}.json (${entries.length} entries, merged) — the 8 PM Action will build the Arabic script.`, true);
}

$("#log-push").addEventListener("click", () => {
  const key = $("#log-date").value || dayKey();
  pushDayToGitHub(key).catch((err) => ghStatus("Push failed: " + err.message, false));
});

/* ---------------- fast picker: surah grid → ayah grid (no scrolling) ---------------- */
const PICK_KEY = "quranRecorder.pickMode";
function buildSurahGrid() {
  $("#surah-grid").innerHTML = SURAHS.map((s) =>
    `<button data-n="${s.n}" title="${s.n}. ${s.name} — ${s.ayahs}"><b>${s.n}</b><span>${s.ar}</span></button>`).join("");
  $("#surah-grid").addEventListener("click", (ev) => {
    const b = ev.target.closest("button[data-n]");
    if (!b) return;
    selectSurah(Number(b.dataset.n), 1);
    openAyahGrid(Number(b.dataset.n));
  });
}
function stampedToday(n) {
  return new Set((loadLogs()[dayKey()] || []).filter((e) => e.surah === n).map((e) => e.ayah));
}
function openAyahGrid(n) {
  const s = surahByNum(n), done = stampedToday(n);
  $("#ag-title").textContent = `${s.n}. ${s.ar} — ${s.name} (${s.ayahs})`;
  let h = "";
  for (let a = 1; a <= s.ayahs; a++)
    h += `<button data-a="${a}" class="${a === selectedAyah && n === selectedSurah ? "on " : ""}${done.has(a) ? "stamped" : ""}">${a}</button>`;
  $("#ayah-grid").innerHTML = h;
  $("#surah-grid").classList.add("hidden");
  $("#ayah-grid-wrap").classList.remove("hidden");
}
function closeAyahGrid() {
  $("#ayah-grid-wrap").classList.add("hidden");
  $("#surah-grid").classList.remove("hidden");
  $("#surah-grid").querySelectorAll("button").forEach((b) => b.classList.toggle("on", Number(b.dataset.n) === selectedSurah));
}
function initGridPicker() {
  buildSurahGrid();
  $("#ag-back").addEventListener("click", closeAyahGrid);
  $("#ayah-grid").addEventListener("click", (ev) => {
    const b = ev.target.closest("button[data-a]");
    if (!b) return;
    selectedAyah = Number(b.dataset.a);
    refreshSelection();
    $("#ayah-grid").querySelectorAll("button.on").forEach((x) => x.classList.remove("on"));
    b.classList.add("on");
    if ($("#pick-onetap").checked) { $("#btn-stamp").click(); b.classList.add("stamped"); }
    else $("#btn-stamp").scrollIntoView({ block: "nearest", behavior: "smooth" });
  });
  $("#pick-onetap").checked = localStorage.getItem(PICK_KEY + ".onetap") === "1";
  $("#pick-onetap").addEventListener("change", (e) => localStorage.setItem(PICK_KEY + ".onetap", e.target.checked ? "1" : "0"));
  $("#pick-modes").addEventListener("click", (ev) => {
    const b = ev.target.closest("button[data-mode]");
    if (b) setPickMode(b.dataset.mode);
  });
  setPickMode(localStorage.getItem(PICK_KEY) || "grid");
}
/* Tree mode: tree-picker.html (iframe) posts {type:"ayahpicked", surah, ayah} */
function onTreePicked(d) {
  const s = surahByNum(Number(d.surah));
  if (!s) return;
  selectSurah(s.n, Math.min(Math.max(1, Number(d.ayah) || 1), s.ayahs));
  if ($("#pick-onetap").checked) $("#btn-stamp").click();
  else $("#btn-stamp").scrollIntoView({ block: "nearest", behavior: "smooth" });
}
window.addEventListener("message", (ev) => {
  if (ev.origin !== location.origin && ev.origin !== "null") return;
  if (ev.data && ev.data.type === "ayahpicked") onTreePicked(ev.data);
});
function setPickMode(m) {
  localStorage.setItem(PICK_KEY, m);
  $("#pick-modes").querySelectorAll(".pm").forEach((b) => b.classList.toggle("on", b.dataset.mode === m));
  $("#grid-picker").classList.toggle("hidden", m !== "grid");
  $("#dial-picker").classList.toggle("hidden", m !== "dial");
  $("#tree-picker").classList.toggle("hidden", m !== "tree");
  $("#speak-picker").classList.toggle("hidden", m !== "speak");
  if (m === "tree" && !$("#tree-frame").src) $("#tree-frame").src = "tree-picker.html?v=pwa1";
  if (m === "grid") closeAyahGrid(); else { dialFor = null; refreshSelection(); }
}

/* ---------------- auto-push every 10 min, only when today's log changed ---------------- */
const SYNCED_KEY = "quranRecorder.syncedSig";
const AUTO10_LAST = "quranRecorder.auto10Last";
const AUTO10_MS = 10 * 60 * 1000;
function logSig(dateKeyStr) {
  const l = loadLogs()[dateKeyStr] || [];
  let h = 5381;
  for (const k of l.map((e) => e.id || e.ts).sort().join(",")) h = ((h << 5) + h + k.charCodeAt(0)) | 0;
  return l.length + ":" + h;
}
function markSynced(dateKeyStr) {
  const m = JSON.parse(localStorage.getItem(SYNCED_KEY) || "{}");
  m[dateKeyStr] = logSig(dateKeyStr);
  localStorage.setItem(SYNCED_KEY, JSON.stringify(m));
}
function isDirty(dateKeyStr) {
  if (!(loadLogs()[dateKeyStr] || []).length) return false;
  const m = JSON.parse(localStorage.getItem(SYNCED_KEY) || "{}");
  return m[dateKeyStr] !== logSig(dateKeyStr);
}
function auto10Enabled() {
  const s = ghSettings();
  return !!s.token && s.auto10 !== false;   // default on when a token is saved
}
function showAuto10Last() {
  const t = localStorage.getItem(AUTO10_LAST);
  const el = $("#gh-auto10-last");
  if (el) el.textContent = "Last auto-push: " + (t ? new Date(t).toLocaleString() : "never");
}
let auto10Busy = false;
async function auto10Tick(reason = "timer") {
  if (auto10Busy || !auto10Enabled() || !navigator.onLine) return false;
  const key = dayKey();
  if (!isDirty(key)) return false;           // nothing changed → no network
  auto10Busy = true;
  try {
    await pushDayToGitHub(key);
    localStorage.setItem(AUTO10_LAST, new Date().toISOString());
    showAuto10Last();
    return true;
  } catch (err) {
    ghStatus(`Auto-push (${reason}) failed: ` + err.message, false);
    return false;
  } finally { auto10Busy = false; }
}
function initAuto10() {
  showAuto10Last();
  setInterval(() => { if (!document.hidden) auto10Tick("10-min"); }, AUTO10_MS);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) auto10Tick("focus"); });
  window.addEventListener("focus", () => auto10Tick("focus"));
}

/* ---------------- 🎤 Speak mode + typed smart search ---------------- */
const SPEAK_LANG_KEY = "quranRecorder.speakLang";
let speakPending = null;
function showSpeakPick(text) {
  const r = parsePick(text, SURAHS);
  const box = $("#speak-result");
  box.classList.remove("hidden");
  if (!r.ok) {
    speakPending = null;
    $("#speak-pick").textContent = `✗ «${text}» — ${r.reason || "not understood"}`;
    $("#speak-confirm").disabled = true;
    return r;
  }
  speakPending = r;
  const s = surahByNum(r.surah);
  selectSurah(r.surah, r.ayah);
  $("#speak-pick").textContent = `✓ ${s.ar} (${s.n}) — آية ${r.ayah}  ·  ${s.name} ${r.surah}:${r.ayah}`;
  $("#speak-confirm").disabled = false;
  if ($("#pick-onetap").checked) stampSpeakPending();
  return r;
}
function stampSpeakPending() {
  if (!speakPending) return;
  selectedSurah = speakPending.surah; selectedAyah = speakPending.ayah; refreshSelection();
  $("#btn-stamp").click();
  $("#speak-pick").textContent += "  ⏱ stamped";
  speakPending = null;
  $("#speak-confirm").disabled = true;
}
function setSpeakLang(l) {
  localStorage.setItem(SPEAK_LANG_KEY, l);
  document.querySelectorAll("#speak-picker .sl").forEach((b) => b.classList.toggle("on", b.dataset.lang === l));
}
function initSpeak() {
  setSpeakLang(localStorage.getItem(SPEAK_LANG_KEY) || "ar-SA");
  document.querySelectorAll("#speak-picker .sl").forEach((b) => b.addEventListener("click", () => setSpeakLang(b.dataset.lang)));
  $("#smart-form").addEventListener("submit", (e) => { e.preventDefault(); const q = $("#smart-q").value.trim(); if (q) showSpeakPick(q); });
  $("#speak-confirm").addEventListener("click", stampSpeakPending);
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const mic = $("#speak-mic");
  if (!SR) {
    mic.disabled = true; mic.title = "Speech recognition not supported in this browser";
    $("#speak-heard").textContent = "🎤 Voice isn't supported in this browser — type below (same phrases work).";
    return;
  }
  let rec = null;
  mic.addEventListener("click", () => {
    if (rec) { rec.stop(); return; }
    rec = new SR();
    rec.lang = localStorage.getItem(SPEAK_LANG_KEY) || "ar-SA";
    rec.interimResults = true; rec.maxAlternatives = 5; rec.continuous = false;
    mic.classList.add("listening");
    $("#speak-heard").textContent = rec.lang.startsWith("ar") ? "…أستمع" : "Listening…";
    rec.onresult = (ev) => {
      const res = ev.results[ev.results.length - 1];
      $("#speak-heard").textContent = "🗣 " + res[0].transcript;
      if (!res.isFinal) return;
      const alts = Array.from(res).map((a) => a.transcript);
      const hit = alts.find((t) => parsePick(t, SURAHS).ok);   // first alternative that parses
      $("#smart-q").value = hit || alts[0];
      showSpeakPick(hit || alts[0]);
    };
    rec.onerror = (ev) => { $("#speak-heard").textContent = "🎤 " + (ev.error === "not-allowed" ? "Microphone permission denied" : "Error: " + ev.error); };
    rec.onend = () => { mic.classList.remove("listening"); rec = null; };
    rec.start();
  });
}

/* ---------------- PWA: service worker + install button ---------------- */
let deferredInstall = null;
function initPWA() {
  if ("serviceWorker" in navigator && location.protocol !== "file:")
    navigator.serviceWorker.register("sw.js").catch((e) => console.warn("SW failed", e));
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); deferredInstall = e;
    if (!standalone) $("#btn-install").classList.remove("hidden");
  });
  $("#btn-install").addEventListener("click", async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    await deferredInstall.userChoice.catch(() => {});
    deferredInstall = null; $("#btn-install").classList.add("hidden");
  });
  window.addEventListener("appinstalled", () => $("#btn-install").classList.add("hidden"));
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (ios && !standalone && localStorage.getItem("quranRecorder.iosHint") !== "x") $("#ios-install").classList.remove("hidden");
  $("#ios-x").addEventListener("click", () => { $("#ios-install").classList.add("hidden"); localStorage.setItem("quranRecorder.iosHint", "x"); });
}

/* ---------------- init ---------------- */

(async function init() {
  initGridPicker();   // picker + auto-push don't depend on IndexedDB
  initAuto10();
  initSpeak();
  initPWA();
  await idb.open();
  buildFinder();
  buildSurahStrip();
  initAyahDialScroll();
  refreshSelection();
  highlightFinderRow();
  renderKalima();
  renderRecordings();
  renderLog();
  loadGhForm();
  pullDayLog(dayKey()).catch(() => {});
})();
