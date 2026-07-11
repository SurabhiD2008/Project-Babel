import { Store } from "./store.js";
import { VISIBLE_WORDS, CATEGORIES, categoryCounts } from "../data/index.js";

/* ---------- backend client (real API first, localStorage fallback) ---------- */
let apiBasePromise = null;
export function resolveApiBase() {
  if (apiBasePromise) return apiBasePromise;
  apiBasePromise = (async () => {
    for (const base of ["/api", "http://localhost:4600/api"]) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 900);
        const res = await fetch(base + "/health", { signal: ctrl.signal });
        clearTimeout(t);
        if (res.ok) return base;
      } catch (e) {
        /* try next */
      }
    }
    return null;
  })();
  return apiBasePromise;
}

export async function apiFetch(path, opts = {}) {
  const base = await resolveApiBase();
  if (!base) throw new Error("backend unreachable");
  const token = Store.get("token", null);
  const headers = Object.assign(
    { "content-type": "application/json" },
    opts.headers || {},
    token ? { Authorization: "Bearer " + token } : {}
  );
  const res = await fetch(base + path, Object.assign({}, opts, { headers }));
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "Request failed"), { status: res.status, data });
  return data;
}

/* ---------- saved-words cache (sync read for render code) ---------- */
let savedCache = new Set(Store.get("savedSlugs", []));
function persistSaved() {
  Store.set("savedSlugs", [...savedCache]);
}
export async function hydrateSavedFromBackend() {
  if (!Store.get("token", null)) return;
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
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ event, slug: data?.slug || "" }),
        }).catch(() => {});
    });
  },
  async submit(sub) {
    try {
      const r = await apiFetch("/submissions", { method: "POST", body: JSON.stringify(sub) });
      return { ok: true, queued: r.queued, flagged: r.flagged, note: r.note };
    } catch (e) {
      if (e.status === 422) return { ok: false, error: e.data?.error || e.message };
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
      Store.set("token", r.token);
      Store.set("authUser", r.user);
      await hydrateSavedFromBackend();
      return { ok: true };
    } catch (e) {
      if (e.status) return { ok: false, error: e.data?.error || e.message };
      const users = Store.get("users", {});
      if (users[email]) return { ok: false, error: "Account already exists." };
      users[email] = { name };
      Store.set("users", users);
      Store.set("authUser", { email, name });
      Store.set("token", null);
      return { ok: true, offline: true };
    }
  },
  async login(email, pass) {
    try {
      const r = await apiFetch("/auth/login", { method: "POST", body: JSON.stringify({ email, password: pass }) });
      Store.set("token", r.token);
      Store.set("authUser", r.user);
      await hydrateSavedFromBackend();
      return { ok: true };
    } catch (e) {
      if (e.status) return { ok: false, error: e.data?.error || e.message };
      const authUser = { email, name: (Store.get("users", {})[email] || {}).name || email.split("@")[0] };
      Store.set("authUser", authUser);
      return { ok: true, offline: true };
    }
  },
  async updateAccount(name, password) {
    try {
      const body = {};
      if (name != null) body.name = name;
      if (password) body.password = password;
      const r = await apiFetch("/user/me", { method: "PATCH", body: JSON.stringify(body) });
      if (r.user) Store.set("authUser", r.user);
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
    Store.del("token");
    Store.del("authUser");
    savedCache = new Set();
    persistSaved();
  },
};
