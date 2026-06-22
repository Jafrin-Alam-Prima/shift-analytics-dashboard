// A large, scrollable overlay panel used for the supporting pages (Settings and
// the Data Quality & Methodology report) that hang off the header rather than the
// sidebar. Closes on the ✕, a scrim click, or Escape.
import { useEffect } from "react";

export default function Modal({ title, subtitle, onClose, children }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-scrim no-print" onClick={onClose}>
      <div className="modal-panel" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <div>
            <h2 className="modal-title">{title}</h2>
            {subtitle && <p className="modal-subtitle muted">{subtitle}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
