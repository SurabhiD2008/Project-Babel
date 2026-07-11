import { useRef, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { VISIBLE_WORDS, CATEGORIES, CAT_COLOR, categoryName, categoryCounts, LANGUAGE_FAMILIES } from "../data/index.js";
import DistBar from "../components/DistBar.jsx";
import Footer from "../components/Footer.jsx";

const W = 800, H = 560;
const MODES = [["network", "Network"], ["tree", "Family tree"], ["scatter", "Distance scatter"]];

export default function LanguageMap() {
  const svgRef = useRef(null);
  const tipRef = useRef(null);
  const simRef = useRef(null);
  const stateRef = useRef({ mode: "network", colorBy: "emotion", filterCat: null, selected: null, transform: { x: 0, y: 0, k: 1 }, pausedUntil: 0 });
  const [mode, setMode] = useState("network");
  const [colorBy, setColorBy] = useState("emotion");
  const [filterCat, setFilterCat] = useState(null);
  const [selected, setSelected] = useState(null);
  const counts = categoryCounts();

  useEffect(() => {
    const svg = svgRef.current;
    const tip = tipRef.current;
    if (!svg) return;
    const NS = "http://www.w3.org/2000/svg";
    const S = stateRef.current;
    let killed = false, raf = null, sleeping = false;

    const nodes = VISIBLE_WORDS.map((w) => ({ w, x: W / 2 + (Math.random() - 0.5) * 300, y: H / 2 + (Math.random() - 0.5) * 300, vx: 0, vy: 0, r: 5 + (w.dist / 100) * 9 }));
    const byCat = {};
    nodes.forEach((n) => { (byCat[n.w.category] = byCat[n.w.category] || []).push(n); });
    const links = [];
    Object.values(byCat).forEach((group) => { for (let i = 0; i < group.length; i++) { const a = group[i], b = group[(i + 1) % group.length]; if (group.length > 1) links.push([a, b]); } });
    nodes.forEach((n) => { (n.w.related || []).forEach((rs) => { const t = nodes.find((m) => m.w.slug === rs); if (t) links.push([n, t]); }); });

    function colorOf(n) {
      if (S.colorBy === "family") { const fams = LANGUAGE_FAMILIES; const hue = (fams.indexOf(n.w.family) / fams.length) * 360; return `hsl(${hue},45%,58%)`; }
      if (S.colorBy === "distance") { const t = n.w.dist / 100; return `hsl(${40 - t * 40},${40 + t * 40}%,${60 - t * 15}%)`; }
      return CAT_COLOR[n.w.category];
    }

    svg.innerHTML = "";
    const g = document.createElementNS(NS, "g"); svg.appendChild(g);
    const linkEls = links.map(([a, b]) => { const l = document.createElementNS(NS, "line"); l.setAttribute("stroke", "rgba(184,148,74,.08)"); l.setAttribute("stroke-width", "0.5"); g.appendChild(l); return { l, a, b }; });
    const labelEls = Object.keys(byCat).map((cat) => { const t = document.createElementNS(NS, "text"); t.setAttribute("fill", CAT_COLOR[cat] + "44"); t.setAttribute("font-family", "Space Mono"); t.setAttribute("font-size", "9"); t.setAttribute("text-anchor", "middle"); t.setAttribute("style", "text-transform:uppercase;letter-spacing:2px"); t.textContent = categoryName(cat); g.appendChild(t); return { t, group: byCat[cat] }; });
    const nodeEls = nodes.map((n) => { const c = document.createElementNS(NS, "circle"); c.setAttribute("class", "mapnode"); c.setAttribute("style", "cursor:pointer;transition:r .25s ease, fill .25s ease, opacity .25s ease"); g.appendChild(c); bindNode(c, n); return c; });

    function restyle() {
      const net = S.mode === "network";
      linkEls.forEach(({ l }) => (l.style.display = net ? "" : "none"));
      labelEls.forEach(({ t }) => (t.style.display = net ? "" : "none"));
      for (let i = 0; i < nodeEls.length; i++) {
        const c = nodeEls[i], n = nodes[i];
        const dim = S.filterCat && n.w.category !== S.filterCat, sel = S.selected === n.w.slug;
        c.setAttribute("r", sel ? n.r * 1.4 : n.r); c.setAttribute("fill", colorOf(n));
        c.setAttribute("opacity", dim ? 0.1 : 0.85); c.setAttribute("stroke", sel ? "#F0ECE4" : "none"); c.setAttribute("stroke-width", sel ? 1.5 : 0);
      }
    }
    function positionFrame() {
      const { x, y, k } = S.transform; g.setAttribute("transform", `translate(${x},${y}) scale(${k})`);
      for (let i = 0; i < nodeEls.length; i++) { nodeEls[i].setAttribute("cx", nodes[i].x); nodeEls[i].setAttribute("cy", nodes[i].y); }
      if (S.mode === "network") {
        linkEls.forEach(({ l, a, b }) => { l.setAttribute("x1", a.x); l.setAttribute("y1", a.y); l.setAttribute("x2", b.x); l.setAttribute("y2", b.y); });
        labelEls.forEach(({ t, group }) => { const cx = group.reduce((s, n) => s + n.x, 0) / group.length, cy = group.reduce((s, n) => s + n.y, 0) / group.length; t.setAttribute("x", cx); t.setAttribute("y", cy); });
      }
    }
    function bindNode(c, n) {
      c.addEventListener("mouseenter", (e) => { tip.style.display = "block"; tip.innerHTML = `<div class="mt-word">${n.w.word}</div><div class="mt-def">${n.w.defShort}</div><div class="ir-dist">${n.w.dist}% · ${n.w.language}</div>`; const rect = svg.getBoundingClientRect(); tip.style.left = e.clientX - rect.left + 12 + "px"; tip.style.top = e.clientY - rect.top + 12 + "px"; });
      c.addEventListener("mousemove", (e) => { const rect = svg.getBoundingClientRect(); tip.style.left = e.clientX - rect.left + 12 + "px"; tip.style.top = e.clientY - rect.top + 12 + "px"; });
      c.addEventListener("mouseleave", () => { tip.style.display = "none"; });
      c.addEventListener("click", (e) => { e.stopPropagation(); S.selected = n.w.slug; if (!sleeping) S.pausedUntil = Date.now() + 6000; setSelected(n.w); restyle(); positionFrame(); wake(); });
      c.addEventListener("mousedown", (e) => {
        e.stopPropagation();
        const move = (ev) => { const rect = svg.getBoundingClientRect(); n.fx = (ev.clientX - rect.left - S.transform.x) / S.transform.k; n.fy = (ev.clientY - rect.top - S.transform.y) / S.transform.k; n.x = n.fx; n.y = n.fy; positionFrame(); };
        const up = () => { n.fx = n.fy = null; document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); wake(); };
        document.addEventListener("mousemove", move); document.addEventListener("mouseup", up);
      });
    }
    function stepForce(alpha) {
      for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j]; let dx = a.x - b.x, dy = a.y - b.y; let d2 = dx * dx + dy * dy || 1; const f = 1200 / d2;
        const d = Math.sqrt(d2); dx /= d; dy /= d; a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f;
      }
      links.forEach(([a, b]) => { let dx = b.x - a.x, dy = b.y - a.y; const d = Math.sqrt(dx * dx + dy * dy) || 1; const f = (d - 70) * 0.01; dx /= d; dy /= d; a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f; });
      nodes.forEach((n) => { n.vx += (W / 2 - n.x) * 0.002; n.vy += (H / 2 - n.y) * 0.002; n.vx *= 0.85; n.vy *= 0.85; n.x += n.vx * alpha; n.y += n.vy * alpha; });
    }
    (function precompute() {
      let a = 1; for (let it = 0; it < 240; it++) { stepForce(a); a *= 0.96; }
      nodes.forEach((n) => { n.nx = n.x; n.ny = n.y; });
      const colW = W / CATEGORIES.length;
      CATEGORIES.forEach((c, ci) => { (byCat[c.key] || []).forEach((n, ni) => { n.tx = colW * ci + colW / 2; n.ty = 80 + ni * 28; }); });
      nodes.forEach((n) => { n.x = W / 2 + (Math.random() - 0.5) * 60; n.y = H / 2 + (Math.random() - 0.5) * 60; });
    })();
    function targetFor(n) {
      if (S.mode === "scatter") return [60 + (n.w.dist / 100) * 680, H - 40 - ((n.w.intensity || 60) / 100) * (H - 80)];
      if (S.mode === "tree") return [n.tx, n.ty];
      return [n.nx, n.ny];
    }
    function stepLayout() {
      let mx = 0;
      for (const n of nodes) { if (n.fx != null) continue; const [tx, ty] = targetFor(n); const dx = (tx - n.x) * 0.12, dy = (ty - n.y) * 0.12; n.x += dx; n.y += dy; if (Math.abs(dx) > mx) mx = Math.abs(dx); if (Math.abs(dy) > mx) mx = Math.abs(dy); }
      return mx;
    }
    function frame() {
      raf = null; if (killed) return;
      const paused = S.pausedUntil && Date.now() < S.pausedUntil;
      const mv = paused ? 1 : stepLayout();
      positionFrame();
      if (!paused && mv < 0.08) { sleeping = true; return; }
      raf = requestAnimationFrame(frame);
    }
    function wake() { sleeping = false; if (!raf) raf = requestAnimationFrame(frame); }

    const onWheel = (e) => { e.preventDefault(); const k = S.transform.k * (e.deltaY < 0 ? 1.1 : 0.9); S.transform.k = Math.max(0.4, Math.min(3, k)); positionFrame(); };
    svg.addEventListener("wheel", onWheel, { passive: false });
    let panning = false, pstart = null;
    const onDown = (e) => { if (e.target.classList.contains("mapnode")) return; panning = true; pstart = { x: e.clientX - S.transform.x, y: e.clientY - S.transform.y }; };
    svg.addEventListener("mousedown", onDown);
    const panMv = (e) => { if (panning) { S.transform.x = e.clientX - pstart.x; S.transform.y = e.clientY - pstart.y; positionFrame(); } };
    const panUp = () => { panning = false; };
    window.addEventListener("mousemove", panMv); window.addEventListener("mouseup", panUp);

    simRef.current = {
      restyle, positionFrame, wake,
      morph: () => { restyle(); wake(); },
      zoom: (f) => { if (f === 0) S.transform = { x: 0, y: 0, k: 1 }; else S.transform.k = Math.max(0.4, Math.min(3, S.transform.k * f)); positionFrame(); },
    };
    restyle(); positionFrame(); wake();

    return () => {
      killed = true; if (raf) cancelAnimationFrame(raf);
      svg.removeEventListener("wheel", onWheel); svg.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", panMv); window.removeEventListener("mouseup", panUp);
    };
  }, []);

  function chooseMode(k) { setMode(k); stateRef.current.mode = k; simRef.current?.morph(); }
  function chooseColor(v) { setColorBy(v); stateRef.current.colorBy = v; simRef.current?.morph(); }
  function chooseFilter(cat) { setFilterCat(cat); stateRef.current.filterCat = cat; simRef.current?.restyle(); }
  function zoom(f) { simRef.current?.zoom(f); }

  return (
    <div className="page-fade">
      <section className="section">
        <div className="wrap-wide">
          <span className="eyebrow">The atlas as a network</span>
          <h1 style={{ margin: ".8rem 0" }}>Language Map</h1>
          <p style={{ maxWidth: "60ch", marginBottom: "1rem" }}>
            Every word is a node, sized by cognitive distance, coloured by emotional cluster. Edges link words that share a category. Drag to reposition, scroll to zoom, click to open — the layout pauses briefly when you click so you can read the word.
          </p>
          <div style={{ maxWidth: "66ch", marginBottom: "1.5rem", fontSize: 12.5, color: "var(--text-muted)" }}>
            <div style={{ padding: "3px 0" }}><b style={{ color: "var(--amber-light)" }}>Network</b> — words as a force-directed web, clustered by emotion, with links between related concepts.</div>
            <div style={{ padding: "3px 0" }}><b style={{ color: "var(--amber-light)" }}>Family tree</b> — the same words sorted into columns by emotion category.</div>
            <div style={{ padding: "3px 0" }}><b style={{ color: "var(--amber-light)" }}>Distance scatter</b> — words plotted by cognitive distance (left→right) against emotional intensity (bottom→top).</div>
          </div>
          <div className="map-layout">
            <div>
              <div className="mode-toggle">
                {MODES.map(([k, l]) => (
                  <span key={k} className={"tag" + (mode === k ? " active" : "")} data-mode={k} onClick={() => chooseMode(k)}>{l}</span>
                ))}
                <select className="control" value={colorBy} onChange={(e) => chooseColor(e.target.value)} style={{ marginLeft: 8 }}>
                  <option value="emotion">Colour: Emotion</option>
                  <option value="family">Colour: Family</option>
                  <option value="distance">Colour: Distance</option>
                </select>
              </div>
              <div className="map-canvas-wrap">
                <div className="map-controls">
                  {CATEGORIES.map((c) => (
                    <span key={c.key} className="tag" style={{ borderColor: CAT_COLOR[c.key] + "55", color: CAT_COLOR[c.key] }} onClick={() => chooseFilter(c.key)}>{c.name}</span>
                  ))}
                  <span className="tag" onClick={() => chooseFilter(null)}>All</span>
                </div>
                <svg id="mapSvg" ref={svgRef} viewBox="0 0 800 560"></svg>
                <div className="map-tooltip" ref={tipRef}></div>
                <div className="map-zoom">
                  <button onClick={() => zoom(1.25)}>+</button>
                  <button onClick={() => zoom(0.8)}>−</button>
                  <button onClick={() => zoom(0)} title="reset">◎</button>
                </div>
              </div>
            </div>
            <aside className="map-sidebar">
              <h4>Selected word</h4>
              <div id="mapDrawer">
                {selected ? (
                  <div className="card">
                    <span className="wc-meta">{selected.language}</span>
                    <div className="wc-word" style={{ fontSize: "1.4rem" }}>{selected.word}</div>
                    <div className="wc-def">{selected.defShort}</div>
                    <div className="wc-dist"><DistBar pct={selected.dist} /><span className="num">{selected.dist}%</span></div>
                    <Link className="btn btn-amber btn-full" style={{ marginTop: 12 }} to={`/word/${selected.slug}`}>Open full portrait →</Link>
                  </div>
                ) : (
                  <p style={{ fontSize: 12 }}>Click a node to inspect it.</p>
                )}
              </div>
              <h4 style={{ marginTop: 24 }}>Emotion clusters</h4>
              {CATEGORIES.map((c) => (
                <div key={c.key} className="legend-item" onClick={() => chooseFilter(c.key)}>
                  <span className="legend-dot" style={{ background: CAT_COLOR[c.key] }}></span>{c.name}
                  <span style={{ marginLeft: "auto", color: "var(--text-faint)", fontFamily: "var(--font-mono)", fontSize: 8 }}>{counts[c.key]}</span>
                </div>
              ))}
            </aside>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
