// Confirms the one rule the Allure report depends on: every test owns exactly one unique id.
// If twenty tests exist there have to be twenty different ids, so a report entry can never
// be shared by two tests. The id is read from the test title, which is its only home.
// Run it with: npm run test:ids
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TESTS_DIR = path.join(ROOT, 'tests');
// Ids look like TC001, TC002, TC003.
const ID_PATTERN = /^TC\d{3}$/;
// Matches the id at the start of a test title, for example "TC001 - user can sign in".
const TITLE_ID_PATTERN = /^(\s*)test\((['"])(TC\d{3})\s*-\s*[^'"]*\2/;

// Collects every spec file under tests/, sub folders included.
function listSpecFiles(dir) {
  const found = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      found.push(...listSpecFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.spec.js')) {
      found.push(full);
    }
  }

  return found.sort();
}

// Returns every test() declaration of one spec file with its id, or null when the id is missing.
function extractTests(content) {
  const tests = [];
  const pattern = /^\s*test\((['"])(.*?)\1/gm;
  let match = pattern.exec(content);

  while (match) {
    const idMatch = /^TC\d{3}\s*-\s+/.exec(match[2]);
    tests.push({ id: idMatch ? /^TC\d{3}/.exec(idMatch[0])[0] : null, title: match[2] });
    match = pattern.exec(content);
  }

  return tests;
}

// Walks every spec file and reports ids that are missing, malformed or used twice.
// Gaps are only a warning, because deleting a test does not have to renumber the rest.
function check() {
  const files = listSpecFiles(TESTS_DIR);
  const problems = [];
  const warnings = [];
  const seen = new Map();
  let testCount = 0;
  let idCount = 0;

  for (const file of files) {
    const relative = path.relative(ROOT, file);
    const content = fs.readFileSync(file, 'utf8');
    const tests = extractTests(content);

    testCount += tests.length;

    for (const { id, title } of tests) {
      if (!id) {
        problems.push(
          `${relative}: "${title}" has no id. Start the title with one, ` +
            `for example "TC001 - ${title}".`,
        );
        continue;
      }

      if (!ID_PATTERN.test(id)) {
        problems.push(`${relative}: "${id}" is malformed. Use the TC000 format.`);
      }

      if (seen.has(id)) {
        problems.push(
          `${relative}: "${id}" is already used by ${seen.get(id)}. ` +
            `Test ids must be unique across the whole suite.`,
        );
      } else {
        seen.set(id, relative);
      }

      idCount += 1;
    }
  }

  // Numbers of all used ids, sorted, so gaps can be pointed out.
  const numbers = [...seen.keys()]
    .map((id) => Number(id.slice(2)))
    .sort((a, b) => a - b);

  if (numbers.length > 0) {
    const expected = Array.from({ length: numbers.length }, (_, index) => index + 1);
    const missing = expected.filter((value) => !numbers.includes(value));

    if (missing.length > 0) {
      warnings.push(
        `Unused ids: ${missing.map((value) => `TC${String(value).padStart(3, '0')}`).join(', ')}. ` +
          `Gaps are allowed, so nothing failed.`,
      );
    }
  }

  console.log(`Scanned ${files.length} spec file(s): ${testCount} test(s), ${idCount} testId(s).`);

  for (const warning of warnings) {
    console.log(`WARN  ${warning}`);
  }

  if (problems.length > 0) {
    for (const problem of problems) {
      console.error(`FAIL  ${problem}`);
    }
    console.error(`\n${problems.length} problem(s) found. Every test must own exactly one unique id.`);
    process.exitCode = 1;
    return;
  }

  console.log('OK    Every test has exactly one unique testId.');
}

check();
