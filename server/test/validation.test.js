/* Table-driven input checks: every write refuses unknown fields, wrong types
   and out-of-range values with a 4xx, never a 500. */
const test = require("node:test");
const assert = require("node:assert/strict");
const { startTestApp, client } = require("./support/harness");

let t;
test.before(async () => { t = await startTestApp(); });
test.after(() => t.close());

const writes = [
  ["feeling: unknown field", "/api/feelings/search", { input: "a long enough feeling", role: "admin" }, 400],
  ["feeling: wrong type", "/api/feelings/search", { input: 12345 }, 400],
  ["feeling: too short", "/api/feelings/search", { input: "abc" }, 400],
  ["feeling: whitespace only", "/api/feelings/search", { input: "      " }, 400],
  ["feeling: over the maximum", "/api/feelings/search", { input: "x".repeat(1001) }, 400],
  ["feeling: array body", "/api/feelings/search", ["a long enough feeling"], 400],
  ["compose: null text", "/api/compose/analyse", { text: null }, 400],
  ["compose: over the maximum", "/api/compose/analyse", { text: "word ".repeat(2001) }, 400],
  ["submission: missing why", "/api/submissions", { word: "Hygge", language: "Danish" }, 422],
  ["submission: numeric why", "/api/submissions", { word: "Hygge", language: "Danish", why: 1 }, 422],
  ["submission: status supplied", "/api/submissions", { word: "Hygge", language: "Danish", why: "A cosy warm feeling of contentment with friends.", status: "accepted" }, 422],
  ["submission: overlong submitter", "/api/submissions", { word: "Hygge", language: "Danish", why: "A cosy warm feeling of contentment with friends.", submitter: "x".repeat(81) }, 422],
  ["submission: bad email", "/api/submissions", { word: "Hygge", language: "Danish", why: "A cosy warm feeling of contentment with friends.", email: "not-an-email" }, 422],
  ["register: short password", "/api/auth/register", { name: "Ana", email: "ana@example.com", password: "1234" }, 400],
  ["register: password over 72 bytes", "/api/auth/register", { name: "Ana", email: "ana@example.com", password: "é".repeat(40) }, 400],
  ["register: bad email", "/api/auth/register", { name: "Ana", email: "ana", password: "long-enough-pw" }, 400],
  ["register: admin flag supplied", "/api/auth/register", { name: "Ana", email: "ana@example.com", password: "long-enough-pw", isAdmin: true }, 400],
  ["register: empty name", "/api/auth/register", { name: "   ", email: "ana@example.com", password: "long-enough-pw" }, 400],
  ["login: wrong type", "/api/auth/login", { email: ["a"], password: "x" }, 400],
  ["event: missing name", "/api/events", {}, 400],
];

for (const [name, path, body, status] of writes) {
  test(`refuses ${name}`, async () => {
    const res = await client(t.base).post(path, body);
    assert.equal(res.status, status, res.text);
    assert.equal(typeof res.json.error, "string");
  });
}

const reads = [
  ["band that is not a range", "/api/words?band=abc"],
  ["band above 100", "/api/words?band=90-120"],
  ["band reversed", "/api/words?band=80-60"],
  ["page zero", "/api/words?page=0"],
  ["negative page", "/api/words?page=-1"],
  ["per above the maximum", "/api/words?per=101"],
  ["fractional per", "/api/words?per=2.5"],
  ["unknown sort", "/api/words?sort=password"],
  ["unknown category", "/api/words?category=secret"],
  ["slug with path traversal", "/api/words/..%2F..%2Fetc"],
  ["slug with markup", "/api/words/%3Cscript%3E"],
];

for (const [name, path] of reads) {
  test(`refuses a ${name}`, async () => {
    const res = await client(t.base).get(path);
    assert.equal(res.status, 400, res.text);
  });
}

test("a valid paged read still works, including the last page and beyond it", async () => {
  const api = client(t.base);
  const first = await api.get("/api/words?per=1&page=2");
  assert.equal(first.status, 200);
  assert.equal(first.json.words.length, 1);
  const beyond = await api.get("/api/words?per=1&page=3");
  assert.equal(beyond.json.words.length, 0);
});

test("a nonexistent word is a 404", async () => {
  assert.equal((await client(t.base).get("/api/words/no-such-word")).status, 404);
});
