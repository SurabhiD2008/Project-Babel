import { useState, useMemo, useEffect, useRef } from "react";
import { Link, useNavigate, useNavigationType, useSearchParams } from "react-router-dom";
import { WORDS, VISIBLE_WORDS, LANGUAGE_FAMILIES } from "../data/index.js";
import { API } from "../lib/api.js";
import { searchWords } from "../lib/search.js";
import WordCard from "../components/WordCard.jsx";
import Footer from "../components/Footer.jsx";

const PER = 20;
const SORTERS = {
  dist: (a, b) => b.dist - a.dist,
  az: (a, b) => a.word.localeCompare(b.word),
  num: (a, b) => a.number - b.number,
  intensity: (a, b) => (b.intensity || 0) - (a.intensity || 0),
};

// Where you left the Atlas (search, filters, how far you'd loaded). Coming back
// with the browser's Back button returns you to exactly that; a fresh visit
// starts clean.
let remembered = null;

export default function Atlas() {
  const cats = API.categories();
  const families = ["All", ...LANGUAGE_FAMILIES];
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const back = useNavigationType() === "POP" ? remembered : null;
  const linkedCategory = cats.some((c) => c.key === params.get("category")) ? params.get("category") : null;
  const [q, setQ] = useState(back?.q ?? "");
  const [family, setFamily] = useState(back?.family ?? "All");
  const [category, setCategory] = useState(back ? back.category : linkedCategory);
  const [band, setBand] = useState(back?.band ?? null);
  const [script, setScript] = useState(back?.script ?? "All");
  const [sort, setSort] = useState(back?.sort ?? "dist");
  const [page, setPage] = useState(back?.page ?? 1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [instantOpen, setInstantOpen] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const searchBox = useRef(null);

  useEffect(() => { remembered = { q, family, category, band, script, sort, page }; }, [q, family, category, band, script, sort, page]);

  // Click or tab away from the search box → the suggestions fold up.
  useEffect(() => {
    const away = (e) => { if (searchBox.current && !searchBox.current.contains(e.target)) setInstantOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("focusin", away);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("focusin", away); };
  }, []);

  const pick = (setter) => (v) => { setter(v); setPage(1); };

  // Search first (relevance-ranked across every word, hidden ones included),
  // then the filters narrow it.
  const matches = useMemo(() => (q.trim() ? searchWords(q, WORDS) : null), [q]);

  const list = useMemo(() => {
    let l = matches ? matches.slice() : VISIBLE_WORDS.slice();
    if (family !== "All") l = l.filter((w) => w.family === family);
    if (category) l = l.filter((w) => w.category === category);
    if (script !== "All") l = l.filter((w) => w.script === script);
    if (band) {
      const [lo, hi] = band.split("-").map(Number);
      l = l.filter((w) => w.dist >= lo && w.dist < hi + (hi === 100 ? 1 : 0));
    }
    // While searching, the default order is best match first; choosing a
    // different sort still re-orders the matches.
    if (!matches || sort !== "dist") l.sort(SORTERS[sort] || SORTERS.dist);
    return l;
  }, [matches, family, category, band, script, sort]);

  const shown = list.slice(0, page * PER);
  const instant = instantOpen && q.trim() ? list.slice(0, 6) : [];

  function onSearchKey(e) {
    if (e.key === "Escape") { if (instantOpen && instant.length) setInstantOpen(false); else { setQ(""); setPage(1); } setCursor(-1); return; }
    if (!instant.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => (c + 1) % instant.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => (c <= 0 ? instant.length - 1 : c - 1)); }
    else if (e.key === "Enter") {
      // Enter opens the highlighted suggestion; with none highlighted it just
      // commits the search and shows the full results below.
      if (cursor >= 0 && instant[cursor]) { e.preventDefault(); navigate(`/word/${instant[cursor].slug}`); }
      else { setInstantOpen(false); e.currentTarget.blur(); }
    }
  }

  return (
    <div className="page-fade">
      <div className="atlas-top"><div className="inner">
        <div ref={searchBox} style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <input
            className="atlas-search"
            placeholder={`Search ${WORDS.length} words…`}
            aria-label={`Search ${WORDS.length} words`}
            role="combobox"
            aria-expanded={instant.length > 0}
            aria-controls="instant"
            aria-autocomplete="list"
            aria-activedescendant={cursor >= 0 && instant[cursor] ? `instant-${instant[cursor].slug}` : undefined}
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); setInstantOpen(true); setCursor(-1); }}
            onFocus={() => setInstantOpen(true)}
            onKeyDown={onSearchKey}
            autoComplete="off"
            spellCheck={false}
          />
          {instant.length > 0 && (
            <div id="instant" role="listbox">
              <div className="instant-results">
                {instant.map((w, i) => (
                  <Link key={w.slug} id={`instant-${w.slug}`} role="option" aria-selected={i === cursor} className={"instant-row" + (i === cursor ? " active" : "")} to={`/word/${w.slug}`} onMouseEnter={() => setCursor(i)}>
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
          <span key={f} role="button" tabIndex={0} className={"tag" + (family === f ? " active" : "")} onClick={() => pick(setFamily)(f)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(setFamily)(f); } }}>{f}</span>
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
            {shown.length ? shown.map((w, i) => <WordCard key={w.slug} w={w} i={i % PER} />) : <p style={{ gridColumn: "1/-1" }}>No words match these filters.</p>}
          </div>
          {shown.length < list.length && (
            <div style={{ textAlign: "center", margin: "28px 0" }}>
              <button className="btn btn-ghost" onClick={() => setPage((p) => p + 1)}>Load more</button>
            </div>
          )}
          <div className="label label-line">Editor's picks</div>
          <div className="picks-row">
            {[...VISIBLE_WORDS].sort((a, b) => b.dist - a.dist).slice(0, 3).map((w, i) => <WordCard key={w.slug} w={w} i={i} />)}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
