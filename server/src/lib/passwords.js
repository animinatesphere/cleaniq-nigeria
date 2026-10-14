// Temporary passwords for new staff/cleaners and password resets (sent by email, stored only as a bcrypt hash).
const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");

// e.g. "kite-4821-river" — easy to type on a phone, ~40 bits of randomness.
const WORDS = ["kite", "river", "mango", "palm", "lagos", "sunny", "ocean", "cedar", "maple", "amber", "coral", "delta", "eagle", "flint", "grove", "harbor", "indigo", "jade", "lotus", "meadow", "noble", "olive", "pearl", "quartz", "raven", "sable", "tiger", "umber", "velvet", "willow"];
function temporaryPassword() {
  const w = () => WORDS[crypto.randomInt(WORDS.length)];
  return `${w()}-${crypto.randomInt(1000, 10000)}-${w()}-${crypto.randomInt(10, 100)}`;
}

const hashPassword = (pw) => bcrypt.hash(pw, 12);

module.exports = { temporaryPassword, hashPassword };
