import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { WORDS, LANGUAGES, LANGUAGE_FAMILIES } from "../data/index.js";
import { API, apiFetch } from "../lib/api.js";
import { NAV } from "../lib/util.js";
import { toast } from "../lib/ui.js";
import Footer from "../components/Footer.jsx";

const STACK = ["React (Vite) SPA", "Node.js + Express", "Prisma ORM", "PostgreSQL (Neon)", "JWT + bcrypt auth", "Claude API", "Offline scoring engine", "Force-directed SVG network", "HTML Canvas", "Trie search"];
const DEFAULT_STATUS = "Screened for duplicates, accuracy, and vague entries, then reviewed by hand before addition.";

export default function About() {
  const [f, setF] = useState({ word: "", language: "", why: "", name: "", email: "" });
  const [status, setStatus] = useState(DEFAULT_STATUS);
  const [metrics, setMetrics] = useState(null);
  const upd = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  useEffect(() => {
    let done = false;
    const FALLBACK = { sampleSize: 50, categoryMatchRate: 90, avgResponseMs: 53, live: false };
    apiFetch("/metrics/benchmark").then((m) => { if (!done) setMetrics({ ...m, live: true }); }).catch(() => { if (!done) setMetrics(FALLBACK); });
    return () => { done = true; };
  }, []);

  async function submit() {
    if (!f.word.trim() || !f.language.trim() || !f.why.trim()) { toast("Fill word, language and why"); return; }
    setStatus("Checking against the atlas…");
    const r = await API.submit({ word: f.word.trim(), language: f.language.trim(), why: f.why.trim(), submitter: f.name.trim(), email: f.email.trim() });
    if (!r.ok) { setStatus(`Not queued — ${r.error}`); toast("Submission needs a fix"); return; }
    setF({ word: "", language: "", why: "", name: f.name, email: f.email });
    const flagNote = r.flagged ? " (flagged for a closer look — brief explanation)" : "";
    setStatus(`Thank you — screened for duplicates and queued for review${flagNote}. ${r.queued} awaiting review.`);
    toast(r.offline ? "Submitted (offline — not screened)" : "Submitted for review");
  }

  return (
    <div className="page-fade">
      <section className="section">
        <div className="wrap-wide">
          <div className="about-layout">
            <div>
              <span className="eyebrow">The builder's note</span>
              <h1 style={{ margin: "1rem 0" }}>Why this exists</h1>
              <p>It started with a feeling I couldn't name. Standing in a patch of afternoon light coming through leaves, I felt something specific and complete — and had no word for it. English made me explain it in a whole clumsy sentence. Japanese had it in one: <Link to="/word/komorebi" style={{ color: "var(--amber)" }}>komorebi</Link>. I wondered how many other feelings I was carrying that I'd simply never been handed a word for. Babel is the atlas I went looking for and couldn't find.</p>

              <h2 style={{ margin: "2rem 0 1rem" }}>The gap between feeling and language</h2>
              <p>Human emotional experience is vastly richer than any single language's vocabulary. When you can't name something, you still feel it — but you feel it in the dark. Every word in this atlas is a flashlight pointed at something that was already there.</p>

              <h2 style={{ margin: "2rem 0 1rem" }}>What Babel is not</h2>
              <ul className="not-list">
                <li>Not a translation tool — it maps concepts that resist translation by definition</li>
                <li>Not a dictionary — definitions are multi-dimensional portraits, not entries</li>
                <li>Not a list of "fun foreign words" — every word names a genuine gap in English</li>
                <li>Not neutral — it holds a position: a part of the Sapir-Whorf hypothesis</li>
              </ul>

              <h2 style={{ margin: "2rem 0 1rem" }}>The methodology</h2>
              <p><b>Cognitive distance</b>, in one line: a 0–100% score for how far a concept sits from anything expressible in a single English word — higher means English needs a whole sentence to say what this word says in one. Each word is researched across six dimensions: cognitive science, cultural origin, linguistic structure, nearest English, philosophy, and art. The score itself is an honestly curatorial one — not a scientific measurement — combining semantic distance (·35), cultural specificity (·25), structural untranslatability (·20), and the gap to the nearest English equivalent (·20). Every portrait shows both the curatorial score and the algorithmic composite so you can see the seam. Where the definitions and cross-cultural notes come from is covered honestly on the <Link to="/sources" style={{ color: "var(--amber)" }}>sources page</Link>.</p>

              <h2 style={{ margin: "2rem 0 1rem" }}>The AI integration</h2>
              <p><b>Name My Feeling</b> and <b>Composer</b> run a four-layer engine: phenomenology extraction → semantic matching against all {WORDS.length} word profiles → a bespoke explanation of why <i>this</i> word fits <i>your</i> input → a Sapir-Whorf provocation. Both the word-matching and the explanations are generated by this engine, not hand-picked per query. By default that engine is Babel's own offline scoring model — a heuristic, not a large language model — described honestly on the search page and shown per-result; supply a Claude API key on the server and it upgrades to the full model. The builder designed the prompt schema, the JSON contract, and the matching algorithm; the model (or the algorithm, offline) writes the prose. Where it's the offline engine, treat the result as a best estimate, not a verdict.</p>
              <p id="metricsSentence" style={{ fontSize: 12.5, borderLeft: "2px solid var(--amber)", paddingLeft: 14, color: "var(--text-muted)" }}>
                {metrics ? (
                  <><b>Measured, not claimed:</b> tested across {metrics.sampleSize} independently-written inputs, {metrics.categoryMatchRate}% matched their intended emotion category, average response {metrics.avgResponseMs}ms{metrics.live ? "" : " (cached figures — live server unreachable)"}. Full methodology and per-input results on <Link to="/sources" style={{ color: "var(--amber)" }}>Sources</Link>.</>
                ) : "Measuring accuracy…"}
              </p>

              <h2 style={{ margin: "2rem 0 1rem" }}>Built with</h2>
              <div className="stack-pills">{STACK.map((p) => <span key={p} className="tag">{p}</span>)}</div>

              <h2 style={{ margin: "2.4rem 0 1rem" }}>Submit a word</h2>
              <div className="card" style={{ padding: 22 }}>
                <div className="form-field"><label>The word</label><input value={f.word} onChange={upd("word")} placeholder="e.g. Sobremesa" /></div>
                <div className="form-field"><label>Language</label><input value={f.language} onChange={upd("language")} placeholder="e.g. Spanish" /></div>
                <div className="form-field"><label>Why is it untranslatable?</label><textarea value={f.why} onChange={upd("why")} rows="3" placeholder="What gap in English does it name? (15+ characters)" /></div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <div className="form-field" style={{ flex: 1 }}><label>Your name (optional)</label><input value={f.name} onChange={upd("name")} /></div>
                  <div className="form-field" style={{ flex: 1 }}><label>Email (optional)</label><input value={f.email} onChange={upd("email")} type="email" /></div>
                </div>
                <button className="btn btn-amber" onClick={submit}>Submit for review →</button>
                <p style={{ fontSize: 11, marginTop: 10 }} id="subStatus">{status}</p>
              </div>
            </div>
            <aside>
              <div className="sidebar-box">
                <span className="label">The atlas in numbers</span>
                <div className="mini-stat"><span>Words</span><b>{WORDS.length}</b></div>
                <div className="mini-stat"><span>Languages</span><b>{LANGUAGES.length}</b></div>
                <div className="mini-stat"><span>Families</span><b>{LANGUAGE_FAMILIES.length}</b></div>
                <div className="mini-stat"><span>Dimensions each</span><b>6</b></div>
                <div className="mini-stat"><span>Highest distance</span><b>{Math.max(...WORDS.map((w) => w.dist))}%</b></div>
              </div>
              <div className="builder-card">
                <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14 }}>
                  <div className="avatar">SD</div>
                  <div><div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "1.2rem", color: "var(--warm-bright)" }}>Surabhi Datta</div><span className="wc-meta">Builder · designer</span></div>
                </div>
                <p style={{ fontSize: 12 }}>Interested in language, cognition, and the seam where the two meet. Babel is a portfolio project and a genuine attempt to name what's hard to hold.</p>
                <div className="navlinks" style={{ flexDirection: "column", gap: 6, marginTop: 12 }}>
                  <a href="https://www.linkedin.com/in/surabhi-datta-191a6837a/" target="_blank" rel="noopener">LinkedIn ↗</a>
                  <a href="https://github.com/SurabhiD2008" target="_blank" rel="noopener">GitHub ↗</a>
                </div>
              </div>
              <div className="sidebar-box" style={{ marginTop: 16 }}>
                <span className="label">More pages</span>
                {[["/", "Home"], ...NAV].map(([h, t]) => (
                  <Link key={h} to={h} style={{ display: "block", fontSize: 12, padding: "5px 0", color: "var(--text-muted)" }}>{t} →</Link>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
