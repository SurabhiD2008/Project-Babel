import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { CATEGORIES, CAT_COLOR, WORDS_BY_SLUG } from "../data/index.js";
import { apiFetch } from "../lib/api.js";
import { toast } from "../lib/ui.js";
import DistBar from "../components/DistBar.jsx";
import Footer from "../components/Footer.jsx";

async function adminFetch(path, opts = {}) {
  const key = sessionStorage.getItem("babel:adminKey");
  return apiFetch(path, { ...opts, headers: { "x-admin-key": key || "", ...(opts.headers || {}) } });
}

function BarChart({ entries }) {
  if (!entries.length) return <p style={{ fontSize: 12, color: "var(--text-faint)" }}>No data yet.</p>;
  const max = Math.max(1, ...entries.map((e) => e.value));
  const bw = 48, gap = 18, H = 170, base = H - 28, top = 16, W = entries.length * (bw + gap) + gap;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W, height: "auto" }} role="img" aria-label="bar chart">
      <line x1="0" y1={base} x2={W} y2={base} stroke="rgba(184,148,74,.2)" strokeWidth="0.5" />
      {entries.map((e, i) => {
        const x = gap + i * (bw + gap);
        const h = Math.max(2, Math.round((base - top) * (e.value / max)));
        const y = base - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw} height={h} fill={e.color || "#B8944A"} rx="2" opacity="0.88" />
            <text x={x + bw / 2} y={y - 5} fill="#D4A855" fontFamily="Space Mono" fontSize="10" textAnchor="middle">{e.value}</text>
            <text x={x + bw / 2} y={H - 9} fill="rgba(237,232,222,.6)" fontFamily="Space Mono" fontSize="7.5" textAnchor="middle">{String(e.label).slice(0, 9).toUpperCase()}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Heatmap({ cells }) {
  const max = Math.max(1, ...cells.map((c) => c.value));
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {cells.map((c, i) => {
        const op = (0.16 + (c.value / max) * 0.84).toFixed(2);
        return (
          <div key={i} title={`${c.label}: ${c.value}`} style={{ flex: 1, minWidth: 96, height: 60, borderRadius: 3, background: c.color, opacity: op, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", color: "#07060E" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700 }}>{c.value}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 7, textTransform: "uppercase", letterSpacing: ".06em", textAlign: "center", padding: "0 4px" }}>{c.label}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function Admin() {
  const navigate = useNavigate();
  const [hasKey, setHasKey] = useState(!!sessionStorage.getItem("babel:adminKey"));
  const [keyInput, setKeyInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [data, setData] = useState(null); // { m, subs }
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const m = await adminFetch("/admin/metrics");
      const subs = await adminFetch("/admin/submissions?status=pending");
      setData({ m, subs });
      setLoginError("");
    } catch (e) {
      sessionStorage.removeItem("babel:adminKey");
      setHasKey(false);
      setData(null);
      setLoginError("Wrong key, or the backend isn't running — try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (hasKey) load(); }, [hasKey, load]);

  function login() {
    if (!keyInput.trim()) { toast("Enter the admin key"); return; }
    sessionStorage.setItem("babel:adminKey", keyInput.trim());
    setHasKey(true);
  }
  async function action(id, act) {
    try {
      const r = await adminFetch(`/admin/submissions/${id}/${act}`, { method: "POST" });
      toast(act === "accept" ? (r.added ? `Accepted — “${r.added.word}” added to the atlas` : "Accepted") : "Rejected");
      load();
    } catch (e) { toast("Action failed"); }
  }

  const m = data?.m, subs = data?.subs || [];

  return (
    <div className="page-fade">
      <section className="section"><div className="wrap-wide">
        <span className="eyebrow" style={{ color: "var(--violet)" }}>Admin</span>
        <h1 style={{ margin: "1rem 0" }}>Site metrics</h1>

        {!hasKey && (
          <div className="card" style={{ padding: 22, maxWidth: 420 }}>
            <p style={{ fontSize: 12, marginBottom: 12 }}>Enter the admin key (set as <code>ADMIN_KEY</code> in <code>server/.env</code>) to view usage metrics and moderate submissions.</p>
            <div className="form-field"><label>Admin key</label><input value={keyInput} onChange={(e) => setKeyInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()} type="password" placeholder="••••••••" /></div>
            <button className="btn btn-amber" onClick={login}>View metrics →</button>
            {loginError && <p style={{ fontSize: 11, marginTop: 10, color: "var(--amber-light)" }}>{loginError}</p>}
          </div>
        )}

        <div id="adminBody">
          {hasKey && loading && <p style={{ fontSize: 12, color: "var(--text-faint)" }}>Loading metrics…</p>}
          {hasKey && m && (
            <>
              <div className="picks-row" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", marginBottom: "1.6rem" }}>
                <div className="card"><span className="wc-meta">Users</span><div className="wc-word" style={{ fontSize: "1.8rem" }}>{m.users}</div></div>
                <div className="card"><span className="wc-meta">Saved words</span><div className="wc-word" style={{ fontSize: "1.8rem" }}>{m.savedWords}</div></div>
                <div className="card"><span className="wc-meta">Shared cards</span><div className="wc-word" style={{ fontSize: "1.8rem" }}>{m.sharedCards ?? 0}</div></div>
                <div className="card"><span className="wc-meta">Feeling searches (logged in)</span><div className="wc-word" style={{ fontSize: "1.8rem" }}>{m.userSearches}</div></div>
                <div className="card"><span className="wc-meta">Cached AI responses</span><div className="wc-word" style={{ fontSize: "1.8rem" }}>{m.cachedAiResponses}</div></div>
              </div>

              <div className="label label-line">Event activity <span style={{ color: "var(--text-faint)", fontFamily: "var(--font-mono)", fontSize: 8 }}>bar chart</span></div>
              <div className="card" style={{ marginBottom: "1.6rem" }}><BarChart entries={Object.entries(m.events).map(([k, v]) => ({ label: k, value: v }))} /></div>

              <div className="label label-line">Search activity by emotion category <span style={{ color: "var(--text-faint)", fontFamily: "var(--font-mono)", fontSize: 8 }}>heatmap</span></div>
              <p style={{ fontSize: 10.5, color: "var(--text-faint)", marginBottom: 8 }}>Brighter = more Name-My-Feeling searches landing in that category.</p>
              <div style={{ marginBottom: "1.6rem" }}>
                <Heatmap cells={CATEGORIES.map((c) => { const found = m.mostSearchedCategories.find((x) => x.category === c.key); return { label: c.name, value: found ? found.count : 0, color: CAT_COLOR[c.key] }; })} />
              </div>

              <div className="label label-line">Submissions by status <span style={{ color: "var(--text-faint)", fontFamily: "var(--font-mono)", fontSize: 8 }}>bar chart</span></div>
              <div className="card" style={{ marginBottom: "1.6rem" }}>
                <BarChart entries={Object.entries(m.submissionsByStatus).map(([k, v]) => ({ label: k.replace("rejected_", "rej. "), value: v, color: /reject/.test(k) ? "#C77D5A" : /accept/.test(k) ? "#5FA8A0" : "#B8944A" }))} />
              </div>

              <div className="label label-line">Most-searched categories</div>
              {m.mostSearchedCategories.length ? m.mostSearchedCategories.map((c, i) => (
                <div key={i} className="compare-row"><span className="cl"><b>{c.name}</b></span><DistBar pct={Math.round((c.count / (m.mostSearchedCategories[0].count || 1)) * 100)} /><span className="cn">{c.count}</span></div>
              )) : <p style={{ fontSize: 12, color: "var(--text-faint)" }}>No feeling searches yet.</p>}

              <div className="label label-line" style={{ marginTop: "1.6rem" }}>Most-viewed word portraits</div>
              {m.mostViewedWords.length ? m.mostViewedWords.map((v, i) => (
                <div key={i} className="compare-row"><a className="cl" style={{ cursor: "pointer" }} onClick={() => navigate(`/word/${v.slug}`)}><b>{WORDS_BY_SLUG[v.slug]?.word || v.slug}</b></a><DistBar pct={Math.round((v.views / (m.mostViewedWords[0].views || 1)) * 100)} /><span className="cn">{v.views}</span></div>
              )) : <p style={{ fontSize: 12, color: "var(--text-faint)" }}>No page views logged yet.</p>}

              <div className="label label-line" style={{ marginTop: "1.6rem" }}>Pending review queue ({subs.length})</div>
              {subs.length ? subs.map((s) => (
                <div key={s.id} className="card" style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                    <div><div className="wc-word" style={{ fontSize: "1.2rem" }}>{s.word}</div><span className="wc-meta">{s.language} · {s.status}{s.submitter ? " · " + s.submitter : ""}</span></div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-amber" onClick={() => action(s.id, "accept")}>Accept</button>
                      <button className="btn btn-ghost" onClick={() => action(s.id, "reject")}>Reject</button>
                    </div>
                  </div>
                  <p style={{ fontSize: 12, marginTop: 8 }}>{s.why}</p>
                </div>
              )) : <p style={{ fontSize: 12, color: "var(--text-faint)" }}>Nothing pending — the queue is empty.</p>}
            </>
          )}
        </div>
      </div></section>
      <Footer />
    </div>
  );
}
