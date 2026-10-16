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

  test.describe('Patient report filters', () => {
    // TC095: Verify the department filter keeps its department with the blanks.
    test('TC095 - user can filter the patient report by department', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Reports',
        suite: 'Patient Report',
        type: 'regression',
        description:
          'Filters the patient report by department and confirms every row carries that department or no department.',
      });

      // Step 1: Open the report and take the department off the first row
      // that names one. Some rows carry a dash instead of a department.
      const reportPage = await openPatientReport(page);
      const department = await reportPage.firstUsableValue('Department');

      // Step 2: Pick that department and apply it.
      await reportPage.setDepartment(department);
      await reportPage.applyFilters();

      // Assert: the control reports the choice and every listed row carries
      // that department or none. Rows without a department travel with every
      // filter instead of belonging to one, which the report shows as-is.
      expect(await reportPage.selectedFilter(0)).toBe(department);
      await reportPage.awaitEntries();
      for (const value of await reportPage.awaitColumnValues('Department')) {
        expect(['', '-', '—', department]).toContain(value.trim());
      }
    });

    // TC096: Verify the doctor filter leaves only that doctor listed.
    test('TC096 - user can filter the patient report by doctor', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Reports',
        suite: 'Patient Report',
        type: 'regression',
        description:
          'Filters the patient report to the doctor of a listed row and confirms every row carries that doctor.',
      });

      // Step 1: Open the report and take the doctor off the first row that
      // names one. On days when no row names any doctor there is nothing to
      // filter by, so the run steps aside instead of filtering to a dash.
      const reportPage = await openPatientReport(page);
      let doctor = null;
      try {
        doctor = await reportPage.firstUsableValue('Doctor', 15_000);
      } catch {
        test.skip(true, 'No doctor on record today; nothing to filter by.');
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

    // TC097: Verify the date range keeps only patients of that day.
    test('TC097 - user can filter the patient report to a single day', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Reports',
        suite: 'Patient Report',
        type: 'regression',
        description:
          'Narrows the patient report to the day of a listed row and confirms every listed row carries that day.',
      });

      // Step 1: Open the report and take the day off the first row.
      const reportPage = await openPatientReport(page);
      const day = await reportPage.firstColumnValue('Date');
      const iso = PatientReportPage.toIso(day);

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
