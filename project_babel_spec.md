# Project Babel — Complete Specification Document

> *"The limits of my language mean the limits of my world."*
> — Ludwig Wittgenstein

---

## 1. The Idea

### What Babel Is

Babel is an interactive atlas of untranslatable words — feelings, concepts, and experiences that exist in one language but have no direct equivalent in English. It is simultaneously a linguistic tool, a philosophical project, an AI-powered emotional search engine, and a portfolio-quality web application.

The central premise: human emotional experience is vastly richer than the vocabulary any single language provides. When you cannot name something, you can still feel it — but you feel it in the dark. Every untranslatable word in the Babel atlas is a flashlight pointing at something that was already there in human experience, just unnamed and therefore harder to hold.

### The Central Question

**Does having a word for a feeling change how often you have it?**

Babel holds the weak Sapir-Whorf position: language does not imprison thought, but it illuminates it. Knowing the Japanese word *Komorebi* does not give you the experience of sunlight through leaves — but it might make you stop in it more often.

### What Makes It Original

- Not a translation tool — Babel maps concepts that resist translation by definition
- Not a dictionary — definitions are multi-dimensional portraits, not entries
- Not a list of "fun foreign words" — every word is chosen because it names a genuine gap in English
- The only tool that lets you input a raw, unnamed feeling and receive a word for it from 43 languages
- The only platform that annotates your own personal writing with untranslatable words

### Intellectual Foundations

- **Sapir-Whorf hypothesis** (weak form / linguistic relativity) — Whorf, Sapir, Boroditsky
- **Cognitive semantics** — Lakoff, Johnson
- **Cultural linguistics** — Sharifian
- **Philosophy of language** — Wittgenstein (*Philosophical Investigations*), Heidegger ("language is the house of being"), Derrida (untranslatability as fertile zone)
- **Affect science** — Lisa Feldman Barrett (*How Emotions Are Made*), emotional granularity research
- **Positive computing** — Tim Lomas (*The Positive Lexicography*)
- **Empirical evidence** — Boroditsky's colour studies (Russian *goluboy* / *siniy*), Pirahã number words (Everett)

---

## 2. The Word Database

### Scale
- **212 words** at launch, designed to grow through community submissions
- **43 languages and dialects** — from Portuguese and Japanese to Yaghan and Georgian
- **11 language families** — Indo-European, Japonic, Semitic, Uralic, Sino-Tibetan, Dravidian, Kartvelian, Celtic, Austronesian, Norse, Yaghan

### The Six-Dimension Framework

Every word in the atlas is structured across six dimensions. This is the intellectual spine of the database:

| Dimension | What It Captures |
|---|---|
| **Cognitive science** | What neural or psychological phenomenon does this word encode? Does naming it change how it's experienced? |
| **Cultural origin** | What historical, geographic, or social conditions made this feeling speakable in this culture? |
| **Linguistic structure** | Is this a compound word? A verb used as noun? What does its grammar reveal about how the culture thinks? |
| **Nearest in English** | The closest approximation — and precisely what it misses |
| **Philosophy** | Which philosopher, tradition, or idea does this word illuminate or connect to? |
| **Art & music** | What creative work captures or was shaped by this word? |

### The Cognitive Distance Metric

Each word carries a **cognitive distance score** (0–100%) representing how far the concept sits from anything expressible in English. This is a curatorial score — not a scientific measurement — based on a composite of semantic distance, cultural specificity, structural untranslatability, and the gap between the word and its nearest English equivalents.

- **80–100%**: Concepts with no meaningful English parallel (Komorebi: 91%, Kalsarikännit: 95%, Mamihlapinatapai: 97%)
- **60–80%**: Concepts expressible in English only with multiple words or significant loss (Saudade: 82%, Weltschmerz: 76%)
- **40–60%**: Concepts that have approximate English words but with meaningful nuance lost
- **Under 40%**: Concepts where English comes close, included because cultural context adds value

### Emotion Categories

1. Longing & Loss (34 words)
2. Awe & Nature (41 words)
3. Social & Belonging (37 words)
4. Joy & Warmth (28 words)
5. Discomfort & Tension (43 words)
6. Time & Memory (29 words)
7. Philosophical (20 words)

### Sample Words (Key Entries)

