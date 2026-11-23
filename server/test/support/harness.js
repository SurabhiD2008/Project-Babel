/* Builds an app around the in-memory store, listens on an ephemeral port and
   offers a small HTTP client that keeps cookies like a browser would. */
const { createApp } = require("../../src/app");
const { loadConfig } = require("../../src/config");
const { createFakePrisma } = require("./fakePrisma");

const TEST_ENV = {
  JWT_SECRET: "test-jwt-secret-that-is-long-enough-0123456789",
  ADMIN_KEY: "test-admin-key-that-is-long-enough-0123456789",
  DATABASE_URL: "postgresql://test@localhost/babel_test",
};

const SEED_WORDS = [
  { slug: "saudade", number: 1, word: "Saudade", language: "Portuguese", family: "Romance", script: "Latin", distScore: 90, category: "longing", defShort: "A deep longing for something absent.", defFull: "A deep longing for something or someone absent." },
  { slug: "komorebi", number: 2, word: "Komorebi", language: "Japanese", family: "Japonic", script: "Japanese", distScore: 80, category: "awe", defShort: "Sunlight filtering through leaves.", defFull: "Sunlight filtering through the leaves of trees." },
];

// No test touches the real network: outbound lookups find nothing.
const offlineFetch = async () => ({ ok: false, status: 503, json: async () => ({}) });

async function startTestApp({ env = {}, fetchImpl = offlineFetch, words = SEED_WORDS } = {}) {
  const prisma = createFakePrisma();
  for (const w of words) await prisma.word.create({ data: w });
  const config = loadConfig({ ...TEST_ENV, ...env });
  const { app, ctx } = createApp({ prisma, config, fetchImpl, webDist: "/nonexistent" });
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { prisma, config, ctx, base, close: () => new Promise((r) => server.close(r)) };
}

function client(base) {
  const jar = new Map();
  async function request(method, path, { body, headers = {}, raw } = {}) {
    const h = { ...headers };
    if (method !== "GET" && !("x-babel-client" in h)) h["x-babel-client"] = "1";
    if (body !== undefined || raw !== undefined) h["content-type"] ??= "application/json";
    if (jar.size) h.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    const res = await fetch(base + path, { method, headers: h, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const [k, v] = pair.split("=");
      if (/Expires=Thu, 01 Jan 1970/i.test(c) || v === "") jar.delete(k); else jar.set(k, v);
    }
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* non-JSON body */ }
    return { status: res.status, headers: res.headers, json, text, setCookie: res.headers.getSetCookie() };
  }
  return {
    jar,
    get: (p, o) => request("GET", p, o),
    post: (p, body, o = {}) => request("POST", p, { ...o, body }),
    patch: (p, body, o = {}) => request("PATCH", p, { ...o, body }),
    del: (p, o) => request("DELETE", p, o),
    request,
  };
}

module.exports = { startTestApp, client, TEST_ENV, SEED_WORDS };
