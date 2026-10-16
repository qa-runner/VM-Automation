const { test, expect } = require('@playwright/test');
const { applyAllureContext } = require('../../allure-context');
const { MedicineBillReportPage, parseMoney } = require('../../../pages/report/MedicineBillReportPage');
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

  test.describe('Medicine bill report', () => {
    // TC083: Verify the report opens with its columns.
    test('TC083 - user can open the medicine bill report with its columns', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Reports',
        suite: 'Medicine Bill Report',
        type: 'regression',
        description:
          'Reaches the medicine bill report through the side menu and confirms its thirteen columns with entries.',
      });

      // Step 1: Sign in and reach the report the way a user does. It lives in
      // the collapsed Report group, so the group opens first.
      await loginAsValidUser(page);
      await new DashboardPage(page).waitForDashboard();
      await page.getByText('Report', { exact: true }).first().click();
      const reportLink = page.locator('a[href="/report/medicine-bill"]');
      await expect(reportLink).toBeVisible({ timeout: 15_000 });
      await reportLink.click();

      // Assert: the report opens with its thirteen columns and entries.
      const reportPage = new MedicineBillReportPage(page);
      await expect(reportPage.reportHeading).toBeVisible({ timeout: 20_000 });
      await reportPage.awaitColumns();
      expect(await reportPage.columnHeaders()).toEqual([
        'Bill No', 'Date', 'UHID No', 'Case ID', 'Name', 'Mobile', 'Sub Total', 'Discount',
        'Total Amount', 'Paid', 'Unpaid', 'Doctor', 'Action',
      ]);
      await reportPage.awaitEntries();
    });

    // TC084: Verify every bill balances total against paid plus unpaid.
    test('TC084 - user can see medicine bills where total equals paid plus unpaid', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Reports',
        suite: 'Medicine Bill Report',
        type: 'regression',
        description:
          'Reads every listed medicine bill and confirms its total amount equals paid plus unpaid.',
      });

      // Step 1: Open the report and read the money columns in one pass.
      const reportPage = await openMedicineBillReport(page);
      await reportPage.awaitEntries();
      const totals = await reportPage.awaitColumnValues('Total Amount');
      const paids = await reportPage.listColumnValues('Paid');
      const unpaids = await reportPage.listColumnValues('Unpaid');
      expect(totals.length, 'The medicine bill rows came back uneven.').toBe(paids.length);
      expect(totals.length).toBe(unpaids.length);

      // Assert: total equals paid plus unpaid on every row.
      for (let index = 0; index < totals.length; index += 1) {
        expect(parseMoney(totals[index])).toBe(parseMoney(paids[index]) + parseMoney(unpaids[index]));
      }
    });

    // TC085: Verify search finds the matching bills.
    test('TC085 - user can search the medicine bill report by mobile number', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Reports',
        suite: 'Medicine Bill Report',
        type: 'regression',
        description:
          'Searches the medicine bill report for a mobile fragment off a listed bill and confirms every row carries it.',
      });

      // Step 1: Open the report and take a mobile fragment off the first bill.
      const reportPage = await openMedicineBillReport(page);
      const fragment = (await reportPage.firstColumnValue('Mobile')).slice(0, 5);
      expect(fragment, 'The first bill carried no mobile number to search with.').toBeTruthy();

      // Step 2: Search for that fragment and apply it.
      await reportPage.searchBox.fill(fragment);
      await reportPage.applyFilters();

      // Assert: every remaining row carries the fragment in its mobile number.
      await reportPage.awaitEntries();
      for (const value of await reportPage.awaitColumnValues('Mobile')) {
        expect(value.replace(/\s+/g, '')).toContain(fragment);
      }
    });

    // TC086: Verify a hopeless search reports empty and resets clean.
    test('TC086 - user can search the medicine bill report past its last bill', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Reports',
        suite: 'Medicine Bill Report',
        type: 'regression',
        description:
          'Searches the medicine bill report for text no bill holds, confirms the empty state, and resets to the resting controls.',
      });

      // Step 1: Open the report and search for nonsense no bill holds.
      const reportPage = await openMedicineBillReport(page);
      await reportPage.searchBox.fill('QXZZQ 9999 nothing here');
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
      expect(await reportPage.selectedFilter(0)).toBe('All Departments');
      expect(await reportPage.selectedFilter(1)).toBe('All Doctors');
      expect(await reportPage.startInput.inputValue()).toBe(firstOfMonth);
      expect(await reportPage.endInput.inputValue()).toBe(isoToday);
    });
  });
});
