const { expect } = require('@playwright/test');
const { allure } = require('allure-playwright');
const { BasePage } = require('../base/BasePage');

class LoginPage extends BasePage {
  constructor(page) {
    super(page);

    // Sign in screen.
    this.mobileEmailInput = "input[placeholder='Enter Mobile/Email']";
    this.passwordInput = "input[placeholder='Enter Password']";
    this.signInButton = "//button[normalize-space()='Sign In']";
    this.signInHeading = this.page.getByRole('heading', { name: 'Sign in' });
    this.forgotPasswordLink = this.page.getByRole('link', { name: 'Forgot Password?' });
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
    await allure.step('Sign in as valid QA user', async () => {
      await this.login(user.mobileEmail, user.password);
    });
  }

  // Opens the forgot password page from the sign in screen.
  async openForgotPasswordPage() {
    await expect(this.forgotPasswordLink).toBeVisible();
    await this.forgotPasswordLink.click();
  }

  // Verifies the user is back on the sign in screen after a session ends.
  async verifySignInPage() {
    await this.page.waitForURL(/\/auth\/login$/, { timeout: 15000 });
    await expect(this.signInHeading).toBeVisible();
  }
}

module.exports = { LoginPage };
