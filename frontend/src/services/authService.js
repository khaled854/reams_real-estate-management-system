import api from './api';

/**
 * authService.js
 * All API calls that touch /api/v1/auth
 * Every function returns the `data` payload from the response envelope.
 */

/** POST /auth/login */
export async function loginRequest(email, password) {
  const res = await api.post('/v1/auth/login', { email, password });
  return res.data.data; // { user, accessToken } — refreshToken is HttpOnly cookie only
}

/** POST /auth/logout */
export async function logoutRequest() {
  // Refresh token is revoked server-side via the HttpOnly cookie.
  // Never include it in the request body.
  const res = await api.post('/v1/auth/logout', {});
  return res.data;
}

/** GET /auth/me */
export async function getMeRequest() {
  const res = await api.get('/v1/auth/me');
  return res.data.data; // user object
}

/** POST /auth/refresh */
export async function refreshTokenRequest() {
  // Refresh token is sent via HttpOnly cookie automatically.
  // Never include it in the request body.
  const res = await api.post('/v1/auth/refresh', {});
  return res.data.data; // { accessToken } — new refreshToken is set as HttpOnly cookie by server
}

/** POST /auth/change-password */
export async function changePasswordRequest(currentPassword, newPassword) {
  const res = await api.post('/v1/auth/change-password', {
    current_password: currentPassword,
    new_password:     newPassword,
  });
  return res.data;
}
