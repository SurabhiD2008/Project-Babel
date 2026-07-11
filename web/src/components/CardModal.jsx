import { useMemo } from "react";
import { Link } from "react-router-dom";
import { WORDS_BY_SLUG } from "../data/index.js";
import { cardDataURL } from "../lib/card.js";
import { useModal } from "../context/ModalContext.jsx";

export default function CardModal({ slug, source, onClose }) {
  const w = WORDS_BY_SLUG[slug];
  const { shareCardTo, download } = useModal();
  const url = useMemo(() => (w ? cardDataURL(w) : ""), [slug]); // eslint-disable-line
  if (!w) return null;
  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <button className="close" onClick={onClose}>×</button>
        <span className="eyebrow">Image card</span>
        <h3 style={{ margin: "8px 0 10px" }}>
          {w.word} <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--amber-dim)" }}>{w.language.toUpperCase()}</span>
        </h3>
        <img className="card-preview" src={url} alt={`Image card for ${w.word} — ${w.defShort}`} />
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <button className="btn btn-amber" style={{ flex: 1 }} onClick={() => shareCardTo(slug, source)}>Share Card ↗</button>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => download(slug, source)}>Download ⬇</button>
          <Link className="btn btn-ghost" to={`/word/${slug}`} onClick={onClose}>Open portrait →</Link>
        </div>
      </div>
    </div>
  );
}
