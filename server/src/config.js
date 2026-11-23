/* The only place that reads environment variables. Everything else receives a
   validated, frozen config object, so a missing or weak secret stops the process
   at startup instead of surfacing later as a silent security hole. */

class ConfigError extends Error {}

const MIN_SECRET_LENGTH = 32;
const DEFAULT_MODEL = "claude-opus-4-8";

function positiveInt(raw, fallback, name, errors) {
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    errors.push(`${name} must be a non-negative integer`);
    return fallback;
  }
  return n;
}

function loadConfig(env = process.env) {
  const errors = [];

  const jwtSecret = env.JWT_SECRET || "";
  if (!jwtSecret) errors.push("JWT_SECRET is required");
  else if (jwtSecret.length < MIN_SECRET_LENGTH) errors.push(`JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters`);

  // Optional: without it every admin route refuses access.
  const adminKey = env.ADMIN_KEY || "";
  if (adminKey && adminKey.length < MIN_SECRET_LENGTH) errors.push(`ADMIN_KEY must be at least ${MIN_SECRET_LENGTH} characters when set`);

  if (!env.DATABASE_URL) errors.push("DATABASE_URL is required");

  const port = positiveInt(env.PORT, 4600, "PORT", errors);
  const claudeDailyCap = positiveInt(env.CLAUDE_DAILY_CAP, 300, "CLAUDE_DAILY_CAP", errors);

  if (errors.length) throw new ConfigError(`Invalid configuration: ${errors.join("; ")}.`);

  const onVercel = env.VERCEL === "1";
  return Object.freeze({
    jwtSecret,
    adminKey,
    port,
    anthropicApiKey: env.ANTHROPIC_API_KEY || "",
    anthropicModel: env.ANTHROPIC_MODEL || DEFAULT_MODEL,
    claudeDailyCap,
    // Vercel sets x-real-ip itself, so it is the client address there; anywhere
    // else the header could be forged and the socket address is used instead.
    trustRealIpHeader: onVercel,
    secureCookies: onVercel || env.NODE_ENV === "production",
  });
}

module.exports = { loadConfig, ConfigError, MIN_SECRET_LENGTH };
