const test = require("node:test");
const assert = require("node:assert/strict");
const { loadConfig, ConfigError } = require("../src/config");
const { TEST_ENV } = require("./support/harness");

test("a valid environment loads", () => {
  const config = loadConfig(TEST_ENV);
  assert.equal(config.port, 4600);
  assert.equal(config.trustRealIpHeader, false);
  assert.ok(Object.isFrozen(config));
});

const refusals = [
  ["missing JWT_SECRET", { JWT_SECRET: "" }, /JWT_SECRET is required/],
  ["short JWT_SECRET", { JWT_SECRET: "babel-dev-secret" }, /JWT_SECRET must be at least 32 characters/],
  ["short ADMIN_KEY", { ADMIN_KEY: "change-me" }, /ADMIN_KEY must be at least 32 characters/],
  ["missing DATABASE_URL", { DATABASE_URL: "" }, /DATABASE_URL is required/],
  ["non-numeric PORT", { PORT: "eighty" }, /PORT must be a non-negative integer/],
  ["negative CLAUDE_DAILY_CAP", { CLAUDE_DAILY_CAP: "-1" }, /CLAUDE_DAILY_CAP must be a non-negative integer/],
];

for (const [name, override, message] of refusals) {
  test(`startup refuses a ${name}`, () => {
    assert.throws(() => loadConfig({ ...TEST_ENV, ...override }), (e) => e instanceof ConfigError && message.test(e.message));
  });
}

test("ADMIN_KEY may be left unset", () => {
  assert.equal(loadConfig({ ...TEST_ENV, ADMIN_KEY: "" }).adminKey, "");
});

test("the client address header is trusted only on Vercel", () => {
  assert.equal(loadConfig({ ...TEST_ENV, VERCEL: "1" }).trustRealIpHeader, true);
  assert.equal(loadConfig({ ...TEST_ENV, VERCEL: "1" }).secureCookies, true);
});
