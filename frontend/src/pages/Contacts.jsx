import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Download, Users, LogOut, BookOpen, Settings as SettingsIcon,
  LayoutGrid, RefreshCw,
} from 'lucide-react';
import { getContacts, getFundSettings } from '../lib/api';
import { toast } from '../components/ui/sonner';
import ContactDetailPanel from '../components/ContactDetailPanel';

const STATUS_STYLES = {
  'In Pipeline': { bg: 'rgba(124,109,250,0.12)', color: '#7c6dfa', border: 'rgba(124,109,250,0.3)' },
  'In Review':   { bg: 'rgba(245,166,35,0.1)',   color: '#f5a623', border: 'rgba(245,166,35,0.3)' },
  'Portfolio':   { bg: 'rgba(61,214,140,0.1)',    color: '#3dd68c', border: 'rgba(61,214,140,0.3)' },
  'Passed':      { bg: 'rgba(255,255,255,0.05)',  color: 'rgba(255,255,255,0.35)', border: 'rgba(255,255,255,0.1)' },
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

const FILTERS = ['All', 'In Pipeline', 'In Review', 'Portfolio', 'Passed'];

export default function Contacts({ user, onLogout }) {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [selectedContact, setSelectedContact] = useState(null);
  const [fundName, setFundName] = useState('');

  const loadContacts = useCallback(() => {
    setLoading(true);
    getContacts()
      .then(data => setContacts(data || []))
      .catch(() => toast.error('Failed to load contacts'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadContacts();
    getFundSettings().then(s => s?.fund_name && setFundName(s.fund_name)).catch(() => {});
  }, [loadContacts]);

  const stats = useMemo(() => ({
    total: contacts.length,
    pipeline: contacts.filter(c => c.contact_status === 'In Pipeline').length,
    review: contacts.filter(c => c.contact_status === 'In Review').length,
    portfolio: contacts.filter(c => c.contact_status === 'Portfolio').length,
  }), [contacts]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return contacts
      .filter(c => filter === 'All' || c.contact_status === filter)
      .filter(c => !q || (c.name || '').toLowerCase().includes(q)
        || (c.company || '').toLowerCase().includes(q)
        || (c.email || '').toLowerCase().includes(q));
  }, [contacts, filter, search]);

  const exportCSV = () => {
    const headers = ['Name','Email','Company','Role','Sector','Stage','Geography','Status',
      'Relevance Score','Source','Intro Source','First Contacted','Last Contacted',
      'Times Contacted','Tags','Notes'];
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

  const SS = STATUS_STYLES;

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden" style={{ background: '#0c0c12', color: '#fff', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* ── Nav ── */}
      <nav className="h-14 shrink-0 flex items-center gap-2 px-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)', background: '#0c0c12' }}>
        {/* Brand */}
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
        <button onClick={() => navigate('/settings')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all" style={{ color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <BookOpen size={12} /><span className="hidden sm:inline">Fund Focus</span>
        </button>
        <button onClick={() => navigate('/settings')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all" style={{ color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <SettingsIcon size={12} />
        </button>
        <button onClick={onLogout} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all" style={{ color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <LogOut size={12} />
        </button>
      </nav>

      {/* ── Stats bar ── */}
      <div className="shrink-0 flex items-center gap-6 px-6 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.01)' }}>
        {[
          { label: 'Total Contacts', value: stats.total, color: 'rgba(255,255,255,0.7)' },
          { label: 'In Pipeline', value: stats.pipeline, color: '#7c6dfa' },
          { label: 'In Review', value: stats.review, color: '#f5a623' },
          { label: 'Portfolio', value: stats.portfolio, color: '#3dd68c' },
        ].map(s => (
          <div key={s.label} className="flex flex-col">
            <span className="font-bold text-2xl tabular-nums" style={{ color: s.color }}>{s.value}</span>
            <span className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{s.label}</span>
          </div>
        ))}
        <div className="ml-auto">
          <button onClick={loadContacts} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border transition-all" style={{ color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <RefreshCw size={11} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Table side */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

          {/* Toolbar */}
          <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            {/* Search */}
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
            <div className="flex items-center gap-1">
              {FILTERS.map(f => (
                <button
                  key={f}
                  data-testid={`filter-${f.toLowerCase().replace(/\s+/g, '-')}`}
                  onClick={() => setFilter(f)}
                  className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
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

            <div className="ml-auto">
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

          {/* Table */}
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center h-40 text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Loading contacts…
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-60 gap-3">
                <Users size={32} style={{ color: 'rgba(255,255,255,0.1)' }} />
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {contacts.length === 0
                    ? 'No contacts yet — click "Add to Pipeline" or "Save for Review" on any deal'
                    : 'No contacts match your filter'}
                </p>
              </div>
            ) : (
              <table className="w-full border-collapse text-sm" style={{ minWidth: 900 }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                    {['Name / Email', 'Company / Sector', 'Status', 'Score', 'Source', 'Intro Source', 'Geography', 'Last Contacted', 'Deals', 'Notes'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap border-b" style={{ color: 'rgba(255,255,255,0.35)', borderColor: 'rgba(255,255,255,0.07)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(contact => {
                    const ss = scoreStyle(contact.relevance_score);
                    const status = SS[contact.contact_status] || SS['Passed'];
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
                        {/* Name + email */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-white text-sm">{contact.name || '—'}</span>
                                {(contact.deal_count || 0) > 1 && (
                                  <span data-testid="returning-badge" className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(124,109,250,0.15)', color: '#7c6dfa', border: '1px solid rgba(124,109,250,0.25)' }}>
                                    Returning
                                  </span>
                                )}
                              </div>
                              <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{contact.email || '—'}</div>
                            </div>
                          </div>
                        </td>

                        {/* Company + sector */}
                        <td className="px-4 py-3">
                          <div className="font-medium text-white text-sm">{contact.company || '—'}</div>
                          <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{contact.sector || '—'}</div>
                        </td>

                        {/* Status badge */}
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: status.bg, color: status.color, border: `1px solid ${status.border}` }}>
                            {contact.contact_status || 'In Review'}
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

                        {/* Intro source */}
                        <td className="px-4 py-3 text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                          {contact.intro_source || '—'}
                        </td>

                        {/* Geography */}
                        <td className="px-4 py-3 text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                          {contact.geography || '—'}
                        </td>

                        {/* Last contacted */}
                        <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.45)' }}>
                          {fmtDate(contact.last_contacted)}
                        </td>

                        {/* Deal count */}
                        <td className="px-4 py-3">
                          <span className="text-sm font-bold tabular-nums" style={{ color: (contact.deal_count || 0) > 1 ? '#7c6dfa' : 'rgba(255,255,255,0.4)' }}>
                            {(contact.deal_count || 0) > 1 ? `${contact.deal_count}x` : '1'}
                          </span>
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
