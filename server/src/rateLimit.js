/* Fixed-window rate limits stored in the database, so the counts hold across
   serverless instances and restarts. Keys are HMACs of the client identifier,
   so raw IP addresses and emails are never stored. */
const crypto = require("crypto");

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

// One table of every limit the API enforces.
const LIMITS = Object.freeze({
  // Sign-in and admin-key attempts; a success clears the count.
  loginFailures: { limit: 5, windowMs: 15 * MINUTE },
  register: { limit: 5, windowMs: 60 * MINUTE },
  adminFailures: { limit: 5, windowMs: 15 * MINUTE },
  submission: { limit: 6, windowMs: 10 * MINUTE },
  submissionDaily: { limit: 200, windowMs: DAY },
  search: { limit: 30, windowMs: 10 * MINUTE },
  searchDaily: { limit: 5000, windowMs: DAY },
  claude: { limit: 6, windowMs: 10 * MINUTE },
  event: { limit: 60, windowMs: 10 * MINUTE },
  account: { limit: 10, windowMs: 60 * MINUTE },
});

const CLEANUP_EVERY = 100;

/* `overrides` lets configuration change a limit (for example the daily cap on
   Claude calls) without editing the table. */
function createRateLimiter({ prisma, secret, now = () => Date.now(), overrides = {} }) {
  const limits = { ...LIMITS, ...overrides };
  let hitsSinceCleanup = 0;

  function keyFor(scope, id, { windowMs }) {
    const bucket = Math.floor(now() / windowMs);
    const digest = crypto.createHmac("sha256", secret).update(`${scope}:${id}`).digest("hex");
    return { key: `${scope}:${digest}:${bucket}`, expiresAt: new Date((bucket + 1) * windowMs) };
  }

  function retryAfterSeconds(expiresAt) {
    return Math.max(1, Math.ceil((expiresAt.getTime() - now()) / 1000));
  }

  async function increment(key, expiresAt) {
    const args = { where: { key }, create: { key, count: 1, expiresAt }, update: { count: { increment: 1 } } };
    try {
      return await prisma.rateLimit.upsert(args);
    } catch (e) {
      // Two first hits in the same window can race on the insert; the loser
      // retries once and lands on the update path.
      if (e.code === "P2002") return prisma.rateLimit.upsert(args);
      throw e;
    }
  }

  async function cleanup() {
    hitsSinceCleanup += 1;
    if (hitsSinceCleanup < CLEANUP_EVERY) return;
    hitsSinceCleanup = 0;
    await prisma.rateLimit.deleteMany({ where: { expiresAt: { lt: new Date(now()) } } });
  }

  /* Counts one request and says whether it is within the limit. */
  async function hit(scope, id) {
    const policy = limits[scope];
    if (!policy) throw new Error(`Unknown rate limit scope: ${scope}`);
    const { key, expiresAt } = keyFor(scope, id, policy);
    const row = await increment(key, expiresAt);
    await cleanup();
    return { allowed: row.count <= policy.limit, retryAfter: retryAfterSeconds(expiresAt) };
  }

  async function reset(scope, id) {
    const { key } = keyFor(scope, id, limits[scope]);
    await prisma.rateLimit.deleteMany({ where: { key } });
  }

  return { hit, reset };
}

module.exports = { createRateLimiter, LIMITS, DAY };
