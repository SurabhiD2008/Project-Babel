import { CAT_COLOR, categoryName, HIDDEN, WORDS_BY_SLUG } from "../data/index.js";

// Names of hidden words, so their entries never surface in comparison rows.
const HIDDEN_NAMES = new Set([...HIDDEN].map((slug) => (WORDS_BY_SLUG[slug]?.word || "").toLowerCase()).filter(Boolean));
export const isHiddenName = (name) => HIDDEN_NAMES.has(String(name || "").toLowerCase());

// The site url used for share-card watermarks + share links (matches the vanilla app).
export const SITE_URL = "https://project-babel-five.vercel.app";

export const NAV = [
  ["/atlas", "Atlas"],
  ["/name-my-feeling", "Name My Feeling"],
  ["/map", "Map"],
  ["/theory", "Theory"],
  ["/compose", "Composer"],
  ["/sources", "Sources"],
  ["/about", "About"],
];

export const escHtml = (s) =>
  String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function dimLabel(k) {
  return {
    cognitive: "Cognitive Science",
    cultural: "Cultural Origin",
    linguistic: "Linguistic Structure",
    english: "Nearest in English",
    philosophy: "Philosophy",
    art: "Art & Music",
  }[k];
}

export function catColor(key) {
  return CAT_COLOR[key] || "var(--amber)";
}
export { categoryName };
