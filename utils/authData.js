const { randomDigits } = require('./random');

// Returns a 10 digit mobile number that starts with 9 and is not a registered account.
function generateUnregisteredMobile() {
  return `9${randomDigits(9)}`;
}

module.exports = { generateUnregisteredMobile };
