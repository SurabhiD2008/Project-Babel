# Submission Screening Rules

Anyone can submit a word through the **About → Submit a word** form (`POST /api/submissions`). Before a submission reaches the human review queue, it runs through an **automated screening pass** (`screenSubmission()` in [`server/src/index.js`](../server/src/index.js)).

> **What screening is — and isn't.** It's an **automated plausibility filter**, not fact-checking. It can't verify that a word *truly* means what the submitter claims — only a human or native speaker can. What it *does* catch: missing fields, placeholders, keyboard-mash "words," incoherent explanations, and duplicates. Everything that passes still goes to a **human review queue**; nothing is auto-published.

Every submission — accepted, flagged, or rejected — is stored as a `Submission` row with its status, so the admin dashboard can show the full picture. Rejections return HTTP **422** with a helpful message; passes return **201**.

---

## Status vocabulary

| Status | Meaning |
|---|---|
| `pending` | Passed screening; awaiting human review |
| `flagged` | Passed, but a soft signal warrants a closer look |
| `rejected_invalid` | Missing/malformed fields or a placeholder |
| `rejected_ambiguous` | Explanation too short to judge |
| `rejected_inaccurate` | Failed an automated accuracy/plausibility check |
| `rejected_duplicate` | Already in the atlas or already in the queue |
| `accepted` | An admin approved it → **inserted into the atlas as a real word** |

---

## The pipeline (in order)

Text is first **normalized** (diacritics stripped, lower-cased, whitespace collapsed) so comparisons are accent- and case-insensitive.

### Hard rejections

1. **Required fields** — `word`, `language`, and `why` must all be present → else `rejected_invalid`.
2. **Word length** — normalized word must be **1–60 characters** → else `rejected_invalid`.
3. **Placeholder / test entry** — a word that's the same character 3+ times (`aaa`) or one of a known placeholder list (`test`, `asdf`, `lorem`, `ipsum`, `example`, `n/a`, `none`, `xyz`, `abc`, `word`) → `rejected_invalid`.
4. **Language name** — must be letters/spaces/hyphens/apostrophes (Latin, Greek, or CJK ranges) and **2–40 characters** → else `rejected_invalid`.
5. **Explanation length** — `why` must be **≥ 15 characters** → else `rejected_ambiguous`.

### Accuracy screening

6. **Gibberish word** (`looksLikeGibberish`) → `rejected_inaccurate`. For **Latin-script** words, a word is rejected if it:
   - has **no vowel** (a real word has one), or
   - has **6+ consonants in a row**, or
   - has **4+ identical letters running**, or
   - contains a **keyboard-mash run** (`qwert`, `asdf`, `zxcv`, `hjkl`, `uiop`, …).

   Non-Latin scripts (CJK, Arabic, Cyrillic, Indic, …) are exempt from these Latin-specific rules.
7. **Incoherent explanation** (`coherentExplanation`) → `rejected_inaccurate`. The `why` must have **≥ 4 word-tokens**, and at least **60% of them (min 3)** must contain a vowel — i.e. read like real prose, not noise.

### Duplicate detection

8. **Already in the atlas** — same normalized word **and** language as an existing entry → `rejected_duplicate` (with a link to the existing word).
9. **Already in the queue** — matches a `pending`/`flagged` submission → `rejected_duplicate`.

### Soft flags (pass, but flag for a human)

If it survives everything above, it's queued — but flagged for a closer look if either:
- the explanation is **brief** (< 40 characters), or
- the **language name isn't recognized** — checked against the atlas's own languages plus a list of ~90 common world languages (`EXTRA_LANGUAGES`). Unknown languages are **flagged, not rejected**, because new languages are welcome; the flag just says "verify it's accurate."

Any flag → status `flagged`; otherwise → `pending`.

---

## What happens on acceptance

When an admin **accepts** a submission (`POST /api/admin/submissions/:id/accept`), it becomes a **real `Word` row** in the database: it's slugified, given the next entry number, its category is inferred from the explanation, and it's assigned the `Community` family. The in-memory cache is refreshed, so the new word immediately appears in the live word count, the atlas, search, and the matching engine. (There's also `DELETE /api/admin/words/:slug` to remove one.)

---

## Source

- Screening: [`server/src/index.js`](../server/src/index.js) — `screenSubmission`, `looksLikeGibberish`, `coherentExplanation`, `knownLanguageSet`, `normalizeText`, `PLACEHOLDER_WORDS`, `EXTRA_LANGUAGES`.
- Acceptance → new word: `addWordFromSubmission` in the same file.
- Related: [How the matching engine works](matching-engine.md) · [How cognitive distance is calculated](cognitive-distance.md).
