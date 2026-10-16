// Generates patient data for tests. Every record is prefixed with QA so test data
// is easy to recognise and safe to delete from the application.
const { pickRandom, randomDigits } = require('./random');

// First names used to build the generated patient name.
const FIRST_NAMES = [
  'Jack',
  'Aman',
  'Priya',
  'Neha',
  'Rahul',
  'Sneha',
  'Vikas',
  'Pooja',
  'Rohit',
  'Kavya',
  'Suresh',
  'Meera',
  'Anil',
  'Divya',
  'Karan',
  'Ishita',
];

// Registration types the patient form offers.
const PATIENT_TYPES = ['OPD', 'IPD'];
// Marks the record as test data, for example 'QA Neha 4821'.
const QA_NAME_PREFIX = 'QA';

// First name with the QA marker in front of it.
function generateFirstName() {
  return `${QA_NAME_PREFIX} ${pickRandom(FIRST_NAMES)}`;
}

// Last name is a random number, which keeps repeated runs from colliding.
function generateLastName() {
  return randomDigits(4);
}

// Indian style ten digit mobile number.
function generateMobileNumber() {
  return `9${randomDigits(9)}`;
}

// Full patient record. The type can be forced, otherwise one is picked at random.
function generatePatient(type) {
  const firstName = generateFirstName();
  const lastName = generateLastName();

  return {
    firstName,
    lastName,
    mobileNumber: generateMobileNumber(),
    type: type ?? pickRandom(PATIENT_TYPES),
    fullName: `${firstName} ${lastName}`,
  };
}

module.exports = {
  FIRST_NAMES,
  PATIENT_TYPES,
  QA_NAME_PREFIX,
  generateFirstName,
  generateLastName,
  generateMobileNumber,
  generatePatient,
};
