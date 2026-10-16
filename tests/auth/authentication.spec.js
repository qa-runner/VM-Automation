const { test, expect } = require('@playwright/test');
const { applyAllureContext } = require('../allure-context');
const { LoginPage } = require('../../pages/auth/LoginPage');
const { DashboardPage } = require('../../pages/dashboard/DashboardPage');
const { HeaderPage } = require('../../pages/dashboard/HeaderPage');
const { ForgotPasswordPage } = require('../../pages/auth/ForgotPasswordPage');
const { generateUnregisteredMobile } = require('../../utils/authData');
const { credentials, loginAsValidUser } = require('../../utils/authFlow');

test.describe('Auth', () => {
  test.describe('Signin & Signout', () => {
    // Smoke test: a session can be ended and the app returns to the sign in page.
    // TC001: Verify login with valid creds and logout.
    test('TC001 - user can sign in with valid credentials and sign out back to the sign in page', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Auth',
        suite: 'Signin & Signout',
        type: 'smoke',
        description: 'Confirms that an authenticated session can be ended cleanly and that the application returns the user to the sign in page.',
      });

      // Arrange: the profile menu needs the signed in user, the sign in page needs nothing.
      const loginPage = new LoginPage(page);
      const headerPage = new HeaderPage(page, credentials.validUser);

      // Step 1: Sign in with the valid user.
      await loginAsValidUser(page);

      // Assert: the session lands on the dashboard at the expected url.
      await new DashboardPage(page).waitForDashboard();
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
      await expect(page).toHaveURL('https://appdev.ayushmanager.com/');

      // Step 2: Sign out from the profile menu in the header.
      await headerPage.openProfileMenu();
      await headerPage.logout();

      // Assert: the sign in page is shown again, so the session really ended.
      await loginPage.verifySignInPage();
    });
  });

  test.describe('Forgot password', () => {
    // Regression test: the reset password form accepts a mobile number and reports unknown ones.
    // TC002: Verify password reset reports an unknown mobile number.
    test('TC002 - user can reach the reset password page and submit a mobile number', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Auth',
        suite: 'Forgot Password',
        type: 'regression',
        description: 'Confirms that the forgot password flow accepts a submitted mobile number and reports back when no account matches it.',
      });

      // Arrange: page objects for the sign in screen and the reset password form.
      const loginPage = new LoginPage(page);
      const forgotPasswordPage = new ForgotPasswordPage(page);

      // Step 1: Open the sign in page and follow the forgot password link.
      await loginPage.openLoginPage();
      await loginPage.openForgotPasswordPage();

      // Step 2: Submit a mobile number that has no account, so the response is predictable.
      await forgotPasswordPage.waitForResetPasswordForm();
      await forgotPasswordPage.submitMobile(generateUnregisteredMobile());

      // Assert: the form tells the user that no account matches the number.
      await forgotPasswordPage.expectAccountNotFound();
    });
  });
});
