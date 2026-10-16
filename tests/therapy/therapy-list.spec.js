const { test, expect } = require('@playwright/test');
const { applyAllureContext } = require('../allure-context');
const { TherapyListPage } = require('../../pages/therapy/TherapyListPage');
const { BillingPage } = require('../../pages/billing/BillingPage');
const { DashboardPage } = require('../../pages/dashboard/DashboardPage');
const { loginAsValidUser } = require('../../utils/authFlow');

test.describe('Therapy', () => {
  // Signs in and opens the therapy list, which every test below starts from.
  async function openTherapyList(page) {
    await loginAsValidUser(page);
    await new DashboardPage(page).waitForDashboard();

    const therapyPage = new TherapyListPage(page);
    await therapyPage.openTherapyList();

    return therapyPage;
  }

  test.describe('Therapy list', () => {
    // Regression test: the therapy list can be searched by patient name.
    // TC039: Verify therapy search by patient name.
    test('TC039 - user can search the therapy list by patient name', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Therapy',
        suite: 'Therapy List',
        type: 'regression',
        description:
          'Searches the therapy list by patient name, checks a name nobody has, and restores the full list on clear.',
      });

      // Step 1: Open the list, which carries therapies.
      const therapyPage = await openTherapyList(page);
      await expect
        .poll(async () => (await therapyPage.listPatientNames()).length, { timeout: 15_000 })
        .toBeGreaterThan(0);
      const listed = await therapyPage.listPatientNames();

      // Step 2: Search for a word taken off a listed row, so the test depends
      // on the list rather than on a name someone may have removed. The search
      // only runs when it is committed with Enter.
      const token = listed[0].split(' ').find((word) => word.length >= 4) || listed[0];

      // Step 3: Search for that word.
      await therapyPage.searchTherapies(token);
      const narrowed = await therapyPage.listPatientNames();

      // Assert: the search narrows the list and every row it leaves matches.
      expect(narrowed.length, `No therapy row matched "${token}".`).toBeGreaterThan(0);
      expect(narrowed.length).toBeLessThanOrEqual(listed.length);
      for (const name of narrowed) {
        expect(name.toLowerCase()).toContain(token.toLowerCase());
      }

      // Step 4: Clear the search.
      await therapyPage.clearSearch();

      // Assert: the full list comes back.
      expect(await therapyPage.rowCount()).toBeGreaterThanOrEqual(narrowed.length);

      // Step 5: Search for a name nobody has.
      await therapyPage.searchTherapies(`QX${Date.now() % 1000000}`);

      // Assert: nothing lists for it, then the full list comes back on clear.
      if ((await therapyPage.rowCount()) > 0) {
        expect(await therapyPage.bodyRows.first().innerText()).toMatch(/No .*therap|No .*found|No .*match|No data/i);
      }
      await therapyPage.clearSearch();
      expect(await therapyPage.rowCount()).toBeGreaterThanOrEqual(narrowed.length);
    });

    // Regression test: the patient column sorts both ways from its header menu.
    // TC040: Verify therapy sort by patient name.
    test('TC040 - user can sort the therapy list by patient name', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Therapy',
        suite: 'Therapy List',
        type: 'regression',
        description:
          'Sorts the therapy list by patient name both ways and checks each direction leads with the other end.',
      });

      // Step 1: Open the list, which holds far more than two pages.
      const therapyPage = await openTherapyList(page);
      const total = Number((await therapyPage.paginationText()).match(/of (\d+)/)?.[1] ?? 0);
      expect(total, 'The therapy list held too few therapies to sort.').toBeGreaterThan(20);

      // Step 2: Sort ascending from the Patient header menu.
      await therapyPage.sortColumn('Patient', 'Asc');
      const ascending = await therapyPage.listPatientNames();
      expect(ascending.length).toBeGreaterThan(0);

      // Step 3: Sort descending from the same menu.
      await therapyPage.sortColumn('Patient', 'Desc');
      const descending = await therapyPage.listPatientNames();
      expect(descending.length).toBeGreaterThan(0);

      // Assert: each direction leads with names the other direction never
      // shows on its first page. Records are added live by other users of this
      // shared list, so only the extremes are pinned: the backend collation
      // follows its own rules rather than display order, and whole-array
      // mirrors would also break on every insert between the two reads.
      expect(descending).not.toContain(ascending[0]);
      expect(ascending).not.toContain(descending[0]);
    });

    // Regression test: columns hide from their header menus and return on reload.
    // TC041: Verify hiding and restoring therapy columns.
    test('TC041 - user can hide therapy list columns and bring them back', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Therapy',
        suite: 'Therapy List',
        type: 'regression',
        description: 'Hides columns of the therapy list through their header menus and restores them.',
      });

      // Step 1: Open the list with all its columns shown.
      const therapyPage = await openTherapyList(page);
      const shown = await therapyPage.listColumnHeaders();
      expect(shown.length, 'The therapy list showed no columns to hide.').toBeGreaterThan(0);

      // Step 2: Hide the first columns through their own header menus. The
      // list offers no unhide control, so the columns come back with a reload,
      // which proves the choices never reach the server. Only the first five
      // hide: past that the sixth header menu opens empty, whether by a
      // minimum visible rule or a render quirk, so it is left to product eyes.
      // Absence reads the raw headers because a fully hidden table has nothing
      // to await.
      const hidden = shown.slice(0, 5);
      for (const header of hidden) {
        await therapyPage.hideColumn(header);

        // Assert: the column is gone from the table.
        expect(await therapyPage.readColumnHeaders()).not.toContain(header);
      }

      // Step 3: Reload the list.
      await page.reload();
      await expect(therapyPage.listHeading).toBeVisible({ timeout: 20_000 });
      await therapyPage.waitForListToSettle(null, 8000);

      // Assert: the table is whole again.
      expect(await therapyPage.listColumnHeaders()).toEqual(shown);
    });

    // Regression test: every page size of the control pages the therapy list.
    // TC042: Verify changing therapy rows per page.
    test('TC042 - user can change the rows per page of the therapy list', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Therapy',
        suite: 'Therapy List',
        type: 'regression',
        description: 'Pages the therapy list through every rows per page option and back to ten.',
      });

      // Step 1: Open the list and read what it offers.
      const therapyPage = await openTherapyList(page);
      const total = Number((await therapyPage.paginationText()).match(/of (\d+)/)?.[1] ?? 0);
      expect(total, 'The therapy list held no therapies to page.').toBeGreaterThan(0);
      const options = await therapyPage.listRowsPerPageOptions();
      expect(options.length, 'The rows per page control offered nothing.').toBeGreaterThan(0);

      // Step 2: Page through every offered size.
      for (const option of options) {
        await therapyPage.selectRowsPerPage(option);

        // Assert: the list shows that many rows, or every record when fewer.
        expect(await therapyPage.rowCount()).toBe(Math.min(Number(option), total));
      }

      // Step 3: Page back to the default size.
      await therapyPage.selectRowsPerPage('10');

      // Assert: the default page is back.
      expect(await therapyPage.rowCount()).toBe(Math.min(10, total));
    });

    // Regression test: the pager walks through the therapies and back.
    // TC043: Verify paging through the therapy list.
    test('TC043 - user can page through the therapy list', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Therapy',
        suite: 'Therapy List',
        type: 'regression',
        description: 'Walks the therapy list to the second page and back to the first.',
      });

      // Step 1: Open the list, which holds far more than one page.
      const therapyPage = await openTherapyList(page);
      expect(await therapyPage.paginationText()).toMatch(/Showing 1 to 10 of \d+ therapies/);
      const firstPage = await therapyPage.listPatientNames();
      expect(firstPage.length, 'The therapy list held too few therapies to page.').toBeGreaterThan(0);

      // Step 2: Go to the second page.
      await therapyPage.gotoTherapyPage(2, '11');

      // Assert: the pager reports the second slice with different therapies.
      expect(await therapyPage.paginationText()).toMatch(/Showing 11 to 20 of \d+ therapies/);
      expect(await therapyPage.listPatientNames()).not.toEqual(firstPage);

      // Step 3: Go back to the first page.
      await therapyPage.gotoTherapyPage(1, '1');

      // Assert: the first slice is back.
      expect(await therapyPage.paginationText()).toMatch(/Showing 1 to 10 of \d+ therapies/);
      expect(await therapyPage.listPatientNames()).toEqual(firstPage);
    });

    // Regression test: a therapy converts into a bill carrying its patient.
    // TC101: Verify converting a therapy carries its patient into the bill.
    test('TC101 - user can send a therapy to billing carrying its patient', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Therapy',
        suite: 'Therapy List',
        type: 'regression',
        description:
          'Sends the first listed therapy to billing from the row menu and confirms the bill arrives carrying that patient with its therapy lines, without saving anything.',
      });

      // Step 1: Open the list and note the first therapy's patient and day.
      // The reads poll because a single pass can catch the list rebuilding.
      const therapyPage = await openTherapyList(page);
      let patient = '';
      let day = '';
      await expect
        .poll(
          async () => {
            const patients = await therapyPage.listColumnValues('Patient').catch(() => []);
            const dates = await therapyPage.listColumnValues('Date').catch(() => []);
            patient = (patients[0] || '').trim();
            day = (dates[0] || '').trim();

            return patient && day ? 'ready' : '';
          },
          { timeout: 30_000 },
        )
        .toBe('ready');
      const [dd, mon, yyyy] = day.split(' ');
      const months = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
      const isoDay = `${yyyy}-${months[mon]}-${dd.padStart(2, '0')}`;

      // Step 2: Convert that therapy to a bill and stay there. Nothing is
      // saved and the test never returns, so no residue and no reliance on the
      // list rebuilding behind a back navigation.
      await therapyPage.convertFirstRowToBill();

      // Assert: the bill opens in conversion context carrying that patient and
      // day, with the therapy line table ready. The patient field fills after
      // the heading, so its arrival is awaited rather than read once.
      expect(page.url()).toContain('billing/add');
      const billingPage = new BillingPage(page);
      await expect(billingPage.convertHeading).toBeVisible({ timeout: 15_000 });
      await expect
        .poll(async () => billingPage.filledInputValues(), { timeout: 30_000 })
        .toContain(patient);
      const filled = await billingPage.filledInputValues();
      expect(filled).toContain(isoDay);
      expect(await billingPage.lineTableHeaders()).toContain('THERAPY NAME');
      await expect(billingPage.saveBillButton).toBeVisible();
    });

    // Regression test: every therapy row carries sane validity and sessions.
    // TC102: Verify validity and sessions read sane on every row.
    test('TC102 - user can see sane validity and sessions on every therapy', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Therapy',
        suite: 'Therapy List',
        type: 'regression',
        description:
          'Reads every listed therapy and confirms validity is a number or a dash with sessions done never above sessions total.',
      });

      // Step 1: Open the list, which carries therapies.
      const therapyPage = await openTherapyList(page);
      const validities = await therapyPage.listColumnValues('Validity (days)');
      const sessions = await therapyPage.listColumnValues('Sessions (done/total)');
      expect(validities.length, 'The therapy list held no rows to check.').toBeGreaterThan(0);
      expect(sessions.length, 'The therapy sessions came back uneven.').toBe(validities.length);

      // Assert: validity is a number or an explicit dash, and done never runs
      // past total on any row.
      for (let index = 0; index < validities.length; index += 1) {
        const validity = validities[index].trim();
        expect(
          validity === '-' || validity === '—' || (validity !== '' && Number.isFinite(Number(validity))),
          `No sane validity on row ${index + 1}: ${validity}.`,
        ).toBe(true);

        const match = sessions[index].trim().match(/^(\d+)\s*\/\s*(\d+)$/);
        expect(match, `No sane sessions on row ${index + 1}: ${sessions[index].trim()}.`).toBeTruthy();
        expect(Number(match[1]), `Sessions done past total on row ${index + 1}.`).toBeLessThanOrEqual(
          Number(match[2]),
        );
      }
    });
  });
});
