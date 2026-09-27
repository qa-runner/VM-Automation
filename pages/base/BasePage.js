class BasePage {
  constructor(page) {
    this.page = page;
  }

  // Opens any page using the configured base URL.
  async open(path) {
    await this.page.goto(path);
  }

  // Waits for the page to finish loading before doing assertions.
  async waitForPageLoad() {
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForLoadState('networkidle');
  }
}

module.exports = { BasePage };
