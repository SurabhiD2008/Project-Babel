import { useState, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { LANGUAGES, WORDS } from "../data/index.js";
import { feelingSearch } from "../lib/feeling.js";
import { useModal } from "../context/ModalContext.jsx";
import { toast } from "../lib/ui.js";
import DistBar from "../components/DistBar.jsx";
import { setGhostWord } from "../components/GhostWord.jsx";

const EXAMPLES = [
  "The ache of missing a place I've never actually been to",
  "That look between two people who both want to speak first",
  "Sunlight coming through the leaves on a slow afternoon",
];

function engineLabel(r) {
  const eng = (r.engine || "offline").startsWith("claude") ? "Claude AI" : "offline scoring engine";
  const timing = r.responseMs != null ? `${r.cached ? "cached · " : ""}${r.responseMs}ms` : "";
  return `${eng}${timing ? " · " + timing : ""}`;
}

export default function NameMyFeeling() {
  const [params] = useSearchParams();
  const { openCard, download, shareCardTo } = useModal();
  const [text, setText] = useState(params.get("q") || "");
  const [result, setResult] = useState(null);
  const [loadingLang, setLoadingLang] = useState(null); // null = not loading
  const cyc = useRef(null);
  const resultRef = useRef(null);
  const inputRef = useRef(null);
  const run = useRef(0);

  async function search(input) {
    const t = (input ?? text).trim();
    if (t.length < 4) { toast("Describe the feeling a little more"); inputRef.current?.focus(); return; }
    const id = ++run.current; // a newer search supersedes an older one still in flight
    let i = 0;
    setResult(null);
    setLoadingLang(LANGUAGES[0]);
    clearInterval(cyc.current);
    cyc.current = setInterval(() => { i = (i + 1) % LANGUAGES.length; setLoadingLang(LANGUAGES[i]); }, 420);
    if (window.innerWidth < 1024) setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
    // Hold the "searching" beat long enough to read, however fast the answer is.
    const [r] = await Promise.all([feelingSearch(t), new Promise((res) => setTimeout(res, 650))]);
    if (id !== run.current) return;
    clearInterval(cyc.current);
    setLoadingLang(null);
    setResult(r);
    if (r?.bestMatch) setGhostWord(r.bestMatch.native || r.bestMatch.word);
    if (window.innerWidth < 1024) setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  // Auto-run when arriving from the hero search (?q=…)
  useEffect(() => {
    const q = params.get("q");
    if (q && q.trim().length >= 4) search(q);
    return () => { run.current++; clearInterval(cyc.current); };
    // eslint-disable-next-line
  }, []);

  return (
    <div className="page-fade">
      <section className="section">
        <div className="wrap-wide">
          <div className="nmf-grid">
            <div className="nmf-input">
              <span className="eyebrow" style={{ color: "var(--violet)" }}>Semantic search · {LANGUAGES.length} languages</span>
              <h1 style={{ fontSize: "clamp(1.8rem,4vw,2.8rem)", margin: "1rem 0" }}>Describe what you're feeling.</h1>
              <p style={{ marginBottom: ".6rem" }}>
                Write it plainly — the texture, the register, who it involves. Babel reads the phenomenology of what you wrote before it matches, so the result fits <i>your</i> feeling, not just your keywords.
              </p>
              <p style={{ marginBottom: "1.4rem", fontSize: 11.5, color: "var(--text-faint)" }}>
                Honest disclosure: matching runs on Babel's own scoring engine by default. It's a best estimate from {WORDS.length} curated entries, not verified linguistic fact. Measured accuracy is on the <Link to="/about" style={{ color: "var(--amber-dim)" }}>About page</Link>.
              </p>
              <textarea
                ref={inputRef}
                maxLength={300}
                value={text}
                aria-label="Describe what you're feeling"
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); search(); } }}
                placeholder="It's a kind of longing, but sweet — like I'm homesick for something that never happened…"
              />
              <div className="char-count"><span>{text.length}</span>/300</div>
              <div className="chips">
                {EXAMPLES.map((e) => (
                  <span key={e} className="chip" role="button" tabIndex={0} onClick={() => { setText(e); inputRef.current?.focus(); }} onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); setText(e); inputRef.current?.focus(); } }}>{e}</span>
                ))}
              </div>
              <button className="btn btn-amber btn-full" disabled={!!loadingLang} onClick={() => search()}>Search all languages →</button>
              <div className="lang-hint">Searching {LANGUAGES.slice(0, 4).join(" · ")}…</div>
            </div>

            <div className="nmf-result" id="nmfResult" ref={resultRef} aria-live="polite">
              {loadingLang ? (
                <div style={{ minHeight: 250, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div className="loading-word">Searching {loadingLang}…</div>
                </div>
              ) : result ? (
                <div className="page-fade">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                    <span className="match-pill">Best match · {result.matchScore}% semantic fit</span>
                    <span className="wc-meta" title="Which engine actually answered this search">answered by {engineLabel(result)}</span>
                  </div>
                  <div className="card featured" style={{ marginBottom: 16 }}>
                    <span className="glow"></span>
                    <span className="wc-meta">{result.bestMatch.language} · {result.bestMatch.family}</span>
                    <div className="wc-word" style={{ fontSize: "2.2rem" }}>{result.bestMatch.word}</div>
                    <div className="wc-native">{result.bestMatch.native || ""} · {result.bestMatch.phonetic}</div>
                    <p style={{ fontStyle: "italic", fontFamily: "var(--font-display)", color: "var(--warm-bright)", margin: "8px 0" }}>{result.bestMatch.defShort}</p>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}><DistBar pct={result.matchScore} /><span className="ir-dist">{result.matchScore}%</span></div>
                  </div>
                  <div className="label label-line">Cross-language alternatives</div>
                  {result.alternates.map((a) => (
                    <div key={a.slug} className="compare-row alt-row" role="button" tabIndex={0} title={`Open ${a.word}'s image card`} onClick={() => openCard(a.slug, "feeling")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openCard(a.slug, "feeling"); } }}>
                      <span className="cl">{a.lang}<b>{a.word}</b></span>
                      <DistBar pct={a.match} />
                      <span className="cn">{a.match}%</span>
                      <span className="alt-hint">card ↗</span>
                    </div>
                  ))}
                  <div className="sw-box"><span className="label">Sapir-Whorf provocation</span><p dangerouslySetInnerHTML={{ __html: result.sapirWhorf }} /></div>
                  <div className="ai-response" dangerouslySetInnerHTML={{ __html: result.explanation }} />
                  <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                    <Link className="btn btn-amber" to={`/word/${result.bestMatch.slug}`}>Read the full portrait →</Link>
                    <button className="btn btn-ghost" onClick={() => download(result.bestMatch.slug, "feeling")}>Download Image Card ⬇</button>
                    <button className="btn btn-amber" onClick={() => shareCardTo(result.bestMatch.slug, "feeling")}>Share Card ↗</button>
                  </div>
                </div>
              ) : (
                <div className="nmf-empty"><p>The word for what you're carrying<br />is waiting on the left.</p></div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
