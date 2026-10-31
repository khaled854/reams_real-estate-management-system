'use strict';

/**
 * refreshTokenModel.js
 * Server-side refresh token registry.
 *
 * Why SHA-256?
 *   We never store the raw token — only its hash.
 *   This means a database breach does not expose usable tokens,
 *   and the hash is still deterministic for lookup.
 *
 * Token lifecycle:
 *   1. login()    → storeToken()    — record the issued token
 *   2. refresh()  → rotateToken()   — revoke old, store new
 *   3. logout()   → revokeToken()   — mark token revoked
 *   4. refresh()  → verifyToken()   — confirm token is valid + not revoked
 *   5. (cron)     → pruneExpired()  — clean up expired rows (optional)
 */

const crypto  = require('crypto');
const { pool } = require('../config/database');
const logger  = require('../utils/logger');

/** Hash a raw token string → 64-char hex (SHA-256). */
function hash(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Parse a JWT's expiry from its payload without re-verifying the signature.
 * We only need `exp` to store the expiry in the DB — jwt.verify already
 * checked the signature before we call storeToken/rotateToken.
 */
function getExpiry(rawToken) {
  try {
    const [, payload] = rawToken.split('.');
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
    return decoded.exp ? new Date(decoded.exp * 1000) : null;
  } catch {
    return null;
  }
}

/**
 * Record a newly issued refresh token.
 * Called after successful login or register.
 */
async function storeToken(userId, rawToken) {
  const tokenHash = hash(rawToken);
  const expiresAt = getExpiry(rawToken) ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await pool.execute(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, revoked)
     VALUES (?, ?, ?, 0)
     ON DUPLICATE KEY UPDATE revoked = 0, expires_at = VALUES(expires_at)`,
    [userId, tokenHash, expiresAt]
  );
}

/**
 * Verify that a refresh token exists in the DB, is not revoked, and is not expired.
 * Returns true if the token is valid server-side, false otherwise.
 */
async function verifyToken(rawToken) {
  const tokenHash = hash(rawToken);

  const [rows] = await pool.execute(
    `SELECT id, revoked, expires_at FROM refresh_tokens
     WHERE token_hash = ?
     LIMIT 1`,
    [tokenHash]
  );

  if (!rows.length) return false;
  const row = rows[0];
  if (row.revoked) return false;
  if (new Date(row.expires_at) < new Date()) return false;
  return true;
}

/**
 * Revoke a specific refresh token.
 * Called on logout.
 */
async function revokeToken(rawToken) {
  const tokenHash = hash(rawToken);
  await pool.execute(
    'UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?',
    [tokenHash]
  );
}

/**
 * Revoke all refresh tokens for a user.
 * Called when: password change, account deactivation, admin force-logout.
 */
async function revokeAllForUser(userId) {
  await pool.execute(
    'UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?',
    [userId]
  );
}

/**
 * Rotate: revoke the old token and store the new one.
 * Called during token refresh to prevent refresh token reuse.
 *
 * Security guarantee: if the UPDATE affects 0 rows (token not found or
 * already revoked), rotation is aborted and an error is thrown.
 * This prevents issuing a new token when the old one cannot be revoked —
 * e.g., if a concurrent request already used/revoked the same token.
 */
async function rotateToken(userId, oldRawToken, newRawToken) {
  const oldHash   = hash(oldRawToken);
  const newHash   = hash(newRawToken);
  const expiresAt = getExpiry(newRawToken) ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Step 1: Revoke the old token.
  // We check affectedRows — if 0, the token was already revoked or never existed.
  // In that case we must NOT issue a new token (reuse/replay prevention).
  const [updateResult] = await pool.execute(
    'UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ? AND revoked = 0',
    [oldHash]
  );

  logger.debug(`[rotateToken] userId=${userId} oldHashPrefix=${oldHash.slice(0,8)} affectedRows=${updateResult.affectedRows}`);

  if (updateResult.affectedRows === 0) {
    // Token was already revoked or not found — refuse to issue a new one.
    // This is the correct behavior for replay attack prevention.
    logger.warn(`[rotateToken] BLOCKED — old token already revoked or not found userId=${userId} oldHashPrefix=${oldHash.slice(0,8)}`);
    const err = new Error('Refresh token already revoked or not found during rotation');
    err.status = 401;
    throw err;
  }

  // Step 2: Register the new token (only reached if old token was successfully revoked).
  await pool.execute(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, revoked)
     VALUES (?, ?, ?, 0)
     ON DUPLICATE KEY UPDATE revoked = 0, expires_at = VALUES(expires_at)`,
    [userId, newHash, expiresAt]
  );

  logger.debug(`[rotateToken] SUCCESS userId=${userId} newHashPrefix=${newHash.slice(0,8)}`);
}

/**
 * Remove expired tokens from the DB.
 * Only deletes rows where the token has passed its expiry date.
 * Revoked-but-not-yet-expired rows are kept until they naturally expire —
 * this preserves the rotation tombstone long enough that any late reuse
 * attempt still finds the row and correctly returns 401.
 * Optional maintenance — call from a scheduled job or on login.
 */
async function pruneExpired() {
  const [result] = await pool.execute(
    'DELETE FROM refresh_tokens WHERE expires_at < NOW()'
  );
  return result.affectedRows;
}

module.exports = { storeToken, verifyToken, revokeToken, revokeAllForUser, rotateToken, pruneExpired };
