// Shareable image card — rendered to a 1080×1080 <canvas>, then downloaded or
// shared. Ported from the vanilla site (renderCardCanvas + share helpers).
import { SITE_URL } from "./util.js";

function wrapText(x, text, cx, y, maxW, lh) {
  const words = String(text).split(" ");
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (x.measureText(test).width > maxW && line) {
      x.fillText(line, cx, y);
      line = w;
      y += lh;
    } else {
      line = test;
    }
  }
  if (line) x.fillText(line, cx, y);
}

export function renderCardCanvas(w) {
  const S = 1080;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const x = c.getContext("2d");
  x.fillStyle = "#07060E";
  x.fillRect(0, 0, S, S);
  x.strokeStyle = "rgba(184,148,74,0.05)";
  x.lineWidth = 1;
  for (let i = 0; i < S; i += 48) {
    x.beginPath(); x.moveTo(i, 0); x.lineTo(i, S); x.stroke();
    x.beginPath(); x.moveTo(0, i); x.lineTo(S, i); x.stroke();
  }
  x.fillStyle = "rgba(184,148,74,0.05)";
  x.font = "italic 900 240px 'Playfair Display', Georgia, serif";
  x.textAlign = "center";
  x.fillText(w.native || w.word, S / 2, S - 90);
  x.fillStyle = "#B8944A";
  x.font = "24px 'Space Mono', monospace";
  x.textAlign = "left";
  x.fillText(w.language.toUpperCase() + " · " + w.family.toUpperCase(), 90, 200);
  x.fillStyle = "#F0ECE4";
  x.font = "italic 900 130px 'Playfair Display', Georgia, serif";
  x.fillText(w.word, 84, 360);
  x.fillStyle = "rgba(237,232,222,0.7)";
  x.font = "italic 40px 'Playfair Display', Georgia, serif";
  wrapText(x, w.defShort, 90, 460, S - 180, 54);
  x.strokeStyle = "#B8944A";
  x.lineWidth = 3;
  x.beginPath(); x.moveTo(90, S - 230); x.lineTo(320, S - 230); x.stroke();
  x.fillStyle = "#B8944A";
  x.font = "24px 'Space Mono', monospace";
  x.fillText(w.dist + "% COGNITIVE DISTANCE", 90, S - 180);
  x.fillStyle = "rgba(237,232,222,0.4)";
  x.textAlign = "right";
  x.fillText(SITE_URL.replace(/^https?:\/\//, "https://"), S - 90, S - 180);
  return c;
}

export const cardDataURL = (w) => renderCardCanvas(w).toDataURL("image/png");
export const canvasBlob = (canvas) => new Promise((res) => canvas.toBlob(res, "image/png"));
export const cardShareText = (w) => `“${w.word}” (${w.language}) — ${w.defShort} · an untranslatable word from Babel.`;
export const cardShareUrl = (slug) => SITE_URL + "/#/word/" + slug;

export function downloadCard(w) {
  const url = renderCardCanvas(w).toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = `babel-${w.slug}.png`;
  a.click();
}

// Image-first apps with no web pre-fill URL — hand over the image + open the app.
export const SHARE_APP_URLS = {
  instagram: "https://www.instagram.com/",
  snapchat: "https://www.snapchat.com/",
  tiktok: "https://www.tiktok.com/upload",
  discord: "https://discord.com/channels/@me",
};

export function buildShareIntents(shareUrl, text, word) {
  const u = encodeURIComponent(shareUrl), t = encodeURIComponent(text), tu = encodeURIComponent(text + " " + shareUrl);
  return [
    ["WhatsApp", `https://api.whatsapp.com/send?text=${tu}`],
    ["X / Twitter", `https://twitter.com/intent/tweet?text=${t}&url=${u}`],
    ["Facebook", `https://www.facebook.com/sharer/sharer.php?u=${u}&quote=${t}`],
    ["Threads", `https://www.threads.net/intent/post?text=${tu}`],
    ["Telegram", `https://t.me/share/url?url=${u}&text=${t}`],
    ["LinkedIn", `https://www.linkedin.com/sharing/share-offsite/?url=${u}`],
    ["Pinterest", `https://www.pinterest.com/pin/create/button/?url=${u}&description=${t}`],
    ["Tumblr", `https://www.tumblr.com/widgets/share/tool?canonicalUrl=${u}&caption=${t}`],
    ["Reddit", `https://www.reddit.com/submit?url=${u}&title=${t}`],
    ["Email", `mailto:?subject=${encodeURIComponent("A word from Babel: " + word.word)}&body=${tu}`],
  ];
}
export const SHARE_APPS = [["Instagram", "instagram"], ["Snapchat", "snapchat"], ["TikTok", "tiktok"], ["Discord", "discord"]];
