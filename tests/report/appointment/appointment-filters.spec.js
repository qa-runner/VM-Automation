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

  test.describe('Appointment report filters', () => {
    // TC061: Verify the type filter leaves only that type listed.
    test('TC061 - user can filter the appointment report by type', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Reports',
        suite: 'Appointment Report',
        type: 'regression',
        description:
          'Filters the appointment report to the type of a listed row and confirms every row carries that type.',
      });

      // Step 1: Open the report and take the type off the first row, so the
      // test depends on the report rather than on a type that may hold nothing.
      const reportPage = await openAppointmentReport(page);
      const type = await reportPage.firstColumnValue('Type');

      // Step 2: Pick that type and apply it. Picking alone never filters.
      await reportPage.setType(type);
      await reportPage.applyFilters();

      // Assert: the control reports the choice and every listed row carries it.
      expect(await reportPage.selectedFilter(0)).toBe(type);
      await reportPage.awaitEntries();
      for (const value of await reportPage.awaitColumnValues('Type')) {
        expect(value.trim()).toBe(type);
      }
    });

    // TC062: Verify the status filter leaves only that status listed.
    test('TC062 - user can filter the appointment report by status', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Reports',
        suite: 'Appointment Report',
        type: 'regression',
        description:
          'Filters the appointment report to the status of a listed row and confirms every row carries that status.',
      });

      // Step 1: Open the report and take the status off the first row.
      const reportPage = await openAppointmentReport(page);
      const status = await reportPage.firstColumnValue('Status');

      // Step 2: Pick that status and apply it.
      await reportPage.setStatus(status);
      await reportPage.applyFilters();

      // Assert: the control reports the choice and every listed row carries it.
      expect(await reportPage.selectedFilter(1)).toBe(status);
      await reportPage.awaitEntries();
      for (const value of await reportPage.awaitColumnValues('Status')) {
        expect(value.trim()).toBe(status);
      }
    });

    // TC063: Verify the date range keeps only entries of that day.
    test('TC063 - user can filter the appointment report to a single day', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Reports',
        suite: 'Appointment Report',
        type: 'regression',
        description:
          'Narrows the appointment report to the day of a listed row and confirms every listed entry carries that day.',
      });

      // Step 1: Open the report and take the day off the first row.
      const reportPage = await openAppointmentReport(page);
      const day = await reportPage.firstColumnValue('Date');
      const iso = AppointmentReportPage.toIso(day);

      // Step 2: Narrow both ends to that day and apply it.
      await reportPage.fillDateRange(iso, iso);
      await reportPage.applyFilters();

      // Assert: entries remain and every one carries that day.
      await reportPage.awaitEntries();
      for (const value of await reportPage.awaitColumnValues('Date')) {
        expect(value.trim()).toBe(day);
      }
    });

    // TC064: Verify type and status filters combine.
    test('TC064 - user can combine the type and status filters', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Reports',
        suite: 'Appointment Report',
        type: 'regression',
        description:
          'Filters the appointment report by a listed type and status together and confirms every row honours both.',
      });

      // Step 1: Open the report and take both values off the first row, which
      // guarantees the combination matches at least that row.
      const reportPage = await openAppointmentReport(page);
      const type = await reportPage.firstColumnValue('Type');
      const status = await reportPage.firstColumnValue('Status');

      // Step 2: Pick both and apply them together.
      await reportPage.setType(type);
      await reportPage.setStatus(status);
      await reportPage.applyFilters();

      // Assert: every listed row honours both filters.
      await reportPage.awaitEntries();
      for (const value of await reportPage.awaitColumnValues('Type')) {
        expect(value.trim()).toBe(type);
      }
      for (const value of await reportPage.awaitColumnValues('Status')) {
        expect(value.trim()).toBe(status);
      }
    });
  });
});
