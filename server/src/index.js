/* Project Babel API — Express + Prisma (spec §6).
   Serves the JSON API under /api and the static frontend from ../site,
   so the whole app runs from one command: `npm start`. */
const path = require("path");
try { process.loadEnvFile(path.resolve(__dirname, "../.env")); } catch { /* .env is optional */ }
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("./db");
const AI = require("./ai");

const PORT = process.env.PORT || 4600;
const JWT_SECRET = process.env.JWT_SECRET || "babel-dev-secret";
const SITE_DIR = path.resolve(__dirname, "../../site");

const app = express();
app.use(cors());
app.use(express.json({ limit: "256kb" }));

/* In-memory copy of all words, loaded once at startup, used by the AI engine
   for fast semantic matching without per-request DB reads. */
let WORD_CACHE = [];
async function loadWordCache() {
  const rows = await prisma.word.findMany({
    select: {
      slug: true, word: true, language: true, native: true, phonetic: true,
      family: true, script: true, category: true, distScore: true,
      intensity: true, defShort: true, defFull: true,
    },
  });
  WORD_CACHE = rows.map((r) => ({ ...r, dist: r.distScore }));
  console.log(`Loaded ${WORD_CACHE.length} words into the AI cache.`);
}

/* ---------- helpers ---------- */
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

function serializeWord(w) {
  return {
    slug: w.slug,
    number: w.number,
    word: w.word,
    language: w.language,
    native: w.native,
    phonetic: w.phonetic,
    family: w.family,
    script: w.script,
    dist: w.distScore,
    intensity: w.intensity,
    category: w.category,
    defShort: w.defShort,
    defFull: w.defFull,
    dimensions: (w.dimensions || []).map((d) => ({ label: d.label, content: d.content })),
    cultures: (w.cultures || []).map((c) => ({ name: c.name, content: c.content })),
    comparisons: (w.comparisons || []).map((c) => ({ lang: c.lang, word: c.comparisonWord, sim: c.similarity })),
    related: (w.related || []).map((r) => r.relatedSlug),
  };
}

