const { test, expect } = require('@playwright/test');
const { applyAllureContext } = require('../allure-context');
const { HeaderPage } = require('../../pages/dashboard/HeaderPage');
const { DashboardPage } = require('../../pages/dashboard/DashboardPage');
const { loginAsValidUser, credentials } = require('../../utils/authFlow');

// Location the session starts on, so the test can switch away and come back.
const DEFAULT_LOCATION = 'Sattva Satellite';
// Second location used to prove the switch really changed the working location.
const OTHER_LOCATION = 'Sattva Vastrapur';

test.describe('Dashboard', () => {
  test.describe('Dashboard location switching', () => {
    // Smoke test: the header switcher changes the working location in both directions.
    // TC003: Verify switching the location in the dashboard header.
    test('TC003 - user can switch the current location from the dashboard header', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Dashboard',
        suite: 'Location Switching',
        type: 'smoke',
        description: 'Confirms that the location switcher changes the location the session is working under in both directions.',
      });

      // Arrange: the header page object needs the signed in user to read the current location.
      const headerPage = new HeaderPage(page, credentials.validUser);

// Step 1: Sign in and wait for the dashboard.
      await loginAsValidUser(page);
      await new DashboardPage(page).waitForDashboard();
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

      // Assert: the session starts on the default location. The switcher only writes to
      // this browser context, so no other test can be moved by what happens here.
      await headerPage.expectCurrentLocation(DEFAULT_LOCATION);

      // Step 2: Switch to the other location.
      await headerPage.selectLocation(OTHER_LOCATION);

      // Assert: the header now shows the location that was picked.
      await headerPage.expectCurrentLocation(OTHER_LOCATION);

      // Step 3: Switch back so the location is left exactly as it was found.
      await headerPage.selectLocation(DEFAULT_LOCATION);
      await headerPage.expectCurrentLocation(DEFAULT_LOCATION);
    });
  });
});
