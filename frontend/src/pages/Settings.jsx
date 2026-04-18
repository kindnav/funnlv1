import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Mail, Key, RefreshCw, LogOut, Check, AlertTriangle,
  BookOpen, Save, Sparkles, ChevronDown
} from 'lucide-react';
import { getSettings, disconnectGmail, logout, getFundSettings, saveFundSettings } from '../lib/api';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const FUND_TYPES = [
  'VC Fund', 'Student VC Org', 'Accelerator', 'Angel Network',
  'Family Office', 'Corporate VC', 'Micro-VC', 'Other',
];
const ALL_STAGES = ['Pre-seed', 'Seed', 'Series A', 'Series B+', 'Growth', 'Any Stage'];

export default function Settings({ user, onLogout }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  // Fund thesis form state
  const [thesis, setThesis] = useState({
    fund_name: '', fund_type: '', thesis: '', sectors: '', check_size: '', stages: [],
  });
  const [thesisSaving, setThesisSaving] = useState(false);
  const [thesisSaved, setThesisSaved] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([getSettings(), getFundSettings()]).then(([s, f]) => {
      if (s) setSettings(s);
      if (f && Object.keys(f).length > 0) {
        setThesis({
          fund_name: f.fund_name || '',
          fund_type: f.fund_type || '',
          thesis: f.thesis || '',
          sectors: f.sectors || '',
          check_size: f.check_size || '',
          stages: f.stages || [],
        });
      }
    }).finally(() => setLoading(false));
  }, []);

  const toggleStage = (stage) => {
    setThesis((t) => ({
      ...t,
      stages: t.stages.includes(stage) ? t.stages.filter((s) => s !== stage) : [...t.stages, stage],
    }));
  };

  const handleSaveThesis = async () => {
    setThesisSaving(true);
    try {
      await saveFundSettings(thesis);
      setThesisSaved(true);
      setTimeout(() => setThesisSaved(false), 2500);
    } finally {
      setThesisSaving(false);
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
  const labelCls = 'block text-[rgba(255,255,255,0.45)] text-xs uppercase tracking-wider font-semibold mb-1.5';

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
            {thesis.fund_name
              ? thesis.fund_name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
              : 'VC'}
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

          {/* ── Fund Thesis callout banner ── */}
          <div
            className="rounded-xl px-5 py-4 flex items-start gap-4"
            style={{
              background: 'linear-gradient(135deg, rgba(124,109,250,0.15), rgba(91,77,232,0.08))',
              border: '1px solid rgba(124,109,250,0.35)',
            }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
              style={{ background: 'rgba(124,109,250,0.2)' }}>
              <Sparkles size={15} className="text-[#7c6dfa]" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm mb-0.5">Set your Fund Focus first</p>
              <p className="text-[rgba(255,255,255,0.45)] text-xs leading-relaxed">
                The AI uses your investment focus to calibrate relevance scores for every inbound email. Fill in the form below — the more specific, the better your deal scoring.
              </p>
            </div>
          </div>

          {/* ── Fund Thesis ── */}
          <div className={cardCls}>
            <div className="flex items-center gap-2 mb-1">
              <BookOpen size={15} className="text-[#7c6dfa]" />
              <h2 className="text-white font-semibold text-sm">Fund Focus</h2>
              <span className="ml-auto px-2 py-0.5 rounded text-xs font-mono"
                style={{ background: 'rgba(124,109,250,0.1)', color: '#7c6dfa', border: '1px solid rgba(124,109,250,0.2)' }}>
                AI-calibrated
              </span>
            </div>
            <p className="text-[rgba(255,255,255,0.35)] text-xs mb-5 leading-relaxed">
              Describe your fund's focus. Claude uses this to score every email's relevance — a student VC org focused on edtech will see different scores than a growth-stage fintech fund.
            </p>

            <div className="space-y-4">
              {/* Row 1: Fund name + type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Fund Name</label>
                  <input
                    data-testid="fund-name-input"
                    type="text"
                    placeholder="Future Frontier Capital"
                    value={thesis.fund_name}
                    onChange={(e) => setThesis({ ...thesis, fund_name: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Fund Type</label>
                  <div className="relative">
                    <select
                      data-testid="fund-type-select"
                      value={thesis.fund_type}
                      onChange={(e) => setThesis({ ...thesis, fund_type: e.target.value })}
                      className={`${inputCls} appearance-none pr-8 cursor-pointer`}
                      style={{ background: '#0c0c12' }}
                    >
                      <option value="">Select type...</option>
                      {FUND_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgba(255,255,255,0.3)] pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Investment focus */}
              <div>
                <label className={labelCls}>Investment Focus</label>
                <textarea
                  data-testid="thesis-input"
                  rows={4}
                  placeholder="E.g. We invest in pre-seed and seed B2B SaaS companies with strong founder-market fit in fintech, devtools, and enterprise AI. We look for technical founders with domain expertise building in large markets..."
                  value={thesis.thesis}
                  onChange={(e) => setThesis({ ...thesis, thesis: e.target.value })}
                  className={`${inputCls} resize-none leading-relaxed`}
                />
              </div>

              {/* Row 2: Sectors + check size */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Sector Focus</label>
                  <input
                    data-testid="sectors-input"
                    type="text"
                    placeholder="AI/ML, Fintech, Climate, EdTech"
                    value={thesis.sectors}
                    onChange={(e) => setThesis({ ...thesis, sectors: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Check Size Range</label>
                  <input
                    data-testid="check-size-input"
                    type="text"
                    placeholder="$250K – $1.5M"
                    value={thesis.check_size}
                    onChange={(e) => setThesis({ ...thesis, check_size: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Preferred stages */}
              <div>
                <label className={labelCls}>Preferred Stages</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_STAGES.map((stage) => {
                    const active = thesis.stages.includes(stage);
                    return (
                      <button
                        key={stage}
                        data-testid={`stage-${stage.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                        onClick={() => toggleStage(stage)}
                        type="button"
                        className="px-3 py-1.5 rounded-md text-xs font-medium transition-all border"
                        style={{
                          background: active ? 'rgba(124,109,250,0.15)' : 'rgba(255,255,255,0.03)',
                          borderColor: active ? 'rgba(124,109,250,0.4)' : 'rgba(255,255,255,0.08)',
                          color: active ? '#7c6dfa' : 'rgba(255,255,255,0.4)',
                        }}
                      >
                        {stage}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* How it affects scoring */}
              <div
                className="flex items-start gap-2.5 rounded-lg p-3 text-xs"
                style={{ background: 'rgba(124,109,250,0.05)', border: '1px solid rgba(124,109,250,0.12)' }}
              >
                <Sparkles size={12} className="text-[#7c6dfa] mt-0.5 shrink-0" />
                <p className="text-[rgba(255,255,255,0.45)] leading-relaxed">
                  Claude will score emails 8–10 only when they align with your investment focus, stage, and sectors.
                  Emails outside your focus are automatically filtered out before reaching your dashboard.
                </p>
              </div>

              {/* Save button */}
              <div className="flex justify-end">
                <button
                  data-testid="save-thesis-btn"
                  onClick={handleSaveThesis}
                  disabled={thesisSaving}
                  className="flex items-center gap-2 text-sm font-medium px-5 py-2 rounded-lg transition-all disabled:opacity-50"
                  style={{
                    background: thesisSaved ? 'rgba(61,214,140,0.15)' : '#7c6dfa',
                    color: thesisSaved ? '#3dd68c' : 'white',
                    border: thesisSaved ? '1px solid rgba(61,214,140,0.3)' : 'none',
                    boxShadow: thesisSaved ? 'none' : '0 0 16px rgba(124,109,250,0.3)',
                  }}
                >
                  {thesisSaving ? (
                    <RefreshCw size={13} className="animate-spin" />
                  ) : thesisSaved ? (
                    <Check size={13} />
                  ) : (
                    <Save size={13} />
                  )}
                  {thesisSaving ? 'Saving...' : thesisSaved ? 'Saved!' : 'Save Thesis'}
                </button>
              </div>
            </div>
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
