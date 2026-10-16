// Single source of truth for the Allure report structure.
// Tests are validated against these lists, so a report can only ever contain known names.

// Software modules shown as the top level of the report.
const MODULES = ['Auth', 'Dashboard', 'Patient', 'Inquiry', 'Appointment', 'Therapy', 'Activity', 'Reports'];

// Suites allowed inside each module, in report order.
const SUITES_BY_MODULE = {
  Auth: ['Signin & Signout', 'Forgot Password'],
  Dashboard: ['Location Switching', 'Search Palette', 'Overview Stats', 'Quick Actions', 'Appointments Widget'],
  Patient: [
    'OPD Registration',
    'IPD Registration',
    'Registration Validation',
    'Patient List',
    'Patient Update',
    'List Row Actions',
    'Patient Deletion',
    'Patient Search',
    'Waiting List',
    'Waiting List Filters',
    'Drop Out Patient',
  ],
  Inquiry: [
    'Count Verification',
    'Search',
    'Rows Per Page',
    'Status Filter',
    'Source Filter',
    'Priority Filter',
    'Add Inquiry',
    'Row Actions',
    'Pagination',
    'Inquiry Update',
  ],
  Appointment: ['Calendar'],
  Therapy: ['Therapy List', 'Advised Therapies'],
  Activity: ['Activity Log', 'Activity Filters', 'Activity Detail'],
  Reports: ['Appointment Report', 'Day End Report', 'Invoice Report', 'Medicine Bill Report', 'Patient Report'],
};

// Tags a test can carry. They become the smoke and regression filters in the report.
const TEST_TYPES = ['smoke', 'regression'];

// Failure messages grouped by cause, so the Categories widget can say who has to fix what.
// Each pattern is matched against the failure message first and the stack trace as a fallback.
const FAILURE_MESSAGE_PATTERNS = {
  // Session or login problems, including the http codes the app returns for them.
  auth: '.*(unauthorized|forbidden|\\b40[13]\\b|session (has )?expired|session (was )?closed|invalid (token|credential|password)|(login|sign[ -]?in) (failed|error)|not (logged|authenticated) in).*',
  // Browser, network or server problems that have nothing to do with the application logic.
  infrastructure:
    '.*(net::ERR_[A-Z_]+|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ENOTFOUND|EHOSTUNREACH|EADDRINUSE|ERR_INTERNET_DISCONNECTED|\\b50[234]\\b|gateway time-?out|service unavailable|bad gateway).*',
  // Missing, duplicate or already cleaned up test data.
  testData:
    '.*(test data|fixture|seed data|duplicate|already exists|UHID|no (patient|record|row)s? (found|available)|cleanup).*',
  // Anything that ran out of time, matched on the message because the text starts with the error name.
  timeout: '^(TimeoutError|Error: Timeout|Error: Test timeout of).*',
  // Playwright assertion and locator problems, which are defects in the test itself.
  testDefect:
    '.*(expect\\(|locator\\(|toBe[A-Z]|toHave[A-Z]|toContain[A-Za-z]*\\(|strict mode violation|resolved to \\d+ elements?|intercepts pointer events|element is not (visible|attached|enabled)|waiting for locator|No (node|element) found).*',
  // The application answered, but with something the test did not expect.
  product:
    '.*(Unexpected response|unexpected (status|error|response)|Internal Server Error|Bad Request|validation (failed|error)|is not allowed|does not exist|not supported|missing (field|value|column|element)|undefined is not).*',
};

// Categories are written to allure-results/categories.json on every run.
// Allure only shows a category when a result actually matches it, so an all green run shows none.
const CATEGORIES = [
  {
    name: 'Authentication & session issues',
    matchedStatuses: ['failed', 'broken'],
    messageRegex: FAILURE_MESSAGE_PATTERNS.auth,
  },
  {
    name: 'Environment & infrastructure',
    matchedStatuses: ['failed', 'broken'],
    messageRegex: FAILURE_MESSAGE_PATTERNS.infrastructure,
    traceRegex: FAILURE_MESSAGE_PATTERNS.infrastructure,
  },
  {
    name: 'Test data & fixtures',
    matchedStatuses: ['failed', 'broken'],
    messageRegex: FAILURE_MESSAGE_PATTERNS.testData,
  },
  {
    name: 'Timeouts',
    matchedStatuses: ['failed', 'broken'],
    messageRegex: FAILURE_MESSAGE_PATTERNS.timeout,
    traceRegex: FAILURE_MESSAGE_PATTERNS.timeout,
  },
  {
    name: 'Test defects (assertions & locators)',
    matchedStatuses: ['failed', 'broken'],
    messageRegex: FAILURE_MESSAGE_PATTERNS.testDefect,
    traceRegex: FAILURE_MESSAGE_PATTERNS.testDefect,
  },
  {
    name: 'Product defects',
    matchedStatuses: ['failed', 'broken'],
    messageRegex: FAILURE_MESSAGE_PATTERNS.product,
  },
  {
    name: 'Not executed (skipped)',
    matchedStatuses: ['skipped'],
  },
  {
    name: 'Unclassified failures',
    matchedStatuses: ['failed', 'broken', 'skipped'],
  },
];

module.exports = { MODULES, SUITES_BY_MODULE, TEST_TYPES, CATEGORIES };
