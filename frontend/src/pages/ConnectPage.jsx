import { useState, useEffect } from 'react';
import { Mail, Shield, Zap, BarChart2, AlertTriangle } from 'lucide-react';
import { getGoogleAuthUrl, getDbStatus } from '../lib/api';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function ConnectPage() {
  const [dbReady, setDbReady] = useState(true);
  const [checking, setChecking] = useState(true);
  const [urlError, setUrlError] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    if (err) setUrlError(err);

    getDbStatus().then((s) => {
      setDbReady(s.tables_ready);
      setChecking(false);
    });
  }, []);

  const handleConnect = () => {
    window.location.href = `${BACKEND_URL}/api/auth/google`;
  };

  return (
    <div
      className="h-screen w-screen flex items-center justify-center bg-[#0c0c12] relative overflow-hidden"
      style={{
        backgroundImage: `radial-gradient(ellipse at 50% 0%, rgba(124,109,250,0.08) 0%, transparent 70%)`,
      }}
    >
      {/* Grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative z-10 w-full max-w-md px-6">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10 justify-center">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
            style={{ background: 'linear-gradient(135deg, #7c6dfa, #5b4de8)' }}
          >
            FF
          </div>
          <div>
            <div className="text-white font-semibold text-sm leading-none">Future Frontier Capital</div>
            <div className="text-[rgba(255,255,255,0.4)] text-xs mt-0.5 tracking-wider uppercase font-mono">
              deal flow intelligence
            </div>
          </div>
        </div>

        {/* Main card */}
        <div className="bg-[#13131c] border border-[rgba(255,255,255,0.07)] rounded-xl p-8">
          <h1 className="text-2xl font-bold text-white mb-2">Connect Your Gmail</h1>
          <p className="text-[rgba(255,255,255,0.5)] text-sm mb-8 leading-relaxed">
            Authorize access to automatically ingest inbound deal flow emails, extract signals with AI, and
            surface high-priority pitches instantly.
          </p>

          {/* Features */}
          <div className="space-y-3 mb-8">
            {[
              { icon: Mail, label: 'Auto-sync inbox every 15 minutes', color: '#7c6dfa' },
              { icon: Zap, label: 'Claude AI extracts deal signals instantly', color: '#3dd68c' },
              { icon: BarChart2, label: 'Relevance scoring 1–10 for every email', color: '#f5a623' },
              { icon: Shield, label: 'Read-only access, never sends emails', color: '#4da6ff' },
            ].map(({ icon: Icon, label, color }) => (
              <div key={label} className="flex items-center gap-3">
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                  style={{ background: `${color}18`, border: `1px solid ${color}30` }}
                >
                  <Icon size={14} style={{ color }} />
                </div>
                <span className="text-[rgba(255,255,255,0.7)] text-sm">{label}</span>
              </div>
            ))}
          </div>

          {/* DB warning */}
          {!checking && !dbReady && (
            <div className="bg-[#f5a623]/10 border border-[#f5a623]/20 rounded-lg p-3 mb-5 flex gap-2">
              <AlertTriangle size={15} className="text-[#f5a623] shrink-0 mt-0.5" />
              <div>
                <p className="text-[#f5a623] text-xs font-medium">Database Setup Required</p>
                <p className="text-[rgba(255,255,255,0.5)] text-xs mt-0.5">
                  Run the migration SQL in your Supabase Dashboard → SQL Editor before connecting.
                </p>
              </div>
            </div>
          )}

          {urlError && (
            <div className="bg-[#f05252]/10 border border-[#f05252]/20 rounded-lg p-3 mb-5">
              <p className="text-[#f05252] text-xs">Auth error: {urlError}. Please try again.</p>
            </div>
          )}

          <button
            data-testid="connect-gmail-btn"
            onClick={handleConnect}
            disabled={checking}
            className="w-full flex items-center justify-center gap-2.5 bg-[#7c6dfa] hover:bg-[#6b5ded] text-white font-medium py-3 rounded-lg transition-all duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ boxShadow: '0 0 24px rgba(124,109,250,0.25)' }}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Connect with Google
          </button>

          <p className="text-[rgba(255,255,255,0.25)] text-xs text-center mt-4">
            gmail.readonly scope only • No email sending
          </p>
        </div>
      </div>
    </div>
  );
}
