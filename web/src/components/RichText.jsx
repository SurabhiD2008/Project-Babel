/* Renders engine text that carries simple formatting without ever inserting
   HTML into the page. The engine writes only <b>, </b> and <br>, and escapes
   every other character it interpolates. This component recognises exactly
   those three tags; anything else, including any other markup, is shown as
   literal text. Nothing is parsed as HTML, so nothing in the string can run. */

const TAG = /(<b>|<\/b>|<br\s*\/?>)/i;
const ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };
const decode = (s) => s.replace(/&(amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m]);

export default function RichText({ html, as: Tag = "div", className }) {
  const out = [];
  let bold = false;
  String(html ?? "").split(TAG).forEach((part, i) => {
    const tag = part.toLowerCase();
    if (tag === "<b>") bold = true;
    else if (tag === "</b>") bold = false;
    else if (/^<br\s*\/?>$/.test(tag)) out.push(<br key={i} />);
    else if (part) out.push(bold ? <b key={i}>{decode(part)}</b> : decode(part));
  });
  return <Tag className={className}>{out}</Tag>;
}
