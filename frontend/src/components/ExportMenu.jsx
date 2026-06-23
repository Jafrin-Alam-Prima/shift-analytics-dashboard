// Export action for the header. A small dropdown that turns the current analysis
// into downloadable artifacts via lib/export.js: cleaned CSV and a manager-ready
// Markdown report, plus Print / Save as PDF. (Each chart also exports its own PNG
// from the "PNG" button on the chart.)
import { useEffect, useRef, useState } from "react";
import { downloadText, recordsToCsv, buildReportMarkdown } from "../lib/export.js";
import { IconDownload } from "./icons.jsx";

export default function ExportMenu({ dash }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const ready = dash.ready && !!dash.view;

  useEffect(() => {
    function onDoc(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function exportCsv() {
    downloadText(`cleaned-${dash.datasetName}`, recordsToCsv(dash.view.cleanRecords), "text/csv");
    setOpen(false);
  }
  function exportReport() {
    const md = buildReportMarkdown(dash.view, dash.mode, dash.datasetName, dash.managerNotes);
    downloadText(`report-${dash.datasetName.replace(/\.csv$/i, "")}.md`, md, "text/markdown");
    setOpen(false);
  }
  function printReport() {
    setOpen(false);
    window.print();
  }

  return (
    <div className="export-menu no-print" ref={wrapRef}>
      <button
        className="icon-btn"
        onClick={() => setOpen((o) => !o)}
        disabled={!ready}
        aria-haspopup="menu"
        aria-expanded={open}
        title={ready ? "Export" : "Load a dataset to export"}
      >
        <IconDownload />
        <span className="icon-btn-label">Export</span>
      </button>
      {open && ready && (
        <div className="menu-pop" role="menu">
          <button role="menuitem" onClick={exportCsv}>
            Cleaned CSV
          </button>
          <button role="menuitem" onClick={exportReport}>
            Report (Markdown)
          </button>
          <button role="menuitem" onClick={printReport}>
            Print / Save as PDF
          </button>
          <p className="menu-note muted">Charts export to PNG from each chart’s “PNG” button.</p>
        </div>
      )}
    </div>
  );
}