| Word | Language | Distance | Category |
|---|---|---|---|
| Komorebi | Japanese | 91% | Awe & Nature |
| Mamihlapinatapai | Yaghan | 97% | Social & Belonging |
| Kalsarikännit | Finnish | 95% | Social & Belonging |
| Saudade | Portuguese | 82% | Longing & Loss |
| Toska | Russian | 84% | Longing & Loss |
| Shemomedjamo | Georgian | 88% | Social & Belonging |
| Weltschmerz | German | 76% | Philosophical |
| Hiraeth | Welsh | 79% | Longing & Loss |
| Forelsket | Norwegian | 71% | Joy & Warmth |
| Jayus | Indonesian | 82% | Social & Belonging |
| Hygge | Danish | 65% | Joy & Warmth |
| Sehnsucht | German | 72% | Longing & Loss |

---

## 3. The Eight Pages — Full Specification

### Page 1: Home `/`

**Purpose:** First impression, manifesto, entry point. Must communicate depth, beauty, and purpose in under 8 seconds and pull the user forward.

**Sections:**
1. **Navigation bar** — Logo (Playfair italic "Babel"), 6 nav links, live pulse indicator ("212 words indexed")
2. **Hero — split screen** — Left: manifesto headline + search bar + stats. Right: live word index panel showing top words by distance
3. **Headline** — `"You've felt it. [struck-through: English] another language named it."` — The struck-through word creates immediate intrigue
4. **Search bar** — Primary CTA, not a button. The action IS the product. Full width on mobile
5. **Stat row** — 212 words / 43 languages / 6 dimensions / 1 central question
6. **Featured word card** — Large format, all 4 dimensions visible, distance meter, changes daily
7. **Mini word grid** — 4 smaller cards, highest-distance words
8. **Word ticker** — Continuous horizontal scroll of all word names + language codes, at 22% opacity
9. **Three-column teasers** — Atlas / Language Map / Theory, each with nav arrow
10. **Pull quote** — Wittgenstein, full-bleed, amber rule above
11. **Footer** — Logo, nav links, floating script watermarks in 5 languages at 15% opacity

**Key design decisions:**
- Ghost word watermark behind hero (the featured word in its native script, 2.6% opacity)
- No hero image — the typography IS the visual
- The search bar is the CTA — entering it takes you directly to Name My Feeling with the query pre-filled

---

### Page 2: The Atlas `/atlas`

**Purpose:** The library. All 212 words, fully browsable, filterable, sortable. Proves the project's scope.

**Sections:**
1. **Sticky top bar** — Search input, result count, sort control
2. **Language family strip** — Horizontal scrolling chips: All / Indo-European / Japonic / Semitic / Uralic / Sino-Tibetan / Dravidian / Kartvelian / Yaghan / Other
3. **Left sidebar** (190px) — Filter panel:
   - Emotion type (7 categories with counts)
   - Cognitive distance (4 bands)
   - Script type (Latin / Non-Latin / All)
   - Sort options
4. **Editor's picks row** — 3 featured cards, rotated weekly, above the main grid
5. **Word grid** — 2-column responsive grid of word cards
6. **Load more** — Pagination, 20 words per page

**Word card contents:**
- Language name + family tag + word number
- Word in large Playfair italic + native script below
- One-line definition
- Distance bar (amber gradient, 1.5px)
- Emotion category tags
- Hover state reveals "Open portrait →"
- Subtle radial glow at top-right corner on each card

---

### Page 3: Word Portrait `/word/[slug]`

**Purpose:** One page per word. 212 unique pages. The heart of the product — a full multi-dimensional portrait of a single untranslatable word.

**Sections:**
1. **Masthead** — Giant word in Playfair 900 italic (4rem+), language tag, phonetic, word number, distance score. Ghost watermark of word in native script fills background at 2.6% opacity. Grid overlay behind everything.
2. **Navigation** — Breadcrumb: Atlas / Category / Word. Prev/Next buttons. Share button.
3. **One-line distillation** — The sharpest possible definition in 20 words or fewer, in large italic with amber left border
4. **Full definition** — 3–4 sentences, literary prose
5. **Six dimensions panel** — 2×3 grid: Cognitive Science · Cultural Origin · Linguistic Structure · Nearest in English · Philosophy · Art & Music
6. **Cross-cultural panel** — How this feeling is held differently across 4–6 cultures
7. **Closest in other languages** — Ranked list with distance bars and explanation of the gap
8. **Philosophy moment** — One quote, one idea, one question. Full amber left-border block
9. **"Ask Babel" button** — Opens inline AI chat scoped specifically to this word (violet accent, Claude API)
10. **AI response area** — Violet-tinted box, appears below the button after API call
11. **Explore nearby** — Horizontal scroll strip of semantically related words

