'use strict';

const bcrypt         = require('bcryptjs');
const jwt            = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const userModel         = require('../models/userModel');
const refreshTokenModel = require('../models/refreshTokenModel');
const AppError          = require('../utils/AppError');
const asyncHandler      = require('../utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../utils/response');
const { logActivity }   = require('../utils/activityLogger');

/* ── Token helpers ────────────────────────────────────────── */
function signAccessToken(payload) {
  return jwt.sign(
    { ...payload, jti: uuidv4() }, // unique JWT ID per issuance
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

function signRefreshToken(payload) {
  return jwt.sign(
    { ...payload, jti: uuidv4() }, // unique JWT ID prevents token reuse when issued in the same second
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
}

/**
 * Build the JWT payload from a user object.
 * `user.name` is the virtual CONCAT alias produced by userModel.
 */
function buildTokenPayload(user) {
  return {
    id:    user.id,
    uuid:  user.uuid,
    email: user.email,
    role:  user.role,
    name:  user.name,
  };
}

/* ── Cookie helpers ───────────────────────────────────────── */
const REFRESH_COOKIE = 'rems_rt'; // cookie name

/**
 * Refresh-token lifetime in milliseconds.
 * Parsed from JWT_REFRESH_EXPIRES_IN (defaults to 7d).
 */
function refreshTokenMaxAge() {
  const raw = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  const match = raw.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // 7 days default
  const n = parseInt(match[1], 10);
  const unit = match[2];
  const multiplier = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[unit] || 86400000;
  return n * multiplier;
}

/**
 * Set the HttpOnly refresh-token cookie.
 *
 * Cookie security properties:
 *   httpOnly  = true  → JS cannot read document.cookie for this token
 *   secure    = true in production (HTTPS), false on plain-HTTP LAN
 *   sameSite  = 'strict' — browser only sends cookie for same-origin requests
 *   path      = '/api/v1/auth' — only sent to auth endpoints, not every API call
 *
 * SameSite=strict note: because the SPA and API are on the SAME origin
 * (http://SERVER_IP:5000 for both), strict mode works correctly.
 * If the SPA were on a different domain this would need 'lax' or 'none+secure'.
 */
function setRefreshCookie(res, token) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure:   isProd && process.env.FORCE_HTTPS === 'true', // only true when HTTPS available
    sameSite: 'strict',
    path:     '/api/v1/auth',
    maxAge:   refreshTokenMaxAge(),
  });
}

/** Clear the refresh-token cookie (logout). */
function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    sameSite: 'strict',
    path:     '/api/v1/auth',
  });
}

/**
 * Read refresh token from the HttpOnly cookie.
 *
 * We do NOT accept the refresh token from the request body.
 * Accepting it from the body would allow JavaScript to supply
 * (or tamper with) the token, defeating the purpose of HttpOnly.
 *
 * Browser clients: token is sent automatically via the cookie.
 * API clients (Postman, curl): must send the token as a cookie header.
 *   In Postman: Settings → Cookies → manually set the rems_rt cookie.
 *   With curl: --cookie "rems_rt=<token>"
 *
 * The refresh token is NEVER accepted from req.body.
 */
function readRefreshToken(req) {
  return req.cookies?.[REFRESH_COOKIE] || null;
}

/**
 * Split a "Full Name" string into first_name / last_name.
 * "Ahmed Al-Rashid" → { first_name: "Ahmed", last_name: "Al-Rashid" }
 * "Admin"           → { first_name: "Admin", last_name: "" }
 */
function splitName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/);
  return {
    first_name: parts[0]               || '',
    last_name:  parts.slice(1).join(' ') || '',
  };
}

/* ─────────────────────────────────────────────────────────────
   POST /api/v1/auth/register
   ─────────────────────────────────────────────────────────────
   Security rules:
   1. If NO admin exists yet  → allow one unauthenticated bootstrap
      registration.  The caller may choose any role (they are the
      first admin).
   2. If admins already exist → an admin JWT is required, AND role
      is always 'employee' regardless of what the body says.
   3. Generic 409 for duplicate emails (no user enumeration).
   ───────────────────────────────────────────────────────────── */
