import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { getIntegrationSettings, saveIntegrationSettings } from '../lib/api';
import { toast } from '../components/ui/sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// ── Google Calendar inline SVG ───────────────────────────────────────────────
function GCalLogo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <rect x="1" y="3" width="22" height="20" rx="2" fill="#ffffff" />
      <rect x="1" y="3" width="22" height="6" rx="2" fill="#4285F4" />
      <rect x="1" y="7" width="22" height="2" fill="#4285F4" />
      <rect x="6.5" y="1.5" width="2" height="4" rx="1" fill="#4285F4" />
      <rect x="15.5" y="1.5" width="2" height="4" rx="1" fill="#4285F4" />
      <text x="12" y="19" textAnchor="middle" fontSize="7" fontWeight="700" fill="#4285F4" fontFamily="Arial, sans-serif">31</text>
    </svg>
  );
}

// ── Shared card styles ───────────────────────────────────────────────────────
const cardStyle = {
  background: '#131320',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 16,
  padding: 24,
  display: 'flex',
  alignItems: 'flex-start',
  gap: 20,
};

const inputCls = 'w-full border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[rgba(255,255,255,0.25)] focus:outline-none focus:border-[#7c6dfa] transition-colors';
const inputStyle = { background: '#080810' };

function StatusBadge({ connected, label }) {
  return (
    <span
      className="ml-auto flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium shrink-0"
      style={connected
        ? { background: 'rgba(61,214,140,0.1)', color: '#3dd68c', border: '1px solid rgba(61,214,140,0.25)' }
        : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.1)' }
      }
    >
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: connected ? '#3dd68c' : 'rgba(255,255,255,0.3)', display: 'inline-block', flexShrink: 0 }} />
      {label || (connected ? 'Connected' : 'Not connected')}
    </span>
  );
}

