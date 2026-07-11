import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { NAV } from "../lib/util.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useWords } from "../context/WordsContext.jsx";
import AuthModal from "./AuthModal.jsx";

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const loc = useLocation();
  const { user, logout } = useAuth();
  const { wordCount } = useWords();
  const onAdmin = loc.pathname.startsWith("/admin");

  return (
    <>
      <nav className="topnav">
        <div className="inner">
          <Link to="/" className="logo" onClick={() => setOpen(false)}>Babel</Link>
          <button className="nav-toggle" onClick={() => setOpen((o) => !o)}>Menu</button>
          <div className={"navlinks" + (open ? " open" : "")} id="navlinks">
            {NAV.map(([h, t]) => (
              <NavLink key={h} to={h} className={({ isActive }) => (isActive ? "active" : "")} onClick={() => setOpen(false)}>
                {t}
              </NavLink>
            ))}
          </div>
          <div className="nav-pulse"><span className="pulse-dot"></span>{wordCount} words indexed</div>
          <div className="nav-account">
            {onAdmin ? (
              <button className="btn btn-amber" onClick={() => { sessionStorage.removeItem("babel:adminKey"); window.location.reload(); }}>Sign Out</button>
            ) : user ? (
              <>
                <Link className="btn btn-amber" to="/account">Your Profile</Link>
                <button className="btn btn-amber" onClick={logout}>Sign Out</button>
              </>
            ) : (
              <button className="btn btn-amber" onClick={() => setAuthOpen(true)}>Sign in</button>
            )}
          </div>
        </div>
      </nav>
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </>
  );
}
