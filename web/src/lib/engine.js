// Offline matching engine — TF-IDF cosine over word definitions + emotion-category
// resonance. Ported verbatim from the vanilla site / server (server/src/ai.js).
import { WORDS, isHidden, categoryName } from "../data/index.js";

const CATEGORIES = ["longing", "awe", "social", "joy", "tension", "time", "philos"];
const CATEGORY_NAMES = {
  longing: "Longing & Loss", awe: "Awe & Nature", social: "Social & Belonging",
  joy: "Joy & Warmth", tension: "Discomfort & Tension", time: "Time & Memory", philos: "Philosophical",
};

const LEX = {
  longing: ["miss", "missing", "longing", "long", "gone", "away", "far", "home", "homesick", "homesickness", "absence", "yearn", "yearning", "pining", "pine", "nostalg", "nostalgia", "past", "lost", "distance", "apart", "separation", "return", "memory", "ache", "heartache", "wistful", "wistfulness", "someone i", "used to", "exile", "estranged", "displaced", "abroad", "fad", "emigrat", "grief", "grieving", "mourning", "never see", "no longer part"],
  awe: ["nature", "forest", "trees", "light", "sunlight", "mountain", "ocean", "sea", "sky", "vast", "vastness", "wonder", "awe", "awestruck", "sublime", "breathtaking", "majesty", "grandeur", "beauty", "outdoors", "woods", "alone in", "landscape", "stars", "starry", "wild", "wilderness", "rain", "moon", "silence", "still", "stillness", "canyon", "cathedral", "storm", "thunder", "hush", "snow", "tide", "dusk", "reverent", "reverence", "sacred", "overwhelming scale", "amazed", "farmland", "night sky", "scale of", "horizon", "waterfall", "humbling", "boundless"],
  social: ["friend", "friendship", "people", "together", "togetherness", "introduce", "name", "stranger", "awkward", "group", "company", "waiting", "guest", "hesita", "glance", "look", "between us", "host", "party", "respect", "kin", "kinship", "belong", "belonging", "community", "camaraderie", "fellowship", "acquaintance", "outsider", "left out", "family", "gathering", "welcomed", "understood", "understand", "acknowledged", "connection", "bond", "reunion", "reunited", "apologi", "reconcile", "forgiveness", "introduc"],
  joy: ["happy", "happiness", "cozy", "cosy", "warm", "warmth", "love", "falling in love", "cute", "squeeze", "cuddle", "comfort", "content", "contentment", "delight", "tender", "tenderness", "glow", "snug", "joy", "joyful", "smile", "affection", "fun", "cherish", "giddy", "giddiness", "fluttery", "butterflies", "proud", "gushing", "elated", "elation", "blissful", "bliss", "overjoyed", "gleeful", "heartwarming", "adoration", "radiant", "playful", "silly happiness", "inside joke", "reunited", "reunion"],
  tension: ["anxious", "anxiety", "dread", "dreading", "stress", "stressed", "uneasy", "unease", "tension", "tense", "awkward", "embarrass", "cring", "overwhelm", "overwhelmed", "panic", "restless", "fear", "nervous", "apprehension", "discomfort", "stuck", "frozen", "angry", "rage", "spite", "irritat", "frustrat", "frustration", "annoyance", "resentment", "jittery", "simmering", "frazzled", "exhausted", "exhaustion", "wound-up", "burned out", "cornered", "trapped", "avoid", "on edge", "pressure", "looming", "impending", "enough of", "fed up"],
  time: ["time", "memory", "again", "forgot", "forget", "past", "future", "later", "waiting", "already", "piling", "books", "aging", "ageing", "old", "fading", "faded", "impermanen", "transient", "transience", "fleeting", "ephemeral", "moment", "dusk", "twilight", "photo", "photograph", "decade", "holiday", "decorations", "autumn", "season", "teenage", "childhood", "bedroom", "song", "blankly", "reminisce", "remembrance", "nostalgic", "bygone", "yesteryear", "looking back", "staring into space", "rushing back", "exactly the same", "packing away"],
  philos: ["meaning", "purpose", "life", "balance", "world", "existence", "soul", "being", "why", "imperfect", "impermanence", "order", "chaos", "reason", "alive", "perfection", "virtue", "honour", "honor", "fate", "destiny", "matters", "pointless", "meaningless", "actually matters", "acceptance", "control the outcome", "understood only by", "existential", "mortality", "absurdity", "consciousness", "awareness", "transcendence", "interconnected", "oneness", "equanimity", "surrender", "letting go", "serenity", "calm", "peace", "peaceful", "tranquil", "patience", "wisdom", "ineffable"],
};

