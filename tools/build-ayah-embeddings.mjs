// Build docs/ayah-finder/{pickthall.json, emb-minilm-int8.bin} for the 🔎 Ayah Finder.
// Run from a folder with @huggingface/transformers@3.8.1 installed:
//   (copy this file there, then) node build-ayah-embeddings.mjs /path/to/quran-recorder/docs/ayah-finder
// English: Pickthall (1930, public domain) from api.alquran.cloud edition en.pickthall (Tanzil text).
// Single-threaded on purpose: multi-threaded onnxruntime-node gave non-deterministic q8 outputs on our box,
// and the browser (WASM, one thread) must produce the same vectors for the query.
import { pipeline } from "@huggingface/transformers";
import fs from "fs";
const out = process.argv[2] || "docs/ayah-finder";
const api = await (await fetch("https://api.alquran.cloud/v1/quran/en.pickthall")).json();
const PK = api.data.surahs.flatMap((s) => s.ayahs.map((a) => [s.number, a.numberInSurah, a.text.trim()]));
if (PK.length !== 6236) throw new Error("expected 6236 ayat, got " + PK.length);
const ex = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { dtype: "q8", session_options: { intraOpNumThreads: 1, interOpNumThreads: 1 } });
const N = PK.length, D = 384, Q = new Int8Array(N * D), S = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const v = (await ex(PK[i][2], { pooling: "mean", normalize: true })).data; // one at a time: no padding effects
  let m = 0; for (let k = 0; k < D; k++) m = Math.max(m, Math.abs(v[k]));
  S[i] = m / 127; for (let k = 0; k < D; k++) Q[i * D + k] = Math.round(v[k] / S[i]);
  if (i % 1000 === 0) console.log(i);
}
const counts = []; for (const [s] of PK) counts[s - 1] = (counts[s - 1] || 0) + 1;
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(out + "/emb-minilm-int8.bin", Buffer.concat([Buffer.from(Q.buffer), Buffer.from(S.buffer)]));
fs.writeFileSync(out + "/pickthall.json", JSON.stringify({ source: "M. M. Pickthall, The Meaning of the Glorious Koran (1930), public domain; text via Tanzil / api.alquran.cloud en.pickthall", model: "Xenova/all-MiniLM-L6-v2 q8, mean pooling, normalized; int8 + float32 scale per ayah", counts, en: PK.map((x) => x[2]) }));
console.log("done", N);
