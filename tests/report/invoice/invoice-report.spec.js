const { test, expect } = require('@playwright/test');
const { applyAllureContext } = require('../../allure-context');
const { InvoiceReportPage, parseMoney } = require('../../../pages/report/InvoiceReportPage');
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

  test.describe('Invoice report', () => {
    // TC073: Verify the report opens with its columns and ordered serials.
    test('TC073 - user can open the invoice report with ordered serials', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Reports',
        suite: 'Invoice Report',
        type: 'regression',
        description:
          'Reaches the invoice report through the side menu and confirms its columns with serials running 1..N.',
      });

      // Step 1: Sign in and reach the report the way a user does. It lives in
      // the collapsed Report group, so the group opens first.
      await loginAsValidUser(page);
      await new DashboardPage(page).waitForDashboard();
      await page.getByText('Report', { exact: true }).first().click();
      const reportLink = page.locator('a[href="/report/invoice"]');
      await expect(reportLink).toBeVisible({ timeout: 15_000 });
      await reportLink.click();

      // Assert: the report opens with its fifteen columns.
      const reportPage = new InvoiceReportPage(page);
      await expect(reportPage.reportHeading).toBeVisible({ timeout: 20_000 });
      await reportPage.awaitColumns();
      expect(await reportPage.columnHeaders()).toEqual([
        'No.', 'Type', 'Invoice No', 'Date', 'OPD No', 'Category', 'Patient Name', 'Mobile',
        'Prepared By', 'Doctor', 'Amount', 'Discount', 'Paid', 'Unpaid', 'Action',
      ]);

      // Assert: the serials run 1..N.
      const serials = (await reportPage.awaitColumnValues('No.')).map((value) => Number(value.trim()));
      expect(serials).toEqual(Array.from({ length: serials.length }, (_, index) => index + 1));
    });

    // TC074: Verify every invoice balances amount against paid plus unpaid.
    test('TC074 - user can see invoices where amount equals paid plus unpaid', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Reports',
        suite: 'Invoice Report',
        type: 'regression',
        description:
          'Reads every listed invoice and confirms its amount equals paid plus unpaid, overpayments included.',
      });

      // Step 1: Open the report and read the money columns in one pass.
      const reportPage = await openInvoiceReport(page);
      await reportPage.awaitEntries();
      const amounts = await reportPage.awaitColumnValues('Amount');
      const paids = await reportPage.listColumnValues('Paid');
      const unpaids = await reportPage.listColumnValues('Unpaid');
      expect(amounts.length, 'The invoice rows came back uneven.').toBe(paids.length);
      expect(amounts.length).toBe(unpaids.length);

      // Assert: amount equals paid plus unpaid on every row, including the
      // overpaid ones that carry a negative unpaid balance.
      for (let index = 0; index < amounts.length; index += 1) {
        expect(parseMoney(amounts[index])).toBe(parseMoney(paids[index]) + parseMoney(unpaids[index]));
      }
    });

    // TC075: Verify the invoice number search lands on that invoice.
    test('TC075 - user can search the invoice report by invoice number', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Reports',
        suite: 'Invoice Report',
        type: 'regression',
        description:
          'Searches the invoice report for the number off a listed invoice and confirms every row carries that number.',
      });

      // Step 1: Open the report and take the number off the first invoice.
      const reportPage = await openInvoiceReport(page);
      const invoiceNo = await reportPage.firstColumnValue('Invoice No');

      // Step 2: Search for that number and apply it.
      await reportPage.invoiceInput.fill(invoiceNo);
      await reportPage.applyFilters();

      // Assert: every remaining row carries that invoice number.
      await reportPage.awaitEntries();
      for (const value of await reportPage.awaitColumnValues('Invoice No')) {
        expect(value.trim()).toBe(invoiceNo);
      }
    });

    // TC076: Verify a hopeless invoice search reports empty and resets clean.
    test('TC076 - user can search the invoice report past its last invoice', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Reports',
        suite: 'Invoice Report',
        type: 'regression',
        description:
          'Searches the invoice report for an invoice number that cannot exist, confirms the empty state, and resets to the resting controls.',
      });

      // Step 1: Open the report and search for an invoice from another century.
      const reportPage = await openInvoiceReport(page);
      await reportPage.invoiceInput.fill('INV/2099/NOPE-1');
      await reportPage.applyFilters();

      // Assert: the report says it holds nothing instead of showing stale rows.
      await expect(reportPage.emptyMessage).toBeVisible({ timeout: 15_000 });

      // Step 2: Reset everything.
      await reportPage.resetFilters();

      // Assert: entries are back and every control reports its resting state.
      // The date range rests on its defaults, month start through today.
      const today = new Date();
      const firstOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      const isoToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
        today.getDate(),
      ).padStart(2, '0')}`;
      await reportPage.awaitEntries();
      expect(await reportPage.searchBox.inputValue()).toBe('');
      expect(await reportPage.invoiceInput.inputValue()).toBe('');
      expect(await reportPage.selectedFilter(0)).toBe('All Categories');
      expect(await reportPage.selectedFilter(1)).toBe('All Doctors');
      expect(await reportPage.startInput.inputValue()).toBe(firstOfMonth);
      expect(await reportPage.endInput.inputValue()).toBe(isoToday);
    });
  });
});
