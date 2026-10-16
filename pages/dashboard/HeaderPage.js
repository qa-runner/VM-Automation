const { expect } = require('@playwright/test');
const { allure } = require('allure-playwright');
const { BasePage } = require('../base/BasePage');

class HeaderPage extends BasePage {
  constructor(page, user) {
    super(page);

    // Profile trigger in the application header.
    this.profileTrigger = this.page.getByText(user.displayName, { exact: true });

    // Menu that opens from the profile trigger.
    this.logoutLink = this.page.getByRole('link', { name: 'Logout' });
    this.logoutConfirmMessage = this.page.getByText('Are you sure you want to logout?', { exact: true });
    this.logoutDialog = this.page.getByRole('dialog').filter({ has: this.logoutConfirmMessage });
    this.logoutConfirmButton = this.logoutDialog.getByRole('button', { name: 'Logout' });

    // Sign in screen the user lands on after logging out.
    this.signInHeading = this.page.getByRole('heading', { name: 'Sign in' });

    // Location switcher in the header. It is identified by its geolocation icon
    // because the profile dropdown carries a similar arrow icon, and the arrow
    // itself is shared, so neither icon can be used to tell the two apart.
    this.locationIcon = this.page.locator('i[class*="ki-geolocation"]');
    this.locationSwitcher = this.page.getByRole('button').filter({ has: this.locationIcon });
    this.currentLocationBadge = this.locationSwitcher.locator('span').first();

    // The dropdown opens as a panel inside the switcher's own container, so the
    // container scopes the options. The trigger is excluded from them by icon.
    this.locationMenu = this.locationSwitcher.locator('xpath=..');
    this.locationOptions = this.locationMenu.getByRole('button').filter({ hasNot: this.locationIcon });

    // Header search palette that lists pages, features and settings.
    this.paletteInput = this.page.getByRole('textbox', { name: 'Search pages, features, settings...' });

    // Results render in an absolutely positioned panel under the palette input.
    // The option's accessible name carries the page description as well, so it
    // reads "Patient List Patient" rather than just the page name, which is why
    // the results are matched on visible text instead of the accessible name.
    this.palettePanel = this.page.locator('div.absolute').filter({ has: this.page.getByRole('button') });
    this.paletteOptions = this.palettePanel.getByRole('button');
  }

  // Returns a palette result by the page name shown on it.
  paletteOption(name) {
    return this.paletteOptions.filter({ hasText: name });
  }

  // Types a term into the palette and waits for its results to appear.
  async searchPalette(term) {
    await allure.step(`Search palette: ${term}`, async () => {
      await this.paletteInput.fill(term);
      await expect(this.paletteOptions.first()).toBeVisible({ timeout: 10000 });
    });
  }

  // Clicks a palette result by the page name shown on it.
  async selectPaletteResult(name) {
    await expect(this.paletteOption(name)).toBeVisible({ timeout: 10000 });
    await this.paletteOption(name).click();
  }

  // Returns a single location option by its exact visible name.
  locationOption(name) {
    return this.locationMenu.getByRole('button', { name, exact: true }).filter({ hasNot: this.locationIcon });
  }

  // Returns the location name currently shown on the switcher badge.
  async getCurrentLocation() {
    return (await this.currentLocationBadge.innerText({ timeout: 5000 })).trim();
  }

  // Verifies the switcher badge shows the expected location.
  async expectCurrentLocation(name) {
    await expect(this.currentLocationBadge).toHaveText(name, { timeout: 15000 });
  }

  // Opens the location dropdown and waits for its options to render.
  async openLocationSwitcher() {
    await expect(this.locationSwitcher).toBeVisible();
    await this.locationSwitcher.click();
    await expect(this.locationOptions.first()).toBeVisible({ timeout: 10000 });
  }

  // Opens the dropdown and selects the given location.
  async selectLocation(name) {
    await allure.step(`Select location: ${name}`, async () => {
      await this.openLocationSwitcher();
      await expect(this.locationOption(name)).toBeVisible({ timeout: 10000 });
      await this.locationOption(name).click();
    });
  }

  // Verifies the signed in user is shown in the header and opens the profile menu.
  async openProfileMenu() {
    await expect(this.profileTrigger.first()).toBeVisible();
    await this.profileTrigger.first().click();
    await expect(this.logoutLink).toBeVisible();
  }

  // Opens the logout confirmation modal and confirms the logout.
  async logout() {
    await allure.step('Logout from application', async () => {
      await this.logoutLink.click();
      await expect(this.logoutDialog).toBeVisible();
      await this.logoutConfirmButton.click();
    });
  }

  // Verifies the session ended and the sign in page is shown again.
  async verifySignedOut() {
    await this.page.waitForURL(/\/auth\/login$/, { timeout: 15000 });
    await expect(this.signInHeading).toBeVisible();
  }
}

module.exports = { HeaderPage };
