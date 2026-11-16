# How the "Name My Feeling" Matching Engine Works

**Name My Feeling** takes a feeling described in plain language — *"the ache of missing a place I've never been"* — and returns the closest untranslatable word, an explanation of *why* it fits, and a set of cross-language alternatives. The **Composer** uses the same engine to annotate untranslatable moments inside a longer piece of writing, and the **Atlas search** falls through to it when you type a description rather than a word.

By default this runs on an **offline, deterministic engine** — no LLM. It is a small lexical retrieval model: **field-weighted BM25 over the word definitions, with a hand-built concept thesaurus for query expansion**, nudged by an emotion-category read of the input. (If an `ANTHROPIC_API_KEY` is configured on the server it transparently upgrades to Claude with the same JSON contract, and the UI discloses which engine answered.)

> **Kept in sync by hand.** The engine lives in two places: **[`server/src/ai.js`](../server/src/ai.js)** (used by the API) and **[`web/src/lib/engine.js`](../web/src/lib/engine.js)** (the React app's in-browser fallback). The block between the `ENGINE CORE` markers is **byte-identical** in both — change one, paste it into the other. The legacy vanilla site ([`site/app.js`](../site/app.js), not deployed) still carries the earlier TF-IDF cosine version.

---

## Why it was rebuilt

The previous engine ranked words by TF-IDF cosine similarity between the input and each definition. That only works when the user happens to type the same words the definition uses. People don't: they write *"outsider at a party"*, and the definition of **Aduantas** says *"the uneasy strangeness of being somewhere unfamiliar, among strangers."* No shared word, no match — the live site answered that query with **Mālama** ("to care for, tend, and protect").

Three changes fix this:

1. **A concept thesaurus** bridges the user's vocabulary and the definitions' vocabulary (`outsider → stranger, unfamiliar`; `comeback → retort, reply`; `fed up → enough`).
2. **Field weighting** — a hit in a word's one-line definition counts for much more than one buried in the long definition.
3. **BM25 with idea-level scoring** — each typed idea is credited once per definition, however many synonyms of it appear, and the result is normalised against the best a single definition could do.

---

## The pipeline

Every query flows through the same stages:

1. **Normalise** — fold case and diacritics, join set phrases, drop function words, stem lightly.
2. **Expand** — pull in each typed word's thesaurus neighbours at reduced weight.
3. **Score** — field-weighted BM25 against every word's definition → a relevance in `0…1`.
4. **Resonate** — add the emotion-category read (phenomenology), intensity agreement, and a small distance nudge.
5. **Explain** — generate the three-line explanation and the Sapir–Whorf provocation for the top match.

### 1 — Normalise

```
tokens(text):
  lowercase, strip diacritics, hyphens → spaces
  join set phrases:  "fed up" → fedup, "never been" → neverbeen,
                     "fall in love" → fallinlove, "stuck in my head" → earworm, …
  keep words of 3+ letters, drop stop-words, stem each
```

- The **stop-word list** removes function words and feeling-filler (`feeling`, `like`, `something`, `sense`…). `never` and `been` are deliberately **kept** — absence ("a place I've never been") is meaning.
- **Stemming** strips common suffixes (`-ing`, `-ed`, `-ness`, `-ly`, `-s`…), undoubles consonants (`running → run`), and maps irregular forms onto their base (`angry → anger`, `loneliness → lonely`, `forgotten → forget`) so word families meet.
- The same tokeniser runs over the definitions, so phrases line up on both sides.

### 2 — Expand (the concept thesaurus)

`CONCEPTS` is ~150 hand-written clusters of words that point at the same thing:

```
"stranger strangers outsider unfamiliar foreigner alien leftout excluded"
"reply retort comeback response"
"embarrass embarrassed shame ashamed humiliate cringe cringing mortified"
```

A typed word brings in the rest of its cluster at **0.8×** weight. Two rules keep this honest:

- **An idea counts once.** A definition containing *longing*, *yearning* and *ache* matches the idea "longing" once — the strongest hit scores, with a small bonus (`ECHO = 0.3`) for the definition restating it.
- **Words that name a feeling or concept** (anything in the thesaurus) weigh **1.5×** an incidental word, so "irritation" outranks "hard" in *"a hard-to-name irritation"*.

### 3 — Score (field-weighted BM25)

Each word is indexed from four fields, weighted by how much they say about what the word *is*:

| Field | Weight |
|---|---|
| The word's own name | 3.0 |
| One-line definition (`defShort`) | 2.6 |
| Long definition (`defFull`) | 1.0 |
| "Nearest in English" note | 0.7 |
| "Cognitive science" note | 0.45 |

```
idf[t]   = ln(1 + (N − df[t] + 0.5) / (df[t] + 0.5))
gain(t)  = idf[t] × tf / (tf + k1·(1 − b + b·len/avgLen))        k1 = 1.3, b = 0.35
           × 1.15 if t is in the one-line definition

idea     = max(direct hit, best neighbour hit × 0.8) + 0.3 × echo
score    = Σ ideas (idea × weight)
relevance = score / ideal × (0.75 + 0.25 × share of ideas touched)   → 0…1
```

`ideal` is what a definition would score if it contained every typed idea strongly, so relevance means "how much of what you said does this word answer?" Rare terms outweigh common ones through IDF — the property that stops *"place"* out-voting *"never been"*.

### 4 — Resonate (phenomenology)

In parallel, `phenomenology()` reads the input's **emotional register**:

- Seven categories (Longing, Awe, Social, Joy, Tension, Time, Philosophical) each have a cue lexicon (`LEX`). Cues match **from the start of a word** (`nostalg` → nostalgia, nostalgic) so `sea` can't fire inside `search`. Multi-word phrases weigh 3, long words 2, short words 1.
- **Intensity** is read from texture words: `deep / aching / overwhelming…` → **82**, `slight / quiet / faint…` → **40**, otherwise **60**.

The final ranking score:

```
s = relevance × 100
  + (categoryScore[word.category] / max(strongest category, 3)) × 18 × (2 − best relevance)
  + max(0, 3 − |word.intensity − inputIntensity| / 12)
  + (word.dist / 100) × 1.5
```

The category term is a *share* of the strongest register, so it is bounded; and it leans in harder (`× (2 − best relevance)`) exactly when no definition answers the description well. Meaning leads — register breaks ties and rescues vague inputs.

### Confidence

```
trust = 0.4 + 0.6 × evidence          // evidence = min(1, ideal / 13)
match = clamp( round(44 + relevance × trust × 50 + min(10, lead × 0.6)),  52 … 97 )
```

`evidence` measures how specific the description was. A one-word input like *"sad"* can match dozens of words perfectly, so it is capped well below a detailed description that only one word answers. Alternatives are scored the same way and never climb back above the one before them.

---

## The Composer (`analyseText`)

The Composer splits your writing into sentences and ranks each with the same engine, taking the best word per sentence (no repeats, at most five, hidden words skipped). A sentence is only annotated when it is specific enough **and** touches a word's meaning in more than one way:

- relevance ≥ **0.32**, or ≥ **0.24** with three or more points of contact (long sentences spread their weight);
- a sentence that shares just **one** idea with a word needs relevance ≥ **0.62**.

So *"The meeting is at 3pm tomorrow."* — which shares one word with **Kal** — stays unmarked.

---

## The explanation

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

Two checks, both reproducible:

**Word-level** — `node scripts/engine-check.js` (in `server/`, no server or database needed) scores 100 plain-language descriptions, each with the set of words that would be a correct answer. 60 were used while building the thesaurus; 40 were written up front and only ever scored.

| | Previous engine | This engine |
|---|---|---|
| Tuning set — best match correct | 43 / 60 (72%) | **57 / 60 (95%)** |
| Tuning set — correct word among the five shown | 53 / 60 (88%) | **59 / 60 (98%)** |
| Held-out set — best match correct | 27 / 40 (68%) | **35 / 40 (88%)** |
| Held-out set — correct word among the five shown | 31 / 40 (78%) | **38 / 40 (95%)** |

**Category-level** — `server/scripts/benchmark.js` runs 50 feeling descriptions against the live endpoint and checks whether the returned word's *category* matches the category the input was written for. Latest run, against the live deployment: **44 / 50 (88%)**, ~303 ms average including the network round trip (the previous engine scored 45 / 50). Several of the "misses" are the right word filed under a neighbouring category — *Tizita* (longing) for a song that returns you to your teenage bedroom (time), *Natsukashii* (time) for wishing a summer back (longing) — which is the limit of category as a proxy. `results/metrics.json`, which the site reads its figures from, was regenerated from that run; re-run the benchmark whenever the engine changes.

`AI_CACHE_VERSION` in `server/src/index.js` is bumped with the engine, so previously cached answers are bypassed automatically on deploy.

---

## Source

- Engine: [`server/src/ai.js`](../server/src/ai.js) — `tokens`, `stem`, `conceptMap`, `buildIndex`, `queryIdeas`, `semanticSims`, `phenomenology`, `rankWords`, `feelingCore`, `composeCore`, `writeExplanation`, `claudeFeelingSearch`.
- Browser twin + Atlas `meaningSearch`: [`web/src/lib/engine.js`](../web/src/lib/engine.js); Atlas search: [`web/src/lib/search.js`](../web/src/lib/search.js).
- Checks: [`server/scripts/engine-check.js`](../server/scripts/engine-check.js) (word-level, offline) and [`server/scripts/benchmark.js`](../server/scripts/benchmark.js) → `server/results/metrics.json`.
- Related: [How cognitive distance is calculated](cognitive-distance.md).
