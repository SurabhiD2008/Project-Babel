import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { WORDS_BY_SLUG, VISIBLE_WORDS } from "../data/index.js";
import { API } from "../lib/api.js";
import { recommend, CogDistance, writeSapirWhorf } from "../lib/engine.js";
import { dimLabel, categoryName, isHiddenName } from "../lib/util.js";
import { useModal } from "../context/ModalContext.jsx";
import SpeakButton from "../components/SpeakButton.jsx";
import DistBar from "../components/DistBar.jsx";
import WordCard from "../components/WordCard.jsx";
import Footer from "../components/Footer.jsx";

const DIM_KEYS = ["cognitive", "cultural", "linguistic", "english", "philosophy", "art"];

export default function WordPortrait() {
  const { slug } = useParams();
  const w = WORDS_BY_SLUG[slug];
  const { download, shareCardTo } = useModal();
  const [saved, setSaved] = useState(() => API.isSaved(slug));
  const [ask, setAsk] = useState("");
  const [answer, setAnswer] = useState(null); // { loading } | { html }

  if (!w) {
    return (
      <div className="wrap section">
        <h1>Word not found</h1>
        <Link className="btn btn-ghost" to="/atlas">← Back to Atlas</Link>
      </div>
    );
  }

  const vis = VISIBLE_WORDS;
  const vidx = vis.indexOf(w);
  let prev, next;
  if (vidx === -1) {
    let after = vis.findIndex((x) => x.number > w.number);
    if (after === -1) after = 0;
    prev = vis[(after - 1 + vis.length) % vis.length];
    next = vis[after % vis.length];
  } else {
    prev = vis[(vidx - 1 + vis.length) % vis.length];
    next = vis[(vidx + 1) % vis.length];
  }

  const recs = recommend(w);
  const cog = CogDistance.compute(w);
  const populatedDims = DIM_KEYS.filter((k) => w.dims[k] && String(w.dims[k]).trim());
  const comps = (w.comparisons || []).filter((c) => !isHiddenName(c.word));
  const showCommunityNote = w.community && populatedDims.length < 6;

  async function toggleSave() {
    const r = await API.toggleSave(slug);
    setSaved(r.saved);
  }

  function askBabel() {
    setAnswer({ loading: true });
    API.track("ask_babel", { slug });
    setTimeout(() => {
      const q = ask.trim();
      const html =
        `<b>${w.word}</b> ${w.dims.cognitive.toLowerCase().startsWith("names") ? "" : "— "}${w.dims.cognitive} ` +
        `In practice: ${w.defShort.toLowerCase()} You'd reach for it ${w.intensity > 70 ? "in a heavy, wholehearted moment" : "in an everyday, low-stakes moment"} — the kind English makes you explain in a whole sentence. ` +
        (q ? `As for “${q}”: the honest answer is that ${w.language} lets you say in one word what English can only circle. ` : "") +
        `<br><br><span style="color:var(--violet)">Sapir-Whorf: ${writeSapirWhorf(w)}</span>`;
      setAnswer({ html });
    }, 700);
  }

  return (
    <div className="page-fade">
      <section className="portrait-mast">
        <div className="wrap">
          <div className="ghost-word" style={{ right: "-2%", top: "10%" }}>{w.native || w.word}</div>
          <div className="breadcrumb">
            <Link to="/atlas">Atlas</Link> <span>/</span> <Link to="/atlas">{categoryName(w.category)}</Link> <span>/</span>{" "}
            <span style={{ color: "var(--amber)" }}>{w.word}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <div className="portrait-word">{w.word}</div>
                <SpeakButton word={w} className="speak-btn-lg" />
              </div>
              <div className="portrait-native">{w.native || ""}</div>
            </div>
            <button className={"save-star" + (saved ? " saved" : "")} title="Save word" onClick={toggleSave}>{saved ? "★" : "☆"}</button>
          </div>
          <div className="portrait-meta">
            <span>Language <b>{w.language}</b></span>
            <span>Family <b>{w.family}</b></span>
            <span>Phonetic <b>{w.phonetic}</b></span>
            <span>Entry <b>№{String(w.number).padStart(3, "0")}</b></span>
            <span>Distance <b>{w.dist}%</b></span>
          </div>
        </div>
      </section>

      <section className="wrap">
        <div className="portrait-nav">
          <Link className="btn btn-ghost" to={`/word/${prev.slug}`}>← {prev.word}</Link>
          <div className="card-actions">
            <button className="btn btn-ghost" onClick={() => download(slug, "portrait")}>Download Image Card ⬇</button>
            <button className="btn btn-amber" onClick={() => shareCardTo(slug, "portrait")}>Share Card ↗</button>
          </div>
          <Link className="btn btn-ghost" to={`/word/${next.slug}`}>{next.word} →</Link>
        </div>

        <div className="distillation">{w.defShort}</div>
        <p style={{ marginBottom: "2rem", fontSize: 14.5 }}>{w.defFull}</p>
        {showCommunityNote && (
          <p style={{ fontSize: 11.5, color: "var(--text-faint)", borderLeft: "2px solid var(--amber)", paddingLeft: 12, margin: "0 0 1.6rem" }}>
            A community-contributed entry, added through the submission queue. Its full six-dimension portrait is still being researched.
          </p>
        )}

        {populatedDims.length > 0 && (
          <>
            <div className="label label-line">The six dimensions</div>
            <div className="dims-grid">
              {populatedDims.map((k) => (
                <div key={k} className="dim"><span className="label">{dimLabel(k)}</span><p>{w.dims[k]}</p></div>
              ))}
            </div>
          </>
        )}

        {w.cultures && w.cultures.length > 0 && (
          <div className="section">
            <div className="label label-line">Held differently across cultures</div>
            <div className="cult-grid">
              {w.cultures.map((c, i) => (
                <div key={i} className="cult"><h4>{c.name}</h4><p>{c.content}</p></div>
              ))}
            </div>
          </div>
        )}

        {comps.length > 0 && (
          <div className="section">
            <div className="label label-line">Closest in other languages</div>
            {comps.map((c, i) => (
              <div key={i} className="compare-row">
                <span className="cl">{c.lang}<b>{c.word}</b></span>
                <DistBar pct={c.sim} />
                <span className="cn">{c.sim}%</span>
              </div>
            ))}
          </div>
        )}

        {w.dims.philosophy && (
          <div className="philos-moment">
            <span className="label">Philosophy moment</span>
            <q style={{ marginTop: 10 }}>{w.dims.philosophy}</q>
            <p style={{ fontStyle: "italic", color: "var(--amber-dim)" }}>Does naming this change how often you notice it?</p>
          </div>
        )}

        <div className="ask-box">
          <span className="label" style={{ color: "var(--violet)" }}>Ask Babel</span>
          <h3 style={{ margin: "8px 0", fontSize: "1.1rem" }}>Ask anything about {w.word}</h3>
          <p style={{ fontSize: 11, color: "var(--text-faint)", margin: "-2px 0 4px" }}>
            Answered from this word's own six-dimension profile (or Claude, if the deployment has a key) — not free-form AI by default.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0" }}>
            <input
              value={ask}
              onChange={(e) => setAsk(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && askBabel()}
              placeholder="e.g. When would I actually use this word?"
              style={{ flex: 1, minWidth: 200, background: "rgba(107,95,232,.06)", border: ".5px solid rgba(107,95,232,.3)", borderRadius: 3, padding: "10px 12px", color: "var(--warm)", fontFamily: "var(--font-display)", fontStyle: "italic", outline: "none" }}
            />
            <button className="btn btn-violet" onClick={askBabel}>Ask →</button>
          </div>
          <div id="askResponse">
            {answer?.loading && <div className="ai-response"><span className="loading-word" style={{ fontSize: "1rem" }}>Consulting Babel…</span></div>}
            {answer?.html && <div className="ai-response" dangerouslySetInnerHTML={{ __html: answer.html }} />}
          </div>
        </div>

        <div className="section">
          <div className="label label-line">If you felt {w.word}, you might feel…</div>
          <div className="nearby-strip">{recs.map((r) => <WordCard key={r.slug} w={r} />)}</div>
        </div>

        <div className="label label-line" style={{ marginTop: "2rem" }}>Cognitive-distance breakdown</div>
        <p style={{ fontSize: 11.5, color: "var(--text-faint)", marginBottom: 6 }}>
          Cognitive distance: how far this concept sits from anything expressible in a single English word.
        </p>
        <p style={{ fontSize: 12 }}>
          Curatorial score <b style={{ color: "var(--amber-light)" }}>{w.dist}%</b> · algorithmic composite <b style={{ color: "var(--amber-light)" }}>{cog}%</b>{" "}
          (semantic ·35 + cultural ·25 + structural ·20 + gap ·20). See <Link to="/about" style={{ color: "var(--amber)" }}>methodology</Link>.
        </p>
      </section>
      <Footer />
    </div>
  );
}