function signToken(user) {
  return jwt.sign({ uid: user.id, email: user.email }, JWT_SECRET, { expiresIn: "30d" });
}
function requireAuth(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Authentication required." });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}
/* Like requireAuth, but never blocks the request — used on endpoints that
   should work anonymously and additionally log to a user's account when
   they happen to be signed in (e.g. Name My Feeling search history). */
function optionalAuth(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (token) { try { req.user = jwt.verify(token, JWT_SECRET); } catch { /* treat as anonymous */ } }
  next();
}
function requireAdmin(req, res, next) {
  const key = req.headers["x-admin-key"] || req.query.key;
  const expected = process.env.ADMIN_KEY || "";
  if (!expected || key !== expected) return res.status(403).json({ error: "Admin key required." });
  next();
}
const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/* ---------- submission screening: duplicates + basic validity/ambiguity ----------
   This is automated *screening*, not linguistic fact-checking — it catches
   exact/near-duplicates of existing or already-pending words and rejects
   obviously malformed or too-vague entries. Anything that passes still goes
   to a human review queue (visible on the admin page) before it's added. */
const PLACEHOLDER_WORDS = new Set(["test", "asdf", "lorem", "ipsum", "example", "n/a", "none", "xyz", "abc", "word"]);
function normalizeText(s) {
  return String(s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase().trim().replace(/\s+/g, " ");
}

/* ---------- accuracy screening (automated plausibility, not fact-checking) ----------
   These heuristics don't verify that a word *truly* means what the submitter says
   (only a human/native speaker can) — they catch contributions that clearly aren't
   accurate: keyboard-mash "words", vowel-less gibberish, incoherent explanations,
   and languages we don't recognize (flagged, not rejected, since new languages are
   welcome). Everything that passes still goes to the human review queue. */
const VOWEL = /[aeiouyàáâäãåāèéêëēėęìíîïīòóôöõōøùúûüūæœ]/i;
// Common world languages beyond the ones already in the atlas, so a legitimate
// language name isn't wrongly flagged as unrecognized.
const EXTRA_LANGUAGES = ["english","spanish","french","german","italian","portuguese","dutch","swedish","norwegian","danish","icelandic","finnish","russian","ukrainian","polish","czech","slovak","greek","turkish","arabic","hebrew","persian","farsi","hindi","urdu","bengali","punjabi","tamil","telugu","kannada","malayalam","marathi","gujarati","japanese","korean","mandarin","cantonese","chinese","thai","vietnamese","indonesian","malay","tagalog","filipino","swahili","zulu","xhosa","yoruba","igbo","hausa","amharic","hungarian","romanian","bulgarian","serbian","croatian","bosnian","slovenian","lithuanian","latvian","estonian","welsh","irish","scottish gaelic","catalan","basque","galician","afrikaans","hawaiian","maori","samoan","tongan","nahuatl","quechua","inuktitut","yaghan","georgian","armenian","albanian"];
function knownLanguageSet() {
  const s = new Set(WORD_CACHE.map((w) => normalizeText(w.language)));
  EXTRA_LANGUAGES.forEach((l) => s.add(normalizeText(l)));
  return s;
}
// True when a submitted "word" doesn't look like a plausible real word.
function looksLikeGibberish(word) {
  const s = String(word || "").trim();
  const letters = s.replace(/[^\p{L}]/gu, "");
  if (letters.length < 1) return true;
  // Only Latin-script tokens follow these rules; leave CJK/Arabic/Cyrillic/Indic alone.
  if (!/^[\p{Script=Latin}\s'’\-.·]+$/u.test(s)) return false;
  const low = letters.toLowerCase();
  if (!VOWEL.test(low)) return true;                          // a real word has a vowel
  if (/[bcdfghjklmnpqrstvwxz]{6,}/i.test(low)) return true;   // 6+ consonants in a row
  if (/(.)\1{3,}/i.test(low)) return true;                    // 4+ identical letters running
  if (/(qwert|werty|asdf|sdfg|zxcv|xcvb|hjkl|uiop)/i.test(low)) return true; // keyboard mash
  return false;
}
// True when the explanation reads as coherent prose rather than noise.
function coherentExplanation(why) {
  const words = String(why || "").toLowerCase().match(/[a-zà-ÿ’']{2,}/g) || [];
  if (words.length < 4) return false;                         // too little to judge as accurate
  const wordLike = words.filter((w) => VOWEL.test(w)).length; // vowel-bearing tokens look real
  return wordLike >= Math.max(3, Math.ceil(words.length * 0.6));
}
async function screenSubmission({ word, language, why }) {
  const nWord = normalizeText(word);
  const nLang = normalizeText(language);

  if (!word || !language || !why) return { ok: false, status: "rejected_invalid", note: "Word, language, and an explanation are all required." };
  if (nWord.length < 1 || nWord.length > 60) return { ok: false, status: "rejected_invalid", note: "The word field looks malformed (empty or unreasonably long)." };
  if (/^(.)\1{2,}$/.test(nWord.replace(/\s/g, "")) || PLACEHOLDER_WORDS.has(nWord)) return { ok: false, status: "rejected_invalid", note: "That looks like a placeholder or test entry, not a real word." };
  if (!/^[a-zÀ-ɏͰ-῿　-鿿\-'\s]+$/i.test(language) || nLang.length < 2 || nLang.length > 40) return { ok: false, status: "rejected_invalid", note: "Language name looks invalid — use the language's common English name." };
  if (why.trim().length < 15) return { ok: false, status: "rejected_ambiguous", note: "The explanation is too short to judge — say specifically what gap in English this word fills." };

  // Accuracy screening — reject entries that clearly aren't accurate/real.
  if (looksLikeGibberish(word)) return { ok: false, status: "rejected_inaccurate", note: "That doesn't look like a real word — automated accuracy screening couldn't recognize it as plausible. Check the spelling and the native form." };
  if (!coherentExplanation(why)) return { ok: false, status: "rejected_inaccurate", note: "The explanation doesn't read as a coherent description. In plain sentences, say what the word means and what gap in English it fills." };

  const dupInDb = WORD_CACHE.find((w) => normalizeText(w.word) === nWord && normalizeText(w.language) === nLang);
  if (dupInDb) return { ok: false, status: "rejected_duplicate", note: `Already in the atlas as "${dupInDb.word}" (${dupInDb.language}) — see /word/${dupInDb.slug}.` };

  const pending = await prisma.submission.findMany({ where: { status: { in: ["pending", "flagged"] } } });
  const dupPending = pending.find((s) => normalizeText(s.word) === nWord && normalizeText(s.language) === nLang);
  if (dupPending) return { ok: false, status: "rejected_duplicate", note: "This word has already been submitted and is awaiting review." };

  // Soft accuracy signals — not hard rejections, but flag for a closer human look.
  const reasons = [];
  if (why.trim().length < 40) reasons.push("brief explanation");
  if (!knownLanguageSet().has(nLang)) reasons.push("unrecognized language name — verify it's accurate");
  const flagged = reasons.length > 0;
  return { ok: true, status: flagged ? "flagged" : "pending", note: flagged ? `Queued, flagged for a closer look (${reasons.join("; ")}).` : "" };
}
/* ---------- adding an accepted submission to the atlas database ----------
   When an admin accepts a community submission it becomes a real Word row, so
   the live word count and the matching engine include it immediately. */
function slugify(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "word";
}
async function uniqueSlug(base) {
  let slug = base, i = 2;
  while (await prisma.word.findUnique({ where: { slug } })) slug = `${base}-${i++}`;
  return slug;
}
function guessCategory(text) {
  try {
    const ph = AI.phenomenology(String(text || ""));
    let best = "philos", bestS = -1;
    for (const k in ph.scores) { if (ph.scores[k] > bestS) { bestS = ph.scores[k]; best = k; } }
    return bestS > 0 ? best : "social";
  } catch { return "social"; }
}
async function addWordFromSubmission(sub) {
  const word = String(sub.word || "").trim();
  const language = String(sub.language || "").trim();
  const why = String(sub.why || "").trim();
  if (!word || !language) return null;
  const dup = WORD_CACHE.find((w) => normalizeText(w.word) === normalizeText(word) && normalizeText(w.language) === normalizeText(language));
  if (dup) return null; // already in the atlas
  const slug = await uniqueSlug(slugify(word));
  const agg = await prisma.word.aggregate({ _max: { number: true } });
  const number = (agg._max.number || 0) + 1;
  const isLatin = /^[\p{Script=Latin}\s'’\-.]+$/u.test(word);
  const defShort = why.length > 140 ? why.slice(0, 137).trim() + "…" : why;
  return prisma.word.create({
    data: {
      slug, number, word, language,
      native: "", phonetic: "",
      family: "Community", script: isLatin ? "Latin" : "Non-Latin",
      distScore: 60, intensity: 60,
      category: guessCategory(why + " " + word),
      defShort, defFull: why,
    },
  });
}

async function log(kind, data = {}) {
  try {
    await prisma.searchLog.create({ data: { kind, input: (data.input || "").slice(0, 300), category: data.category || "", bestSlug: data.bestSlug || "" } });
  } catch { /* analytics is best-effort */ }
}

const api = express.Router();

/* ---------- GET /api/words — paginated, filterable, sortable ---------- */
api.get("/words", asyncH(async (req, res) => {
  const { q, family, category, script, band, sort = "dist" } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const per = Math.min(100, Math.max(1, parseInt(req.query.per) || 20));

  const where = {};
  if (family && family !== "All") where.family = family;
  if (category) where.category = category;
  if (script && script !== "All") where.script = script;
  if (band) {
    const [lo, hi] = String(band).split("-").map(Number);
    where.distScore = { gte: lo, lte: hi === 100 ? 100 : hi - 1 };
  }
  if (q) {
    where.OR = ["word", "language", "defShort", "native"].map((f) => ({ [f]: { contains: q } }));
  }
  const orderBy =
    sort === "az" ? { word: "asc" } :
    sort === "num" ? { number: "asc" } :
    sort === "intensity" ? { intensity: "desc" } :
    { distScore: "desc" };

  const total = await prisma.word.count({ where });
  const rows = await prisma.word.findMany({ where, orderBy, skip: (page - 1) * per, take: per });
  res.json({ total, page, per, pages: Math.ceil(total / per), words: rows.map(serializeWord) });
}));

/* ---------- GET /api/words/random — word of the day (deterministic) ---------- */
api.get("/words/random", asyncH(async (req, res) => {
  const total = await prisma.word.count();
  const day = Math.floor(Date.now() / 864e5);
  const offset = req.query.daily === "false" ? Math.floor(Math.random() * total) : day % total;
  const [w] = await prisma.word.findMany({
    include: { dimensions: true, cultures: true, comparisons: true, related: true },
    skip: offset, take: 1, orderBy: { id: "asc" },
  });
  res.json(serializeWord(w));
}));

/* ---------- GET /api/words/all — every word (basic fields, no relations) ----------
   Lightweight list the frontend uses at boot to discover words that exist in
   the database but aren't in the bundled data.js (e.g. admin-accepted ones),
   and to notice deletions — so the atlas, search, and portraits stay in sync
   with the database. Full relations are fetched per-slug via /words/:slug. */
api.get("/words/all", asyncH(async (req, res) => {
  const rows = await prisma.word.findMany({ orderBy: { number: "asc" } });
  res.json(rows.map(serializeWord));
}));

/* ---------- GET /api/words/:slug — full portrait ---------- */
api.get("/words/:slug", asyncH(async (req, res) => {
  const w = await prisma.word.findUnique({
    where: { slug: req.params.slug },
    include: { dimensions: true, cultures: true, comparisons: true, related: true },
  });
  if (!w) return res.status(404).json({ error: "Word not found." });
  await log("view", { bestSlug: w.slug, category: w.category });
  res.json(serializeWord(w));
}));

/* ---------- GET /api/categories — with counts ---------- */
api.get("/categories", asyncH(async (req, res) => {
  const grouped = await prisma.word.groupBy({ by: ["category"], _count: { category: true } });
  const counts = Object.fromEntries(grouped.map((g) => [g.category, g._count.category]));
  const out = Object.entries(AI.CATEGORY_NAMES).map(([key, name]) => ({ key, name, count: counts[key] || 0 }));
  res.json(out);
}));

/* ---------- POST /api/feelings/search — Name My Feeling (cached) ----------
   Auth is optional: anonymous callers get a result with nothing persisted
   to an account; signed-in callers additionally get the search recorded to
   their history (visible on /account). */
api.post("/feelings/search", optionalAuth, asyncH(async (req, res) => {
  const input = (req.body.input || "").trim();
  if (input.length < 4) return res.status(400).json({ error: "Describe the feeling a little more." });
  const started = Date.now();

  const hash = sha256("feeling:" + input.toLowerCase());
  const cached = await prisma.aiCache.findUnique({ where: { inputHash: hash } });
  const result = cached ? JSON.parse(cached.response) : await AI.claudeFeelingSearch(input, WORD_CACHE);
  if (!cached) await prisma.aiCache.create({ data: { inputHash: hash, kind: "feeling", response: JSON.stringify(result) } });

  await log("feeling", { input, bestSlug: result.bestMatch?.slug, category: result.bestMatch?.category });
  if (req.user) {
    await prisma.userSearch.create({
      data: { userId: req.user.uid, input, bestSlug: result.bestMatch?.slug || "", bestWord: result.bestMatch?.word || "", matchScore: result.matchScore || 0 },
    });
  }
  res.json({ ...result, cached: !!cached, responseMs: Date.now() - started });
}));

/* ---------- POST /api/compose/analyse — Composer (cached) ---------- */
api.post("/compose/analyse", asyncH(async (req, res) => {
  const text = (req.body.text || "").trim();
  if (text.length < 8) return res.status(400).json({ error: "Write a little more to analyse." });
  const hash = sha256("compose:" + text.toLowerCase());
  const cached = await prisma.aiCache.findUnique({ where: { inputHash: hash } });
  if (cached) return res.json({ found: JSON.parse(cached.response), cached: true });
  const found = AI.analyseText(text, WORD_CACHE);
  await prisma.aiCache.create({ data: { inputHash: hash, kind: "compose", response: JSON.stringify(found) } });
  await log("compose", { input: text });
  res.json({ found, cached: false });
}));

/* ---------- POST /api/submissions — community word submission ----------
   Screened for duplicates (against the live atlas and the pending queue)
   and basic validity/ambiguity before being queued for human review. */
api.post("/submissions", asyncH(async (req, res) => {
  const { word, language, why, submitter = "", email = "" } = req.body;
  const verdict = await screenSubmission({ word, language, why });

  if (!verdict.ok) {
    await prisma.submission.create({ data: { word: word || "", language: language || "", why: why || "", submitter, email, status: verdict.status, statusNote: verdict.note } });
    return res.status(422).json({ ok: false, error: verdict.note, status: verdict.status });
  }

  const sub = await prisma.submission.create({ data: { word, language, why, submitter, email, status: verdict.status, statusNote: verdict.note } });
  const queued = await prisma.submission.count({ where: { status: { in: ["pending", "flagged"] } } });
  res.status(201).json({ ok: true, id: sub.id, queued, flagged: verdict.status === "flagged", note: verdict.note });
}));

/* ---------- Auth ---------- */
api.post("/auth/register", asyncH(async (req, res) => {
  const email = (req.body.email || "").trim().toLowerCase();
  const name = (req.body.name || "").trim().slice(0, 80);
  const password = req.body.password || "";
  if (!name) return res.status(400).json({ error: "Please enter your name." });
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: "Please enter a valid email address." });
  if (password.length < 4) return res.status(400).json({ error: "Password must be at least 4 characters." });
  if (await prisma.user.findUnique({ where: { email } })) return res.status(409).json({ error: "Account already exists." });
  const user = await prisma.user.create({ data: { email, name, passwordHash: await bcrypt.hash(password, 10) } });
  res.status(201).json({ token: signToken(user), user: { email: user.email, name: user.name } });
}));

api.post("/auth/login", asyncH(async (req, res) => {
  const email = (req.body.email || "").trim().toLowerCase();
  const password = req.body.password || "";
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash)))
    return res.status(401).json({ error: "Invalid credentials." });
  res.json({ token: signToken(user), user: { email: user.email, name: user.name } });
}));

/* ---------- Account management (auth required) ---------- */
api.get("/user/me", requireAuth, asyncH(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.uid }, select: { email: true, name: true, createdAt: true } });
  if (!user) return res.status(404).json({ error: "Account not found." });
  res.json(user);
}));

