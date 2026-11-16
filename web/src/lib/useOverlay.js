import { useEffect } from "react";

// Shared behaviour for modal overlays: Escape closes, the page behind stops
// scrolling (without the layout jumping by a scrollbar's width), and focus
// returns to whatever opened the overlay.
let locks = 0;

export function useOverlay(onClose) {
  useEffect(() => {
    const opener = document.activeElement;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const root = document.documentElement;
    if (locks++ === 0) {
      const gap = window.innerWidth - root.clientWidth;
      root.style.overflow = "hidden";
      if (gap > 0) root.style.paddingRight = gap + "px";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      if (--locks === 0) { root.style.overflow = ""; root.style.paddingRight = ""; }
      if (opener && typeof opener.focus === "function" && document.contains(opener)) opener.focus({ preventScroll: true });
    };
    // eslint-disable-next-line
  }, []);
}
