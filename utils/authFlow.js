const { allure } = require('allure-playwright');
const { LoginPage } = require('../pages/auth/LoginPage');
const credentials = require('../data/credentials.json');

// Signs in with the valid QA user and waits until the dashboard is ready.
//
// Every automated activity runs under the location the account is given at sign
// in, Sattva Satellite. The header offers other locations, but Delete Patient is
// only available under this one, so the patient tests can only remove the
// records they create if they stay here.
async function loginAsValidUser(page) {
  await allure.step('Sign in with valid QA user', async () => {
    const loginPage = new LoginPage(page);
    await loginPage.openLoginPage();
    await loginPage.loginAs(credentials.validUser);
  });
}

module.exports = { credentials, loginAsValidUser };
