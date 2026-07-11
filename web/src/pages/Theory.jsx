import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { WORDS_BY_SLUG } from "../data/index.js";
import Footer from "../components/Footer.jsx";

const SECTIONS = [
  ["s1", "The central question"], ["s2", "The Sapir-Whorf hypothesis"], ["s3", "The Boroditsky colour test"],
  ["s4", "The philosophers"], ["s5", "What Babel believes"], ["s6", "Further reading"],
];
const SEC_IDS = SECTIONS.map((s) => s[0]);
const READING = [
  ["How Emotions Are Made", "Lisa Feldman Barrett", "On emotional granularity — the more emotion concepts you have, the more finely you feel."],
  ["The Positive Lexicography", "Tim Lomas", "The scholarly project this atlas is a spiritual cousin to."],
  ["Metaphors We Live By", "Lakoff & Johnson", "Cognitive semantics — thought is structured by the language we think in."],
  ["Philosophical Investigations", "Ludwig Wittgenstein", "Meaning is use; a word lives in the life that surrounds it."],
  ["Through the Language Glass", "Guy Deutscher", "A readable defence of the weak Whorfian position."],
  ["Don't Sleep, There Are Snakes", "Daniel Everett", "The Pirahã and the limits of linguistic universals."],
];

export default function Theory() {
  const navigate = useNavigate();
  const [active, setActive] = useState("s1");
  const [progress, setProgress] = useState(0);
  const [boro, setBoro] = useState(null);

  const IW = ({ slug, label }) => (
    <span className="inline-word" title={WORDS_BY_SLUG[slug]?.defShort} onClick={() => navigate(`/word/${slug}`)}>
      {label || WORDS_BY_SLUG[slug].word}
    </span>
  );

  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      setProgress((h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100);
      let a = SEC_IDS[0];
      SEC_IDS.forEach((id) => { const el = document.getElementById(id); if (el && el.getBoundingClientRect().top < 160) a = id; });
      setActive(a);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="page-fade">
      <div className="scroll-progress" style={{ width: progress + "%" }}></div>
      <section className="section">
        <div className="wrap-wide">
          <div className="theory-layout">
            <div className="progress-rail" id="rail">
              {SECTIONS.map((s, i) => (
                <div key={s[0]} style={{ display: "contents" }}>
                  <div className={"rail-dot" + (active === s[0] ? " active" : "") + (SEC_IDS.indexOf(s[0]) < SEC_IDS.indexOf(active) ? " done" : "")} data-sec={s[0]} />
                  {i < SECTIONS.length - 1 && <div className="rail-line" />}
                </div>
              ))}
            </div>
            <article className="essay">
              <span className="eyebrow">The intellectual spine</span>
              <h1 style={{ margin: "1rem 0 1.2rem" }}>Language does not imprison thought. It illuminates it.</h1>
              <p style={{ fontSize: 12.5, fontStyle: "italic", color: "var(--text-muted)", borderLeft: "2px solid var(--amber)", paddingLeft: 16, marginBottom: "2rem" }}>
                In brief: Babel argues language doesn't cage thought but illuminates it — a part of the Sapir-Whorf hypothesis. A word for a feeling won't create the feeling, but it can help you notice it. This essay covers the evidence, the philosophers behind that claim, and what Babel itself believes.
              </p>

              <div id="s1">
                <div className="sec-divider"><span>§ 01</span></div>
                <p className="dropcap">The central question of this whole project is deceptively simple: does having a word for a feeling change how often you have it? Babel does not claim that language builds a cage around the mind. It holds the gentler, better-evidenced position — that a word is a flashlight. Knowing <IW slug="komorebi" /> will not give you the experience of sunlight through leaves. But it might make you stop in it more often.</p>
                <p>When you cannot name something, you can still feel it — but you feel it in the dark. Every untranslatable word in this atlas is a light pointed at something already there in human experience, unnamed and therefore harder to hold.</p>
              </div>

              <div id="s2">
                <div className="sec-divider"><span>§ 02</span></div>
                <h2>The Sapir-Whorf hypothesis</h2>
                <p>The <b>strong form</b> — that language determines thought, that you cannot think what you cannot say — is discredited. The <b>weak form</b> — linguistic relativity, that language <i>influences</i> habitual thought and attention — is alive and supported by evidence. <IW slug="saudade" /> does not create longing in the Portuguese; it gives the longing a home, a shape, a name to return to.</p>
                <p className="essay-quote">The limits of my language mean the limits of my world. — Wittgenstein, <i>Tractatus</i></p>
              </div>

              <div id="s3">
                <div className="sec-divider"><span>§ 03</span></div>
                <h2>The Boroditsky colour test</h2>
                <p>Russian has no single word for "blue": it obligates a choice between <i>goluboy</i> (light blue) and <i>siniy</i> (dark blue). Lera Boroditsky's studies found Russian speakers discriminate blues near that boundary measurably faster — about <b>124 milliseconds</b> — than English speakers. The language trained the eye. Try it:</p>
                <div className="boroditsky">
                  <span className="label">Are these two blues the same or different?</span>
                  <div className="swatches"><div className="swatch" style={{ background: "#5b8fd6" }}></div><div className="swatch" style={{ background: "#3f6fbf" }}></div></div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                    <button className="btn btn-ghost" onClick={() => setBoro("same")}>Same</button>
                    <button className="btn btn-ghost" onClick={() => setBoro("diff")}>Different</button>
                  </div>
                  <p style={{ marginTop: 14, fontSize: 12.5 }}>
                    {boro && (
                      <>They <b>are</b> different — <i>goluboy</i> and <i>siniy</i> to a Russian speaker. Boroditsky found Russian speakers told them apart ~124ms faster than English speakers. {boro === "diff" ? "You saw it too." : "English blurs them into one 'blue'."} The word trains the eye.</>
                    )}
                  </p>
                </div>
              </div>

              <div id="s4">
                <div className="sec-divider"><span>§ 04</span></div>
                <h2>The philosophers</h2>
                <p><b>Wittgenstein</b> gave us the limit: the edges of language are the edges of the sayable world. <b>Heidegger</b> called language "the house of being" — a word lets a thing shine forth as what it is, which is exactly what <IW slug="komorebi" /> does for forest light. <b>Derrida</b> treated untranslatability not as failure but as a fertile zone — the place where meaning is richest is precisely where it refuses to cross over cleanly, as with <IW slug="han" />.</p>
              </div>

              <div id="s5">
                <div className="sec-divider"><span>§ 05</span></div>
                <h2>What Babel believes</h2>
                <p className="essay-quote">Human emotional experience is vastly richer than the vocabulary any single language provides. Every named feeling is a small act of rescue — a light pointed at something that was always there.</p>
              </div>

              <div id="s6">
                <div className="sec-divider"><span>§ 06</span></div>
                <h2>Further reading</h2>
                {READING.map(([t, a, d]) => (
                  <div key={t} className="card" style={{ marginBottom: 12 }}>
                    <div className="wc-word" style={{ fontSize: "1.2rem" }}>{t}</div>
                    <span className="wc-meta">{a}</span>
                    <p style={{ fontSize: 12, marginTop: 6 }}>{d}</p>
                  </div>
                ))}
              </div>
            </article>

            <aside className="theory-toc" id="toc">
              <div className="label label-line">Contents</div>
              {SECTIONS.map((s) => (
                <a key={s[0]} className={active === s[0] ? "active" : ""} data-sec={s[0]} style={{ cursor: "pointer" }} onClick={() => scrollTo(s[0])}>{s[1]}</a>
              ))}
              <div className="sidebar-box" style={{ marginTop: 20 }}>
                <span className="label">Words mentioned</span>
                {["komorebi", "saudade", "han"].map((s) => (
                  <div key={s} className="index-row" onClick={() => navigate(`/word/${s}`)}>
                    <span className="ir-word" style={{ fontSize: 13 }}>{WORDS_BY_SLUG[s].word}</span>
                    <span className="ir-dist">{WORDS_BY_SLUG[s].dist}%</span>
                  </div>
                ))}
              </div>
              <Link className="btn btn-amber btn-full" to="/name-my-feeling" style={{ marginTop: 14 }}>Find the word for what you're carrying →</Link>
            </aside>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
