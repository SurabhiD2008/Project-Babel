import { useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ModalProvider } from "./context/ModalContext.jsx";
import Nav from "./components/Nav.jsx";
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

function ScrollToTop() {
  const loc = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <ModalProvider>
        <div className="grid-bg" aria-hidden="true"></div>
        <div className="shell">
          <Nav />
          <main id="app">
            <ScrollToTop />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/atlas" element={<Atlas />} />
              <Route path="/word/:slug" element={<WordPortrait />} />
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
      </ModalProvider>
    </AuthProvider>
  );
}
