/* Admin routes, gated by the shared ADMIN_KEY sent in the x-admin-key header.
   The key is never read from the URL, where it would end up in logs and
   browser history. */
const { queries, params, validate } = require("../schemas");
const { sendError, clientIp, safeEqual } = require("../security");
const { serializeSubmissionForAdmin } = require("../serializers");
const { addWordFromSubmission } = require("../screening");
const { asyncRouter } = require("../asyncRouter");
const AI = require("../ai");

const OPEN_STATUSES = ["pending", "flagged"];

function adminRoutes(ctx) {
  const { prisma, config, limiter, wordCache } = ctx;
  const api = asyncRouter();

  /* Attempts are counted before the key is compared, so parallel guesses
     cannot exceed the limit; a correct key clears the count. */
  async function requireAdmin(req, res, next) {
    const ip = clientIp(req, config);
    const attempt = await limiter.hit("adminFailures", ip);
    if (!attempt.allowed) {
      res.setHeader("Retry-After", String(attempt.retryAfter));
      return sendError(res, 429, "Too many attempts. Try again later.");
    }
    const key = req.get("x-admin-key") || "";
    if (!config.adminKey || !key || !safeEqual(key, config.adminKey)) return sendError(res, 401, "Admin key required.");
    await limiter.reset("adminFailures", ip);
    next();
  }

  async function usageSummary() {
    const byKind = await prisma.searchLog.groupBy({ by: ["kind"], _count: { kind: true } });
    const topCats = await prisma.searchLog.groupBy({
      by: ["category"], where: { kind: "feeling", category: { not: "" } },
      _count: { category: true }, orderBy: { _count: { category: "desc" } }, take: 7,
    });
    const topViews = await prisma.searchLog.groupBy({
      by: ["bestSlug"], where: { kind: "view", bestSlug: { not: "" } },
      _count: { bestSlug: true }, orderBy: { _count: { bestSlug: "desc" } }, take: 10,
    });
    return {
      events: Object.fromEntries(byKind.map((k) => [k.kind, k._count.kind])),
      mostSearchedCategories: topCats.map((c) => ({ category: c.category, name: AI.CATEGORY_NAMES[c.category], count: c._count.category })),
      mostViewedWords: topViews.map((v) => ({ slug: v.bestSlug, views: v._count.bestSlug })),
      cachedAiResponses: await prisma.aiCache.count(),
      users: await prisma.user.count(),
    };
  }

  api.get("/admin/metrics", requireAdmin, async (req, res) => {
    const submissionsByStatus = await prisma.submission.groupBy({ by: ["status"], _count: { status: true } });
    res.json({
      ...(await usageSummary()),
      words: await prisma.word.count(),
      savedWords: await prisma.savedWord.count(),
      savedCards: await prisma.savedCard.count(),
      sharedCards: await prisma.searchLog.count({ where: { kind: "share_card" } }),
      userSearches: await prisma.userSearch.count(),
      submissionsByStatus: Object.fromEntries(submissionsByStatus.map((s) => [s.status, s._count.status])),
    });
  });

  api.get("/analytics", requireAdmin, async (req, res) => {
    res.json({ ...(await usageSummary()), submissions: await prisma.submission.count() });
  });

  api.get("/admin/submissions", requireAdmin, validate("query", queries.adminSubmissions), async (req, res) => {
    const rows = await prisma.submission.findMany({ where: req.query.status ? { status: req.query.status } : {}, orderBy: { submittedAt: "desc" }, take: 200 });
    res.json(rows.map(serializeSubmissionForAdmin));
  });

  /* Only an open submission can be decided, and the status change is a
     conditional write: of two moderators acting at once, one wins and the
     other gets 409. Accepting adds the word in the same transaction. */
  api.post("/admin/submissions/:id/:action", requireAdmin, validate("params", params.adminAction), async (req, res) => {
    const { id, action } = req.params;
    const outcome = await prisma.$transaction(async (tx) => {
      const sub = await tx.submission.findUnique({ where: { id } });
      if (!sub) return { status: 404 };
      const claimed = await tx.submission.updateMany({
        where: { id, status: { in: OPEN_STATUSES } },
        data: { status: action === "accept" ? "accepted" : "rejected_invalid", statusNote: action === "accept" ? "Accepted by a moderator." : "Rejected by a moderator." },
      });
      if (claimed.count === 0) return { status: 409, current: sub.status };
      const added = action === "accept" ? await addWordFromSubmission(tx, sub) : null;
      return { status: 200, added };
    });
    if (outcome.status === 404) return sendError(res, 404, "Submission not found.");
    if (outcome.status === 409) return sendError(res, 409, "This submission has already been decided.", { status: outcome.current });
    if (outcome.added) await wordCache.reload();
    res.json({ ok: true, added: outcome.added ? { slug: outcome.added.slug, word: outcome.added.word } : null, wordCount: await prisma.word.count() });
  });

  api.delete("/admin/words/:slug", requireAdmin, validate("params", params.slug), async (req, res) => {
    const removed = await prisma.word.deleteMany({ where: { slug: req.params.slug } });
    if (removed.count === 0) return sendError(res, 404, "Word not found.");
    await wordCache.reload();
    res.json({ ok: true, deleted: req.params.slug, wordCount: await prisma.word.count() });
  });

  return api;
}

module.exports = { adminRoutes };
