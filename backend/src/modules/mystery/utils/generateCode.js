const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateRandomCode(length = 10) {
  let code = '';
  for (let i = 0; i < length; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)];
  return code;
}

module.exports = { generateRandomCode };