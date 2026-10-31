# 📖 Quran Recorder

A zero-dependency static web app for recording Quran recitation throughout the day from your phone, browsing all 114 surahs, tracking a daily **kalima** sequence — and automatically turning each day's recorded ayahs into a fully **Arabic script** on GitHub.

**Live:** hosted on GitHub Pages (see repo Pages settings).

## The daily workflow

1. **All day, on your phone:** open the app, pick a surah/ayah (or global verse # 1–6236), record it. Every recording is timestamped into today's log.
2. **Push to GitHub:** tap **⬆ Push to GitHub** (or enable *auto-push after every recording*). Your day goes to `logs/YYYY-MM-DD.json` in the repo.
3. **8:00 PM ET, automatically:** a GitHub Action reads the day's log, looks up the **Arabic (Uthmani) text** of every ayah you recorded, converts all numbers to Arabic-Indic digits, and commits two scripts:
   - **`scripts/YYYY-MM-DD.md`** — the daily wird script with word-by-word جُمَّل analysis
   - **`scripts/YYYY-MM-DD-youtube.md`** — a **YouTube-ready video script** in the channel-kit format (timed sections, « » voiceover text, [B-ROLL] AI prompts, paste-ready description with chapters/tags)
4. Anytime: tap **📜 Arabic script** or **🎬 YouTube script** in the app to download instantly, no waiting.

## Features

### 🎙 Recorder
- Pick any surah (1–114), ayah, **or global verse # 1–6236** — all three stay in sync.
- Record audio with your microphone (Web Audio / MediaRecorder).
- Recordings are saved with an **ISO timestamp** into a per-day log.
- Play back, download (`.webm`), or delete recordings.

### 📜 Scroll Finder
- Scrollable list of all 114 surahs with Arabic names, ayah counts, and global verse ranges.
- Search by name or number; type any verse **1–6236** to jump straight to it.

### 🔎 Ayah Finder آیت تلاش (v1.5.0)
Type or paste any English text (for example a clothes description like "soft green wool coat") and get the 5 closest ayat by meaning, each with surah name, Uthmani Arabic, Pickthall's English (1930, public domain), a match score and a 📋 Copy button that copies `Arabic — English (Pickthall) — Quran S:A`. All 6236 Pickthall ayat were embedded offline with `Xenova/all-MiniLM-L6-v2` (q8) and stored as int8 (`docs/ayah-finder/emb-minilm-int8.bin`, 2.4 MB; text in `pickthall.json`, 0.8 MB). The query is embedded on the phone with transformers.js 3.8.1, lazy-loaded only when the tab opens and cached by the service worker with the ~23 MB model. Score = 0.5·cosine + 0.5·keyword boost (concrete words + synonyms such as coat → garment/raiment, leather → hides). If the model can't load it falls back to the offline keyword match. Rebuild the data with `tools/build-ayah-embeddings.mjs`; test with `node tools/test-ayah-finder.js` (add `AF_TJS=<folder with @huggingface/transformers>` for the semantic checks).

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

## Fast ayah picker (v picker1)
- **▦ Grid** (default): all 114 surahs on one grid (number + Arabic name). Tap a surah → grid of its ayat → tap an ayah to select. Ayat already stamped today are highlighted. Turn on **One-tap stamp** to log the ayah right away when you tap it.
- **◎ Dial**: the original surah strip and ayah wheel.
- **🌳 Tree**: `tree-picker.html` loaded in an iframe; when it emits `ayahpicked`, that ayah is selected (and stamped when One-tap is on).

## Auto-push every 10 minutes
In GitHub Sync, **Auto-push every 10 min** is on by default once a token is saved. Every 10 minutes (while the app is open and visible), and whenever the app regains focus, it pushes today's log with the merge sync, but only if the log has changed since the last successful sync. When nothing has changed, it makes no network requests. The time of the last auto-push is shown under the toggle.

## Install as an app (v1.0)
- **Android (Chrome/Edge):** open the site and tap **📲 Install app** (or ⋮ menu → *Install app / Add to Home screen*).
- **iPhone/iPad (Safari):** tap **Share** → **Add to Home Screen**. A hint about this shows on iOS.
- The service worker (`sw.js`) caches only the app shell, so the app opens offline. GitHub API, alquran.cloud and archive.org requests always go to the network. Bump `VERSION` in `sw.js` (and the `?v=` query) with every release.

## 🎤 Speak mode
Tap the mic and say a surah and an ayah, e.g. «يس ٤٩», «البقرة مئتين وخمسة وخمسين», "Yasin 49", "36 49", "surah 2 ayah 255". Use the عربي / English toggle to switch recognition between ar-SA and en-US. The parser (`speak-parse.js`) understands:
- Arabic and English surah names, with common spelling variants and fuzzy matching
- Arabic-Indic and Western digits
- Arabic number words and ordinals
- English number words
The recognized pick is shown with a **✓ Stamp** button (or it is stamped right away when One-tap is on). The typed smart-search box accepts the same phrases. It is always there, including in browsers without speech recognition. Tests: `node tools/test-speak-parse.js`.

## # Any number → ayah, and 🔢 Sequence mode (v1.1)
- **Any number box** (top of Selection): type any whole number, of any size, negatives allowed (Arabic-Indic digits and commas are fine too). It maps to global ayah `((n − 1) mod 6236) + 1` and selects it. Examples: `10000 → #3764 → 36:59`, `6236 → 114:6`, `0 → #6236 (114:6)`, `-1 → #6235 (114:5)`, `6237 → 1:1`.
- **🔢 Seq mode**: pick a sequence, then use **Next ▶ / ◀ Prev** to step through its terms. Each term (plus the offset) is mod-6236'd to an ayah and selected, and stamped right away if One-tap is on.
  - **Term #** jumps to any position.
  - **Offset** is added to every term.
  - **📍 From current ayah** sets the offset so the current term lands on the ayah you have selected. Next/Prev then follow the sequence's steps from there.
  - The sequence and the position in each sequence are remembered.
- Sequences: natural, Fibonacci, Lucas, primes, squares, cubes, cube roots (`⌊1000·∛n⌋`, i.e. ∛n to 3 decimals; plain `⌊∛n⌋` would repeat the same ayah ~3k² times in a row), triangular, pentagonal, hexagonal, tetrahedral, Catalan, powers of 2, factorials, π / φ / e digits as running numbers (3, 31, 314…), golden angle `⌊n·137.508⌋`, Padovan, perfect numbers (from the first 20 Mersenne primes), Collatz from a seed.
- All arithmetic uses BigInt, so huge terms (factorials, 2ⁿ, digit strings) are exact. Tests: `node tools/test-sequences.js`.

## 🤲 Spending in Allah's cause — «الإنفاق في سبيل الله» (v1.3.2)

A card below the tabs (visible on every tab) shows one ayah per day, rotating by local date through 2:261, 2:245, 2:274, 9:60, 9:103, 57:7, 57:11, 57:18, 61:10–11, 63:10, 64:16 and 3:92. The Arabic is the bundled Uthmani text (checked against api.alquran.cloud `quran-uthmani`; only pause marks differ). English is Pickthall (1930, public domain). Logic in `spend.js`; tests: `node tools/test-spend.js`.

The footer has a separate "Tools we use: Postiz (referral link)" line (`rel="noopener sponsored"`). It is kept apart from the ayah card on purpose.

## 📚 Books کتابیں (v1.4.0)
The old 📚 Geronimo mode is now **📚 Books کتابیں**, a picker with Geronimo Stilton plus six more works. Number pairing only, just for fun: unit = ((S−1) mod N)+1 for surah S, and a sub-unit from the ayah where the work has one.

- 📚 Geronimo Stilton (86): unchanged; holiday books show "No pairing", ghost books keep 👻 kirinomori.
- 💍 The Lord of the Rings (62 chapters): titles and our own summaries only (copyrighted, no quotes).
- 🎭 Shakespeare's plays (38: First Folio 36 + Pericles + Two Noble Kinsmen): scene shown as Act.Scene, plus a public-domain line.
- 📜 Sonnets (154): line number, plus the opening line.
- 🕯️ Kashf al-Mahjub (Nicholson 1911, 25 chapters).
- 🏯 The Art of War (Giles 1910, 13 chapters): verse, with Giles's text of that verse.
- 💎 Fusus al-Hikam (27 فص with prophet).

### More Geronimo series (v1.6.0)
13 more series from the Geronimo Stilton world, right after 📚 Geronimo in the picker. Same rule with each series' own N. They're copyrighted, so the card shows the series' book number and title only: no text, no summary line, no covers.

🦣 Cavemice (15) · 🦸 Heromice (2) · ⛵ Micekings (7) · 🚀 Spacemice (12) · 🖼️ Graphic Novels (10) · 🐉 Kingdom of Fantasy (15 + 2 special editions = 17) · 📖 Geronimo Retells the Classics (2) · ⭐ Special Editions (7) · 🌸 Thea Stilton (30) · 🧚 Thea Stilton Special Editions (7) · 🎓 Mouseford Academy (8) · 🦇 Creepella von Cacklefur (9) · ⏳ The Journey Through Time (8).

N counts the books in our list, so a series with gaps in its numbering (Thea Stilton has no #9, #22 or #31 here) still pairs every surah: unit n is the position in the list, and the card shows the real book number, e.g. "#9/30 · Book 10".

The card under "📍 Current ayah" follows the selected surah:ayah. Data: `docs/books-data.js`, generated by `node tools/gen-books-data.js` from `/workspace/geronimo-map/books/*.json`. Tests: `node tools/test-books.js`.

### Temu + Macy's search buttons (v1.7.0)
Each slot in the Letter Wardrobe's "Real clothes اصل کپڑے" list (Top, Outer, Bottom) now has two extra buttons, **Temu تیمو** and **Macy's میسیز**. They open a plain store search for that slot's "&lt;fabric&gt; &lt;garment&gt;", for example "silk top", "ribbed knit long coat" or "striped pants" (outerwear uses the coat cut: long coat, jacket or vest). Example: `https://www.temu.com/search_result.html?search_key=silk%20top` and `https://www.macys.com/shop/search?keyword=silk%20top`. They're plain search links that open in a new tab, with no affiliate codes, no scraping and no store images. Code: `searchQuery` / `searchLinks` in `docs/wardrobe.js`. Tests: `node tools/test-letters.js`.

## 👗 12-Month Wardrobe بارہ ماہ کے لباس (v1.8.0)
Live page: **`wardrobe-calendar.html`** (linked from the Letters picker). The Letter Wardrobe method applied to whole surah series: **12 months of 9 surahs each — 1–9, 10–18, 19–27 … 100–108**. Each month gets **two outfits that never mix**: one from only its **odd**-numbered surahs, one from only its **even**-numbered surahs — 12 × 2 = **24 clothes**. The six short surahs **109–114** sit outside the months: each gets two more outfits, one from its **odd** ayahs and one from its **even** ayahs — 6 × 2 = **12 clothes**. **36 outfits in total.** For every set, all its ayahs are joined into one text and the letters decide the clothes: top = first letter, outerwear = middle letter (cut by its strength), bottom = last letter, hair = word count mod 3 — same as `docs/wardrobe.js`. Each outfit card shows the pixel avatar (tap it for a PNG), the letters/fabrics, real store product links and the Temu/Macy's search links for its three slots. Letter sounds only; implies nothing about meaning. Code: `docs/wardrobe-calendar.js` + `docs/wardrobe-calendar.html`. Tests: `node tools/test-wardrobe-calendar.js`.

### In every app (v1.9.0)
The 12-Month Wardrobe is now part of **every app surface**: it's in the **service-worker shell** (`docs/sw.js`, VERSION `v1.9.0`), so all installed apps (phone/desktop PWA) precache it and it works **offline** — the offline navigation fallback now serves the requested page itself (e.g. `wardrobe-calendar.html`) instead of always falling back to `index.html`. The **PWA manifest** has a `shortcuts` entry, so long-pressing the app icon (Android/desktop) gives a direct **12-Month Wardrobe** shortcut. And the page is linked from the **footer** (visible on every tab) as well as the Letters picker.

### Exact-colour matching + custom makers (v1.10.0)
Every slot now shows its **exact colour** — the same hex as the pixel avatar — with a fashion colour name (16 named colours cover all 28 letter colours). Each slot has **exact-colour searches** across 8 clothing websites — Temu, Macy's, eBay, Etsy, Amazon, Walmart, ASOS, Google Shopping — searching "&lt;fabric&gt; &lt;garment&gt; &lt;colour&gt;" (Google Shopping also gets the hex, e.g. `ribbed knit top mustard gold #d4a72c`). Plain search links only: no affiliate codes, no scraping, no store images. And a **🧵 custom clothing suppliers** section lists makers who can produce a garment in the exact colour: print-on-demand fabric in the exact hex for a single piece ([Spoonflower](https://www.spoonflower.com/), Little Cocalico, Etsy sewists, MadeApt), made-to-measure tailors (Hockerty, Sumissura), and small-batch **Pantone dye-to-match** services with published MOQs (Banana Moon 50, Create Fashion Brand ≈100–150, Impact Trading 150, Fabriclore 100 m). Code: `COLOUR_NAMES` / `EXACT_STORES` / `exactSearchLinks` / `CUSTOM_MAKERS` in `docs/wardrobe-calendar.js`. Tests: `node tools/test-wardrobe-calendar.js`.
