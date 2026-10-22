/* 📚 Books کتابیں — number pairing between surah:ayah and book units. Pure; browser (window.QBooks) + node.
   Rule (same as Geronimo): unit = ((S-1) mod N)+1; sub-unit = ((A-1) mod subs)+1 where the work has one
   (Shakespeare → scene shown as Act.Scene, Sonnets → line, Art of War → verse).
   Geronimo is delegated unchanged to QApprove.geronimo (holiday books → no pairing, ghost books → 👻 kirinomori).
   Data for the other works comes from docs/books-data.js (generated from /workspace/geronimo-map/books/). */
(function (root) {
  const isNode = typeof module !== "undefined";
  const A = isNode ? require("./approve.js") : root.QApprove;
  const G = isNode ? require("./geronimo-books.js") : root.GERONIMO_BOOKS;
  const D = isNode ? require("./books-data.js") : root.BOOK_WORKS;
  const mod = (x, n) => ((x % n) + n) % n;
  const GERONIMO = { id: "geronimo", en: "Geronimo Stilton", ur: "جیرونیمو", icon: "📚", unitName: "book", subName: "chapter", N: G.length };
  const WORKS = [GERONIMO].concat(D.works);
  const byId = Object.fromEntries(WORKS.map((w) => [w.id, w]));
  function actScene(spa, k) { for (let a = 0; a < spa.length; a++) { if (k <= spa[a]) return `Act ${a + 1}, Scene ${k}`; k -= spa[a]; } return null; }
  function pair(workId, S, A_) {
    const w = byId[workId] || GERONIMO;
    if (w.id === "geronimo") return Object.assign({ work: "geronimo", unit: A.geronimo(G, S, A_).book }, A.geronimo(G, S, A_));
    const u = w.units[mod(S - 1, w.units.length)];
    const out = { work: w.id, unit: u.n, N: w.units.length, label: u.label || null, title: u.title, en: u.en || null, ar: u.ar || null, ja: u.ja || null,
      summary: u.summary || null, sub: null, subs: null, subName: w.subName || null, subLabel: null, line: null, lineSource: null };
    if (u.subs && A_) {
      out.sub = mod(A_ - 1, u.subs) + 1; out.subs = u.subs;
      out.subLabel = u.spa ? actScene(u.spa, out.sub) : `${w.subName} ${out.sub}/${u.subs}`;
    }
    if (u.lines && out.sub) out.line = u.lines[out.sub - 1];
    else if (u.line) out.line = u.line;
    if (out.line) out.lineSource = w.lineSource || null;
    return out;
  }
  const api = { WORKS, byId, pair, actScene };
  if (isNode) module.exports = api; else root.QBooks = api;
})(typeof window !== "undefined" ? window : globalThis);
