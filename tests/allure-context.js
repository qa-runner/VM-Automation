// Single place where a test declares its Allure metadata.
// Every value is validated against the taxonomy, so a typo fails the test instead of
// silently creating a new suite in the report.
const { test } = require('@playwright/test');
const { allure } = require('allure-playwright');
const { MODULES, SUITES_BY_MODULE, TEST_TYPES } = require('./allure-taxonomy');

// Matches the id at the start of a test title, for example "TC001 - user can sign in".
const TITLE_ID_PATTERN = /^(TC\d{3})\s*-\s*/;

// Reads the id from the running test title. The title is the only place an id is written,
// so the report and the test name can never drift apart.
function readTestIdFromTitle() {
  const match = TITLE_ID_PATTERN.exec(test.info().title);

  if (!match) {
    throw new Error(
      `Allure context: test title must start with a unique id, for example ` +
        `"TC001 - user can sign in". Received: "${test.info().title}"`,
    );
  }

  return match[1];
}

// Registers module, suite, unique test id, type and description for the running test.
// The test id is taken from the test title, so it is not passed in here.
async function applyAllureContext({ module, suite, type, description } = {}) {
  // Module is required and must be one of the known software modules.
  if (!module) {
    throw new Error('Allure context: "module" is required');
  }
  if (!MODULES.includes(module)) {
    throw new Error(
      `Allure context: "${module}" is not a known module. Use one of: ${MODULES.join(', ')}`,
    );
  }

  // Suite is required and must belong to the module that was given.
  if (!suite) {
    throw new Error(`Allure context: "suite" is required for module "${module}"`);
  }
  if (!SUITES_BY_MODULE[module].includes(suite)) {
    throw new Error(
      `Allure context: "${suite}" is not a known suite of "${module}". ` +
        `Use one of: ${SUITES_BY_MODULE[module].join(', ')}`,
    );
  }

  // Every test owns its own id, so one test can never share a report entry with another.
  const testId = readTestIdFromTitle();

  // Type drives the smoke or regression tag in the report. Regression is the default.
  const resolvedType = type || 'regression';
  if (!TEST_TYPES.includes(resolvedType)) {
    throw new Error(
      `Allure context: "type" must be one of ${TEST_TYPES.join(', ')} (received "${resolvedType}")`,
    );
  }

  await allure.label('module', module);

  // Report hierarchy: the module is the parent suite and the suite sits directly below it.
  // Epic and feature mirror the same two names so Features by stories matches the Suites view.
  await allure.parentSuite(module);
  await allure.subSuite(suite);
  await allure.epic(module);
  await allure.feature(suite);

  // Custom labels shown on the test page, plus the tag used to filter smoke and regression runs.
  await allure.label('testId', testId);
  await allure.tag(resolvedType);

  // Description explains what the test proves, so the report reads without opening the code.
  if (description) {
    await allure.description(description);
  }
}

module.exports = { applyAllureContext };
