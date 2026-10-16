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

  test.describe('Patient report', () => {
    // TC092: Verify the report opens with its columns and entries.
    test('TC092 - user can open the patient report with its columns', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Reports',
        suite: 'Patient Report',
        type: 'regression',
        description:
          'Reaches the patient report through the side menu and confirms its nine columns with entries.',
      });

      // Step 1: Sign in and reach the report the way a user does. It lives in
      // the collapsed Report group, so the group opens first.
      await loginAsValidUser(page);
      await new DashboardPage(page).waitForDashboard();
      await page.getByText('Report', { exact: true }).first().click();
      const reportLink = page.locator('a[href="/report/patient"]');
      await expect(reportLink).toBeVisible({ timeout: 15_000 });
      await reportLink.click();

      // Assert: the report opens with its nine columns and entries.
      const reportPage = new PatientReportPage(page);
      await expect(reportPage.reportHeading).toBeVisible({ timeout: 20_000 });
      await reportPage.awaitColumns();
      expect(await reportPage.columnHeaders()).toEqual([
        'Case ID', 'UHID No', 'Date', 'Name', 'Phone', 'Department', 'Doctor', 'Status', 'Action',
      ]);
      await reportPage.awaitEntries();
    });

    // TC093: Verify search finds the matching patients.
    test('TC093 - user can search the patient report by phone number', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Reports',
        suite: 'Patient Report',
        type: 'regression',
        description:
          'Searches the patient report for a phone fragment off a listed row and confirms every row carries it.',
      });

      // Step 1: Open the report and take a phone fragment off the first row.
      const reportPage = await openPatientReport(page);
      const fragment = (await reportPage.firstColumnValue('Phone')).replace(/\D/g, '').slice(-5);
      expect(fragment, 'The first row carried no phone number to search with.').toBeTruthy();

      // Step 2: Search for that fragment and apply it.
      await reportPage.searchBox.fill(fragment);
      await reportPage.applyFilters();

      // Assert: every remaining row carries the fragment in its phone number.
      await reportPage.awaitEntries();
      for (const value of await reportPage.awaitColumnValues('Phone')) {
        expect(value.replace(/\D/g, '')).toContain(fragment);
      }
    });

    // TC094: Verify a hopeless search reports empty and resets clean.
    test('TC094 - user can search the patient report past its last patient', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Reports',
        suite: 'Patient Report',
        type: 'regression',
        description:
          'Searches the patient report for text no patient holds, confirms the empty state, and resets to the resting controls.',
      });

      // Step 1: Open the report and search for nonsense no patient holds.
      const reportPage = await openPatientReport(page);
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
