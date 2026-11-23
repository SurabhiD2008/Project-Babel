/* Public routes: browsing words, the two matching features, community
   submissions, client events, health and benchmark numbers. */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const AI = require("../ai");
const { bodies, queries, params, validate } = require("../schemas");
const { sendError } = require("../security");
const { serializeWord } = require("../serializers");
const { asyncRouter } = require("../asyncRouter");

/* Bump when the matching engine or its output format changes, so cached
   responses from the old version are never served. */
const AI_CACHE_VERSION = "v4-escaped-output";
const BENCHMARK_FILE = path.resolve(__dirname, "../../results/metrics.json");
const WORD_RELATIONS = { dimensions: true, cultures: true, comparisons: true, related: true };

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

function publicRoutes(ctx) {
  const { prisma, wordCache, limit, auth, screening, analytics } = ctx;
  const api = asyncRouter();

  /* Reads a cached engine answer, or computes and stores one. A concurrent
     request that stored the same answer first is not an error. */
  async function cachedAnswer(hash, kind, compute, shouldStore = () => true) {
    const cached = await prisma.aiCache.findUnique({ where: { inputHash: hash } });
    if (cached) return { value: JSON.parse(cached.response), cached: true };
    const value = await compute();
    if (!shouldStore(value)) return { value, cached: false };
    try {
      await prisma.aiCache.create({ data: { inputHash: hash, kind, response: JSON.stringify(value) } });
    } catch (e) {
      if (e.code !== "P2002") throw e;
    }
    return { value, cached: false };
  }

  api.get("/words", validate("query", queries.words), async (req, res) => {
    const { q, family, category, script, band, sort, page, per } = req.query;
    const where = {};
    if (family && family !== "All") where.family = family;
    if (category) where.category = category;
    if (script && script !== "All") where.script = script;
    if (band) where.distScore = { gte: band[0], lte: band[1] === 100 ? 100 : band[1] - 1 };
    if (q) where.OR = ["word", "language", "defShort", "native"].map((f) => ({ [f]: { contains: q, mode: "insensitive" } }));
    const orderBy = sort === "az" ? { word: "asc" } : sort === "num" ? { number: "asc" } : sort === "intensity" ? { intensity: "desc" } : { distScore: "desc" };
    const total = await prisma.word.count({ where });
    const rows = await prisma.word.findMany({ where, orderBy, skip: (page - 1) * per, take: per });
    res.json({ total, page, per, pages: Math.ceil(total / per), words: rows.map(serializeWord) });
  });

  api.get("/words/random", validate("query", queries.random), async (req, res) => {
    const total = await prisma.word.count();
    if (!total) return sendError(res, 404, "No words yet.");
    const offset = req.query.daily === "false" ? crypto.randomInt(total) : Math.floor(ctx.now() / 864e5) % total;
    const [w] = await prisma.word.findMany({ include: WORD_RELATIONS, skip: offset, take: 1, orderBy: { id: "asc" } });
    res.json(serializeWord(w));
  });

  /* Every word without relations: the frontend uses it at boot to pick up words
     added or removed since its bundled copy was built. */
  api.get("/words/all", async (req, res) => {
    const rows = await prisma.word.findMany({ orderBy: { number: "asc" } });
    res.json(rows.map(serializeWord));
  });

  api.get("/words/:slug", validate("params", params.slug), async (req, res) => {
    const w = await prisma.word.findUnique({ where: { slug: req.params.slug }, include: WORD_RELATIONS });
    if (!w) return sendError(res, 404, "Word not found.");
    await analytics.log("view", { bestSlug: w.slug, category: w.category });
    res.json(serializeWord(w));
  });

  api.get("/categories", async (req, res) => {
    const grouped = await prisma.word.groupBy({ by: ["category"], _count: { category: true } });
    const counts = Object.fromEntries(grouped.map((g) => [g.category, g._count.category]));
    res.json(Object.entries(AI.CATEGORY_NAMES).map(([key, name]) => ({ key, name, count: counts[key] || 0 })));
  });

  api.post("/feelings/search", limit("search"), limit("searchDaily", () => "all"), auth.optionalAuth, validate("body", bodies.feeling), async (req, res) => {
    const input = req.body.input;
    const started = ctx.now();
    // Answers are cached per engine. With Claude configured, an offline answer
    // (budget spent or call failed) is returned but not cached, so the same
    // input gets a Claude answer once the budget allows.
    const engine = ctx.config.anthropicApiKey ? "claude" : "offline";
    const hash = sha256(`feeling:${AI_CACHE_VERSION}:${engine}:` + input.toLowerCase());
    const { value: result, cached } = await cachedAnswer(
      hash,
      "feeling",
      async () => AI.claudeFeelingSearch(input, wordCache.words(), { callClaude: await ctx.claudeFor(req), model: ctx.config.anthropicModel }),
      (r) => r.engine.startsWith(engine),
    );

    await analytics.log("feeling", { bestSlug: result.bestMatch?.slug, category: result.bestMatch?.category });
    if (req.user) {
      await prisma.userSearch.create({
        data: { userId: req.user.uid, input: input.slice(0, 300), bestSlug: result.bestMatch?.slug || "", bestWord: result.bestMatch?.word || "", matchScore: result.matchScore || 0 },
      });
    }
    res.json({ ...result, cached, responseMs: ctx.now() - started });
  });

  api.post("/compose/analyse", limit("search"), limit("searchDaily", () => "all"), validate("body", bodies.compose), async (req, res) => {
    const text = req.body.text;
    const { value: found, cached } = await cachedAnswer(sha256(`compose:${AI_CACHE_VERSION}:` + text.toLowerCase()), "compose", () => AI.analyseText(text, wordCache.words()));
    if (!cached) await analytics.log("compose");
    res.json({ found, cached });
  });

  /* Screened for duplicates, plausibility and meaning, then queued for human
     review. Schema failures answer 422 like screening refusals, because the
     client shows that message to the contributor. */
  api.post("/submissions", limit("submission"), limit("submissionDaily", () => "all"), validate("body", bodies.submission, 422), async (req, res) => {
    const { word, language, why, submitter, email } = req.body;
    const verdict = await screening.screenSubmission({ word, language, why });
    if (!verdict.ok) {
      // Refusals are kept so moderators can see what screening turned away.
      await prisma.submission.create({ data: { word, language, why, submitter, email, status: verdict.status, statusNote: verdict.note } });
      return res.status(422).json({ ok: false, error: verdict.note, status: verdict.status });
    }
    const sub = await prisma.submission.create({ data: { word, language, why, submitter, email, status: verdict.status, statusNote: verdict.note } });
    const queued = await prisma.submission.count({ where: { status: { in: ["pending", "flagged"] } } });
    res.status(201).json({ ok: true, id: sub.id, queued, flagged: verdict.status === "flagged", note: verdict.note });
  });

  api.post("/events", limit("event"), validate("body", bodies.event), async (req, res) => {
    await analytics.log(req.body.event, { bestSlug: req.body.slug });
    res.json({ ok: true });
  });

  api.get("/health", (req, res) => res.json({ status: "ok" }));

  /* Measured numbers produced by scripts/benchmark.js. */
  api.get("/metrics/benchmark", (req, res) => {
    let data;
    try { data = JSON.parse(fs.readFileSync(BENCHMARK_FILE, "utf8")); } catch { return sendError(res, 404, "No benchmark has been run yet."); }
    res.json({ generatedAt: data.generatedAt, sampleSize: data.sampleSize, categoryMatchRate: data.categoryMatchRate, avgMatchScore: data.avgMatchScore, avgResponseMs: data.avgResponseMs, methodology: data.methodology });
  });

  return api;
}

module.exports = { publicRoutes, AI_CACHE_VERSION };
