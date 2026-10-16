const { test, expect } = require('@playwright/test');
const { applyAllureContext } = require('../allure-context');
const { InquiryPage } = require('../../pages/inquiry/InquiryPage');
const { DashboardPage } = require('../../pages/dashboard/DashboardPage');
const { loginAsValidUser } = require('../../utils/authFlow');
const { SEEDED_INQUIRY } = require('../../utils/inquirySeed');

test.describe('Inquiry', () => {
  test.describe('Inquiry search', () => {
// Opens the inquiry list. The record these tests search for is registered once
    // by the global setup, so they share it and never depend on data that was
    // seeded by hand.
    async function openInquiryList(page) {
      await loginAsValidUser(page);
      await new DashboardPage(page).waitForDashboard();
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
      const inquiryPage = new InquiryPage(page);
      await inquiryPage.openFromDashboard();
      return inquiryPage;
    }

    // Regression test: the inquiry list can be searched by patient name.
    // TC028: Verify inquiry search by name.
    test('TC028 - user can search inquiries by name', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Inquiry',
        suite: 'Search',
        type: 'regression',
        description: 'Searches the inquiry list by patient name and returns the matching record.',
      });

      // Step 1: Open the inquiry list and search by name.
      const inquiryPage = await openInquiryList(page);
      await inquiryPage.searchInquiries(SEEDED_INQUIRY.name);

      // Assert: the seeded inquiry is listed.
      await inquiryPage.verifySearchResultContains(SEEDED_INQUIRY.name);
    });

    // Regression test: the inquiry list can be searched by mobile number.
    // TC029: Verify inquiry search by mobile number.
    test('TC029 - user can search inquiries by mobile number', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Inquiry',
        suite: 'Search',
        type: 'regression',
        description: 'Searches the inquiry list by mobile number and returns the matching record.',
      });

      // Step 1: Open the inquiry list and search by the mobile number on the record.
      const inquiryPage = await openInquiryList(page);
      await inquiryPage.searchInquiries(SEEDED_INQUIRY.mobile);

      // Assert: the inquiry carrying that number is listed.
      await inquiryPage.verifySearchResultContains(SEEDED_INQUIRY.name);
    });

    // Regression test: the inquiry list can be searched by email address.
    // TC030: Verify inquiry search by email.
    test('TC030 - user can search inquiries by email', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Inquiry',
        suite: 'Search',
        type: 'regression',
        description: 'Searches the inquiry list by email address and returns the matching record.',
      });

      // Step 1: Open the inquiry list and search by email.
      const inquiryPage = await openInquiryList(page);
      await inquiryPage.searchInquiries(SEEDED_INQUIRY.email);

      // Assert: the inquiry registered with that email is listed.
      await inquiryPage.verifySearchResultContains(SEEDED_INQUIRY.name);
    });

    // Regression test: clearing the search brings the whole list back.
    // TC031: Verify clearing search restores the full inquiry list.
    test('TC031 - clearing search restores the full inquiry list', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Inquiry',
        suite: 'Search',
        type: 'regression',
        description: 'Clears the applied inquiry search filter and restores the complete inquiry list.',
      });

      // Step 1: Open the inquiry list and narrow it down with a search.
      const inquiryPage = await openInquiryList(page);
      await inquiryPage.searchInquiries(SEEDED_INQUIRY.name);
      await inquiryPage.verifySearchResultContains(SEEDED_INQUIRY.name);

      // Step 2: Clear the search filter.
      await inquiryPage.clearSearch();

      // Assert: the unfiltered list is shown again.
      await inquiryPage.verifyInquiryRows();
    });
  });
});