api.patch("/user/me", requireAuth, asyncH(async (req, res) => {
  const data = {};
  if (typeof req.body.name === "string" && req.body.name.trim()) data.name = req.body.name.trim().slice(0, 80);
  if (typeof req.body.password === "string" && req.body.password.length) {
    if (req.body.password.length < 4) return res.status(400).json({ error: "Password must be at least 4 characters." });
    data.passwordHash = await bcrypt.hash(req.body.password, 10);
  }
  if (!Object.keys(data).length) return res.status(400).json({ error: "Nothing to update." });
  const user = await prisma.user.update({ where: { id: req.user.uid }, data, select: { email: true, name: true } });
  res.json({ ok: true, user });
}));

api.delete("/user/me", requireAuth, asyncH(async (req, res) => {
  await prisma.user.delete({ where: { id: req.user.uid } }); // cascades saved words/cards/searches
  res.json({ ok: true });
}));

/* ---------- User saved words (auth required) ---------- */
api.get("/user/saved", requireAuth, asyncH(async (req, res) => {
  const rows = await prisma.savedWord.findMany({
    where: { userId: req.user.uid },
    include: { word: true },
    orderBy: { savedAt: "desc" },
  });
  res.json(rows.map((r) => serializeWord(r.word)));
}));

api.post("/user/saved/:slug", requireAuth, asyncH(async (req, res) => {
  const word = await prisma.word.findUnique({ where: { slug: req.params.slug } });
  if (!word) return res.status(404).json({ error: "Word not found." });
  await prisma.savedWord.upsert({
    where: { userId_wordId: { userId: req.user.uid, wordId: word.id } },
    create: { userId: req.user.uid, wordId: word.id },
    update: {},
  });
  res.json({ ok: true, saved: true });
}));

