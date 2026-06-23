// Quiet data-source status: just a small colour dot in the header (the label is
// in the tooltip / for screen readers, not front-and-centre). This is a dev/ops
// detail — laypeople don't need to read "Local / backend" all the time.
export default function SourceStatus({ dash }) {
  const { effectiveSource, backendStatus, dataSource } = dash;
  const backendWanted = dataSource !== "local";
  const offline = backendWanted && backendStatus === "offline";

  let dot = "dot-local";
  let label = "Running in your browser";
  if (effectiveSource === "backend") {
    dot = "dot-ok";
    label = "Using the server";
  } else if (offline) {
    dot = "dot-warn";
    label = "Running in your browser (server offline)";
  }

  return (
    <span className="src-status src-status-dot" role="status" aria-live="polite" title={label} aria-label={label}>
      <span className={`dot ${dot}`} />
    </span>
  );
}
