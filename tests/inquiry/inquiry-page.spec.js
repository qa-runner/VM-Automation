const { test, expect } = require('@playwright/test');
const { applyAllureContext } = require('../allure-context');
const { InquiryPage } = require('../../pages/inquiry/InquiryPage');
const { DashboardPage } = require('../../pages/dashboard/DashboardPage');
const { loginAsValidUser } = require('../../utils/authFlow');
const { generateLastName, generateMobileNumber } = require('../../utils/patientData');

test.describe('Inquiry', () => {
  test.describe('Inquiry count', () => {
    // Regression test: the status card counts add up to the total shown in pagination.
    // TC025: Verify status card counts sum to the total.
    test('TC025 - sum of status card counts equals the total inquiry count', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Inquiry',
        suite: 'Count Verification',
        type: 'regression',
        description: 'Verifies the sum of all status card counts matches the total inquiry count shown in pagination.',
      });

      // Step 1: Open the dashboard, then the inquiry page.
      await loginAsValidUser(page);
      await new DashboardPage(page).waitForDashboard();
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
      const inquiryPage = new InquiryPage(page);
      await inquiryPage.openFromDashboard();

      // Assert: both numbers describe the same list, so no inquiry is counted twice or missed.
      await inquiryPage.verifyTotalCountMatchesCardSum();
    });
  });

  test.describe('Inquiry rows per page', () => {
    // Regression test: the rows per page dropdown changes how many rows are listed.
    // TC026: Verify changing inquiry rows per page.
    test('TC026 - user can change the number of rows displayed per page', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Inquiry',
        suite: 'Rows Per Page',
        type: 'regression',
        description: 'Confirms the rows per page dropdown changes the number of inquiry rows displayed.',
      });

      // Step 1: Open the dashboard, then the inquiry page.
      await loginAsValidUser(page);
      await new DashboardPage(page).waitForDashboard();
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
      const inquiryPage = new InquiryPage(page);
      await inquiryPage.openFromDashboard();

      // Step 2: Check the default page size of 10 rows.
      await expect(page.getByText('Rows per page', { exact: true })).toBeVisible();
      await inquiryPage.verifyRowCount(10);

      // Step 3: Switch the page size to 5.
      await inquiryPage.selectRowsPerPage(5);

      // Assert: the list now renders 5 rows instead of 10.
      await inquiryPage.verifyRowCount(5);
    });
  });

  test.describe('Add inquiry', () => {
    // Regression test: filling the new inquiry form and cancelling creates nothing.
    // TC027: Verify cancelling a filled inquiry form creates nothing.
    test('TC027 - user can fill the new inquiry form and cancel it without creating anything', async ({
      page,
    }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Inquiry',
        suite: 'Add Inquiry',
        type: 'regression',
        description:
          'Fills the new inquiry form with a QA identity and cancels it, then proves the list holds no such inquiry.',
      });

      // Step 1: Open the dashboard, then the inquiry page.
      await loginAsValidUser(page);
      await new DashboardPage(page).waitForDashboard();
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
      const inquiryPage = new InquiryPage(page);
      await inquiryPage.openFromDashboard();

      // Step 2: Note the total a created inquiry would move.
      const totalBefore = await inquiryPage.getTotalInquiryCount();

      // Step 3: Open the form and check it asks for the new inquiry.
      await inquiryPage.openAddInquiryDrawer();
      await expect(page.getByRole('heading', { name: 'New Inquiry' })).toBeVisible();

      // Step 4: Fill it with an identity no run could have used before. Cancelled
      // inquiries are never saved, so the name is unique by construction.
      const lastName = generateLastName();
      const fullName = `QA Cancel ${lastName}`;
      await inquiryPage.fillInquiryForm({
        firstName: 'QA Cancel',
        lastName,
        mobile: generateMobileNumber(),
        email: `qa.cancel.${lastName}@example.com`,
      });

      // Step 5: Cancel without saving.
      await inquiryPage.cancelAddInquiry();

      // Assert: the total did not move and the name is nowhere in the list.
      expect(await inquiryPage.getTotalInquiryCount()).toBe(totalBefore);
      await inquiryPage.searchBox.fill(fullName);
      expect(await inquiryPage.waitForSearchOutcome(fullName)).toBe('empty');
    });
  });
});
