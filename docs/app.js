/* ============================================================
   Quran Recorder — surah/ayah recorder, scroll finder,
   kalima tracker, per-day timestamped logs.
   Data: localStorage (log entries) + IndexedDB (audio blobs).
   ============================================================ */

"use strict";

const $ = (sel) => document.querySelector(sel);
const KALIMA_BASE = [1, 6, 8, 10, 12, 23, 24, 27];
const LOG_KEY = "quranRecorder.logs.v1";
const KALIMA_OFFSET_KEY = "quranRecorder.kalimaOffset";

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
  $("#rec-global").textContent = globalVerse(selectedSurah, selectedAyah);
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
}

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

/* ---------------- kalima tab ---------------- */

const kalimaOffsetSel = $("#kalima-offset");
fillSurahSelect(kalimaOffsetSel);
kalimaOffsetSel.value = localStorage.getItem(KALIMA_OFFSET_KEY) || "27";

function kalimaOffset() { return Number(kalimaOffsetSel.value) || 1; }
function kalimaMap(k) { return ((kalimaOffset() - 1 + (k - 1)) % 114) + 1; }

function kalimaStampsToday() {
  const logs = loadLogs();
  return (logs[dayKey()] || []).filter((e) => e.type === "kalima" && e.offset === kalimaOffset());
}

function renderKalima() {
  const off = kalimaOffset();
  localStorage.setItem(KALIMA_OFFSET_KEY, String(off));
  const stamps = kalimaStampsToday();
  const stampedPositions = new Set(stamps.map((s) => s.position));

  const body = $("#kalima-body");
  body.innerHTML = "";
  KALIMA_BASE.forEach((k) => {
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
        ts: new Date().toISOString(),
        offset: off,
        position: k,
        surah: sn
      });
      // Check completion: all 8 positions stamped today for this offset
      const after = kalimaStampsToday();
      const done = new Set(after.map((x) => x.position));
      const alreadyLogged = (loadLogs()[dayKey()] || []).some(
        (e) => e.type === "kalima-complete" && e.offset === off);
      if (done.size === KALIMA_BASE.length && !alreadyLogged) {
        addLogEntry({
          id: uid(),
          type: "kalima-complete",
          ts: new Date().toISOString(),
          offset: off,
          sequence: KALIMA_BASE.map(kalimaMap)
        });
      }
      renderKalima();
    });
    body.appendChild(tr);
  });

  const count = stampedPositions.size;
  $("#kalima-progress-bar").style.width = `${(count / KALIMA_BASE.length) * 100}%`;
  $("#kalima-status").textContent =
    `Offset: surah 1 = ${surahLabel(surahByNum(off))} · Sequence: ` +
    KALIMA_BASE.map(kalimaMap).join(" · ") +
    ` · ${count}/${KALIMA_BASE.length} stamped today` +
    (count === KALIMA_BASE.length ? " — ✨ Complete kalima!" : "");
}

kalimaOffsetSel.addEventListener("change", renderKalima);
document.querySelectorAll(".preset").forEach((b) =>
  b.addEventListener("click", () => { kalimaOffsetSel.value = b.dataset.off; renderKalima(); }));

/* ---------------- daily log tab ---------------- */

$("#log-date").value = dayKey();
$("#log-date").addEventListener("change", renderLog);

function describeEntry(e) {
  if (e.type === "recitation") {
    const s = surahByNum(e.surah);
    return `Recorded <strong>${s.n}. ${s.name}</strong> ayah ${e.ayah} (verse ${e.global}) — ${fmtDur(e.durationMs || 0)}`;
  }
  if (e.type === "kalima") {
    const s = surahByNum(e.surah);
    return `Kalima stamp — position ${e.position} → <strong>${s.n}. ${s.name}</strong> (offset: surah 1 = ${e.offset})`;
  }
  if (e.type === "kalima-complete") {
    return `✨ Complete kalima finished (offset: surah 1 = ${e.offset}) — sequence ${e.sequence.join(" · ")}`;
  }
  return e.type;
}

function renderLog() {
  const key = $("#log-date").value || dayKey();
  const logs = loadLogs();
  const items = logs[key] || [];
  const box = $("#log-entries");
  const recs = items.filter((e) => e.type === "recitation").length;
  const stamps = items.filter((e) => e.type === "kalima").length;
  const completes = items.filter((e) => e.type === "kalima-complete").length;
  $("#log-stats").textContent =
    `${items.length} entries · ${recs} recitations · ${stamps} kalima stamps · ${completes} complete kalimas`;
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

/* ---------------- init ---------------- */

(async function init() {
  await idb.open();
  buildFinder();
  refreshSelection();
  highlightFinderRow();
  renderKalima();
  renderRecordings();
  renderLog();
})();
