/* ✅ Approve / 📚 Geronimo / 2️⃣ two-ayah review logic. Pure; browser (window.QApprove) + node (module.exports).
   A "cursor" is the sequence term index k of the next candidate. Yes logs and advances, No skips (no log) and advances. */
(function (root) {
  /* candidate for term k of sequence state st = { id, off, seed } */
  function candidate(Q, S, st, k) {
    k = Math.max(1, Math.floor(k) || 1);
    const t = Q.term(st.id, k, st.id === "collatz" ? BigInt(st.seed || 27) : undefined);
    const g = Q.wrap(t + BigInt(st.off || 0));
    const r = Q.toRef(g, S);
    return { k, term: String(t), global: g, surah: r.surah, ayah: r.ayah };
  }
  /* the candidates offered at cursor k: one, or two consecutive terms (k, k+1) in pair mode */
  function step(Q, S, st, k, pair) {
    const out = [candidate(Q, S, st, k)];
    if (pair) out.push(candidate(Q, S, st, out[0].k + 1));
    return out;
  }
  /* cursor after a Yes or a No — both advance past everything that was shown */
  function advance(k, pair) { return Math.max(1, Math.floor(k) || 1) + (pair ? 2 : 1); }
  function back(k, pair) { return Math.max(1, (Math.floor(k) || 1) - (pair ? 2 : 1)); }
  /* surah S → book ((S-1) mod N)+1; ayah A → chapter ((A-1) mod chapters)+1 when the chapter count is known */
  function geronimo(books, surah, ayah) {
    const N = books.length;
    const b = books[(((surah - 1) % N) + N) % N];
    const c = b.chapter_count ? (((ayah - 1) % b.chapter_count) + b.chapter_count) % b.chapter_count + 1 : null;
    return { book: b.book_number, title: b.title, summary: b.summary, chapter: c, chapters: b.chapter_count || null };
  }
  /* a Daily Log entry identical in shape to the ⏱ stamp, plus optional note fields */
  function logEntry(c, extra) {
    return Object.assign({ type: "ayah-stamp", surah: c.surah, ayah: c.ayah, global: c.global }, extra || {});
  }
  const api = { candidate, step, advance, back, geronimo, logEntry };
  if (typeof module !== "undefined") module.exports = api; else root.QApprove = api;
})(typeof window !== "undefined" ? window : globalThis);
