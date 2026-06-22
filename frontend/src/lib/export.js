// Export helpers: turn the current analysis into downloadable artifacts — a
// cleaned CSV and a manager-ready Markdown report. (Chart PNGs are exported from
// the chart canvases themselves.) Reading only; no analysis logic here.
import { pct, hrs, num, shortDate } from "./format.js";

function isoOrBlank(d) {
  if (!d) return "";
  return d instanceof Date ? d.toISOString().replace(".000", "") : String(d);
}

// trigger a browser download of some text
export function downloadText(filename, text, mime = "text/plain") {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// cleaned records -> CSV (the five logical fields, after cleaning)
export function recordsToCsv(records) {
  const head = ["date", "start", "end", "hours", "reason"];
  const lines = [head.join(",")];
  for (const r of records) {
    const cells = [
      r.dateKey || "",
      isoOrBlank(r.start),
      isoOrBlank(r.end),
      r.hours == null ? "" : num(r.hours, 2),
      `"${String(r.reason || "").replace(/"/g, '""')}"`,
    ];
    lines.push(cells.join(","));
  }
  return lines.join("\n");
}

// an honest one-pager in Markdown — computed facts only, with the boundary
// caption and a manager-notes section (the human-supplied causes/actions).
export function buildReportMarkdown(view, mode, datasetName, managerNotes, corrections) {
  const eff = view.efficiency;
  const off = view.officialEfficiency;
  const rep = view.report;
  const range = rep.dateRange;

  const out = [];
  out.push(`# Shift Analytics Report`);
  out.push("");
  out.push(`**Dataset:** ${datasetName} · **Mode:** ${mode} · **Shifts:** ${view.filtered.length}`);
  if (range.min) out.push(`**Range:** ${shortDate(range.min)} – ${shortDate(range.max)} (${range.days} days)`);
  out.push("");
  out.push(`> These are patterns in the data. Causes and actions are for your team to determine.`);
  out.push("");

  if (corrections && corrections.length) {
    out.push(`## Manual corrections (${corrections.length})`);
    out.push(`_Applied on top of the automatic cleaning._`);
    for (const c of corrections) {
      out.push(
        c.action === "exclude"
          ? `- Row ${c.row}: excluded`
          : `- Row ${c.row}: ${c.field} "${c.from}" → "${c.to}"`
      );
    }
    out.push("");
  }

  out.push(`## Efficiency`);
  const gap = off.score == null ? null : off.score - rep.target;
  out.push(`- Official: **${pct(off.score)}** (target ${num(rep.target, 0)}%${gap == null ? "" : `, ${gap >= 0 ? "+" : ""}${num(gap)} pts`})`);
  if (view.failureCustomized) out.push(`- Custom failure set: ${pct(eff.score)}`);
  out.push(`- Total hours: ${hrs(eff.total)} · Downtime: ${hrs(rep.downtimeTotal)}`);
  out.push("");

  out.push(`## Downtime by reason`);
  for (const c of rep.reasonContribution) out.push(`- ${c.reason}: ${hrs(c.hours)} (${pct(c.pct)})`);
  if (!rep.reasonContribution.length) out.push(`- None in range.`);
  out.push("");

  out.push(`## Shifts`);
  for (const s of rep.shiftSlots) out.push(`- ${s.label}: ${s.count} incidents, ${hrs(s.hours)} (avg ${hrs(s.avg)})`);
  out.push("");

  out.push(`## Breakdown streaks`);
  if (view.streaks.length === 0) out.push(`- None found.`);
  else for (const s of view.streaks) out.push(`- ${shortDate(s.start)}–${shortDate(s.end)}: ${s.lengthDays} day(s), ${s.count} shift(s), ${hrs(s.hours)}`);
  out.push("");

  out.push(`## Data quality`);
  const sev = rep.severity.dataQuality;
  out.push(`- ${view.flaggedCount}/${view.total} rows flagged (${pct(view.errorRate)})`);
  out.push(`- Critical ${sev.critical} · Warning ${sev.warning} · Info ${sev.info} · Duplicate ${sev.duplicate}`);
  out.push("");

  if (rep.wow) {
    const d = rep.wow.downtimeDelta;
    out.push(`## Week over week`);
    out.push(`- Downtime ${d <= 0 ? "fell" : "rose"} ${hrs(Math.abs(d))}${rep.wow.downtimePctChange == null ? "" : ` (${num(Math.abs(rep.wow.downtimePctChange))}%)`} vs the previous week.`);
    out.push("");
  }

  out.push(`## Manager notes & actions`);
  out.push(managerNotes && managerNotes.trim() ? managerNotes.trim() : "_(none recorded)_");
  return out.join("\n");
}
