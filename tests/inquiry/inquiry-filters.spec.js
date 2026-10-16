const { test, expect } = require('@playwright/test');
const { applyAllureContext } = require('../allure-context');
const { InquiryPage } = require('../../pages/inquiry/InquiryPage');
const { DashboardPage } = require('../../pages/dashboard/DashboardPage');
const { loginAsValidUser } = require('../../utils/authFlow');

// Every status a listed inquiry can carry. Each one is filtered in turn.
const ALL_STATUSES = [
  'New',
  'In Progress',
  'Interested',
  'Not Responding',
  'Not Interested',
  'Converted',
  'Dead',
  'Visited',
  'Appointment Booked',
];

// Every source an inquiry can be created from. Each one is filtered in turn.
const ALL_SOURCES = ['Telephonic', 'Direct Walk-in', 'Email', 'WhatsApp'];

test.describe('Inquiry', () => {
  test.describe('Inquiry status filter', () => {
    // Regression test: each status in the dropdown filters the list down to that status.
    // TC032: Verify filtering inquiries by every status.
    test('TC032 - user can filter inquiries by each status', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Inquiry',
        suite: 'Status Filter',
        type: 'regression',
        description: 'Confirms the status filter dropdown filters inquiries by each available status.',
      });

      // Step 1: Open the dashboard, then the inquiry page.
      await loginAsValidUser(page);
      await new DashboardPage(page).waitForDashboard();
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
      const inquiryPage = new InquiryPage(page);
      await inquiryPage.openFromDashboard();

      // Step 2: Apply every status one by one.
      for (const status of ALL_STATUSES) {
        await inquiryPage.selectStatus(status);

        // Assert: every row that is left carries the status that was selected.
        await inquiryPage.verifyAllRowsHaveStatus(status);
      }
    });
  });

  test.describe('Inquiry priority filter', () => {
    // Regression test: each priority in the dropdown filters the list down to that
    // priority, and together the three levels cover the whole list.
    // TC033: Verify filtering inquiries by every priority.
    test('TC033 - user can filter inquiries by each priority', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Inquiry',
        suite: 'Priority Filter',
        type: 'regression',
        description:
          'Confirms the priority filter dropdown filters inquiries by each available priority and the three levels add up to the full list.',
      });

      // Step 1: Open the dashboard, then the inquiry page.
      await loginAsValidUser(page);
      await new DashboardPage(page).waitForDashboard();
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
      const inquiryPage = new InquiryPage(page);
      await inquiryPage.openFromDashboard();

      // Step 2: Note the unfiltered total the levels have to add up to.
      const unfilteredTotal = await inquiryPage.getTotalInquiryCount();

      // Step 3: Apply every priority one by one.
      // The list shows no priority per row, so the totals are what prove each
      // filter did anything, and their sum proves every inquiry carries exactly
      // one priority rather than some falling through the cracks.
      const totals = {};
      for (const priority of ['High', 'Medium', 'Low']) {
        await inquiryPage.selectPriority(priority);

        // Assert: the filter reports the chosen priority.
        expect(await inquiryPage.getSelectedPriority()).toBe(priority);

        totals[priority] = await inquiryPage.getTotalInquiryCount();
      }

      // Assert: the three levels partition the whole list.
      expect(totals.High + totals.Medium + totals.Low).toBe(unfilteredTotal);
    });
  });

  test.describe('Inquiry source filter', () => {
    // Regression test: each source in the dropdown filters the list down to that source.
    // TC034: Verify filtering inquiries by every source.
    test('TC034 - user can filter inquiries by each source', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Inquiry',
        suite: 'Source Filter',
        type: 'regression',
        description: 'Confirms the source filter dropdown filters inquiries by each available source.',
      });

      // Step 1: Open the dashboard, then the inquiry page.
      await loginAsValidUser(page);
      await new DashboardPage(page).waitForDashboard();
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
      const inquiryPage = new InquiryPage(page);
      await inquiryPage.openFromDashboard();

      // Step 2: Apply every source one by one.
      for (const source of ALL_SOURCES) {
        await inquiryPage.selectSource(source);

        // Assert: every row that is left carries the source that was selected.
        await inquiryPage.verifyAllRowsHaveSource(source);
      }
    });
  });
});
