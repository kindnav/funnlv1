import { useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import ConnectPage from './pages/ConnectPage';
import OAuthCallback from './pages/OAuthCallback';
import Pipeline from './pages/Pipeline';
import ReviewMode from './pages/ReviewMode';
import Onboarding from './pages/Onboarding';
import Contacts from './pages/Contacts';
import { Toaster } from './components/ui/sonner';
import { getMe } from './lib/api';
import { useEffect } from 'react';

function App() {
  const [token, setToken] = useState(localStorage.getItem('vc_token'));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const verifyAuth = useCallback(async () => {
    const t = localStorage.getItem('vc_token');
    if (!t) { setLoading(false); return; }
    try {
      const data = await getMe();
      if (data) setUser(data);
      else { localStorage.removeItem('vc_token'); setToken(null); }
    } catch {
      localStorage.removeItem('vc_token');
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { verifyAuth(); }, [verifyAuth]);

  const handleTokenReceived = (t) => {
    localStorage.setItem('vc_token', t);
    setToken(t);
    verifyAuth();
  };

  const handleLogout = () => {
    localStorage.removeItem('vc_token');
    setToken(null);
    setUser(null);
  };

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
        <Route path="/oauth-callback" element={<OAuthCallback onToken={handleTokenReceived} />} />
        <Route
          path="/onboarding"
          element={token ? <Onboarding /> : <Navigate to="/" />}
        />
        <Route
          path="/contacts"
          element={token && user ? <Contacts user={user} onLogout={handleLogout} /> : <Navigate to="/" />}
        />
        <Route
          path="/"
          element={token && user ? <Dashboard user={user} onLogout={handleLogout} /> : <ConnectPage />}
        />
        <Route
          path="/settings"
          element={
            token && user
              ? <Settings user={user} onLogout={handleLogout} onUserUpdate={setUser} />
              : <Navigate to="/" />
          }
        />
        <Route
          path="/pipeline"
          element={
            token && user
              ? <Pipeline user={user} onLogout={handleLogout} />
              : <Navigate to="/" />
          }
        />
        <Route
          path="/review"
          element={token && user ? <ReviewMode /> : <Navigate to="/" />}
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <Toaster position="bottom-right" richColors />
    </BrowserRouter>
  );
}

export default App;
