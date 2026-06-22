// Lets you choose where the numbers come from: Auto (backend if it's up, else
// local), Local-only, or Backend. Shows a live status badge, a Retry button, and
// short "how to start Django" steps when the backend is wanted but offline.
import Segmented from "./Segmented.jsx";
import { BACKEND_URL } from "../lib/backend.js";

export default function DataSourceBar({ dash }) {
  const { dataSource, setDataSource, backendStatus, checkBackend, effectiveSource, mode, setMode } = dash;
  const wantBackend = dataSource === "auto" || dataSource === "backend";
  const showOfflineHelp = wantBackend && backendStatus === "offline";

  const badge =
    backendStatus === "online"
      ? { text: "backend online", cls: "ok" }
      : backendStatus === "checking"
      ? { text: "checking…", cls: "wait" }
      : backendStatus === "offline"
      ? { text: "backend offline", cls: "bad" }
      : { text: "not checked", cls: "wait" };

  return (
    <section className="card source-bar">
      <h3>Data</h3>

      <div className="source-row">
        <Segmented
          label="Dataset:"
          value={mode}
          onChange={setMode}
          options={[
            { value: "clean", label: "Cleaned" },
            { value: "raw", label: "Raw" },
          ]}
        />
        <span className="muted caption">
          Cleaned applies the fixes from Data quality; Raw uses the file as-is.
        </span>
      </div>

      <div className="source-row">
        <Segmented
          label="Source:"
          value={dataSource}
          onChange={setDataSource}
          options={[
            { value: "auto", label: "Auto" },
            { value: "local", label: "Local" },
            { value: "backend", label: "Backend" },
          ]}
        />

        {dataSource !== "local" && (
          <>
            <span className={`status-badge ${badge.cls}`} role="status" aria-live="polite">
              {badge.text}
            </span>
            <button className="reset-btn" onClick={checkBackend}>
              Retry
            </button>
          </>
        )}

        <span className="source-now muted">
          Showing: <strong>{effectiveSource}</strong> results
        </span>
      </div>

      {showOfflineHelp && (
        <p className="muted source-help">
          Backend not reachable at <code>{BACKEND_URL}</code>. Start it with:{" "}
          <code>cd backend &amp;&amp; source venv/bin/activate &amp;&amp; python manage.py runserver 8000</code>, then
          press Retry. (Auto mode keeps using local results until it's up.)
        </p>
      )}
    </section>
  );
}
