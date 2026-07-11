// Adapter around the original bundled word data. `data.js` is copied verbatim
// from the vanilla site and populates `window.BABEL` as a side effect on import;
// we re-export those fields as ES module bindings for the React app.
import "./data.js";

const B = window.BABEL;

export const WORDS = B.WORDS;
export const WORDS_BY_SLUG = B.WORDS_BY_SLUG;
export const CATEGORIES = B.CATEGORIES;
export const CAT_COLOR = B.CAT_COLOR;
export const categoryName = B.categoryName;
export const categoryCounts = B.categoryCounts;
export const LANGUAGE_FAMILIES = B.LANGUAGE_FAMILIES;
export const LANGUAGES = B.LANGUAGES;
export const HIDDEN = B.HIDDEN;
export const HIDDEN_SLUGS = B.HIDDEN_SLUGS;
export const isHidden = B.isHidden;
export const VISIBLE_WORDS = B.VISIBLE_WORDS;
