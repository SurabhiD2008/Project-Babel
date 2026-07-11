import { categoryName, catColor } from "../lib/util.js";

export default function CatTag({ cat }) {
  const c = catColor(cat);
  return (
    <span className="tag cat" style={{ borderColor: c + "44", color: c }}>
      {categoryName(cat)}
    </span>
  );
}
