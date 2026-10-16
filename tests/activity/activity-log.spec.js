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

  // A single searchable word off the first listed summary, so the test depends
  // on the log rather than on an entry someone may have rotated out.
  async function firstSummaryToken(activityPage) {
    const first = await activityPage.firstColumnValue('Summary');

    return first.split(/[^A-Za-z0-9]+/).find((word) => word.length >= 4) || first;
  }

  test.describe('Activity log', () => {
    // TC047: Verify the activity log opens with its columns.
    test('TC047 - user can open the user activity log and see its columns', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Activity',
        suite: 'Activity Log',
        type: 'regression',
        description:
          'Reaches the user activity log through the side menu and confirms its heading and table columns.',
      });

      // Step 1: Sign in and reach the log the way a user does.
      await loginAsValidUser(page);
      await new DashboardPage(page).waitForDashboard();
      await page.locator('a[href="/report/user-activity"]').first().click();

      // Assert: the log opens with its heading, subtitle and columns.
      const activityPage = new ActivityLogPage(page);
      await expect(activityPage.logHeading).toBeVisible({ timeout: 20_000 });
      await expect(activityPage.logSubtitle).toBeVisible();
      const headers = await activityPage.tableHeaders.allInnerTexts();
      expect(headers.length).toBe(7);
      for (const name of ['Date / Time', 'User', 'Action', 'Module', 'Summary', 'Changes']) {
        expect(headers.map((header) => header.replace(/\s+/g, ' ').trim())).toContain(name);
      }

      // Assert: the log lists entries.
      await activityPage.awaitEntries();
    });

    // TC048: Verify search narrows the activity log.
    test('TC048 - user can search the activity log and match every row', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Activity',
        suite: 'Activity Log',
        type: 'regression',
        description:
          'Searches the activity log for a word taken off a listed entry and confirms every row it leaves matches.',
      });

      // Step 1: Open the log and take a word off the first entry.
      const activityPage = await openActivityLog(page);
      const token = await firstSummaryToken(activityPage);

      // Step 2: Search for that word.
      await activityPage.searchLogs(token);
      await activityPage.awaitEntries();

      // Assert: every remaining row carries the word somewhere in its cells,
      // whatever column the search matched it through.
      const rows = activityPage.bodyRows;
      const count = await rows.count();
      for (let index = 0; index < count; index += 1) {
        const text = ((await rows.nth(index).innerText().catch(() => '')).replace(/\s+/g, ' ').trim());
        expect(text.toLowerCase()).toContain(token.toLowerCase());
      }
    });

    // TC049: Verify Reset restores the full log and clears every control.
    test('TC049 - user can reset the activity log filters and search', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Activity',
        suite: 'Activity Log',
        type: 'regression',
        description:
          'Searches the activity log, resets it, and confirms the entries return with every control cleared.',
      });

      // Step 1: Open the log and narrow it with a search.
      const activityPage = await openActivityLog(page);
      await activityPage.searchLogs(await firstSummaryToken(activityPage));

      // Step 2: Reset everything.
      await activityPage.resetFilters();

      // Assert: entries are back and every control reports its resting state.
      // The date range rests on its defaults, month start through today.
      const today = new Date();      const firstOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      const isoToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
        today.getDate(),
      ).padStart(2, '0')}`;
      await activityPage.awaitEntries();
      expect(await activityPage.searchBox.inputValue()).toBe('');
      expect(await activityPage.selectedFilter(0)).toBe('All modules');
      expect(await activityPage.selectedFilter(1)).toBe('All actions');
      expect(await activityPage.selectedFilter(2)).toBe('All entities');
      expect(await activityPage.fromInput.inputValue()).toBe(firstOfMonth);
      expect(await activityPage.toInput.inputValue()).toBe(isoToday);
    });

    // TC050: Verify a search with no match reports the empty log.
    test('TC050 - user can search the activity log past its last entry', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Activity',
        suite: 'Activity Log',
        type: 'regression',
        description:
          'Searches the activity log for text no entry can hold and confirms the empty state, then recovers it.',
      });

      // Step 1: Open the log and search for nonsense no entry holds.
      const activityPage = await openActivityLog(page);
      await activityPage.searchLogs('QXZZQ 9999 no such log');

      // Assert: the log says it holds nothing instead of showing stale rows.
      await expect(activityPage.emptyMessage).toBeVisible({ timeout: 15_000 });

      // Step 2: Recover through Reset.
      await activityPage.resetFilters();

      // Assert: the entries are back.
      await activityPage.awaitEntries();
    });

    // TC051: Verify paging walks the activity log and back.
    test('TC051 - user can page through the activity log and return', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Activity',
        suite: 'Activity Log',
        type: 'regression',
        description:
          'Pages the activity log forward and back and confirms each page shows its own entries.',
      });

      // Step 1: Open the log and note its first page.
      const activityPage = await openActivityLog(page);
      const firstPage = await activityPage.firstRowText();
      await activityPage.awaitSecondPage();

      // Step 2: Open the second page.
      await activityPage.gotoPage(2);

      // Assert: the second page shows different entries.
      const secondPage = await activityPage.firstRowText();
      expect(secondPage).not.toBe(firstPage);

      // Step 3: Return to the first page.
      await activityPage.gotoPage(1);

      // Assert: the first page is back.
      expect(await activityPage.firstRowText()).toBe(firstPage);
    });
  });
});
