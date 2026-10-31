import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import useAuthStore from '@store/authStore';
import ProtectedRoute from '@components/common/ProtectedRoute';
import MainLayout     from '@components/layout/MainLayout';

// Public pages
import LoginPage from '@pages/LoginPage';

// Common pages
import DashboardPage    from '@pages/DashboardPage';
import ReportsPage      from '@pages/ReportsPage';
import UsersPage        from '@pages/UsersPage';
import NotFoundPage     from '@pages/NotFoundPage';
import UnauthorizedPage from '@pages/UnauthorizedPage';

// ── Properties module ────────────────────────────────────────
import PropertiesPage      from '@features/properties/pages/PropertiesPage';
import PropertyDetailsPage from '@features/properties/pages/PropertyDetailsPage';
import AddPropertyPage     from '@features/properties/pages/AddPropertyPage';
import EditPropertyPage    from '@features/properties/pages/EditPropertyPage';

// ── Customers module ─────────────────────────────────────────
import CustomersPage       from '@features/customers/pages/CustomersPage';
import CustomerDetailsPage from '@features/customers/pages/CustomerDetailsPage';
import AddCustomerPage     from '@features/customers/pages/AddCustomerPage';
import EditCustomerPage    from '@features/customers/pages/EditCustomerPage';

// ── Appointments module ───────────────────────────────────────
import AppointmentsPage       from '@features/appointments/pages/AppointmentsPage';
import AppointmentDetailsPage from '@features/appointments/pages/AppointmentDetailsPage';
import AddAppointmentPage     from '@features/appointments/pages/AddAppointmentPage';

function App() {
  const loadUser = useAuthStore((s) => s.loadUser);
  useEffect(() => { loadUser(); }, []); // eslint-disable-line

  return (
    <Routes>
      {/* ── Public ────────────────────────────────────────── */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/403"   element={<UnauthorizedPage />} />

      {/* ── Authenticated ─────────────────────────────────── */}
      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />

          {/* Properties */}
          <Route path="/properties"          element={<PropertiesPage />} />
          <Route path="/properties/new"      element={<AddPropertyPage />} />
          <Route path="/properties/:id"      element={<PropertyDetailsPage />} />
          <Route path="/properties/:id/edit" element={<EditPropertyPage />} />

          {/* Customers */}
          <Route path="/customers"          element={<CustomersPage />} />
          <Route path="/customers/new"      element={<AddCustomerPage />} />
          <Route path="/customers/:id"      element={<CustomerDetailsPage />} />
          <Route path="/customers/:id/edit" element={<EditCustomerPage />} />

          {/* Appointments */}
          <Route path="/appointments"      element={<AppointmentsPage />} />
          <Route path="/appointments/new"  element={<AddAppointmentPage />} />
          <Route path="/appointments/:id"  element={<AppointmentDetailsPage />} />

          {/* Reports */}
          <Route path="/reports" element={<ReportsPage />} />

          {/* Users — admin only (backend enforces authorize('admin') on all /users routes) */}
          <Route path="/users" element={<UsersPage />} />

          {/* Future modules */}
          {/* <Route path="/contracts/*" element={<ContractsRoutes />} /> */}
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
