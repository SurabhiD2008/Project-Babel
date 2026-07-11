import { Link } from "react-router-dom";
import Footer from "../components/Footer.jsx";

// Placeholder for pages still being ported to React. The live vanilla site has
// all of these working; this keeps the React app navigable during the rebuild.
export default function Stub({ name }) {
  return (
    <div className="page-fade">
      <div className="wrap section" style={{ minHeight: "55vh" }}>
        <span className="eyebrow">Being ported to React</span>
        <h1 style={{ margin: "1rem 0" }}>{name}</h1>
        <p style={{ maxWidth: "52ch", color: "var(--text-muted)" }}>
          This page is part of the ongoing React rebuild. It's fully working on the
          current live site in the meantime.
        </p>
        <Link className="btn btn-amber" to="/" style={{ marginTop: "1.4rem" }}>← Home</Link>
      </div>
      <Footer />
    </div>
  );
}
