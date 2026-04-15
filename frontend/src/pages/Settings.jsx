import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Key, RefreshCw, LogOut, Check, AlertTriangle, ExternalLink } from 'lucide-react';
import { getSettings, disconnectGmail, logout } from '../lib/api';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function Settings({ user, onLogout }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    getSettings().then((s) => { if (s) setSettings(s); }).finally(() => setLoading(false));
  }, []);

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect Gmail? You can reconnect anytime.')) return;
    setDisconnecting(true);
    try {
      await disconnectGmail();
      setSettings((s) => ({ ...s, gmail_connected: false }));
    } finally {
      setDisconnecting(false);
    }
  };

  const handleLogout = async () => {
    await logout().catch(() => {});
    onLogout();
  };

  const cardCls = 'bg-[#13131c] border border-[rgba(255,255,255,0.07)] rounded-xl p-6';
  const labelCls = 'text-[rgba(255,255,255,0.4)] text-xs uppercase tracking-wider font-semibold mb-3';

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0c0c12] overflow-hidden">
      {/* Nav */}
      <nav className="h-14 shrink-0 border-b border-[rgba(255,255,255,0.07)] flex items-center px-5 gap-3 bg-[#0c0c12]">
        <button
          onClick={() => navigate('/')}
          className="text-[rgba(255,255,255,0.4)] hover:text-white transition-colors flex items-center gap-1.5 text-sm"
          data-testid="back-to-dashboard"
        >
          <ArrowLeft size={15} />
          Dashboard
        </button>
        <div className="flex items-center gap-2 ml-4">
          <div
            className="w-6 h-6 rounded flex items-center justify-center text-white font-bold text-xs"
            style={{ background: 'linear-gradient(135deg,#7c6dfa,#5b4de8)' }}
          >
            FF
          </div>
          <span className="text-white font-semibold text-sm">Settings</span>
        </div>
        <button
          data-testid="settings-logout-btn"
          onClick={handleLogout}
          className="ml-auto text-[rgba(255,255,255,0.3)] hover:text-white transition-colors flex items-center gap-1.5 text-sm"
        >
          <LogOut size={14} />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </nav>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-5">
          {/* Gmail Integration */}
          <div className={cardCls}>
            <div className="flex items-center gap-2 mb-1">
              <Mail size={15} className="text-[#4da6ff]" />
              <h2 className="text-white font-semibold text-sm">Gmail Integration</h2>
            </div>
            <p className="text-[rgba(255,255,255,0.35)] text-xs mb-5">
              Connect your Gmail account to automatically ingest and analyze inbound emails.
            </p>

            {loading ? (
              <div className="flex items-center gap-2 text-[rgba(255,255,255,0.3)] text-sm">
                <RefreshCw size={13} className="animate-spin" />
                Loading...
              </div>
            ) : settings?.gmail_connected ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 bg-[#3dd68c]/08 border border-[#3dd68c]/20 rounded-lg p-3">
                  <div className="w-8 h-8 rounded-full bg-[#3dd68c]/10 border border-[#3dd68c]/20 flex items-center justify-center shrink-0">
                    <Check size={14} className="text-[#3dd68c]" />
                  </div>
                  <div>
                    <p className="text-[#3dd68c] text-sm font-medium">Connected</p>
                    <p className="text-[rgba(255,255,255,0.4)] text-xs font-mono">{settings.email}</p>
                    {settings.last_synced && (
                      <p className="text-[rgba(255,255,255,0.25)] text-xs mt-0.5">
                        Last sync: {new Date(settings.last_synced).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  data-testid="disconnect-gmail-btn"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="flex items-center gap-2 text-[#f05252] hover:text-white text-sm border border-[#f05252]/30 hover:border-[#f05252] rounded-lg px-4 py-2 transition-all disabled:opacity-50"
                >
                  {disconnecting ? <RefreshCw size={13} className="animate-spin" /> : <Mail size={13} />}
                  Disconnect Gmail
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 bg-[#f5a623]/08 border border-[#f5a623]/20 rounded-lg p-3">
                  <AlertTriangle size={13} className="text-[#f5a623]" />
                  <p className="text-[rgba(255,255,255,0.5)] text-xs">No Gmail account connected</p>
                </div>
                <a
                  data-testid="connect-gmail-settings-btn"
                  href={`${BACKEND_URL}/api/auth/google`}
                  className="inline-flex items-center gap-2 bg-[#7c6dfa] hover:bg-[#6b5ded] text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-all"
                  style={{ boxShadow: '0 0 12px rgba(124,109,250,0.3)' }}
                >
                  <Mail size={13} />
                  Connect Gmail
                </a>
              </div>
            )}
          </div>

          {/* AI Configuration */}
          <div className={cardCls}>
            <div className="flex items-center gap-2 mb-1">
              <Key size={15} className="text-[#7c6dfa]" />
              <h2 className="text-white font-semibold text-sm">AI Configuration</h2>
            </div>
            <p className="text-[rgba(255,255,255,0.35)] text-xs mb-5">
              Claude AI (Anthropic) is used to extract deal signals from emails.
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-[#0c0c12] border border-[rgba(255,255,255,0.06)] rounded-lg px-4 py-3">
                <div>
                  <p className="text-[rgba(255,255,255,0.7)] text-sm">Anthropic API Key</p>
                  <p className="text-[rgba(255,255,255,0.3)] text-xs font-mono mt-0.5">
                    {settings?.anthropic_key_set ? 'sk-ant-•••••••••••••••••' : 'Not configured'}
                  </p>
                </div>
                <div
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs"
                  style={{
                    background: settings?.anthropic_key_set ? 'rgba(61,214,140,0.08)' : 'rgba(240,82,82,0.08)',
                    color: settings?.anthropic_key_set ? '#3dd68c' : '#f05252',
                  }}
                >
                  {settings?.anthropic_key_set ? <Check size={11} /> : <AlertTriangle size={11} />}
                  {settings?.anthropic_key_set ? 'Active' : 'Missing'}
                </div>
              </div>
              <div className="flex items-center justify-between bg-[#0c0c12] border border-[rgba(255,255,255,0.06)] rounded-lg px-4 py-3">
                <div>
                  <p className="text-[rgba(255,255,255,0.7)] text-sm">Model</p>
                  <p className="text-[rgba(255,255,255,0.3)] text-xs font-mono mt-0.5">claude-sonnet-4-5</p>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs bg-[rgba(124,109,250,0.08)] text-[#7c6dfa]">
                  Active
                </div>
              </div>
            </div>
          </div>

          {/* Google OAuth */}
          <div className={cardCls}>
            <div className="flex items-center gap-2 mb-1">
              <svg viewBox="0 0 24 24" className="w-4 h-4">
                <path fill="#4da6ff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#3dd68c" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#f5a623" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#f05252" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <h2 className="text-white font-semibold text-sm">Google OAuth App</h2>
            </div>
            <p className="text-[rgba(255,255,255,0.35)] text-xs mb-4">
              Required redirect URI for your Google Cloud OAuth client.
            </p>
            <div className="bg-[#0c0c12] border border-[rgba(255,255,255,0.06)] rounded-lg px-4 py-3">
              <p className="text-[rgba(255,255,255,0.4)] text-xs mb-1">Authorized Redirect URI</p>
              <code className="text-[#4da6ff] text-xs font-mono break-all">
                {BACKEND_URL}/api/auth/callback
              </code>
            </div>
            <p className="text-[rgba(255,255,255,0.25)] text-xs mt-3">
              Add this URI in Google Cloud Console → Credentials → OAuth 2.0 Client → Authorized redirect URIs
            </p>
          </div>

          {/* Account */}
          <div className={cardCls}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold text-sm">Account</h2>
            </div>
            {user && (
              <div className="flex items-center gap-3 mb-4">
                {user.picture && (
                  <img src={user.picture} alt="" className="w-10 h-10 rounded-full" />
                )}
                <div>
                  <p className="text-white text-sm font-medium">{user.name}</p>
                  <p className="text-[rgba(255,255,255,0.4)] text-xs font-mono">{user.email}</p>
                </div>
              </div>
            )}
            <button
              data-testid="account-logout-btn"
              onClick={handleLogout}
              className="flex items-center gap-2 text-[rgba(255,255,255,0.5)] hover:text-white text-sm border border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.2)] rounded-lg px-4 py-2 transition-all"
            >
              <LogOut size={13} />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
