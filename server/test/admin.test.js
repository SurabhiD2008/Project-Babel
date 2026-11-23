/* Admin key handling and moderation state rules. */
const test = require("node:test");
const assert = require("node:assert/strict");
const { startTestApp, client, TEST_ENV } = require("./support/harness");

let t;
test.beforeEach(async () => { t = await startTestApp(); });
test.afterEach(() => t.close());

const asAdmin = { headers: { "x-admin-key": TEST_ENV.ADMIN_KEY } };

async function pendingSubmission(overrides = {}) {
  return t.prisma.submission.create({ data: { word: "Hygge", language: "Danish", why: "A cosy feeling of warmth and contentment with friends.", email: "kim@example.com", submitter: "Kim", status: "pending", ...overrides } });
}

test("the admin key is accepted only in the header", async () => {
  const api = client(t.base);
  assert.equal((await api.get("/api/admin/metrics")).status, 401);
  assert.equal((await api.get(`/api/admin/metrics?key=${TEST_ENV.ADMIN_KEY}`)).status, 401);
  assert.equal((await api.get("/api/admin/metrics", { headers: { "x-admin-key": "wrong" } })).status, 401);
  assert.equal((await api.get("/api/admin/metrics", asAdmin)).status, 200);
});

test("with no ADMIN_KEY configured every admin route is closed", async () => {
  const closed = await startTestApp({ env: { ADMIN_KEY: "" } });
  try {
    assert.equal((await client(closed.base).get("/api/admin/metrics", { headers: { "x-admin-key": "" } })).status, 401);
  } finally {
    await closed.close();
  }
});

test("repeated wrong keys are locked out", async () => {
  const api = client(t.base);
  for (let i = 0; i < 5; i++) assert.equal((await api.get("/api/admin/metrics", { headers: { "x-admin-key": `guess-${i}` } })).status, 401);
  const locked = await api.get("/api/admin/metrics", asAdmin);
  assert.equal(locked.status, 429);
});

test("the moderation queue does not expose submitter emails", async () => {
  await pendingSubmission();
  const res = await client(t.base).get("/api/admin/submissions?status=pending", asAdmin);
  assert.equal(res.status, 200);
  assert.equal(res.json.length, 1);
  assert.equal("email" in res.json[0], false);
  assert.equal(res.json[0].submitter, "Kim");
});

test("accepting adds the word once; a second decision on the same submission is a 409", async () => {
  const sub = await pendingSubmission();
  const api = client(t.base);
  const first = await api.post(`/api/admin/submissions/${sub.id}/accept`, undefined, asAdmin);
  assert.equal(first.status, 200);
  assert.equal(first.json.added.slug, "hygge");
  const again = await api.post(`/api/admin/submissions/${sub.id}/reject`, undefined, asAdmin);
  assert.equal(again.status, 409);
  assert.equal(t.prisma.tables.word.filter((w) => w.slug === "hygge").length, 1);
  assert.equal(t.prisma.tables.submission[0].status, "accepted");
});

test("two moderators deciding at once: exactly one wins", async () => {
  const sub = await pendingSubmission();
  const results = await Promise.all([
    client(t.base).post(`/api/admin/submissions/${sub.id}/accept`, undefined, asAdmin),
    client(t.base).post(`/api/admin/submissions/${sub.id}/accept`, undefined, asAdmin),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  assert.equal(t.prisma.tables.word.filter((w) => w.slug === "hygge").length, 1);
});

test("a submission screening already turned away cannot be accepted", async () => {
  const sub = await pendingSubmission({ status: "rejected_inaccurate" });
  const res = await client(t.base).post(`/api/admin/submissions/${sub.id}/accept`, undefined, asAdmin);
  assert.equal(res.status, 409);
  assert.equal(t.prisma.tables.word.some((w) => w.slug === "hygge"), false);
});

test("admin actions validate their parameters", async () => {
  const api = client(t.base);
  assert.equal((await api.post("/api/admin/submissions/abc/accept", undefined, asAdmin)).status, 400);
  assert.equal((await api.post("/api/admin/submissions/1/promote", undefined, asAdmin)).status, 400);
  assert.equal((await api.post("/api/admin/submissions/999/accept", undefined, asAdmin)).status, 404);
  assert.equal((await api.get("/api/admin/submissions?status=everything", asAdmin)).status, 400);
});

test("analytics are available to the admin", async () => {
  const res = await client(t.base).get("/api/analytics", asAdmin);
  assert.equal(res.status, 200);
  assert.equal(typeof res.json.users, "number");
});
