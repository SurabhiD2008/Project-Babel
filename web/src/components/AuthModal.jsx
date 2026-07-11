import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { toast } from "../lib/ui.js";

export default function AuthModal({ onClose }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const isReg = mode === "register";

  async function submit() {
    if (isReg && !name.trim()) return toast("Please enter your name");
    if (!email.trim() || !pass) return toast("Enter email and password");
    setBusy(true);
    const r = isReg ? await register(email.trim(), pass, name.trim()) : await login(email.trim(), pass);
    setBusy(false);
    if (!r.ok) return toast(r.error);
    toast((isReg ? "Account created" : "Welcome back") + (r.offline ? " (offline demo mode)" : ""));
    onClose();
  }

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <button className="close" onClick={onClose}>×</button>
        <span className="eyebrow">Account · saved collections</span>
        <h3 style={{ margin: "8px 0 4px" }}>{isReg ? "Create your Babel account" : "Sign in to Babel"}</h3>
        <p style={{ fontSize: 12, marginBottom: 16 }}>
          Save words, keep your Name My Feeling history, and revisit saved image cards.
          {isReg ? " Password of 4+ characters." : ""}
        </p>
        {isReg && (
          <div className="form-field"><label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} type="text" placeholder="Your name" autoComplete="name" />
          </div>
        )}
        <div className="form-field"><label>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@example.com" autoComplete="email" />
        </div>
        <div className="form-field"><label>Password</label>
          <input value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} type="password" placeholder="••••••••" autoComplete={isReg ? "new-password" : "current-password"} />
        </div>
        <button className="btn btn-amber btn-full" disabled={busy} onClick={submit}>
          {busy ? "Please wait…" : isReg ? "Create account" : "Sign in"}
        </button>
        <p style={{ fontSize: 11, marginTop: 14, textAlign: "center", color: "var(--text-muted)" }}>
          {isReg ? (
            <>Already have an account? <a onClick={() => setMode("login")} style={{ color: "var(--amber)", cursor: "pointer" }}>Sign in</a></>
          ) : (
            <>New here? <a onClick={() => setMode("register")} style={{ color: "var(--amber)", cursor: "pointer" }}>Create an account</a></>
          )}
        </p>
      </div>
    </div>
  );
}
