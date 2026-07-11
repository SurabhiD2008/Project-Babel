import { createContext, useContext, useState, useCallback } from "react";
import { WORDS_BY_SLUG } from "../data/index.js";
import { API } from "../lib/api.js";
import { renderCardCanvas, downloadCard, canvasBlob, cardShareText, cardShareUrl } from "../lib/card.js";
import { toast } from "../lib/ui.js";
import CardModal from "../components/CardModal.jsx";
import ShareMenu from "../components/ShareMenu.jsx";

const ModalCtx = createContext(null);

export function ModalProvider({ children }) {
  const [modal, setModal] = useState(null); // { type: "card" | "share", slug, source }
  const close = useCallback(() => setModal(null), []);

  const download = useCallback((slug, source, opts = {}) => {
    const w = WORDS_BY_SLUG[slug];
    if (!w) return;
    downloadCard(w);
    API.track("share", { slug, type: "image_card" });
    if (API.currentUser()) API.saveCard(slug, source || "portrait");
    if (!opts.silent) toast(API.currentUser() ? "Image card downloaded — saved to your account" : "Image card downloaded");
  }, []);

  const openCard = useCallback((slug, source) => {
    if (!WORDS_BY_SLUG[slug]) return;
    setModal({ type: "card", slug, source: source || "ticker" });
  }, []);

  const shareCardTo = useCallback(async (slug, source) => {
    const w = WORDS_BY_SLUG[slug];
    if (!w) return;
    const blob = await canvasBlob(renderCardCanvas(w));
    const file = blob ? new File([blob], `babel-${slug}.png`, { type: "image/png" }) : null;
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `Babel · ${w.word}`, text: cardShareText(w), url: cardShareUrl(slug) });
        API.track("share_card", { slug, via: "native" });
        if (API.currentUser()) API.saveCard(slug, source || "portrait");
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return;
      }
    }
    setModal({ type: "share", slug, source: source || "portrait" });
  }, []);

  return (
    <ModalCtx.Provider value={{ openCard, shareCardTo, download, close }}>
      {children}
      {modal?.type === "card" && <CardModal slug={modal.slug} source={modal.source} onClose={close} />}
      {modal?.type === "share" && <ShareMenu slug={modal.slug} source={modal.source} onClose={close} />}
    </ModalCtx.Provider>
  );
}

export const useModal = () => useContext(ModalCtx);
