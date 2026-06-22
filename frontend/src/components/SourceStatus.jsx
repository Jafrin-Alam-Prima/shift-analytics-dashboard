// Compact data-source indicator for the top bar. The full selector lives in the
// body (moved to Settings → Data in U3); this is just the at-a-glance status.
export default function SourceStatus({ dash }) {
  const { effectiveSource, backendStatus, dataSource } = dash;
  const backendWanted = dataSource !== "local";
  const offline = backendWanted && backendStatus === "offline";

  let dot = "dot-local";
  let label = "Local";
  if (effectiveSource === "backend") {
    dot = "dot-ok";
    label = "Backend";
  } else if (offline) {
    dot = "dot-warn";
    label = "Local (backend off)";
  }

  return (
    <span className="src-status" role="status" aria-live="polite" title={`Data source: ${label}`}>
      <span className={`dot ${dot}`} />
      {label}
    </span>
  );
}
