const { test, expect } = require('@playwright/test');
const { LoginPage } = require('../../pages/auth/LoginPage');
const { DashboardPage } = require('../../pages/dashboard/DashboardPage');
const credentials = require('../../data/credentials.json');

test.describe('AyushManager login flow', () => {
  test('user should login successfully and land on dashboard', async ({ page }) => {
    // Arrange: create page objects for login and dashboard.
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    // Step 1: Open the login page.
    await loginPage.openLoginPage();

    // Step 2: Login with valid credentials.
    await loginPage.loginAs(credentials.validUser);

    // Step 3: Wait for redirect to dashboard.
    await page.waitForURL('http://appdev.ayushmanager.com/', { timeout: 15000 });
    await dashboardPage.waitForDashboard();

    // Assert: URL and dashboard heading are correct.
    await expect(page).toHaveURL('http://appdev.ayushmanager.com/');
    await expect(page.locator(dashboardPage.pageTitle)).toHaveText('Dashboard');
  });
});