// NOTE: "never" and "been" are deliberately NOT stopped — in this corpus the
// negation/absence ("a place you've never been") is load-bearing meaning, and
// dropping them made "longing for a place I've never been" miss Kaukokaipuu.
// Keep this list in sync with server/src/ai.js.
const STOP = new Set(["feeling", "feelings", "feel", "feels", "felt", "like", "that", "this", "with", "your", "just", "really", "something", "someone", "somewhere", "anything", "everything", "nothing", "always", "them", "they", "when", "what", "which", "were", "have", "from", "into", "about", "would", "could", "should", "there", "their", "other", "things", "thing", "some", "much", "very", "more", "most", "being", "because", "while", "after", "before", "kind", "sort", "even", "than", "then", "over", "only", "also", "here", "where", "those", "these", "such", "without", "within", "want", "wants", "make", "makes", "know", "knows"]);

const COS_W = 100, CAT_W = 8;

function stem(t) {
  if (t.length < 5) return t;
  for (const suf of ["ings", "ing", "edly", "edness", "ements", "ement", "ments", "ment", "ness", "ions", "tion", "sion", "ies", "ied", "ously", "ous", "ed", "es", "ly", "s"]) {
    if (t.endsWith(suf) && t.length - suf.length >= 3) return t.slice(0, t.length - suf.length);
  }
  return t;
}
function tokenizeStem(s) {
  const out = [];
  for (const t of String(s).toLowerCase().match(/[a-z]{4,}/g) || []) {
    if (STOP.has(t)) continue;
    out.push(stem(t));
  }
  return out;
}
let _defIndex = null, _defIndexKey = "";
function buildDefIndex(words) {
  const key = words.length + ":" + ((words[0] && words[0].slug) || "");
  if (_defIndex && _defIndexKey === key) return _defIndex;
  const N = words.length || 1;
  const df = Object.create(null);
  const docs = words.map((w) => {
    const tf = Object.create(null); const seen = new Set();
    for (const t of tokenizeStem(w.defShort + " " + w.defFull)) {
      tf[t] = (tf[t] || 0) + 1;
      if (!seen.has(t)) { seen.add(t); df[t] = (df[t] || 0) + 1; }
    }
    return tf;
  });
  const idf = Object.create(null);
  for (const t in df) idf[t] = Math.log((N + 1) / (df[t] + 1)) + 1;
  const vecs = docs.map((tf) => {
    const vec = Object.create(null); let norm = 0;
    for (const t in tf) { const v = tf[t] * idf[t]; vec[t] = v; norm += v * v; }
    return { vec, norm: Math.sqrt(norm) || 1 };
  });
  _defIndex = { idf, vecs }; _defIndexKey = key;
  return _defIndex;
}
export function semanticSims(text, words) {
  const index = buildDefIndex(words);
  const qtf = Object.create(null);
  for (const t of tokenizeStem(text)) qtf[t] = (qtf[t] || 0) + 1;
  const qvec = Object.create(null); let qnorm = 0;
  for (const t in qtf) { const idf = index.idf[t]; if (!idf) continue; const v = qtf[t] * idf; qvec[t] = v; qnorm += v * v; }
  qnorm = Math.sqrt(qnorm) || 1;
  return index.vecs.map(({ vec, norm }) => {
    let dot = 0;
    for (const t in qvec) { const wv = vec[t]; if (wv) dot += qvec[t] * wv; }
    return dot / (qnorm * norm);
  });
}

export function phenomenology(text) {
  const t = " " + text.toLowerCase() + " ";
  const scores = {}; CATEGORIES.forEach((c) => (scores[c] = 0));
  for (const cat in LEX) for (const kw of LEX[cat]) if (t.includes(kw)) scores[cat] += kw.includes(" ") ? 3 : kw.length > 6 ? 2 : 1;
  const intensity = /deep|profound|overwhelm|unbearab|forever|ache|aching|crushing|desperat|intens|consum|drowning|shatter|wholeheart/.test(t)
    ? 82 : /slight|small|little|gentle|quiet|faint|mild|subtle|soft|barely/.test(t) ? 40 : 60;
  return { scores, intensity, length: text.length };
}