---

### Page 4: Name My Feeling `/name-my-feeling`

**Purpose:** The centrepiece AI interaction. The most shareable feature. User describes a feeling in plain language; AI searches 212 words across 43 languages and returns the best match.

**Left panel — Input:**
- Eyebrow: "AI · searches 43 languages"
- Heading: "Describe what you're feeling." (Playfair italic)
- Subtext explaining the process
- Large textarea — Playfair italic placeholder, warm border on focus
- Character count (0/300)
- Three example prompt chips (clickable to pre-fill)
- "Search all languages →" button — amber, full width
- Language hint text: "Searching Portuguese · Japanese · German…"

**Right panel — Result states:**
1. **Empty state** — Italic prompt, subdued, waiting
2. **Loading state** — Animated word cycling through language names
3. **Result state:**
   - "Best match · X% semantic fit" tag (amber pill)
   - Large word card: language, word, phonetic, italic definition, match bar
   - Four-dimension breakdown (condensed)
   - Cross-language comparison bars (4 alternatives with match percentages)
   - Sapir-Whorf provocation (violet box)
   - AI-written explanation of why this word fits THIS specific input
   - "Read the full portrait →" CTA

**AI prompt architecture (4 layers):**
1. Phenomenology extraction — reads emotional texture, sensory quality, relational context, temporal character of input
2. Semantic matching — compares against all 212 word profiles (structured JSON in prompt)
3. Explanation generation — writes a paragraph about why this word fits THIS specific input, not a generic definition
4. Sapir-Whorf question — one philosophical provocation specific to the match
5. Output format: structured JSON `{bestMatch, matchScore, explanation, sapirWhorf, alternates[]}`

---

### Page 5: Language Map `/map`

**Purpose:** The entire atlas as a navigable network visualisation. The page that makes interviewers stop scrolling.

**Three visualisation modes (toggle):**
1. **Network graph (default)** — D3.js force-directed graph. Nodes = words, coloured by emotion category. Edges = conceptual overlap between words in the same category. Node size scales with cognitive distance score. Click = select. Drag = reposition. Scroll = zoom.
2. **Language family tree** — Branching dendrogram showing which language families produce the most untranslatable concepts per emotion category
3. **Distance scatter** — Words plotted on 2D plane: X axis = cognitive distance from English, Y axis = emotional intensity. See the full shape of what English cannot say.

**Controls:**
- Mode toggle: Network / Tree / Scatter
- Colour by: Emotion type / Language family / Distance band / Script type
- Filter by emotion category — dims non-matching nodes to 10% opacity
- Search — highlight and centre a word in the network
- Zoom +/− and reset buttons

**Hover state:** Word name + one-line definition + distance score in a tooltip
**Click state:** Side drawer opens with 4-dimension summary + distance bar + "Open portrait →"
**Cluster labels:** Floating text labels positioned at cluster centroids

**Side drawer (right panel, 270px):**
- "Selected word" header
- Word detail card (language, word, short def, distance bar)
- "Open full portrait →" button
- Emotion cluster legend with colour dots

---

### Page 6: Theory `/theory`

**Purpose:** The intellectual spine of the project. A long-form editorial page. What separates Babel from a vocabulary list.

**Layout:** Three-column: progress rail (48px) / essay (fluid) / TOC sidebar (240px)

**Essay sections (§):**
1. **The central question** — Drop cap opener (Playfair, amber "T"). Does naming a feeling change how often you have it?
2. **The Sapir-Whorf hypothesis** — Strong form (discredited) vs. weak form (alive). The evidence.
3. **The Boroditsky colour test** — Interactive widget: two blue swatches, "Same" / "Different" buttons, reveal the research finding (Russian 124ms faster)
4. **The philosophers** — Wittgenstein / Heidegger / Derrida. Short, elegant treatments. Inline hoverable word cards when Saudade, Komorebi etc. are mentioned.
5. **What Babel believes** — Short manifesto in large Playfair italic
6. **Further reading** — 6 annotated book recommendations

**Right sidebar:**
- Sticky table of contents with active state indicator
- "Words mentioned" — small clickable cards for each word cited in the essay
- CTA: "Ready to find the word for what you're carrying?" → Name My Feeling

**Left progress rail:**
- 6 dots with connecting lines
- Done / active / upcoming states
- Tracks scroll position

