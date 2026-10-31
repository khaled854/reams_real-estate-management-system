import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '@store/authStore';
import Spinner from './Spinner';

/**
 * ProtectedRoute
 * Wraps any route that requires authentication.
 * Optionally enforces a specific role.
 *
 * Usage:
 *   <Route element={<ProtectedRoute />}>
 *     ...authenticated pages...
 *   </Route>
 *
 *   <Route element={<ProtectedRoute requiredRole="admin" />}>
 *     ...admin-only pages...
 *   </Route>
 *
 * Behaviour:
 *   1. isLoading  → shows a full-screen spinner while loadUser() runs
 *   2. !isAuthenticated → redirects to /login (saves intended path in state)
 *   3. requiredRole provided but doesn't match → redirects to /403
 *   4. All checks pass → renders <Outlet />
 */
import { Outlet } from 'react-router-dom';

function ProtectedRoute({ requiredRole }) {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const location = useLocation();

  // Still initialising (loadUser in progress)
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" color="primary" />
          <p className="text-sm text-dark-400 font-medium">Loading session…</p>
        </div>
      </div>
    );
  }

  // Not authenticated — redirect to login, saving the original destination
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Role check — redirect to an "access denied" page if role doesn't match
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/403" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
