const { test, expect } = require('@playwright/test');
const { applyAllureContext } = require('../allure-context');
const {
  deletePatientByName,
  findFirstPatientByName,
  registerPatient,
  registerSearchablePatient,
} = require('../../utils/patientFlow');
const { DashboardPage } = require('../../pages/dashboard/DashboardPage');
const { loginAsValidUser } = require('../../utils/authFlow');

test.describe('Patient', () => {
  test.describe('Patient deletion', () => {
    // Smoke test: a patient can be removed through the row action menu of the list.
    // TC008: Verify a QA patient is found and deleted.
    test('TC008 - user can find a QA patient in the list and delete it', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Patient',
        suite: 'Patient Deletion',
        type: 'smoke',
        description: 'Confirms that a patient can be removed through the row action menu and the list stops showing the record.',
      });

      // Step 1: Open the dashboard and register a patient that is safe to delete.
      await loginAsValidUser(page);
      await new DashboardPage(page).waitForDashboard();
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
      const { patient } = await registerPatient(page, 'OPD');

      // Step 2: Find the registered patient in the list by its generated name.
      const foundPatientName = await findFirstPatientByName(page, patient.fullName);

      // Assert: the search really returned the patient that was registered.
      expect(foundPatientName).toBe(patient.fullName);

      // Step 3: Delete it from the row action menu and wait until the name disappears.
      await deletePatientByName(page, foundPatientName);
    });
  });

  test.describe('Patient list search', () => {
    // Registers a patient, searches the list by the given identifier and removes it again.
    // The three tests below share it so only the searched identifier changes between them.
    async function verifyPatientFoundBy(page, identifier) {
      // Step 1: Open the dashboard and register a patient, so the list holds a known record.
      await loginAsValidUser(page);
      await new DashboardPage(page).waitForDashboard();
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
      const { patient, patientPage, details } = await registerSearchablePatient(page, 'OPD');

      // Step 2: Search the list by the identifier and confirm the row is visible.
      await patientPage.searchAndExpectResult(details[identifier]);
      await patientPage.expectPatientRowVisible(details.name);

      // Step 3: Delete the patient so the search tests leave no data behind.
      await deletePatientByName(page, patient.fullName);
    }

    // Regression test: the patient list can be searched by patient name.
    // TC009: Verify patient search by name.
    test('TC009 - user can find a patient by name', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Patient',
        suite: 'Patient Search',
        type: 'regression',
        description: 'Searches the patient list by patient name and returns the matching record.',
      });

      await verifyPatientFoundBy(page, 'name');
    });

    // Regression test: the patient list can be searched by registered mobile number.
    // TC010: Verify patient search by mobile number.
    test('TC010 - user can find a patient by mobile number', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Patient',
        suite: 'Patient Search',
        type: 'regression',
        description: 'Searches the patient list by registered mobile number and returns the matching record.',
      });

      await verifyPatientFoundBy(page, 'mobileNumber');
    });

    // Regression test: the patient list can be searched by UHID.
    // TC011: Verify patient search by UHID.
    test('TC011 - user can find a patient by UHID', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Patient',
        suite: 'Patient Search',
        type: 'regression',
        description: 'Searches the patient list by UHID and returns the matching record.',
      });

await verifyPatientFoundBy(page, 'uhid');
    });
  });
});