const register = asyncHandler(async (req, res) => {
  // Joi validation already ran; req.body is sanitised.
  // Validator passes a single `name` field — split it here.
  const { name, email, password, phone } = req.body;

  // ── Bootstrap check ──────────────────────────────────────
  const adminCount  = await userModel.countByRole('admin');
  const isBootstrap = adminCount === 0;

  // After bootstrap, only admins may create accounts
  if (!isBootstrap) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication required', 401);
    }
    try {
      const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
      if (decoded.role !== 'admin') {
        throw new AppError('Only administrators can create new accounts', 403);
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError('Invalid or expired token', 401);
    }
  }

  // ── Role assignment ───────────────────────────────────────
  // Bootstrap → caller may choose any role (they're the first admin).
  // Normal    → always 'employee'; managers/admins are created via /users.
  const role = isBootstrap ? (req.body.role || 'admin') : 'employee';

  // ── Duplicate email check ─────────────────────────────────
  const existing = await userModel.findByEmail(email);
  if (existing) {
    throw new AppError('An account with that email address already exists', 409);
  }

  // ── Hash password & create user ───────────────────────────
  const passwordHash          = await bcrypt.hash(password, 12);
  const { first_name, last_name } = splitName(name);

  const user = await userModel.create({
    uuid: uuidv4(),
    first_name,
    last_name,
    email,
    passwordHash,   // userModel.create() inserts this into password_hash column
    role,
    phone,
  });

  await logActivity(req, {
    action:      'user.registered',
    description: `Account created: ${user.name} (${role})${isBootstrap ? ' [bootstrap]' : ''}`,
    entity_type: 'users',
    entity_id:   user.id,
  });

  const accessToken  = signAccessToken(buildTokenPayload(user));
  const refreshToken = signRefreshToken(buildTokenPayload(user));

  // Register the refresh token server-side so it can be revoked on logout
  await refreshTokenModel.storeToken(user.id, refreshToken);

  // Set HttpOnly cookie for the refresh token.
  // The refresh token is ONLY sent as an HttpOnly cookie — never in the JSON body.
  // Sending it in the body would expose it to JavaScript and allow localStorage storage,
  // defeating the purpose of HttpOnly.
  setRefreshCookie(res, refreshToken);

  sendCreated(res, {
    message: 'Account created successfully',
    data: { user, accessToken },
  });
});

/* ── POST /api/v1/auth/login ──────────────────────────────── */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // findByEmail returns the full row including password_hash
  const user = await userModel.findByEmail(email);

  // Constant-time comparison even when user not found (prevents timing attacks)
  const dummyHash = '$2a$12$dummy.hash.for.timing.protection.only.xxxxxxxxxxxxxxxxx';
  // DB column is password_hash; userModel normaliseRow keeps it as-is
  const hash    = user?.password_hash ?? dummyHash;
  const isMatch = await bcrypt.compare(password, hash);

  if (!user || !isMatch) {
    throw new AppError('Invalid email or password', 401);
  }
  if (!user.is_active) {
    throw new AppError('This account has been deactivated. Please contact your administrator.', 403);
  }

  await userModel.recordLogin(user.id);
  await logActivity(req, {
    user_id:     user.id,
    action:      'user.login',
    description: `User logged in: ${user.name}`,
    entity_type: 'users',
    role:        user.role,
    entity_id:   user.id,
  });

  // Strip password_hash before sending to client
  const { password_hash: _pw, ...safeUser } = user;

  const accessToken  = signAccessToken(buildTokenPayload(safeUser));
  const refreshToken = signRefreshToken(buildTokenPayload(safeUser));

  // Register the refresh token server-side so it can be revoked on logout.
  // Prune expired/revoked tokens opportunistically on each login.
  await refreshTokenModel.storeToken(safeUser.id, refreshToken);
  refreshTokenModel.pruneExpired().catch(() => {}); // fire-and-forget, non-critical

  // Set HttpOnly cookie for the refresh token.
  // The refresh token is ONLY sent as an HttpOnly cookie — never in the JSON body.
  // Sending it in the body would expose it to JavaScript and allow localStorage storage,
  // defeating the purpose of HttpOnly.
  setRefreshCookie(res, refreshToken);

  sendSuccess(res, {
    message: 'Login successful',
    data: { user: safeUser, accessToken },
  });
});

