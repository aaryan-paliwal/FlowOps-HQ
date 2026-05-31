import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import WorkspaceLayout from './ui/WorkspaceLayout';
import { useAuthStore } from './state/authStore';
import { useOrgStore } from './state/orgStore';
import { authService } from './services/api';
import GlobalCursorGlow from './ui/GlobalCursorGlow';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const ManagedApisPage = lazy(() => import('./pages/ManagedApisPage'));
const AIGatewaysPage = lazy(() => import('./pages/AIGatewaysPage'));
const AccessTokensPage = lazy(() => import('./pages/AccessTokensPage'));
const LiveLogsPage = lazy(() => import('./pages/LiveLogsPage'));
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const OnboardingPage = lazy(() => import('./pages/auth/OnboardingPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const BillingUpgradePage = lazy(() => import('./pages/BillingUpgradePage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const DocsPage = lazy(() => import('./pages/DocsPage'));

function PageLoader() {
  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
      <div className="h-8 w-8 rounded-full border-2 border-white/10 border-t-cyan-400 animate-spin" />
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, token } = useAuthStore();
  if (!isAuthenticated && !token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

// Redirects bare routes (e.g. /dashboard) to /ws/:activeOrgSlug/dashboard
function WorkspaceRedirect({ to }) {
  const { organisations, activeOrgId } = useOrgStore();
  const activeOrg = organisations.find(o => o.id === activeOrgId) || organisations[0];
  return <Navigate to={`/ws/${activeOrg?.slug || 'workspace'}/${to}`} replace />;
}

export default function App() {
  const location = useLocation();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register' || location.pathname === '/' || location.pathname === '/onboarding';
  const isDocsPage = location.pathname.startsWith('/docs');
  const { token, user, setAuth, logout } = useAuthStore();

  useEffect(() => {
    if (token && !user) {
      authService.getProfile()
        .then(res => {
          if (res.success && res.data) {
            setAuth(token, res.data);
          } else {
            logout();
          }
        })
        .catch(() => {
          logout();
        });
    }
  }, [token, user, setAuth, logout]);

  if (isDocsPage) {
    return (
      <>
        <GlobalCursorGlow />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/docs/:sectionId" element={<DocsPage />} />
            <Route path="/docs" element={<Navigate to="/docs/introduction" replace />} />
          </Routes>
        </Suspense>
      </>
    );
  }

  // Handle pure auth/marketing routes outside layout
  if (isAuthPage) {
    return (
      <>
        <GlobalCursorGlow />
        <div className="min-h-screen text-white">
          <main>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
              </Routes>
            </Suspense>
          </main>
        </div>
      </>
    );
  }

  return (
    <>
      <GlobalCursorGlow />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Workspace routes with layout */}
          <Route path="/ws/:orgSlug" element={<ProtectedRoute><WorkspaceLayout /></ProtectedRoute>}>
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="workspace" element={<ManagedApisPage />} />
            <Route path="ai-gateways" element={<AIGatewaysPage />} />
            <Route path="keys" element={<AccessTokensPage />} />
            <Route path="logs" element={<LiveLogsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="billing/upgrade" element={<BillingUpgradePage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="contact" element={<ContactPage />} />
            <Route index element={<Navigate to="dashboard" replace />} />
          </Route>

          {/* Legacy Redirects - if user hits /dashboard, auto redirect to /ws/:slug/dashboard */}
          <Route path="/dashboard" element={<ProtectedRoute><WorkspaceRedirect to="dashboard" /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><WorkspaceRedirect to="analytics" /></ProtectedRoute>} />
          <Route path="/workspace" element={<ProtectedRoute><WorkspaceRedirect to="workspace" /></ProtectedRoute>} />
          <Route path="/ai-gateways" element={<ProtectedRoute><WorkspaceRedirect to="ai-gateways" /></ProtectedRoute>} />
          <Route path="/keys" element={<ProtectedRoute><WorkspaceRedirect to="keys" /></ProtectedRoute>} />
          <Route path="/logs" element={<ProtectedRoute><WorkspaceRedirect to="logs" /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><WorkspaceRedirect to="settings" /></ProtectedRoute>} />
          <Route path="/billing/upgrade" element={<ProtectedRoute><WorkspaceRedirect to="billing/upgrade" /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><WorkspaceRedirect to="profile" /></ProtectedRoute>} />
          <Route path="/contact" element={<ProtectedRoute><WorkspaceRedirect to="contact" /></ProtectedRoute>} />
          
          {/* Catch-all */}
          <Route path="*" element={<Navigate to={token ? "/dashboard" : "/login"} replace />} />
        </Routes>
      </Suspense>
    </>
  );
}
