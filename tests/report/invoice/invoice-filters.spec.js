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

  test.describe('Invoice report filters', () => {
    // TC077: Verify the category filter leaves only that category listed.
    test('TC077 - user can filter the invoice report by category', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Reports',
        suite: 'Invoice Report',
        type: 'regression',
        description:
          'Filters the invoice report to the category of a listed invoice and confirms every row carries that category.',
      });

      // Step 1: Open the report and take the category off the first invoice.
      const reportPage = await openInvoiceReport(page);
      const category = await reportPage.firstColumnValue('Category');

      // Step 2: Pick that category and apply it. Picking alone never filters.
      await reportPage.setCategory(category);
      await reportPage.applyFilters();

      // Assert: the control reports the choice and every listed row carries it.
      expect(await reportPage.selectedFilter(0)).toBe(category);
      await reportPage.awaitEntries();
      for (const value of await reportPage.awaitColumnValues('Category')) {
        expect(value.trim()).toBe(category);
      }
    });

    // TC078: Verify the doctor filter leaves only that doctor listed.
    test('TC078 - user can filter the invoice report by doctor', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Reports',
        suite: 'Invoice Report',
        type: 'regression',
        description:
          'Filters the invoice report to the doctor of a listed invoice and confirms every row carries that doctor.',
      });

      // Step 1: Open the report and take the doctor off the first invoice
      // that names one. Some invoices carry a dash instead of a doctor, and
      // on days when none names any doctor there is nothing to filter by.
      const reportPage = await openInvoiceReport(page);
      let doctor = null;
      try {
        doctor = await reportPage.firstUsableValue('Doctor', 15_000);
      } catch {
        test.skip(true, 'No billed doctor on record today; nothing to filter by.');
      }

      // Step 2: Pick that doctor and apply it.
      await reportPage.setDoctor(doctor);
      await reportPage.applyFilters();

      // Assert: the control reports the choice and every listed row carries it.
      expect(await reportPage.selectedFilter(1)).toBe(doctor);
      await reportPage.awaitEntries();
      for (const value of await reportPage.awaitColumnValues('Doctor')) {
        expect(value.trim()).toBe(doctor);
      }
    });

    // TC079: Verify the date range keeps only invoices of that day.
    test('TC079 - user can filter the invoice report to a single day', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Reports',
        suite: 'Invoice Report',
        type: 'regression',
        description:
          'Narrows the invoice report to the day of a listed invoice and confirms every listed invoice carries that day.',
      });

      // Step 1: Open the report and take the day off the first invoice.
      const reportPage = await openInvoiceReport(page);
      const day = await reportPage.firstColumnValue('Date');
      const iso = InvoiceReportPage.toIso(day);

      // Step 2: Narrow both ends to that day and apply it.
      await reportPage.startInput.fill(iso);
      await reportPage.endInput.fill(iso);
      await reportPage.applyFilters();

      // Assert: entries remain and every one carries that day.
      await reportPage.awaitEntries();
      for (const value of await reportPage.awaitColumnValues('Date')) {
        expect(value.trim()).toBe(day);
      }
    });

    // TC080: Verify category and doctor filters combine.
    test('TC080 - user can combine the category and doctor filters', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Reports',
        suite: 'Invoice Report',
        type: 'regression',
        description:
          'Filters the invoice report by a listed category and doctor together and confirms every row honours both.',
      });

      // Step 1: Open the report and take both values off the first invoice,
      // which guarantees the combination matches at least that invoice.
      const reportPage = await openInvoiceReport(page);
      const category = await reportPage.firstColumnValue('Category');
      let doctor = null;
      try {
        doctor = await reportPage.firstUsableValue('Doctor', 15_000);
      } catch {
        test.skip(true, 'No billed doctor on record today; nothing to combine by.');
      }

      // Step 2: Pick both and apply them together.
      await reportPage.setCategory(category);
      await reportPage.setDoctor(doctor);
      await reportPage.applyFilters();

      // Assert: every listed row honours both filters.
      await reportPage.awaitEntries();
      for (const value of await reportPage.awaitColumnValues('Category')) {
        expect(value.trim()).toBe(category);
      }
      for (const value of await reportPage.awaitColumnValues('Doctor')) {
        expect(value.trim()).toBe(doctor);
      }
    });
  });
});
