import { useState, useCallback, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import './App.css';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import FundFocus from './pages/FundFocus';
import ConnectPage from './pages/ConnectPage';
import OAuthCallback from './pages/OAuthCallback';
import Pipeline from './pages/Pipeline';
import ReviewMode from './pages/ReviewMode';
import Onboarding from './pages/Onboarding';
import Contacts from './pages/Contacts';
import PrivacyPage from './pages/PrivacyPage';
import AppLayout from './components/AppLayout';
import { Toaster } from './components/ui/sonner';
import { getMe, logout } from './lib/api';

function getActivePage(pathname) {
  if (pathname === '/') return 'dashboard';
  if (pathname.startsWith('/pipeline')) return 'pipeline';
  if (pathname.startsWith('/review')) return 'review';
  if (pathname.startsWith('/contacts')) return 'contacts';
  if (pathname.startsWith('/settings')) return 'settings';
  return 'dashboard';
}

function AuthenticatedLayout({ user, onLogout, children }) {
  const location = useLocation();
  const activePage = getActivePage(location.pathname);
  return (
    <AppLayout user={user} onLogout={onLogout} activePage={activePage}>
      {children}
    </AppLayout>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Verify auth via httpOnly cookie — no localStorage token needed.
  const refreshUser = useCallback(async () => {
    try {
      const data = await getMe();
      setUser(data || null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refreshUser(); }, [refreshUser]);

  const handleLogout = useCallback(async () => {
    localStorage.removeItem('vc_token'); // clear legacy token
    try { await logout(); } catch { /* ignore */ }
    setUser(null);
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center" style={{ background: '#080810' }}>
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-full border-2 border-[#7c6dfa] border-t-transparent animate-spin" />
          <span className="text-[rgba(255,255,255,0.4)] text-sm font-mono">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* OAuth callback — no sidebar needed */}
        <Route path="/oauth-callback" element={<OAuthCallback onAuthComplete={refreshUser} />} />

        {/* Onboarding — no sidebar */}
        <Route
          path="/onboarding"
          element={user ? <Onboarding /> : <Navigate to="/" />}
        />

        {/* ReviewMode — fullscreen swipe, no sidebar */}
        <Route
          path="/review"
          element={user ? <ReviewMode /> : <Navigate to="/" />}
        />

        {/* Privacy — no sidebar */}
        <Route path="/privacy" element={<PrivacyPage />} />

        {/* Authenticated routes — all wrapped in sidebar layout */}
        <Route
          path="/"
          element={
            user
              ? <AuthenticatedLayout user={user} onLogout={handleLogout}>
                  <Dashboard user={user} onLogout={handleLogout} />
                </AuthenticatedLayout>
              : <ConnectPage />
          }
        />
        <Route
          path="/contacts"
          element={
            user
              ? <AuthenticatedLayout user={user} onLogout={handleLogout}>
                  <Contacts user={user} onLogout={handleLogout} />
                </AuthenticatedLayout>
              : <Navigate to="/" />
          }
        />
        <Route
          path="/settings"
          element={
            user
              ? <AuthenticatedLayout user={user} onLogout={handleLogout}>
                  <Settings user={user} onLogout={handleLogout} onUserUpdate={setUser} />
                </AuthenticatedLayout>
              : <Navigate to="/" />
          }
        />
        <Route
          path="/fund-focus"
          element={
            user
              ? <AuthenticatedLayout user={user} onLogout={handleLogout}>
                  <FundFocus />
                </AuthenticatedLayout>
              : <Navigate to="/" />
          }
        />
        <Route
          path="/pipeline"
          element={
            user
              ? <AuthenticatedLayout user={user} onLogout={handleLogout}>
                  <Pipeline user={user} onLogout={handleLogout} />
                </AuthenticatedLayout>
              : <Navigate to="/" />
          }
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <Toaster position="bottom-right" richColors />
    </BrowserRouter>
  );
}

export default App;
