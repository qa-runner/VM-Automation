# AyushManager Automation Suite

This project is a Playwright-based UI automation framework for the AyushManager application. It follows a Page Object Model (POM) structure and focuses on validating real user workflows such as login and patient registration in a reliable, repeatable, and maintainable way.

The main goal is to reduce manual regression effort and provide a clean foundation for future test coverage as the application grows.

## Why this project exists

- Automate critical business workflows in AyushManager
- Validate login and dashboard navigation reliably
- Test patient creation workflows end-to-end
- Keep test code readable, reusable, and easy to extend
- Produce both HTML and Allure reports for debugging and tracking

## Tech stack

- Playwright for browser automation
- JavaScript with Node.js
- Page Object Model architecture
- Allure reporting integration
- HTML reporting built into Playwright

## Project structure

```text
VM-Automation/
├── data/
│   └── credentials.json
├── pages/
│   ├── auth/
│   │   └── LoginPage.js
│   ├── base/
│   │   └── BasePage.js
│   ├── dashboard/
│   │   └── DashboardPage.js
│   └── patient/
│       └── PatientPage.js
├── tests/
│   ├── auth/
│   │   └── login.spec.js
│   └── patient/
│       └── addPatient.spec.js
├── allure-report/
├── allure-results/
├── test-results/
├── package.json
├── playwright.config.js
├── README.md
└── start.md
```

## Prerequisites

Before running the tests, make sure you have:

- Node.js installed
- npm installed
- Playwright browsers installed
- Access to the AyushManager application environment configured in the project

## Installation

Open PowerShell in the project folder and run:

```powershell
cd "D:\Avi's-PROJECT\VM project\VM-Automation"
npm install
npx playwright install
```

If Playwright browsers are not already installed in your environment, the install step is required before executing any tests.

## Running tests

### Run all tests

```powershell
npx playwright test
```

### Run a specific test file

```powershell
npx playwright test tests/auth/login.spec.js
npx playwright test tests/patient/addPatient.spec.js
```

### Run in headed mode

```powershell
npx playwright test --headed
```

### Run in debug mode

```powershell
npx playwright test --debug
```

### Use project scripts

The repository includes useful scripts in `package.json`:

```powershell
npm run test
npm run test:headed
npm run test:debug
npm run report
npm run allure:generate
npm run allure:open
npm run allure:clear
```

## Test reports

This project is configured to generate multiple report types.

### Playwright HTML report

```powershell
npx playwright show-report
```

### Allure report

```powershell
npm run allure:generate
npm run allure:open
```

The project uses a reporter configuration in `playwright.config.js` that includes:

- line reporter for quick console output
- HTML reporter for browser-based test reports
- Allure reporter for richer, detailed results

## Configuration

The main configuration file is `playwright.config.js` and includes:

- test folder definition
- default timeout values
- base URL: `http://appdev.ayushmanager.com`
- browser setup for Chromium
- screenshot and video retention on failure
- trace capture on retry

## Test data

The project stores login credentials in:

- `data/credentials.json`

This file currently contains a valid QA user used by the login automation flow. Keep this file secure and update credentials as needed based on the environment you are testing.

## Page Object Model design

This framework is organized to keep tests simple and maintainable.

- `BasePage.js` contains shared navigation and wait helpers
- `LoginPage.js` handles login selectors and actions
- `DashboardPage.js` verifies the dashboard state
- `PatientPage.js` encapsulates patient-related actions and validations

This separation allows test files to stay focused on the business flow instead of low-level selectors and repeated browser actions.

## Current coverage

The repository currently includes automation for:

- successful login
- dashboard verification
- patient registration
- patient existence verification after creation

## Best practices used in this project

- Business flows are represented in test specs
- Selectors are kept in page objects rather than scattered across tests
- Reusable actions are centralized in shared base classes
- Assertions validate real UI outcomes, not just method calls
- Reports help diagnose failures quickly

## Suggested next improvements

As the project evolves, this suite can be expanded with:

- negative login scenarios
- validation for required fields
- data-driven patient tests
- CI/CD execution in GitHub Actions or Azure DevOps
- environment-based configuration for dev, QA, and prod

## Notes

This project is intentionally structured for readability and growth. It is suitable for ongoing QA automation work on AyushManager and can be expanded with additional modules as more application workflows are covered.

For local execution, make sure you are in the repository root and that your environment matches the configured app URL and credentials.