api.delete("/user/saved/:slug", requireAuth, asyncH(async (req, res) => {
  const word = await prisma.word.findUnique({ where: { slug: req.params.slug } });
  if (!word) return res.status(404).json({ error: "Word not found." });
  await prisma.savedWord.deleteMany({ where: { userId: req.user.uid, wordId: word.id } });
  res.json({ ok: true, saved: false });
}));

/* ---------- User search history (auth required) ---------- */
api.get("/user/history", requireAuth, asyncH(async (req, res) => {
  const rows = await prisma.userSearch.findMany({
    where: { userId: req.user.uid },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json(rows.map((r) => ({ id: r.id, input: r.input, bestSlug: r.bestSlug, bestWord: r.bestWord, matchScore: r.matchScore, at: r.createdAt })));
}));

/* ---------- User saved image cards (auth required) ----------
   Only the word slug + source are stored; the PNG is regenerated
   client-side from the word's data whenever it's viewed or re-downloaded. */
api.get("/user/cards", requireAuth, asyncH(async (req, res) => {
  const rows = await prisma.savedCard.findMany({
    where: { userId: req.user.uid },
    include: { word: true },
    orderBy: { savedAt: "desc" },
  });
  res.json(rows.map((r) => ({ ...serializeWord(r.word), source: r.source, savedAt: r.savedAt })));
}));

api.post("/user/cards/:slug", requireAuth, asyncH(async (req, res) => {
  const word = await prisma.word.findUnique({ where: { slug: req.params.slug } });
  if (!word) return res.status(404).json({ error: "Word not found." });
  const source = ["portrait", "feeling", "compose"].includes(req.body.source) ? req.body.source : "portrait";
  await prisma.savedCard.upsert({
    where: { userId_wordId_source: { userId: req.user.uid, wordId: word.id, source } },
    create: { userId: req.user.uid, wordId: word.id, source },
    update: {},
  });
  res.json({ ok: true, saved: true });
}));

api.delete("/user/cards/:slug", requireAuth, asyncH(async (req, res) => {
  const word = await prisma.word.findUnique({ where: { slug: req.params.slug } });
  if (!word) return res.status(404).json({ error: "Word not found." });
  await prisma.savedCard.deleteMany({ where: { userId: req.user.uid, wordId: word.id } });
  res.json({ ok: true, saved: false });
}));

/* ---------- Admin (spec item: user metrics visible to the admin) ----------
   Gated by a shared secret (ADMIN_KEY in .env) sent as the x-admin-key
   header — there's no multi-role user system, so this is a simple,
   honest gate rather than fake RBAC. */
api.get("/admin/metrics", requireAdmin, asyncH(async (req, res) => {
  const byKind = await prisma.searchLog.groupBy({ by: ["kind"], _count: { kind: true } });
  const topCats = await prisma.searchLog.groupBy({
    by: ["category"], where: { kind: "feeling", category: { not: "" } },
    _count: { category: true }, orderBy: { _count: { category: "desc" } }, take: 7,
  });
  const topViews = await prisma.searchLog.groupBy({
    by: ["bestSlug"], where: { kind: "view", bestSlug: { not: "" } },
    _count: { bestSlug: true }, orderBy: { _count: { bestSlug: "desc" } }, take: 10,
  });
  const submissionsByStatus = await prisma.submission.groupBy({ by: ["status"], _count: { status: true } });
  const recentUsers = await prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 10, select: { email: true, createdAt: true } });
  res.json({
    words: await prisma.word.count(),
    users: await prisma.user.count(),
    recentUsers,
    savedWords: await prisma.savedWord.count(),
    savedCards: await prisma.savedCard.count(),
    sharedCards: await prisma.searchLog.count({ where: { kind: "share_card" } }),
    userSearches: await prisma.userSearch.count(),
    cachedAiResponses: await prisma.aiCache.count(),
    events: Object.fromEntries(byKind.map((k) => [k.kind, k._count.kind])),
    mostSearchedCategories: topCats.map((c) => ({ category: c.category, name: AI.CATEGORY_NAMES[c.category], count: c._count.category })),
    mostViewedWords: topViews.map((v) => ({ slug: v.bestSlug, views: v._count.bestSlug })),
    submissionsByStatus: Object.fromEntries(submissionsByStatus.map((s) => [s.status, s._count.status])),
  });
}));

