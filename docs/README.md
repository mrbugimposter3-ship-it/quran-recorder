# 📖 Quran Recorder

A zero-dependency static web app for recording Quran recitation throughout the day from your phone, browsing all 114 surahs, tracking a daily **kalima** sequence — and automatically turning each day's recorded ayahs into a fully **Arabic script** on GitHub.

**Live:** hosted on GitHub Pages (see repo Pages settings).

## The daily workflow

1. **All day, on your phone:** open the app, pick a surah/ayah (or global verse # 1–6236), record it. Every recording is timestamped into today's log.
2. **Push to GitHub:** tap **⬆ Push to GitHub** (or enable *auto-push after every recording*). Your day goes to `logs/YYYY-MM-DD.json` in the repo.
3. **8:00 PM ET, automatically:** a GitHub Action reads the day's log, looks up the **Arabic (Uthmani) text** of every ayah you recorded, converts all numbers to Arabic-Indic digits, and commits a ready script to **`scripts/YYYY-MM-DD.md`**.
4. Anytime: tap **📜 Arabic script** in the app to download today's script instantly, no waiting.

## Features

### 🎙 Recorder
- Pick any surah (1–114), ayah, **or global verse # 1–6236** — all three stay in sync.
- Record audio with your microphone (Web Audio / MediaRecorder).
- Recordings are saved with an **ISO timestamp** into a per-day log.
- Play back, download (`.webm`), or delete recordings.

### 📜 Scroll Finder
- Scrollable list of all 114 surahs with Arabic names, ayah counts, and global verse ranges.
- Search by name or number; type any verse **1–6236** to jump straight to it.

### 🕋 Kalima Tracker
- A complete kalima is the set **1 · 6 · 8 · 10 · 12 · 23 · 24 · 27**.
- Choose which surah counts as **surah 1** (presets: 27, 24, 12, 6); the sequence shifts by that offset (wrapping around 114):
  `mappedSurah = ((offset - 1 + position - 1) mod 114) + 1`
- Stamp each position — every stamp is timestamped; all 8 in a day logs a **✨ complete kalima**.

### 🗓 Daily Log + ☁️ GitHub Sync
- All recitations, kalima stamps, and completions, grouped per day.
- Export JSON, download the **Arabic script**, or push the day to GitHub.
- Optional: also upload the audio files to `recordings/YYYY-MM-DD/`.

## Setting up GitHub sync (one time, on your phone)

1. Create a **fine-grained personal access token** at <https://github.com/settings/personal-access-tokens>:
   - Repository access: **Only select repositories** → `quran-recorder`
   - Permissions → Repository permissions → **Contents: Read and write**
2. In the app → Daily Log tab → **☁️ GitHub Sync** card → paste the token → **Save settings**.
3. The token is stored **only in your browser's localStorage** — it is never committed to the repo.

## The 8 PM Action

`.github/workflows/daily-script.yml` runs at 8:00 PM America/New_York (both DST variants — the script verifies the ET hour). It:

- reads `logs/<today ET>.json` (pushed from the app)
- builds the Arabic script with the same `docs/script-builder.js` the app uses
- commits `scripts/<today ET>.md`

You can also run it manually anytime: **Actions → Daily Quran script (8 PM ET) → Run workflow** (builds today's script immediately).

> Note: GitHub's scheduled workflows can run a few minutes late on free accounts.

## Example generated script (`scripts/2026-10-12.md`)

```markdown
# وِرد اليوم — ١٢ أكتوبر ٢٠٢٦

بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ

**عدد الآيات المُسجَّلة:** ٣  ·  **عدد الكلمات:** ٧٠

## سورة البقرة ٢

### الآية ٢٥٥  ·  ترتيبها في المصحف: ٢٦٢

ٱللَّهُ لَآ إِلَٰهَ إِلَّا هُوَ ٱلْحَىُّ ٱلْقَيُّومُ … ﴿٢٥٥﴾

> 🎙 سُجِّلت الساعة ١:١٥ م  ·  المدة: ٠:٤٣  ·  الكلمات: ٥٠
```

## Data & privacy
- **localStorage** — log entries, kalima offset, GitHub settings (token stays on your device)
- **IndexedDB** — recorded audio blobs
- **Quran text** — Uthmani script from [risan/quran-json](https://github.com/risan/quran-json) (Tanzil dataset), bundled in `docs/quran-text.js` (all 114 surahs / 6236 verses, works offline)

## Running locally
```bash
python -m http.server 8000   # then open http://localhost:8000
```
(Microphone requires `localhost` or HTTPS — GitHub Pages qualifies.)

## Files
| File | Purpose |
|---|---|
| `index.html` / `styles.css` / `app.js` | The app (4 tabs + GitHub sync) |
| `surah-data.js` | All 114 surahs: names (EN/AR), ayah counts (sums to 6236), verse ranges |
| `quran-text.js` | Full Quran, Uthmani Arabic text, indexed by surah/ayah |
| `script-builder.js` | Builds the Arabic markdown script (shared by app + Action) |
| `../.github/workflows/daily-script.yml` | 8 PM ET scheduled Action |
| `../tools/build-daily-script.js` | Node script the Action runs |
| `../logs/` | Daily logs pushed from the app |
| `../scripts/` | Generated Arabic scripts |
