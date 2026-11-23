/* Sessions: a signed token in an HttpOnly, SameSite=Strict cookie. The token
   carries the user id and a session version; changing the password bumps the
   version, which ends every other session. Each request re-reads the user, so
   a deleted account's cookie stops working at once. */
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { SESSION_COOKIE, SESSION_TTL_SECONDS, readCookie, setSessionCookie, clearSessionCookie, sendError } = require("./security");

const BCRYPT_COST = 12;
// Compared against when the email is unknown, so a login takes the same time
// whether or not the account exists. Built on first use to keep cold starts fast.
let dummyHash = null;
const getDummyHash = () => (dummyHash ??= bcrypt.hashSync("babel-timing-equaliser", BCRYPT_COST));

function createAuth({ prisma, config }) {
  function issueSession(res, user) {
    const token = jwt.sign({ uid: user.id, sv: user.sessionVersion }, config.jwtSecret, { algorithm: "HS256", expiresIn: SESSION_TTL_SECONDS });
    setSessionCookie(res, token, config);
  }

  async function userFromRequest(req) {
    const token = readCookie(req, SESSION_COOKIE);
    if (!token) return null;
    let claims;
    try { claims = jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] }); } catch { return null; }
    if (!Number.isInteger(claims.uid) || !Number.isInteger(claims.sv)) return null;
    const user = await prisma.user.findUnique({ where: { id: claims.uid }, select: { id: true, sessionVersion: true } });
    if (!user || user.sessionVersion !== claims.sv) return null;
    return { uid: user.id };
  }

  async function requireAuth(req, res, next) {
    try {
      const user = await userFromRequest(req);
      if (!user) {
        if (req.headers.cookie) clearSessionCookie(res, config);
        return sendError(res, 401, "Please sign in.");
      }
      req.user = user;
      next();
    } catch (e) { next(e); }
  }

  /* Never blocks: signed-in callers additionally get their activity recorded. */
  async function optionalAuth(req, res, next) {
    try { req.user = await userFromRequest(req); next(); } catch (e) { next(e); }
  }

  const hashPassword = (password) => bcrypt.hash(password, BCRYPT_COST);

  async function checkPassword(password, hash) {
    return bcrypt.compare(password, hash || getDummyHash());
  }

  const needsRehash = (hash) => bcrypt.getRounds(hash) < BCRYPT_COST;

  return { issueSession, requireAuth, optionalAuth, hashPassword, checkPassword, needsRehash, clearSession: (res) => clearSessionCookie(res, config) };
}

module.exports = { createAuth, BCRYPT_COST };
