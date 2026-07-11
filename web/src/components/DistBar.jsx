export default function DistBar({ pct }) {
  return (
    <div className="dbar">
      <span style={{ width: pct + "%" }} />
    </div>
  );
}
