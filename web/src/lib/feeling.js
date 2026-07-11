import { apiFetch } from "./api.js";
import { WORDS_BY_SLUG } from "../data/index.js";
import { localFeelingSearch, analyseText } from "./engine.js";

// Composer analysis: backend first, falls back to the in-browser engine.
export async function composeAnalyse(text) {
  try {
    const r = await apiFetch("/compose/analyse", { method: "POST", body: JSON.stringify({ text }) });
    return r.found;
  } catch (e) {
    return analyseText(text);
  }
}

// Feeling-search orchestrator: real backend first (which runs the offline engine,
// or Claude if the server has a key, and logs history for signed-in users) →
// the in-browser offline engine as a fallback. `engine` is surfaced honestly.
export async function feelingSearch(text) {
  try {
    const r = await apiFetch("/feelings/search", { method: "POST", body: JSON.stringify({ input: text }) });
    return {
      bestMatch: WORDS_BY_SLUG[r.bestMatch.slug],
      matchScore: r.matchScore,
      explanation: r.explanation,
      sapirWhorf: r.sapirWhorf,
      alternates: r.alternates.map((a) => ({ ...WORDS_BY_SLUG[a.slug], match: a.match, word: a.word, lang: a.lang, slug: a.slug })),
      engine: r.engine || "offline",
      cached: r.cached,
      responseMs: r.responseMs,
      source: "backend",
    };
  } catch (e) {
    /* backend unreachable — fall through to the in-browser engine */
  }
  return { ...localFeelingSearch(text), engine: "offline", source: "local" };
}
