// Live database hydration — reconciles the bundled data.js with the live DB
// (GET /api/words/all): admin-added words are merged in (fully browsable) and
// deleted words are removed, so the React app reflects the database, not just
// the bundle. Mutates the shared arrays in place; WordsContext bumps a version
// to refresh the UI when something actually changed. Falls back to the bundled
// data when the backend is unreachable. Ported from the vanilla site.
import { WORDS, WORDS_BY_SLUG, VISIBLE_WORDS, LANGUAGES, LANGUAGE_FAMILIES, isHidden } from "../data/index.js";
import { apiFetch } from "./api.js";

const DIM_LABEL2KEY = {
  "Cognitive Science": "cognitive", "Cultural Origin": "cultural", "Linguistic Structure": "linguistic",
  "Nearest in English": "english", "Philosophy": "philosophy", "Art & Music": "art",
};

function backendToFrontendWord(bw) {
  const dims = { cognitive: "", cultural: "", linguistic: "", english: "", philosophy: "", art: "" };
  (bw.dimensions || []).forEach((d) => { const k = DIM_LABEL2KEY[d.label]; if (k) dims[k] = d.content; });
  return {
    slug: bw.slug, number: bw.number, word: bw.word, language: bw.language,
    native: bw.native || "", phonetic: bw.phonetic || "", family: bw.family || "Community",
    script: bw.script || "Latin", dist: bw.dist, intensity: bw.intensity || 60,
    category: bw.category, defShort: bw.defShort, defFull: bw.defFull,
    dims, art: dims.art || "",
    cultures: bw.cultures || [], comparisons: bw.comparisons || [], related: bw.related || [],
    community: true, // flags a DB/community entry (may have a sparse portrait)
  };
}

export async function hydrateWordsFromBackend() {
  let all;
  try { all = await apiFetch("/words/all"); }
  catch (e) { return false; } // backend unreachable — keep the bundle
  if (!Array.isArray(all) || !all.length) return false;

  const dbSlugs = new Set(all.map((w) => w.slug));
  const newOnes = all.filter((bw) => !WORDS_BY_SLUG[bw.slug]);
  const removed = WORDS.filter((w) => !dbSlugs.has(w.slug));

  // 1) merge in DB words missing locally (fetch the full portrait per word)
  for (const basic of newOnes) {
    let full = basic;
    try { full = await apiFetch("/words/" + basic.slug); } catch (e) { /* use basic fields */ }
    const w = backendToFrontendWord(full);
    WORDS.push(w);
    WORDS_BY_SLUG[w.slug] = w;
    if (!isHidden(w)) VISIBLE_WORDS.push(w);
    if (!LANGUAGE_FAMILIES.includes(w.family)) LANGUAGE_FAMILIES.push(w.family);
    if (!LANGUAGES.includes(w.language)) LANGUAGES.push(w.language);
  }
  // 2) drop words deleted from the DB
  if (removed.length) {
    removed.forEach((w) => { delete WORDS_BY_SLUG[w.slug]; });
    WORDS.splice(0, WORDS.length, ...WORDS.filter((w) => dbSlugs.has(w.slug)));
    VISIBLE_WORDS.splice(0, VISIBLE_WORDS.length, ...VISIBLE_WORDS.filter((w) => dbSlugs.has(w.slug)));
  }

  return newOnes.length > 0 || removed.length > 0;
}
