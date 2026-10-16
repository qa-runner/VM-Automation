// Allure CLI 2.x cannot merge history between runs and refuses to write into a folder that
// already has results, so this script keeps the merged history in allure-history/ and copies
// it back into the freshly generated report.
// Usage: node ./scripts/allure-history.js sync   merges the new run into the stored history
//        node ./scripts/allure-history.js clear  drops the stored history and starts over
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const REPORT_DIR = path.join(ROOT, 'allure-report');
// History folder inside the report. Every generate recreates it with the current run only.
const REPORT_HISTORY_DIR = path.join(REPORT_DIR, 'history');
// Trend charts live in widgets, so they need the merged series too.
const REPORT_WIDGETS_DIR = path.join(REPORT_DIR, 'widgets');
// Our own copy of the history, kept outside the report so it survives a report rebuild.
const HISTORY_DIR = path.join(ROOT, 'allure-history');

const TREND_FILES = ['history-trend.json', 'duration-trend.json', 'categories-trend.json', 'retry-trend.json'];
const TEST_HISTORY_FILE = 'history.json';
// Caps so the files do not grow forever as runs are added.
const MAX_ITEMS_PER_TEST = 20;
const MAX_TREND_POINTS = 30;
const STATUS_KEYS = ['failed', 'broken', 'skipped', 'passed', 'unknown'];

// Reads a json file and returns the fallback when it is missing or unreadable.
function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

// Writes json and creates the parent folder when it does not exist yet.
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data));
}

// Counts pass and fail of the items of one test, which is what the trends chart plots.
function computeStatistic(items) {
  const statistic = { failed: 0, broken: 0, skipped: 0, passed: 0, unknown: 0, total: items.length };

  for (const item of items) {
    if (STATUS_KEYS.includes(item.status)) {
      statistic[item.status] += 1;
    } else {
      statistic.unknown += 1;
    }
  }

  return statistic;
}

function mergeTestHistory(fresh, stored) {
  const historyIds = new Set([...Object.keys(stored || {}), ...Object.keys(fresh || {})]);
  const merged = {};

  for (const historyId of historyIds) {
    const byUid = new Map();

    for (const item of [...(stored[historyId]?.items || []), ...(fresh[historyId]?.items || [])]) {
      if (item && item.uid) {
        byUid.set(item.uid, item);
      }
    }

    const items = [...byUid.values()]
      .sort((a, b) => (a.time?.start || 0) - (b.time?.start || 0))
      .slice(-MAX_ITEMS_PER_TEST);

    merged[historyId] = { statistic: computeStatistic(items), items };
  }

  return merged;
}

// Merges two trend series, keeping one point per run.
// The report name identifies a run, and buildOrder puts the points in the right order.
function mergeTrendSeries(fresh, stored) {
  const byReportName = new Map();

  for (const point of [...(stored || []), ...(fresh || [])]) {
    if (point && point.data) {
      byReportName.set(point.reportName || JSON.stringify(point.data), point);
    }
  }

  return [...byReportName.values()]
    .sort((a, b) => (a.buildOrder || 0) - (b.buildOrder || 0))
    .slice(-MAX_TREND_POINTS);
}

// Merges the run that was just generated into the stored history and writes the result
// back to the report, so the opened report shows every run instead of only the last one.
function syncTrends() {
  if (!fs.existsSync(REPORT_HISTORY_DIR)) {
    console.error(`No Allure report history found in ${REPORT_HISTORY_DIR}. Run: npm run allure:generate`);
    process.exitCode = 1;
    return;
  }

  // Per test history: stored copy plus the fresh one from this run.
  const freshTestHistory = readJson(path.join(REPORT_HISTORY_DIR, TEST_HISTORY_FILE), {});
  const storedTestHistory = readJson(path.join(HISTORY_DIR, TEST_HISTORY_FILE), {});
  const mergedTestHistory = mergeTestHistory(freshTestHistory, storedTestHistory);

  writeJson(path.join(REPORT_HISTORY_DIR, TEST_HISTORY_FILE), mergedTestHistory);
  writeJson(path.join(HISTORY_DIR, TEST_HISTORY_FILE), mergedTestHistory);

  const trendSummary = {};

  // Trend charts: same merge per chart, written to history and to widgets.
  for (const file of TREND_FILES) {
    const fresh = readJson(path.join(REPORT_HISTORY_DIR, file), []);
    const stored = readJson(path.join(HISTORY_DIR, file), []);
    const merged = mergeTrendSeries(Array.isArray(fresh) ? fresh : [], Array.isArray(stored) ? stored : []);

    writeJson(path.join(REPORT_HISTORY_DIR, file), merged);
    writeJson(path.join(HISTORY_DIR, file), merged);

    if (fs.existsSync(REPORT_WIDGETS_DIR)) {
      writeJson(path.join(REPORT_WIDGETS_DIR, file), merged);
    }

    trendSummary[file.replace('.json', '')] = merged.length;
  }

  const trackedTests = Object.keys(mergedTestHistory).length;
  const maxRuns = Math.max(...Object.values(trendSummary), 0);

  console.log(
    `Allure history synced: ${trackedTests} test(s) tracked across ${maxRuns} run(s) of trend data ` +
      `(${Object.entries(trendSummary).map(([name, count]) => `${name}: ${count}`).join(', ')}).`,
  );
}

// Throws away the stored history. The next generated report starts a fresh trend.
function clearHistory() {
  fs.rmSync(HISTORY_DIR, { recursive: true, force: true });
  console.log('Allure trend history cleared. The next generated report starts a fresh trend.');
}

// Two commands only, anything else prints how to use the script.
const command = process.argv[2];

if (command === 'sync') {
  syncTrends();
} else if (command === 'clear') {
  clearHistory();
} else {
  console.error('Usage: node scripts/allure-history.js <sync|clear>');
  process.exitCode = 1;
}
