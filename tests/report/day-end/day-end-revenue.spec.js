const { test, expect } = require('@playwright/test');
const { applyAllureContext } = require('../../allure-context');
const { DayEndReportPage, parseAmount } = require('../../../pages/report/DayEndReportPage');
const { DashboardPage } = require('../../../pages/dashboard/DashboardPage');
const { loginAsValidUser } = require('../../../utils/authFlow');

// The first day of the current month and today, both as ISO input days.
function monthStartIso() {
  const today = new Date();

  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
}

function todayIso() {
  const today = new Date();

  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
    today.getDate(),
  ).padStart(2, '0')}`;
}

test.describe('Reports', () => {
  // Signs in and opens the day end report, which every test below starts from.
  async function openDayEndReport(page) {
    await loginAsValidUser(page);
    await new DashboardPage(page).waitForDashboard();

    const reportPage = new DayEndReportPage(page);
    await reportPage.openDayEndReport();

    return reportPage;
  }

  // Widens the report to month start through today, where settled records live.
  async function openWideRange(page) {
    const reportPage = await openDayEndReport(page);
    await reportPage.applyDateRange(monthStartIso(), todayIso());

    return reportPage;
  }

  // Every category row of one money table adds into its footer Total row.
  async function expectMoneyTableAddsUp(reportPage, tableIndex, tableName) {
    const rows = await reportPage.readTableRows(tableIndex);
    expect(rows.length, `The ${tableName} table held no rows to add up.`).toBeGreaterThan(0);

    let sum = 0;
    for (const cells of rows) {
      expect(cells[0], `The ${tableName} table names no category.`).toBeTruthy();
      const amount = parseAmount(cells[cells.length - 1]);
      expect(Number.isFinite(amount), `No amount beside ${cells[0]} in the ${tableName} table.`).toBe(true);
      sum += amount;
    }

    const foot = await reportPage.readTableFoot(tableIndex);
    expect(foot[0]).toBe('Total');
    expect(foot.length, `The ${tableName} footer carries no amount.`).toBeGreaterThan(1);
    expect(sum).toBe(parseAmount(foot[foot.length - 1]));
  }

  test.describe('Day end revenue', () => {
    // TC070: Verify the revenue summary adds up.
    test('TC070 - user can see a revenue summary that adds up', async ({ page     }) => {
      // The month query can run long on a loaded backend.
      test.setTimeout(300_000);
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Reports',
        suite: 'Day End Report',
        type: 'regression',
        description:
          'Widens the day end report to the month so far and confirms every revenue category adds into the revenue total.',
      });

      // Step 1: Open the report widened to month start through today.
      const reportPage = await openWideRange(page);

      // Assert: the categories add into the total.
      await expectMoneyTableAddsUp(reportPage, 1, 'revenue');
    });

    // TC071: Verify the unsettled amount adds up.
    test('TC071 - user can see an unsettled amount that adds up', async ({ page     }) => {
      // The month query can run long on a loaded backend.
      test.setTimeout(300_000);
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Reports',
        suite: 'Day End Report',
        type: 'regression',
        description:
          'Widens the day end report to the month so far and confirms every unsettled category adds into the unsettled total.',
      });

      // Step 1: Open the report widened to month start through today.
      const reportPage = await openWideRange(page);

      // Assert: the categories add into the total.
      await expectMoneyTableAddsUp(reportPage, 2, 'unsettled');
    });

    // TC072: Verify a range with no data reports it and resets clean.
    test('TC072 - user can ask the day end report about a range with no data', async ({ page     }) => {
      // The month query can run long on a loaded backend.
      test.setTimeout(300_000);
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Reports',
        suite: 'Day End Report',
        type: 'regression',
        description:
          'Asks the day end report about a future range, confirms it reports no data with a retry, and resets to today.',
      });

      // Step 1: Open the report and ask about a range no records can hold.
      const reportPage = await openDayEndReport(page);
      await reportPage.applyDateRange('2027-01-01', '2027-01-31');

      // Assert: the report says it holds nothing, with a retry on offer.
      await expect(reportPage.emptySummary).toBeVisible({ timeout: 20_000 });
      await expect(reportPage.emptyRangeMessage).toBeVisible();
      await expect(reportPage.refreshButton).toBeVisible();

      // Step 2: Retry through Refresh.
      await reportPage.refreshButton.click();

      // Assert: the report still reports no data instead of failing elsewhere.
      await expect(reportPage.emptyRangeMessage).toBeVisible({ timeout: 20_000 });

      // Step 3: Reset everything.
      await reportPage.resetReport();

      // Assert: the report is back on today on both dates with its sections.
      expect(await reportPage.startInput.inputValue()).toBe(todayIso());
      expect(await reportPage.endInput.inputValue()).toBe(todayIso());
      await reportPage.awaitSections();
    });
  });
});