api.get("/admin/submissions", requireAdmin, asyncH(async (req, res) => {
  const status = req.query.status;
  const rows = await prisma.submission.findMany({
    where: status ? { status } : {},
    orderBy: { submittedAt: "desc" },
    take: 200,
  });
  res.json(rows);
}));

api.post("/admin/submissions/:id/:action", requireAdmin, asyncH(async (req, res) => {
  const action = req.params.action;
  if (!["accept", "reject"].includes(action)) return res.status(400).json({ error: "action must be accept or reject." });
  const existing = await prisma.submission.findUnique({ where: { id: Number(req.params.id) } });
  if (!existing) return res.status(404).json({ error: "Submission not found." });

  let addedWord = null;
  if (action === "accept") {
    // Accepting a submission actually ADDS it to the atlas database, so the live
    // word count (GET /api/health → words) reflects it everywhere on the site.
    addedWord = await addWordFromSubmission(existing);
  }
  const sub = await prisma.submission.update({
    where: { id: existing.id },
    data: { status: action === "accept" ? "accepted" : "rejected_invalid" },
  });
  if (addedWord) await loadWordCache(); // refresh the in-memory AI/screening cache
  res.json({ ok: true, submission: sub, added: addedWord ? { slug: addedWord.slug, word: addedWord.word } : null, wordCount: await prisma.word.count() });
}));

