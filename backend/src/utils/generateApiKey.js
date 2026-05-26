const crypto = require('crypto');

/**
 * Generate a secure API key with prefix.
 * Returns { rawKey, keyHash, keyPrefix }
 * - rawKey: shown to user ONCE (sk_live_<random>)
 * - keyHash: SHA-256 hash stored in DB
 * - keyPrefix: first 12 chars for display (sk_live_abc...)
 */
function generateApiKey() {
    const randomPart = crypto.randomBytes(32).toString('hex');
    const rawKey = `sk_live_${randomPart}`;
    const keyHash = hashApiKey(rawKey);
    const keyPrefix = rawKey.substring(0, 16);

    return { rawKey, keyHash, keyPrefix };
}

/**
 * Hash an API key using SHA-256.
 * Used for validation: hash incoming key and compare against DB.
 */
function hashApiKey(rawKey) {
    return crypto.createHash('sha256').update(rawKey).digest('hex');
}

module.exports = { generateApiKey, hashApiKey };
