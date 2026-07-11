import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { WORDS } from "../data/index.js";
import { apiFetch } from "../lib/api.js";
import Footer from "../components/Footer.jsx";

export default function Sources() {
  const [metrics, setMetrics] = useState(undefined); // undefined = loading, null = unreachable

  useEffect(() => {
    let done = false;
    apiFetch("/metrics/benchmark").then((m) => { if (!done) setMetrics(m); }).catch(() => { if (!done) setMetrics(null); });
    return () => { done = true; };
  }, []);

  return (
    <div className="page-fade">
      <section className="section">
        <div className="wrap">
          <span className="eyebrow">Where the words come from</span>
          <h1 style={{ margin: "1rem 0" }}>Sources & methodology</h1>
          <p style={{ marginBottom: "1.6rem" }}>
            This is a curatorial atlas, not a peer-reviewed lexicon — said plainly, the way the <Link to="/about" style={{ color: "var(--amber)" }}>About page</Link> already describes the cognitive-distance score. Here's honestly what "researched" means for the {WORDS.length} entries.
          </p>

          <h2 style={{ margin: "2rem 0 .8rem" }}>What each entry draws on</h2>
          <ul className="dot-list">
            <li>Standard bilingual dictionaries and Wiktionary/Wikipedia cross-referencing for spelling, native script, and phonetic transcription.</li>
            <li>Published linguistics and cognitive-science work cited by name where it grounds a specific claim — e.g. Lera Boroditsky's colour-perception studies (Theory page), Lisa Feldman Barrett's work on emotional granularity.</li>
            <li>Editorial synthesis: each word's six-dimension portrait (cognitive science, cultural origin, linguistic structure, nearest English, philosophy, art) is written by the builder, informed by the above, not independently fact-checked by a native-speaking linguist for every one of {WORDS.length} entries.</li>
          </ul>

          <h2 style={{ margin: "2rem 0 .8rem" }}>What that means in practice</h2>
          <p style={{ marginBottom: "1rem" }}>
            Treat each portrait as a well-researched starting point, not a definitive linguistic ruling — the way you'd treat a good essay, not a dictionary entry. If you speak one of these languages and something reads wrong, <Link to="/about" style={{ color: "var(--amber)" }}>submit a correction</Link>; community submissions are screened for duplicates and vague entries, then reviewed by hand.
          </p>

          <h2 style={{ margin: "2rem 0 .8rem" }}>Name My Feeling — measured accuracy</h2>
          <p style={{ marginBottom: ".6rem" }}>
            The AI matching engine (§ described on the <Link to="/name-my-feeling" style={{ color: "var(--amber)" }}>search page</Link>) was benchmarked, not just described. Methodology:
          </p>
          <div id="sourcesMetrics" className="card" style={{ padding: 20 }}>
            {metrics === undefined ? (
              <p style={{ fontSize: 12, color: "var(--text-faint)" }}>Loading measured results…</p>
            ) : metrics ? (
              <>
                <p style={{ fontSize: 12.5, marginBottom: 10 }}>{metrics.methodology}</p>
                <div className="mini-stat"><span>Sample size</span><b>{metrics.sampleSize} inputs</b></div>
                <div className="mini-stat"><span>Category match rate</span><b>{metrics.categoryMatchRate}%</b></div>
                <div className="mini-stat"><span>Average match score</span><b>{metrics.avgMatchScore}%</b></div>
                <div className="mini-stat"><span>Average response time</span><b>{metrics.avgResponseMs}ms</b></div>
                <div className="mini-stat"><span>Benchmark last run</span><b>{new Date(metrics.generatedAt).toLocaleDateString()}</b></div>
              </>
            ) : (
              <p style={{ fontSize: 12, color: "var(--text-faint)" }}>
                Live benchmark server unreachable — last known measured result: 50 inputs, 90% category match rate, ~53ms average response. Re-run <code>node scripts/benchmark.js</code> in <code>server/</code> for fresh numbers.
              </p>
            )}
          </div>

          <h2 style={{ margin: "2rem 0 .8rem" }}>Version history</h2>
          <p>
            Started as a 212-word prototype per the original project brief, expanded to 500 words across 121 languages through iterative curation. The cognitive-distance algorithm, recommendation engine, and this sources page were added in review passes after the initial build — see the <Link to="/about" style={{ color: "var(--amber)" }}>About page</Link> for what changed and why.
          </p>
        </div>
      </section>
      <Footer />
    </div>
  );
}
