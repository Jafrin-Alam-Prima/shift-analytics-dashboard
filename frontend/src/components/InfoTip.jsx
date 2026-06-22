// A small accessible "ℹ️" info icon. The explanation is always in the DOM and
// linked via aria-describedby (so screen readers get it), and shown visually on
// hover and on keyboard focus.
import { useId, useState } from "react";

export default function InfoTip({ text, label = "Rule explanation" }) {
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <span className="infotip">
      <button
        type="button"
        className="infotip-btn"
        aria-label={label}
        aria-describedby={id}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
      >
        i
      </button>
      <span role="tooltip" id={id} className={open ? "infotip-pop open" : "infotip-pop"}>
        {text}
      </span>
    </span>
  );
}
