import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Download, Users, LogOut, BookOpen, Settings as SettingsIcon,
  LayoutGrid, RefreshCw, X, Bug,
} from 'lucide-react';
import { getContacts, getFundSettings, syncContactPipeline } from '../lib/api';
import { toast } from '../components/ui/sonner';
import ContactDetailPanel from '../components/ContactDetailPanel';

const STATUS_STYLES = {
  'First Look':      { bg: 'rgba(77,166,255,0.1)',   color: '#4da6ff', border: 'rgba(77,166,255,0.3)' },
  'In Conversation': { bg: 'rgba(245,166,35,0.1)',   color: '#f5a623', border: 'rgba(245,166,35,0.3)' },
  'Due Diligence':   { bg: 'rgba(124,109,250,0.12)', color: '#7c6dfa', border: 'rgba(124,109,250,0.3)' },
  'Closed':          { bg: 'rgba(61,214,140,0.1)',   color: '#3dd68c', border: 'rgba(61,214,140,0.3)' },
  'Watch List':      { bg: 'rgba(20,184,166,0.1)',   color: '#14b8a6', border: 'rgba(20,184,166,0.3)' },
  'Passed':          { bg: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.35)', border: 'rgba(255,255,255,0.1)' },
  // Legacy status aliases (pre-7-stage system)
  'In Pipeline':     { bg: 'rgba(77,166,255,0.1)',   color: '#4da6ff', border: 'rgba(77,166,255,0.3)' },
  'In Review':       { bg: 'rgba(245,166,35,0.1)',   color: '#f5a623', border: 'rgba(245,166,35,0.3)' },
  'Portfolio':       { bg: 'rgba(61,214,140,0.1)',   color: '#3dd68c', border: 'rgba(61,214,140,0.3)' },
};

const scoreStyle = (s) => {
  if (!s && s !== 0) return { color: 'rgba(255,255,255,0.2)', border: 'rgba(255,255,255,0.08)', bg: 'transparent' };
  if (s >= 70) return { color: '#3dd68c', border: 'rgba(61,214,140,0.3)', bg: 'rgba(61,214,140,0.1)' };
  if (s >= 45) return { color: '#f5a623', border: 'rgba(245,166,35,0.3)', bg: 'rgba(245,166,35,0.1)' };
  return { color: '#f05252', border: 'rgba(240,82,82,0.3)', bg: 'rgba(240,82,82,0.1)' };
};

const fmtDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return '—'; }
};

const FILTERS = ['All', 'First Look', 'In Conversation', 'Due Diligence', 'Closed', 'Watch List', 'Passed'];

