# How Cognitive Distance Is Calculated

**Cognitive distance** is Babel's headline metric for a word: *how far a concept sits from anything expressible in a single English word.* A higher score means the word is **less translatable** — English needs a whole phrase (or can't quite reach it at all).

It's the `X%` you see on every word card, portrait, the language map, and the atlas filters.

> **Honest framing.** Cognitive distance is a **curatorial, interpretive metric**, not an empirical measurement. It's a consistent, transparent way to rank "untranslatability" across the atlas — not a peer-reviewed linguistic constant. The app says as much on its Sources page.

---

## Two numbers, one idea

Babel actually surfaces **two** related figures on a word's portrait:

| Number | What it is | Source |
|---|---|---|
| **Curatorial score** (`dist`, 0–100) | The base value assigned to each word when it's added to the atlas — a human judgment of semantic distance from English. Stored per word (`distScore` in the database). This is the number shown everywhere by default. | `data.js` / DB |
| **Algorithmic composite** (0–100) | A **recomputation** that formalises the metric as a documented, reproducible blend of four signals. Shown alongside the curatorial score on the word portrait. | `CogDistance.compute()` in `site/app.js` |

The composite exists to make the metric **auditable**: instead of a single opaque number, it's a weighted sum of components you can inspect.

---

## The composite formula

```
composite = round(
    semantic   × 0.35
  + cultural   × 0.25
  + structural × 0.20
  + gap        × 0.20
)
```

Every component is bounded to `0–100`, so the composite is too. The four components:

### 1. Semantic — weight 35%
```
semantic = dist            // the word's curatorial distance score
```
The single largest input is the curatorial judgment itself. The composite **blends** the human semantic read (35%) with three structural signals (65% combined) — it doesn't discard the curator's call, it grounds it.

### 2. Cultural — weight 25%
```
cultural = min(100,  cultures.length × 14
                   + (script is Non-Latin ? 20 : 6)
                   + 30)
```
The idea: the more a word is anchored in **culture-specific context**, the harder it is to carry into English.
- **+14 per "held across cultures" note** — words documented with more cross-cultural framings score higher.
- **+20 if the native script is Non-Latin** (else **+6**) — a different writing system signals greater conceptual distance.
- **+30 baseline** so every word starts with some cultural weight.

### 3. Structural — weight 20%
```
structural = /compound|verb|reflexive/i.test(linguistic profile) ? 82 : 60
```
A coarse read of **linguistic machinery**. If the word's linguistic dimension describes a **compound**, a **verb**, or a **reflexive** construction (grammar English can't mirror in one word), it scores **82**; otherwise a neutral **60**.

### 4. Gap — weight 20%
```
best = highest similarity % among the word's nearest cross-language equivalents
gap  = 100 − best
```
Each word lists its closest words in other languages with a similarity `%`. The **larger the gap** to even its nearest neighbour, the more genuinely untranslatable it is. A word whose closest sibling is only 44% similar contributes a gap of `56`.

---

## Worked example — *Komorebi* (木漏れ日)

Japanese for "sunlight filtering through leaves." Suppose its atlas data is:

| Input | Value |
|---|---|
| Curatorial `dist` | `91` |
| Cross-cultural notes | `3` |
| Script | Non-Latin |
| Linguistic profile | describes a **compound** noun |
| Nearest equivalent similarity | `44%` (Norwegian *skogsdis*) |

Component by component:

| Component | Calculation | Value |
|---|---|---|
| Semantic | `= 91` | **91** |
| Cultural | `min(100, 3×14 + 20 + 30) = min(100, 92)` | **92** |
| Structural | compound → | **82** |
| Gap | `100 − 44` | **56** |

```
composite = round(91×0.35 + 92×0.25 + 82×0.20 + 56×0.20)
          = round(31.85 + 23.00 + 16.40 + 11.20)
          = round(82.45)
          = 82
```

So Komorebi lands at a composite of **82** — high, as expected for a culturally-anchored, compound, low-overlap word.

---

## Distance bands

The atlas lets you filter by band (higher = less translatable):

| Band | Meaning |
|---|---|
| **80–100%** | Barely reachable in English — needs a whole description |
| **60–80%** | A clear lexical gap; English paraphrases clumsily |
| **40–60%** | Partly expressible; a near-synonym exists but misses nuance |
| **Under 40%** | Close to an English equivalent |

---

## Where the score is used

The `dist` score drives much of the interface:

- **Word cards & portraits** — the `X%` distance badge
- **Atlas** — the "Cognitive distance" band filter and the default **sort by distance**
- **Home** — the "Live word index · by distance" and editor's picks (highest-distance words)
- **Language map** — node **size** scales with distance (`r = 5 + dist/100 × 9`); the "distance" colour mode and the distance-vs-intensity scatter plot
- **Recommendations** — words with *similar* distance are considered related
- **Image cards** — the "% COGNITIVE DISTANCE" watermark

---

## Source

- Implementation: [`site/app.js`](../site/app.js) — the `CogDistance` object (`weights` + `compute()`), and `distScore` in [`server/prisma/schema.prisma`](../server/prisma/schema.prisma).
- Design reference: spec §13.9 ("Cognitive-distance algorithm").

*Weights and thresholds are deliberately simple and legible — the goal is a metric you can read and reason about, not a black box.*
