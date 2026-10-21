// node tools/test-spend.js — 🤲 Spending in Allah's cause daily ayah rotation
const S = require(__dirname + "/../docs/spend.js");
const QT = require(__dirname + "/../docs/quran-text.js");
let pass = 0; const fail = [];
const eq = (n, g, e) => { if (String(g) === String(e)) pass++; else fail.push([n, String(g), String(e)]); };
eq("12 items", S.ITEMS.length, 12);
eq("refs", S.ITEMS.map(S.ref).join(","), "2:261,2:245,2:274,9:60,9:103,57:7,57:11,57:18,61:10–11,63:10,64:16,3:92");
for (const it of S.ITEMS) { eq("arabic " + S.ref(it), S.arabic(it, QT).length > 20, true); eq("en " + S.ref(it), it.en.length > 20, true); }
eq("pair has 2 ayah marks", (S.arabic(S.ITEMS[8], QT).match(/﴿/g) || []).length, 2);
eq("same day stable", S.ref(S.forDate(new Date(2026, 9, 21, 0, 1))), S.ref(S.forDate(new Date(2026, 9, 21, 23, 59))));
const seen = new Set(); for (let i = 0; i < 12; i++) seen.add(S.ref(S.forDate(new Date(2026, 9, 21 + i, 12))));
eq("12 days cover all 12", seen.size, 12);
eq("cycle repeats", S.ref(S.forDate(new Date(2026, 9, 21))), S.ref(S.forDate(new Date(2026, 10, 2))));
eq("digits", S.toArabicDigits(261), "٢٦١");
if (fail.length) { console.log(fail); process.exit(1); }
console.log("spend: " + pass + " passed");
