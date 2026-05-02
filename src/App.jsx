import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';
import WorkspacePage from './pages/WorkspacePage';
import WorksPage from './pages/WorksPage';
import CreateBookPage from './pages/CreateBookPage';
import ActivityPlanPage from './pages/ActivityPlanPage';
import PricingPage from './pages/PricingPage';
import CreditsInfoPage from './pages/CreditsInfoPage';
import OnboardingPage from './pages/OnboardingPage';
import PendingReviewPage from './pages/PendingReviewPage';
import SharePresentPage from './pages/SharePresentPage';
import ShareDetailPage from './pages/ShareDetailPage';
import MaterialsPage from './pages/MaterialsPage';
import PersonalCenterPage from './pages/PersonalCenterPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import HelpPage from './pages/HelpPage';
import AppShell from './components/AppShell';
import { Loader2 } from './components/Icons';

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7]">
      <Loader2 className="w-8 h-8 text-[#0071E3] animate-spin" />
    </div>
  );
}

function ProtectedLayout() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;

  if (user.status === 'pending_profile') {
    return <Navigate to="/onboarding" replace />;
  }
  if (user.status === 'pending_review' || user.status === 'rejected' || user.status === 'disabled') {
    return <Navigate to="/pending-review" replace />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

/**
 * 已登录但尚未通过审核的用户专用布局，没有侧栏。
 * 未登录直接回登录页；已激活的用户自动送回首页。
 */
function OnboardingLayout() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.status === 'active') return <Navigate to="/" replace />;
  return <Outlet />;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (user) {
    if (user.status === 'pending_profile') return <Navigate to="/onboarding" replace />;
    if (user.status === 'pending_review' || user.status === 'rejected' || user.status === 'disabled') {
      return <Navigate to="/pending-review" replace />;
    }
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
          <Route path="/share/:bookId" element={<SharePresentPage />} />
          <Route path="/share/:bookId/detail" element={<ShareDetailPage />} />

          <Route element={<OnboardingLayout />}>
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/pending-review" element={<PendingReviewPage />} />
          </Route>

          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/me" element={<PersonalCenterPage />} />
            <Route path="/me/password" element={<ChangePasswordPage />} />
            <Route path="/workspace/:bookId" element={<WorkspacePage />} />
            <Route path="/works" element={<WorksPage />} />
            <Route path="/history" element={<WorksPage initialTab="plans" />} />
            <Route path="/create" element={<CreateBookPage />} />
            <Route path="/creation-history" element={<WorksPage initialTab="pending" />} />
            <Route path="/activity-plans/:planId" element={<ActivityPlanPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/credits" element={<CreditsInfoPage />} />
            <Route path="/materials" element={<MaterialsPage />} />
            <Route path="/help" element={<HelpPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
