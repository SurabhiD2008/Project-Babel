import { useEffect, useLayoutEffect, useRef } from "react";
import { Routes, Route, useLocation, useNavigationType, useParams } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ModalProvider } from "./context/ModalContext.jsx";
import { WordsProvider, useWords } from "./context/WordsContext.jsx";
import Nav from "./components/Nav.jsx";
import GhostWord from "./components/GhostWord.jsx";
import Home from "./pages/Home.jsx";
import Atlas from "./pages/Atlas.jsx";
import WordPortrait from "./pages/WordPortrait.jsx";
import NameMyFeeling from "./pages/NameMyFeeling.jsx";
import Composer from "./pages/Composer.jsx";
import LanguageMap from "./pages/LanguageMap.jsx";
import Theory from "./pages/Theory.jsx";
import About from "./pages/About.jsx";
import Sources from "./pages/Sources.jsx";
import Account from "./pages/Account.jsx";
import Admin from "./pages/Admin.jsx";

// Scroll handling between pages. A new page opens at the top, immediately (the
// stylesheet's smooth scrolling is for in-page jumps, not for route changes —
// animating a whole page-length back to zero reads as lag). Going back or
// forward returns you to where you were on that page.
function ScrollManager() {
  const loc = useLocation();
  const type = useNavigationType();
  const positions = useRef(new Map());
  useEffect(() => {
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
  }, []);
  useLayoutEffect(() => {
    const key = loc.key;
    const y = type === "POP" ? positions.current.get(key) || 0 : 0;
    const jump = () => window.scrollTo({ top: y, left: 0, behavior: "instant" });
    jump();
    // A restored page may still be laying out (cards, the map) — settle once more.
    const raf = y ? requestAnimationFrame(jump) : 0;
    const save = () => positions.current.set(key, window.scrollY);
    window.addEventListener("scroll", save, { passive: true });
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", save); };
    // eslint-disable-next-line
  }, [loc.key]);
  return null;
}

// Sections below the fold ease in as they are reached. Purely additive: the
// class is only ever applied by this observer, so without it (no JS support,
// reduced motion) everything is simply visible.
function useScrollReveal(deps) {
  useEffect(() => {
    if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("in");
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -6% 0px" });
    const raf = requestAnimationFrame(() => {
      document.querySelectorAll("#app .section, #app .pullquote, #app footer").forEach((el) => {
        if (el.classList.contains("reveal")) return;
        if (el.getBoundingClientRect().top > window.innerHeight * 0.92) { el.classList.add("reveal"); io.observe(el); }
      });
    });
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
    // eslint-disable-next-line
  }, deps);
}

// Keyed by slug so moving word → word is a fresh page (fade, state and all).
function PortraitRoute() {
  const { slug } = useParams();
  return <WordPortrait key={slug} />;
}

function Shell() {
  // `version` bumps when the DB differs from the bundle; keying <Routes> remounts
  // the current page so it recomputes from the freshly-merged word arrays.
  const { version } = useWords();
  const loc = useLocation();
  useScrollReveal([loc.pathname, version]);
  return (
    <>
      <div className="grid-bg" aria-hidden="true"></div>
      <GhostWord key={version} />
      <div className="shell">
        <Nav />
        <main id="app">
          <ScrollManager />
          <Routes key={version}>
            <Route path="/" element={<Home />} />
            <Route path="/atlas" element={<Atlas />} />
            <Route path="/word/:slug" element={<PortraitRoute />} />
            <Route path="/name-my-feeling" element={<NameMyFeeling />} />
            <Route path="/map" element={<LanguageMap />} />
            <Route path="/theory" element={<Theory />} />
            <Route path="/compose" element={<Composer />} />
            <Route path="/about" element={<About />} />
            <Route path="/sources" element={<Sources />} />
            <Route path="/account" element={<Account />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </main>
      </div>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ModalProvider>
        <WordsProvider>
          <Shell />
        </WordsProvider>
      </ModalProvider>
    </AuthProvider>
  );
}
