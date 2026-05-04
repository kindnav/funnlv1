import { useState, useEffect } from 'react';
import { Check, ExternalLink } from 'lucide-react';
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

// ── Step number badge ────────────────────────────────────────────────────────
function StepNum({ n }) {
  return (
    <span style={{
      width: 20, height: 20, borderRadius: '50%',
      background: 'rgba(124,109,250,0.12)', border: '1px solid rgba(124,109,250,0.25)',
      color: '#7c6dfa', fontSize: 11, fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, marginTop: 2,
    }}>
      {n}
    </span>
  );
}

// ── External link pill ───────────────────────────────────────────────────────
function SetupLink({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: 12, color: 'rgba(255,255,255,0.5)', textDecoration: 'none',
        padding: '4px 10px', borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
        marginTop: 6, transition: 'color 0.15s, border-color 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)'; }}
      onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
    >
      {children}
      <ExternalLink size={12} />
    </a>
  );
}

export default function Integrations() {
  const [integrations, setIntegrations] = useState({});

  // Notion state
  const [notionKey,        setNotionKey]        = useState('');
  const [notionDbId,       setNotionDbId]       = useState('');
  const [notionSaving,     setNotionSaving]     = useState(false);
  const [notionSaved,      setNotionSaved]      = useState(false);
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

  const allConnected = !!integrations.calendar_enabled && !!integrations.notion_connected && !!integrations.slack_connected;

  // ── Shared primary button style ──────────────────────────────────────────
  const primaryBtn = (saved) => ({
    background: saved ? 'rgba(61,214,140,0.12)' : 'rgba(124,109,250,0.15)',
    border: `1px solid ${saved ? 'rgba(61,214,140,0.3)' : 'rgba(124,109,250,0.35)'}`,
    color: saved ? '#3dd68c' : '#a89cf7',
    padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
    fontFamily: 'inherit', transition: 'all 0.15s',
  });

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100vh', background: '#080810' }}>
      {/* ── Top bar ── */}
      <div
        className="shrink-0 flex items-center px-5 gap-3"
        style={{ height: 48, borderBottom: '1px solid rgba(255,255,255,0.07)', background: '#080810' }}
      >
        <span className="font-semibold text-white" style={{ fontSize: 16 }}>Integrations</span>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto p-6">
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── Page header ── */}
          <div style={{ marginBottom: 4 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#ffffff', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
              Connect your tools
            </h1>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.48)', lineHeight: 1.65, margin: '0 0 18px', maxWidth: 520 }}>
              Funnl works with the apps you already use. Connect once, then push deals to Notion, share in Slack, and schedule calls in Google Calendar — all from the deal detail panel.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                {
                  icon: <img src="https://cdn.simpleicons.org/notion/ffffff" width="12" height="12" alt="Notion" style={{ display: 'block' }} />,
                  label: 'Export deals',
                },
                {
                  icon: <img src="https://a.slack-edge.com/80588/marketing/img/icons/icon_slack_hash_colored.png" width="13" height="13" alt="Slack" style={{ display: 'block' }} />,
                  label: 'Share with team',
                },
                {
                  icon: <GCalLogo size={13} />,
                  label: 'Schedule calls',
                },
              ].map(({ icon, label }) => (
                <div
                  key={label}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 99, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}
                >
                  {icon}
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── All-connected banner ── */}
          {allConnected && (
            <div style={{ background: 'rgba(61,214,140,0.06)', border: '1px solid rgba(61,214,140,0.15)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Check size={14} style={{ color: '#3dd68c', flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
                All integrations connected — your workflow is fully set up
              </span>
            </div>
          )}

          {/* ── Google Calendar ── */}
          <div style={cardStyle}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <GCalLogo size={30} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-white font-semibold" style={{ fontSize: 15 }}>Google Calendar</span>
                <StatusBadge connected={!!integrations.calendar_enabled} label={integrations.calendar_enabled ? 'Connected' : 'Not granted'} />
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16 }}>
                {integrations.calendar_enabled ? (
                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(61,214,140,0.1)', border: '1px solid rgba(61,214,140,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Check size={20} style={{ color: '#3dd68c' }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 600, color: '#3dd68c', margin: '0 0 3px' }}>Google Calendar connected</p>
                      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', margin: 0 }}>Schedule calls directly from deals</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.65, marginBottom: 16 }}>
                      Your Google account is already connected to Funnl. Grant calendar access to schedule calls directly from deals.
                    </p>
                    <a
                      href={`${BACKEND_URL}/api/auth/google`}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        background: 'rgba(124,109,250,0.15)', border: '1px solid rgba(124,109,250,0.35)',
                        color: '#a89cf7', padding: '9px 18px', borderRadius: 10,
                        fontSize: 13, fontWeight: 600, textDecoration: 'none', fontFamily: 'inherit',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124,109,250,0.22)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(124,109,250,0.15)'; }}
                    >
                      <GCalLogo size={15} />
                      Grant Calendar Access
                    </a>
                  </div>
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
              <div className="flex items-center gap-2 mb-3">
                <span className="text-white font-semibold" style={{ fontSize: 15 }}>Notion</span>
                <StatusBadge connected={!!integrations.notion_connected} />
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16 }}>
                {integrations.notion_connected && !notionShowInputs ? (
                  /* ── Connected state ── */
                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(61,214,140,0.1)', border: '1px solid rgba(61,214,140,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Check size={20} style={{ color: '#3dd68c' }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 600, color: '#3dd68c', margin: '0 0 3px' }}>Notion connected</p>
                      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', margin: '0 0 10px' }}>
                        Saving deals to:{' '}
                        <span style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace', fontSize: 12 }}>
                          {integrations.notion_database_id ? `…${integrations.notion_database_id.slice(-8)}` : 'your database'}
                        </span>
                      </p>
                      <button
                        onClick={() => setNotionShowInputs(true)}
                        style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', textDecoration: 'underline' }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.38)'; }}
                      >
                        Change connection
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── Setup guide ── */
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.65)', margin: '0 0 16px' }}>How to connect Notion</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                      <div style={{ display: 'flex', gap: 12 }}>
                        <StepNum n={1} />
                        <div style={{ flex: 1, paddingTop: 1 }}>
                          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: 0 }}>
                            Go to <span style={{ color: 'rgba(255,255,255,0.8)' }}>notion.so/my-integrations</span>
                          </p>
                          <SetupLink href="https://notion.so/my-integrations">Open Notion</SetupLink>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 12 }}>
                        <StepNum n={2} />
                        <div style={{ flex: 1, paddingTop: 1 }}>
                          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: 0, lineHeight: 1.55 }}>
                            Click <strong style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>+ New Integration</strong>, name it <strong style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>Funnl</strong>, set type to <strong style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>Internal</strong>
                          </p>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 12 }}>
                        <StepNum n={3} />
                        <div style={{ flex: 1, paddingTop: 1 }}>
                          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: '0 0 8px' }}>
                            Copy your API key and paste below
                          </p>
                          <input
                            type="password"
                            className={inputCls}
                            style={inputStyle}
                            placeholder="secret_xxxxxxxxxxxxxxxxxxxxxxxx"
                            value={notionKey}
                            onChange={e => setNotionKey(e.target.value)}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 12 }}>
                        <StepNum n={4} />
                        <div style={{ flex: 1, paddingTop: 1 }}>
                          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: 0, lineHeight: 1.55 }}>
                            Open your Notion deals database, click <strong style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>···</strong> → <strong style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>Add connections</strong> → select <strong style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>Funnl</strong>
                          </p>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 12 }}>
                        <StepNum n={5} />
                        <div style={{ flex: 1, paddingTop: 1 }}>
                          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: '0 0 8px', lineHeight: 1.55 }}>
                            Copy the database ID from the URL{' '}
                            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>(32-character string after notion.so/)</span>
                          </p>
                          <input
                            type="text"
                            className={inputCls}
                            style={inputStyle}
                            placeholder="32-character ID from the URL"
                            value={notionDbId}
                            onChange={e => setNotionDbId(e.target.value)}
                          />
                        </div>
                      </div>

                    </div>

                    <div style={{ display: 'flex', gap: 8, marginTop: 20, alignItems: 'center' }}>
                      <button
                        onClick={handleSaveNotion}
                        disabled={notionSaving || (!notionKey && !notionDbId)}
                        style={{ ...primaryBtn(notionSaved), opacity: (notionSaving || (!notionKey && !notionDbId)) ? 0.4 : 1 }}
                      >
                        {notionSaved ? <><Check size={13} /> Connected</> : notionSaving ? 'Connecting…' : 'Connect Notion'}
                      </button>
                      {notionShowInputs && (
                        <button
                          onClick={() => setNotionShowInputs(false)}
                          style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', background: 'none', border: 'none', cursor: 'pointer', padding: '9px 12px', fontFamily: 'inherit' }}
                        >
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
              <img src="https://a.slack-edge.com/80588/marketing/img/icons/icon_slack_hash_colored.png" width="32" height="32" alt="Slack" style={{ display: 'block' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-white font-semibold" style={{ fontSize: 15 }}>Slack</span>
                <StatusBadge connected={!!integrations.slack_connected} />
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16 }}>
                {integrations.slack_connected && !slackShowInputs ? (
                  /* ── Connected state ── */
                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(61,214,140,0.1)', border: '1px solid rgba(61,214,140,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Check size={20} style={{ color: '#3dd68c' }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 600, color: '#3dd68c', margin: '0 0 3px' }}>Slack connected</p>
                      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', margin: '0 0 10px' }}>Sharing to your workspace channel</p>
                      <button
                        onClick={() => setSlackShowInputs(true)}
                        style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', textDecoration: 'underline' }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.38)'; }}
                      >
                        Change connection
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── Setup guide ── */
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.65)', margin: '0 0 16px' }}>How to connect Slack</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                      <div style={{ display: 'flex', gap: 12 }}>
                        <StepNum n={1} />
                        <div style={{ flex: 1, paddingTop: 1 }}>
                          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: 0 }}>
                            Go to <span style={{ color: 'rgba(255,255,255,0.8)' }}>api.slack.com/apps</span>
                          </p>
                          <SetupLink href="https://api.slack.com/apps">Open Slack API</SetupLink>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 12 }}>
                        <StepNum n={2} />
                        <div style={{ flex: 1, paddingTop: 1 }}>
                          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: 0, lineHeight: 1.55 }}>
                            Click <strong style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>Create New App</strong> → <strong style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>From scratch</strong> — name it <strong style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>Funnl</strong> and select your workspace
                          </p>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 12 }}>
                        <StepNum n={3} />
                        <div style={{ flex: 1, paddingTop: 1 }}>
                          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: 0, lineHeight: 1.55 }}>
                            Go to <strong style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>Incoming Webhooks</strong> → activate it → click <strong style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>Add New Webhook to Workspace</strong> and select the channel where deals should be shared
                          </p>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 12 }}>
                        <StepNum n={4} />
                        <div style={{ flex: 1, paddingTop: 1 }}>
                          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: '0 0 8px' }}>
                            Copy the webhook URL and paste below
                          </p>
                          <input
                            type="text"
                            className={inputCls}
                            style={inputStyle}
                            placeholder="https://hooks.slack.com/services/..."
                            value={slackWebhook}
                            onChange={e => setSlackWebhook(e.target.value)}
                          />
                        </div>
                      </div>

                    </div>

                    <div style={{ display: 'flex', gap: 8, marginTop: 20, alignItems: 'center' }}>
                      <button
                        onClick={handleSaveSlack}
                        disabled={slackSaving || !slackWebhook}
                        style={{ ...primaryBtn(slackSaved), opacity: (slackSaving || !slackWebhook) ? 0.4 : 1 }}
                      >
                        {slackSaved ? <><Check size={13} /> Connected</> : slackSaving ? 'Connecting…' : 'Connect Slack'}
                      </button>
                      {slackShowInputs && (
                        <button
                          onClick={() => setSlackShowInputs(false)}
                          style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', background: 'none', border: 'none', cursor: 'pointer', padding: '9px 12px', fontFamily: 'inherit' }}
                        >
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
