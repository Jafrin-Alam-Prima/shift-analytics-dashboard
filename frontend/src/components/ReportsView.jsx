// Saved reports — the backend's reason to exist. Save the current analysis
// (dataset rows + params) to the server, list past ones, reload or delete them.
// Needs the backend running; shows a friendly message if it's not reachable.
import { useEffect, useState } from "react";
import { listReports, saveReport, getReport, deleteReport, BACKEND_URL } from "../lib/backend.js";
import { pct } from "../lib/format.js";
import { downloadText, recordsToCsv, buildReportMarkdown } from "../lib/export.js";
import ManagerReport from "./ManagerReport.jsx";

export default function ReportsView({ dash }) {
  const [reports, setReports] = useState(null); // null = loading
  const [offline, setOffline] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function refresh() {
    try {
      setReports(await listReports());
      setOffline(false);
    } catch {
      setReports([]);
      setOffline(true);
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  async function onSave() {
    setBusy(true);
    setMsg("");
    try {
      await saveReport({
        name: name.trim() || dash.datasetName,
        rows: dash.logical,
        params: dash.params,
        mode: dash.mode,
        filters: dash.filters,
        notes: dash.managerNotes,
      });
      setName("");
      await refresh();
      setMsg("Saved.");
    } catch {
      setMsg("Could not save — is the backend running?");
      setOffline(true);
    }
    setBusy(false);
  }

  async function onLoad(id) {
    try {
      dash.applyReport(await getReport(id));
      setMsg("Loaded — see the Dashboard.");
    } catch {
      setMsg("Could not load that report.");
    }
  }

  async function onDelete(id) {
    try {
      await deleteReport(id);
      await refresh();
    } catch {
      setMsg("Could not delete that report.");
    }
  }

  // exports work locally (no backend needed)
  const exportsReady = dash.ready && dash.view;
  function exportCsv() {
    downloadText(`cleaned-${dash.datasetName}`, recordsToCsv(dash.view.cleanRecords), "text/csv");
  }
  function exportReport() {
    const md = buildReportMarkdown(dash.view, dash.mode, dash.datasetName, dash.managerNotes, dash.corrections);
    downloadText(`report-${dash.datasetName.replace(/\.csv$/i, "")}.md`, md, "text/markdown");
  }

  return (
    <div>
      <ManagerReport dash={dash} />

      <section className="card no-print">
        <h3>Export</h3>
        <p className="muted">
          Download the cleaned data or a manager-ready report. Charts export to PNG from the “PNG”
          button on each chart.
        </p>
        <div className="export-row">
          <button className="reset-btn" onClick={exportCsv} disabled={!exportsReady}>
            Download cleaned CSV
          </button>
          <button className="reset-btn" onClick={exportReport} disabled={!exportsReady}>
            Download report (Markdown)
          </button>
          <button className="reset-btn" onClick={() => window.print()} disabled={!exportsReady}>
            Print / Save as PDF
          </button>
        </div>
        {!exportsReady && <p className="warn-text">Load a dataset (map its columns) to enable exports.</p>}
      </section>

      {offline && (
        <section className="card no-print">
          <h3>Saved reports</h3>
          <p className="muted">
            Saved reports are stored by the backend. Start it with{" "}
            <code>cd backend &amp;&amp; source venv/bin/activate &amp;&amp; python manage.py runserver 8000</code>{" "}
            (API at <code>{BACKEND_URL}</code>), then retry.
          </p>
          <button className="reset-btn" onClick={refresh}>
            Retry
          </button>
        </section>
      )}

      {!offline && (
        <>
      <section className="card no-print">
        <h3>Save current analysis</h3>
        <p className="muted">
          Stores the current dataset and settings on the server so you can reload them later — something
          local-only mode can't do.
        </p>
        <div className="save-row">
          <input
            type="text"
            placeholder={dash.datasetName}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Report name"
          />
          <button className="primary-btn" onClick={onSave} disabled={busy || !dash.ready}>
            {busy ? "Saving…" : "Save report"}
          </button>
        </div>
        {!dash.ready && <p className="warn-text">Map the columns first (Settings) before saving.</p>}
        {msg && <p className="muted">{msg}</p>}
      </section>

      <section className="card no-print">
        <h3>Saved reports {reports ? `(${reports.length})` : ""}</h3>
        {reports === null ? (
          <p className="muted">Loading…</p>
        ) : reports.length === 0 ? (
          <p className="muted">No saved reports yet.</p>
        ) : (
          <table className="issue-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Saved</th>
                <th>Efficiency</th>
                <th>Rows</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{new Date(r.created).toLocaleString()}</td>
                  <td>{pct(r.summary?.efficiency)}</td>
                  <td>{r.summary?.rowsCount ?? "—"}</td>
                  <td className="row-actions">
                    <button className="reset-btn" onClick={() => onLoad(r.id)}>
                      Load
                    </button>
                    <button className="reset-btn" onClick={() => onDelete(r.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
        </>
      )}
    </div>
  );
}
