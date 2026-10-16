const { test, expect } = require('@playwright/test');
const { applyAllureContext } = require('../allure-context');
const { ActivityLogPage } = require('../../pages/activity/ActivityLogPage');
const { DashboardPage } = require('../../pages/dashboard/DashboardPage');
const { loginAsValidUser } = require('../../utils/authFlow');

test.describe('Activity', () => {
  // Signs in and opens the user activity log, which every test below starts from.
  async function openActivityLog(page) {
    await loginAsValidUser(page);
    await new DashboardPage(page).waitForDashboard();

    const activityPage = new ActivityLogPage(page);
    await activityPage.openActivityLog();

    return activityPage;
  }

  test.describe('Activity filters', () => {
    // TC052: Verify the module filter leaves only that module listed.
    test('TC052 - user can filter the activity log by module', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Activity',
        suite: 'Activity Filters',
        type: 'regression',
        description:
          'Filters the activity log to the module of a listed entry and confirms every row carries that module.',
      });

      // Step 1: Open the log and take the module off the first entry, so the
      // test depends on the log rather than on a module that may hold nothing.
      const activityPage = await openActivityLog(page);
      const module = await activityPage.firstColumnValue('Module');

      // Step 2: Filter to that module.
      await activityPage.selectModule(module);

      // Assert: the control reports the choice and every listed row carries it.
      expect(await activityPage.selectedFilter(0)).toBe(module);
      await activityPage.awaitEntries();
      for (const value of await activityPage.listColumnValues('Module')) {
        expect(value.trim()).toBe(module);
      }
    });

    // TC053: Verify the action filter leaves only that action listed.
    test('TC053 - user can filter the activity log by action', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Activity',
        suite: 'Activity Filters',
        type: 'regression',
        description:
          'Filters the activity log to the action of a listed entry and confirms every row carries that action.',
      });

      // Step 1: Open the log and take the action off the first entry.
      const activityPage = await openActivityLog(page);
      const action = await activityPage.firstColumnValue('Action');

      // Step 2: Filter to that action.
      await activityPage.selectAction(action);

      // Assert: the control reports the choice and every listed row carries it.
      expect(await activityPage.selectedFilter(1)).toBe(action);
      await activityPage.awaitEntries();
      for (const value of await activityPage.listColumnValues('Action')) {
        expect(value.trim()).toBe(action);
      }
    });

    // TC054: Verify the date range keeps only entries of those days.
    test('TC054 - user can filter the activity log to today', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Activity',
        suite: 'Activity Filters',
        type: 'regression',
        description:
          'Narrows the activity log to the current day and confirms every listed entry is stamped with it.',
      });

      // Step 1: Open the log and narrow it to today on both ends.
      const activityPage = await openActivityLog(page);
      const today = new Date();
      const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
        today.getDate(),
      ).padStart(2, '0')}`;
      const stamped = `${String(today.getDate()).padStart(2, '0')}/${String(
        today.getMonth() + 1,
      ).padStart(2, '0')}/${today.getFullYear()}`;
      await activityPage.selectDateRange(iso, iso);

      // Assert: entries remain and every one is stamped with today.
      await activityPage.awaitEntries();
      for (const value of await activityPage.listColumnValues('Date / Time')) {
        expect(value.trim().startsWith(stamped), `Entry stamped outside today: ${value.trim()}`).toBe(true);
      }
    });

    // TC055: Verify module and action filters combine.
    test('TC055 - user can combine the module and action filters', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Activity',
        suite: 'Activity Filters',
        type: 'regression',
        description:
          'Filters the activity log by a listed module and action together and confirms every row honours both.',
      });

      // Step 1: Open the log and take both values off the first entry, which
      // guarantees the combination matches at least that entry.
      const activityPage = await openActivityLog(page);
      const module = await activityPage.firstColumnValue('Module');
      const action = await activityPage.firstColumnValue('Action');

      // Step 2: Filter to that module and that action together.
      await activityPage.selectModule(module);
      await activityPage.selectAction(action);

      // Assert: every listed row honours both filters.
      await activityPage.awaitEntries();
      for (const value of await activityPage.listColumnValues('Module')) {
        expect(value.trim()).toBe(module);
      }
      for (const value of await activityPage.listColumnValues('Action')) {
        expect(value.trim()).toBe(action);
      }
    });
  });
});
