// Dataset management (Settings → Data): shows the current file + row count, lets
// you upload a different CSV (drag/drop or picker), and reset to the bundled
// sample. Parsing reuses the same engine the app loads with, so an uploaded file
// goes through the full pipeline (clean → analyse) like any other.
import { useRef, useState } from "react";

export default function DatasetPanel({ dash }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  function readFile(file) {
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) {
      dash.loadCsvText("", file.name); // triggers a friendly error via the engine
      return;
    }
    const reader = new FileReader();
    reader.onload = () => dash.loadCsvText(String(reader.result), file.name);
    reader.onerror = () => dash.loadCsvText("", file.name);
    reader.readAsText(file);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    readFile(e.dataTransfer.files?.[0]);
  }

  return (
    <section className="card">
      <h3>Dataset</h3>
      <p className="muted">
        Current: <strong>{dash.datasetName}</strong>
        {dash.isSample ? " (sample)" : ""} · {dash.rows.length} rows
      </p>

      <div
        className={dragging ? "dropzone over" : "dropzone"}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current && inputRef.current.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
      >
        <p>Drop a CSV here, or click to choose a file.</p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden-input"
          onChange={(e) => readFile(e.target.files?.[0])}
        />
      </div>

      <div className="dataset-actions">
        <button className="reset-btn" onClick={dash.resetToSample} disabled={dash.isSample}>
          Reset to sample
        </button>
      </div>

      {dash.uploadError && <p className="warn-text">{dash.uploadError}</p>}
    </section>
  );
}
