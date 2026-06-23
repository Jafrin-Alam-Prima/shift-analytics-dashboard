// The one place that ties the data pipeline together: load -> map -> (later)
// clean -> filter -> analyse. It grows stage by stage. Right now it loads the
// CSV, auto-guesses the column mapping, and lets the mapping be overridden.
import { useEffect, useMemo, useState } from "react";
import { loadCsv, parseCsvText } from "../lib/csv.js";
import { autoGuessMap, applyMap } from "../lib/columnMap.js";
import { LOGICAL_FIELDS, defaultParams, defaultReportConfig, DEFAULT_FAILURE_REASONS } from "../lib/config.js";
import { buildDataset } from "../lib/cleaning.js";
import { analyse, efficiency } from "../lib/analysis.js";
import { reportMetrics } from "../lib/report.js";
import { defaultOverrides, applyOverrides, overrideCount, overrideAudit } from "../lib/overrides.js";
import { defaultFilters, applyFilters } from "../lib/filters.js";
import { pingHealth, fetchAnalyze, hydrateRecords } from "../lib/backend.js";

export function useDashboard() {
  const [loadStatus, setLoadStatus] = useState("loading"); // loading | loaded | error
  const [error, setError] = useState("");
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]); // raw rows keyed by original header
  const [map, setMap] = useState({});
  const [params, setParams] = useState(defaultParams);
  const [mode, setMode] = useState("clean"); // clean | raw
  const [filters, setFilters] = useState(defaultFilters);
  const [overrides, setOverrides] = useState(defaultOverrides); // manual per-row corrections
  const [dataSource, setDataSource] = useState("auto"); // auto | local | backend
  const [backendStatus, setBackendStatus] = useState("unknown"); // unknown | checking | online | offline
  const [backendResult, setBackendResult] = useState(null);
  const [datasetName, setDatasetName] = useState("shift_data.csv");
  const [isSample, setIsSample] = useState(true);
  const [uploadError, setUploadError] = useState("");
  const [managerNotes, setManagerNotes] = useState(""); // human-written, saved with the report

  // adopt a freshly parsed table: re-guess the columns and re-run the pipeline
  function ingest(headers, rows) {
    const guess = autoGuessMap(headers, rows);
    setHeaders(headers);
    setRows(rows);
    setMap(guess.map);
    setLoadStatus("loaded");
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await loadCsv();
        if (!alive) return;
        ingest(data.headers, data.rows);
      } catch (e) {
        if (!alive) return;
        setLoadStatus("error");
        setError(e.message || String(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // which required fields are still unmapped (a fixable state, not a hard error)
  const missing = useMemo(
    () => LOGICAL_FIELDS.filter((f) => !map[f]),
    [map]
  );

  const logical = useMemo(
    () => (rows.length && missing.length === 0 ? applyMap(rows, map) : []),
    [rows, map, missing.length]
  );

  // apply manual corrections on top of the parsed rows (none by default), then
  // run the canonical cleaning engine on the result
  const effectiveLogical = useMemo(() => applyOverrides(logical, overrides), [logical, overrides]);
  const dataset = useMemo(
    () => (effectiveLogical.length ? buildDataset(effectiveLogical, params) : null),
    [effectiveLogical, params]
  );
  const correctionCount = overrideCount(overrides);
  const corrections = useMemo(() => overrideAudit(logical, overrides), [logical, overrides]);

  // the record set the views use: cleaned (default) or raw
  const activeRecords = useMemo(() => {
    if (!dataset) return [];
    return mode === "raw" ? dataset.raw : dataset.clean;
  }, [dataset, mode]);

  // apply the combinable filters
  const filteredRecords = useMemo(
    () => applyFilters(activeRecords, filters, params),
    [activeRecords, filters, params]
  );

  // efficiency + streaks + insights for the filtered set
  const analysis = useMemo(
    () => (dataset ? analyse(filteredRecords, params) : null),
    [filteredRecords, params, dataset]
  );

  // the OFFICIAL score is the canonical headline figure: the literal formula with
  // the default failure set, computed over the FULL (unfiltered) record set. It
  // therefore stays pinned (~85.9% on defaults) regardless of the active filters —
  // filters drive only the exploratory charts, not this number. It still tracks
  // the clean/raw mode via activeRecords, and stays pinned to the default failure
  // set even if someone customises the failure categories.
  const officialEfficiency = useMemo(
    () => (dataset ? efficiency(activeRecords, DEFAULT_FAILURE_REASONS) : null),
    [activeRecords, dataset]
  );
  const sameSet = (a, b) =>
    a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");
  const failureCustomized = !sameSet(params.failureReasons, DEFAULT_FAILURE_REASONS);

  // report metrics for the filtered set (local computation)
  const reportLocal = useMemo(
    () =>
      dataset
        ? reportMetrics(filteredRecords, params, params.report || defaultReportConfig(), {
            issues: dataset.issues,
          })
        : null,
    [filteredRecords, params, dataset]
  );

  // overall readiness for the analytical views
  const ready = loadStatus === "loaded" && missing.length === 0 && !!dataset;

  // ---- data source layer (local / backend) ----
  const wantBackend = dataSource === "auto" || dataSource === "backend";

  // health-check the backend whenever we might want it (and on Retry below)
  async function checkBackend() {
    setBackendStatus("checking");
    setBackendStatus((await pingHealth()) ? "online" : "offline");
  }
  useEffect(() => {
    if (wantBackend) checkBackend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSource]);

  const usingBackend = wantBackend && backendStatus === "online";

  // when using the backend, send the current params/mode/filters and let Django
  // recompute; on any failure mark it offline so we fall back to local.
  useEffect(() => {
    if (!usingBackend || !ready) {
      setBackendResult(null);
      return;
    }
    let alive = true;
    (async () => {
      try {
        // send our current rows + manual overrides so the backend analyses the
        // same data the same way (parity, incl. uploads + corrections)
        const data = await fetchAnalyze({ params, mode, filters, rows: logical, overrides });
        if (alive) setBackendResult(data);
      } catch {
        if (alive) {
          setBackendStatus("offline");
          setBackendResult(null);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [usingBackend, ready, params, mode, filters, logical, overrides]);

  // which source is actually driving the views right now
  const effectiveSource = usingBackend && backendResult ? "backend" : "local";

  // one unified result object the views consume, from whichever source
  const view = useMemo(() => {
    if (!dataset || !analysis) return null;
    if (effectiveSource === "backend" && backendResult) {
      const b = backendResult;
      return {
        source: "backend",
        filtered: hydrateRecords(b.records),
        cleanRecords: hydrateRecords(b.clean),
        rawRecords: hydrateRecords(b.raw),
        efficiency: b.efficiency,
        // pinned to the FULL (unfiltered) set, computed locally — identical to the
        // backend by parity, so the headline stays canonical even in backend mode
        // (the backend's b.officialEfficiency is over the filtered set).
        officialEfficiency,
        failureCustomized: b.failureCustomized,
        streaks: b.streaks,
        insights: b.insights,
        issues: b.dataQuality.issues,
        flaggedCount: b.dataQuality.flaggedCount,
        total: b.dataQuality.total,
        cleanCount: b.dataQuality.cleanCount,
        errorRate: b.dataQuality.errorRate,
        report: b.report || reportLocal,
        groups: params.groups,
      };
    }
    return {
      source: "local",
      filtered: filteredRecords,
      cleanRecords: dataset.clean,
      rawRecords: dataset.raw,
      efficiency: analysis.efficiency,
      officialEfficiency,
      failureCustomized,
      streaks: analysis.streaks,
      insights: analysis.insights,
      issues: dataset.issues,
      flaggedCount: dataset.flaggedCount,
      total: dataset.total,
      cleanCount: dataset.cleanCount,
      errorRate: dataset.errorRate,
      report: reportLocal,
      groups: params.groups,
    };
  }, [effectiveSource, backendResult, dataset, analysis, filteredRecords, officialEfficiency, failureCustomized, reportLocal, params.groups]);

  // live count of detected data-quality issues (sum of the cleaning engine's
  // per-issue counts) — drives the badge on the Anomaly report nav item. Computed
  // from the active view, never hardcoded; 0 when no data is loaded.
  const anomalyCount = useMemo(
    () => (view && view.issues ? view.issues.reduce((s, it) => s + (it.count || 0), 0) : 0),
    [view]
  );

  // helper for changing one cleaning strategy
  function setCleaning(issueKey, value) {
    setParams((p) => ({ ...p, cleaning: { ...p.cleaning, [issueKey]: value } }));
  }

  // the full (unfiltered) cleaned date span — anchors the Filters date presets to
  // the dataset's own dates rather than the system clock (the data is historical).
  const datasetDates = useMemo(() => {
    if (!dataset) return { min: null, max: null };
    const keys = dataset.clean.map((r) => r.dateKey).filter(Boolean).sort();
    return { min: keys[0] || null, max: keys.length ? keys[keys.length - 1] : null };
  }, [dataset]);

  // filter helpers
  function setFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value }));
  }
  function setDateRange(from, to) {
    setFilters((f) => ({ ...f, dateFrom: from, dateTo: to }));
  }
  function resetFilters() {
    setFilters(defaultFilters());
  }

  // the Filters panel is collapsed by default so the dashboard leads with
  // information; the prominent toggle + active-filter chips keep it discoverable.
  // The open state persists across view switches.
  const [filtersOpen, setFiltersOpen] = useState(false);

  // dataset helpers: upload a CSV (text) or reset to the bundled sample
  function loadCsvText(text, name) {
    try {
      const { headers, rows } = parseCsvText(text);
      if (!rows.length) throw new Error("That file has no data rows.");
      ingest(headers, rows);
      setDatasetName(name || "uploaded.csv");
      setIsSample(false);
      setUploadError("");
      setFilters(defaultFilters());
      setOverrides({});
      return { ok: true };
    } catch (e) {
      setUploadError(e.message || "Could not read that CSV.");
      return { ok: false, error: e.message };
    }
  }
  async function resetToSample() {
    try {
      const data = await loadCsv();
      ingest(data.headers, data.rows);
      setDatasetName("shift_data.csv");
      setIsSample(true);
      setUploadError("");
      setFilters(defaultFilters());
      setOverrides({});
    } catch (e) {
      setUploadError(e.message || "Could not reload the sample.");
    }
  }

  // load a saved report: its rows are logical, so use an identity column map and
  // restore the saved params / mode / filters.
  function applyReport(report) {
    const idMap = {};
    LOGICAL_FIELDS.forEach((f) => (idMap[f] = f));
    const base = defaultParams();
    const rp = report.params || {};
    setHeaders([...LOGICAL_FIELDS]);
    setRows(report.rows || []);
    setMap(idMap);
    setParams({
      failureReasons: rp.failureReasons || base.failureReasons,
      groups: { ...base.groups, ...(rp.groups || {}) },
      streak: { ...base.streak, ...(rp.streak || {}) },
      cleaning: { ...base.cleaning, ...(rp.cleaning || {}) },
      report: { ...base.report, ...(rp.report || {}) },
    });
    setMode(report.mode || "clean");
    setFilters({ ...defaultFilters(), ...(report.filters || {}) });
    setDatasetName(`${report.name || "report"} (saved)`);
    setIsSample(false);
    setUploadError("");
    setManagerNotes(report.notes || "");
    setLoadStatus("loaded");
  }

  // analysis-param helpers (failure set, streak knobs, grouping)
  function toggleFailure(reason) {
    setParams((p) => {
      const has = p.failureReasons.includes(reason);
      return {
        ...p,
        failureReasons: has
          ? p.failureReasons.filter((r) => r !== reason)
          : [...p.failureReasons, reason],
      };
    });
  }
  function setStreakKnob(key, value) {
    setParams((p) => ({ ...p, streak: { ...p.streak, [key]: value } }));
  }
  function setReasonGroup(reason, groupName) {
    setParams((p) => {
      const groups = {};
      for (const g of Object.keys(p.groups)) groups[g] = p.groups[g].filter((r) => r !== reason);
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName] = [...groups[groupName], reason];
      return { ...p, groups };
    });
  }
  function resetParams() {
    setParams(defaultParams());
  }

  // report-config helpers (shift windows, target, severity bands)
  function setReport(patch) {
    setParams((p) => ({ ...p, report: { ...p.report, ...patch } }));
  }
  function setShiftWindow(index, field, value) {
    setParams((p) => {
      const windows = p.report.shiftWindows.map((w, i) => (i === index ? { ...w, [field]: value } : w));
      return { ...p, report: { ...p.report, shiftWindows: windows } };
    });
  }
  function setSeverityBand(key, value) {
    setParams((p) => ({ ...p, report: { ...p.report, severityBands: { ...p.report.severityBands, [key]: value } } }));
  }
  function resetReport() {
    setParams((p) => ({ ...p, report: defaultReportConfig() }));
  }

  // manual correction helpers (auditable, reversible)
  function setFieldOverride(rowIndex, field, value) {
    setOverrides((o) => {
      const next = { ...o };
      const entry = { ...(next[rowIndex] || {}) };
      const fields = { ...(entry.fields || {}) };
      const original = (logical[rowIndex] && logical[rowIndex][field]) || "";
      if (value === original) delete fields[field]; // a no-op edit is not a correction
      else fields[field] = value;
      if (Object.keys(fields).length) entry.fields = fields;
      else delete entry.fields;
      if (Object.keys(entry).length) next[rowIndex] = entry;
      else delete next[rowIndex];
      return next;
    });
  }
  function toggleExclude(rowIndex) {
    setOverrides((o) => {
      const next = { ...o };
      const entry = { ...(next[rowIndex] || {}) };
      if (entry.excluded) delete entry.excluded;
      else entry.excluded = true;
      if (Object.keys(entry).length) next[rowIndex] = entry;
      else delete next[rowIndex];
      return next;
    });
  }
  function revertRow(rowIndex) {
    setOverrides((o) => {
      const next = { ...o };
      delete next[rowIndex];
      return next;
    });
  }
  function revertAllOverrides() {
    setOverrides({});
  }

  return {
    loadStatus,
    error,
    headers,
    rows,
    map,
    setMap,
    missing,
    logical,
    params,
    setParams,
    setCleaning,
    dataset,
    mode,
    setMode,
    activeRecords,
    filters,
    setFilter,
    setFilters,
    setDateRange,
    resetFilters,
    datasetDates,
    filtersOpen,
    setFiltersOpen,
    filteredRecords,
    analysis,
    officialEfficiency,
    failureCustomized,
    toggleFailure,
    setStreakKnob,
    setReasonGroup,
    resetParams,
    setReport,
    setShiftWindow,
    setSeverityBand,
    resetReport,
    ready,
    // data source layer
    dataSource,
    setDataSource,
    backendStatus,
    checkBackend,
    effectiveSource,
    view,
    anomalyCount,
    // dataset management
    datasetName,
    isSample,
    uploadError,
    loadCsvText,
    resetToSample,
    applyReport,
    managerNotes,
    setManagerNotes,
    // manual corrections (X4)
    overrides,
    corrections,
    correctionCount,
    setFieldOverride,
    toggleExclude,
    revertRow,
    revertAllOverrides,
  };
}
