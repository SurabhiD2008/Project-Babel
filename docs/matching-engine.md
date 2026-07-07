# How the "Name My Feeling" Matching Engine Works

**Name My Feeling** takes a feeling described in plain language — *"the ache of missing a place I've never been"* — and returns the closest untranslatable word, an explanation of *why* it fits, and a set of cross-language alternatives. The **Composer** feature uses the same engine to annotate untranslatable moments inside a longer piece of writing.

By default this runs on an **offline, deterministic engine** — no LLM. It's a from-scratch **TF-IDF cosine-similarity** model over the word definitions. (If an `ANTHROPIC_API_KEY` is configured on the server it transparently upgrades to Claude with the same JSON contract, and the UI discloses which engine answered.)

> **Two copies, kept in sync.** The engine lives in **[`server/src/ai.js`](../server/src/ai.js)** (used by the API) and is mirrored in **[`site/app.js`](../site/app.js)** (the fallback used when the site is opened standalone). They implement the same algorithm and must be changed together.

---

## The four layers

Every query flows through the same four stages:

1. **Phenomenology** — read the emotional register and intensity of the input.
2. **Semantic match** — rank all words by how well their definition matches the input (TF-IDF cosine), nudged by category resonance.
3. **Explanation** — generate a three-line, human explanation of the top match.
4. **Sapir–Whorf** — a closing provocation ("now that you have this word, will you notice the feeling more?").

---

## Layer 2 is the heart: TF-IDF cosine similarity

### The problem it solves
The original engine scored a word by **counting shared keywords** between the input and the definition. That fell into a trap: for *"wanting to visit a place you've never been,"* it matched **Genius loci** (spirit of a *place*) because it over-weighted the common noun **"place."** The correct answer, **Kaukokaipuu** (Finnish: a longing for a place you've never been), scored lower.

**TF-IDF fixes this** by weighting words by *distinctiveness*: common words like "place" or "feeling" count for little; distinctive ones like "distant," "yearning," "homesickness" count for a lot.

### Step 1 — Tokenize + stem
```js
tokenizeStem(text):
  take every /[a-z]{4,}/ token, drop stop-words, then stem each
```
- Only words of **4+ letters** are kept.
- A **stop-word list** (`feeling`, `like`, `that`, `with`, `just`, …) is removed so filler carries no weight.
- **Light stemming** strips common suffixes (`-ing`, `-ed`, `-ly`, `-tion`, `-s`, …) so **"visit" matches "visited."**

### Step 2 — Build the TF-IDF index (once per word set)
For every word's definition (`defShort + defFull`):
```
tf[t]  = count of term t in the definition
df[t]  = number of definitions containing t
idf[t] = ln((N + 1) / (df[t] + 1)) + 1          // N = total words
vec[t] = tf[t] × idf[t]                          // the word's TF-IDF vector
norm   = √(Σ vec[t]²)                             // its length
```
The index is cached and only rebuilt when the word set changes.

### Step 3 — Score the input against every word (cosine)
The input is turned into its own TF-IDF vector, then compared to each word by **cosine similarity**:
```
cosine(query, word) = (query · word) / (‖query‖ × ‖word‖)     // 0 … 1
```
Cosine measures the *angle* between the two vectors, so it's about **which distinctive words overlap**, not raw length. This produces a similarity `cos ∈ [0, 1]` for every word.

---

## Layer 1: phenomenology (the supporting signal)

In parallel, `phenomenology()` reads the input's **emotional register**:

- Seven emotion categories (Longing, Awe, Social, Joy, Tension, Time, Philosophical) each have a keyword lexicon (`LEX`). Each hit adds to that category's score — **multi-word phrases weigh 3, long words 2, short words 1**.
- **Intensity** is read from texture words: `deep/profound/aching/…` → **82**, `slight/quiet/faint/…` → **40**, otherwise **60**.

This gives a per-category resonance and an intensity estimate that *support* (but never override) the cosine match.

---

## Putting it together: the final score

For each word, the two signals combine (`COS_W = 100`, `CAT_W = 8`):

```
s = cos × 100                                  // definition similarity — the lead signal
  + categoryScore[word.category] × 8           // emotional-register resonance
  + max(0, 6 − |word.intensity − inputIntensity| / 8)   // intensity agreement
  + (word.dist / 100) × 1.5                     // slight nudge toward the genuinely untranslatable
```

The word with the highest `s` is the **best match**. The displayed **confidence %** rewards both a strong match and a decisive lead over the runner-up:
```
sep   = topScore − secondScore
match = clamp( round(46 + topCos × 90 + min(12, sep)),  52 … 97 )
```
Each **cross-language alternative** gets its own honesty-preserving score: `min(match − 2, max(28, round(46 + cos × 90)))`.

> Why category resonance is only a *supporting* term: cosine alone occasionally loses emotional context when the input has no strong keywords. The `CAT_W = 8` weight was tuned by sweeping values against the benchmark — 8 keeps the reported bug fixed *and* maximises accuracy.

---

## The Composer (`analyseText`)

The Composer splits your writing into sentences and runs the **same cosine + category scoring** on each, picking the single best untranslatable word per sentence (no repeats). A sentence only gets annotated if the match clears a floor (`cos > 0.06` or a strong combined score), and it returns at most five moments. Hidden/curatorially-excluded words are skipped here.

---

## Layer 3: the explanation

`writeExplanation()` returns a **three-line** block (rendered as HTML):

1. **What you're feeling** — the interpreted emotion + intensity register.
2. **Why *this* word** — how the word's language folds that feeling into one word.
3. **How it fits you** — ties the word back to a snippet of what you actually wrote.

The user's snippet is HTML-escaped. This is generated, not hand-written per query.

---

## Optional upgrade: Claude

If `ANTHROPIC_API_KEY` is set, `claudeFeelingSearch()` sends the input + a compact word catalogue to `claude-opus-4-8` and asks for the **same strict JSON** (`{bestMatchSlug, matchScore, explanation, sapirWhorf, alternates}`). On any error it falls back to the offline engine, so the endpoint never fails. The offline engine is the default, and the result labels its own source.

---

## Measured accuracy

`server/scripts/benchmark.js` runs **50 independently-written feeling descriptions** (7 per category, none copied from a word's own definition) against the live endpoint. Latest result: **90% category-match, ~53 ms average**, fully offline. Re-run it (after clearing cached feeling results) whenever the engine or lexicon changes.

---

## Source

- Engine: [`server/src/ai.js`](../server/src/ai.js) — `tokenizeStem`, `buildDefIndex`, `semanticSims`, `phenomenology`, `localFeelingSearch`, `analyseText`, `writeExplanation`, `claudeFeelingSearch`.
- Frontend mirror + fallback: [`site/app.js`](../site/app.js).
- Benchmark: [`server/scripts/benchmark.js`](../server/scripts/benchmark.js) → `server/results/metrics.json`.
- Related: [How cognitive distance is calculated](cognitive-distance.md).