export default function Contacts({ user, onLogout }) {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [selectedContact, setSelectedContact] = useState(null);
  const [fetchError, setFetchError] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [debugDismissed, setDebugDismissed] = useState(false);
  const [syncingPipeline, setSyncingPipeline] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);
  const [loadingDebug, setLoadingDebug] = useState(false);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await getContacts();

      if (data === null) {
        console.error('[Contacts] API returned null — likely a 401 auth failure');
        setFetchError('Session expired — please log out and log back in');
        setLoading(false);
        return;
      }

      console.log('[Contacts] Loaded:', data.length, 'contacts');
      setContacts(data);
      setLastSync(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('[Contacts] Error:', err);
      setFetchError(err?.message || 'Failed to load contacts');
      toast.error('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContacts();
    getFundSettings().catch(() => {});
  }, [loadContacts]);

  // Refresh contacts whenever the browser tab regains focus —
  // this catches the case where the user stages deals in ReviewMode
  // and then clicks back to the Contacts page.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadContacts();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [loadContacts]);

  const stats = useMemo(() => ({
    total: contacts.length,
    active: contacts.filter(c => ['First Look', 'In Conversation'].includes(c.contact_status)).length,
    diligence: contacts.filter(c => c.contact_status === 'Due Diligence').length,
    closed: contacts.filter(c => c.contact_status === 'Closed').length,
  }), [contacts]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return contacts
      .filter(c => filter === 'All' || c.contact_status === filter)
      .filter(c => !q || (c.company || '').toLowerCase().includes(q)
        || (c.name || '').toLowerCase().includes(q)
        || (c.email || '').toLowerCase().includes(q));
  }, [contacts, filter, search]);

  const exportCSV = () => {
    const headers = ['Name', 'Email', 'Company', 'Role', 'Sector', 'Stage', 'Geography',
      'Status', 'Relevance Score', 'Source', 'Intro Source',
      'First Contacted', 'Last Contacted', 'Deal Count', 'Tags', 'Notes'];
    const rows = filtered.map(c => [
      c.name || '', c.email || '', c.company || '', c.role || '',
      c.sector || '', c.stage || '', c.geography || '', c.contact_status || '',
      c.relevance_score ?? '', c.warm_or_cold || '', c.intro_source || '',
      c.first_contacted ? new Date(c.first_contacted).toLocaleDateString('en-US') : '',
      c.last_contacted  ? new Date(c.last_contacted).toLocaleDateString('en-US')  : '',
      c.deal_count || 1, (c.tags || []).join(', '), c.notes || '',
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contacts-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} contacts`);
  };

  const handleContactUpdated = useCallback((updated) => {
    setContacts(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c));
    setSelectedContact(prev => prev?.id === updated.id ? { ...prev, ...updated } : prev);
  }, []);

  const handlePipelineSync = async () => {
    setSyncingPipeline(true);
    try {
      const res = await syncContactPipeline();
      toast.success(`Sync complete — ${res.created} created, ${res.updated} updated (${res.skipped || 0} skipped)`);
      loadContacts();
    } catch {
      toast.error('Sync failed');
    } finally {
      setSyncingPipeline(false);
    }
  };

  const runDebugCheck = async () => {
    setLoadingDebug(true);
    try {
      const API = process.env.REACT_APP_BACKEND_URL;
      const res = await fetch(`${API}/api/debug/user-check`, { credentials: 'include' });
      const data = await res.json();
      setDebugInfo(data);
      console.log('[Contacts Debug]', data);
    } catch (e) {
      console.error('Debug check failed:', e);
      toast.error('Debug check failed');
    } finally {
      setLoadingDebug(false);
    }
  };

  const uid = user?.id || '?';

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden" style={{ background: '#0c0c12', color: '#fff', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* Debug Panel — shows live diagnostic info, dismiss to hide */}
      {!debugDismissed && (
        <div className="shrink-0 mx-4 mt-3 rounded-lg px-4 py-3 flex items-start gap-3" style={{ background: 'rgba(124,109,250,0.06)', border: '1px solid rgba(124,109,250,0.2)', fontSize: 11 }}>
          <Bug size={13} style={{ color: '#7c6dfa', marginTop: 2, flexShrink: 0 }} />
          <div className="flex-1 min-w-0">
            <div className="font-semibold mb-1" style={{ color: '#7c6dfa' }}>Contact Sync Debug</div>
            <div className="flex flex-wrap gap-x-6 gap-y-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
              <span>User ID: <span className="font-mono" style={{ color: 'rgba(255,255,255,0.75)' }}>{uid.slice(0, 8)}…</span></span>
              <span>Contacts in DB: <span style={{ color: '#3dd68c' }}>{loading ? '…' : contacts.length}</span></span>
              <span>Last fetched: <span style={{ color: 'rgba(255,255,255,0.75)' }}>{lastSync || 'never'}</span></span>
            </div>

            {/* Diagnostic results */}
            {debugInfo && (
              <div className="mt-2 p-2 rounded text-xs space-y-0.5" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div>JWT user ID: <span className="font-mono" style={{ color: 'rgba(255,255,255,0.75)' }}>{debugInfo.jwt_user_id?.slice(0, 12)}…</span></div>
                <div>DB user found: <span style={{ color: debugInfo.db_user_found ? '#3dd68c' : '#f05252' }}>{debugInfo.db_user_found ? 'yes' : 'NO'}</span></div>
                <div>IDs match: <span style={{ color: debugInfo.ids_match ? '#3dd68c' : '#f05252', fontWeight: 700 }}>{debugInfo.ids_match ? 'yes ✓' : 'NO — MISMATCH DETECTED'}</span></div>
                <div>Contacts for this user: <span style={{ color: '#3dd68c' }}>{debugInfo.contacts_for_this_user}</span></div>
                <div>Total contacts in table: <span style={{ color: 'rgba(255,255,255,0.6)' }}>{debugInfo.total_contacts_in_table}</span></div>
                {debugInfo.all_contact_user_ids?.length > 0 && (
                  <div className="font-mono text-xs break-all" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    Contact UIDs: {debugInfo.all_contact_user_ids.map(id => id?.slice(0, 8)).join(', ')}
                  </div>
                )}
              </div>
            )}

            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <button
                data-testid="debug-sync-pipeline"
                onClick={handlePipelineSync}
                disabled={syncingPipeline}
                className="px-3 py-1 rounded text-xs font-medium transition-all disabled:opacity-50"
                style={{ background: 'rgba(124,109,250,0.15)', color: '#7c6dfa', border: '1px solid rgba(124,109,250,0.3)' }}
              >
                {syncingPipeline ? 'Syncing…' : 'Sync all pipeline deals'}
              </button>
              <button
                data-testid="debug-run-diagnostic"
                onClick={runDebugCheck}
                disabled={loadingDebug}
                className="px-3 py-1 rounded text-xs font-medium transition-all disabled:opacity-50"
                style={{ background: 'rgba(245,166,35,0.1)', color: '#f5a623', border: '1px solid rgba(245,166,35,0.3)' }}
              >
                {loadingDebug ? 'Checking…' : 'Run diagnostic'}
              </button>
              <button
                data-testid="debug-refresh"
                onClick={loadContacts}
                className="px-3 py-1 rounded text-xs font-medium transition-all"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                Refresh
              </button>
              {fetchError && <span style={{ color: '#f05252', fontSize: 10 }}>Error: {fetchError}</span>}
            </div>
          </div>
          <button onClick={() => setDebugDismissed(true)} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
            <X size={13} />
          </button>
        </div>
      )}

      {/* Nav */}
      <nav className="h-14 shrink-0 flex items-center gap-2 px-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)', background: '#0c0c12' }}>
        <div className="flex items-center gap-2 mr-auto">
          <span className="text-white font-bold tracking-tight select-none" style={{ fontSize: 22, letterSpacing: '-0.03em' }}>funnl</span>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#7c6dfa', border: '1px solid rgba(124,109,250,0.35)', borderRadius: 4, padding: '1px 5px', letterSpacing: '0.08em', lineHeight: 1.8 }}>BETA</span>
        </div>
        <button onClick={() => navigate('/')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all" style={{ color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <LayoutGrid size={12} /><span className="hidden sm:inline">Deals</span>
        </button>
        <button onClick={() => navigate('/contacts')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all" style={{ color: '#7c6dfa', border: '1px solid rgba(124,109,250,0.3)', background: 'rgba(124,109,250,0.08)' }}>
          <Users size={12} /><span className="hidden sm:inline">Contacts</span>
        </button>
        <button onClick={() => navigate('/fund-focus')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all" style={{ color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <BookOpen size={12} /><span className="hidden sm:inline">Fund Focus</span>
        </button>
        <button onClick={() => navigate('/settings')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all" style={{ color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <SettingsIcon size={12} />
        </button>
        <button onClick={onLogout} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all" style={{ color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <LogOut size={12} />
        </button>
      </nav>

      {/* Stats bar */}
      <div className="shrink-0 flex items-center gap-6 px-6 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.01)' }}>
        {[
          { label: 'Total Contacts',  value: stats.total,     color: 'rgba(255,255,255,0.7)' },
          { label: 'Active',          value: stats.active,    color: '#f5a623' },
          { label: 'In Diligence',    value: stats.diligence, color: '#7c6dfa' },
          { label: 'Closed',          value: stats.closed,    color: '#3dd68c' },
        ].map(s => (
          <div key={s.label} className="flex flex-col">
            <span className="font-bold text-2xl tabular-nums" style={{ color: s.color }}>{s.value}</span>
            <span className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{s.label}</span>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <button
            data-testid="refresh-contacts-btn"
            onClick={loadContacts}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border transition-all"
            style={{ color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <RefreshCw size={11} /> Refresh
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">

        {/* Table side */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

          {/* Toolbar */}
          <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <div className="relative flex-1 max-w-xs">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.3)' }} />
              <input
                data-testid="contacts-search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name, company, email…"
                className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: '#fff' }}
              />
            </div>

            {/* Filter tabs */}
            <div className="flex items-center gap-1 overflow-x-auto">
              {FILTERS.map(f => (
                <button
                  key={f}
                  data-testid={`filter-${f.toLowerCase().replace(/\s+/g, '-')}`}
                  onClick={() => setFilter(f)}
                  className="px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap"
                  style={{
                    background: filter === f ? 'rgba(124,109,250,0.15)' : 'transparent',
                    color: filter === f ? '#7c6dfa' : 'rgba(255,255,255,0.4)',
                    border: filter === f ? '1px solid rgba(124,109,250,0.3)' : '1px solid transparent',
                  }}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="ml-auto shrink-0">
              <button
                data-testid="export-csv-btn"
                onClick={exportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                style={{ color: '#3dd68c', border: '1px solid rgba(61,214,140,0.25)', background: 'rgba(61,214,140,0.06)' }}
              >
                <Download size={12} /> Export CSV
              </button>
            </div>
          </div>

          {/* Error banner */}
          {fetchError && (
            <div className="mx-4 mt-3 px-4 py-3 rounded-lg text-sm" style={{ background: 'rgba(240,82,82,0.08)', border: '1px solid rgba(240,82,82,0.3)', color: '#f05252' }}>
              <strong>Fetch error:</strong> {fetchError}
            </div>
          )}

          {/* Table */}
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center h-40 text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Loading contacts…
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-60 gap-3">
                {fetchError?.includes('Session') ? (
                  <div style={{ textAlign: 'center' }}>
                    <p className="text-sm mb-3" style={{ color: '#f05252' }}>
                      {fetchError}
                    </p>
                    <button
                      onClick={onLogout}
                      className="text-xs px-4 py-2 rounded-lg"
                      style={{
                        background: 'rgba(124,109,250,0.15)',
                        color: '#7c6dfa',
                        border: '1px solid rgba(124,109,250,0.3)',
                      }}
                    >
                      Log out and log back in
                    </button>
                  </div>
                ) : (
                  <>
                    <Users size={32} style={{ color: 'rgba(255,255,255,0.1)' }} />
                    <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      {contacts.length === 0
                        ? 'No contacts yet — move deals into the pipeline to start tracking founders'
                        : 'No contacts match your filter'}
                    </p>
                    {contacts.length === 0 && (
                      <button
                        onClick={() => navigate('/settings')}
                        className="text-xs px-3 py-1.5 rounded-lg border transition-all"
                        style={{ color: '#7c6dfa', border: '1px solid rgba(124,109,250,0.3)', background: 'rgba(124,109,250,0.07)' }}
                      >
                        Sync from pipeline in Settings
                      </button>
                    )}
                  </>
                )}
              </div>
            ) : (
              <table className="w-full border-collapse text-sm" style={{ minWidth: 900 }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                    {['Company / Founder', 'Email / Sector', 'Status', 'Score', 'Source', 'Geography', 'Last Contacted', 'Deals', 'Notes'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap border-b" style={{ color: 'rgba(255,255,255,0.35)', borderColor: 'rgba(255,255,255,0.07)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(contact => {
                    const ss = scoreStyle(contact.relevance_score);
                    const statusStyle = STATUS_STYLES[contact.contact_status] || STATUS_STYLES['Passed'];
                    const isSelected = selectedContact?.id === contact.id;
                    return (
                      <tr
                        key={contact.id}
                        data-testid={`contact-row-${contact.id}`}
                        onClick={() => setSelectedContact(isSelected ? null : contact)}
                        className="cursor-pointer transition-colors border-b"
                        style={{
                          borderColor: 'rgba(255,255,255,0.05)',
                          background: isSelected ? 'rgba(124,109,250,0.07)' : 'transparent',
                        }}
                        onMouseEnter={e => !isSelected && (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                        onMouseLeave={e => !isSelected && (e.currentTarget.style.background = 'transparent')}
                      >
                        {/* Company (primary) + founder name */}
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <div className="font-semibold text-white text-sm">{contact.company || contact.name || '—'}</div>
                            <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{contact.name || '—'}</div>
                          </div>
                        </td>

                        {/* Email + sector */}
                        <td className="px-4 py-3">
                          <div className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>{contact.email || '—'}</div>
                          <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{contact.sector || '—'}</div>
                        </td>

                        {/* Status badge */}
                        <td className="px-4 py-3">
                          <span
                            data-testid={`status-badge-${contact.id}`}
                            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
                            style={{ background: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}` }}
                          >
                            {contact.contact_status || 'First Look'}
                          </span>
                        </td>

                        {/* Score */}
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center justify-center h-6 px-1.5 rounded border font-mono text-xs font-bold" style={{ minWidth: 34, background: ss.bg, borderColor: ss.border, color: ss.color }}>
                            {contact.relevance_score ?? '—'}
                          </span>
                        </td>

                        {/* Source (warm/cold) */}
                        <td className="px-4 py-3">
                          {contact.warm_or_cold ? (
                            <span className="text-xs px-2 py-0.5 rounded" style={{
                              background: contact.warm_or_cold.toLowerCase().includes('warm') ? 'rgba(61,214,140,0.1)' : 'rgba(255,255,255,0.05)',
                              color: contact.warm_or_cold.toLowerCase().includes('warm') ? '#3dd68c' : 'rgba(255,255,255,0.4)',
                              border: `1px solid ${contact.warm_or_cold.toLowerCase().includes('warm') ? 'rgba(61,214,140,0.25)' : 'rgba(255,255,255,0.1)'}`,
                            }}>
                              {contact.warm_or_cold}
                            </span>
                          ) : <span style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>}
                        </td>

                        {/* Geography */}
                        <td className="px-4 py-3 text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                          {contact.geography || '—'}
                        </td>

                        {/* Last contacted */}
                        <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.45)' }}>
                          {fmtDate(contact.last_contacted)}
                        </td>

                        {/* Deal count + returning badge */}
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-bold tabular-nums" style={{ color: (contact.deal_count || 0) > 1 ? '#7c6dfa' : 'rgba(255,255,255,0.4)' }}>
                              {(contact.deal_count || 0) > 1 ? `${contact.deal_count}x` : '1'}
                            </span>
                            {(contact.deal_count || 0) > 1 && (
                              <span
                                data-testid="returning-badge"
                                className="text-[9px] font-bold px-1.5 py-0.5 rounded w-fit"
                                style={{ background: 'rgba(124,109,250,0.15)', color: '#7c6dfa', border: '1px solid rgba(124,109,250,0.25)' }}
                              >
                                Returning
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Notes preview */}
                        <td className="px-4 py-3 max-w-[180px]">
                          <span className="text-xs truncate block" style={{ color: 'rgba(255,255,255,0.35)' }}>
                            {contact.notes ? contact.notes.slice(0, 50) + (contact.notes.length > 50 ? '…' : '') : '—'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Detail panel */}
        {selectedContact && (
          <ContactDetailPanel
            contact={selectedContact}
            onClose={() => setSelectedContact(null)}
            onUpdated={handleContactUpdated}
            onNavigateDeals={() => navigate('/')}
          />
        )}
      </div>
    </div>
  );
}