/* ── POST /api/v1/auth/refresh ────────────────────────────── */
const refresh = asyncHandler(async (req, res) => {
  // Accept token from HttpOnly cookie (preferred) or request body (API clients)
  const refreshToken = readRefreshToken(req);
  if (!refreshToken) throw new AppError('Refresh token is required', 400);

  // ── Step 1: Verify JWT signature and expiry ───────────────
  let decoded;
  try {
    decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
    );
  } catch {
    clearRefreshCookie(res);
    throw new AppError('Invalid or expired refresh token', 401);
  }

  // ── Step 2: Check server-side revocation registry ─────────
  const isValid = await refreshTokenModel.verifyToken(refreshToken);
  if (!isValid) {
    // Token was revoked (logout) or not registered (forged/old token)
    clearRefreshCookie(res);
    throw new AppError('Refresh token has been revoked', 401);
  }

  // ── Step 3: Ensure the user still exists and is active ────
  const user = await userModel.findById(decoded.id);
  if (!user || !user.is_active) {
    clearRefreshCookie(res);
    throw new AppError('User not found or deactivated', 401);
  }

  const accessToken     = signAccessToken(buildTokenPayload(user));
  const newRefreshToken = signRefreshToken(buildTokenPayload(user));

  // ── Step 4: Rotate — revoke old token, register new one ───
  await refreshTokenModel.rotateToken(user.id, refreshToken, newRefreshToken);

  // Set updated HttpOnly cookie — new refresh token is cookie-only
  setRefreshCookie(res, newRefreshToken);

  sendSuccess(res, {
    message: 'Token refreshed',
    data: { accessToken },
  });
});

/* ── GET /api/v1/auth/me ──────────────────────────────────── */
const getMe = asyncHandler(async (req, res) => {
  const user = await userModel.findById(req.user.id);
  if (!user) throw new AppError('User not found', 404);
  sendSuccess(res, { data: user });
});

/* ── POST /api/v1/auth/change-password ───────────────────── */
const changePassword = asyncHandler(async (req, res) => {
  const { current_password, new_password } = req.body;

  // Need password_hash for comparison → use findByEmail
  const userWithPw = await userModel.findByEmail(req.user.email);
  if (!userWithPw) throw new AppError('User not found', 404);

  // DB column is password_hash
  const isMatch = await bcrypt.compare(current_password, userWithPw.password_hash);
  if (!isMatch) throw new AppError('Current password is incorrect', 400);

  // Prevent reuse of the same password
  const isSame = await bcrypt.compare(new_password, userWithPw.password_hash);
  if (isSame) {
    throw new AppError('New password must differ from the current password', 400);
  }

  const newHash = await bcrypt.hash(new_password, 12);
  await userModel.updatePassword(req.user.id, newHash);

  // Revoke all existing refresh tokens — forces re-login on all devices
  // after a password change (best practice: new password = new session)
  await refreshTokenModel.revokeAllForUser(req.user.id);

  await logActivity(req, {
    action:      'user.password_changed',
    description: `Password changed: ${req.user.name}`,
    entity_type: 'users',
    entity_id:   req.user.id,
  });

  sendSuccess(res, { message: 'Password changed successfully' });
});

/* ── POST /api/v1/auth/logout ─────────────────────────────── */
const logout = asyncHandler(async (req, res) => {
  // Read refresh token from cookie (HttpOnly) or body (API clients)
  const refreshToken = readRefreshToken(req);
  if (refreshToken) {
    await refreshTokenModel.revokeToken(refreshToken);
  } else {
    // No token provided — revoke all sessions for this user (safe fallback)
    await refreshTokenModel.revokeAllForUser(req.user.id);
  }

  // Clear the HttpOnly cookie
  clearRefreshCookie(res);

  await logActivity(req, {
    action:      'user.logout',
    description: `User logged out: ${req.user.name}`,
    entity_type: 'users',
    entity_id:   req.user.id,
  });

  sendSuccess(res, { message: 'Logged out successfully' });
});

module.exports = { register, login, refresh, getMe, changePassword, logout };
