const { test, expect } = require('@playwright/test');
const { applyAllureContext } = require('../../allure-context');
const { AppointmentReportPage } = require('../../../pages/report/AppointmentReportPage');
const { DashboardPage } = require('../../../pages/dashboard/DashboardPage');
const { loginAsValidUser } = require('../../../utils/authFlow');

test.describe('Reports', () => {
  // Signs in and opens the appointment report, which every test below starts from.
  async function openAppointmentReport(page) {
    await loginAsValidUser(page);
    await new DashboardPage(page).waitForDashboard();

    const reportPage = new AppointmentReportPage(page);
    await reportPage.openAppointmentReport();

    return reportPage;
  }

  test.describe('Appointment report', () => {
    // TC057: Verify the report opens with its columns and coherent counts.
    test('TC057 - user can open the appointment report with coherent counts', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Reports',
        suite: 'Appointment Report',
        type: 'regression',
        description:
          'Reaches the appointment report through the side menu and confirms its columns, serial order and tail counts.',
      });

      // Step 1: Sign in and reach the report the way a user does. It lives in
      // the collapsed Report group, so the group opens first.
      await loginAsValidUser(page);
      await new DashboardPage(page).waitForDashboard();
      await page.getByText('Report', { exact: true }).first().click();
      const reportLink = page.locator('a[href="/report/appointment"]');
      await expect(reportLink).toBeVisible({ timeout: 15_000 });
      await reportLink.click();

      // Assert: the report opens with its heading, subtitle and columns.
      const reportPage = new AppointmentReportPage(page);
      await expect(reportPage.reportHeading).toBeVisible({ timeout: 20_000 });
      await expect(reportPage.reportSubtitle).toBeVisible();
      await reportPage.awaitColumns();
      expect(await reportPage.columnHeaders()).toEqual(['Sr No', 'Date', 'Type', 'Name', 'Mobile', 'Status']);

      // Assert: the serials run 1..N and the tail reports the same N.
      await reportPage.awaitEntries();
      const serials = (await reportPage.awaitColumnValues('Sr No')).map((value) => Number(value.trim()));
      expect(serials).toEqual(Array.from({ length: serials.length }, (_, index) => index + 1));
      const total = ((await reportPage.totalText.innerText()).replace(/\s+/g, ' ').trim());
      expect(total).toBe(`Total records: ${serials.length}`);
      const showing = ((await reportPage.showingText.innerText()).replace(/\s+/g, ' ').trim());
      expect(showing).toBe(`Showing 1 – ${serials.length} of ${serials.length} records`);
    });

    // TC058: Verify search finds the matching appointment.
    test('TC058 - user can search the appointment report by mobile number', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Reports',
        suite: 'Appointment Report',
        type: 'regression',
        description:
          'Searches the appointment report for a mobile fragment off a listed row and confirms every row carries it.',
      });

      // Step 1: Open the report and take a mobile fragment off the first row.
      const reportPage = await openAppointmentReport(page);
      const fragment = (await reportPage.firstColumnValue('Mobile')).slice(0, 5);
      expect(fragment, 'The first report row carried no mobile number to search with.').toBeTruthy();

      // Step 2: Search for that fragment and apply it.
      await reportPage.fillSearch(fragment);
      await reportPage.applyFilters();

      // Assert: every remaining row carries the fragment in its mobile number.
      await reportPage.awaitEntries();
      for (const value of await reportPage.awaitColumnValues('Mobile')) {
        expect(value.replace(/\s+/g, '')).toContain(fragment);
      }
    });

    // TC059: Verify a hopeless search reports the empty report and resets clean.
    test('TC059 - user can search the appointment report past its last record', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Reports',
        suite: 'Appointment Report',
        type: 'regression',
        description:
          'Searches the appointment report for text no record holds, confirms the empty state, and resets to the resting controls.',
      });

      // Step 1: Open the report and search for nonsense no record holds.
      const reportPage = await openAppointmentReport(page);
      await reportPage.fillSearch('QXZZQ 9999 nothing here');
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
      expect(await reportPage.selectedFilter(0)).toBe('All');
      expect(await reportPage.selectedFilter(1)).toBe('All');
      expect(await reportPage.startInput.inputValue()).toBe(firstOfMonth);
      expect(await reportPage.endInput.inputValue()).toBe(isoToday);
    });

    // TC060: Verify columns can be shown and hidden again.
    test('TC060 - user can show and hide appointment report columns', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Reports',
        suite: 'Appointment Report',
        type: 'regression',
        description:
          'Shows a hidden appointment report column through the chooser and hides it again, with the counter following.',
      });

      // Step 1: Open the report and note its columns.
      const reportPage = await openAppointmentReport(page);
      expect(await reportPage.columnHeaders()).toEqual(['Sr No', 'Date', 'Type', 'Name', 'Mobile', 'Status']);
      await expect(reportPage.columnsButton).toContainText('(6/13)');

      // Step 2: Show the Doctor column.
      await reportPage.toggleColumn('Doctor');

      // Assert: the column appears with the counter moved.
      expect(await reportPage.columnHeaders()).toContain('Doctor');
      await expect(reportPage.columnsButton).toContainText('(7/13)');

      // Step 3: Hide it again.
      await reportPage.toggleColumn('Doctor');

      // Assert: the report is back to its six columns.
      expect(await reportPage.columnHeaders()).toEqual(['Sr No', 'Date', 'Type', 'Name', 'Mobile', 'Status']);
      await expect(reportPage.columnsButton).toContainText('(6/13)');
    });
  });
});