function writeExplanation(w, text, ph) {
  const he = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const parts = text.trim().split(/\s+/);
  const snippet = he(parts.slice(0, 10).join(" ")) + (parts.length > 10 ? "…" : "");
  const emo = (CATEGORY_NAMES[w.category] || w.category).toLowerCase();
  const depth = ph.intensity > 70 ? "and it runs deep — it presses on you, it doesn't just pass through"
    : ph.intensity < 50 ? "held quietly, in a low and private register" : "at a steady, lived-in register";
  return (
    `<b>What you're feeling:</b> underneath the words, this reads as <b>${emo}</b> — ${depth}.` +
    `<br><b>Why ${w.word}:</b> ${w.language} folds that exact feeling into a single word — ${w.defShort.toLowerCase()}` +
    `<br><b>How it fits you:</b> your "${snippet}" points at the same ${emo} that ${w.word} names — the thing English needs a whole sentence to reach.`
  );
}
export function writeSapirWhorf(w) {
  return `Now that you have the word ${w.word} — do you think you'll notice this feeling more often, or was it always there, just unnamed?`;
}

export function localFeelingSearch(text, words = WORDS) {
  const ph = phenomenology(text);
  const sims = semanticSims(text, words);
  const ranked = words.map((w, i) => {
    const cos = sims[i];
    let s = cos * COS_W + ph.scores[w.category] * CAT_W;
    s += Math.max(0, 6 - Math.abs((w.intensity || 60) - ph.intensity) / 8);
    s += (w.dist / 100) * 1.5;
    return { w, s, cos };
  }).sort((a, b) => b.s - a.s);
  const top = ranked[0];
  const best = top.w;
  const sep = top.s - (ranked[1]?.s || 0);
  const score = Math.min(97, Math.max(52, Math.round(46 + top.cos * 90 + Math.min(12, sep))));
  const alternates = ranked.slice(1, 5).map((r) => ({
    word: r.w.word, lang: r.w.language, slug: r.w.slug,
    match: Math.min(score - 2, Math.max(28, Math.round(46 + r.cos * 90))),
  }));
  return { bestMatch: best, matchScore: score, explanation: writeExplanation(best, text, ph), sapirWhorf: writeSapirWhorf(best), alternates };
}

export function analyseText(text, words = WORDS) {
  const sentences = text.split(/(?<=[.!?])\s+|\n+/).filter((s) => s.trim().length > 8);
  const found = []; const used = new Set();
  sentences.forEach((sent) => {
    const ph = phenomenology(sent);
    const sims = semanticSims(sent, words);
    let best = null;
    words.forEach((w, i) => {
      if (used.has(w.slug) || isHidden(w)) return;
      const s = sims[i] * COS_W + ph.scores[w.category] * CAT_W;
      if (!best || s > best.s) best = { w, s, cos: sims[i] };
    });
    if (best && (best.cos > 0.06 || best.s > 8)) {
      const w = best.w; used.add(w.slug);
      found.push({
        phrase: sent.trim().replace(/\s+/g, " "), word: w.word, lang: w.language, slug: w.slug, def: w.defShort,
        why: `This line's ${categoryName(w.category).toLowerCase()} register — its ${ph.intensity > 70 ? "depth" : "quiet texture"} — maps onto ${w.word}, which names exactly ${w.defShort.toLowerCase()}`,
      });
    }
  });
  return found.slice(0, 5);
}

export function recommend(word, n = 4) {
  const scored = WORDS.filter((w) => w.slug !== word.slug && !isHidden(w)).map((w) => {
    let s = 0;
    if (w.category === word.category) s += 40;
    if (w.family === word.family) s += 12;
    if ((word.related || []).includes(w.slug)) s += 45;
    s += Math.max(0, 30 - Math.abs(w.dist - word.dist));
    s += Math.max(0, 20 - Math.abs((w.intensity || 60) - (word.intensity || 60)) / 2);
    return { w, s };
  });
  return scored.sort((a, b) => b.s - a.s).slice(0, n).map((x) => x.w);
}

export const CogDistance = {
  weights: { semantic: 0.35, cultural: 0.25, structural: 0.2, gap: 0.2 },
  compute(w) {
    const semantic = w.dist;
    const cultural = Math.min(100, (w.cultures || []).length * 14 + (w.script === "Non-Latin" ? 20 : 6) + 30);
    const structural = /compound|verb|reflexive/i.test((w.dims && w.dims.linguistic) || "") ? 82 : 60;
    const best = Math.max(0, ...(w.comparisons || []).map((c) => c.sim), 0);
    const gap = 100 - best;
    const W = this.weights;
    return Math.round(semantic * W.semantic + cultural * W.cultural + structural * W.structural + gap * W.gap);
  },
};
