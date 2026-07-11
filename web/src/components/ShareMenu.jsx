import { WORDS_BY_SLUG } from "../data/index.js";
import { API } from "../lib/api.js";
import { buildShareIntents, SHARE_APPS, SHARE_APP_URLS, cardShareText, cardShareUrl, renderCardCanvas, canvasBlob } from "../lib/card.js";
import { useModal } from "../context/ModalContext.jsx";
import { toast } from "../lib/ui.js";

export default function ShareMenu({ slug, source, onClose }) {
  const w = WORDS_BY_SLUG[slug];
  const { download } = useModal();
  if (!w) return null;
  const shareUrl = cardShareUrl(slug);
  const text = cardShareText(w);
  const intents = buildShareIntents(shareUrl, text, w);

  function markShare(label) {
    API.track("share_card", { slug, via: label.split(" ")[0].toLowerCase() });
    if (API.currentUser()) API.saveCard(slug, source);
  }
  function shareToApp(key) {
    download(slug, source, { silent: true });
    window.open(SHARE_APP_URLS[key] || shareUrl, "_blank", "noopener");
    API.track("share_card", { slug, via: key });
    if (API.currentUser()) API.saveCard(slug, source);
    toast(`Image saved — upload it in ${key.charAt(0).toUpperCase() + key.slice(1)}`);
  }
  async function copyImage() {
    try {
      const blob = await canvasBlob(renderCardCanvas(w));
      await navigator.clipboard.write([new window.ClipboardItem({ "image/png": blob })]);
      API.track("share_card", { slug, via: "copy" });
      toast("Image copied — paste it anywhere");
    } catch (e) {
      download(slug, source);
    }
  }

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <button className="close" onClick={onClose}>×</button>
        <span className="eyebrow">Share “{w.word}”</span>
        <h3 style={{ margin: "8px 0 4px" }}>Share this image card</h3>
        <p style={{ fontSize: 12, marginBottom: 14 }}>
          Send it straight to an app — no download needed. On phones the actual image is shared; on desktop the link + caption open in your chosen app.
        </p>
        <div className="share-targets">
          {intents.map(([label, href]) => (
            <a key={label} className="btn btn-ghost share-target" href={href} target="_blank" rel="noopener" onClick={() => markShare(label)}>{label}</a>
          ))}
        </div>
        <p className="label label-line" style={{ margin: "16px 0 6px" }}>Image-first apps</p>
        <p style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 8 }}>
          These post a picture — we'll hand you the image and open the app so you can upload it.
        </p>
        <div className="share-targets">
          {SHARE_APPS.map(([label, key]) => (
            <button key={key} className="btn btn-ghost share-target" onClick={() => shareToApp(key)}>{label}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <button className="btn btn-amber" style={{ flex: 1 }} onClick={copyImage}>Copy image</button>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { onClose(); download(slug, source); }}>Download image</button>
        </div>
      </div>
    </div>
  );
}
