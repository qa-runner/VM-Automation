const { BasePage } = require('../base/BasePage');

class LoginPage extends BasePage {
  constructor(page) {
    super(page);

    // Login form locators.
    this.mobileEmailInput = "input[placeholder='Enter Mobile/Email']";
    this.passwordInput = "input[placeholder='Enter Password']";
    this.signInButton = "//button[normalize-space()='Sign In']";
  }

  // Opens the AyushManager login page.
  async openLoginPage() {
    await this.open('/auth/login');
    await this.waitForPageLoad();
  }

  // Fills the login form and submits it.
  async login(mobileEmail, password) {
    await this.page.locator(this.mobileEmailInput).fill(mobileEmail);
    await this.page.locator(this.passwordInput).fill(password);
    await this.page.locator(this.signInButton).click();
  }

  // Helper method to keep tests readable.
  async loginAs(user) {
    await this.login(user.mobileEmail, user.password);
  }
}

module.exports = { LoginPage };
