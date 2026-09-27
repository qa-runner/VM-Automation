const { BasePage } = require('../base/BasePage');

class PatientPage extends BasePage {
  constructor(page) {
    super(page);

    // Patient module and list navigation.
    this.patientMainMenu = ':text-is("Patient")';
    this.patientListButton = "text=Patient List";
    this.addPatientButton = "button:has-text('Add Patient')";

    // Patient registration form.
    this.registrationModalTitle = "text=Patient Registration";
    this.firstNameInput = "input[placeholder='First Name']";
    this.lastNameInput = "input[placeholder='Last Name']";
    this.mobileNumberInput = "input[placeholder='Mobile Number']";
    this.registerPatientButton = "button:has-text('Register Patient')";
    this.confirmRegistrationHeading = "heading:has-text('Confirm registration')";
  }

  // Opens the patient module and goes to the patient list.
  async openPatientList() {
    await this.page.locator(this.patientMainMenu).click();
    await this.page.locator(this.patientListButton).click();
  }

  // Opens the add patient modal.
  async openAddPatientForm() {
    await this.page.locator(this.addPatientButton).click();
    await this.page.getByText('Patient Registration', { exact: true }).waitFor({ state: 'visible', timeout: 15000 });
  }

  // Fills the patient registration form with generated values.
  async fillPatientDetails(firstName, lastName, mobileNumber) {
    await this.page.getByRole('textbox', { name: 'First Name *' }).fill(firstName);
    await this.page.getByRole('textbox', { name: /Last Name/i }).fill(lastName);
    await this.page.getByRole('textbox', { name: /Mobile number \*/i }).fill(mobileNumber);
  }

  // Submits the patient form and confirms the registration action in the modal.
  async submitRegistration() {
    await this.page.getByRole('button', { name: /Register Patient/i }).click();
    const confirmDialog = this.page.locator('[role="dialog"], .modal, [data-state="open"]');
    await confirmDialog.getByRole('heading', { name: /Confirm registration/i }).waitFor({ state: 'visible', timeout: 15000 });
    await confirmDialog.getByRole('button', { name: /Register Patient/i }).click();
  }

  // Verifies that the new patient appears in the list by full name.
  async verifyPatientAdded(fullName) {
    const patientRow = this.page.locator(`//span[normalize-space()='${fullName}']`);
    await patientRow.waitFor({ state: 'visible', timeout: 20000 });
    return await patientRow.isVisible();
  }
}

module.exports = { PatientPage };