**Essay design details:**
- Drop cap: Playfair 900, amber, 3.4rem, float:left
- Pull quotes: Playfair italic, amber left border (2px), full column width
- Section dividers: `§ 02` with amber rules either side
- Inline word cards: hover to reveal mini portrait popup (word, language, definition, distance, link)

---

### Page 7: Composer `/compose`

**Purpose:** The most creative page. Users write anything; AI finds and annotates the untranslatable moments hidden in their prose.

**Layout:** Two-column: editor + annotated output (left) / word palette (right, 270px)

**Left panel:**
- Tab bar: "Write" / "Annotated"
- **Write tab:** Full-width textarea, Playfair italic, 14.5px, warm colour. Grid overlay background. Ghost word watermark.
- **Annotated tab:** The same text with amber underlines on matched phrases. Hover over any underlined phrase reveals a popup showing: matched word, language, definition, and WHY this specific phrase maps to this word. Click opens full portrait.
- Footer bar: word count / "N untranslatable moments found" / "Analyse my text →" button

**Right panel — Word palette:**
- "Words found in your text" header with count
- One palette card per found word: language tag, word name, short definition, specific quote from user's text that matched, "Open portrait →"
- Export box at bottom: Copy annotated text / Download as styled PDF / Share as image card

**AI prompt architecture:**
- Sends full user text + full word database to Claude
- Requests: identify 3–5 specific phrases, match each to a word, explain WHY that specific phrase (not just the general emotion) maps to that word
- Output: structured JSON array `[{phrase, word, lang, def, why}]`
- Annotation: JS replaces matched phrases in the DOM with `<span>` elements containing the popup

---

### Page 8: About `/about`

**Purpose:** Surabhi's intellectual autobiography as it relates to language and building. Doubles as a portfolio piece and human anchor.

**Sections:**
1. **Why this exists** — Personal origin story: the specific untranslatable feeling that prompted the project. Personal, specific, not generic.
2. **The gap between feeling and language** — The core thesis in plain prose
3. **What Babel is not** — Confident list with ✕ markers: not a translation tool / not a dictionary / not a "fun words" list / not neutral
4. **The methodology** — How words are researched across the six dimensions. The cognitive distance metric explained honestly as curatorial score. Sources cited.
5. **The AI integration** — Honest description of what the AI does vs. what the builder designed
6. **Built with** — Tech stack as pills
7. **Submit a word** — Simple form: word / language / why untranslatable / name (optional) / email (optional). Reviewed before addition.
8. **The builder** — Avatar, name, role, bio, links (LinkedIn / GitHub / Portfolio / LeetCode)

**Right sidebar:**
- Atlas in numbers (stats)
- Quick links to all 8 pages

---

## 4. Design System

### Colour Palette

| Token | Value | Usage |
|---|---|---|
| `--ink` | `#07060E` | Background — deep blue-black, not pure black |
| `--warm` | `#EDE8DE` | Primary text — warm off-white, never cold |
| `--warm-bright` | `#F0ECE4` | Display text, headings |
| `--amber` | `#B8944A` | Primary accent — amber gold, all interactive elements |
| `--amber-light` | `#D4A855` | Hover states on amber |
| `--amber-dim` | `rgba(184,148,74,.55)` | Secondary amber for tags, labels |
| `--amber-ghost` | `rgba(184,148,74,.07)` | Tinted backgrounds |
| `--violet` | `rgba(107,95,232,.8)` | AI-related elements only — Sapir-Whorf boxes, Ask Babel |
| `--violet-dim` | `rgba(107,95,232,.2)` | Violet tinted backgrounds |
| `--border` | `rgba(184,148,74,.12)` | Primary borders |
| `--border-dim` | `rgba(237,232,222,.07)` | Secondary borders |
| `--text-muted` | `rgba(237,232,222,.42)` | Body text |
| `--text-faint` | `rgba(237,232,222,.22)` | Labels, metadata |
| `--grid-line` | `rgba(184,148,74,.022)` | Background grid overlay |

**Colour logic:**
- Background: one shade — `#07060E`
- Amber: one accent — all interactive elements, distance bars, labels
- Violet: reserved exclusively for AI-powered features — creates instant visual recognition
- Never use gradients on backgrounds — only on the 1.5px distance bars

### Typography

