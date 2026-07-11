import { Link } from "react-router-dom";
import { NAV } from "../lib/util.js";
import { WORDS, LANGUAGES } from "../data/index.js";

export default function Footer() {
  const scripts = ["λόγος", "木漏れ日", "саудаде", "سَعادة", "hiraeth"];
  return (
    <footer>
      <div className="wrap-wide">
        <div className="footer-scripts">
          {scripts.map((s, i) => (
            <span key={i} style={{ top: 10 + i * 16 + "%", left: ((i * 19 + 5) % 85) + "%" }}>{s}</span>
          ))}
        </div>
        <div className="footer-inner">
          <div>
            <div className="logo">Babel</div>
            <p style={{ fontSize: 11, maxWidth: "30ch", marginTop: 8 }}>
              An atlas of untranslatable words. {WORDS.length} entries, {LANGUAGES.length} languages, six dimensions each.
            </p>
          </div>
          <div className="navlinks" style={{ flexDirection: "column", gap: 8 }}>
            {NAV.map(([h, t]) => <Link key={h} to={h}>{t}</Link>)}
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-faint)", letterSpacing: ".12em" }}>
            © {new Date().getFullYear()} PROJECT BABEL<br />BUILT BY SURABHI DATTA<br />
            <Link to="/admin" style={{ color: "var(--text-faint)" }}>Admin</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
