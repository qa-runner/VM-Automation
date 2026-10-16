const { allure } = require('allure-playwright');
const { PatientPage } = require('../pages/patient/PatientPage');
const { generatePatient } = require('./patientData');

// Registers one patient of the given type (OPD or IPD) and returns the generated data.
// The caller is expected to be signed in already.
async function registerPatient(page, patientType) {
  const patientPage = new PatientPage(page);
  const patient = generatePatient(patientType);

  await allure.step(`Register ${patientType} patient`, async () => {
    await patientPage.openPatientList();
    await patientPage.openAddPatientForm();
    await patientPage.fillPatientDetails(patient.firstName, patient.lastName, patient.mobileNumber);
    await patientPage.openAdditionalInformationTab();
    await patientPage.selectPatientType(patient.type);
    await patientPage.submitRegistration();
  });

  return { patient, patientPage };
}

// Deletes the given patient from the list and waits until the name is gone.
// The caller is expected to be signed in and on the patient list.
async function deletePatientByName(page, fullName) {
  await allure.step(`Delete patient: ${fullName}`, async () => {
    const patientPage = new PatientPage(page);

    await patientPage.openRowActions(fullName);
    await patientPage.openDeletePatientModal();
    await patientPage.confirmDelete();
    await patientPage.verifyPatientNotPresent(fullName);

    return patientPage;
  });
}

// Registers a patient and returns the name, mobile number and UHID that the
// patient list shows for that record.
async function registerSearchablePatient(page, patientType) {
  const { patient, patientPage } = await registerPatient(page, patientType);
  const details = await patientPage.getPatientRowDetails(patient.fullName);

  return { patient, patientPage, details };
}

// Returns the name of the first patient row that matches the searched text.
// The caller is expected to be signed in and on the patient list.
async function findFirstPatientByName(page, namePart) {
  const patientPage = new PatientPage(page);

  const name = await patientPage.searchForPatientName(namePart);

  if (!name) {
    throw new Error(`The patient list never listed a patient matching "${namePart}".`);
  }

  return name;
}

module.exports = {
  deletePatientByName,
  findFirstPatientByName,
  registerPatient,
  registerSearchablePatient,
};
