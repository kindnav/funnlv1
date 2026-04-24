import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Mail, Key, RefreshCw, LogOut, Check, AlertTriangle,
} from 'lucide-react';
import { getSettings, disconnectGmail, logout, getMyFund, getGatedEmails, restoreGatedEmail } from '../lib/api';
import { TeamSetup } from '../components/TeamSetup';
import { AIGateSection } from '../components/settings/AIGateSection';
import { toast } from '../components/ui/sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function Settings({ user, onLogout }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  // Team
  const [fundInfo, setFundInfo] = useState(null);
  const [fundLoading, setFundLoading] = useState(true);

  // Gated emails
  const [gatedEmails, setGatedEmails] = useState([]);
  const [gatedLoading, setGatedLoading] = useState(false);
  const [gatedTableMissing, setGatedTableMissing] = useState(false);
  const [restoringId, setRestoringId] = useState(null);

  const navigate = useNavigate();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  // Initial data load — runs once on mount. All called functions are stable API imports.
  useEffect(() => {
    Promise.all([getSettings(), getMyFund()]).then(([s, fi]) => {
      if (s) setSettings(s);
      if (fi && fi.fund) setFundInfo(fi);
      setFundLoading(false);
    }).finally(() => setLoading(false));

    // Load gated emails
    setGatedLoading(true);
    getGatedEmails().then((res) => {
      if (res?.table_missing) setGatedTableMissing(true);
      setGatedEmails(res?.emails || []);
    }).finally(() => setGatedLoading(false));
  }, []);

  const handleRestore = async (id) => {
    setRestoringId(id);
    try {
      await restoreGatedEmail(id);
      setGatedEmails((prev) => prev.filter((e) => e.id !== id));
      toast('Email restored and added to your dashboard.');
    } catch {
      toast.error('Could not restore email.');
    } finally {
      setRestoringId(null);
    }
  };

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
  const inputCls =
    'w-full bg-[#0c0c12] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[rgba(255,255,255,0.25)] focus:outline-none focus:border-[#7c6dfa] transition-colors';

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
            VC
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

          {/* ── Team Collaboration ── */}
          <div className={cardCls} data-testid="team-section">
            {fundLoading ? (
              <div className="flex items-center gap-2 text-[rgba(255,255,255,0.3)] text-sm">
                <RefreshCw size={13} className="animate-spin" />Loading team…
              </div>
            ) : (
              <TeamSetup
                fundInfo={fundInfo}
                onFundChange={async () => {
                  setFundLoading(true);
                  const fi = await getMyFund().catch(() => null);
                  setFundInfo(fi?.fund ? fi : null);
                  setFundLoading(false);
                }}
              />
            )}
          </div>

          {/* ── Gmail Integration ── */}
          <div className={cardCls}>
            <div className="flex items-center gap-2 mb-1">
              <Mail size={15} className="text-[#4da6ff]" />
              <h2 className="text-white font-semibold text-sm">Gmail Integration</h2>
            </div>
            <p className="text-[rgba(255,255,255,0.35)] text-xs mb-5">
              Connect your Gmail to auto-ingest and analyze inbound emails every 15 minutes.
              Spam and irrelevant emails are automatically filtered out.
            </p>

            {loading ? (
              <div className="flex items-center gap-2 text-[rgba(255,255,255,0.3)] text-sm">
                <RefreshCw size={13} className="animate-spin" />
                Loading...
              </div>
            ) : settings?.gmail_connected ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-lg p-3"
                  style={{ background: 'rgba(61,214,140,0.06)', border: '1px solid rgba(61,214,140,0.2)' }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(61,214,140,0.1)', border: '1px solid rgba(61,214,140,0.2)' }}>
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
                <a
                  data-testid="reconnect-gmail-btn"
                  href={`${BACKEND_URL}/api/auth/google`}
                  className="flex items-center gap-2 text-[rgba(255,255,255,0.5)] hover:text-white text-sm border border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.25)] rounded-lg px-4 py-2 transition-all"
                >
                  <RefreshCw size={13} />
                  Reconnect Gmail
                </a>
                <p className="text-[rgba(255,255,255,0.25)] text-xs leading-relaxed">
                  Use <strong className="text-[rgba(255,255,255,0.4)]">Reconnect Gmail</strong> to grant email-sending permission if "Send Email" actions in the deal panel don't work.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 rounded-lg p-3"
                  style={{ background: 'rgba(245,166,35,0.06)', border: '1px solid rgba(245,166,35,0.2)' }}>
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

          {/* ── AI Configuration ── */}
          <div className={cardCls}>
            <div className="flex items-center gap-2 mb-1">
              <Key size={15} className="text-[#7c6dfa]" />
              <h2 className="text-white font-semibold text-sm">AI Configuration</h2>
            </div>
            <p className="text-[rgba(255,255,255,0.35)] text-xs mb-4">
              Claude AI extracts deal signals and scores relevance against your fund focus.
            </p>
            <div className="space-y-2">
              {[
                { label: 'Anthropic API Key', value: settings?.anthropic_key_set ? 'sk-ant-•••••••••••••' : 'Not configured', active: settings?.anthropic_key_set },
                { label: 'Model', value: 'claude-sonnet-4-5', active: true },
                { label: 'Spam filter', value: 'Enabled — auto-removes irrelevant emails', active: true, color: '#3dd68c' },
              ].map(({ label, value, active, color }) => (
                <div key={label} className="flex items-center justify-between rounded-lg px-4 py-3"
                  style={{ background: '#0c0c12', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div>
                    <p className="text-[rgba(255,255,255,0.7)] text-sm">{label}</p>
                    <p className="text-[rgba(255,255,255,0.3)] text-xs font-mono mt-0.5">{value}</p>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs"
                    style={{
                      background: active ? `${color || '#3dd68c'}14` : 'rgba(240,82,82,0.08)',
                      color: active ? (color || '#3dd68c') : '#f05252',
                    }}>
                    {active ? <Check size={11} /> : <AlertTriangle size={11} />}
                    {active ? 'Active' : 'Missing'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Google OAuth App ── */}
          <div className={cardCls}>
            <h2 className="text-white font-semibold text-sm mb-3">Google OAuth Redirect URI</h2>
            <div className="rounded-lg px-4 py-3" style={{ background: '#0c0c12', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[rgba(255,255,255,0.4)] text-xs mb-1">Add this in Google Cloud Console</p>
              <code className="text-[#4da6ff] text-xs font-mono break-all">
                {BACKEND_URL}/api/auth/callback
              </code>
            </div>
          </div>

          {/* ── AI Gate (Filtered Emails) ── */}
          <AIGateSection
            cardCls={cardCls}
            gatedEmails={gatedEmails}
            gatedLoading={gatedLoading}
            gatedTableMissing={gatedTableMissing}
            restoringId={restoringId}
            onRestore={handleRestore}
          />

          {/* ── Account ── */}
          <div className={cardCls}>
            <h2 className="text-white font-semibold text-sm mb-4">Account</h2>
            {user && (
              <div className="flex items-center gap-3 mb-4">
                {user.picture && <img src={user.picture} alt="" className="w-10 h-10 rounded-full" />}
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
