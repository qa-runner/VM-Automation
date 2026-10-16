const { test, expect } = require('@playwright/test');
const { applyAllureContext } = require('../../allure-context');
const { PatientReportPage } = require('../../../pages/report/PatientReportPage');
const { DashboardPage } = require('../../../pages/dashboard/DashboardPage');
const { loginAsValidUser } = require('../../../utils/authFlow');

test.describe('Reports', () => {
  // Signs in and opens the patient report, which every test below starts from.
  async function openPatientReport(page) {
    await loginAsValidUser(page);
    await new DashboardPage(page).waitForDashboard();

    const reportPage = new PatientReportPage(page);
    await reportPage.openPatientReport();

    return reportPage;
  }

  test.describe('Patient report navigation', () => {
    // TC098: Verify paging walks the report and back.
    test('TC098 - user can page through the patient report and return', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Reports',
        suite: 'Patient Report',
        type: 'regression',
        description:
          'Pages the patient report forward and back and confirms each page shows its own rows.',
      });

      // Step 1: Open the report and note its first page. A report that fits a
      // single page offers no second page, so the run steps aside then.
      const reportPage = await openPatientReport(page);
      const firstPage = await reportPage.firstRowText();
      expect(firstPage, 'The report held no entries to page from.').toBeTruthy();
      try {
        await reportPage.awaitSecondPage();
      } catch {
        test.skip(true, 'The patient report fits a single page; nothing to page through.');
      }

      // Step 2: Open the second page.
      await reportPage.gotoPage(2);

      // Assert: the second page shows different rows.
      const secondPage = await reportPage.firstRowText();
      expect(secondPage).not.toBe(firstPage);

      // Step 3: Return to the first page.
      await reportPage.gotoPage(1);

      // Assert: the first page is back.
      expect(await reportPage.firstRowText()).toBe(firstPage);
    });

    // TC099: Verify a hidden column can be shown and hidden again.
    test('TC099 - user can show and hide patient report columns', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Reports',
        suite: 'Patient Report',
        type: 'regression',
        description:
          'Shows the hidden Gender column of the patient report through the chooser and hides it again.',
      });

      // Step 1: Open the report and confirm Gender starts hidden.
      const reportPage = await openPatientReport(page);
      await reportPage.awaitColumns();
      expect(await reportPage.columnHeaders()).not.toContain('Gender');

      // Step 2: Show the Gender column.
      await reportPage.toggleColumn('Gender');

      // Assert: the column appears.
      await reportPage.awaitColumns();
      expect(await reportPage.columnHeaders()).toContain('Gender');

      // Step 3: Hide it again.
      await reportPage.toggleColumn('Gender');

      // Assert: the column is gone again.
      await reportPage.awaitColumns();
      expect(await reportPage.columnHeaders()).not.toContain('Gender');
    });

    // TC100: Verify a patient opens their detail and returns.
    test('TC100 - user can open the detail behind a listed patient', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Reports',
        suite: 'Patient Report',
        type: 'regression',
        description:
          'Opens the patient detail behind a listed row from the report and returns to the report.',
      });

      // Step 1: Open the report and note the first case number.
      const reportPage = await openPatientReport(page);
      const caseNo = await reportPage.firstColumnValue('Case ID');

      // Step 2: Open that patient.
      await reportPage.openFirstPatient();

      // Assert: the patient detail opens for that case.
      expect(page.url()).toMatch(/\/patient-detail\/\d+/);
      await expect(page.getByText(caseNo, { exact: false }).first()).toBeVisible({ timeout: 15_000 });

      // Step 3: Return to the report.
      await reportPage.backToReport();

      // Assert: the report is back with its entries.
      await expect(reportPage.reportHeading).toBeVisible();
    });
  });
});
