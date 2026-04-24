import { useState, useCallback, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import { Toaster } from './components/ui/sonner';
import { getMe, logout } from './lib/api';

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
      <div className="h-screen w-screen bg-[#0c0c12] flex items-center justify-center">
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
        {/* OAuth callback — no token in URL; cookie is set by backend */}
        <Route path="/oauth-callback" element={<OAuthCallback onAuthComplete={refreshUser} />} />
        <Route
          path="/onboarding"
          element={user ? <Onboarding /> : <Navigate to="/" />}
        />
        <Route
          path="/contacts"
          element={user ? <Contacts user={user} onLogout={handleLogout} /> : <Navigate to="/" />}
        />
        <Route
          path="/"
          element={user ? <Dashboard user={user} onLogout={handleLogout} /> : <ConnectPage />}
        />
        <Route
          path="/settings"
          element={
            user
              ? <Settings user={user} onLogout={handleLogout} onUserUpdate={setUser} />
              : <Navigate to="/" />
          }
        />
        <Route
          path="/fund-focus"
          element={user ? <FundFocus /> : <Navigate to="/" />}
        />
        <Route
          path="/pipeline"
          element={user ? <Pipeline user={user} onLogout={handleLogout} /> : <Navigate to="/" />}
        />
        <Route
          path="/review"
          element={user ? <ReviewMode /> : <Navigate to="/" />}
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <Toaster position="bottom-right" richColors />
    </BrowserRouter>
  );
}

export default App;
