# Project Babel

> *"The limits of my language mean the limits of my world."* — Ludwig Wittgenstein

** Live:** **[project-babel-five.vercel.app](https://project-babel-five.vercel.app)** — full-stack on Vercel + Neon Postgres.

**Docs:** [Architecture](docs/architecture.md) · [Matching engine](docs/matching-engine.md) · [Cognitive distance](docs/cognitive-distance.md) · [Submission screening](docs/submission-screening.md)

**Babel is an interactive atlas of untranslatable words** — feelings and concepts that exist in one language but have no direct equivalent in English. Describe a feeling in plain language and Babel finds the word for it, drawn from **500 words across 121 languages**, each rendered as a six-dimension portrait.

It is one project in two parts:

- **Frontend** (`web/`) — a **React 18** single-page app built with **Vite** and **React Router**, fully responsive across mobile and desktop, with shareable/downloadable image cards and per-user saved-word bookmarking. `web/src/data/data.js` is the bundled source of word data.
- **Backend** (`server/`) — Node.js + Express + Prisma, deployed as a **Vercel serverless function**. The live source of truth for accounts, saved data, submissions, analytics, and the word database. Uses **PostgreSQL (Neon)** in production and local development.

The frontend calls the real backend first and falls back to `localStorage` and an in-browser engine when the API is unreachable, so it works either way. See the **[Architecture doc](docs/architecture.md)** for how it all fits together.

---

## Features

### The eight pages
| Page | What it does |
|---|---|
| **Home** `#/` | Manifesto hero, a live "describe a feeling" search box, word-of-the-day, and a clickable word ticker — **click any ticker word to open its shareable image card**. |
| **Atlas** `#/atlas` | All words, browsable and filterable by emotion category, language family, cognitive-distance band, and script; sortable; instant relevance-ranked search (accent-insensitive, typo-tolerant, and able to answer a plain description). |
| **Word Portrait** `#/word/:slug` | A full six-dimension portrait per word (cognitive science, cultural origin, linguistic structure, nearest English, philosophy, art), cross-cultural notes, closest words in other languages, a recommendation strip, "Ask Babel", pronunciation audio, and image-card **Download / Share**. |
| **Name My Feeling** `#/name-my-feeling` | The centrepiece. Describe a feeling; the engine interprets the emotion and returns the closest word with a **three-line explanation** (what you're feeling / why this word / how it fits) plus cross-language alternatives — **click any alternative to open its image card**. |
| **Language Map** `#/map` | The whole atlas as a force-directed SVG network (also a language-family tree), coloured by emotional cluster. |
| **Theory** `#/theory` | Long-form essay on linguistic relativity with an interactive Boroditsky colour experiment. |
| **Composer** `#/compose` | Write anything; the same semantic engine annotates the untranslatable moments hidden in your prose. |
| **About** `#/about` | The builder's note, honest methodology, tech stack, and a **Submit a word** form. |

Plus **Sources** `#/sources` (honest provenance + measured accuracy), **Account** `#/account` (saved words, saved image cards, and Name-My-Feeling history), and **Admin** `#/admin`.

### Shareable image cards
Every word portrait, Name My Feeling result, and saved card can be **downloaded** as a 1080×1080 PNG or **shared** directly. Sharing uses the native Web Share API (the actual image → any app) on supported devices, and otherwise a share menu of popular platforms: **WhatsApp, X/Twitter, Facebook, Threads, Telegram, LinkedIn, Pinterest, Tumblr, Reddit, Email**, plus image-first apps **Instagram, Snapchat, TikTok, Discord** (hands you the image and opens the app), and copy-image / download fallbacks. The canonical share URL is always `https://` for security.

### The matching engine (Name My Feeling & Composer)
The offline engine is a small retrieval model: **field-weighted BM25 over each word's definition**, with a hand-built **concept thesaurus** that maps what people actually type ("outsider", "comeback", "fed up") onto the vocabulary the definitions use, plus light stemming and an emotion-category read of the input. Word-level accuracy on 100 plain-language descriptions: **95 % / 88 %** best-match-correct on the tuning / held-out sets (`server/scripts/engine-check.js`, runs offline); the category-proxy benchmark is in `server/scripts/benchmark.js`. The Atlas search uses the same engine when you type a description instead of a word. If `ANTHROPIC_API_KEY` is set on the server, it upgrades to Claude with the same JSON contract; the UI honestly discloses which engine answered.

### Accounts, submissions & admin
- **Accounts** — name + email + password (bcrypt, cost 12) with a signed session in an HttpOnly cookie; editable, deletable (cascades). Saved words, saved image cards, and search history persist server-side.
- **Community submissions** — screened automatically for duplicates, placeholders, **accuracy/plausibility** (gibberish words and incoherent explanations are rejected; unknown languages flagged), and vagueness, then queued for human review.
- **Admin** (`#/admin`, gated by `ADMIN_KEY`) — usage metrics with charts (users, saved words, **shared cards**, searches, top categories/words), and a moderation queue. **Accepting a submission adds it to the database as a real word**, and there's a word-delete endpoint — so the **word count and browse surfaces update automatically** with the database.

### Live database sync
The bundled `data.js` seeds the atlas so the site works standalone, but on boot the frontend reconciles it with the live database (`GET /api/words/all`): words added via the admin queue are merged in and become fully browsable (atlas, search, portrait, recommendations, map, count), and deleted words disappear — the displayed word count always reflects the database.

### Everywhere
Fully responsive (verified at 375 px mobile and desktop), keyboard-navigable, `prefers-reduced-motion` aware, with pronunciation audio via the Web Speech API.

---

## Security

- **Sessions** live in an HttpOnly, SameSite=Strict cookie (Secure in production) that page scripts cannot read. Sessions last 7 days; changing the password ends every other session, and a deleted account's session stops working at once.
- **Request forgery:** every write must carry an `x-babel-client` header, which a cross-site page cannot add. The API sends no CORS headers at all; the frontend and API share one origin.
- **Input:** every request body, query and path parameter is checked with a zod schema; unknown fields are refused. JSON bodies are capped at 100 KB.
- **Rendering:** no user, community or model text is ever inserted as HTML. The engine escapes what it interpolates, and the page renders only its own bold and line-break formatting.
- **Rate limits** (stored in the database, so they hold across serverless instances): sign-in 5 failures per 15 min per account and address; admin key 5 failures per 15 min per address; registration 5 per hour; submissions 6 per 10 min plus 200 a day overall; searches 30 per 10 min plus 5,000 a day overall; events 60 per 10 min; Claude calls 6 per 10 min per visitor plus `CLAUDE_DAILY_CAP` a day overall, after which the offline engine answers.
- **Admin** uses `ADMIN_KEY`, sent only as the `x-admin-key` header and held in memory by the admin page (never in browser storage).
- **Headers:** a content security policy, `nosniff`, frame denial and a referrer policy on every page (`vercel.json`) and API response.
- **Startup:** the server refuses to start without `DATABASE_URL` and a `JWT_SECRET` of at least 32 characters, or with an `ADMIN_KEY` shorter than 32 characters.

### Environment variables (`server/.env`, or Vercel project settings)

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Pooled Postgres connection used by the app |
| `DATABASE_URL_UNPOOLED` | for schema changes | Direct connection used by `prisma db push` |
| `JWT_SECRET` | yes | Signs session cookies; at least 32 characters |
| `ADMIN_KEY` | no | Unlocks the admin routes; at least 32 characters; unset keeps them closed |
| `PORT` | no | Local server port (default 4600) |
| `ANTHROPIC_API_KEY` | no | Enables the Claude path for Name My Feeling and screening |
| `ANTHROPIC_MODEL` | no | Claude model override |
| `CLAUDE_DAILY_CAP` | no | Claude calls per day across all visitors (default 300) |

### Applying a schema change

The `RateLimit` table and the `User.sessionVersion` column must exist before the new code is deployed. From `server/`, with `DATABASE_URL` and `DATABASE_URL_UNPOOLED` pointing at the production database:

```
npx prisma db push
```

The change only adds a table, a column with a default and an index, so it does not touch existing data.

### Tests

`cd server && npm test` runs the API security suite (configuration, headers, request forgery, validation, sessions, lockouts, rate limits, moderation rules and the Claude path) against an in-memory store. It needs no database, network or keys.

## Tech stack
- **Frontend:** **React 18 + Vite + React Router** (hash routing), HTML Canvas (image cards), SVG (force-directed map + charts), Web Speech API (pronunciation), Web Share API.
- **Backend:** Node.js 22 + Express (Vercel serverless function), Prisma ORM, PostgreSQL / Neon, zod validation, cookie sessions + bcrypt.
- **AI:** offline BM25 + concept-thesaurus matcher; optional Claude (`claude-opus-4-8`) via `ANTHROPIC_API_KEY`.

## Project structure
```
Project Babel/
├─ web/                      # frontend — React + Vite (deployed)
│  ├─ index.html             #   Vite entry
│  ├─ vite.config.js         #   dev /api proxy, build config
│  └─ src/
│     ├─ main.jsx App.jsx    #   entry, router + providers
│     ├─ pages/              #   the 11 route pages
│     ├─ components/         #   Nav, WordCard, CardModal, ShareMenu, …
│     ├─ context/            #   Auth, Modal (cards), Words (live count/hydration)
│     ├─ lib/                #   engine, api, card, feeling, hydrate, store, util
│     └─ data/               #   bundled word data (data.js) + adapter
├─ api/
│  └─ index.js               #   Vercel serverless entry → wraps the Express app
├─ server/                   # backend (Express + Prisma)
│  ├─ src/index.js           #   API routes + screening + word-add-on-accept
│  ├─ src/ai.js              #   offline matching engine (API side)
│  ├─ prisma/schema.prisma   #   data model (PostgreSQL)
│  ├─ scripts/               #   benchmark.js, engine-check.js, clear-feeling-cache.js
│  └─ results/metrics.json   #   measured accuracy (read by the site)
├─ site/                     # original vanilla-JS frontend (reference only)
├─ vercel.json               # builds web/dist, routes /api/* → the function
├─ docs/                     # architecture + matching-engine + distance + screening
└─ README.md                 # this file
```

> **Note on the matching engine:** the offline engine exists in **two** deployed places kept in sync by hand — `server/src/ai.js` (the API) and `web/src/lib/engine.js` (the React fallback). The block between the `ENGINE CORE` markers is identical in both: change one, paste it into the other, bump `AI_CACHE_VERSION`, then run `node scripts/engine-check.js` and re-run the benchmark. (`site/app.js`, the legacy vanilla version, keeps the earlier TF-IDF engine.)

## Documentation

Deeper write-ups of how the interesting parts work live in [`docs/`](docs/):

- **[Architecture](docs/architecture.md)** — the whole system end to end: the React frontend, the serverless Express API, the Neon database, data flow, the offline/fallback design, and deployment.
- **[Matching engine](docs/matching-engine.md)** — how "Name My Feeling" and the Composer turn a described feeling into a word: the offline BM25 + concept-thesaurus engine, the scoring formula, and the optional Claude upgrade.
- **[Cognitive distance](docs/cognitive-distance.md)** — how each word's "untranslatability" score is calculated: the curatorial base score and the four-component algorithmic composite.
- **[Submission screening](docs/submission-screening.md)** — the automated rules a community-submitted word passes through (duplicates, placeholders, gibberish, coherence) before it reaches human review.

## License

© 2026 Surabhi Datta. **All rights reserved.** This repository is public for viewing and portfolio evaluation only — no permission is granted to use, copy, modify, or redistribute it without prior written consent. See [LICENSE](LICENSE).

---

*Built by Surabhi Datta. Definitions are curatorial editorial synthesis, not a peer-reviewed lexicon — provenance and measured accuracy are disclosed on the in-app Sources page.*
