// Runs once before the whole suite. It prepares allure-results so the report always
// describes exactly one run: fresh results, environment info, executor info and categories.
// It also signs in once to register the inquiry the inquiry search tests rely on, so the
// workers cannot race each other into creating that record more than once.
const fs = require('fs');
const path = require('path');
const { prepareTestData } = require('../utils/testDataSetup');
const { CATEGORIES } = require('./allure-taxonomy');

// Allure reads its raw results from this folder.
const ALLURE_RESULTS = path.join(__dirname, '..', 'allure-results');

// Timestamp used for the run id, the report name and the build order.
function buildRunStamp() {
  const now = new Date();
  return {
    iso: now.toISOString(),
    fileSafe: now.toISOString().replace(/[:.]/g, '-'),
    order: now.getTime(),
  };
}

async function globalSetup() {
  // Clear the previous run, otherwise old results would be counted again in the new report.
  fs.rmSync(ALLURE_RESULTS, { recursive: true, force: true });
  fs.mkdirSync(ALLURE_RESULTS, { recursive: true });

  const run = buildRunStamp();

  // CI variables when the suite runs on a pipeline, plain placeholders on a local machine.
  const branch = process.env.GITHUB_REF_NAME || process.env.BRANCH_NAME || 'local';
  const commit = process.env.GITHUB_SHA || process.env.GIT_COMMIT || 'local-build';
  const buildUrl = process.env.BUILD_URL || '';
  const runId = process.env.GITHUB_RUN_ID || process.env.BUILD_NUMBER || `local-${run.fileSafe}`;

  // Environment tab of the report: what was tested and where.
  const envContent = [
    'App=AyushManager',
    'Browser=Chromium',
    'BaseURL=https://appdev.ayushmanager.com',
    'Environment=dev',
    `Platform=${process.platform}`,
    `RunDate=${run.iso}`,
    `RunId=${runId}`,
    `Branch=${branch}`,
    `Commit=${commit}`,
    `NodeVersion=${process.version}`,
    `PlaywrightVersion=${require('@playwright/test/package.json').version}`,
  ].join('\n');
  fs.writeFileSync(path.join(ALLURE_RESULTS, 'environment.properties'), envContent);

  // Executor tab of the report. buildOrder has to increase per run for trends to work.
  const executor = {
    name: 'AyushManager QA',
    type: 'playwright',
    buildName: 'AyushManager Automation',
    buildOrder: run.order,
    reportName: `AyushManager Automation ${run.iso}`,
    buildUrl,
    url: buildUrl,
  };
  fs.writeFileSync(path.join(ALLURE_RESULTS, 'executor.json'), JSON.stringify(executor, null, 2));

  // Categories tab of the report, taken from the shared taxonomy.
  fs.writeFileSync(path.join(ALLURE_RESULTS, 'categories.json'), JSON.stringify(CATEGORIES, null, 2));

  // Register the shared inquiry record before any worker starts, so the inquiry
  // search tests always have exactly one known record to look for.
  await prepareTestData();
}

module.exports = globalSetup;
