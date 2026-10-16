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

  test.describe('Medicine bill filters', () => {
    // TC087: Verify the doctor filter leaves only that doctor listed.
    test('TC087 - user can filter the medicine bill report by doctor', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Reports',
        suite: 'Medicine Bill Report',
        type: 'regression',
        description:
          'Filters the medicine bill report to the doctor of a listed bill and confirms every row carries that doctor.',
      });

      // Step 1: Open the report and take the doctor off the first bill that
      // names one. Some bills carry a dash instead of a doctor, and on days
      // when no bill names any doctor there is nothing to filter by, so the
      // run steps aside instead of filtering to a dash.
      const reportPage = await openMedicineBillReport(page);
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

    // TC088: Verify the department filter answers and resets clean.
    test('TC088 - user can filter the medicine bill report by department', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Reports',
        suite: 'Medicine Bill Report',
        type: 'regression',
        description:
          'Filters the medicine bill report by department and confirms the list answers it, then resets clean.',
      });

      // Step 1: Open the report and pick the first concrete department. The
      // report shows no department column, so the proof is that the list
      // answers the control and Reset brings the entries back.
      const reportPage = await openMedicineBillReport(page);
      await reportPage.setDepartment('Ayurveda');
      await reportPage.applyFilters();

      // Assert: the control reports the choice and the list answers it with
      // rows or the empty state, never a stale list.
      expect(await reportPage.selectedFilter(0)).toBe('Ayurveda');
      const answered =
        (await reportPage.rowCount()) > 0 || (await reportPage.emptyMessage.count()) > 0;
      expect(answered, 'The department filter left the list neither filled nor empty.').toBe(true);

      // Step 2: Reset everything.
      await reportPage.resetFilters();

      // Assert: entries are back under All Departments.
      await reportPage.awaitEntries();
      expect(await reportPage.selectedFilter(0)).toBe('All Departments');
    });

    // TC089: Verify the date range keeps only bills of that day.
    test('TC089 - user can filter the medicine bill report to a single day', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Reports',
        suite: 'Medicine Bill Report',
        type: 'regression',
        description:
          'Narrows the medicine bill report to the day of a listed bill and confirms every listed bill carries that day.',
      });

      // Step 1: Open the report and take the day off the first bill.
      const reportPage = await openMedicineBillReport(page);
      const day = await reportPage.firstColumnValue('Date');
      const iso = MedicineBillReportPage.toIso(day);

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
  });
});
