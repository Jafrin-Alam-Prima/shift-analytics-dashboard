// Dashboard tab, ordered by priority: KPI cards → streaks panel → insights →
// charts. Reads the unified `view` (local or backend); presentation only.
import { pct, hrs } from "../lib/format.js";
import { STREAK_METHODS } from "../lib/config.js";
import { RULE_TEXT } from "../lib/ruleText.js";
import FilterBar from "./FilterBar.jsx";
import InfoTip from "./InfoTip.jsx";
import StreaksPanel from "./StreaksPanel.jsx";
import TimelineChart from "./charts/TimelineChart.jsx";
import ExtraCharts from "./charts/ExtraCharts.jsx";

export default function DashboardTab({ dash }) {
  const { view, mode, params } = dash;
  if (!view) return <div className="card">No data loaded.</div>;

  const eff = view.efficiency;
  const nothingMatches = view.filtered.length === 0;
  const methodLabel =
    (STREAK_METHODS.find((m) => m.value === params.streak.method) || {}).label || params.streak.method;

  return (
    <div>
      <FilterBar dash={dash} />

      {dash.correctionCount > 0 && (
        <p className="custom-note">
          {dash.correctionCount} manual correction{dash.correctionCount === 1 ? "" : "s"} applied (Data
          quality → Manual corrections). These sit on top of the automatic cleaning.
        </p>
      )}

      <div className="kpi-row">
        <div className="kpi kpi-accent">
          {view.failureCustomized ? (
            <>
              <div className="kpi-pair">
                <span className="kpi-pair-num">{pct(view.officialEfficiency.score)}</span>
                <span className="kpi-pair-tag">official</span>
              </div>
              <div className="kpi-pair">
                <span className="kpi-pair-num custom">{pct(eff.score)}</span>
                <span className="kpi-pair-tag">custom set</span>
              </div>
              <div className="kpi-label">
                Efficiency ({mode}) <InfoTip text={RULE_TEXT.efficiency} label="How efficiency is calculated" />
              </div>
            </>
          ) : (
            <>
              <div className="kpi-value">{pct(view.officialEfficiency.score)}</div>
              <div className="kpi-label">
                Official efficiency ({mode}) <InfoTip text={RULE_TEXT.efficiency} label="How efficiency is calculated" />
              </div>
            </>
          )}
        </div>
        <div className="kpi">
          <div className="kpi-value">{hrs(eff.total)}</div>
          <div className="kpi-label">Total hours</div>
        </div>
        <div className="kpi">
          <div className="kpi-value">{view.filtered.length}</div>
          <div className="kpi-label">Shifts shown</div>
        </div>
        <div className="kpi">
          <div className="kpi-value">{view.streaks.length}</div>
          <div className="kpi-label">Breakdown streak{view.streaks.length === 1 ? "" : "s"}</div>
        </div>
      </div>

      {view.failureCustomized && (
        <p className="custom-note">
          Custom failure set active ({params.failureReasons.join(", ")}). The <strong>official</strong>{" "}
          efficiency stays pinned to Breakdown + Unknown Failure; the custom score and the streaks below
          reflect your custom set.
        </p>
      )}

      {nothingMatches ? (
        <div className="card">
          <p className="muted">No shifts match the current filters. Try widening them or reset.</p>
        </div>
      ) : (
        <>
          <StreaksPanel
            streaks={view.streaks}
            methodLabel={methodLabel}
            customFailure={view.failureCustomized}
          />

          <section className="card">
            <h3>Insights</h3>
            {view.insights.length === 0 ? (
              <p className="muted">Nothing notable to report.</p>
            ) : (
              <ul className="insights">
                {view.insights.map((text, i) => (
                  <li key={i}>{text}</li>
                ))}
              </ul>
            )}
          </section>

          <TimelineChart records={view.filtered} allRecords={view.cleanRecords} groups={view.groups} />

          <ExtraCharts
            records={view.filtered}
            allRecords={view.cleanRecords}
            groups={view.groups}
            failureReasons={params.failureReasons}
          />
        </>
      )}
    </div>
  );
}
