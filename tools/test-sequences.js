// node tools/test-sequences.js — mod-6236 mapping + sequence generators
const fs = require("fs");
eval(fs.readFileSync(__dirname + "/../docs/surah-data.js", "utf8").replace("const SURAHS", "globalThis.SURAHS"));
const Q = require(__dirname + "/../docs/sequences.js");
let pass = 0; const fail = [];
const eq = (name, got, exp) => { if (String(got) === String(exp)) pass++; else fail.push([name, String(got), String(exp)]); };
const ref = (g) => { const r = Q.toRef(g, SURAHS); return r.surah + ":" + r.ayah; };
// mapping
eq("sum ayahs", SURAHS.reduce((s, x) => s + x.ayahs, 0), 6236);
eq("1", Q.wrap(1), 1); eq("6236", Q.wrap(6236), 6236); eq("6236 ref", ref(Q.wrap(6236)), "114:6");
eq("6237", Q.wrap(6237), 1); eq("0", Q.wrap(0), 6236); eq("-1", Q.wrap(-1), 6235); eq("-6236", Q.wrap(-6236), 6236);
eq("10000", Q.wrap(10000), 3764); eq("10000 ref", ref(3764), "36:59");
eq("12472", Q.wrap(12472), 6236); eq("1 ref", ref(1), "1:1"); eq("8 ref", ref(8), "2:1"); eq("262 ref", ref(262), "2:255");
eq("huge", Q.wrap("1" + "0".repeat(100)), Number((10n ** 100n - 1n) % 6236n + 1n));
eq("huge neg", Q.wrap(-(10n ** 50n)), Number(((-(10n ** 50n) - 1n) % 6236n + 6236n) % 6236n + 1n));
eq("arabic digits", Q.wrap("١٠٠٠٠"), 3764); eq("commas", Q.wrap("10,000"), 3764); eq("bad", Q.wrap("abc"), null); eq("bad2", Q.wrap("1.5"), null);
// generators (first terms, from OEIS)
const first = (id, n, seed) => Array.from({ length: n }, (_, i) => String(Q.term(id, i + 1, seed))).join(",");
const E = {
  natural: "1,2,3,4,5,6,7,8,9,10", fib: "1,1,2,3,5,8,13,21,34,55", lucas: "2,1,3,4,7,11,18,29,47,76", primes: "2,3,5,7,11,13,17,19,23,29",
  squares: "1,4,9,16,25,36,49,64,81,100", cubes: "1,8,27,64,125,216,343,512,729,1000", cbrt: "1000,1259,1442,1587,1709,1817,1912,2000,2080,2154",
  tri: "1,3,6,10,15,21,28,36,45,55", pent: "1,5,12,22,35,51,70,92,117,145", hex: "1,6,15,28,45,66,91,120,153,190",
  tetra: "1,4,10,20,35,56,84,120,165,220", catalan: "1,1,2,5,14,42,132,429,1430,4862", pow2: "1,2,4,8,16,32,64,128,256,512",
  fact: "1,2,6,24,120,720,5040,40320,362880,3628800", pi: "3,31,314,3141,31415,314159,3141592,31415926,314159265,3141592653",
  phi: "1,16,161,1618,16180,161803,1618033,16180339,161803398,1618033988", e: "2,27,271,2718,27182,271828,2718281,27182818,271828182,2718281828",
  golden: "137,275,412,550,687,825,962,1100,1237,1375", padovan: "1,1,1,2,2,3,4,5,7,9", perfect: "6,28,496,8128,33550336",
};
for (const id in E) eq(id, first(id, E[id].split(",").length), E[id]);
eq("collatz 27", first("collatz", 8, 27n), "27,82,41,124,62,31,94,47");
eq("collatz 6", first("collatz", 12, 6n), "6,3,10,5,16,8,4,2,1,4,2,1");
eq("pi 100 digits", Q.digits("pi", 100).slice(0, 100), "3141592653589793238462643383279502884197169399375105820974944592307816406286208998628034825342117067");
eq("e 50", Q.digits("e", 50).slice(0, 50), "27182818284590452353602874713526624977572470936999");
eq("phi 50", Q.digits("phi", 50).slice(0, 50), "16180339887498948482045868343656381177203091798057");
eq("fact 30", Q.term("fact", 30), "265252859812191058636308480000000");
eq("fib 100", Q.term("fib", 100), "354224848179261915075");
eq("prime 1000", Q.term("primes", 1000), 7919);
eq("perfect 8", Q.term("perfect", 8), "2305843008139952128");
eq("every seq maps", Q.SEQ.every((s) => { const g = Q.wrap(Q.term(s.id, 25, 27n)); return g >= 1 && g <= 6236; }), true);
console.log(`${pass}/${pass + fail.length} passed`); if (fail.length) { console.log(fail); process.exit(1); }
