/* Response headers, cross-origin and cross-site protection, request parsing
   and the public surface. */
const test = require("node:test");
const assert = require("node:assert/strict");
const { startTestApp, client } = require("./support/harness");

let t;
test.before(async () => { t = await startTestApp(); });
test.after(() => t.close());

test("API responses carry the security headers and no framework banner", async () => {
  const res = await client(t.base).get("/api/health");
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.equal(res.headers.get("x-frame-options"), "DENY");
  assert.equal(res.headers.get("referrer-policy"), "no-referrer");
  assert.match(res.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.equal(res.headers.get("x-powered-by"), null);
});

test("health reports status only", async () => {
  const res = await client(t.base).get("/api/health");
  assert.equal(res.status, 200);
  assert.deepEqual(res.json, { status: "ok" });
});

test("no CORS headers are sent, even to a preflight from another origin", async () => {
  const res = await fetch(`${t.base}/api/auth/login`, {
    method: "OPTIONS",
    headers: { origin: "https://evil.example", "access-control-request-method": "POST", "access-control-request-headers": "x-babel-client,content-type" },
  });
  assert.equal(res.headers.get("access-control-allow-origin"), null);
  assert.equal(res.headers.get("access-control-allow-headers"), null);
});

test("writes without the client header are refused", async () => {
  const res = await client(t.base).post("/api/events", { event: "share" }, { headers: { "x-babel-client": "" } });
  assert.equal(res.status, 403);
});

test("writes marked cross-site by the browser are refused", async () => {
  const res = await client(t.base).post("/api/events", { event: "share" }, { headers: { "sec-fetch-site": "cross-site" } });
  assert.equal(res.status, 403);
});

test("a malformed JSON body gets a clean 400", async () => {
  const res = await client(t.base).request("POST", "/api/events", { raw: "{not json" });
  assert.equal(res.status, 400);
  assert.equal(res.json.error, "Request body is not valid JSON.");
});

test("a body over 100 KB gets 413", async () => {
  const res = await client(t.base).post("/api/compose/analyse", { text: "a".repeat(110 * 1024) });
  assert.equal(res.status, 413);
});

test("unknown API routes answer JSON 404", async () => {
  const res = await client(t.base).get("/api/nope");
  assert.equal(res.status, 404);
  assert.deepEqual(res.json, { error: "Not found." });
});

test("analytics are not public", async () => {
  const res = await client(t.base).get("/api/analytics");
  assert.equal(res.status, 401);
});

test("an unknown event name is refused and only allow-listed events are stored", async () => {
  const api = client(t.base);
  assert.equal((await api.post("/api/events", { event: "admin_override" })).status, 400);
  assert.equal((await api.post("/api/events", { event: "share_card", slug: "saudade" })).status, 200);
  assert.equal((await api.post("/api/events", { event: "share", slug: "<script>" })).status, 400);
  assert.ok(t.prisma.tables.searchLog.every((r) => ["share_card"].includes(r.kind)));
});

test("searches are logged without the visitor's text", async () => {
  await client(t.base).post("/api/feelings/search", { input: "missing a home I never had" });
  const row = t.prisma.tables.searchLog.find((r) => r.kind === "feeling");
  assert.ok(row);
  assert.equal(row.input, "");
});

test("a word list with no words answers 404 for the daily word, not a crash", async () => {
  const empty = await startTestApp({ words: [] });
  try {
    assert.equal((await client(empty.base).get("/api/words/random")).status, 404);
  } finally {
    await empty.close();
  }
});
