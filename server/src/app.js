/* Builds the Express app from its dependencies. Nothing here reads the
   environment or opens a connection, so tests can build an app around an
   in-memory store and a scripted network. */
const fs = require("fs");
const path = require("path");
const express = require("express");
const { createRateLimiter, DAY } = require("./rateLimit");
const { createAuth } = require("./auth");
const { createClaudeClient } = require("./claude");
const { createScreening } = require("./screening");
const { publicRoutes } = require("./routes/public");
const { accountRoutes } = require("./routes/account");
const { adminRoutes } = require("./routes/admin");
const security = require("./security");

const JSON_BODY_LIMIT = "100kb";
// Serverless instances each keep their own copy of the word list, so a copy
// older than this is reloaded; a word added or removed on one instance reaches
// the others within this window.
const WORD_CACHE_TTL_MS = 60 * 1000;
const WEB_DIST = path.resolve(__dirname, "../../web/dist");

function createWordCache(prisma, now) {
  let words = [];
  let loadedAt = 0;
  async function reload() {
    const rows = await prisma.word.findMany({
      select: {
        slug: true, word: true, language: true, native: true, phonetic: true,
        family: true, script: true, category: true, distScore: true,
        intensity: true, defShort: true, defFull: true,
        // The matcher also reads two of the portrait notes as supporting text.
        dimensions: { select: { label: true, content: true } },
      },
    });
    words = rows.map(({ dimensions, ...r }) => {
      const note = (label) => (dimensions || []).find((d) => d.label === label)?.content || "";
      return { ...r, dist: r.distScore, dims: { english: note("Nearest in English"), cognitive: note("Cognitive Science") } };
    });
    loadedAt = now();
  }
  async function ensureFresh() {
    if (!loadedAt || now() - loadedAt > WORD_CACHE_TTL_MS) await reload();
  }
  return { reload, ensureFresh, words: () => words };
}

function createApp({ prisma, config, fetchImpl = fetch, now = () => Date.now(), webDist = WEB_DIST }) {
  const limiter = createRateLimiter({ prisma, secret: config.jwtSecret, now, overrides: { claudeDaily: { limit: config.claudeDailyCap, windowMs: DAY } } });
  const callClaude = createClaudeClient({ apiKey: config.anthropicApiKey, model: config.anthropicModel, fetchImpl });
  const wordCache = createWordCache(prisma, now);

  function limit(scope, idOf = (req) => security.clientIp(req, config)) {
    return async (req, res, next) => {
      try {
        const result = await limiter.hit(scope, idOf(req));
        if (result.allowed) return next();
        res.setHeader("Retry-After", String(result.retryAfter));
        security.sendError(res, 429, "Too many requests. Please try again later.");
      } catch (e) { next(e); }
    };
  }

  const ctx = {
    prisma,
    config,
    now,
    limiter,
    limit,
    wordCache,
    auth: createAuth({ prisma, config }),
    screening: createScreening({ prisma, getWords: wordCache.words, fetchImpl, callClaude }),
    analytics: {
      // Records what happened, never what the visitor typed.
      async log(kind, data = {}) {
        try {
          await prisma.searchLog.create({ data: { kind, input: "", category: data.category || "", bestSlug: data.bestSlug || "" } });
        } catch (e) {
          console.warn(JSON.stringify({ event: "analytics_write_failed", code: e.code || e.name }));
        }
      },
    },
    /* Claude is used only while both the per-visitor and the daily budget
       allow it; otherwise the caller runs the offline engine. */
    async claudeFor(req) {
      if (!callClaude) return null;
      const perVisitor = await limiter.hit("claude", security.clientIp(req, config));
      if (!perVisitor.allowed) return null;
      const daily = await limiter.hit("claudeDaily", "all");
      return daily.allowed ? callClaude : null;
    },
  };

  const app = express();
  app.disable("x-powered-by");

  app.use("/api", security.apiHeaders, security.csrfGuard, express.json({ limit: JSON_BODY_LIMIT }));
  app.use("/api", (req, res, next) => wordCache.ensureFresh().then(() => next(), next));
  app.use("/api", publicRoutes(ctx), accountRoutes(ctx), adminRoutes(ctx));
  app.use("/api", (req, res) => security.sendError(res, 404, "Not found."));

  // Local runs serve the built React app with the same headers as production.
  if (fs.existsSync(webDist)) app.use(security.pageHeaders(security.loadPageHeaders()), express.static(webDist));

  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err.type === "entity.too.large") return security.sendError(res, 413, "Request body is too large.");
    if (err.type === "entity.parse.failed") return security.sendError(res, 400, "Request body is not valid JSON.");
    if (err.status >= 400 && err.status < 500) return security.sendError(res, err.status, "Bad request.");
    console.error(JSON.stringify({ event: "request_failed", method: req.method, path: req.path, error: err.name, code: err.code }));
    security.sendError(res, 500, "Internal server error.");
  });

  return { app, ctx };
}

module.exports = { createApp };
