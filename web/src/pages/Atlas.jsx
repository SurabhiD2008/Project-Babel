import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { WORDS, VISIBLE_WORDS, LANGUAGE_FAMILIES } from "../data/index.js";
import { API } from "../lib/api.js";
import WordCard from "../components/WordCard.jsx";
import Footer from "../components/Footer.jsx";

const PER = 20;
const SORTERS = {
  dist: (a, b) => b.dist - a.dist,
  az: (a, b) => a.word.localeCompare(b.word),
  num: (a, b) => a.number - b.number,
  intensity: (a, b) => (b.intensity || 0) - (a.intensity || 0),
};

export default function Atlas() {
  const cats = API.categories();
  const families = ["All", ...LANGUAGE_FAMILIES];
  const [q, setQ] = useState("");
  const [family, setFamily] = useState("All");
  const [category, setCategory] = useState(null);
  const [band, setBand] = useState(null);
  const [script, setScript] = useState("All");
  const [sort, setSort] = useState("dist");
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const pick = (setter) => (v) => { setter(v); setPage(1); };

  const list = useMemo(() => {
    let l = q ? WORDS.slice() : VISIBLE_WORDS.slice();
    if (q) {
      const s = q.toLowerCase();
      l = l.filter((w) => (w.word + w.language + w.defShort + w.native).toLowerCase().includes(s));
    }
    if (family !== "All") l = l.filter((w) => w.family === family);
    if (category) l = l.filter((w) => w.category === category);
    if (script !== "All") l = l.filter((w) => w.script === script);
    if (band) {
      const [lo, hi] = band.split("-").map(Number);
      l = l.filter((w) => w.dist >= lo && w.dist < hi + (hi === 100 ? 1 : 0));
    }
    l.sort(SORTERS[sort] || SORTERS.dist);
    return l;
  }, [q, family, category, band, script, sort]);

  const shown = list.slice(0, page * PER);
  const instant = q.trim() ? list.slice(0, 6) : [];

  return (
    <div className="page-fade">
      <div className="atlas-top"><div className="inner">
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <input
            className="atlas-search"
            placeholder={`Search ${WORDS.length} words…`}
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            autoComplete="off"
          />
          {instant.length > 0 && (
            <div id="instant">
              <div className="instant-results">
                {instant.map((w) => (
                  <Link key={w.slug} className="instant-row" to={`/word/${w.slug}`} onClick={() => setQ("")}>
                    <span className="iw">{w.word}</span>
                    <span className="il">{w.language} · {w.dist}%</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
        <span className="result-count" id="atlasCount">{list.length} results</span>
        <select className="control" value={sort} onChange={(e) => pick(setSort)(e.target.value)}>
          <option value="dist">Sort: Distance ↓</option>
          <option value="az">Sort: A–Z</option>
          <option value="num">Sort: Curator's order</option>
          <option value="intensity">Sort: Intensity ↓</option>
        </select>
        <button className="btn btn-ghost filter-toggle" onClick={() => setFiltersOpen((o) => !o)}>Filters</button>
      </div></div>

      <div className="family-strip">
        {families.map((f) => (
          <span key={f} className={"tag" + (family === f ? " active" : "")} onClick={() => pick(setFamily)(f)}>{f}</span>
        ))}
      </div>

      <div className="atlas-body">
        <aside className={"filters" + (filtersOpen ? " open" : "")} id="filters">
          <div className="filter-group">
            <span className="label label-line">Emotion type</span>
            <div className={"filter-opt" + (!category ? " active" : "")} onClick={() => pick(setCategory)(null)}>
              <span>All</span><span className="cnt">{WORDS.length}</span>
            </div>
            {cats.map((c) => (
              <div key={c.key} className={"filter-opt" + (category === c.key ? " active" : "")} onClick={() => pick(setCategory)(c.key)}>
                <span>{c.name}</span><span className="cnt">{c.count}</span>
              </div>
            ))}
          </div>
          <div className="filter-group">
            <span className="label label-line">Cognitive distance</span>
            <p style={{ fontSize: 10.5, color: "var(--text-faint)", marginBottom: 8 }}>
              How far a word sits from anything expressible in one English word — higher = less translatable.
            </p>
            {[["80-100", "80–100%"], ["60-80", "60–80%"], ["40-60", "40–60%"], ["0-40", "Under 40%"]].map(([k, l]) => (
              <div key={k} className={"filter-opt" + (band === k ? " active" : "")} onClick={() => pick(setBand)(k)}><span>{l}</span></div>
            ))}
            <div className={"filter-opt" + (!band ? " active" : "")} onClick={() => pick(setBand)(null)}><span>All bands</span></div>
          </div>
          <div className="filter-group">
            <span className="label label-line">Script</span>
            {["All", "Latin", "Non-Latin"].map((s) => (
              <div key={s} className={"filter-opt" + (script === s ? " active" : "")} onClick={() => pick(setScript)(s)}><span>{s}</span></div>
            ))}
          </div>
        </aside>
        <div>
          <div className="label label-line">The library</div>
          <div className="word-grid" id="atlasGrid">
            {shown.length ? shown.map((w) => <WordCard key={w.slug} w={w} />) : <p style={{ gridColumn: "1/-1" }}>No words match these filters.</p>}
          </div>
          {shown.length < list.length && (
            <div style={{ textAlign: "center", margin: "28px 0" }}>
              <button className="btn btn-ghost" onClick={() => setPage((p) => p + 1)}>Load more</button>
            </div>
          )}
          <div className="label label-line">Editor's picks</div>
          <div className="picks-row">
            {[...VISIBLE_WORDS].sort((a, b) => b.dist - a.dist).slice(0, 3).map((w) => <WordCard key={w.slug} w={w} />)}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
