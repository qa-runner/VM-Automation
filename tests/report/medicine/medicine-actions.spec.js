const { test, expect } = require('@playwright/test');
const { applyAllureContext } = require('../../allure-context');
const { MedicineBillReportPage } = require('../../../pages/report/MedicineBillReportPage');
const { DashboardPage } = require('../../../pages/dashboard/DashboardPage');
const { loginAsValidUser } = require('../../../utils/authFlow');

test.describe('Reports', () => {
  // Signs in and opens the medicine bill report, which every test below starts from.
  async function openMedicineBillReport(page) {
    await loginAsValidUser(page);
    await new DashboardPage(page).waitForDashboard();

    const reportPage = new MedicineBillReportPage(page);
    await reportPage.openMedicineBillReport();

    return reportPage;
  }

  test.describe('Medicine bill columns and bill', () => {
    // TC090: Verify a hidden column can be shown and hidden again.
    test('TC090 - user can show and hide medicine bill report columns', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Reports',
        suite: 'Medicine Bill Report',
        type: 'regression',
        description:
          'Shows the hidden Status column of the medicine bill report through the chooser and hides it again.',
      });

      // Step 1: Open the report and confirm Status starts hidden.
      const reportPage = await openMedicineBillReport(page);
      await reportPage.awaitColumns();
      expect(await reportPage.columnHeaders()).not.toContain('Status');

      // Step 2: Show the Status column.
      await reportPage.toggleColumn('Status');

      // Assert: the column appears.
      await reportPage.awaitColumns();
      expect(await reportPage.columnHeaders()).toContain('Status');

      // Step 3: Hide it again.
      await reportPage.toggleColumn('Status');

      // Assert: the column is gone again.
      await reportPage.awaitColumns();
      expect(await reportPage.columnHeaders()).not.toContain('Status');
    });

    // TC091: Verify a bill opens its bill page and returns.
    test('TC091 - user can open the bill behind a listed medicine bill', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Reports',
        suite: 'Medicine Bill Report',
        type: 'regression',
        description:
          'Opens the bill behind a listed medicine bill from the report and returns to the report.',
      });

      // Step 1: Open the report.
      const reportPage = await openMedicineBillReport(page);

      // Step 2: Open the first bill.
      await reportPage.openFirstBill();

      // Assert: a bill page opens.
      expect(page.url()).toMatch(/\/billing\/\d+/);

      // Step 3: Return to the report.
      await reportPage.backToReport();

      // Assert: the report is back with its entries.
      await expect(reportPage.reportHeading).toBeVisible();
    });
  });
});
