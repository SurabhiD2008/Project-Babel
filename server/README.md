# Project Babel — Backend API

Express + Prisma implementation of the API specified in the design document (§6–§7).
Ships with **SQLite** so it runs with zero external database setup; switching to
**PostgreSQL** for production is a one-line change to `prisma/schema.prisma`.

## Stack
- **Node.js + Express** — HTTP API
- **Prisma ORM** — schema, migrations, queries
- **SQLite** (dev) / **PostgreSQL** (prod) — datastore
- **JWT + bcrypt** — email/password auth
- **AI engine** — offline semantic matcher (**TF-IDF cosine similarity** over word
  definitions + emotion-category resonance, with light stemming) using the same JSON
  contract as the Claude path; set `ANTHROPIC_API_KEY` to upgrade to `claude-opus-4-8`
- **AI response cache** — SHA-256-keyed rows in the `AiCache` table (Redis substitute)

## Setup & run
```bash
cd "Project Babel/server"
npm install
npm run setup     # prisma generate + db push + seed 500 words
npm start         # http://localhost:4600  (API under /api, site at /)
```
`npm run setup` is idempotent — re-running re-seeds the words from `../site/data.js`,
the single source of truth shared with the frontend.

## Endpoints (spec §6)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/words` | paginated, filter by `q,family,category,script,band`, `sort=dist\|az\|num\|intensity` |
| GET | `/api/words/all` | every word (basic fields, no relations) — the frontend reconciles this with the bundled `data.js` at boot so admin-added/deleted words stay in sync |
| GET | `/api/words/random` | word of the day (deterministic per day; `?daily=false` for random) |
| GET | `/api/words/:slug` | full portrait (dimensions, cultures, comparisons, related) |
| GET | `/api/categories` | emotion categories with counts |
| POST | `/api/feelings/search` | `{input}` → `{bestMatch, matchScore, explanation, sapirWhorf, alternates[]}` (cached) |
| POST | `/api/compose/analyse` | `{text}` → `{found:[{phrase,word,lang,def,why}]}` (cached) |
| POST | `/api/submissions` | community word submission → review queue |
| POST | `/api/auth/register` | `{name,email,password}` → `{token,user}` (name required) |
| POST | `/api/auth/login` | `{email,password}` → `{token,user}` |
| GET | `/api/user/me` | auth — current account `{email,name,createdAt}` |
| PATCH | `/api/user/me` | auth — edit account `{name?,password?}` |
| DELETE | `/api/user/me` | auth — delete account (cascades saved words/cards/history) |
| GET | `/api/user/saved` | auth — the user's saved collection |
| POST | `/api/user/saved/:slug` | auth — save a word |
| DELETE | `/api/user/saved/:slug` | auth — unsave a word |
| GET | `/api/user/history` | auth — the user's Name My Feeling search history |
| GET | `/api/user/cards` | auth — the user's saved shareable image cards |
| POST | `/api/user/cards/:slug` | auth — save a card (body `{source}`: portrait\|feeling\|compose) |
| DELETE | `/api/user/cards/:slug` | auth — remove a saved card |
| GET | `/api/analytics` | public summary metrics (spec §12) |
| GET | `/api/metrics/benchmark` | real, measured Name My Feeling accuracy/latency (see Benchmark below) |
| POST | `/api/events` | log a share/copy/download event |
| GET | `/api/health` | liveness + word count + active AI engine |

Auth: send `Authorization: Bearer <token>` for the `/api/user/*` routes.

### Admin (gated by `ADMIN_KEY` in `.env`, sent as an `x-admin-key` header)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin/metrics` | full usage dashboard: users, saved words/cards, **shared cards**, searches, event counts, most-searched categories, most-viewed words, submissions by status |
| GET | `/api/admin/submissions` | list submissions, optionally `?status=pending\|flagged\|accepted\|...` |
| POST | `/api/admin/submissions/:id/accept` | accept a submission — **inserts it as a real `Word`** in the atlas and refreshes the cache/count |
| POST | `/api/admin/submissions/:id/reject` | mark a submission rejected |
| DELETE | `/api/admin/words/:slug` | delete a word from the atlas (cascades its detail rows) and refreshes the cache/count |

Reachable in the browser at `#/admin` on the frontend (linked quietly from the site footer, not the main nav).

### Submission screening
`POST /api/submissions` runs automated screening before queuing: rejects exact/
near-duplicates (normalized, diacritic- and case-insensitive) against both the
live atlas and the pending queue; rejects placeholder/malformed entries; runs an
**accuracy/plausibility pass** (keyboard-mash / vowel-less "words" and incoherent
explanations are rejected as `rejected_inaccurate`, an unrecognised language name
is flagged for review); and rejects or flags vague explanations. See
`screenSubmission()` in `src/index.js`. Accepting an entry then adds it to the
database, so the site's word count and browse surfaces update automatically.

### Benchmark (spec §12 — real numbers, not fabricated)
```bash
node scripts/benchmark.js
```
Runs 50 independently-written feeling descriptions (7 per emotion category, none
copied from any word's own definition) against the live `/api/feelings/search`
endpoint, measures category-match rate and response latency, and writes
`results/metrics.json` — which `/api/metrics/benchmark` and the site's About/
Sources pages read from. Latest measured result: **90 % category-match rate,
~53 ms average response**. Re-run after changing the matching engine or lexicon
in `src/ai.js` (and clear cached rows first with `node scripts/clear-feeling-cache.js`).

## Switching to PostgreSQL (production)
In `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```
Set `DATABASE_URL` to your Postgres connection string, run `npx prisma migrate deploy`,
then `npm run seed`. No model or route changes required. Add Redis in front of the
`AiCache` table for a shared cache across instances (spec §6).

## Schema (spec §6)
`Word` ← `Dimension`, `Culture`, `Comparison`, `Related` (per-word detail);
`User` ← `SavedWord` → `Word`; `Submission`; `AiCache`; `SearchLog` (analytics).
