// One reusable segmented control, used for every toggle in the app (data source,
// clean/raw, filter kind, chart colour/merge) so they all look and behave alike.
export default function Segmented({ label, value, onChange, options, ariaLabel }) {
  return (
    <span className="seg" role="group" aria-label={ariaLabel || label}>
      {label && <span className="seg-label">{label}</span>}
      {options.map((o) => (
        <button
          key={o.value}
          className={value === o.value ? "seg-btn active" : "seg-btn"}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
        >
          {o.label}
        </button>
      ))}
    </span>
  );
}
