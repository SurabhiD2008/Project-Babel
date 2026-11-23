/* Sign-up, sign-in, sign-out and everything a signed-in user owns: their
   profile, saved words, saved image cards and search history. */
const { bodies, params, validate } = require("../schemas");
const { sendError, clientIp } = require("../security");
const { serializeWord, serializeAccount, serializeProfile } = require("../serializers");
const { asyncRouter } = require("../asyncRouter");

// One message for every refused registration, so the response does not say
// whether the email already has an account.
const REGISTER_REFUSED = "We couldn't create an account with those details. If you already have one, sign in instead.";
const LOGIN_REFUSED = "Invalid email or password.";

function accountRoutes(ctx) {
  const { prisma, config, auth, limit, limiter } = ctx;
  const api = asyncRouter();
  const ownerLimit = limit("account", (req) => `user:${req.user.uid}`);

  api.post("/auth/register", limit("register"), validate("body", bodies.register), async (req, res) => {
    const { email, name, password } = req.body;
    let user;
    try {
      user = await prisma.user.create({ data: { email, name, passwordHash: await auth.hashPassword(password) } });
    } catch (e) {
      if (e.code === "P2002") return sendError(res, 409, REGISTER_REFUSED);
      throw e;
    }
    auth.issueSession(res, user);
    res.status(201).json({ user: serializeAccount(user) });
  });

  /* Each attempt is counted before the password is checked, so a burst of
     parallel guesses cannot slip past the limit; a successful sign-in clears
     the count, so only failures add up. Keyed by account and address. */
  api.post("/auth/login", validate("body", bodies.login), async (req, res) => {
    const { email, password } = req.body;
    const lockKey = `${email}|${clientIp(req, config)}`;
    const attempt = await limiter.hit("loginFailures", lockKey);
    if (!attempt.allowed) {
      res.setHeader("Retry-After", String(attempt.retryAfter));
      return sendError(res, 429, "Too many failed sign-in attempts. Try again later.");
    }
    const user = await prisma.user.findUnique({ where: { email } });
    const ok = await auth.checkPassword(password, user?.passwordHash);
    if (!user || !ok) return sendError(res, 401, LOGIN_REFUSED);
    await limiter.reset("loginFailures", lockKey);
    if (auth.needsRehash(user.passwordHash)) {
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await auth.hashPassword(password) } });
    }
    auth.issueSession(res, user);
    res.json({ user: serializeAccount(user) });
  });

  api.post("/auth/logout", (req, res) => {
    auth.clearSession(res);
    res.status(204).end();
  });

  api.get("/user/me", auth.requireAuth, async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.uid }, select: { email: true, name: true, createdAt: true } });
    if (!user) return sendError(res, 404, "Account not found.");
    res.json(serializeProfile(user));
  });

  /* A new password needs the current one, and ends every other session. */
  api.patch("/user/me", auth.requireAuth, ownerLimit, validate("body", bodies.updateMe), async (req, res) => {
    const data = {};
    if (req.body.name !== undefined) data.name = req.body.name;
    if (req.body.password !== undefined) {
      const current = await prisma.user.findUnique({ where: { id: req.user.uid }, select: { passwordHash: true } });
      if (!current || !(await auth.checkPassword(req.body.currentPassword, current.passwordHash))) return sendError(res, 403, "Your current password is not correct.");
      data.passwordHash = await auth.hashPassword(req.body.password);
      data.sessionVersion = { increment: 1 };
    }
    const user = await prisma.user.update({ where: { id: req.user.uid }, data });
    if (data.passwordHash) auth.issueSession(res, user);
    res.json({ ok: true, user: serializeAccount(user) });
  });

  api.delete("/user/me", auth.requireAuth, ownerLimit, async (req, res) => {
    await prisma.user.delete({ where: { id: req.user.uid } }); // cascades saved words, cards and searches
    auth.clearSession(res);
    res.json({ ok: true });
  });

  async function wordBySlug(req, res) {
    const word = await prisma.word.findUnique({ where: { slug: req.params.slug } });
    if (!word) sendError(res, 404, "Word not found.");
    return word;
  }

  api.get("/user/saved", auth.requireAuth, async (req, res) => {
    const rows = await prisma.savedWord.findMany({ where: { userId: req.user.uid }, include: { word: true }, orderBy: { savedAt: "desc" }, take: 500 });
    res.json(rows.map((r) => serializeWord(r.word)));
  });

  api.post("/user/saved/:slug", auth.requireAuth, validate("params", params.slug), validate("body", bodies.empty), async (req, res) => {
    const word = await wordBySlug(req, res);
    if (!word) return;
    const key = { userId: req.user.uid, wordId: word.id };
    await prisma.savedWord.upsert({ where: { userId_wordId: key }, create: key, update: {} });
    res.json({ ok: true, saved: true });
  });

  api.delete("/user/saved/:slug", auth.requireAuth, validate("params", params.slug), async (req, res) => {
    const word = await wordBySlug(req, res);
    if (!word) return;
    await prisma.savedWord.deleteMany({ where: { userId: req.user.uid, wordId: word.id } });
    res.json({ ok: true, saved: false });
  });

  api.get("/user/history", auth.requireAuth, async (req, res) => {
    const rows = await prisma.userSearch.findMany({ where: { userId: req.user.uid }, orderBy: { createdAt: "desc" }, take: 100 });
    res.json(rows.map((r) => ({ id: r.id, input: r.input, bestSlug: r.bestSlug, bestWord: r.bestWord, matchScore: r.matchScore, at: r.createdAt })));
  });

  /* Only the word and source are stored; the image is redrawn in the browser. */
  api.get("/user/cards", auth.requireAuth, async (req, res) => {
    const rows = await prisma.savedCard.findMany({ where: { userId: req.user.uid }, include: { word: true }, orderBy: { savedAt: "desc" }, take: 500 });
    res.json(rows.map((r) => ({ ...serializeWord(r.word), source: r.source, savedAt: r.savedAt })));
  });

  api.post("/user/cards/:slug", auth.requireAuth, validate("params", params.slug), validate("body", bodies.saveCard), async (req, res) => {
    const word = await wordBySlug(req, res);
    if (!word) return;
    const key = { userId: req.user.uid, wordId: word.id, source: req.body.source };
    await prisma.savedCard.upsert({ where: { userId_wordId_source: key }, create: key, update: {} });
    res.json({ ok: true, saved: true });
  });

  api.delete("/user/cards/:slug", auth.requireAuth, validate("params", params.slug), async (req, res) => {
    const word = await wordBySlug(req, res);
    if (!word) return;
    await prisma.savedCard.deleteMany({ where: { userId: req.user.uid, wordId: word.id } });
    res.json({ ok: true, saved: false });
  });

  return api;
}

module.exports = { accountRoutes, REGISTER_REFUSED, LOGIN_REFUSED };
