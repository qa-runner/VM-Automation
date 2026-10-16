const { test, expect } = require('@playwright/test');
const { applyAllureContext } = require('../allure-context');
const { InquiryPage } = require('../../pages/inquiry/InquiryPage');
const { DashboardPage } = require('../../pages/dashboard/DashboardPage');
const { loginAsValidUser } = require('../../utils/authFlow');

// Every entry the inquiry row menu offers.
const INQUIRY_ROW_ACTIONS = ['Add Follow-up', 'Edit'];

test.describe('Inquiry', () => {
  // Signs in and opens the inquiry page, which every test below starts from.
  async function openInquiryList(page) {
    await loginAsValidUser(page);
    await new DashboardPage(page).waitForDashboard();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    const inquiryPage = new InquiryPage(page);
    await inquiryPage.openFromDashboard();

    return inquiryPage;
  }

  test.describe('Inquiry row actions', () => {
    // Regression test: the row menu offers to edit the inquiry.
    // TC035: Verify inquiry edit form cancels without changes.
    test('TC035 - user can open the edit form of an inquiry and cancel it', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Inquiry',
        suite: 'Row Actions',
        type: 'regression',
        description:
          'Opens the edit form of an inquiry from the row menu and cancels it without changing anything.',
      });

      // Step 1: Open the inquiry page, which carries inquiries.
      const inquiryPage = await openInquiryList(page);
      const totalBefore = await inquiryPage.getTotalInquiryCount();

      // Step 2: Open the row menu of the first inquiry.
      const items = await inquiryPage.openFirstRowActions();

      // Assert: every row action is offered.
      for (const action of INQUIRY_ROW_ACTIONS) {
        expect(items).toContain(action);
      }

      // Step 3: Open the edit form.
      await inquiryPage.chooseFirstRowMenuItem('Edit');

      // Assert: the form opens for that inquiry and offers to cancel.
      await expect(page.getByRole('heading', { name: 'Edit Inquiry' })).toBeVisible();
      await expect(
        page.getByRole('dialog').getByRole('button', { name: 'Cancel' }),
      ).toBeVisible();

      // Step 4: Cancel without saving.
      await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();

      // Assert: the form closes and the list is untouched.
      await expect(page.getByRole('dialog')).toHaveCount(0);
      expect(await inquiryPage.getTotalInquiryCount()).toBe(totalBefore);
    });
  });
});
