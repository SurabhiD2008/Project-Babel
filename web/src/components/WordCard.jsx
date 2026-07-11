import { Link } from "react-router-dom";
import { API } from "../lib/api.js";
import DistBar from "./DistBar.jsx";
import CatTag from "./CatTag.jsx";
import SpeakButton from "./SpeakButton.jsx";

export default function WordCard({ w }) {
  const saved = API.isSaved(w.slug);
  return (
    <Link className="card page-fade" to={`/word/${w.slug}`} style={{ display: "block" }}>
      <span className="glow" />
      <div className="wc-head">
        <span className="wc-meta">{w.language} · {w.family}</span>
        <span className="wc-meta">№{String(w.number).padStart(3, "0")}</span>
      </div>
      <div className="wc-word-row">
        <div className="wc-word">{w.word}</div>
        <SpeakButton word={w} />
      </div>
      <div className="wc-native">{w.native || ""}</div>
      <div className="wc-def">{w.defShort}</div>
      <div className="wc-dist">
        <DistBar pct={w.dist} />
        <span className="num">{w.dist}%</span>
      </div>
      <div className="wc-cats">
        <CatTag cat={w.category} />
        {saved && <span className="tag active">★ saved</span>}
      </div>
      <span className="wc-open">Open portrait →</span>
    </Link>
  );
}
