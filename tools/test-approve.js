// node tools/test-approve.js — ✅ Approve / 📚 Geronimo / 2️⃣ two-ayah logic
const fs = require("fs");
eval(fs.readFileSync(__dirname + "/../docs/surah-data.js", "utf8").replace("const SURAHS", "globalThis.SURAHS"));
const Q = require(__dirname + "/../docs/sequences.js");
const A = require(__dirname + "/../docs/approve.js");
const B = require(__dirname + "/../docs/geronimo-books.js");
let pass = 0; const fail = [];
const eq = (name, got, exp) => { if (String(got) === String(exp)) pass++; else fail.push([name, String(got), String(exp)]); };
const r = (c) => c.surah + ":" + c.ayah;
const fib = { id: "fib", off: 0, seed: "27" };
// candidates follow the sequence: fib 1,1,2,3,5,8,13 → global verse → ref
eq("fib k1", r(A.candidate(Q, SURAHS, fib, 1)), "1:1");
eq("fib k4", r(A.candidate(Q, SURAHS, fib, 4)), "1:3");
eq("fib k7 (13)", r(A.candidate(Q, SURAHS, fib, 7)), "2:6");
eq("cand matches Seq wrap", A.candidate(Q, SURAHS, fib, 30).global, Q.wrap(Q.term("fib", 30)));
eq("offset", A.candidate(Q, SURAHS, { id: "natural", off: 9999 }, 1).global, 3764);
eq("offset ref 36:59", r(A.candidate(Q, SURAHS, { id: "natural", off: 9999 }, 1)), "36:59");
eq("neg offset wraps", A.candidate(Q, SURAHS, { id: "natural", off: -1 }, 1).global, 6236);
eq("collatz seed", A.candidate(Q, SURAHS, { id: "collatz", seed: "6" }, 3).term, "10");
eq("k<1 clamps", A.candidate(Q, SURAHS, fib, 0).k, 1);
// single vs pair step + cursor movement (Yes and No both advance past what was shown)
eq("single step", A.step(Q, SURAHS, fib, 5, false).map((c) => c.k).join(","), "5");
eq("pair step", A.step(Q, SURAHS, fib, 5, true).map((c) => c.k).join(","), "5,6");
eq("pair refs", A.step(Q, SURAHS, { id: "natural", off: 0 }, 7, true).map(r).join(" "), "1:7 2:1");
eq("advance 1", A.advance(5, false), 6); eq("advance 2", A.advance(5, true), 7);
eq("back 1", A.back(5, false), 4); eq("back 2", A.back(5, true), 3); eq("back floor", A.back(1, true), 1);
// simulate a session: Y N Y on natural from k=1 → logged 1:1 and 1:3, cursor 4
let k = 1; const logged = [];
for (const yes of [true, false, true]) { const cs = A.step(Q, SURAHS, { id: "natural" }, k, false); if (yes) cs.forEach((c) => logged.push(r(c))); k = A.advance(k, false); }
eq("session logged", logged.join(" "), "1:1 1:3"); eq("session cursor", k, 4);
k = 1; logged.length = 0;
for (const yes of [false, true]) { const cs = A.step(Q, SURAHS, { id: "natural" }, k, true); if (yes) cs.forEach((c) => logged.push(r(c))); k = A.advance(k, true); }
eq("pair session", logged.join(" "), "1:3 1:4"); eq("pair cursor", k, 5);
// log entry shape = ⏱ stamp
const e = A.logEntry(A.candidate(Q, SURAHS, fib, 7), { id: "x", ts: "t" });
eq("entry", JSON.stringify([e.type, e.surah, e.ayah, e.global, e.id, e.ts]), JSON.stringify(["ayah-stamp", 2, 6, 13, "x", "t"]));
// Geronimo data + pairing
eq("86 books", B.length, 86);
eq("numbered 1..86", B.every((b, i) => b.book_number === i + 1), true);
eq("only 4 fields", B.every((b) => Object.keys(b).sort().join() === "book_number,chapter_count,summary,title"), true);
eq("all summaries", B.every((b) => b.summary && b.summary.length < 300), true);
eq("S1 → #1", A.geronimo(B, 1, 1).book, 1);
eq("S86 → #86", A.geronimo(B, 86, 1).book, 86);
eq("S87 → #1", A.geronimo(B, 87, 1).book, 1);
eq("S114 → #28", A.geronimo(B, 114, 1).book, 28);
eq("S36 → #36", A.geronimo(B, 36, 59).title, B[35].title);
eq("unknown chapters → null", A.geronimo(B, 1, 5).chapter, null);
eq("S20 A1 → ch1", A.geronimo(B, 20, 1).chapter, 1);
eq("S20 A27 → ch27", A.geronimo(B, 20, 27).chapter, 27);
eq("S20 A28 → ch1", A.geronimo(B, 20, 28).chapter, 1);
eq("S54 A55 → ch13", A.geronimo(B, 54, 55).chapter, 13);
eq("S50 A40 → ch20", A.geronimo(B, 50, 40).chapter, 20);
console.log(`${pass}/${pass + fail.length} passed`); if (fail.length) { console.log(fail); process.exit(1); }
