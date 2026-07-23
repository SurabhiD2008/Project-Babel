/* Babel AI engine (server-side).
   Mirrors the four-layer prompt architecture from the spec:
   phenomenology → semantic match → explanation → Sapir-Whorf.
   Ships with an offline engine so the API always works; if
   ANTHROPIC_API_KEY is set it upgrades to the full Claude model.
   Same JSON contract either way. */

const CATEGORY_NAMES = {
  longing: "Longing & Loss",
  awe: "Awe & Nature",
  social: "Social & Belonging",
  joy: "Joy & Warmth",
  tension: "Discomfort & Tension",
  time: "Time & Memory",
  philos: "Philosophical",
};
const CATEGORIES = Object.keys(CATEGORY_NAMES);

const LEX = {
  longing: ["miss","missing","longing","long","gone","away","far","home","homesick","homesickness","absence","yearn","yearning","pining","pine","nostalg","nostalgia","past","lost","distance","apart","separation","return","memory","ache","heartache","wistful","wistfulness","someone i","used to","exile","estranged","displaced","abroad","fad","emigrat","grief","grieving","mourning","never see","no longer part"],
  awe: ["nature","forest","trees","light","sunlight","mountain","ocean","sea","sky","vast","vastness","wonder","awe","awestruck","sublime","breathtaking","majesty","grandeur","beauty","outdoors","woods","alone in","landscape","stars","starry","wild","wilderness","rain","moon","silence","still","stillness","canyon","cathedral","storm","thunder","hush","snow","tide","dusk","reverent","reverence","sacred","overwhelming scale","amazed","farmland","night sky","scale of","horizon","waterfall","humbling","boundless"],
  social: ["friend","friendship","people","together","togetherness","introduce","name","stranger","awkward","group","company","waiting","guest","hesita","glance","look","between us","host","party","respect","kin","kinship","belong","belonging","community","camaraderie","fellowship","acquaintance","outsider","left out","family","gathering","welcomed","understood","understand","acknowledged","connection","bond","reunion","reunited","apologi","reconcile","forgiveness","introduc"],
  joy: ["happy","happiness","cozy","cosy","warm","warmth","love","falling in love","cute","squeeze","cuddle","comfort","content","contentment","delight","tender","tenderness","glow","snug","joy","joyful","smile","affection","fun","cherish","giddy","giddiness","fluttery","butterflies","proud","gushing","elated","elation","blissful","bliss","overjoyed","gleeful","heartwarming","adoration","radiant","playful","silly happiness","inside joke","reunited","reunion"],
  tension: ["anxious","anxiety","dread","dreading","stress","stressed","uneasy","unease","tension","tense","awkward","embarrass","cring","overwhelm","overwhelmed","panic","restless","fear","nervous","apprehension","discomfort","stuck","frozen","angry","rage","spite","irritat","frustrat","frustration","annoyance","resentment","jittery","simmering","frazzled","exhausted","exhaustion","wound-up","burned out","cornered","trapped","avoid","on edge","pressure","looming","impending","enough of","fed up"],
  time: ["time","memory","again","forgot","forget","past","future","later","waiting","already","piling","books","aging","ageing","old","fading","faded","impermanen","transient","transience","fleeting","ephemeral","moment","dusk","twilight","photo","photograph","decade","holiday","decorations","autumn","season","teenage","childhood","bedroom","song","blankly","reminisce","remembrance","nostalgic","bygone","yesteryear","looking back","staring into space","rushing back","exactly the same","packing away"],
  philos: ["meaning","purpose","life","balance","world","existence","soul","being","why","imperfect","impermanence","order","chaos","reason","alive","perfection","virtue","honour","honor","fate","destiny","matters","pointless","meaningless","actually matters","acceptance","control the outcome","understood only by","existential","mortality","absurdity","consciousness","awareness","transcendence","interconnected","oneness","equanimity","surrender","letting go","serenity","calm","peace","peaceful","tranquil","patience","wisdom","ineffable"],
};

/* Generic filler/function words that carry no emotional signal — excluded from
   the definition-overlap bonus so common words don't create spurious matches.
   NOTE: "never" and "been" are deliberately NOT stopped — in this corpus the
   negation/absence ("a place you've never been") is load-bearing meaning, and
   dropping them made "longing for a place I've never been" miss Kaukokaipuu. */
const STOP = new Set(["feeling","feelings","feel","feels","felt","like","that","this","with","your","just","really","something","someone","somewhere","anything","everything","nothing","always","them","they","when","what","which","were","have","from","into","about","would","could","should","there","their","other","things","thing","some","much","very","more","most","being","because","while","after","before","kind","sort","even","than","then","over","only","also","here","where","those","these","such","without","within","want","wants","make","makes","know","knows"]);

const esc = (s) => String(s);

