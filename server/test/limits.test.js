/* Rate limits on everything that writes, costs money or reaches the network. */
const test = require("node:test");
const assert = require("node:assert/strict");
const { startTestApp, client } = require("./support/harness");
const { createRateLimiter } = require("../src/rateLimit");
const { createFakePrisma } = require("./support/fakePrisma");

let t;
test.beforeEach(async () => { t = await startTestApp(); });
test.afterEach(() => t.close());

async function exhaust(send, allowed) {
  for (let i = 0; i < allowed; i++) {
    const res = await send(i);
    assert.notEqual(res.status, 429, `request ${i + 1} should be allowed`);
  }
  const over = await send(allowed);
  assert.equal(over.status, 429);
  assert.ok(Number(over.headers.get("retry-after")) > 0);
}

test("submissions: 6 per 10 minutes per address", async () => {
  const api = client(t.base);
  await exhaust((i) => api.post("/api/submissions", { word: `Wordy${"abcdefg"[i]}`, language: "Danish", why: "A cosy feeling of warmth and contentment with friends." }), 6);
});

test("registration: 5 per hour per address", async () => {
  const api = client(t.base);
  await exhaust((i) => api.post("/api/auth/register", { name: "N", email: `n${i}@example.com`, password: "long enough password" }), 5);
});

test("searches: 30 per 10 minutes per address", async () => {
  const api = client(t.base);
  await exhaust((i) => api.post("/api/feelings/search", { input: `a quiet longing number ${i}` }), 30);
});

test("events: 60 per 10 minutes per address", async () => {
  const api = client(t.base);
  await exhaust(() => api.post("/api/events", { event: "share" }), 60);
});

test("on Vercel the limit follows the client address header", async () => {
  const vercel = await startTestApp({ env: { VERCEL: "1" } });
  try {
    const api = client(vercel.base);
    const as = (ip) => ({ headers: { "x-real-ip": ip } });
    for (let i = 0; i < 6; i++) await api.post("/api/submissions", { word: `Wordy${"abcdefg"[i]}`, language: "Danish", why: "A cosy feeling of warmth and contentment with friends." }, as("203.0.113.1"));
    const blocked = await api.post("/api/submissions", { word: "Wordyx", language: "Danish", why: "A cosy feeling of warmth and contentment with friends." }, as("203.0.113.1"));
    const other = await api.post("/api/submissions", { word: "Wordyz", language: "Danish", why: "A cosy feeling of warmth and contentment with friends." }, as("203.0.113.2"));
    assert.equal(blocked.status, 429);
    assert.notEqual(other.status, 429);
  } finally {
    await vercel.close();
  }
});

test("off Vercel a forged client address header does not reset the limit", async () => {
  const api = client(t.base);
  for (let i = 0; i < 6; i++) await api.post("/api/submissions", { word: `Wordy${"abcdefg"[i]}`, language: "Danish", why: "A cosy feeling of warmth and contentment with friends." }, { headers: { "x-real-ip": `198.51.100.${i}` } });
  const res = await api.post("/api/submissions", { word: "Wordyx", language: "Danish", why: "A cosy feeling of warmth and contentment with friends." }, { headers: { "x-real-ip": "198.51.100.99" } });
  assert.equal(res.status, 429);
});

test("rate limit keys never contain the raw identifier", async () => {
  const prisma = createFakePrisma();
  const limiter = createRateLimiter({ prisma, secret: "s".repeat(32) });
  await limiter.hit("register", "203.0.113.7");
  assert.equal(prisma.tables.rateLimit.length, 1);
  assert.equal(prisma.tables.rateLimit[0].key.includes("203.0.113.7"), false);
});

test("20 parallel hits on a limit of 5 allow exactly 5", async () => {
  const prisma = createFakePrisma();
  const limiter = createRateLimiter({ prisma, secret: "s".repeat(32) });
  for (let round = 0; round < 20; round++) {
    const results = await Promise.all(Array.from({ length: 20 }, () => limiter.hit("register", `ip-${round}`)));
    assert.equal(results.filter((r) => r.allowed).length, 5);
  }
});

test("a new window starts a new count", async () => {
  const prisma = createFakePrisma();
  let clock = 0;
  const limiter = createRateLimiter({ prisma, secret: "s".repeat(32), now: () => clock });
  for (let i = 0; i < 5; i++) await limiter.hit("register", "ip");
  assert.equal((await limiter.hit("register", "ip")).allowed, false);
  clock = 60 * 60 * 1000 - 1;
  assert.equal((await limiter.hit("register", "ip")).allowed, false, "one millisecond before the window ends");
  clock = 60 * 60 * 1000;
  assert.equal((await limiter.hit("register", "ip")).allowed, true, "at the start of the next window");
});