| Role | Font | Weight | Size | Usage |
|---|---|---|---|---|
| Display / Headlines | Playfair Display | 900 italic | 2rem–4.5rem | All H1, H2, word names, logo |
| Display / Pull quotes | Playfair Display | 400 italic | 1rem–1.3rem | Quotes, definitions, essay prose |
| Sub-headings | Playfair Display | 700 | — | Section headings |
| Body text | DM Sans | 300 | 13–14px | All paragraph text |
| UI / Labels | Space Mono | 400 | 7.5–10px | All tags, nav links, metadata, stat labels |
| UI / Bold labels | Space Mono | 700 | 9–10px | Buttons, CTAs |

**Typography rules:**
- DM Sans weight 300 only for body — never 400 or 500 in paragraphs
- Space Mono always letter-spaced: `.12em` minimum for nav, `.2em` for section labels
- Space Mono always text-transform: uppercase for labels
- Playfair italic for emotional content, Playfair non-italic for structural headings
- Line height: body text `1.75–1.85`, display `1.0–1.2`

### Spacing & Grid

- **Base unit:** 8px
- **Content max-width:** 900px for most pages, 640px for essay column
- **Grid overlay:** `32px × 32px` amber grid at 2.2% opacity — present on all hero sections and input panels. Signals "technical precision" without being heavy.
- **Border radius:** 2–5px only — never rounded. The design is angular and deliberate.
- **Border weight:** 0.5px universally — never 1px borders. Keeps everything feeling precise and light.

### Ghost Word Watermarks

Every major section has a large ghost word in the background:
- Font: Playfair Display 900 italic
- Size: 8rem–11rem
- Colour: `rgba(184,148,74,.026)` — barely visible
- Position: bottom-right or top-right, slightly outside the frame
- Content: the featured word, or a Greek/script character related to language (λέξις, λόγος)
- `pointer-events: none; user-select: none; z-index: 0`

### Component Library

**Buttons:**
- **Primary (amber):** `background: #B8944A; color: #07060E; font-weight: 700; border-radius: 2px; padding: 9px 20px;`
- **Ghost:** `background: none; border: 0.5px solid rgba(184,148,74,.22); color: rgba(184,148,74,.5);`
- **Violet (AI):** `background: rgba(107,95,232,.12); border: 0.5px solid rgba(107,95,232,.3); color: rgba(107,95,232,.8);`

**Cards:**
- Featured word card: `rgba(184,148,74,.07)` background, `0.5px solid rgba(184,148,74,.26)` border
- Mini word card: `rgba(237,232,222,.025)` background, `0.5px solid rgba(237,232,222,.06)` border
- Hover on cards: border brightens, slight background tint — `transition: border-color 0.15s`

**Distance bars:**
- Track: `height: 1.5px; background: rgba(184,148,74,.1)`
- Fill: `background: linear-gradient(90deg, #B8944A, rgba(184,148,74,.35))`
- Never thicker than 1.5px

**Section labels:**
- Space Mono, 7.5–8px, letter-spacing .18–.22em, uppercase
- Colour: `rgba(184,148,74,.38)`
- Followed by: `padding-bottom: 0.5rem; border-bottom: 0.5px solid rgba(184,148,74,.09)`

**Tags / Pills:**
- `border-radius: 99px; padding: 3–4px 8–12px; font-size: 8–9px`
- Space Mono, uppercase, letter-spaced
- Active state: amber background + border

---

## 5. Animations & Motion

### Global Principles
- Motion should feel like a breath, not a bounce — ease-in-out or custom bezier, never elastic
- All transitions: `0.15s` for hover states, `0.2s–0.4s` for state changes, `0.3–0.5s` for page-level transitions
- Never animate colour — only opacity, transform, border-colour

### Specific Animations

**Word Ticker (Home page):**
```css
@keyframes tick {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
animation: tick 34s linear infinite;
```
- Content duplicated so the loop is seamless
- Pause on hover: `animation-play-state: paused`

**Nav pulse indicator:**
```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.2; }
}
animation: pulse 2.2s ease-in-out infinite;
```

**Name My Feeling loading word:**
```css
@keyframes fadeInOut {
  0%, 100% { opacity: 0.2; }
  50% { opacity: 0.8; }
}
animation: fadeInOut 2s ease-in-out infinite;
```
- Cycles through language names: "Searching Portuguese… Japanese… German…"

**Textarea cursor blink:**
```css
@keyframes blink {
  50% { opacity: 0; }
}
animation: blink 1.1s step-end infinite;
```

