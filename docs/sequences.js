/* Any integer → ayah (mod 6236) + math sequences for "Next ayah".
   Pure + BigInt-safe; works in the browser (window.QSeq) and node (module.exports). */
(function (root) {
  const TOTAL = 6236n;
  /* 1..6236 stays as-is, 6236 → #6236 (114:6), 0 → #6236, -1 → #6235, 6237 → #1 */
  function wrap(n) {
    let b;
    if (typeof n === "bigint") b = n;
    else { const s = String(n).trim().replace(/[٠-٩]/g, (c) => "٠١٢٣٤٥٦٧٨٩".indexOf(c)).replace(/[,_\s]/g, "");
      if (!/^[-+]?\d+$/.test(s)) return null; b = BigInt(s); }
    return Number((((b - 1n) % TOTAL) + TOTAL) % TOTAL + 1n);
  }
  function toRef(g, S) { for (const s of S) { if (g <= s.ayahs) return { surah: s.n, ayah: g }; g -= s.ayahs; } return null; }

  /* ---- digit strings of π, φ, e via BigInt fixed-point ---- */
  const DIG = {};
  function arctanInv(x, one) { let sum = 0n, term = one / x, k = 1n, sign = 1n; const x2 = x * x;
    while (term !== 0n) { sum += sign * (term / k); term /= x2; k += 2n; sign = -sign; } return sum; }
  function digits(name, n) {
    if (DIG[name] && DIG[name].length >= n) return DIG[name];
    const N = Math.max(n, 400) + 20, one = 10n ** BigInt(N);
    let v;
    if (name === "pi") v = 4n * (4n * arctanInv(5n, one) - arctanInv(239n, one));     // Machin
    else if (name === "e") { v = 0n; let t = one, k = 1n; while (t) { v += t; t /= k; k++; } }
    else { const r = isqrt(5n * one * one); v = (one + r) / 2n; }                  // φ = (1+√5)/2
    return (DIG[name] = v.toString().slice(0, N - 10));
  }
  function isqrt(n) { if (n < 2n) return n; let x = 1n << BigInt(Math.ceil(n.toString(2).length / 2));   // Newton from above
    while (true) { const y = (x + n / x) >> 1n; if (y >= x) return x; x = y; } }
  function icbrt(n) { let x = BigInt(Math.round(Math.cbrt(Number(n)))); while (x * x * x > n) x--; while ((x + 1n) ** 3n <= n) x++; return x; }

  /* ---- generators: term(k) for k = 1, 2, 3 … (all BigInt) ---- */
  function memo(next, init) { const a = init.slice(); return (k) => { while (a.length < k) a.push(next(a)); return a[k - 1]; }; }
  const primes = memo((a) => { let c = a[a.length - 1] + (a.length > 1 ? 2n : 1n);
    for (;; c += 2n) { let p = true; for (const q of a) { if (q * q > c) break; if (c % q === 0n) { p = false; break; } } if (p) return c; } }, [2n]);
  const fact = memo((a) => a[a.length - 1] * BigInt(a.length + 1), [1n]);
  const MERSENNE = [2,3,5,7,13,17,19,31,61,89,107,127,521,607,1279,2203,2281,3217,4253,4423];
  const collatzCache = {};
  const SEQ = [
    { id: "natural", en: "Natural numbers", ur: "قدرتی اعداد", f: (k) => BigInt(k), note: "1, 2, 3, 4…" },
    { id: "fib", en: "Fibonacci", ur: "فبوناچی", f: memo((a) => a[a.length - 1] + a[a.length - 2], [1n, 1n]), note: "1, 1, 2, 3, 5, 8…" },
    { id: "lucas", en: "Lucas", ur: "لوکس", f: memo((a) => a[a.length - 1] + a[a.length - 2], [2n, 1n]), note: "2, 1, 3, 4, 7, 11…" },
    { id: "primes", en: "Primes", ur: "مفرد اعداد", f: primes, note: "2, 3, 5, 7, 11…" },
    { id: "squares", en: "Squares", ur: "مربع", f: (k) => BigInt(k) ** 2n, note: "1, 4, 9, 16…" },
    { id: "cubes", en: "Cubes", ur: "مکعب", f: (k) => BigInt(k) ** 3n, note: "1, 8, 27, 64…" },
    { id: "cbrt", en: "Cube roots (∛n × 1000, floored)", ur: "جذرِ مکعب", f: (k) => icbrt(BigInt(k) * 10n ** 9n), note: "1000, 1259, 1442, 1587… (∛n to 3 decimals)" },
    { id: "tri", en: "Triangular", ur: "مثلثی اعداد", f: (k) => BigInt(k) * BigInt(k + 1) / 2n, note: "1, 3, 6, 10…" },
    { id: "pent", en: "Pentagonal", ur: "مخمسی اعداد", f: (k) => BigInt(k) * (3n * BigInt(k) - 1n) / 2n, note: "1, 5, 12, 22…" },
    { id: "hex", en: "Hexagonal", ur: "مسدسی اعداد", f: (k) => BigInt(k) * (2n * BigInt(k) - 1n), note: "1, 6, 15, 28…" },
    { id: "tetra", en: "Tetrahedral", ur: "چہار سطحی اعداد", f: (k) => BigInt(k) * BigInt(k + 1) * BigInt(k + 2) / 6n, note: "1, 4, 10, 20…" },
    { id: "catalan", en: "Catalan", ur: "کاتالان", f: memo((a) => { const n = BigInt(a.length); return a[a.length - 1] * 2n * (2n * n - 1n) / (n + 1n); }, [1n]), note: "1, 1, 2, 5, 14, 42…" },
    { id: "pow2", en: "Powers of 2", ur: "دو کی طاقتیں", f: (k) => 2n ** BigInt(k - 1), note: "1, 2, 4, 8, 16…" },
    { id: "fact", en: "Factorials", ur: "فیکٹوریل", f: fact, note: "1, 2, 6, 24, 120…" },
    { id: "pi", en: "π digits (running number)", ur: "پائی کے ہندسے", f: (k) => BigInt(digits("pi", k).slice(0, k)), note: "3, 31, 314, 3141…" },
    { id: "phi", en: "φ golden ratio digits (running)", ur: "سنہری تناسب کے ہندسے", f: (k) => BigInt(digits("phi", k).slice(0, k)), note: "1, 16, 161, 1618…" },
    { id: "e", en: "e digits (running number)", ur: "ای کے ہندسے", f: (k) => BigInt(digits("e", k).slice(0, k)), note: "2, 27, 271, 2718…" },
    { id: "golden", en: "Golden angle / phyllotaxis ⌊n·137.508⌋", ur: "سنہری زاویہ (پتوں کی ترتیب)", f: (k) => BigInt(k) * 137508n / 1000n, note: "137, 275, 412, 550…" },
    { id: "padovan", en: "Padovan (shell spirals)", ur: "پاڈووان (سیپی کے چکر)", f: memo((a) => a[a.length - 2] + a[a.length - 3], [1n, 1n, 1n]), note: "1, 1, 1, 2, 2, 3, 4, 5, 7…" },
    { id: "perfect", en: "Perfect numbers", ur: "کامل اعداد", f: (k) => { const p = BigInt(MERSENNE[(k - 1) % MERSENNE.length]); return 2n ** (p - 1n) * (2n ** p - 1n); }, note: "6, 28, 496, 8128… (" + MERSENNE.length + " known here, then repeats)" },
    { id: "collatz", en: "Collatz from seed", ur: "کولاٹز (بیج سے)", seed: true, f: (k, seed) => {
        const key = String(seed || 27n); const a = collatzCache[key] || (collatzCache[key] = [BigInt(seed || 27n)]);
        while (a.length < k) { const x = a[a.length - 1]; a.push(x === 1n ? 4n : x % 2n ? 3n * x + 1n : x / 2n); } return a[k - 1]; }, note: "seed, n/2 or 3n+1 … then 4, 2, 1 loop" }
  ];
  const byId = Object.fromEntries(SEQ.map((s) => [s.id, s]));
  function term(id, k, seed) { const s = byId[id]; return s.f(Math.max(1, k), seed != null ? BigInt(seed) : undefined); }
  const api = { wrap, toRef, SEQ, byId, term, digits, icbrt };
  if (typeof module !== "undefined") module.exports = api; else root.QSeq = api;
})(typeof window !== "undefined" ? window : globalThis);