/* Admin: delete a word from the atlas database. Cascades its dimensions/etc.
   and refreshes the cache, so the live word count drops accordingly. */
api.delete("/admin/words/:slug", requireAdmin, asyncH(async (req, res) => {
  const word = await prisma.word.findUnique({ where: { slug: req.params.slug } });
  if (!word) return res.status(404).json({ error: "Word not found." });
  await prisma.word.delete({ where: { slug: req.params.slug } });
  await loadWordCache();
  res.json({ ok: true, deleted: req.params.slug, wordCount: await prisma.word.count() });
}));

/* ---------- Analytics (spec §12, public summary) ---------- */
api.get("/analytics", asyncH(async (req, res) => {
  const byKind = await prisma.searchLog.groupBy({ by: ["kind"], _count: { kind: true } });
  const topCats = await prisma.searchLog.groupBy({
    by: ["category"], where: { kind: "feeling", category: { not: "" } },
    _count: { category: true }, orderBy: { _count: { category: "desc" } }, take: 7,
  });
  const topViews = await prisma.searchLog.groupBy({
    by: ["bestSlug"], where: { kind: "view", bestSlug: { not: "" } },
    _count: { bestSlug: true }, orderBy: { _count: { bestSlug: "desc" } }, take: 10,
  });
  res.json({
    events: Object.fromEntries(byKind.map((k) => [k.kind, k._count.kind])),
    mostSearchedCategories: topCats.map((c) => ({ category: c.category, name: AI.CATEGORY_NAMES[c.category], count: c._count.category })),
    mostViewedWords: topViews.map((v) => ({ slug: v.bestSlug, views: v._count.bestSlug })),
    cachedAiResponses: await prisma.aiCache.count(),
    users: await prisma.user.count(),
    submissions: await prisma.submission.count(),
  });
}));

