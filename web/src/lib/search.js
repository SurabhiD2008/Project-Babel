// Atlas search — relevance-ranked, accent-insensitive, typo-tolerant, and able
// to answer a plain description ("homesick for somewhere I've never been") by
// falling through to the same meaning engine Name My Feeling uses.
import { categoryName } from "../data/index.js";
import { meaningSearch } from "./engine.js";

const fold = (s) =>
  String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

// One folded record per word, cached on the word object's identity.
const cache = new WeakMap();
function record(w) {
  let r = cache.get(w);
  if (!r) {
    r = {
      name: fold(w.word),
      native: String(w.native || "").toLowerCase(),
      language: fold(w.language),
      family: fold(w.family),
      category: fold(categoryName(w.category)),
      short: fold(w.defShort),
      full: fold(w.defFull),
    };
    cache.set(w, r);
  }
  return r;
}

// Edit distance with an early exit once it exceeds `max`.
function within(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      if (v < best) best = v;
    }
    if (best > max) return false;
    prev = cur;
  }
  return prev[b.length] <= max;
}

const startsWord = (hay, needle) => hay.startsWith(needle) || hay.includes(" " + needle);

function literalScore(r, q, toks, rawQ) {
  // The word itself.
  if (r.name === q) return 100;
  if (rawQ && r.native && r.native === rawQ) return 100;
  if (r.name.startsWith(q)) return 90 - Math.min(10, r.name.length - q.length);
  if (startsWord(r.name, q)) return 76;
  if (r.name.includes(q) && q.length >= 3) return 68;
  if (rawQ && r.native && r.native.includes(rawQ)) return 66;
  // A near-miss spelling of the word ("hyge", "shadenfreude").
  if (q.length >= 4 && !q.includes(" ")) {
    const max = q.length >= 8 ? 2 : 1;
    if (within(q, r.name, max)) return 60;
    if (r.name.length > q.length && within(q, r.name.slice(0, q.length), max === 2 ? 1 : 1) && q.length >= 5) return 52;
  }
  // Language, family, emotion type.
  if (r.language === q) return 58;
  if (r.language.startsWith(q) && q.length >= 3) return 54;
  if (r.family === q || r.category === q) return 46;
  if (q.length >= 3 && (startsWord(r.family, q) || startsWord(r.category, q))) return 40;
  // Every typed word appears somewhere in the entry.
  let s = 0;
  for (const t of toks) {
    if (startsWord(r.short, t)) s += 3;
    else if (startsWord(r.name, t) || startsWord(r.language, t) || startsWord(r.category, t)) s += 2.5;
    else if (startsWord(r.full, t)) s += 1.5;
    else if (t.length >= 4 && (r.short.includes(t) || r.full.includes(t))) s += 1;
    else return 0;
  }
  return Math.min(38, 14 + (s / toks.length) * 8);
}

/* Returns the matching words, most relevant first. */
export function searchWords(query, words) {
  const q = fold(query);
  const rawQ = String(query || "").trim().toLowerCase();
  if (!q && !rawQ) return words.slice();
  const toks = q.split(" ").filter(Boolean);
  const scored = [];
  const seen = new Set();
  for (const w of words) {
    const s = literalScore(record(w), q, toks, rawQ);
    if (s > 0) { scored.push({ w, s }); seen.add(w.slug); }
  }
  scored.sort((a, b) => b.s - a.s || b.w.dist - a.w.dist);
  const out = scored.map((x) => x.w);
  // A description rather than a lookup: add words whose meaning answers it.
  const strongest = scored.length ? scored[0].s : 0;
  if (q.length >= 4 && strongest < 60) {
    for (const w of meaningSearch(query, words).slice(0, 24)) if (!seen.has(w.slug)) { out.push(w); seen.add(w.slug); }
  }
  return out;
}
