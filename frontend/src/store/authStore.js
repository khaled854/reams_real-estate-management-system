import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { loginRequest, logoutRequest, getMeRequest } from '../services/authService';

/**
 * authStore.js
 * Global authentication store (Zustand + localStorage persistence).
 *
 * State shape:
 *   user             — full user object from /auth/me
 *   accessToken      — JWT access token string (short-lived, 8h)
 *   isAuthenticated  — boolean convenience flag
 *   isLoading        — true while a login/logout/init request is in flight
 *   error            — last auth error message (cleared on next action)
 *
 * The REFRESH TOKEN is intentionally NOT stored here or in localStorage.
 * It lives exclusively in an HttpOnly cookie set by the server.
 * JavaScript (including this store) cannot read or write it — that is
 * the security guarantee. The browser sends it automatically on every
 * request to /api/v1/auth/*.
 *
 * Roles stored in user.role:
 *   'admin'    — full access
 *   'employee' — limited access (own records only)
 */
const useAuthStore = create(
  persist(
    (set, get) => ({
      // ── State ───────────────────────────────────────────
      user:            null,
      accessToken:     null,
      isAuthenticated: false,
      isLoading:       false,
      error:           null,

      // ── Actions ─────────────────────────────────────────

      /**
       * login(email, password)
       * Calls POST /auth/login, stores user + access token, returns user.
       * The server sets the refresh token as an HttpOnly cookie automatically.
       */
      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const { user, accessToken } = await loginRequest(email, password);
          set({
            user,
            accessToken,
            isAuthenticated: true,
            isLoading:       false,
            error:           null,
          });
          return user;
        } catch (err) {
          const msg = err.response?.data?.message || 'Login failed. Please try again.';
          set({ isLoading: false, error: msg, isAuthenticated: false });
          throw new Error(msg);
        }
      },

      /**
       * logout()
       * Calls POST /auth/logout — server revokes the refresh token
       * via the HttpOnly cookie, then clears local state.
       */
      logout: async () => {
        set({ isLoading: true });
        try {
          // The server reads the refresh token from the HttpOnly cookie.
          // We do NOT send it in the body — that would expose it to JS.
          await logoutRequest();
        } catch {
          // Even if the server call fails, clear the client session.
        } finally {
          set({
            user:            null,
            accessToken:     null,
            isAuthenticated: false,
            isLoading:       false,
            error:           null,
          });
        }
      },

      /**
       * refreshSession(newAccessToken)
       * Called by the Axios interceptor after a successful token refresh.
       * Only the access token is updated here — the server has already
       * rotated the HttpOnly cookie for the new refresh token.
       */
      refreshSession: (newAccessToken) => {
        set({ accessToken: newAccessToken });
      },

      /**
       * loadUser()
       * Calls GET /auth/me to re-hydrate user data from the server.
       * Called on app start when an accessToken already exists in storage.
       *
       * Only clears the session for authentication errors (401/403).
       * Network errors, server errors (5xx), or temporary unavailability
       * do NOT log the user out — the stored token remains valid.
       */
      loadUser: async () => {
        if (!get().accessToken) return;
        set({ isLoading: true });
        try {
          const user = await getMeRequest();
          set({ user, isAuthenticated: true, isLoading: false });
        } catch {
          // ANY error during initial user load (401, 403, 400 from refresh
          // failure, network error) should silently clear the session.
          // The user will be redirected to /login by the axios interceptor
          // or will simply see the login page. No error toast should show.
          set({
            user:            null,
            accessToken:     null,
            isAuthenticated: false,
            isLoading:       false,
          });
        }
      },

      /**
       * setUser(user)
       * Update user profile in store after a profile edit.
       */
      setUser: (user) => set({ user }),

      /** Clear any auth error message. */
      clearError: () => set({ error: null }),
    }),
    {
      name:    'rems-auth',
      storage: createJSONStorage(() => localStorage),
      // Only these fields survive page reload.
      // refreshToken is intentionally excluded — it is cookie-only.
      partialize: (state) => ({
        user:            state.user,
        accessToken:     state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Expose the store on window so api.js can call refreshSession()
// without creating a circular import (api.js ← authService.js ← authStore.js).
// This is only set in a browser environment (not SSR / Node).
if (typeof window !== 'undefined') {
  window.__remsAuthStore = useAuthStore;
}

export default useAuthStore;