export default function Integrations() {
  const [integrations, setIntegrations] = useState({});

  // Notion state
  const [notionKey,       setNotionKey]       = useState('');
  const [notionDbId,      setNotionDbId]      = useState('');
  const [notionSaving,    setNotionSaving]    = useState(false);
  const [notionSaved,     setNotionSaved]     = useState(false);
  const [notionShowInputs, setNotionShowInputs] = useState(false);

  // Slack state
  const [slackWebhook,    setSlackWebhook]    = useState('');
  const [slackSaving,     setSlackSaving]     = useState(false);
  const [slackSaved,      setSlackSaved]      = useState(false);
  const [slackShowInputs, setSlackShowInputs] = useState(false);

  useEffect(() => {
    getIntegrationSettings().then(d => {
      if (d) {
        setIntegrations(d);
        if (d.notion_database_id) setNotionDbId(d.notion_database_id);
      }
    }).catch(() => {});
  }, []);

  const handleSaveNotion = async () => {
    if (!notionKey && !notionDbId) return;
    setNotionSaving(true);
    try {
      await saveIntegrationSettings({ notion_api_key: notionKey, notion_database_id: notionDbId });
      setNotionSaved(true);
      setIntegrations(prev => ({ ...prev, notion_connected: !!(notionKey && notionDbId), notion_database_id: notionDbId }));
      setTimeout(() => setNotionSaved(false), 3000);
      setNotionKey('');
      setNotionShowInputs(false);
    } catch { toast.error('Failed to save Notion settings'); }
    finally { setNotionSaving(false); }
  };

  const handleSaveSlack = async () => {
    if (!slackWebhook) return;
    setSlackSaving(true);
    try {
      await saveIntegrationSettings({ slack_webhook_url: slackWebhook });
      setSlackSaved(true);
      setIntegrations(prev => ({ ...prev, slack_connected: true }));
      setTimeout(() => setSlackSaved(false), 3000);
      setSlackWebhook('');
      setSlackShowInputs(false);
    } catch { toast.error('Failed to save Slack settings'); }
    finally { setSlackSaving(false); }
  };

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100vh', background: '#080810' }}>
      {/* ── Top bar ── */}
      <div
        className="shrink-0 flex items-center px-5 gap-3"
        style={{ height: 48, borderBottom: '1px solid rgba(255,255,255,0.07)', background: '#080810' }}
      >
        <span className="font-semibold text-white" style={{ fontSize: 16 }}>Integrations</span>
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Connect Funnl to your existing workflow</span>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto p-6">
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── Google Calendar ── */}
          <div style={cardStyle}>
            {/* Logo */}
            <div style={{ width: 48, height: 48, borderRadius: 12, background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <GCalLogo size={30} />
            </div>
            {/* Right col */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-white font-semibold" style={{ fontSize: 15 }}>Google Calendar</span>
                <StatusBadge connected={!!integrations.calendar_enabled} label={integrations.calendar_enabled ? 'Connected' : 'Not granted'} />
              </div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 10 }}>Schedule calls from deals</p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, marginBottom: 16 }}>
                Create calendar events directly from First Look deals. Pre-fills founder name, company, and your AI call prep brief.
              </p>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16 }}>
                {integrations.calendar_enabled ? (
                  <div className="flex items-center gap-2" style={{ color: '#3dd68c', fontSize: 13 }}>
                    <Check size={14} />
                    Connected via your Google account
                  </div>
                ) : (
                  <a
                    href={`${BACKEND_URL}/api/auth/google`}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all"
                    style={{ background: 'rgba(66,133,244,0.1)', border: '1px solid rgba(66,133,244,0.3)', color: '#4285F4', textDecoration: 'none' }}
                  >
                    <GCalLogo size={14} />
                    Grant Calendar Access
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* ── Notion ── */}
          <div style={cardStyle}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <img src="https://cdn.simpleicons.org/notion/000000" width="26" height="26" alt="Notion" style={{ display: 'block' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-white font-semibold" style={{ fontSize: 15 }}>Notion</span>
                <StatusBadge connected={!!integrations.notion_connected} />
              </div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 10 }}>Export deals to your workspace</p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, marginBottom: 16 }}>
                Push any deal as a structured page to your Notion database. Includes AI summary, thesis fit, and your notes.{' '}
                <a href="https://notion.so/my-integrations" target="_blank" rel="noopener noreferrer" style={{ color: '#4da6ff' }}>How to set up →</a>
              </p>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16 }}>
                {integrations.notion_connected && !notionShowInputs ? (
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 text-sm" style={{ color: '#3dd68c' }}>
                      <Check size={14} />
                      Connected
                    </span>
                    {integrations.notion_database_id && (
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
                        DB: …{integrations.notion_database_id.slice(-8)}
                      </span>
                    )}
                    <button onClick={() => setNotionShowInputs(true)} style={{ fontSize: 12, color: '#4da6ff', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      Update credentials
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <input type="password" className={inputCls} style={inputStyle} placeholder="Notion API Key (secret_...)" value={notionKey} onChange={e => setNotionKey(e.target.value)} />
                    <input type="text" className={inputCls} style={inputStyle} placeholder="Database ID (from Notion URL)" value={notionDbId} onChange={e => setNotionDbId(e.target.value)} />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveNotion}
                        disabled={notionSaving || (!notionKey && !notionDbId)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all self-start disabled:opacity-40"
                        style={{ background: notionSaved ? 'rgba(61,214,140,0.1)' : 'rgba(255,255,255,0.06)', border: `1px solid ${notionSaved ? 'rgba(61,214,140,0.3)' : 'rgba(255,255,255,0.1)'}`, color: notionSaved ? '#3dd68c' : 'rgba(255,255,255,0.7)' }}
                      >
                        {notionSaved ? <><Check size={11} /> Saved</> : notionSaving ? 'Saving…' : 'Save'}
                      </button>
                      {notionShowInputs && (
                        <button onClick={() => setNotionShowInputs(false)} className="text-xs px-3 py-2 rounded-xl" style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Slack ── */}
          <div style={cardStyle}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: '#4A154B', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <img src="https://cdn.simpleicons.org/slack" width="26" height="26" alt="Slack" style={{ display: 'block' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-white font-semibold" style={{ fontSize: 15 }}>Slack</span>
                <StatusBadge connected={!!integrations.slack_connected} />
              </div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 10 }}>Share deals with your team</p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, marginBottom: 16 }}>
                Post a formatted deal card to any Slack channel. Includes score, summary, and a direct link back to Funnl.{' '}
                <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" style={{ color: '#4da6ff' }}>How to set up →</a>
              </p>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16 }}>
                {integrations.slack_connected && !slackShowInputs ? (
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 text-sm" style={{ color: '#3dd68c' }}>
                      <Check size={14} />
                      Webhook configured
                    </span>
                    <button onClick={() => setSlackShowInputs(true)} style={{ fontSize: 12, color: '#4da6ff', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      Update URL
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <input type="text" className={inputCls} style={inputStyle} placeholder="https://hooks.slack.com/services/..." value={slackWebhook} onChange={e => setSlackWebhook(e.target.value)} />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveSlack}
                        disabled={slackSaving || !slackWebhook}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all self-start disabled:opacity-40"
                        style={{ background: slackSaved ? 'rgba(61,214,140,0.1)' : 'rgba(255,255,255,0.06)', border: `1px solid ${slackSaved ? 'rgba(61,214,140,0.3)' : 'rgba(255,255,255,0.1)'}`, color: slackSaved ? '#3dd68c' : 'rgba(255,255,255,0.7)' }}
                      >
                        {slackSaved ? <><Check size={11} /> Saved</> : slackSaving ? 'Saving…' : 'Save'}
                      </button>
                      {slackShowInputs && (
                        <button onClick={() => setSlackShowInputs(false)} className="text-xs px-3 py-2 rounded-xl" style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
