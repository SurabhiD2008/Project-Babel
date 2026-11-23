import { Store } from "./store.js";
import { VISIBLE_WORDS, CATEGORIES, categoryCounts } from "../data/index.js";

/* ---------- backend client (real API first, localStorage fallback) ----------
   The session lives in an HttpOnly cookie the page cannot read; the browser
   sends it on same-origin requests. Every request carries the client header
   the API requires on writes, which a cross-site page cannot add. */
const CLIENT_HEADER = { "x-babel-client": "1" };
let apiBasePromise = null;
let apiBaseFailedAt = 0;

// Sessions from before cookie sign-in kept a token in storage; it is no longer
// used, so it is removed rather than left behind.
Store.del("token");

export function resolveApiBase() {
  // A failed probe is remembered only briefly: a serverless cold start (or a
  // dropped connection) shouldn't leave the whole session in offline mode.
  if (apiBasePromise && !(apiBaseFailedAt && Date.now() - apiBaseFailedAt > 20000)) return apiBasePromise;
  apiBaseFailedAt = 0;
  apiBasePromise = (async () => {
    // Same-origin only (in development Vite proxies /api to the local server).
    // A generous timeout, because the first hit may be waking the function.
    try {
      const res = await fetch("/api/health", { signal: AbortSignal.timeout(4500) });
      if (res.ok) return "/api";
    } catch (e) {
      /* offline: fall through */
    }
    apiBaseFailedAt = Date.now();
    return null;
  })();
  return apiBasePromise;
}

export async function apiFetch(path, opts = {}) {
  const base = await resolveApiBase();
  if (!base) throw new Error("backend unreachable");
  const headers = Object.assign({ "content-type": "application/json" }, CLIENT_HEADER, opts.headers || {});
  const res = await fetch(base + path, Object.assign({}, opts, { headers, credentials: "same-origin" }));
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "Request failed"), { status: res.status, data });
  return data;
}

/* ---------- saved-words cache (sync read for render code) ---------- */
let savedCache = new Set(Store.get("savedSlugs", []));
function persistSaved() {
  Store.set("savedSlugs", [...savedCache]);
}
// True when the signed-in profile belongs to a server account (not the
// device-only offline demo profile).
const hasServerSession = () => !!Store.get("authUser", null)?.server;

export async function hydrateSavedFromBackend() {
  if (!hasServerSession()) return;
  try {
    const rows = await apiFetch("/user/saved");
    savedCache = new Set(rows.map((r) => r.slug));
    persistSaved();
  } catch (e) {
    /* keep local */
  }
}

