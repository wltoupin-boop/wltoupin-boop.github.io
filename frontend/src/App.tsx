import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { TherapyCatalogPage } from '@/pages/TherapyCatalogPage';
import { TherapyDetailPage } from '@/pages/TherapyDetailPage';
import { WatchlistPage } from '@/pages/WatchlistPage';
import { PipelinePage } from '@/pages/PipelinePage';
import { InstitutionDashboardPage } from '@/pages/InstitutionDashboardPage';
import { OperationalTrackerPage } from '@/pages/OperationalTrackerPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { AdminPage } from '@/pages/AdminPage';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { useAuth } from '@/hooks/useAuth';

// ─── Auth guard ───────────────────────────────────────────────────────────────
interface RequireAuthProps {
  children: React.ReactNode;
}

const RequireAuth: React.FC<RequireAuthProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullPageSpinner label="Authenticating…" />;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

// ─── Admin guard ──────────────────────────────────────────────────────────────
const RequireAdmin: React.FC<RequireAuthProps> = ({ children }) => {
  const { isAdmin, isLoading } = useAuth();

  if (isLoading) return <FullPageSpinner />;

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

// ─── Redirect if already authed ───────────────────────────────────────────────
const RedirectIfAuthed: React.FC<RequireAuthProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <FullPageSpinner />;

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

// ─── App ──────────────────────────────────────────────────────────────────────
export const App: React.FC = () => {
  return (
    <Routes>
      {/* Public */}
      <Route
        path="/login"
        element={
          <RedirectIfAuthed>
            <LoginPage />
          </RedirectIfAuthed>
        }
      />

      {/* Protected */}
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="catalog" element={<TherapyCatalogPage />} />
        <Route path="catalog/:id" element={<TherapyDetailPage />} />
        <Route path="watchlist" element={<WatchlistPage />} />
        <Route path="pipeline" element={<PipelinePage />} />
        <Route path="institution" element={<InstitutionDashboardPage />} />
        <Route path="operational" element={<OperationalTrackerPage />} />
        <Route path="settings" element={<SettingsPage />} />

        {/* Admin-only */}
        <Route
          path="admin"
          element={
            <RequireAdmin>
              <AdminPage />
            </RequireAdmin>
          }
        />

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
};