**Page transitions:**
- Fade in: `opacity 0 → 1` over `0.25s ease-out` on `.page.active` appearance
- No slide transitions — pure fade keeps the literary feel

**Card hover:**
- `border-color` transition only, `0.15s`
- No scale transforms on cards — too playful for this tone

**D3 Network (Language Map):**
- Force simulation with `alphaDecay` tuned for smooth settling
- Node hover: `r` increases `0.2s ease`
- Node click: brief `opacity 0.8 → 1` pulse on the selected node
- Zoom: D3 built-in `zoom.transition().duration(300)`

**Annotated text reveal (Composer):**
- After analysis, annotated output fades in: `opacity 0 → 1` over `0.4s`
- Amber underlines appear sequentially with a 50ms stagger per annotation

**Popup (Composer hover / Theory inline words):**
- `display: none → block` — no animation needed, fast enough
- Add: `opacity 0 → 1` over `0.1s` for refinement

---

## 6. Backend Architecture

### Why a Backend Is Essential
- The hardcoded JavaScript database is the single biggest weakness of the current prototype
- It is discoverable in 30 seconds via DevTools by any technical interviewer
- A backend enables: user auth, saved words, word submission review, analytics, search

### Recommended Stack

**Server:** Node.js + Express
**Database:** PostgreSQL (primary) + Redis (caching API responses)
**ORM:** Prisma
**Auth:** JWT + bcrypt (email/password) or NextAuth for OAuth
**Hosting:** Railway or Render (free tier) for the API; Vercel for the frontend
**CDN:** Cloudflare (free tier) for static assets

### Database Schema

```sql
-- Words table
CREATE TABLE words (
  id          SERIAL PRIMARY KEY,
  slug        VARCHAR(100) UNIQUE NOT NULL,
  word        VARCHAR(100) NOT NULL,
  language    VARCHAR(100) NOT NULL,
  native      VARCHAR(200),
  phonetic    VARCHAR(200),
  family      VARCHAR(100),
  script      VARCHAR(100),
  dist_score  INTEGER NOT NULL,  -- cognitive distance 0-100
  category    VARCHAR(100) NOT NULL,
  def_short   TEXT NOT NULL,
  def_full    TEXT NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Dimensions table (6 per word)
CREATE TABLE dimensions (
  id       SERIAL PRIMARY KEY,
  word_id  INTEGER REFERENCES words(id),
  label    VARCHAR(100) NOT NULL,
  content  TEXT NOT NULL
);

-- Cultures table (4-6 per word)
CREATE TABLE cultures (
  id       SERIAL PRIMARY KEY,
  word_id  INTEGER REFERENCES words(id),
  name     VARCHAR(100) NOT NULL,
  content  TEXT NOT NULL
);

-- Comparisons table
CREATE TABLE comparisons (
  id          SERIAL PRIMARY KEY,
  word_id     INTEGER REFERENCES words(id),
  lang        VARCHAR(100) NOT NULL,
  comparison_word VARCHAR(100) NOT NULL,
  similarity  INTEGER NOT NULL
);

-- Users table
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- Saved words
CREATE TABLE saved_words (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id),
  word_id    INTEGER REFERENCES words(id),
  saved_at   TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, word_id)
);

-- Word submissions (community)
CREATE TABLE submissions (
  id          SERIAL PRIMARY KEY,
  word        VARCHAR(100) NOT NULL,
  language    VARCHAR(100) NOT NULL,
  why         TEXT NOT NULL,
  submitter   VARCHAR(100),
  email       VARCHAR(255),
  status      VARCHAR(20) DEFAULT 'pending',
  submitted_at TIMESTAMP DEFAULT NOW()
);

-- AI response cache
CREATE TABLE ai_cache (
  id           SERIAL PRIMARY KEY,
  input_hash   VARCHAR(64) UNIQUE NOT NULL,
  response     JSONB NOT NULL,
  created_at   TIMESTAMP DEFAULT NOW()
);
```

### API Endpoints

```
GET    /api/words              — All words (paginated, filterable, sortable)
GET    /api/words/:slug        — Single word with all dimensions, cultures, comparisons
GET    /api/words/random       — Random word (for word of the day)
GET    /api/categories         — All emotion categories with counts
POST   /api/feelings/search    — Name My Feeling: {input} → {match, score, explanation}
POST   /api/compose/analyse    — Composer: {text} → [{phrase, word, why}]
POST   /api/submissions        — Submit a new word
POST   /api/auth/register      — Create account
POST   /api/auth/login         — Login
GET    /api/user/saved         — Get user's saved words (auth required)
POST   /api/user/saved/:id     — Save a word (auth required)
DELETE /api/user/saved/:id     — Unsave a word (auth required)
```

