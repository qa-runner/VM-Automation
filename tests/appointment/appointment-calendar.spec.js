const { test, expect } = require('@playwright/test');
const { applyAllureContext } = require('../allure-context');
const { AppointmentCalendarPage } = require('../../pages/appointment/AppointmentCalendarPage');
const { DashboardPage } = require('../../pages/dashboard/DashboardPage');
const { loginAsValidUser } = require('../../utils/authFlow');

test.describe('Appointment', () => {
  // Signs in and opens the appointment calendar, which every test below starts from.
  async function openCalendar(page) {
    await loginAsValidUser(page);
    await new DashboardPage(page).waitForDashboard();

    const calendarPage = new AppointmentCalendarPage(page);
    await calendarPage.openAppointmentModule();

    return calendarPage;
  }

  test.describe('Appointment calendar', () => {
    // Regression test: the booking form refuses an empty submit.
    // TC038: Verify booking refuses an empty patient name.
    test('TC038 - user cannot book an appointment without a patient name', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Appointment',
        suite: 'Calendar',
        type: 'regression',
        description:
          'Submits the appointment booking form empty and confirms the required field message holds the form open.',
      });

      // Step 1: Open the calendar and the booking form.
      const calendarPage = await openCalendar(page);
      await calendarPage.openAddAppointment();

      // Step 2: Submit with everything empty.
      await calendarPage.submitAddAppointment();

      // Assert: the patient name message shows and the form stays open instead
      // of booking anything.
      expect(await calendarPage.listBookingErrors()).toContain('Patient name is required');
      await expect(page.getByRole('heading', { name: 'Add Appointment' })).toBeVisible();

      // Step 3: Close it without saving.
      await calendarPage.closeAddAppointment();

      // Assert: the form closes and nothing was booked.
      await expect(page.getByRole('dialog')).toHaveCount(0);
    });
  });
});
