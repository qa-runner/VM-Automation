// Shared random helpers so every data generator produces the same style of unique value.

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// Returns a random number of exactly `count` digits, so it never starts with 0.
function randomDigits(count) {
  const lowest = Math.pow(10, count - 1);
  return String(lowest + Math.floor(Math.random() * 9 * lowest));
}

module.exports = { pickRandom, randomDigits };