export const API = {
  currentUser() {
    return Store.get("authUser", null);
  },
  /* Confirms a remembered server profile still has a live session; an expired
     or revoked session signs the profile out. Offline, the profile is kept. */
  async restoreSession() {
    if (!hasServerSession()) return;
    try {
      const me = await apiFetch("/user/me");
      Store.set("authUser", { email: me.email, name: me.name, server: true });
    } catch (e) {
      if (e.status === 401) this.logout();
    }
  },
  wordOfDay() {
    const day = Math.floor(Date.now() / 864e5);
    return VISIBLE_WORDS[day % VISIBLE_WORDS.length];
  },
  categories() {
    const c = categoryCounts();
    return CATEGORIES.map((x) => ({ ...x, count: c[x.key] }));
  },
  saved() {
    return [...savedCache];
  },
  isSaved(slug) {
    return savedCache.has(slug);
  },
  async toggleSave(slug) {
    const has = savedCache.has(slug);
    if (has) savedCache.delete(slug);
    else savedCache.add(slug);
    persistSaved();
    try {
      await apiFetch("/user/saved/" + slug, { method: has ? "DELETE" : "POST" });
    } catch (e) {
      /* offline: local cache already updated */
    }
    return { saved: savedCache.has(slug) };
  },
  track(event, data = {}) {
    const log = Store.get("events", []);
    log.push({ event, data, t: Date.now() });
    Store.set("events", log.slice(-500));
    resolveApiBase().then((base) => {
      if (base)
        fetch(base + "/events", {
          method: "POST",
          headers: { "content-type": "application/json", ...CLIENT_HEADER },
          body: JSON.stringify({ event, slug: data?.slug || "" }),
        }).catch(() => {});
    });
  },
  async submit(sub) {
    try {
      const r = await apiFetch("/submissions", { method: "POST", body: JSON.stringify(sub) });
      return { ok: true, queued: r.queued, flagged: r.flagged, note: r.note };
    } catch (e) {
      // Any answer from the server (refusal, rate limit) is shown; only an
      // unreachable server queues the submission on this device.
      if (e.status) return { ok: false, error: e.data?.error || e.message };
      const list = Store.get("submissions", []);
      list.push({ ...sub, status: "pending", submitted_at: new Date().toISOString() });
      Store.set("submissions", list);
      return { ok: true, queued: list.length, offline: true };
    }
  },
  async saveCard(slug, source) {
    try { await apiFetch("/user/cards/" + slug, { method: "POST", body: JSON.stringify({ source: source || "portrait" }) }); } catch (e) { /* offline */ }
  },
  async savedCards() {
    try { return await apiFetch("/user/cards"); } catch (e) { return []; }
  },
  async unsaveCard(slug) {
    try { await apiFetch("/user/cards/" + slug, { method: "DELETE" }); } catch (e) { /* offline */ }
  },
  async history() {
    try { return await apiFetch("/user/history"); } catch (e) { return []; }
  },
  async register(email, pass, name) {
    try {
      const r = await apiFetch("/auth/register", { method: "POST", body: JSON.stringify({ email, password: pass, name }) });
      Store.set("authUser", { ...r.user, server: true });
      await hydrateSavedFromBackend();
      return { ok: true };
    } catch (e) {
      if (e.status) return { ok: false, error: e.data?.error || e.message };
      const users = Store.get("users", {});
      if (users[email]) return { ok: false, error: "Account already exists." };
      users[email] = { name };
      Store.set("users", users);
      Store.set("authUser", { email, name });
      return { ok: true, offline: true };
    }
  },
  async login(email, pass) {
    try {
      const r = await apiFetch("/auth/login", { method: "POST", body: JSON.stringify({ email, password: pass }) });
      Store.set("authUser", { ...r.user, server: true });
      await hydrateSavedFromBackend();
      return { ok: true };
    } catch (e) {
      if (e.status) return { ok: false, error: e.data?.error || e.message };
      const authUser = { email, name: (Store.get("users", {})[email] || {}).name || email.split("@")[0] };
      Store.set("authUser", authUser);
      return { ok: true, offline: true };
    }
  },
  async updateAccount(name, password, currentPassword) {
    try {
      const body = {};
      if (name != null) body.name = name;
      if (password) Object.assign(body, { password, currentPassword });
      const r = await apiFetch("/user/me", { method: "PATCH", body: JSON.stringify(body) });
      if (r.user) Store.set("authUser", { ...r.user, server: true });
      else if (name != null) Store.set("authUser", { ...(Store.get("authUser", {}) || {}), name });
      return { ok: true };
    } catch (e) {
      if (e.status) return { ok: false, error: e.data?.error || e.message };
      Store.set("authUser", { ...(Store.get("authUser", {}) || {}), name });
      return { ok: true, offline: true };
    }
  },
  async deleteAccount() {
    try { await apiFetch("/user/me", { method: "DELETE" }); }
    catch (e) { if (e.status) return { ok: false, error: e.data?.error || e.message }; }
    this.logout();
    return { ok: true };
  },
  logout() {
    if (hasServerSession()) apiFetch("/auth/logout", { method: "POST" }).catch(() => {});
    Store.del("authUser");
    savedCache = new Set();
    persistSaved();
  },
};
