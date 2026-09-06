const bcrypt = require('bcryptjs');

const BCRYPT_ROUNDS = 12;

async function hashScannerPassword(plain) {
    const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
    return bcrypt.hash(String(plain), salt);
}

module.exports = { hashScannerPassword, BCRYPT_ROUNDS };
