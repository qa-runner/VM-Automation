const { test, expect } = require('@playwright/test');
const { applyAllureContext } = require('../allure-context');
const { ActivityLogPage } = require('../../pages/activity/ActivityLogPage');
const { DashboardPage } = require('../../pages/dashboard/DashboardPage');
const { loginAsValidUser } = require('../../utils/authFlow');

test.describe('Activity', () => {
  test.describe('Activity detail', () => {
    // TC056: Verify an entry opens its change detail and closes it.
    test('TC056 - user can open the change detail of a log entry', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Activity',
        suite: 'Activity Detail',
        type: 'regression',
        description:
          'Opens the change detail of a listed entry, confirms it names the entry with its actor and moment, and closes it.',
      });

      // Step 1: Open the log and note the first entry.
      await loginAsValidUser(page);
      await new DashboardPage(page).waitForDashboard();
      const activityPage = new ActivityLogPage(page);
      await activityPage.openActivityLog();
      const summary = await activityPage.firstColumnValue('Summary');
      const user = await activityPage.firstColumnValue('User');

      // Step 2: Open its change detail.
      await activityPage.openFirstDetail();

      // Assert: the dialog names the entry with its actor and moment, and the
      // change it recorded.
      const detail = activityPage.detailDialog;
      await expect(detail.getByText('Summary:')).toBeVisible();
      await expect(detail.getByText('User:')).toBeVisible();
      await expect(detail.getByText('When:')).toBeVisible();
      await expect(detail.getByText('Action:')).toBeVisible();
      expect(((await detail.innerText()).replace(/\s+/g, ' '))).toContain(summary);
      expect(((await detail.innerText()).replace(/\s+/g, ' '))).toContain(user);

      // Step 3: Close it.
      await activityPage.closeDetail();

      // Assert: the dialog closes and the log is untouched.
      await expect(activityPage.detailDialog).toHaveCount(0);
      await activityPage.awaitEntries();
    });
  });
});
