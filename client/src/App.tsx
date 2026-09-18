import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { LoadingPanel } from '@/components/ui/feedback';
import { AppShell } from '@/layouts/AppShell';
import { AuthLayout } from '@/layouts/AuthLayout';
import { PublicLayout } from '@/layouts/PublicLayout';
import { TripWorkspaceLayout } from '@/layouts/TripWorkspaceLayout';
import { AdminRoute, ProtectedRoute, PublicOnlyRoute } from '@/components/auth/RouteGuards';

/**
 * Route table (Section 6).
 *
 * Every page is code-split, so the landing page does not pay for the charts used
 * by the budget and admin screens (Section 45). Layouts are imported eagerly
 * because they are needed on nearly every route and are small.
 */

const LandingPage = lazy(() => import('@/pages/LandingPage'));
const DiscoverPage = lazy(() => import('@/pages/discover/DiscoverPage'));
const CityDetailPage = lazy(() => import('@/pages/discover/CityDetailPage'));
const SharedTripPage = lazy(() => import('@/pages/SharedTripPage'));

const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const SignupPage = lazy(() => import('@/pages/auth/SignupPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'));

const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const MyTripsPage = lazy(() => import('@/pages/trips/MyTripsPage'));
const CreateTripPage = lazy(() => import('@/pages/trips/CreateTripPage'));
const TripOverviewPage = lazy(() => import('@/pages/trips/TripOverviewPage'));
const ItineraryBuilderPage = lazy(() => import('@/pages/trips/ItineraryBuilderPage'));
const BudgetPage = lazy(() => import('@/pages/trips/BudgetPage'));
const CalendarPage = lazy(() => import('@/pages/trips/CalendarPage'));
const EditTripPage = lazy(() => import('@/pages/trips/EditTripPage'));

const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const SavedDestinationsPage = lazy(() => import('@/pages/SavedDestinationsPage'));
const AdminAnalyticsPage = lazy(() => import('@/pages/admin/AdminAnalyticsPage'));

const UnauthorizedPage = lazy(() => import('@/pages/UnauthorizedPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

export default function App() {
  return (
    <Suspense fallback={<LoadingPanel label="Loading GlobeTrotter…" className="min-h-dvh" />}>
      <Routes>
        {/* ── Public ── */}
        <Route element={<PublicLayout />}>
          <Route index element={<LandingPage />} />
          <Route path="discover" element={<DiscoverPage />} />
          <Route path="city/:cityId" element={<CityDetailPage />} />
          <Route path="shared/:slug" element={<SharedTripPage />} />
          <Route path="unauthorized" element={<UnauthorizedPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* ── Signed out only ── */}
        <Route element={<PublicOnlyRoute />}>
          <Route element={<AuthLayout />}>
            <Route path="login" element={<LoginPage />} />
            <Route path="signup" element={<SignupPage />} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
            <Route path="reset-password" element={<ResetPasswordPage />} />
          </Route>
        </Route>

        {/* ── Signed in ── */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="trips" element={<MyTripsPage />} />
            <Route path="trips/create" element={<CreateTripPage />} />
            <Route path="trips/:tripId" element={<TripWorkspaceLayout />}>
              <Route index element={<TripOverviewPage />} />
              <Route path="itinerary" element={<ItineraryBuilderPage />} />
              <Route path="budget" element={<BudgetPage />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="edit" element={<EditTripPage />} />
            </Route>
            <Route path="profile" element={<ProfilePage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="saved" element={<SavedDestinationsPage />} />

            {/* Admin-only (Section 25). */}
            <Route element={<AdminRoute />}>
              <Route path="admin" element={<Navigate to="/admin/analytics" replace />} />
              <Route path="admin/analytics" element={<AdminAnalyticsPage />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
