const { test, expect } = require('@playwright/test');
const { applyAllureContext } = require('../../allure-context');
const { DayEndReportPage } = require('../../../pages/report/DayEndReportPage');
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

  test.describe('Day end report', () => {
    // TC065: Verify the report opens with its sections on today's defaults.
    test('TC065 - user can open the day end report on its default day', async ({ page     }) => {
      // The month query can run long on a loaded backend.
      test.setTimeout(300_000);
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Reports',
        suite: 'Day End Report',
        type: 'regression',
        description:
          'Reaches the day end report through the side menu and confirms its sections with today on both dates.',
      });

      // Step 1: Sign in and reach the report the way a user does. It lives in
      // the collapsed Report group, so the group opens first.
      await loginAsValidUser(page);
      await new DashboardPage(page).waitForDashboard();
      await page.getByText('Report', { exact: true }).first().click();
      const reportLink = page.locator('a[href="/report/day-end"]');
      await expect(reportLink).toBeVisible({ timeout: 15_000 });
      await reportLink.click();

      // Assert: the report opens on today on both dates with every section.
      const reportPage = new DayEndReportPage(page);
      await expect(reportPage.reportHeading).toBeVisible({ timeout: 20_000 });
      await reportPage.awaitSections();
      expect(await reportPage.startInput.inputValue()).toBe(todayIso());
      expect(await reportPage.endInput.inputValue()).toBe(todayIso());
      for (const name of [
        'New Registration Footfall',
        'OPD Footfall (Visits)',
        'Revenue Summary',
        'Unsettled Amount',
        'No. of Consultations',
        'Therapy Done',
      ]) {
        await expect(reportPage.sectionHeading(name)).toBeVisible();
      }
    });

    // TC066: Verify the registration footfall adds up.
    test('TC066 - user can see a registration footfall that adds up', async ({ page     }) => {
      // The month query can run long on a loaded backend.
      test.setTimeout(300_000);
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Reports',
        suite: 'Day End Report',
        type: 'regression',
        description:
          'Widens the day end report to the month so far and confirms male plus female equals the registration total.',
      });

      // Step 1: Open the report widened to month start through today.
      const reportPage = await openWideRange(page);

      // Assert: the footfall total is the sum of its parts.
      const footfall = await reportPage.readRegistration();
      expect(footfall.total).toBe(footfall.male + footfall.female);
    });

    // TC067: Verify the OPD footfall adds up.
    test('TC067 - user can see an OPD footfall that adds up', async ({ page     }) => {
      // The month query can run long on a loaded backend.
      test.setTimeout(300_000);
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Reports',
        suite: 'Day End Report',
        type: 'regression',
        description:
          'Widens the day end report to the month so far and confirms every OPD row adds up into the total OPDs.',
      });

      // Step 1: Open the report widened to month start through today.
      const reportPage = await openWideRange(page);

      // Assert: each row adds across, and the footer gathers both rows.
      const rows = await reportPage.readTableRows(0);
      const byType = Object.fromEntries(rows.map((cells) => [cells[0], cells.slice(1)]));
      expect(byType.New, 'The OPD footfall held no New row.').toBeTruthy();
      expect(byType.Old, 'The OPD footfall held no Old row.').toBeTruthy();
      for (const type of ['New', 'Old']) {
        const [male, female, total] = byType[type].map(Number);
        expect(total).toBe(male + female);
      }
      const foot = await reportPage.readTableFoot(0);
      expect(foot[0]).toBe('Total OPDs');
      expect(Number(foot[foot.length - 1])).toBe(Number(byType.New[2]) + Number(byType.Old[2]));
    });

    // TC068: Verify the consultations list names counters.
    test('TC068 - user can see who the consultations belong to', async ({ page     }) => {
      // The month query can run long on a loaded backend.
      test.setTimeout(300_000);
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Reports',
        suite: 'Day End Report',
        type: 'regression',
        description:
          'Widens the day end report to the month so far and confirms the consultations list pairs every doctor with a count.',
      });

      // Step 1: Open the report widened to month start through today.
      const reportPage = await openWideRange(page);
      const lines = await reportPage.readSectionLines('No. of Consultations', 'Therapy Done');

      // Assert: either nobody consulted, said plainly, or every doctor carries
      // a numeric count beside their name.
      if (lines.includes('No consultations found.')) {
        expect(lines).toEqual(['No consultations found.']);
      } else {
        expect(lines.length, 'The consultations list paired nobody with nothing.').toBeGreaterThan(0);
        expect(lines.length % 2, 'The consultations list left a doctor without a count.').toBe(0);
        for (let index = 0; index < lines.length; index += 2) {
          expect(lines[index], 'The consultations list named nobody.').toBeTruthy();
          expect(Number(lines[index + 1]), `No valid count beside ${lines[index]}.`).toBeGreaterThanOrEqual(0);
        }
      }
    });

    // TC069: Verify the therapies list names counters.
    test('TC069 - user can see what the therapies done list holds', async ({ page     }) => {
      // The month query can run long on a loaded backend.
      test.setTimeout(300_000);
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Reports',
        suite: 'Day End Report',
        type: 'regression',
        description:
          'Widens the day end report to the month so far and confirms the therapies list is either empty, said plainly, or paired counts.',
      });

      // Step 1: Open the report widened to month start through today.
      const reportPage = await openWideRange(page);
      const lines = await reportPage.readSectionLines('Therapy Done', '2026 ©');

      // Assert: either no therapy is done, said plainly, or every therapy
      // carries a numeric count beside its name.
      if (lines.includes('No therapies found.')) {
        expect(lines).toEqual(['No therapies found.']);
      } else {
        expect(lines.length, 'The therapies list paired nothing with nothing.').toBeGreaterThan(0);
        expect(lines.length % 2, 'The therapies list left a therapy without a count.').toBe(0);
        for (let index = 0; index < lines.length; index += 2) {
          expect(lines[index], 'The therapies list named nothing.').toBeTruthy();
          expect(Number(lines[index + 1]), `No valid count beside ${lines[index]}.`).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });
});
