// Lists every breakdown streak the engine found (not just the first). The data
// comes straight from the analysis `view`; this is presentation only.
import { shortDate, hrs } from "../lib/format.js";
import { RULE_TEXT } from "../lib/ruleText.js";
import InfoTip from "./InfoTip.jsx";

export default function StreaksPanel({ streaks, methodLabel, customFailure }) {
  return (
    <section className="card">
      <h3>
        Breakdown streaks <InfoTip text={RULE_TEXT.streak} label="What counts as a streak" />
      </h3>
      <p className="muted caption">
        Method: {methodLabel}
        {customFailure ? " · using a custom failure set" : " · failure set: Breakdown, Unknown Failure"}
      </p>
      {streaks.length === 0 ? (
        <p className="muted">No breakdown streaks found with the current settings.</p>
      ) : (
        <table className="issue-table">
          <thead>
            <tr>
              <th>Dates</th>
              <th>Length</th>
              <th>Shifts</th>
              <th>Breakdown hours</th>
            </tr>
          </thead>
          <tbody>
            {streaks.map((s, i) => (
              <tr key={i}>
                <td>
                  {shortDate(s.start)}–{shortDate(s.end)}
                </td>
                <td>
                  {s.lengthDays} day{s.lengthDays === 1 ? "" : "s"}
                </td>
                <td>{s.count}</td>
                <td>{hrs(s.hours)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
