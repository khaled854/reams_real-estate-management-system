import axios from 'axios';

/**
 * api.js
 * Central Axios instance.
 * — Attaches JWT Bearer token to every request.
 * — Handles 401s with a single silent token-refresh retry.
 * — Falls back to /login on refresh failure.
 *
 * baseURL = VITE_API_BASE_URL (set to '/api' in .env).
 * The Vite dev-server proxy forwards /api/* → http://localhost:5000,
 * so all requests stay same-origin in the browser — no CORS preflight.
 */

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  // 30 s for normal API calls.
  // Upload calls override this with timeout: 0 (no timeout) because
  // large video files can take several minutes on a LAN connection.
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
  // withCredentials=true sends HttpOnly cookies with cross-origin requests.
  // In production the SPA and API are same-origin, so cookies are sent
  // automatically. This flag is needed for the Vite dev-server proxy
  // scenario where port 3000 and port 5000 differ.
  withCredentials: true,
});

// ── Request interceptor ────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    // Read token from Zustand-persisted localStorage key
    const stored = localStorage.getItem('rems-auth');
    if (stored) {
      try {
        const { state } = JSON.parse(stored);
        if (state?.accessToken) {
          config.headers.Authorization = `Bearer ${state.accessToken}`;
        }
      } catch {
        // malformed storage — ignore
      }
    }
    if (import.meta.env.VITE_DEBUG_API === 'true') {
      console.warn(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor — silent refresh ──────────────────
let isRefreshing = false;
let pendingQueue = []; // queued requests waiting for a new token

function processQueue(error, token = null) {
  pendingQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  pendingQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status !== 401 || originalRequest._retried) {
      return Promise.reject(error);
    }

    // Don't retry the refresh endpoint itself
    if (originalRequest.url?.includes('/auth/refresh')) {
      clearAuthAndRedirect();
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Queue this request until the refresh completes
      return new Promise((resolve, reject) => {
        pendingQueue.push({
          resolve: (token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          },
          reject,
        });
      });
    }

    originalRequest._retried = true;
    isRefreshing = true;

    try {
      // The refresh token is sent automatically via the HttpOnly cookie.
      // We do NOT read or send it from localStorage — it lives in the
      // cookie exclusively and is never accessible to JavaScript.
      const res = await api.post(
        '/v1/auth/refresh',
        {} // empty body — token comes from HttpOnly cookie only
      );

      const { accessToken: newAccess } = res.data.data;

      // Persist new access token into Zustand's localStorage entry.
      // Only the access token is stored in localStorage — never the refresh token.
      const stored = localStorage.getItem('rems-auth');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed?.state) {
            parsed.state.accessToken = newAccess;
            localStorage.setItem('rems-auth', JSON.stringify(parsed));
          }
        } catch { /* non-fatal */ }
      }

      // Update the Zustand store in-memory.
      try {
        const storeState = _getAuthStore();
        if (storeState) storeState.refreshSession(newAccess);
      } catch { /* non-fatal — token already persisted in localStorage */ }

      originalRequest.headers.Authorization = `Bearer ${newAccess}`;
      processQueue(null, newAccess);
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      clearAuthAndRedirect();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

function clearAuthAndRedirect() {
  const stored = localStorage.getItem('rems-auth');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed?.state) {
        parsed.state.user            = null;
        parsed.state.accessToken     = null;
        parsed.state.isAuthenticated = false;
        localStorage.setItem('rems-auth', JSON.stringify(parsed));
      }
    } catch { /* ignore */ }
  }
  if (window.location.pathname !== '/login') {
    window.location.replace('/login');
  }
}

export default api;

/**
 * Late-binding accessor for the auth store.
 * Avoids circular dependency at module init time while still allowing
 * the refresh interceptor to call refreshSession().
 * The store module is always loaded before the interceptor fires.
 *
 * Uses a global reference set during store initialisation rather than
 * require() (which is not available in ESM / Vite builds).
 */
function _getAuthStore() {
  try {
    // Access the Zustand store via its exported getState directly.
    // We import authStore at the top of authService.js, but api.js cannot
    // import it at module level without a circular reference.
    // The store registers itself on window.__remsAuthStore during init
    // only if this accessor exists — see authStore.js bootstrapStore().
    return window.__remsAuthStore?.getState?.() ?? null;
  } catch {
    return null;
  }
}
