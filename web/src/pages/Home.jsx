import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { VISIBLE_WORDS, LANGUAGES, WORDS } from "../data/index.js";
import { API } from "../lib/api.js";
import { dimLabel } from "../lib/util.js";
import { useModal } from "../context/ModalContext.jsx";
import WordCard from "../components/WordCard.jsx";
import DistBar from "../components/DistBar.jsx";
import Footer from "../components/Footer.jsx";

export default function Home() {
  const navigate = useNavigate();
  const { openCard } = useModal();
  const [q, setQ] = useState("");
  const top = [...VISIBLE_WORDS].sort((a, b) => b.dist - a.dist);
  const featured = API.wordOfDay();
  const mini = top.slice(0, 4);
  const step = Math.ceil(VISIBLE_WORDS.length / 48);
  const tickerPool = VISIBLE_WORDS.filter((_, i) => i % step === 0).slice(0, 48);

  function heroSearch() {
    if (!q.trim()) return;
    navigate("/name-my-feeling?q=" + encodeURIComponent(q.trim()));
  }

  const Ticker = () =>
    tickerPool.map((w) => (
      <span key={w.slug} className="ticker-item" title={`Open ${w.word}'s image card`} onClick={() => openCard(w.slug, "ticker")}>
        {w.word}
        <small>{w.language.slice(0, 3).toUpperCase()}</small>
      </span>
    ));

  return (
    <div className="page-fade">
      <section className="hero">
        <div className="wrap-wide">
          <div className="ghost-word" style={{ right: "-4%", bottom: "-6%" }}>{featured.native || featured.word}</div>
          <div className="hero-grid">
            <div>
              <span className="eyebrow">An atlas of untranslatable words</span>
              <h1 style={{ margin: "1rem 0" }}>
                You've felt it.<br />
                <span className="strike">English</span> another<br />language named it.
              </h1>
              <div className="search-cta">
                <input
                  id="heroSearch"
                  placeholder="Describe a feeling you can't name…"
                  aria-label="Describe a feeling"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && heroSearch()}
                />
                <button className="btn btn-amber" onClick={heroSearch}>Search →</button>
              </div>
              <p className="hero-sub">
                Input a raw, unnamed feeling. Babel reads it and offers the closest of {WORDS.length} words across {LANGUAGES.length} languages — its best estimate, not the last word.
              </p>
              <div className="stat-row">
                <div className="stat"><div className="n">{WORDS.length}</div><div className="l">Words</div></div>
                <div className="stat"><div className="n">{LANGUAGES.length}</div><div className="l">Languages</div></div>
                <div className="stat"><div className="n">6</div><div className="l">Dimensions</div></div>
                <div className="stat"><div className="n">1</div><div className="l">Central Question</div></div>
              </div>
            </div>
            <aside className="index-panel">
              <h4>Live word index · by distance</h4>
              {top.slice(0, 7).map((w, i) => (
                <div key={w.slug} className="index-row" onClick={() => navigate(`/word/${w.slug}`)}>
                  <span className="ir-rank">{String(i + 1).padStart(2, "0")}</span>
                  <span className="ir-word">{w.word}</span>
                  <span className="ir-lang">{w.language.slice(0, 3)}</span>
                  <span className="ir-dist">{w.dist}%</span>
                </div>
              ))}
            </aside>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap-wide">
          <div className="label label-line">Word of the day</div>
          <div className="card featured" style={{ padding: 32 }}>
            <span className="glow"></span>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
              <div style={{ flex: 1, minWidth: 260 }}>
                <span className="wc-meta">{featured.language} · {featured.family} · №{String(featured.number).padStart(3, "0")}</span>
                <div className="portrait-word" style={{ fontSize: "clamp(2rem,5vw,3rem)" }}>{featured.word}</div>
                <div className="wc-native">{featured.native || ""} · {featured.phonetic}</div>
                <p style={{ margin: "14px 0", maxWidth: "52ch" }}>{featured.defFull}</p>
                <div style={{ display: "flex", gap: 8, alignItems: "center", maxWidth: 340 }}>
                  <DistBar pct={featured.dist} /><span className="ir-dist">{featured.dist}% distance</span>
                </div>
                <div style={{ marginTop: 18 }}><Link className="btn btn-amber" to={`/word/${featured.slug}`}>Open full portrait →</Link></div>
              </div>
              <div style={{ minWidth: 200 }}>
                <div className="label" style={{ marginBottom: 10 }}>Four dimensions</div>
                {["cognitive", "cultural", "english", "philosophy"].map((k) => (
                  <div key={k} style={{ marginBottom: 10 }}>
                    <span className="label" style={{ color: "var(--amber-dim)" }}>{dimLabel(k)}</span>
                    <p style={{ fontSize: 11, marginTop: 2 }}>{(featured.dims[k] || "").slice(0, 90)}…</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="word-grid" style={{ marginTop: 22 }}>
            {mini.map((w) => <WordCard key={w.slug} w={w} />)}
          </div>
        </div>
      </section>

      <div className="ticker" aria-hidden="true">
        <div className="ticker-track"><Ticker /><Ticker /></div>
      </div>

      <section className="section">
        <div className="wrap-wide">
          <div className="teasers">
            <Link className="teaser" to="/atlas"><span className="label">01 · Library</span><h3>The Atlas</h3><p style={{ fontSize: 12.5 }}>All {WORDS.length} words, browsable, filterable, sortable.</p><span className="arrow">→</span></Link>
            <Link className="teaser" to="/map"><span className="label">02 · Network</span><h3>Language Map</h3><p style={{ fontSize: 12.5 }}>The whole atlas as a force-directed network.</p><span className="arrow">→</span></Link>
            <Link className="teaser" to="/theory"><span className="label">03 · Essay</span><h3>Theory</h3><p style={{ fontSize: 12.5 }}>Does naming a feeling change how often you have it?</p><span className="arrow">→</span></Link>
          </div>
        </div>
      </section>

      <section className="pullquote">
        <div className="wrap">
          <q>The limits of my language mean the limits of my world.</q>
          <span className="cite">Ludwig Wittgenstein</span>
        </div>
      </section>
      <Footer />
    </div>
  );
}
