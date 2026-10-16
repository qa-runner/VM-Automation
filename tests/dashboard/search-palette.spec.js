const { test, expect } = require('@playwright/test');
const { applyAllureContext } = require('../allure-context');
const { HeaderPage } = require('../../pages/dashboard/HeaderPage');
const { DashboardPage } = require('../../pages/dashboard/DashboardPage');
const { loginAsValidUser, credentials } = require('../../utils/authFlow');

test.describe('Dashboard', () => {
  test.describe('Dashboard header search', () => {
    // Smoke test: the global search palette filters pages and opens the one that is picked.
    // TC004: Verify header search palette opens the patient list.
    test('TC004 - user can navigate to the patient list using the header search palette', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Dashboard',
        suite: 'Search Palette',
        type: 'smoke',
        description: 'Confirms that the global search palette filters available pages and navigates to the selected page.',
      });

// Step 1: Sign in and wait for the dashboard.
      await loginAsValidUser(page);
      await new DashboardPage(page).waitForDashboard();
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

      // Step 2: Search for the patient list and pick it from the filtered results.
      const headerPage = new HeaderPage(page, credentials.validUser);
      await headerPage.searchPalette('patient list');
      await headerPage.selectPaletteResult('Patient List');

      // Assert: the patient list page is open, both by heading and by url.
      await expect(page.getByRole('heading', { name: 'Patient List' })).toBeVisible();
      await expect(page).toHaveURL(/\/patient-list$/);
    });
  });
});
