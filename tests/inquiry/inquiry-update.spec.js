const { test, expect } = require('@playwright/test');
const { applyAllureContext } = require('../allure-context');
const { InquiryPage } = require('../../pages/inquiry/InquiryPage');
const { DashboardPage } = require('../../pages/dashboard/DashboardPage');
const { loginAsValidUser } = require('../../utils/authFlow');
const { randomDigits } = require('../../utils/random');

test.describe('Inquiry', () => {
  // Signs in and opens the inquiry page, which every test below starts from.
  async function openInquiryList(page) {
    await loginAsValidUser(page);
    await new DashboardPage(page).waitForDashboard();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    const inquiryPage = new InquiryPage(page);
    await inquiryPage.openFromDashboard();

    // Rows render after the page shell, so data is awaited before any row is
    // read. Without this the empty state reads as a patient name.
    await expect
      .poll(async () => (await listInquiryNames(inquiryPage)).length, { timeout: 20_000 })
      .toBeGreaterThan(0);

    return inquiryPage;
  }

  // Reads the listed inquiry names off the current page of results, skipping
  // the empty state row.
  async function listInquiryNames(inquiryPage) {
    const rows = inquiryPage.inquiryBodyRows;
    const count = await rows.count();
    const names = [];

    for (let index = 0; index < count; index += 1) {
      const cell = await rows.nth(index).locator('td').first().innerText().catch(() => '');

      if (cell.trim() && !/No inquiries found/i.test(cell)) {
        names.push(cell.replace(/\s+/g, ' ').trim());
      }
    }

    return names;
  }

  test.describe('Inquiry pagination', () => {
    // Regression test: the pager walks through the inquiries and back.
    // TC036: Verify paging through the inquiry list.
    test('TC036 - user can page through the inquiry list', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Inquiry',
        suite: 'Pagination',
        type: 'regression',
        description: 'Walks the inquiry list to the second page and back to the first.',
      });

      // Step 1: Open the list, which holds far more than one page.
      const inquiryPage = await openInquiryList(page);
      expect(await inquiryPage.getTotalInquiryCount()).toBeGreaterThan(10);
      const firstPage = await listInquiryNames(inquiryPage);
      expect(firstPage.length).toBeGreaterThan(0);

      // Step 2: Go to the second page.
      await inquiryPage.gotoInquiryPage(2, '11');

      // Assert: the second slice lists different inquiries.
      expect(await listInquiryNames(inquiryPage)).not.toEqual(firstPage);

      // Step 3: Go back to the first page.
      await inquiryPage.gotoInquiryPage(1, '1');

      // Assert: the first slice is back.
      expect(await listInquiryNames(inquiryPage)).toEqual(firstPage);
    });
  });

  test.describe('Inquiry update', () => {
    // Regression test: an inquiry can be renamed through the edit form.
    // TC037: Verify renaming an inquiry and reverting it.
    test('TC037 - user can rename an inquiry through the edit form and revert it', async ({
      page,
    }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Inquiry',
        suite: 'Inquiry Update',
        type: 'regression',
        description:
          'Renames a listed inquiry through the edit form, verifies the rename, and reverts it so the list is left untouched.',
      });

      // Step 1: Open the list and pick a record no other test depends on. The
      // seeded record backs the search tests, so it is never the target, and
      // rows tagged from earlier test development are skipped as well. Only
      // the name changes below, which status, source and priority filters never
      // look at, so parallel filter runs keep passing throughout.
      const inquiryPage = await openInquiryList(page);
      const listed = await listInquiryNames(inquiryPage);
      const display = listed.find(
        (name) =>
          !name.includes('AUTOSEED') && !/No inquiries/i.test(name) && !/QX\d{4,}/.test(name),
      );
      expect(display, 'No editable inquiry listed.').toBeTruthy();

      // Step 2: Open the target through its display name and read the stored
      // name off its form. The form holds the untitled name while the list
      // shows it with the title prefix, so every value below comes from the
      // form, never derived from display text.
      await inquiryPage.searchBox.fill(display);
      expect(await inquiryPage.waitForSearchOutcome(display)).toBe('matched');
      await inquiryPage.chooseRowMenuItemFor(display, 'Edit');
      const stored = await inquiryPage.lastNameInput.inputValue();
      expect(stored.trim(), 'The edit form showed no stored name.').toBeTruthy();

      // The edited value carries a tag no record can already have.
      const editedForm = `${stored.trim().split(' ').slice(0, -1).join(' ')} QX${randomDigits(6)}`;

      // Step 3: Rename it and save.
      await inquiryPage.lastNameInput.fill(editedForm);
      await inquiryPage.updateInquiry();

      // Assert: the renamed record lists under the edited value.
      await inquiryPage.searchBox.fill(editedForm);
      expect(await inquiryPage.waitForSearchOutcome(editedForm)).toBe('matched');
      expect((await listInquiryNames(inquiryPage))[0]).toContain(editedForm);

      // Step 4: Revert the rename with the exact stored value, so the shared
      // list is left exactly as it was found. Inquiries cannot be deleted, so
      // reverting is the cleanup here.
      await inquiryPage.chooseRowMenuItemFor(editedForm, 'Edit');
      await inquiryPage.lastNameInput.fill(stored.trim());
      await inquiryPage.updateInquiry();

      // Assert: the edited value lists nowhere, and the stored name is back.
      await inquiryPage.searchBox.fill(editedForm);
      expect(await inquiryPage.waitForSearchOutcome(editedForm)).toBe('empty');
      await inquiryPage.searchBox.fill(stored.trim());
      expect(await inquiryPage.waitForSearchOutcome(stored.trim())).toBe('matched');
      expect((await listInquiryNames(inquiryPage))[0]).toContain(stored.trim());
    });
  });
});
