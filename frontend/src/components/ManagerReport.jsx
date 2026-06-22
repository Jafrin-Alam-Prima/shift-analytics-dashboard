// The manager-grade report: a stack of sections, each computed from the loaded
// data (view.report + the filtered records). Sections are added across stages
// R3–R8. This is also what the print/export produces (R9).
import OverviewSection from "./report/OverviewSection.jsx";
import ShiftSection from "./report/ShiftSection.jsx";
import StreaksSection from "./report/StreaksSection.jsx";
import EfficiencySection from "./report/EfficiencySection.jsx";
import AnomalySection from "./report/AnomalySection.jsx";
import InsightsSection from "./report/InsightsSection.jsx";

export default function ManagerReport({ dash }) {
  if (!dash.ready || !dash.view || !dash.view.report) {
    return <div className="card">Map the columns (Settings) to generate the report.</div>;
  }
  return (
    <div className="manager-report">
      {dash.correctionCount > 0 && (
        <p className="custom-note">
          ⚠ This report includes {dash.correctionCount} manual correction
          {dash.correctionCount === 1 ? "" : "s"} applied on top of the automatic cleaning. See “Manual
          corrections” under Data quality for the full list.
        </p>
      )}
      <OverviewSection dash={dash} />
      <ShiftSection dash={dash} />
      <StreaksSection dash={dash} />
      <EfficiencySection dash={dash} />
      <AnomalySection dash={dash} />
      <InsightsSection dash={dash} />
    </div>
  );
}