// Words kept out of browse/showcase surfaces but intentionally DISCOVERABLE via
// Name My Feeling (this module) and search — so the feeling search may return
// them. Mirrors HIDDEN_SLUGS in site/data.js. Composer excludes them separately.
const HIDDEN = new Set(["kalsarikannit", "qarrtsiluni"]);

/* ---------- semantic definition matching (TF-IDF cosine) ----------
   The earlier engine added a flat +3 for every word shared between the input
   and a definition, which let a single common noun (e.g. "place") dominate the
   ranking — so "feeling of wanting to visit a place you've never been" matched
   "Genius loci" (spirit of a place) over "Kaukokaipuu" (longing for a place
   you've never been). This replaces that with TF-IDF cosine similarity over the
   definitions: distinctive words ("visited", "distant", "yearning") weigh far
   more than common ones ("place", "people"), and light stemming lets "visit"
   match "visited". It ranks the word whose *definition* actually paraphrases the
   feeling — applied uniformly to every entry in the database. */
// Scoring weights. Definition-similarity (cosine) is the primary signal; the
// category multiplier keeps emotionally-correct words in front when the input
// carries a clear emotional register. Tunable for benchmarking.
const COS_W = 100;
const CAT_W = +process.env.BABEL_CATW || 8;
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
    const tf = Object.create(null);
    const seen = new Set();
    for (const t of tokenizeStem(w.defShort + " " + w.defFull)) {
      tf[t] = (tf[t] || 0) + 1;
      if (!seen.has(t)) { seen.add(t); df[t] = (df[t] || 0) + 1; }
    }
    return tf;
  });
  const idf = Object.create(null);
  for (const t in df) idf[t] = Math.log((N + 1) / (df[t] + 1)) + 1;
  const vecs = docs.map((tf) => {
    const vec = Object.create(null);
    let norm = 0;
    for (const t in tf) { const v = tf[t] * idf[t]; vec[t] = v; norm += v * v; }
    return { vec, norm: Math.sqrt(norm) || 1 };
  });
  _defIndex = { idf, vecs };
  _defIndexKey = key;
  return _defIndex;
}
// Cosine similarity of the input against every word's definition (aligned to `words`).
function semanticSims(text, words) {
  const index = buildDefIndex(words);
  const qtf = Object.create(null);
  for (const t of tokenizeStem(text)) qtf[t] = (qtf[t] || 0) + 1;
  const qvec = Object.create(null);
  let qnorm = 0;
  for (const t in qtf) { const idf = index.idf[t]; if (!idf) continue; const v = qtf[t] * idf; qvec[t] = v; qnorm += v * v; }
  qnorm = Math.sqrt(qnorm) || 1;
  return index.vecs.map(({ vec, norm }) => {
    let dot = 0;
    for (const t in qvec) { const wv = vec[t]; if (wv) dot += qvec[t] * wv; }
    return dot / (qnorm * norm);
  });
}

function phenomenology(text) {
  const t = " " + text.toLowerCase() + " ";
  const scores = {};
  CATEGORIES.forEach((c) => (scores[c] = 0));
  for (const cat in LEX) {
    // Multi-word phrase cues are the most specific signal, so they weigh most;
    // longer single words next; short words least.
    for (const kw of LEX[cat]) if (t.includes(kw)) scores[cat] += kw.includes(" ") ? 3 : kw.length > 6 ? 2 : 1;
  }
  const intensity = /deep|profound|overwhelm|unbearab|forever|ache|aching|crushing|desperat|intens|consum|drowning|shatter|wholeheart/.test(t)
    ? 82
    : /slight|small|little|gentle|quiet|faint|mild|subtle|soft|barely/.test(t)
    ? 40
    : 60;
  return { scores, intensity, length: text.length };
}

function localFeelingSearch(text, words) {
  const ph = phenomenology(text);
  const sims = semanticSims(text, words);
  const ranked = words
    .map((w, i) => {
      const cos = sims[i];
      // Semantic definition similarity dominates; category resonance, intensity
      // and distance are supporting signals / tie-breakers only.
      let s = cos * COS_W + ph.scores[w.category] * CAT_W;
      s += Math.max(0, 6 - Math.abs((w.intensity || 60) - ph.intensity) / 8);
      s += (w.dist / 100) * 1.5;
      return { w, s, cos };
    })
    .sort((a, b) => b.s - a.s);

  const top = ranked[0];
  const best = top.w;
  // Confidence: strength of the top semantic match plus how far it beats the
  // field — a decisive, on-the-nose match reads high, a vague one reads low.
  const sep = top.s - (ranked[1]?.s || 0);
  const score = Math.min(97, Math.max(52, Math.round(46 + top.cos * 90 + Math.min(12, sep))));
  const alternates = ranked.slice(1, 5).map((r) => ({
    slug: r.w.slug,
    word: r.w.word,
    lang: r.w.language,
    match: Math.min(score - 2, Math.max(28, Math.round(46 + r.cos * 90))),
  }));

  return {
    bestMatch: publicWord(best),
    matchScore: score,
    explanation: writeExplanation(best, text, ph),
    sapirWhorf: writeSapirWhorf(best),
    alternates,
    engine: "offline",
  };
}

