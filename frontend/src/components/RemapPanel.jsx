// View and override which CSV column feeds each logical field. Changing a
// dropdown updates the mapping, and everything downstream recomputes.
import { LOGICAL_FIELDS } from "../lib/config.js";

const LABELS = {
  date: "Date",
  start: "Start time",
  end: "End time",
  hours: "Hours",
  reason: "Reason",
};

export default function RemapPanel({ headers, map, setMap, missing }) {
  function change(field, header) {
    setMap({ ...map, [field]: header || null });
  }

  return (
    <section className="card">
      <h3>Column mapping</h3>
      <p className="muted">
        Each part of the app reads these five fields. The columns were guessed
        automatically — override any of them here if a guess is wrong.
      </p>

      {missing.length > 0 && (
        <p className="warn-text">
          Still unmapped: {missing.join(", ")}. Pick a column for each to enable
          the dashboard.
        </p>
      )}

      <div className="map-grid">
        {LOGICAL_FIELDS.map((field) => (
          <label key={field} className="map-row">
            <span className="map-label">{LABELS[field]}</span>
            <select
              value={map[field] || ""}
              onChange={(e) => change(field, e.target.value)}
            >
              <option value="">(unmapped)</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </section>
  );
}
