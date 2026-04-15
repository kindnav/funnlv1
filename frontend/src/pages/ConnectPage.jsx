import { useState, useEffect } from 'react';
import { Target, Zap, Mail, AlertTriangle, Send } from 'lucide-react';
import { getGoogleAuthUrl, getDbStatus } from '../lib/api';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const FEATURES = [
  {
    icon: Target,
    color: '#7c6dfa',
    title: 'Thesis-matched scoring',
    desc: 'Every email gets a 0–100 match score against your specific fund thesis — not generic relevance.',
  },
  {
    icon: Zap,
    color: '#3dd68c',
    title: 'Auto-structured deal data',
    desc: 'Claude extracts founder, company, stage, sector, ask, and traction signals. Zero manual entry.',
  },
  {
    icon: Send,
    color: '#4da6ff',
    title: 'One-click replies',
    desc: 'Decline, request more info, or forward to a partner — AI drafts the email, you send it in one click.',
  },
  {
    icon: Mail,
    color: '#f5a623',
    title: 'Inbox-native workflow',
    desc: 'Syncs Gmail every 15 minutes automatically. Every inbound deal surfaces instantly.',
  },
];

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
      className="h-screen w-screen flex bg-[#0c0c12] overflow-hidden"
      style={{ backgroundImage: 'radial-gradient(ellipse at 20% 50%, rgba(124,109,250,0.07) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(77,166,255,0.05) 0%, transparent 50%)' }}
    >
      {/* Grid */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)',
          backgroundSize: '52px 52px',
        }}
      />

      {/* Left panel — branding + features */}
      <div className="hidden lg:flex flex-col justify-center w-[480px] shrink-0 px-14 relative z-10">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-12">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0"
            style={{ background: 'linear-gradient(135deg, #7c6dfa, #5b4de8)', boxShadow: '0 0 20px rgba(124,109,250,0.4)' }}>
            FF
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-none">Deal Flow Intelligence</p>
            <p className="text-[rgba(255,255,255,0.3)] text-xs font-mono mt-0.5 tracking-wider">powered by Claude AI</p>
          </div>
        </div>

        <h1 className="text-4xl font-bold text-white leading-tight mb-4">
          Your inbox,<br />
          <span style={{ background: 'linear-gradient(90deg, #7c6dfa, #4da6ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            AI-powered.
          </span>
        </h1>
        <p className="text-[rgba(255,255,255,0.5)] text-base leading-relaxed mb-10">
          Stop triaging emails manually. Every inbound pitch is automatically scored, structured, and ready for action — calibrated to your fund's specific thesis.
        </p>

        {/* Feature list */}
        <div className="space-y-5">
          {FEATURES.map(({ icon: Icon, color, title, desc }) => (
            <div key={title} className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
                <Icon size={15} style={{ color }} />
              </div>
              <div>
                <p className="text-white text-sm font-semibold leading-snug">{title}</p>
                <p className="text-[rgba(255,255,255,0.4)] text-xs leading-relaxed mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — connect card */}
      <div className="flex-1 flex items-center justify-center px-6 relative z-10">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden justify-center">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs"
              style={{ background: 'linear-gradient(135deg, #7c6dfa, #5b4de8)' }}>
              FF
            </div>
            <p className="text-white font-semibold text-sm">Deal Flow Intelligence</p>
          </div>

          <div className="rounded-2xl p-7"
            style={{ background: '#13131c', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 32px 80px rgba(0,0,0,0.5)' }}>

            <h2 className="text-xl font-bold text-white mb-1.5">Connect Gmail to start</h2>
            <p className="text-[rgba(255,255,255,0.45)] text-sm leading-relaxed mb-6">
              Authorize access and your inbox becomes a structured deal flow system — instantly.
            </p>

            {/* What you get — mobile only features summary */}
            <div className="lg:hidden space-y-2.5 mb-6">
              {FEATURES.map(({ icon: Icon, color, title }) => (
                <div key={title} className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded flex items-center justify-center shrink-0"
                    style={{ background: `${color}18` }}>
                    <Icon size={12} style={{ color }} />
                  </div>
                  <span className="text-[rgba(255,255,255,0.6)] text-xs">{title}</span>
                </div>
              ))}
            </div>

            {/* DB warning */}
            {!checking && !dbReady && (
              <div className="rounded-lg p-3 mb-4 flex gap-2.5"
                style={{ background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.2)' }}>
                <AlertTriangle size={14} className="text-[#f5a623] shrink-0 mt-0.5" />
                <p className="text-[rgba(255,255,255,0.5)] text-xs leading-relaxed">
                  Run the database migration SQL in Supabase before connecting.
                </p>
              </div>
            )}

            {urlError && (
              <div className="rounded-lg p-3 mb-4" style={{ background: 'rgba(240,82,82,0.08)', border: '1px solid rgba(240,82,82,0.2)' }}>
                <p className="text-[#f05252] text-xs">Auth error: {urlError}. Please try again.</p>
              </div>
            )}

            <button
              data-testid="connect-gmail-btn"
              onClick={handleConnect}
              disabled={checking}
              className="w-full flex items-center justify-center gap-2.5 text-white font-semibold py-3.5 rounded-xl transition-all duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, #7c6dfa, #5b4de8)',
                boxShadow: '0 0 28px rgba(124,109,250,0.35)',
              }}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white shrink-0">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>

            <p className="text-[rgba(255,255,255,0.2)] text-xs text-center mt-4 leading-relaxed">
              Gmail read + send access &nbsp;·&nbsp; Your emails never leave your account
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
