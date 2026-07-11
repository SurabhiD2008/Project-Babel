import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { composeAnalyse } from "../lib/feeling.js";
import { escHtml } from "../lib/util.js";
import { useModal } from "../context/ModalContext.jsx";
import { toast } from "../lib/ui.js";
import Footer from "../components/Footer.jsx";

export default function Composer() {
  const navigate = useNavigate();
  const { download } = useModal();
  const [text, setText] = useState("");
  const [found, setFound] = useState([]);
  const [tab, setTab] = useState("write");
  const words = (text.trim().match(/\S+/g) || []).length;

  async function analyse() {
    if (!text.trim()) { toast("Write something first"); return; }
    const f = await composeAnalyse(text);
    setFound(f);
    setTab("annotated");
    toast(`${f.length} untranslatable moments found`);
  }

  function copyText() {
    navigator.clipboard.writeText(text).then(() => toast("Copied to clipboard"));
  }
  function shareCards() {
    if (!found.length) { toast("Analyse your text first"); return; }
    found.forEach((f, i) => setTimeout(() => download(f.slug, "compose", { silent: true }), i * 350));
    toast(`Downloading ${found.length} image card${found.length > 1 ? "s" : ""}…`);
  }

  function annotatedHTML() {
    let html = text ? escHtml(text) : "<span style='color:var(--text-faint)'>Nothing written yet.</span>";
    found.forEach((f) => {
      const safe = escHtml(f.phrase);
      const tip = escHtml(`${f.lang}: ${f.word} — ${f.def}`);
      html = html.replace(safe, `<span class="mark" data-slug="${f.slug}" title="${tip}">${safe}</span>`);
    });
    return html;
  }

  return (
    <div className="page-fade">
      <section className="section">
        <div className="wrap-wide">
          <span className="eyebrow">Finds the untranslatable moments in your own words</span>
          <h1 style={{ margin: ".8rem 0" }}>Composer</h1>
          <p style={{ maxWidth: "60ch", marginBottom: "1.5rem" }}>
            Write anything — a memory, a paragraph, a mood. Babel reads your prose and underlines the moments that already have a name in another language.
          </p>
          <div className="compose-layout">
            <div>
              <div className="tabbar">
                <button className={tab === "write" ? "active" : ""} onClick={() => setTab("write")}>Write</button>
                <button className={tab === "annotated" ? "active" : ""} onClick={() => setTab("annotated")}>Annotated</button>
              </div>
              <div className="compose-editor" id="composeEditor">
                {tab === "write" ? (
                  <>
                    <div className="ghost-word" style={{ right: 0, bottom: "-10%" }}>λέξις</div>
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="I kept going back to the window, unable to sit still, waiting for a car that never came. The afternoon light fell soft through the leaves and I felt a longing for somewhere I had never been…"
                    />
                  </>
                ) : (
                  <div
                    className="annotated page-fade"
                    onClick={(e) => { const s = e.target.dataset?.slug; if (s) navigate(`/word/${s}`); }}
                    dangerouslySetInnerHTML={{ __html: annotatedHTML() }}
                  />
                )}
              </div>
              <div className="compose-footer">
                <span className="stat-line">{words} words · {found.length} untranslatable moments found</span>
                <button className="btn btn-amber" onClick={analyse}>Analyse my text →</button>
              </div>
            </div>
            <aside>
              <div className="label label-line">Words found in your text <span>{found.length ? `(${found.length})` : ""}</span></div>
              <div id="palette">
                {found.length ? (
                  found.map((f, i) => (
                    <div key={i} className="palette-card">
                      <span className="wc-meta">{f.lang}</span>
                      <div className="wc-word" style={{ fontSize: "1.3rem" }}>{f.word}</div>
                      <div className="wc-def" style={{ minHeight: "auto" }}>{f.def}</div>
                      <div className="quote">“{f.phrase.slice(0, 80)}{f.phrase.length > 80 ? "…" : ""}”</div>
                      <Link className="wc-open" style={{ opacity: 1 }} to={`/word/${f.slug}`}>Open portrait →</Link>
                    </div>
                  ))
                ) : (
                  <p style={{ fontSize: 12 }}>Write something and analyse it to see the untranslatable words hidden in your prose.</p>
                )}
              </div>
              <div className="export-box">
                <span className="label" style={{ marginBottom: 10, display: "block" }}>Export</span>
                <button className="btn btn-ghost btn-full" onClick={copyText}>Copy annotated text</button>
                <button className="btn btn-ghost btn-full" onClick={shareCards}>Download Image Cards ⬇</button>
              </div>
            </aside>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