/* ---------- share/event logging (spec §12) ---------- */
api.post("/events", asyncH(async (req, res) => {
  await log(req.body.event || "event", { input: req.body.slug || "" , bestSlug: req.body.slug || "" });
  res.json({ ok: true });
}));

api.get("/health", asyncH(async (req, res) => {
  res.json({ ok: true, words: await prisma.word.count(), aiEngine: process.env.ANTHROPIC_API_KEY ? "claude" : "offline" });
}));

/* ---------- benchmark metrics (spec §12 — real, measured numbers) ----------
   Backed by results/metrics.json, produced by scripts/benchmark.js running
   50 independently-authored inputs against this same engine. Not fabricated. */
api.get("/metrics/benchmark", asyncH(async (req, res) => {
  try {
    const file = path.resolve(__dirname, "../results/metrics.json");
    const data = JSON.parse(require("fs").readFileSync(file, "utf8"));
    res.json({ generatedAt: data.generatedAt, sampleSize: data.sampleSize, categoryMatchRate: data.categoryMatchRate, avgMatchScore: data.avgMatchScore, avgResponseMs: data.avgResponseMs, methodology: data.methodology });
  } catch {
    res.status(404).json({ error: "No benchmark has been run yet." });
  }
}));

// Load the in-memory word cache once per process (a cold start, on serverless);
// API requests wait for it so the first request after boot is never empty.
const ready = loadWordCache().catch((e) => console.error("word cache load failed:", e));
app.use("/api", (req, res, next) => { ready.then(() => next()).catch(next); });
app.use("/api", api);

/* ---------- serve the static frontend ---------- */
app.use(express.static(SITE_DIR));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(SITE_DIR, "index.html"));
});

/* ---------- error handler ---------- */
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error." });
});

// Local dev: start a listening server. On Vercel the app is imported by
// api/index.js and invoked per-request, so it must NOT call listen() there.
if (require.main === module) {
  ready
    .then(() => app.listen(PORT, () => console.log(`Babel API + site running at http://localhost:${PORT}`)))
    .catch((e) => { console.error("Failed to start:", e); process.exit(1); });
}
module.exports = app;