/* Three-line explanation: (1) the human emotion read from the input, (2) why
   this word, (3) how it aligns with what the user actually wrote. The frontend
   renders this as HTML, so the user snippet is HTML-escaped here. */
function writeExplanation(w, text, ph) {
  const he = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const words = text.trim().split(/\s+/);
  const snippet = he(words.slice(0, 10).join(" ")) + (words.length > 10 ? "…" : "");
  const emo = (CATEGORY_NAMES[w.category] || w.category).toLowerCase();
  const depth = ph.intensity > 70 ? "and it runs deep — it presses on you, it doesn't just pass through"
              : ph.intensity < 50 ? "held quietly, in a low and private register"
              : "at a steady, lived-in register";
  return (
    `<b>What you're feeling:</b> underneath the words, this reads as <b>${emo}</b> — ${depth}.` +
    `<br><b>Why ${w.word}:</b> ${w.language} folds that exact feeling into a single word — ${w.defShort.toLowerCase()}` +
    `<br><b>How it fits you:</b> your “${snippet}” points at the same ${emo} that ${w.word} names — the thing English needs a whole sentence to reach.`
  );
}
function writeSapirWhorf(w) {
  return `Now that you have the word ${esc(w.word)} — do you think you'll notice this feeling more often, or was it always there, just unnamed?`;
}

function analyseText(text, words) {
  const sentences = text.split(/(?<=[.!?])\s+|\n+/).filter((s) => s.trim().length > 8);
  const found = [];
  const used = new Set();
  sentences.forEach((sent) => {
    const ph = phenomenology(sent);
    // Same TF-IDF cosine engine as Name My Feeling — definition similarity leads,
    // category resonance supports — so the composer matches on precise meaning too.
    const sims = semanticSims(sent, words);
    let best = null;
    words.forEach((w, i) => {
      if (used.has(w.slug) || HIDDEN.has(w.slug)) return;
      const s = sims[i] * COS_W + ph.scores[w.category] * CAT_W;
      if (!best || s > best.s) best = { w, s, cos: sims[i] };
    });
    if (best && (best.cos > 0.06 || best.s > 8)) {
      const w = best.w;
      used.add(w.slug);
      found.push({
        phrase: sent.trim().replace(/\s+/g, " "),
        word: w.word,
        lang: w.language,
        slug: w.slug,
        def: w.defShort,
        why: `This line's ${(CATEGORY_NAMES[w.category] || w.category).toLowerCase()} register — its ${ph.intensity > 70 ? "depth" : "quiet texture"} — maps onto ${esc(w.word)}, which names exactly ${esc(w.defShort.toLowerCase())}`,
      });
    }
  });
  return found.slice(0, 5);
}

function publicWord(w) {
  return {
    slug: w.slug,
    word: w.word,
    language: w.language,
    native: w.native,
    phonetic: w.phonetic,
    family: w.family,
    category: w.category,
    dist: w.dist,
    defShort: w.defShort,
  };
}

/* Optional Claude path — used only when a key is configured. Falls back to
   the offline engine on any error so the endpoint never fails. */
async function claudeFeelingSearch(text, words) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return localFeelingSearch(text, words);
  try {
    const model = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
    const catalog = words.map((w) => ({ slug: w.slug, word: w.word, lang: w.language, cat: w.category, def: w.defShort }));
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model,
        max_tokens: 900,
        system:
          "You are Babel's Name-My-Feeling engine. Given a feeling described in plain language and a JSON list of untranslatable words, extract the phenomenology (sensory texture, emotional register, relational + temporal character), then return STRICT JSON {bestMatchSlug, matchScore, explanation, sapirWhorf, alternates:[{slug,match}]}.",
        messages: [{ role: "user", content: `WORDS=${JSON.stringify(catalog)}\n\nFEELING: ${text}` }],
      }),
    });
    const data = await res.json();
    const parsed = JSON.parse(data.content[0].text.match(/\{[\s\S]*\}/)[0]);
    const bySlug = Object.fromEntries(words.map((w) => [w.slug, w]));
    const best = bySlug[parsed.bestMatchSlug];
    if (!best) return localFeelingSearch(text, words);
    return {
      bestMatch: publicWord(best),
      matchScore: parsed.matchScore,
      explanation: parsed.explanation,
      sapirWhorf: parsed.sapirWhorf,
      alternates: (parsed.alternates || []).map((a) => {
        const w = bySlug[a.slug];
        return { slug: a.slug, word: w?.word, lang: w?.language, match: a.match };
      }),
      engine: "claude:" + model,
    };
  } catch (e) {
    return localFeelingSearch(text, words);
  }
}

module.exports = { phenomenology, localFeelingSearch, claudeFeelingSearch, analyseText, CATEGORY_NAMES, CATEGORIES };
