# AyushManager Automation Suite

Playwright UI automation for the AyushManager app (`https://appdev.ayushmanager.com`), written in JavaScript with a Page Object Model structure.

100 tests, TC001–TC100 with no gaps, across Auth, Dashboard, Patient, Inquiry, Appointment, Therapy, Activity and Reports. See [TESTS.md](TESTS.md) for the module-wise list.

## Tech stack

Playwright, JavaScript (Node.js), Page Object Model, Allure and HTML reports, Chromium.

## Structure

```text
VM-Automation/
├── data/
│   └── credentials.json        QA user used by the auth tests
├── pages/                      one page object per screen
│   ├── base/BasePage.js
│   ├── auth/LoginPage.js, ForgotPasswordPage.js
│   ├── dashboard/DashboardPage.js, HeaderPage.js
│   ├── inquiry/InquiryPage.js
│   ├── patient/PatientPage.js, PatientListTabsPage.js
│   ├── appointment/AppointmentCalendarPage.js
│   ├── therapy/TherapyListPage.js, AdvisedTherapiesPage.js
│   ├── activity/ActivityLogPage.js
│   └── report/AppointmentReportPage.js, DayEndReportPage.js,
│             InvoiceReportPage.js, MedicineBillReportPage.js,
│             PatientReportPage.js
├── tests/                      module folders, one file per feature
│   ├── auth/authentication.spec.js
│   ├── dashboard/location-switching.spec.js, search-palette.spec.js,
│   │   dashboard-widgets.spec.js
│   ├── patient/registration.spec.js, patient-list.spec.js,
│   │   patient-list-controls.spec.js
│   ├── inquiry/inquiry-page.spec.js, inquiry-search.spec.js,
│   │   inquiry-filters.spec.js, inquiry-row-actions.spec.js,
│   │   inquiry-update.spec.js
│   ├── appointment/appointment-calendar.spec.js
│   ├── therapy/therapy-list.spec.js, advised-therapies.spec.js
│   ├── activity/activity-log.spec.js, activity-filters.spec.js,
│   │   activity-detail.spec.js
│   ├── report/appointment/, report/day-end/, report/invoice/,
│   │   report/medicine/, report/patient/   (one folder per report)
│   ├── allure-taxonomy.js      modules/suites the Allure report allows
│   ├── allure-context.js       per-test Allure registration + validation
│   └── global-setup.js
├── utils/                      shared data generators and flow steps
│   ├── random.js
│   ├── authData.js, authFlow.js
│   ├── inquirySeed.js
│   ├── patientData.js, patientFlow.js
│   └── testDataSetup.js
├── scripts/
│   └── check-test-ids.js       every test owns exactly one unique TC id
├── playwright.config.js
├── TESTS.md                    module wise test count and titles
├── README.md
└── start1.md, start2.md, start3.md   requirement notes
```

## Install

```powershell
npm install
npx playwright install
```

## Run

```powershell
npm test                                              # all tests
npm run test:ids                                      # id check: 1 test = 1 unique TC id
npx playwright test tests/patient/patient-list.spec.js   # one file
npx playwright test tests/report --workers=1            # one module, gentle on the backend
npx playwright test --headed                           # watch it run
npx playwright test --debug                            # step through
```

## Reports

```powershell
npm run report           # HTML report
npm run allure:report    # generate + open the Allure report
npm run allure:serve     # serve raw allure-results instead
```

## Conventions

- Selectors live in page objects; a spec file holds only the business flow.
- Test ids are gapless (`TC001`–`TC100`) and every test carries a `// TCnnn: ...` summary comment above it. Deleting a test means renumbering the suite and [TESTS.md](TESTS.md).
- Every test registers `module`, `suite`, `type` and `description` through `applyAllureContext`, validated against `tests/allure-taxonomy.js`. New modules/suites go in the taxonomy first.
- Each test signs in itself (`workers: 3`, `fullyParallel: false`, no `storageState` reuse — a restored session silently changes the app UI).
- Each test creates the data it needs and deletes it again, so tests run in any order. Inquiries cannot be deleted by the product, so inquiry tests only ever read or cancel. Report and activity-log tests are read-only by design.
- Never assert on hardcoded ambient data. Take filter values, search tokens and names off live rows, so the test depends on the page rather than on a record someone may delete.
- The app refetches lists in the background and answers slowly under load: page objects poll for answered states (rows or the empty message — never a bare zero) instead of reading once, and settle change-aware.
- When data a test needs is legitimately absent (single-page report, no billed doctor today), the run steps aside with `test.skip(reason)` instead of failing or asserting nothing.
- `actionTimeout` lives inside `use` in the config (top-level is silently ignored).
- New suites are verified green on consecutive runs at `--workers=1` before they count — the dev backend buckles under parallel load.

## Deliberately not covered

- Forgot-password OTP screen, resend code and final password reset (need a real registered mobile number).
- Patient list tab dropdowns for sort/rows-per-page/date (the controls report the choice while rows keep the previous answer; see the note in `pages/patient/PatientListTabsPage.js`).
- Booking an appointment end to end (the save endpoint usually hangs; the form's safe paths are covered).
- Prescription workspace contents, follow-up forms, therapy package form, appointment card ellipsis menu (opens nothing), `Absent` appointment status (no rows on record).
