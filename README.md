# Project Babel

> *"The limits of my language mean the limits of my world."* — Ludwig Wittgenstein

** Live:** **[project-babel-five.vercel.app](https://project-babel-five.vercel.app)** — full-stack on Vercel + Neon Postgres.

**Docs:** [Architecture](docs/architecture.md) · [Matching engine](docs/matching-engine.md) · [Cognitive distance](docs/cognitive-distance.md) · [Submission screening](docs/submission-screening.md)

**Babel is an interactive atlas of untranslatable words** — feelings and concepts that exist in one language but have no direct equivalent in English. Describe a feeling in plain language and Babel finds the word for it, drawn from **500 words across 121 languages**, each rendered as a six-dimension portrait.

It is one project in two parts:

- **Frontend** (`web/`) — a **React** single-page app built with **Vite** and **React Router**. `web/src/data/data.js` is the bundled source of word data. *(The original zero-build vanilla-JS implementation is kept in `site/` for reference; the live site now serves the React build.)*
- **Backend** (`server/`) — Node.js + Express + Prisma, deployed as a **Vercel serverless function**. The live source of truth for accounts, saved data, submissions, analytics, and the word database. Uses **PostgreSQL (Neon)** in production and local dev; SQLite is still supported for a zero-setup local run of the API.

The frontend calls the real backend first and falls back to `localStorage` and an in-browser engine when the API is unreachable, so it works either way. See the **[Architecture doc](docs/architecture.md)** for how it all fits together.

---

## Screenshots

**[Try the live demo](https://project-babel-five.vercel.app)**

A quick tour of the interface:

- **Home** — describe a feeling and let Babel name it
- **Name My Feeling** — the closest untranslatable word, with a three-line explanation and cross-language alternatives
- **Word portrait** — each word across six dimensions, with a downloadable / shareable image card
- **Language map** — the whole atlas as a force-directed network, coloured by emotional cluster

| Home | Name My Feeling |
|------|-----------------|
| ![Home](screenshots/home.png) | ![Name My Feeling](screenshots/name-my-feeling.png) |
| **Word portrait** | **Atlas** |
| ![Word portrait](screenshots/word-portrait.png) | ![Atlas](screenshots/atlas.png) |

---

## Features

### The eight pages
| Page | What it does |
|---|---|
| **Home** `#/` | Manifesto hero, a live "describe a feeling" search box, word-of-the-day, and a clickable word ticker — **click any ticker word to open its shareable image card**. |
| **Atlas** `#/atlas` | All words, browsable and filterable by emotion category, language family, cognitive-distance band, and script; sortable; instant trie-based search. |
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
The offline engine ranks words by **TF-IDF cosine similarity** between your input and each word's definition (with light stemming so "visit" matches "visited"), combined with emotion-category resonance. This prioritises the word whose *meaning* actually matches over one that merely shares a common noun. Measured accuracy: **90 % category-match** across 50 independent test inputs (`server/scripts/benchmark.js`). If `ANTHROPIC_API_KEY` is set on the server, it upgrades to Claude with the same JSON contract; the UI honestly discloses which engine answered.

### Accounts, submissions & admin
- **Accounts** — JWT + bcrypt auth (name + email + password), editable, deletable (cascades). Saved words, saved image cards, and search history persist server-side.
- **Community submissions** — screened automatically for duplicates, placeholders, **accuracy/plausibility** (gibberish words and incoherent explanations are rejected; unknown languages flagged), and vagueness, then queued for human review.
- **Admin** (`#/admin`, gated by `ADMIN_KEY`) — usage metrics with charts (users, saved words, **shared cards**, searches, top categories/words), and a moderation queue. **Accepting a submission adds it to the database as a real word**, and there's a word-delete endpoint — so the **word count and browse surfaces update automatically** with the database.

### Live database sync
The bundled `data.js` seeds the atlas so the site works standalone, but on boot the frontend reconciles it with the live database (`GET /api/words/all`): words added via the admin queue are merged in and become fully browsable (atlas, search, portrait, recommendations, map, count), and deleted words disappear — the displayed word count always reflects the database.

### Everywhere
Fully responsive (verified at 375 px mobile and desktop), keyboard-navigable, `prefers-reduced-motion` aware, with pronunciation audio via the Web Speech API.

---

## Run it on your machine

**Prerequisites:** [Node.js](https://nodejs.org/) 18+ (includes `npm`). No database to install for local dev — the API uses SQLite by default.

The app is a **React frontend** (`web/`) talking to the **Express API** (`server/`) — run both:

### 1. Start the API
```bash
cd "Project Babel/server"
npm install
npm run setup     # Prisma client + DB + seed 500 words (SQLite by default)
npm start         # API at http://localhost:4600
```

### 2. Start the React frontend
```bash
cd "Project Babel/web"
npm install
npm run dev       # Vite dev server at http://localhost:5173 (proxies /api → :4600)
```
Then open **http://localhost:5173** in your browser.

- The **admin dashboard** is at `http://localhost:5173/#/admin`; the key is `ADMIN_KEY` in `server/.env` (default `babel-admin-2026`).
- `server/.env` overrides: `PORT`, `JWT_SECRET`, `ADMIN_KEY`, and `ANTHROPIC_API_KEY` (to enable the Claude engine).
- **Production build:** `cd web && npm run build` produces `web/dist` — the static bundle Vercel serves.

### Frontend only (no backend)
The React app works standalone with a `localStorage` + in-browser-engine fallback — run the Vite dev/preview server without the API. Accounts and admin/live-database features are then local or unavailable.

*(The original zero-build vanilla-JS version still lives in `site/` and can be served with `npx serve site` — kept for reference; the deploy no longer uses it.)*

### Verify accuracy (optional)
```bash
cd "Project Babel/server"
node scripts/clear-feeling-cache.js   # clear cached feeling results
node scripts/benchmark.js             # prints category-match rate + latency, writes results/metrics.json
```

---

## Tech stack
- **Frontend:** **React 18 + Vite + React Router** (hash routing), HTML Canvas (image cards), SVG (force-directed map + charts), Web Speech API (pronunciation), Web Share API.
- **Backend:** Node.js + Express (Vercel serverless function), Prisma ORM, PostgreSQL / Neon (SQLite-capable), JWT + bcrypt.
- **AI:** offline TF-IDF cosine matcher; optional Claude (`claude-opus-4-8`) via `ANTHROPIC_API_KEY`.

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
│  ├─ scripts/               #   benchmark.js, clear-feeling-cache.js
│  └─ results/metrics.json   #   measured accuracy (read by the site)
├─ site/                     # original vanilla-JS frontend (reference only)
├─ vercel.json               # builds web/dist, routes /api/* → the function
├─ docs/                     # architecture + matching-engine + distance + screening
└─ README.md                 # this file
```

> **Note on the matching engine:** the offline engine exists in **three** places kept in sync by hand — `server/src/ai.js` (the API), `web/src/lib/engine.js` (the React fallback), and `site/app.js` (the legacy vanilla version). Change them together, then clear the feeling cache and re-run the benchmark.

## Documentation

Deeper write-ups of how the interesting parts work live in [`docs/`](docs/):

- **[Architecture](docs/architecture.md)** — the whole system end to end: the React frontend, the serverless Express API, the Neon database, data flow, the offline/fallback design, and deployment.
- **[Matching engine](docs/matching-engine.md)** — how "Name My Feeling" and the Composer turn a described feeling into a word: the offline TF-IDF cosine engine, the scoring formula, and the optional Claude upgrade.
- **[Cognitive distance](docs/cognitive-distance.md)** — how each word's "untranslatability" score is calculated: the curatorial base score and the four-component algorithmic composite.
- **[Submission screening](docs/submission-screening.md)** — the automated rules a community-submitted word passes through (duplicates, placeholders, gibberish, coherence) before it reaches human review.

## License

© 2026 Surabhi Datta. **All rights reserved.** This repository is public for viewing and portfolio evaluation only — no permission is granted to use, copy, modify, or redistribute it without prior written consent. See [LICENSE](LICENSE).

---

*Built by Surabhi Datta. Definitions are curatorial editorial synthesis, not a peer-reviewed lexicon — provenance and measured accuracy are disclosed on the in-app Sources page.*
