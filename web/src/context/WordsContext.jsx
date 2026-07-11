import { createContext, useContext, useState, useEffect } from "react";
import { WORDS } from "../data/index.js";
import { hydrateWordsFromBackend } from "../lib/hydrate.js";

// Holds the live word count and a version counter. On boot it hydrates the
// bundled data from the DB; if that changed anything (admin add/delete), it
// bumps `version` so the routed pages remount and recompute from the mutated
// arrays, and updates `wordCount` for the persistent nav/footer.
const WordsCtx = createContext({ wordCount: WORDS.length, version: 0, refresh: () => {} });

export function WordsProvider({ children }) {
  const [wordCount, setWordCount] = useState(WORDS.length);
  const [version, setVersion] = useState(0);

  const refresh = () => hydrateWordsFromBackend().then((changed) => {
    if (changed) { setWordCount(WORDS.length); setVersion((v) => v + 1); }
    return changed;
  });

  useEffect(() => {
    let done = false;
    hydrateWordsFromBackend().then((changed) => {
      if (!done && changed) { setWordCount(WORDS.length); setVersion((v) => v + 1); }
    });
    return () => { done = true; };
  }, []);

  return <WordsCtx.Provider value={{ wordCount, version, refresh }}>{children}</WordsCtx.Provider>;
}

export const useWords = () => useContext(WordsCtx);
