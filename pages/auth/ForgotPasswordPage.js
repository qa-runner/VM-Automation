const { expect } = require('@playwright/test');
const { BasePage } = require('../base/BasePage');

class ForgotPasswordPage extends BasePage {
  constructor(page) {
    super(page);

    // Reset password screen.
    this.pageHeading = this.page.getByRole('heading', { name: 'Reset Password' });
    // The floating "Mobile Number" label is not associated with the input, so the
    // placeholder is the only handle the field exposes to accessibility queries.
    this.mobileInput = this.page.getByPlaceholder('10 digit mobile number');
    this.continueButton = this.page.getByRole('button', { name: 'Continue' });
    this.accountNotFoundMessage = this.page.getByText('Account not found', { exact: true });
  }

  // Waits until the reset password form is ready.
  async waitForResetPasswordForm() {
    await this.page.waitForURL(/\/auth\/reset-password$/, { timeout: 15000 });
    await expect(this.pageHeading).toBeVisible();
  }

  // Enters a mobile number and moves to the next step of the reset flow.
  async submitMobile(mobileNumber) {
    await this.mobileInput.fill(mobileNumber);
    await this.continueButton.click();
  }

  // Asserts the app reports that no account matches the submitted mobile number.
  async expectAccountNotFound() {
    await expect(this.accountNotFoundMessage).toBeVisible();
  }
}

module.exports = { ForgotPasswordPage };
