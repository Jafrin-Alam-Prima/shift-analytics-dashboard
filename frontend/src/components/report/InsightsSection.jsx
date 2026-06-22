// Honest insight cards. Each card is a COMPUTED FACT with its evidence (numbers).
// "Questions to investigate" are clearly labelled, conditional, and phrased as
// questions — never causes or prescribed actions. The manager owns the action
// field. The boundary caption marks where data ends and interpretation begins.
import { pct, hrs, num, shortDate } from "../../lib/format.js";

// a small neutral "fact" icon (no dependency)
function FactIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8h.01M11 12h1v4h1" />
    </svg>
  );
}

export default function InsightsSection({ dash }) {
  const { view, params } = dash;
  const rep = view.report;
  const off = view.officialEfficiency;

  // ---- computed facts (no "why", no "do X") ----
  const facts = [];
  const top = rep.reasonContribution[0];
  if (top) {
    facts.push({
      title: "Largest downtime reason",
      body: `${top.reason} accounts for ${hrs(top.hours)} (${pct(top.pct)}) of the ${hrs(rep.downtimeTotal)} of downtime in range.`,
    });
  }
  if (rep.peakDowntimeDay) {
    facts.push({
      title: "Peak downtime day",
      body: `The most downtime in a single day was ${hrs(rep.peakDowntimeDay.hours)} on ${shortDate(rep.peakDowntimeDay.dateKey)}.`,
    });
  }
  if (view.streaks[0]) {
    const s = view.streaks[0];
    facts.push({
      title: "Breakdown streak",
      body: `Breakdowns occurred on ${s.lengthDays} consecutive day(s), ${shortDate(s.start)}–${shortDate(s.end)} (${s.count} shift(s), ${hrs(s.hours)}).`,
    });
  }
  if (off.score != null) {
    const gap = off.score - rep.target;
    facts.push({
      title: "Efficiency vs target",
      body: `Official efficiency is ${pct(off.score)} — ${gap >= 0 ? `${num(gap)} pts above` : `${num(-gap)} pts below`} the ${num(rep.target, 0)}% target.`,
    });
  }
  facts.push({
    title: "Data quality",
    body: `${num(view.flaggedCount, 0)} of ${num(view.total, 0)} rows (${pct(view.errorRate)}) were flagged — ${num(rep.severity.dataQuality.critical, 0)} critical, ${num(rep.severity.dataQuality.warning, 0)} warning.`,
  });
  if (rep.wow) {
    const d = rep.wow.downtimeDelta;
    facts.push({
      title: "Week over week",
      body: `Downtime ${d <= 0 ? "fell" : "rose"} ${hrs(Math.abs(d))}${rep.wow.downtimePctChange == null ? "" : ` (${num(Math.abs(rep.wow.downtimePctChange))}%)`} vs the previous week.`,
    });
  }

  // ---- questions to investigate (conditional, non-causal, phrased as questions) ----
  const questions = [];
  if (top && top.pct >= 50) {
    questions.push(`${top.reason} is over half of downtime (${pct(top.pct)}) — is that expected for this period?`);
  }
  if (view.streaks[0]) {
    const s = view.streaks[0];
    questions.push(`Breakdowns fell on consecutive days (${shortDate(s.start)}–${shortDate(s.end)}) — is there anything common across those shifts to check?`);
  }
  if (off.score != null && off.score < rep.target) {
    questions.push(`Efficiency is below the ${num(rep.target, 0)}% target — which downtime category looks most addressable?`);
  }
  // busiest shift slot by incidents (a pattern, posed as a question)
  const busiest = [...rep.shiftSlots].sort((a, b) => b.count - a.count)[0];
  if (busiest && busiest.count > 0) {
    questions.push(`The ${busiest.label.toLowerCase()} shift logged the most records (${num(busiest.count, 0)}) — worth a closer look at that window?`);
  }
  if (rep.wow && rep.wow.downtimeDelta > 0) {
    questions.push(`Downtime rose versus the previous week — did anything change between those weeks?`);
  }

  return (
    <section className="card report-section">
      <h2>Insights</h2>
      <p className="boundary-caption">
        These are patterns in the data. Causes and actions are for your team to determine.
      </p>

      <div className="insight-cards">
        {facts.map((f, i) => (
          <div key={i} className="insight-card">
            <div className="insight-icon">
              <FactIcon />
            </div>
            <div>
              <div className="insight-title">{f.title}</div>
              <div className="insight-body">{f.body}</div>
            </div>
          </div>
        ))}
      </div>

      <h4>Questions to investigate</h4>
      <p className="muted">Prompts from the patterns above — not conclusions. Your team decides what (if anything) they mean.</p>
      {questions.length === 0 ? (
        <p className="muted">Nothing stands out to flag.</p>
      ) : (
        <ul className="insights">
          {questions.map((q, i) => (
            <li key={i}>{q}</li>
          ))}
        </ul>
      )}

      <h4>Manager notes &amp; actions</h4>
      <p className="muted">The data won't fill this in — record your team's suspected causes and the actions you decide on.</p>
      <textarea
        className="notes-area"
        rows={4}
        placeholder="e.g. Oct 8–9 breakdowns traced to line 3 motor; scheduled maintenance for…"
        value={dash.managerNotes}
        onChange={(e) => dash.setManagerNotes(e.target.value)}
        aria-label="Manager notes and actions"
      />
      <p className="muted">Saved with the report when you click “Save report”.</p>
    </section>
  );
}
