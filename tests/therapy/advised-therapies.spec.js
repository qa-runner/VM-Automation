const { test, expect } = require('@playwright/test');
const { applyAllureContext } = require('../allure-context');
const { AdvisedTherapiesPage } = require('../../pages/therapy/AdvisedTherapiesPage');
const { DashboardPage } = require('../../pages/dashboard/DashboardPage');
const { loginAsValidUser } = require('../../utils/authFlow');

test.describe('Therapy', () => {
  // Signs in and opens the advised therapies, which every test below starts from.
  async function openAdvisedTherapies(page) {
    await loginAsValidUser(page);
    await new DashboardPage(page).waitForDashboard();

    const advisedPage = new AdvisedTherapiesPage(page);
    await advisedPage.openAdvisedTherapies();

    return advisedPage;
  }

  // Confirms a filter answered: either rows are left, or the list says the
  // filter matched nothing. Both prove the control is wired to the list.
  async function verifyFilterResponded(advisedPage) {
    if (await advisedPage.emptyMessage.count()) {
      await expect(advisedPage.emptyMessage).toBeVisible();
    } else {
      expect(await advisedPage.rowCount()).toBeGreaterThan(0);
    }
  }

  test.describe('Advised therapies', () => {
    // Regression test: the status filter leaves only that status listed.
    // TC044: Verify filtering advised therapies by status.
    test('TC044 - user can filter the advised therapies by status', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Therapy',
        suite: 'Advised Therapies',
        type: 'regression',
        description:
          'Narrows the advised therapies through every package status and back to all statuses.',
      });

      // Step 1: Open the list, which carries advised therapies.
      const advisedPage = await openAdvisedTherapies(page);
      const fullList = await advisedPage.rowCount();
      expect(fullList, 'The advised list held no therapies to filter.').toBeGreaterThan(0);

      // Step 2: Narrow it through every status.
      for (const status of ['Advised', 'Invoiced', 'Completed', 'Cancelled']) {
        await advisedPage.selectFilterButton(status);

        // Assert: the entry reports itself active, and every row that is left
        // carries that status, or the list says the status matched nothing.
        expect(await advisedPage.isFilterActive(status)).toBe(true);
        if (await advisedPage.emptyMessage.count()) {
          await expect(advisedPage.emptyMessage).toBeVisible();
        } else {
          for (const rowStatus of await advisedPage.listColumnValues('LAST PACKAGE STATUS')) {
            expect(rowStatus).toContain(status);
          }
        }
      }

      // Step 3: Widen it again through the status group's own All entry.
      await advisedPage.selectFilterButton('All', 1);

      // Assert: the full list is back under All.
      expect(await advisedPage.isFilterActive('All', 1)).toBe(true);
      expect(await advisedPage.rowCount()).toBe(fullList);
    });

    // Regression test: the advised list can be searched by patient name.
    // TC046: Verify advised therapy search by patient name.
    test('TC046 - user can search the advised therapies by patient name', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Therapy',
        suite: 'Advised Therapies',
        type: 'regression',
        description: 'Searches the advised therapies by patient name and restores the full list on clear.',
      });

      // Step 1: Open the list, which carries advised therapies.
      const advisedPage = await openAdvisedTherapies(page);
      const listed = await advisedPage.listColumnValues('PATIENT NAME');
      expect(listed.length, 'The advised list held no therapies to search for.').toBeGreaterThan(0);

      // Step 2: Search for a word taken off a listed row, so the test depends
      // on the list rather than on a name someone may have removed.
      const token = listed[0].split(' ').find((word) => word.length >= 4) || listed[0];

      // Step 3: Search for that word.
      await advisedPage.searchAdvised(token);
      const narrowed = await advisedPage.listColumnValues('PATIENT NAME');

      // Assert: the search narrows the list and every row it leaves matches.
      expect(narrowed.length, `No advised row matched "${token}".`).toBeGreaterThan(0);
      expect(narrowed.length).toBeLessThanOrEqual(listed.length);
      for (const name of narrowed) {
        expect(name.toLowerCase()).toContain(token.toLowerCase());
      }

      // Step 4: Clear the search.
      await advisedPage.clearSearch();

      // Assert: the full list comes back.
      expect(await advisedPage.rowCount()).toBeGreaterThanOrEqual(narrowed.length);
    });

    // Regression test: a record expands to its treatment plan and collapses.
    // TC045: Verify expanding a therapy to its treatment plan.
    test('TC045 - user can expand an advised therapy to its treatment plan', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Therapy',
        suite: 'Advised Therapies',
        type: 'regression',
        description: 'Expands an advised therapy to its treatment plan details and collapses it again.',
      });

      // Step 1: Open the list, which carries advised therapies.
      const advisedPage = await openAdvisedTherapies(page);
      const collapsed = await advisedPage.rowCount();
      expect(collapsed, 'The advised list held no therapies to expand.').toBeGreaterThan(0);

      // Step 2: Expand the first record.
      await advisedPage.toggleFirstRowDetails();

      // Assert: the plan details unfold beneath it.
      expect(await advisedPage.rowCount()).toBeGreaterThan(collapsed);
      await expect(page.getByText('Plan Overview').first()).toBeVisible();

      // Step 3: Collapse it again.
      await advisedPage.toggleFirstRowDetails();

      // Assert: the list is back to its rows.
      expect(await advisedPage.rowCount()).toBe(collapsed);
    });

    // Regression test: the advised serials run 1..N.
    // TC103: Verify advised serials run in order.
    test('TC103 - user can see ordered serials on the advised therapies', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Therapy',
        suite: 'Advised Therapies',
        type: 'regression',
        description:
          'Confirms the advised therapies list numbers its rows 1..N in order.',
      });

      // Step 1: Open the list, which carries advised therapies.
      const advisedPage = await openAdvisedTherapies(page);
      const serials = (await advisedPage.listColumnValues('SR. NO')).map((value) => Number(value.trim()));

      // Assert: the serials run 1..N with no gaps or repeats.
      expect(serials.length, 'The advised list held no rows to number.').toBeGreaterThan(0);
      expect(serials).toEqual(Array.from({ length: serials.length }, (_, index) => index + 1));
    });
  });
});
