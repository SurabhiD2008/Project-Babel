import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { WORDS_BY_SLUG } from "../data/index.js";
import { API } from "../lib/api.js";
import { Store } from "../lib/store.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useModal } from "../context/ModalContext.jsx";
import { toast } from "../lib/ui.js";
import WordCard from "../components/WordCard.jsx";
import AuthModal from "../components/AuthModal.jsx";
import Footer from "../components/Footer.jsx";

export default function Account() {
  const { user, refresh, logout } = useAuth();
  const { shareCardTo, download } = useModal();
  const navigate = useNavigate();
  const [authOpen, setAuthOpen] = useState(false);
  const [cards, setCards] = useState([]);
  const [history, setHistory] = useState([]);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const savedWords = API.saved().map((s) => WORDS_BY_SLUG[s]).filter(Boolean);

  useEffect(() => {
    if (!user) return;
    let done = false;
    API.savedCards().then((c) => !done && setCards(c));
    API.history().then((h) => !done && setHistory(h));
    return () => { done = true; };
  }, [user]);

  if (!user) {
    return (
      <div className="page-fade">
        <section className="section"><div className="wrap">
          <span className="eyebrow">Account</span>
          <h1 style={{ margin: "1rem 0" }}>Sign in to see your account</h1>
          <p style={{ marginBottom: "1.4rem" }}>Search history and saved image cards are tied to your Babel account.</p>
          <button className="btn btn-amber" onClick={() => setAuthOpen(true)}>Sign in →</button>
        </div></section>
        <Footer />
        {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
      </div>
    );
  }

  const displayName = user.name && user.name.trim() ? user.name : user.email.split("@")[0];
  const online = !!Store.get("token", null);

  async function removeCard(slug) {
    await API.unsaveCard(slug);
    setCards((cs) => cs.filter((c) => c.slug !== slug));
    toast("Removed");
  }

  return (
    <div className="page-fade">
      <section className="section"><div className="wrap-wide">
        <span className="eyebrow">Your profile</span>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12, margin: "1rem 0" }}>
          <div>
            <h1 style={{ margin: 0 }}>{displayName}</h1>
            <p className="wc-meta" style={{ marginTop: 6 }}>{user.email}{online ? "" : " · offline demo (this device only)"}</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-ghost" onClick={() => setEditing(true)}>Edit account</button>
            <button className="btn btn-ghost" onClick={() => setConfirming(true)} style={{ borderColor: "rgba(199,125,90,.5)", color: "#C77D5A" }}>Delete account</button>
          </div>
        </div>
        <p style={{ marginBottom: "2rem" }}>Everything you've searched, saved, and downloaded, tied to this account.</p>

        <div className="label label-line">Saved words <span>({savedWords.length})</span></div>
        <div className="word-grid" style={{ marginBottom: "2.4rem" }}>
          {savedWords.length ? savedWords.map((w) => <WordCard key={w.slug} w={w} />)
            : <p style={{ fontSize: 12, color: "var(--text-faint)" }}>No saved words yet — star a word on its portrait page.</p>}
        </div>

        <div className="label label-line">Saved image cards <span>({cards.length})</span></div>
        <div className="word-grid" style={{ marginBottom: "2.4rem" }}>
          {cards.length ? cards.map((c) => (
            <div key={c.slug} className="card">
              <span className="glow"></span>
              <div className="wc-meta">{c.language} · via {c.source}</div>
              <div className="wc-word">{c.word}</div>
              <div className="wc-def">{c.defShort}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <button className="btn btn-amber" style={{ flex: 1 }} onClick={() => shareCardTo(c.slug, c.source)}>Share ↗</button>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => download(c.slug, c.source)}>Re-download ⬇</button>
                <button className="btn btn-ghost" onClick={() => removeCard(c.slug)}>Remove</button>
              </div>
            </div>
          )) : <p style={{ fontSize: 12, color: "var(--text-faint)" }}>No saved cards yet — download an image card from a word portrait or a feeling search to save it here.</p>}
        </div>

        <div className="label label-line">Name My Feeling — search history <span>({history.length})</span></div>
        <div>
          {history.length ? history.map((h, i) => (
            <div key={i} className="compare-row" style={{ gridTemplateColumns: "1fr 140px 60px" }}>
              <span className="cl" style={{ textTransform: "none", letterSpacing: 0, fontFamily: "var(--font-body)" }}>"{h.input.slice(0, 80)}{h.input.length > 80 ? "…" : ""}"</span>
              <a className="cl" style={{ cursor: "pointer" }} onClick={() => navigate(`/word/${h.bestSlug}`)}><b>{h.bestWord}</b></a>
              <span className="cn">{h.matchScore}%</span>
            </div>
          )) : <p style={{ fontSize: 12, color: "var(--text-faint)" }}>No searches yet — try Name My Feeling.</p>}
        </div>
      </div></section>
      <Footer />

      {editing && <EditModal user={user} onClose={() => setEditing(false)} onSaved={refresh} />}
      {confirming && (
        <ConfirmDelete
          onClose={() => setConfirming(false)}
          onConfirm={async () => {
            const r = await API.deleteAccount();
            setConfirming(false);
            if (r.ok) { logout(); toast("Account deleted"); navigate("/"); }
            else toast(r.error || "Could not delete account");
          }}
        />
      )}
    </div>
  );
}

function EditModal({ user, onClose, onSaved }) {
  const [name, setName] = useState(user.name || "");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const r = await API.updateAccount(name.trim(), pass);
    setBusy(false);
    onSaved();
    if (r.ok) { toast("Account updated"); onClose(); } else toast(r.error || "Update failed");
  }
  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <button className="close" onClick={onClose}>×</button>
        <span className="eyebrow">Your profile</span>
        <h3 style={{ margin: "8px 0 4px" }}>Edit account</h3>
        <p style={{ fontSize: 12, marginBottom: 16 }}>Update your name, or set a new password. Leave the password blank to keep it unchanged.</p>
        <div className="form-field"><label>Name</label><input value={name} onChange={(e) => setName(e.target.value)} type="text" placeholder="Your name" /></div>
        <div className="form-field"><label>New password (optional)</label><input value={pass} onChange={(e) => setPass(e.target.value)} type="password" placeholder="••••••••" autoComplete="new-password" /></div>
        <button className="btn btn-amber btn-full" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save changes"}</button>
      </div>
    </div>
  );
}

function ConfirmDelete({ onClose, onConfirm }) {
  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <button className="close" onClick={onClose}>×</button>
        <h3 style={{ margin: "8px 0" }}>Delete your account?</h3>
        <p style={{ fontSize: 12, marginBottom: 16 }}>This permanently removes your account, saved words, saved cards, and search history. This cannot be undone.</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-amber" style={{ flex: 1, borderColor: "rgba(199,125,90,.6)", color: "#C77D5A" }} onClick={onConfirm}>Delete forever</button>
        </div>
      </div>
    </div>
  );
}
