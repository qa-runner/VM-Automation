const { BasePage } = require('../base/BasePage');

class DashboardPage extends BasePage {
  constructor(page) {
    super(page);

    // Dashboard page title locator.
    this.pageTitle = "//h1[normalize-space()='Dashboard']";
  }

  // Waits until the dashboard is visible after successful login.
  async waitForDashboard() {
    await this.page.locator(this.pageTitle).waitFor({ state: 'visible', timeout: 15000 });
  }

  // Gets the visible dashboard heading text.
  async getTitleText() {
    return await this.page.locator(this.pageTitle).textContent();
  }
}

module.exports = { DashboardPage };
