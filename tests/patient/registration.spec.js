const { test, expect } = require('@playwright/test');
const { applyAllureContext } = require('../allure-context');
const { deletePatientByName, registerPatient } = require('../../utils/patientFlow');
const { PatientPage } = require('../../pages/patient/PatientPage');
const { DashboardPage } = require('../../pages/dashboard/DashboardPage');
const { loginAsValidUser } = require('../../utils/authFlow');

test.describe('Patient', () => {
  test.describe('Patient registration - OPD type', () => {
    // Smoke test: an outpatient patient can be registered, found in the list and deleted again.
    // TC021: Verify OPD registration, search and delete.
    test('TC021 - user can register an OPD patient, find it in the list and delete it', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Patient',
        suite: 'OPD Registration',
        type: 'smoke',
        description: 'Covers the full outpatient registration journey: form entry, OPD type selection, confirmation, verification, and cleanup.',
      });

      // Step 1: Sign in and wait for the dashboard.
      await loginAsValidUser(page);
      await new DashboardPage(page).waitForDashboard();
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

      // Step 2: Register an OPD patient with generated data and confirm the modal.
      const { patient, patientPage } = await registerPatient(page, 'OPD');

      // Assert: the new patient is listed in the patient list.
      await patientPage.verifyPatientAdded(patient.fullName);

      // Step 3: Delete the patient again so the list is left clean for other tests.
      await deletePatientByName(page, patient.fullName);
    });
  });

  test.describe('Patient registration - IPD type', () => {
    // Smoke test: an inpatient patient can be registered, found in the list and deleted again.
    // TC022: Verify IPD registration, search and delete.
    test('TC022 - user can register an IPD patient, find it in the list and delete it', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Patient',
        suite: 'IPD Registration',
        type: 'smoke',
        description: 'Covers the full inpatient registration journey: form entry, IPD type selection, confirmation, verification, and cleanup.',
      });

      // Step 1: Sign in and wait for the dashboard.
      await loginAsValidUser(page);
      await new DashboardPage(page).waitForDashboard();
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

      // Step 2: Register an IPD patient with generated data and confirm the modal.
      const { patient, patientPage } = await registerPatient(page, 'IPD');

      // Assert: the new patient is listed in the patient list.
      await patientPage.verifyPatientAdded(patient.fullName);

      // Step 3: Delete the patient again so the list is left clean for other tests.
      await deletePatientByName(page, patient.fullName);
    });
  });

  test.describe('Patient registration validation', () => {
    // Regression test: the registration form refuses an empty submit.
    // TC023: Verify registration refuses an empty name and mobile.
    test('TC023 - user cannot register a patient without a first name and mobile number', async ({
      page,
    }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Patient',
        suite: 'Registration Validation',
        type: 'regression',
        description:
          'Submits the registration form empty and confirms the required field messages hold the form open.',
      });

      // Step 1: Sign in and open the registration form.
      await loginAsValidUser(page);
      await new DashboardPage(page).waitForDashboard();
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
      const patientPage = new PatientPage(page);
      await patientPage.openPatientList();
      await patientPage.openAddPatientForm();

      // Step 2: Submit with everything empty.
      await patientPage.submitRegistrationForm();

      // Assert: both required field messages show and the form stays open instead
      // of registering anything.
      const errors = await patientPage.listValidationErrors();
      expect(errors).toContain('First name is required');
      expect(errors).toContain('Mobile number is required');
      await expect(page.getByText('Patient Registration', { exact: true })).toBeVisible();
    });
  });

  test.describe('Patient registration mobile validation', () => {
    // Regression test: the mobile number field only takes ten digits.
    // TC024: Verify registration refuses an invalid mobile number.
    test('TC024 - user cannot register a patient with an invalid mobile number', async ({ page }) => {
      // Registers module, suite, unique id, type and description in the Allure report.
      await applyAllureContext({
        module: 'Patient',
        suite: 'Registration Validation',
        type: 'regression',
        description:
          'Confirms a short mobile number is refused, letters count as missing, and the field caps entry at ten digits.',
      });

      // Step 1: Sign in and open the registration form with a valid first name,
      // so only the mobile number is ever complained about.
      await loginAsValidUser(page);
      await new DashboardPage(page).waitForDashboard();
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
      const patientPage = new PatientPage(page);
      await patientPage.openPatientList();
      await patientPage.openAddPatientForm();
      await patientPage.firstNameInput.fill('QA Probe');

      // Step 2: Submit a short number.
      await patientPage.mobileNumberInput.fill('123');
      await patientPage.submitRegistrationForm();

      // Assert: the length message shows and the form stays open.
      expect(await patientPage.listValidationErrors()).toContain('Mobile number must be exactly 10 digits');
      await expect(page.getByText('Patient Registration', { exact: true })).toBeVisible();

      // Step 3: Submit letters instead of digits.
      await patientPage.mobileNumberInput.fill('abcdefghij');
      await patientPage.submitRegistrationForm();

      // Assert: letters count as a missing number.
      expect(await patientPage.listValidationErrors()).toContain('Mobile number is required');

      // Step 4: Type eleven digits without submitting.
      await patientPage.mobileNumberInput.fill('98765432101');

      // Assert: the field keeps the first ten, so an overlong number can never
      // even reach the validation above.
      expect(await patientPage.mobileNumberInput.inputValue()).toBe('9876543210');
    });
  });
});
