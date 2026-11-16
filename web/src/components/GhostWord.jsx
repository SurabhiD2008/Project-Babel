import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { WORDS_BY_SLUG } from "../data/index.js";
import { API } from "../lib/api.js";

// The ghost word (spec §4): one large word in its native script, held behind
// the whole site at all times. It follows where you are — the word you're
// reading on a portrait, the word Babel just found for you, λέξις in the
// Composer, λόγος in the essay, and the word of the day everywhere else — and
// cross-fades when it changes.
const EVENT = "babel:ghost";

/* Let a page put its own word behind the site (cleared on the next route). */
export function setGhostWord(text) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: text || "" }));
}

function wordFor(pathname) {
  const m = pathname.match(/^\/word\/([^/]+)/);
  if (m) {
    const w = WORDS_BY_SLUG[decodeURIComponent(m[1])];
    if (w) return w.native || w.word;
  }
  if (pathname.startsWith("/compose")) return "λέξις";
  if (pathname.startsWith("/theory")) return "λόγος";
  const f = API.wordOfDay();
  return f ? f.native || f.word : "";
}

export default function GhostWord() {
  const { pathname } = useLocation();
  const [override, setOverride] = useState("");
  const text = override || wordFor(pathname);
  const [layers, setLayers] = useState(() => [{ id: 0, text, leaving: false }]);
  const nextId = useRef(1);

  useEffect(() => { setOverride(""); }, [pathname]);
  useEffect(() => {
    const on = (e) => setOverride(e.detail || "");
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);

  useEffect(() => {
    setLayers((ls) => {
      const current = ls.find((l) => !l.leaving);
      if (current && current.text === text) return ls;
      return [...ls.filter((l) => !l.leaving).map((l) => ({ ...l, leaving: true })), { id: nextId.current++, text, leaving: false }];
    });
    const t = setTimeout(() => setLayers((ls) => ls.filter((l) => !l.leaving)), 1300);
    return () => clearTimeout(t);
  }, [text]);

  return (
    <div className="ghost-layer" aria-hidden="true">
      {layers.map((l) => (
        <div key={l.id} className={"ghost-word" + (l.leaving ? " leaving" : "")}>
          <span>{l.text}</span>
        </div>
      ))}
    </div>
  );
}
