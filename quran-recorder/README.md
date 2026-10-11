# 📖 Quran Recorder

A zero-dependency static web app for recording Quran recitation, browsing all 114 surahs, and tracking a daily **kalima** sequence — with every action timestamped into a per-day log.

**Live:** hosted on GitHub Pages (see repo Pages settings).

## Features

### 🎙 Recorder
- Pick any surah (1–114) and ayah; the app shows the matching **global verse number (1–6236)**.
- Record audio with your microphone (Web Audio / MediaRecorder).
- Recordings are saved with an **ISO timestamp** into a per-day log.
- Play back, download (`.webm`), or delete recordings.

### 📜 Scroll Finder
- Scrollable list of all 114 surahs with Arabic names, ayah counts, and global verse ranges.
- Search by name or surah number.
- Type any verse number **1–6236** to jump straight to its surah and ayah.

### 🕋 Kalima Tracker
- A complete kalima is the set **1 · 6 · 8 · 10 · 12 · 23 · 24 · 27**.
- Choose which surah counts as **surah 1** (presets: 27, 24, 12, 6). The whole sequence is offset from that surah, wrapping around 114:
  `mappedSurah = ((offset - 1 + position - 1) mod 114) + 1`
- Stamp each position as you complete it — every stamp is **timestamped**.
- When all 8 positions are stamped in a day, a **"complete kalima"** event is logged with its own timestamp.

### 🗓 Daily Log
- All recitations, kalima stamps, and completions, grouped per day.
- Export any day (or everything) as JSON.

## Data & privacy
Everything is stored locally in your browser:
- **localStorage** — log entries and kalima offset preference
- **IndexedDB** — recorded audio blobs

Nothing is uploaded anywhere.

## Running locally
Open `index.html` via a local server (microphone access requires `localhost` or HTTPS):

```bash
# any static server works, e.g.
python -m http.server 8000
# then open http://localhost:8000
```

## Files
| File | Purpose |
|---|---|
| `index.html` | App shell (4 tabs) |
| `styles.css` | Dark theme styling |
| `surah-data.js` | All 114 surahs: names (EN/AR), ayah counts (sums to 6236), global verse ranges |
| `app.js` | Recorder, finder, kalima, and log logic |