### AI Response Caching
Cache Claude API responses in Redis with 24-hour TTL. Hash the input with SHA-256 as the cache key. This dramatically reduces API costs and improves response speed for common inputs.

---

## 7. Frontend Architecture (Production Build)

### Recommended Stack

```
Framework:      Next.js 14 (App Router)
Styling:        Tailwind CSS + CSS Modules for component-specific styles
State:          Zustand (lightweight, no Redux boilerplate)
Data fetching:  TanStack Query (React Query)
Animation:      Framer Motion for page transitions, CSS for micro-animations
Visualisation:  D3.js v7 (Language Map)
Fonts:          Google Fonts (Playfair Display, DM Sans, Space Mono)
Icons:          None — design is text and shape only
Testing:        Vitest + React Testing Library
Deployment:     Vercel
```

### File Structure

```
/app
  /page.tsx              — Home
  /atlas/page.tsx        — Atlas
  /word/[slug]/page.tsx  — Word Portrait (dynamic route)
  /name-my-feeling/page.tsx
  /map/page.tsx
  /theory/page.tsx
  /compose/page.tsx
  /about/page.tsx
  /layout.tsx            — Nav + shared layout
/components
  /nav/Nav.tsx
  /words/WordCard.tsx
  /words/FeaturedCard.tsx
  /words/DistanceBar.tsx
  /words/DimensionsGrid.tsx
  /words/ComparisonBars.tsx
  /ui/Ticker.tsx
  /ui/GhostWord.tsx
  /ui/GridBg.tsx
  /ui/SectionLabel.tsx
  /ui/Eyebrow.tsx
  /map/NetworkGraph.tsx
  /map/Legend.tsx
  /composer/AnnotatedOutput.tsx
  /composer/AnnotationPopup.tsx
/lib
  /api.ts               — API client functions
  /claude.ts            — Claude API prompt functions
  /utils.ts
/hooks
  /useWords.ts
  /useFeeling.ts
  /useComposer.ts
  /useSavedWords.ts
/store
  /userStore.ts
/types
  /word.ts
  /api.ts
```

---

## 8. Mobile Responsiveness — Full Specification

### Breakpoints

```css
--mobile:   0 – 639px
--tablet:   640px – 1023px
--desktop:  1024px+
```

### Page-by-Page Mobile Behaviour

**Home:**
- Hero: single column (left content full width, word panel becomes horizontal scroll row of mini cards below)
- Stat row: 2×2 grid instead of 4-column row
- Teasers: single column stack
- Ticker: unchanged

**Atlas:**
- Sidebar: collapses into a full-width filter drawer, accessed via "Filters" button
- Family chips strip: unchanged (horizontal scroll)
- Word grid: single column on mobile, 2 columns on tablet

**Word Portrait:**
- Masthead: word size reduces to clamp(2rem, 8vw, 3.5rem)
- Two-column body: single column stack (left panel first, right panel below)
- Cult grid: 1 column on mobile
- Nearby strip: horizontal scroll, unchanged

**Name My Feeling:**
- Two columns → single column: input first, result below
- On submit, page scrolls to result
- Result appears below input, not beside it

**Language Map:**
- Two columns → single column: map takes 60vh, sidebar below as horizontal scroll
- Touch interactions replace hover: tap a node to select it, result appears in bottom drawer
- Zoom via pinch gesture

**Theory:**
- Three columns → single column: rail hidden (scroll progress shown as thin amber top bar instead), TOC sidebar becomes a collapsible drawer
- Essay column: full width

**Composer:**
- Two columns → single column: tabs and editor full width, palette becomes a bottom sheet
- Touch: tap on annotated phrase opens a bottom sheet modal instead of hover popup

**About:**
- Two columns → single column: builder card below main content

### Touch Interaction Overrides

All hover-based interactions must have touch equivalents:
- Hover popups (Composer, Theory inline words): tap to open, tap outside to close, use bottom sheets on mobile
- Hover card reveals: replace with tap
- Hover ticker pause: no mobile equivalent needed

### Mobile Typography Scale

