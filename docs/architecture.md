# Architecture

How the whole of Babel fits together — the React frontend, the serverless Express API, the Neon database, and the design decisions that tie them.

---

## The system at a glance

```
                    Browser
        ┌──────────────────────────────┐
        │  React SPA (Vite build)       │   ← static files on Vercel's CDN
        │  • 11 hash-routed pages       │
        │  • offline matching engine    │
        │  • Canvas image cards         │
        │  • localStorage fallback      │
        └───────────────┬──────────────┘
                        │ fetch /api/*  (same origin)
                        ▼
        ┌──────────────────────────────┐
        │  Vercel serverless function   │   ← api/index.js → Express app
        │  (Express + Prisma)           │
        │  • auth, saved data, history  │
        │  • submissions + screening    │
        │  • admin metrics + moderation │
        │  • server-side matching engine│
        └───────────────┬──────────────┘
                        │ Prisma (pooled)
                        ▼
        ┌──────────────────────────────┐
        │  Neon — serverless PostgreSQL │
        └──────────────────────────────┘
```

Everything is served from **one origin** on Vercel: the React build at `/`, the API at `/api/*`. Because they share an origin there is no CORS and the client can call `/api` relatively.

**Design principle — graceful degradation.** The frontend ships a full copy of the word data (`data.js`) and an in-browser matching engine. It calls the real backend first, but if the API is unreachable it falls back to `localStorage` and the offline engine, so the app is never fully broken.

---

## Repository layout

```
web/        React + Vite frontend (deployed)
api/        Vercel serverless entry that wraps the Express app
server/     Express + Prisma API (also runnable as a normal server locally)
site/       original vanilla-JS frontend, kept for reference (not deployed)
docs/       this doc + matching-engine, cognitive-distance, submission-screening
vercel.json build + routing config
```

---

## Frontend (`web/`) — React + Vite

A client-side SPA. No SSR: the app is Canvas-, physics-, and `localStorage`-heavy, which fits a plain client bundle far better than a server-rendered framework.

### Rendering & routing
- **Vite** builds `web/src` into a static `web/dist` (one JS bundle + one CSS file + `index.html`).
- **React Router** in **hash mode** (`HashRouter`) — URLs look like `/#/atlas`. Hash routing means every route is served by the same `index.html` with no server rewrites, and it matches the original site's URLs.
- `src/main.jsx` mounts `<App/>`; `src/App.jsx` wires the providers and the 11 routes.

### The 11 pages (`src/pages/`)
Home · Atlas · Word Portrait · Name My Feeling · Composer · Language Map · Theory · About · Sources · Account · Admin. Each is a self-contained component; shared UI lives in `src/components/` (Nav, WordCard, DistBar, CatTag, SpeakButton, CardModal, ShareMenu, AuthModal, Footer).

### State (React Context, `src/context/`)
- **AuthContext** — current user + `login`/`register`/`logout`; persists a JWT + user in `localStorage`.
- **ModalContext** — app-wide image-card actions (`openCard`, `shareCardTo`, `download`); renders `CardModal` / `ShareMenu` at the root so any page can trigger them.
- **WordsContext** — the live word count + a `version` counter. On boot it hydrates the bundled data from the DB (see *Live hydration* below); when that changes anything it bumps `version`, which re-keys `<Routes>` so the current page recomputes.

### Client libraries (`src/lib/`)
- **`data/`** — `data.js` is the bundled 500-word dataset (copied verbatim from the original); `data/index.js` re-exports it as ES modules (`WORDS`, `WORDS_BY_SLUG`, `VISIBLE_WORDS`, `CATEGORIES`, …).
- **`engine.js`** — the offline **TF-IDF cosine** matching engine (`localFeelingSearch`, `analyseText`, `recommend`, `CogDistance`). See [matching-engine.md](matching-engine.md).
- **`api.js`** — the backend client: `resolveApiBase()` probes `/api` then `localhost:4600`, `apiFetch()` attaches the JWT, and an `API` object wraps auth / saved words / cards / history / submissions with **localStorage fallbacks**.
- **`feeling.js`** — orchestrates Name My Feeling / Composer: backend first, offline engine as fallback.
- **`card.js`** — renders the 1080×1080 word card to a `<canvas>` and provides download / Web-Share / share-menu helpers.
- **`hydrate.js`** — reconciles the bundled data with the DB (below).
- **`store.js`**, **`ui.js`**, **`util.js`**, **`speech.js`** — localStorage wrapper, toasts, formatting, pronunciation.

### Two subsystems worth calling out
- **Image cards** — `card.js` draws the card on a canvas; `ModalContext` exposes Download / Share everywhere. Sharing uses the **Web Share API** with the actual PNG on supported devices, else a menu of social intents (WhatsApp/X/Instagram/…) plus copy-image / download.
- **Language Map** — a force-directed SVG network. The O(n²) layout is precomputed once, then a `requestAnimationFrame` loop eases nodes toward per-mode targets and freezes when settled. It runs imperatively inside a `useEffect` on an SVG ref (React owns the container; the physics owns the nodes).

