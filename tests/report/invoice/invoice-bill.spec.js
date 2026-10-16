const { test, expect } = require('@playwright/test');
const { applyAllureContext } = require('../../allure-context');
const { InvoiceReportPage } = require('../../../pages/report/InvoiceReportPage');
const { DashboardPage } = require('../../../pages/dashboard/DashboardPage');
const { loginAsValidUser } = require('../../../utils/authFlow');

test.describe('Reports', () => {
  // Signs in and opens the invoice report, which every test below starts from.
  async function openInvoiceReport(page) {
    await loginAsValidUser(page);
    await new DashboardPage(page).waitForDashboard();

    const reportPage = new InvoiceReportPage(page);
    await reportPage.openInvoiceReport();

    return reportPage;
  }

  test.describe('Invoice report bill', () => {
    // TC081: Verify columns can be hidden and brought back.
    test('TC081 - user can hide and bring back invoice report columns', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Reports',
        suite: 'Invoice Report',
        type: 'regression',
        description:
          'Hides the discount column of the invoice report through the chooser and brings it back.',
      });

      // Step 1: Open the report and note its columns.
      const reportPage = await openInvoiceReport(page);
      await reportPage.awaitColumns();
      expect(await reportPage.columnHeaders()).toContain('Discount');

      // Step 2: Hide the Discount column.
      await reportPage.toggleColumn('Discount');

      // Assert: the column is gone while the rest stand.
      await reportPage.awaitColumns();
      const hidden = await reportPage.columnHeaders();
      expect(hidden).not.toContain('Discount');
      expect(hidden.length).toBeGreaterThan(0);

      // Step 3: Bring it back.
      await reportPage.toggleColumn('Discount');

      // Assert: the column is back.
      await reportPage.awaitColumns();
      expect(await reportPage.columnHeaders()).toContain('Discount');
    });

    // TC082: Verify an invoice opens its bill and returns.
    test('TC082 - user can open the bill behind a listed invoice', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Reports',
        suite: 'Invoice Report',
        type: 'regression',
        description:
          'Opens the bill behind a listed invoice from the report and returns to the report.',
      });

      // Step 1: Open the report and note the first invoice number.
      const reportPage = await openInvoiceReport(page);
      const invoiceNo = await reportPage.firstColumnValue('Invoice No');

      // Step 2: Open its bill.
      await reportPage.openFirstBill();

      // Assert: the bill opens for that invoice number.
      expect(page.url()).toMatch(/\/billing\/\d+/);
      await expect(page.getByText(invoiceNo, { exact: false }).first()).toBeVisible({ timeout: 15_000 });

      // Step 3: Return to the report.
      await reportPage.backToReport();

      // Assert: the report is back with its entries.
      await expect(reportPage.reportHeading).toBeVisible();
    });
  });
});
