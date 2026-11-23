/* Sessions, sign-in, lockout and account ownership. */
const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { startTestApp, client, TEST_ENV } = require("./support/harness");
const { REGISTER_REFUSED, LOGIN_REFUSED } = require("../src/routes/account");

let t;
test.beforeEach(async () => { t = await startTestApp(); });
test.afterEach(() => t.close());

const ACCOUNT = { name: "Ana", email: "ana@example.com", password: "correct horse battery" };

async function signedIn() {
  const api = client(t.base);
  const res = await api.post("/api/auth/register", ACCOUNT);
  assert.equal(res.status, 201);
  return api;
}

test("registering sets an HttpOnly, SameSite=Strict session cookie and returns no token", async () => {
  const res = await client(t.base).post("/api/auth/register", ACCOUNT);
  assert.equal(res.status, 201);
  assert.deepEqual(res.json, { user: { email: ACCOUNT.email, name: ACCOUNT.name } });
  const cookie = res.setCookie.find((c) => c.startsWith("babel_session="));
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Path=\/api/);
  assert.match(cookie, /Max-Age=604800/);
});

test("the profile response is limited to the allow-listed fields", async () => {
  const api = await signedIn();
  const res = await api.get("/api/user/me");
  assert.deepEqual(Object.keys(res.json).sort(), ["createdAt", "email", "name"]);
});

test("passwords are hashed with bcrypt cost 12", async () => {
  await signedIn();
  assert.match(t.prisma.tables.user[0].passwordHash, /^\$2[aby]\$12\$/);
});

test("a taken email gets the same refusal whatever the case or spacing", async () => {
  await signedIn();
  const res = await client(t.base).post("/api/auth/register", { ...ACCOUNT, email: "ANA@example.com" });
  assert.equal(res.status, 409);
  assert.equal(res.json.error, REGISTER_REFUSED);
});

test("the session cookie authenticates; no cookie, a tampered one or a bearer token does not", async () => {
  const api = await signedIn();
  assert.equal((await api.get("/api/user/me")).status, 200);
  assert.equal((await client(t.base).get("/api/user/me")).status, 401);

  const tampered = client(t.base);
  tampered.jar.set("babel_session", api.jar.get("babel_session").slice(0, -2) + "xx");
  assert.equal((await tampered.get("/api/user/me")).status, 401);

  const legacy = jwt.sign({ uid: 1, sv: 0 }, "babel-dev-secret");
  assert.equal((await client(t.base).get("/api/user/me", { headers: { authorization: `Bearer ${legacy}` } })).status, 401);
});

test("tokens signed with the wrong algorithm, expired, or for a deleted user are refused", async () => {
  const api = await signedIn();
  const none = client(t.base);
  none.jar.set("babel_session", jwt.sign({ uid: 1, sv: 0 }, "", { algorithm: "none" }));
  assert.equal((await none.get("/api/user/me")).status, 401);

  const expired = client(t.base);
  expired.jar.set("babel_session", jwt.sign({ uid: 1, sv: 0, exp: Math.floor(Date.now() / 1000) - 1 }, TEST_ENV.JWT_SECRET));
  assert.equal((await expired.get("/api/user/me")).status, 401);

  const kept = client(t.base);
  kept.jar.set("babel_session", api.jar.get("babel_session"));
  assert.equal((await api.del("/api/user/me")).status, 200);
  assert.equal((await kept.get("/api/user/me")).status, 401);
  assert.equal((await kept.post("/api/user/saved/saudade", {})).status, 401);
});

test("logging in uses one message for an unknown email and a wrong password", async () => {
  await signedIn();
  const unknown = await client(t.base).post("/api/auth/login", { email: "nobody@example.com", password: "whatever-it-is" });
  const wrong = await client(t.base).post("/api/auth/login", { email: ACCOUNT.email, password: "wrong password" });
  assert.equal(unknown.status, 401);
  assert.equal(wrong.status, 401);
  assert.equal(unknown.json.error, LOGIN_REFUSED);
  assert.equal(wrong.json.error, LOGIN_REFUSED);
});

test("five failed sign-ins lock the account for that address, even with the right password", async () => {
  await signedIn();
  const api = client(t.base);
  for (let i = 0; i < 5; i++) assert.equal((await api.post("/api/auth/login", { email: ACCOUNT.email, password: "nope" })).status, 401);
  const locked = await api.post("/api/auth/login", { email: ACCOUNT.email, password: ACCOUNT.password });
  assert.equal(locked.status, 429);
  assert.ok(Number(locked.headers.get("retry-after")) > 0);
});

test("parallel guesses cannot exceed the sign-in limit", async () => {
  await signedIn();
  const results = await Promise.all(Array.from({ length: 20 }, () => client(t.base).post("/api/auth/login", { email: ACCOUNT.email, password: "nope" })));
  assert.equal(results.filter((r) => r.status === 401).length, 5);
  assert.equal(results.filter((r) => r.status === 429).length, 15);
});

test("a successful sign-in clears earlier failures", async () => {
  await signedIn();
  const api = client(t.base);
  for (let i = 0; i < 4; i++) await api.post("/api/auth/login", { email: ACCOUNT.email, password: "nope" });
  assert.equal((await api.post("/api/auth/login", { email: ACCOUNT.email, password: ACCOUNT.password })).status, 200);
  for (let i = 0; i < 4; i++) assert.equal((await api.post("/api/auth/login", { email: ACCOUNT.email, password: "nope" })).status, 401);
});

test("changing the password needs the current one and ends other sessions", async () => {
  const api = await signedIn();
  const other = client(t.base);
  await other.post("/api/auth/login", { email: ACCOUNT.email, password: ACCOUNT.password });

  assert.equal((await api.patch("/api/user/me", { password: "a brand new password" })).status, 400);
  assert.equal((await api.patch("/api/user/me", { password: "a brand new password", currentPassword: "guess" })).status, 403);
  assert.equal((await api.patch("/api/user/me", { password: "a brand new password", currentPassword: ACCOUNT.password })).status, 200);

  assert.equal((await api.get("/api/user/me")).status, 200, "the session that changed it continues");
  assert.equal((await other.get("/api/user/me")).status, 401, "every other session ends");
});

test("profile updates refuse privileged or unknown fields", async () => {
  const api = await signedIn();
  assert.equal((await api.patch("/api/user/me", { name: "Ana B", email: "x@example.com" })).status, 400);
  assert.equal((await api.patch("/api/user/me", { sessionVersion: 9 })).status, 400);
});

test("signing out clears the cookie", async () => {
  const api = await signedIn();
  const res = await api.post("/api/auth/logout");
  assert.equal(res.status, 204);
  assert.equal(api.jar.has("babel_session"), false);
  assert.equal((await api.get("/api/user/me")).status, 401);
});

test("a user's saved words and history are theirs alone", async () => {
  const ana = await signedIn();
  await ana.post("/api/user/saved/saudade", {});
  const ben = client(t.base);
  await ben.post("/api/auth/register", { name: "Ben", email: "ben@example.com", password: "another long password" });
  assert.deepEqual((await ben.get("/api/user/saved")).json, []);
  assert.equal((await ana.get("/api/user/saved")).json.length, 1);
});

test("saving the same word twice keeps one row", async () => {
  const api = await signedIn();
  await Promise.all([api.post("/api/user/saved/saudade", {}), api.post("/api/user/saved/saudade", {})]);
  assert.equal(t.prisma.tables.savedWord.length, 1);
});
