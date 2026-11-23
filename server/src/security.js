/* Request-level security: response headers, cross-site request protection,
   session cookies, client addresses and constant-time secret comparison. */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const SESSION_COOKIE = "babel_session";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
// Browsers cannot attach a custom header to a cross-site request without a CORS
// preflight, and this API answers no preflight, so requiring it on every write
// blocks cross-site request forgery even if a cookie were sent along.
const CLIENT_HEADER = "x-babel-client";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const API_HEADERS = {
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Cache-Control": "no-store",
};

function sendError(res, status, message, extra = {}) {
  return res.status(status).json({ error: message, ...extra });
}

function apiHeaders(req, res, next) {
  for (const [k, v] of Object.entries(API_HEADERS)) res.setHeader(k, v);
  next();
}

/* The page headers are defined once, in vercel.json, and reused here so the
   locally served build gets the same policy as production. */
function loadPageHeaders(vercelJsonPath = path.resolve(__dirname, "../../vercel.json")) {
  const config = JSON.parse(fs.readFileSync(vercelJsonPath, "utf8"));
  const rule = (config.headers || []).find((h) => h.source === "/(.*)");
  return rule ? rule.headers : [];
}

function pageHeaders(headers) {
  return (req, res, next) => {
    for (const { key, value } of headers) res.setHeader(key, value);
    next();
  };
}

function csrfGuard(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (req.get("sec-fetch-site") === "cross-site") return sendError(res, 403, "Cross-site requests are not allowed.");
  if (req.get(CLIENT_HEADER) !== "1") return sendError(res, 403, "Missing client header.");
  next();
}

function readCookie(req, name) {
  const header = req.headers.cookie || "";
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    if (part.slice(0, i).trim() === name) {
      try { return decodeURIComponent(part.slice(i + 1).trim()); } catch { return null; }
    }
  }
  return null;
}

function cookieOptions(config) {
  return { httpOnly: true, secure: config.secureCookies, sameSite: "strict", path: "/api" };
}

function setSessionCookie(res, token, config) {
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(config), maxAge: SESSION_TTL_SECONDS * 1000 });
}

function clearSessionCookie(res, config) {
  res.clearCookie(SESSION_COOKIE, cookieOptions(config));
}

function clientIp(req, config) {
  if (config.trustRealIpHeader) {
    const real = req.get("x-real-ip");
    if (real) return real.trim();
  }
  return req.socket.remoteAddress || "unknown";
}

// Hashing both sides first gives equal-length buffers, so timingSafeEqual can
// compare secrets of any length without leaking the length.
function safeEqual(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

module.exports = {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  CLIENT_HEADER,
  sendError,
  apiHeaders,
  loadPageHeaders,
  pageHeaders,
  csrfGuard,
  readCookie,
  setSessionCookie,
  clearSessionCookie,
  clientIp,
  safeEqual,
};