```css
/* Desktop → Mobile reductions */
h1:        clamp(1.8rem, 6vw, 3.1rem)
word name: clamp(2rem, 8vw, 4.2rem)
body:      13px (same)
labels:    7px (down from 7.5–8px)
```

---

## 9. Performance Targets

| Metric | Target |
|---|---|
| Lighthouse Performance | ≥ 90 |
| First Contentful Paint | < 1.5s |
| Largest Contentful Paint | < 2.5s |
| Cumulative Layout Shift | < 0.1 |
| Time to Interactive | < 3.5s |
| API response (Name My Feeling) | < 3s (cached < 0.3s) |

### Performance Strategies
- Next.js static generation for all 212 word portrait pages
- Image optimisation: no images in the design — pure CSS and type
- Font loading: `font-display: swap` for all three Google Fonts
- D3 lazy-loaded only on the Map page
- Claude API responses cached in Redis
- Critical CSS inlined, non-critical deferred

---

## 10. Accessibility

- Semantic HTML throughout: `<nav>`, `<main>`, `<article>`, `<section>`, `<aside>`
- All interactive elements keyboard-navigable
- ARIA labels on icon-only buttons, the pulse indicator, the ticker
- Focus rings visible (amber outline) on all focusable elements
- Colour contrast: all text meets WCAG AA minimum (4.5:1 for body, 3:1 for large text)
- `prefers-reduced-motion`: disable ticker animation and page fade, use instant transitions
- Alt text: no images in the design — no img elements to worry about
- Screen reader: word ticker marked `aria-hidden="true"` (decorative)

---

## 11. The Shareable Image Card (Critical Missing Feature)

This feature is identified as the highest-leverage addition for viral growth.

**Specification:**
- Size: 1080×1080px (Instagram square) + 1080×1920px (Stories)
- Content: Word in Playfair 900 italic (large), language in Space Mono, one-line definition, amber rule, "babel.io" watermark
- Background: `#07060E` with amber grid overlay at 1% opacity
- Generated via: HTML Canvas or `html2canvas` library
- Downloadable as PNG from: every Word Portrait page, every Name My Feeling result
- Copy the card text to clipboard as a second option

---

## 12. Metrics to Track and Report

To address the "no measurable outcomes" critique from technical recruiters:

| Metric | How to measure |
|---|---|
| Name My Feeling match accuracy | Manual review of 50 sample inputs, rate as accurate/inaccurate/close |
| Average API response time | `console.time()` around fetch calls, log to analytics |
| Most searched emotion categories | Log inputs to a `searches` table, aggregate |
| Most viewed words | Page view analytics per word slug |
| Session depth | Average number of pages visited per session |
| Share events | Track "share" / "copy" / "download" button clicks |

Report at least three of these in your README and your LinkedIn post about the project.

---

## 13. What to Build in Version 2

After the MVP is live and deployed:

1. **Backend** — Node/Express + PostgreSQL (as specified above)
2. **User accounts** — Email/password auth, saved word collections
3. **Mobile app** — React Native with the same design system
4. **Word of the Day API** — Public API endpoint others can consume
5. **Community submissions** — Review queue, acceptance workflow
6. **Advanced search** — Trie-based instant search across all 212 words
7. **Recommendation engine** — "If you loved Saudade, you might feel Hiraeth"
8. **Shareable image cards** — As specified above
9. **The cognitive distance algorithm** — Formalise the metric, document the methodology, consider a research paper
10. **Language expansion** — Target 500 words across 80 languages

---

## 14. The Interview Pitch (60-Second Version)

> "Babel is an atlas of untranslatable words — feelings that exist in one language and have no equivalent in English. I built it because I kept having experiences I couldn't name, and I wondered how many other people were carrying feelings they'd never been given words for.
>
> The centrepiece is an AI feature called Name My Feeling — you describe a feeling in plain language, and the system searches 212 words from 43 languages to find the one that fits. I designed the prompt architecture to extract the phenomenology of what you wrote — the sensory texture, emotional register, relational context — before doing semantic matching, which gives much more precise results than keyword matching.
>
> There's also a Composer feature where you write anything and the AI annotates your text with the untranslatable words hidden in your own prose.
>
> The biggest technical challenges were: designing a prompt schema that returns structured JSON I could render as a UI, building the D3.js force-directed network of all 212 words coloured by emotional cluster, and the [backend/algorithm] I added in version two.
>
> Deployed at [URL]. GitHub and a technical README available on request."

---

*Document compiled from full design, critique, and specification sessions. Last updated: July 2026.*
