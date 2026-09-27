const { test, expect } = require('@playwright/test');
const { LoginPage } = require('../../pages/auth/LoginPage');
const { PatientPage } = require('../../pages/patient/PatientPage');
const credentials = require('../../data/credentials.json');

function generateUniquePatientName() {
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  const firstName = `QA ${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const lastName = String(randomDigits);
  const mobileNumber = `9${String(Math.floor(100000000 + Math.random() * 900000000))}`;

  return {
    firstName,
    lastName,
    mobileNumber,
    fullName: `${firstName} ${lastName}`,
  };
}

test.describe('AyushManager patient management', () => {
  test('user can add a patient successfully', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const patientPage = new PatientPage(page);
    const patient = generateUniquePatientName();

    // Step 1: Open login page and sign in.
    await loginPage.openLoginPage();
    await loginPage.loginAs(credentials.validUser);

    // Step 2: Navigate to the patient list.
    await patientPage.openPatientList();

    // Step 3: Click Add Patient and fill the registration form.
    await patientPage.openAddPatientForm();
    await patientPage.fillPatientDetails(patient.firstName, patient.lastName, patient.mobileNumber);

    // Step 4: Submit patient registration and confirm the modal.
    await patientPage.submitRegistration();

    // Step 5: Verify the new patient appears in the patient list.
    const isVisible = await patientPage.verifyPatientAdded(patient.fullName);
    expect(isVisible).toBeTruthy();
  });
});