---

## Backend (`server/` + `api/`)

An **Express** app that is also a **Vercel serverless function**.

- `server/src/index.js` builds the Express app, mounts the API under `/api`, and — crucially — only calls `app.listen()` when run directly (`require.main === module`). It `module.exports` the app.
- `api/index.js` re-exports that app. On Vercel, `vercel.json` rewrites `/api/(.*)` to this function, so each request is handled by the same Express routing. Locally, `npm start` runs the same file directly and listens on port 4600.
- **One codebase, two runtimes.** Nothing changes between local server and serverless function.

### What it does
- **Words** — `GET /api/words` (paginated/filterable), `/words/:slug` (full portrait), `/words/all` (the list the frontend hydrates from), `/categories`.
- **Matching** — `POST /api/feelings/search` and `/compose/analyse` run `server/src/ai.js` (the same TF-IDF engine), or Claude if `ANTHROPIC_API_KEY` is set. The `engine` field is returned so the UI can disclose which answered.
- **Accounts** — JWT + bcrypt (`/auth/*`, `/user/*`): saved words, saved cards, and search history, all per-user.
- **Submissions** — `POST /api/submissions` runs `screenSubmission()` (duplicates, placeholders, gibberish, coherence, unknown-language flag) before queuing. See [submission-screening.md](submission-screening.md).
- **Admin** (gated by `ADMIN_KEY`) — usage metrics, a moderation queue, **accept-inserts-a-real-Word**, and word delete.

### Data model (Prisma → Postgres)
`Word` ← `Dimension` / `Culture` / `Comparison` / `Related` (the six-dimension portrait); `User` → `SavedWord` / `SavedCard` / `UserSearch`; `Submission`; `AiCache` (SHA-256-keyed matching cache); `SearchLog` (analytics). Schema: `server/prisma/schema.prisma`.

### The word data, two sources
`site/data.js` (and its copy `web/src/data/data.js`) is the **bundled** dataset used for instant browse and the offline engine. The **database** is the source of truth for the live count and any admin-added words. They're normally identical (the DB is seeded from the same data); **live hydration** bridges any drift.

---

## Live hydration (bundle ↔ database)

On boot, `WordsContext` calls `hydrateWordsFromBackend()`:
1. `GET /api/words/all` → the DB's word list.
2. Words in the DB but not in the bundle (e.g. admin-accepted) are fetched in full and **merged** into the in-memory arrays (browsable in the atlas, search, portraits, map, count).
3. Words removed from the DB are **spliced out**.
4. If anything changed, `version` bumps and the current page re-renders.

If the API is unreachable it's a no-op and the app runs on the bundled 500 words.

---

## Request / data flows

**Page load** → Vercel serves `web/dist/index.html` + the JS/CSS bundle → React mounts, renders instantly from the bundled data → `WordsContext` hydrates from the DB in the background.

**Name My Feeling** → `feeling.js` `POST /api/feelings/search` → backend runs the TF-IDF engine (or Claude), logs history for signed-in users, returns `{bestMatch, score, explanation, sapirWhorf, alternates}` → if the backend is down, the identical **in-browser** engine answers instead.

**Submit a word** → `POST /api/submissions` → `screenSubmission()` accepts / flags / rejects → stored as a `Submission` row → surfaces in the admin queue.

**Admin accept** → `POST /api/admin/submissions/:id/accept` → inserts a real `Word`, refreshes the server cache, returns the new count → next hydration merges it into the browsable set.

---

## Deployment (Vercel + Neon)

- **Build** (`vercel.json`): install server deps + `prisma generate` (for the function), then `cd web && npm install && npm run build`. **Output:** `web/dist`.
- **Routing:** static assets from `web/dist`; `/api/(.*)` → the `api/index.js` serverless function.
- **Database:** Neon Postgres via the Vercel integration (`DATABASE_URL` pooled for the app, `DATABASE_URL_UNPOOLED` direct for migrations). Prisma uses `binaryTargets` including Vercel's Linux runtime.
- **Env vars:** `DATABASE_URL(_UNPOOLED)`, `JWT_SECRET`, `ADMIN_KEY`, optional `ANTHROPIC_API_KEY`.
- **CI/CD:** the GitHub repo is connected — every push to `main` auto-builds and deploys; `npx vercel deploy --prod` also works.

For local development the same API runs on SQLite with zero setup (`server/` `npm run setup && npm start`), and the React app runs on Vite (`web/` `npm run dev`, proxying `/api` to `:4600`).

---

## See also
- [Matching engine](matching-engine.md) — the TF-IDF cosine model in depth.
- [Cognitive distance](cognitive-distance.md) — how the "untranslatability" score is computed.
- [Submission screening](submission-screening.md) — the community-contribution rules.
