const { chromium } = require('@playwright/test');
const { LoginPage } = require('../pages/auth/LoginPage');
const { DashboardPage } = require('../pages/dashboard/DashboardPage');
const { InquiryPage } = require('../pages/inquiry/InquiryPage');
const { ensureSeededInquiry } = require('./inquirySeed');
const credentials = require('../data/credentials.json');
const config = require('../playwright.config');

// Signs in once before the workers start and registers the inquiry the search
// tests rely on, so the workers cannot race each other into creating that record
// more than once.
//
// The session deliberately is not cached and reused. It was tried, and the app
// grants parts of the UI from state that only the sign in flow puts in place:
// with a restored session the patient row menu was missing its Delete Patient
// item, while a real sign in showed it, with an identical user and identical
// localStorage. The app keeps that part of the UI in state that only the sign in
// flow builds, so it cannot be saved and replayed. Every test signs in itself.
async function prepareTestData() {
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      baseURL: config.use.baseURL,
      viewport: config.use.viewport,
    });
    const page = await context.newPage();

    const loginPage = new LoginPage(page);
    await loginPage.openLoginPage();
    await loginPage.loginAs(credentials.validUser);
    await new DashboardPage(page).waitForDashboard();

    // Seeded here rather than in the tests themselves, so parallel workers
    // cannot race each other into registering the same record more than once.
    const inquiryPage = new InquiryPage(page);
    await inquiryPage.openFromDashboard();
    await ensureSeededInquiry(page, inquiryPage);
  } finally {
    await browser.close();
  }
}

module.exports = { prepareTestData };
