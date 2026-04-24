import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, RefreshCw, Users, Mail, Building2, MapPin, Briefcase,
  Calendar, Star, ChevronRight, X, Plus, Tag, ExternalLink, Globe
} from 'lucide-react';
import { getContacts, getContactDeals, updateContact, rebuildContacts } from '../lib/api';
import { toast } from '../components/ui/sonner';
import { useNavigate } from 'react-router-dom';

/* ── Helpers ──────────────────────────────────────────────────────────────── */
const STAGE_COLORS = {
  'Inbound':         { bg: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.45)', border: 'rgba(255,255,255,0.1)' },
  'New':             { bg: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.45)', border: 'rgba(255,255,255,0.1)' },
  'First Look':      { bg: 'rgba(77,166,255,0.1)',   color: '#4da6ff',                border: 'rgba(77,166,255,0.25)' },
  'In Conversation': { bg: 'rgba(245,166,35,0.1)',   color: '#f5a623',                border: 'rgba(245,166,35,0.25)' },
  'Due Diligence':   { bg: 'rgba(124,109,250,0.12)', color: '#7c6dfa',                border: 'rgba(124,109,250,0.3)' },
  'Closed':          { bg: 'rgba(61,214,140,0.1)',   color: '#3dd68c',                border: 'rgba(61,214,140,0.25)' },
  'Watch List':      { bg: 'rgba(20,184,166,0.1)',   color: '#14b8a6',                border: 'rgba(20,184,166,0.25)' },
  'Passed':          { bg: 'rgba(240,82,82,0.08)',   color: '#f05252',                border: 'rgba(240,82,82,0.2)' },
  'Archived':        { bg: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.25)', border: 'rgba(255,255,255,0.07)' },
};
const stageStyle = (s) => STAGE_COLORS[s] || STAGE_COLORS['Inbound'];

const scoreColor = (s) => {
  if (s == null) return 'rgba(255,255,255,0.2)';
  if (s >= 70) return '#3dd68c';
  if (s >= 45) return '#f5a623';
  return '#f05252';
};

const fmtDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return '—'; }
};

const fmtDateShort = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
  catch { return '—'; }
};

const getInitials = (name, email) => {
  if (name) {
    const p = name.trim().split(/\s+/);
    return p.length === 1 ? p[0][0].toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase();
  }
  if (email) return email[0].toUpperCase();
  return '?';
};

const FILTER_TABS = ['All', 'First Look', 'In Conversation', 'Due Diligence', 'Closed', 'Watch List'];
  ['rgba(124,109,250,0.2)', '#7c6dfa'],
  ['rgba(77,166,255,0.18)', '#4da6ff'],
  ['rgba(61,214,140,0.15)', '#3dd68c'],
  ['rgba(245,166,35,0.15)', '#f5a623'],
  ['rgba(20,184,166,0.15)', '#14b8a6'],
];
const avatarColor = (email = '') => {
  const idx = email.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
};

const fmtEmail = (email) => {
  if (!email || email.endsWith('@deal.funnl')) return null;
  return email;
};

/* ── Subcomponents ────────────────────────────────────────────────────────── */
function StageBadge({ stage }) {
  const s = stageStyle(stage);
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {stage || 'Inbound'}
    </span>
  );
}

function InfoRow({ icon: Icon, label, value, href }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
      <Icon size={13} className="mt-0.5 shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }} />
      <span className="text-xs w-20 shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</span>
      {href
        ? <a href={href} className="text-xs hover:underline truncate" style={{ color: '#4da6ff' }}>{value}</a>
        : <span className="text-xs text-white truncate">{value}</span>}
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────────────────── */
export default function Contacts({ user, onLogout }) {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  // Detail panel state
  const [linkedDeals, setLinkedDeals] = useState([]);
  const [dealsLoading, setDealsLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const notesRef = useRef(null);

  /* ── Data loading ─────────────────────────────────────────────────────── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getContacts();
      if (data === null) return; // 401 handled in api.js
      setContacts(data || []);
    } catch {
      toast.error('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-rebuild on first load if table is empty
  const didAutoRebuild = useRef(false);
  useEffect(() => {
    if (!loading && contacts.length === 0 && !didAutoRebuild.current) {
      didAutoRebuild.current = true;
      handleRebuild(true);
    }
  }, [loading, contacts.length]); // eslint-disable-line

  // Load linked deals when contact changes
  useEffect(() => {
    if (!selected?.id) return;
    setNotes(selected.notes || '');
    setDealsLoading(true);
    getContactDeals(selected.id)
      .then(d => setLinkedDeals(d || []))
      .catch(() => setLinkedDeals([]))
      .finally(() => setDealsLoading(false));
  }, [selected?.id]); // eslint-disable-line

  /* ── Actions ──────────────────────────────────────────────────────────── */
  const handleRebuild = async (silent = false) => {
    if (rebuilding) return;
    setRebuilding(true);
    if (!silent) toast.info('Rebuilding contacts from all deals…');
    try {
      const res = await rebuildContacts();
      await load();
      if (!silent) toast.success(`Done — ${res?.created || 0} created, ${res?.skipped || 0} skipped`);
    } catch {
      if (!silent) toast.error('Rebuild failed');
    } finally {
      setRebuilding(false);
    }
  };

  const patchContact = async (id, data) => {
    try {
      await updateContact(id, data);
      setContacts(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
      if (selected?.id === id) setSelected(prev => ({ ...prev, ...data }));
    } catch {
      toast.error('Failed to save changes');
    }
  };

  const saveNotes = async () => {
    if (!selected || notes === (selected.notes || '')) return;
    setSavingNotes(true);
    await patchContact(selected.id, { notes });
    setSavingNotes(false);
  };

  const addTag = async () => {
    if (!selected) return;
    const t = tagInput.trim();
    if (!t || (selected.tags || []).includes(t)) { setTagInput(''); return; }
    const next = [...(selected.tags || []), t];
    setTagInput('');
    await patchContact(selected.id, { tags: next });
  };

  const removeTag = async (t) => {
    if (!selected) return;
    const next = (selected.tags || []).filter(x => x !== t);
    await patchContact(selected.id, { tags: next });
  };

  /* ── Derived data ─────────────────────────────────────────────────────── */
  const filtered = contacts.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (c.name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.company || '').toLowerCase().includes(q);
    const matchFilter = filter === 'All' || c.contact_status === filter;
    return matchSearch && matchFilter;
  });

  const pipelineCount = contacts.filter(c =>
    ['First Look', 'In Conversation', 'Due Diligence'].includes(c.contact_status)
  ).length;

  const avgScore = contacts.length
    ? Math.round(contacts.reduce((s, c) => s + (c.relevance_score || 0), 0) / contacts.length)
    : 0;

  /* ── Render ───────────────────────────────────────────────────────────── */
  return (
    <div
      data-testid="contacts-page"
      className="flex flex-col overflow-hidden"
      style={{ height: 'calc(100vh - 60px)', background: '#0d0d14', fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div
        className="shrink-0 px-6 py-3 border-b flex items-center justify-between gap-4"
        style={{ background: 'rgba(13,13,20,0.9)', borderColor: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)' }}
      >
        <div className="flex items-center gap-6">
          <h1 className="text-base font-semibold text-white tracking-tight">Contacts</h1>
          {/* Stats */}
          <div className="hidden sm:flex items-center gap-5">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'rgba(255,255,255,0.3)' }}>Total</span>
              <span className="text-sm font-bold text-white">{contacts.length}</span>
            </div>
            <div className="w-px h-6" style={{ background: 'rgba(255,255,255,0.07)' }} />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'rgba(255,255,255,0.3)' }}>In Pipeline</span>
              <span className="text-sm font-bold" style={{ color: '#7c6dfa' }}>{pipelineCount}</span>
            </div>
            <div className="w-px h-6" style={{ background: 'rgba(255,255,255,0.07)' }} />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'rgba(255,255,255,0.3)' }}>Avg Score</span>
              <span className="text-sm font-bold" style={{ color: scoreColor(avgScore) }}>{avgScore || '—'}</span>
            </div>
          </div>
        </div>

        <button
          data-testid="rebuild-contacts-button"
          onClick={() => handleRebuild(false)}
          disabled={rebuilding}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
          style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}
          onMouseEnter={e => !rebuilding && (e.currentTarget.style.background = 'rgba(255,255,255,0.09)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
        >
          <RefreshCw size={12} className={rebuilding ? 'animate-spin' : ''} />
          {rebuilding ? 'Rebuilding…' : 'Rebuild'}
        </button>
      </div>

      {/* ── Split body ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: Contact list ──────────────────────────────────────── */}
        <div
          className="flex flex-col border-r shrink-0"
          style={{ width: 340, background: '#11111a', borderColor: 'rgba(255,255,255,0.07)' }}
        >
          {/* Search */}
          <div className="px-3 pt-3 pb-2 shrink-0">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.3)' }} />
              <input
                data-testid="contact-search-input"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name, email, company…"
                className="w-full pl-7 pr-3 py-2 rounded-lg text-xs outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff' }}
                onFocus={e => (e.target.style.borderColor = 'rgba(124,109,250,0.5)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
              />
            </div>
          </div>

          {/* Filter tabs */}
          <div className="px-3 pb-2 shrink-0 flex gap-1 flex-wrap">
            {FILTER_TABS.map(tab => (
              <button
                key={tab}
                data-testid={`contact-filter-tab-${tab.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={() => setFilter(tab)}
                className="px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all"
                style={{
                  background: filter === tab ? 'rgba(124,109,250,0.15)' : 'transparent',
                  color: filter === tab ? '#7c6dfa' : 'rgba(255,255,255,0.35)',
                  border: `1px solid ${filter === tab ? 'rgba(124,109,250,0.35)' : 'transparent'}`,
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCw size={16} className="animate-spin" style={{ color: '#7c6dfa' }} />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 px-6 text-center">
                <Users size={28} style={{ color: 'rgba(255,255,255,0.12)' }} className="mb-3" />
                <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {contacts.length === 0 ? 'No contacts yet' : 'No matches found'}
                </p>
                {contacts.length === 0 && (
                  <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>
                    Rebuild to sync from your deals
                  </p>
                )}
              </div>
            ) : (
              filtered.map(c => {
                const [bgA, fgA] = avatarColor(c.email || c.name);
                const isActive = selected?.id === c.id;
                return (
                  <div
                    key={c.id}
                    data-testid={`contact-list-row-${c.id}`}
                    onClick={() => setSelected(c)}
                    className="flex items-start gap-3 px-3 py-3 cursor-pointer transition-all border-b"
                    style={{
                      background: isActive ? 'rgba(124,109,250,0.08)' : 'transparent',
                      borderColor: 'rgba(255,255,255,0.04)',
                      borderLeft: isActive ? '2px solid #7c6dfa' : '2px solid transparent',
                    }}
                    onMouseEnter={e => !isActive && (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                    onMouseLeave={e => !isActive && (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* Avatar */}
                    <div
                      className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: bgA, color: fgA }}
                    >
                      {getInitials(c.name, c.email)}
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-1">
                        <p className="text-sm font-medium text-white truncate">{c.name || c.email || '—'}</p>
                        <span className="text-[10px] shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          {fmtDateShort(c.last_contacted)}
                        </span>
                      </div>
                      {c.company && (
                          <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{c.company}</p>
                        )}
                      <div className="flex items-center gap-2 mt-1.5">
                        <StageBadge stage={c.contact_status} />
                        {c.relevance_score != null && (
                          <span className="text-[10px] font-bold font-mono" style={{ color: scoreColor(c.relevance_score) }}>
                            {c.relevance_score}
                          </span>
                        )}
                        {(c.deal_count || 0) > 1 && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'rgba(124,109,250,0.12)', color: '#7c6dfa' }}>
                            {c.deal_count}x
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer count */}
          {filtered.length > 0 && (
            <div className="px-3 py-2 shrink-0 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                {filtered.length} contact{filtered.length !== 1 ? 's' : ''}{filter !== 'All' ? ` · ${filter}` : ''}
              </p>
            </div>
          )}
        </div>

        {/* ── Right: Detail panel ─────────────────────────────────────── */}
        {selected ? (
          <DetailPanel
            key={selected.id}
            contact={selected}
            linkedDeals={linkedDeals}
            dealsLoading={dealsLoading}
            notes={notes}
            setNotes={setNotes}
            savingNotes={savingNotes}
            onNotesBlur={saveNotes}
            tagInput={tagInput}
            setTagInput={setTagInput}
            onAddTag={addTag}
            onRemoveTag={removeTag}
            onClose={() => setSelected(null)}
            onNavigateDeals={(dealId) => navigate(`/deals?deal=${dealId}`)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center" style={{ background: '#0d0d14' }}>
            <Users size={40} style={{ color: 'rgba(255,255,255,0.08)' }} className="mb-4" />
            <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Select a contact to view details
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Detail Panel ─────────────────────────────────────────────────────────── */
function DetailPanel({
  contact, linkedDeals, dealsLoading,
  notes, setNotes, savingNotes, onNotesBlur,
  tagInput, setTagInput, onAddTag, onRemoveTag,
  onClose, onNavigateDeals,
}) {
  const [bgA, fgA] = avatarColor(contact.email || contact.name);
  const ss = stageStyle(contact.contact_status);

  return (
    <div
      data-testid="contact-detail-panel"
      className="flex-1 overflow-y-auto"
      style={{ background: '#0d0d14' }}
    >
      <div className="max-w-2xl mx-auto px-6 py-6 flex flex-col gap-6">

        {/* ── Hero ─────────────────────────────────────────────────── */}
        <div className="flex items-start gap-5">
          {/* Large avatar */}
          <div
            className="h-16 w-16 shrink-0 rounded-full flex items-center justify-center text-xl font-bold border"
            style={{ background: bgA, color: fgA, borderColor: fgA + '44' }}
          >
            {getInitials(contact.name, contact.email)}
          </div>

          {/* Name / company / badges */}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-white leading-tight">{contact.name || '—'}</h2>
            {contact.company && (
              <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {contact.company}{contact.role ? ` · ${contact.role}` : ''}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <StageBadge stage={contact.contact_status} />
              {contact.relevance_score != null && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded border font-mono text-xs font-bold"
                  style={{ background: 'transparent', borderColor: scoreColor(contact.relevance_score) + '66', color: scoreColor(contact.relevance_score) }}
                >
                  <Star size={9} /> {contact.relevance_score}
                </span>
              )}
              {(contact.deal_count || 0) > 1 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: 'rgba(124,109,250,0.12)', color: '#7c6dfa', border: '1px solid rgba(124,109,250,0.25)' }}>
                  Returning · {contact.deal_count}×
                </span>
              )}
            </div>
          </div>

          {/* Close */}
          <button onClick={onClose} className="p-1.5 rounded-lg shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }}>
            <X size={15} />
          </button>
        </div>

        {/* ── Score bar ─────────────────────────────────────────────── */}
        {contact.relevance_score != null && (
          <div className="rounded-xl px-5 py-4" style={{ background: '#161622', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: 'rgba(255,255,255,0.3)' }}>Relevance Score</span>
              <span className="text-sm font-bold font-mono" style={{ color: scoreColor(contact.relevance_score) }}>{contact.relevance_score}/100</span>
            </div>
            <div className="flex gap-0.5">
              {Array.from({ length: 10 }, (_, i) => (
                <div
                  key={i}
                  className="h-1.5 flex-1 rounded-sm transition-colors"
                  style={{ background: i < Math.round((contact.relevance_score || 0) / 10) ? scoreColor(contact.relevance_score) : 'rgba(255,255,255,0.06)' }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Stats grid ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Deal Count', value: contact.deal_count ?? 1 },
            { label: 'First Contact', value: fmtDate(contact.first_contacted) },
            { label: 'Last Contact', value: fmtDate(contact.last_contacted) },
            { label: 'Sector', value: contact.sector || '—' },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl px-4 py-3" style={{ background: '#161622', border: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="text-[10px] uppercase tracking-widest font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</p>
              <p className="text-sm font-semibold text-white">{String(value)}</p>
            </div>
          ))}
        </div>

        {/* ── Contact info ──────────────────────────────────────────── */}
        <div className="rounded-xl px-5 py-4" style={{ background: '#161622', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-xs uppercase tracking-wider font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>Contact Info</p>
          <InfoRow icon={Mail}      label="Email"      value={fmtEmail(contact.email)}       href={fmtEmail(contact.email) ? `mailto:${contact.email}` : undefined} />
          <InfoRow icon={Building2} label="Company"    value={contact.company} />
          <InfoRow icon={Briefcase} label="Role"       value={contact.role} />
          <InfoRow icon={Globe}     label="Geography"  value={contact.geography} />
          <InfoRow icon={MapPin}    label="Stage"      value={contact.stage} />
          <InfoRow icon={Star}      label="Intro"      value={contact.intro_source} />
          {contact.warm_or_cold && (
            <div className="flex items-start gap-3 py-2">
              <Calendar size={13} className="mt-0.5 shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }} />
              <span className="text-xs w-20 shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }}>Source</span>
              <span
                className="text-xs px-2 py-0.5 rounded"
                style={{
                  background: contact.warm_or_cold.toLowerCase().includes('warm') ? 'rgba(61,214,140,0.1)' : 'rgba(255,255,255,0.04)',
                  color: contact.warm_or_cold.toLowerCase().includes('warm') ? '#3dd68c' : 'rgba(255,255,255,0.4)',
                  border: `1px solid ${contact.warm_or_cold.toLowerCase().includes('warm') ? 'rgba(61,214,140,0.2)' : 'rgba(255,255,255,0.08)'}`,
                }}
              >{contact.warm_or_cold}</span>
            </div>
          )}
        </div>

        {/* ── Linked deals ──────────────────────────────────────────── */}
        <div className="rounded-xl px-5 py-4" style={{ background: '#161622', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-xs uppercase tracking-wider font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Linked Deals{linkedDeals.length > 0 && <span className="ml-2 px-1.5 py-0.5 rounded text-[10px]" style={{ background: 'rgba(124,109,250,0.12)', color: '#7c6dfa' }}>{linkedDeals.length}</span>}
          </p>
          {dealsLoading ? (
            <div className="flex items-center gap-2 py-2">
              <RefreshCw size={12} className="animate-spin" style={{ color: '#7c6dfa' }} />
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading…</span>
            </div>
          ) : linkedDeals.length === 0 ? (
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>No linked deals found</p>
          ) : (
            <div className="space-y-2">
              {linkedDeals.map(deal => {
                const score = deal.thesis_match_score ?? deal.relevance_score;
                return (
                  <div
                    key={deal.id}
                    data-testid={`linked-deal-card-${deal.id}`}
                    onClick={() => onNavigateDeals && onNavigateDeals(deal.id)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{deal.subject || '(no subject)'}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {fmtDateShort(deal.received_date)}{deal.deal_stage ? ` · ${deal.deal_stage}` : deal.status ? ` · ${deal.status}` : ''}
                      </p>
                    </div>
                    {score != null && (
                      <span className="text-xs font-bold font-mono shrink-0" style={{ color: scoreColor(score) }}>{score}</span>
                    )}
                    <ChevronRight size={12} style={{ color: 'rgba(255,255,255,0.2)' }} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Notes ─────────────────────────────────────────────────── */}
        <div className="rounded-xl px-5 py-4" style={{ background: '#161622', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs uppercase tracking-wider font-semibold" style={{ color: 'rgba(255,255,255,0.3)' }}>Notes</p>
            {savingNotes && <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Saving…</span>}
          </div>
          <textarea
            data-testid="contact-notes-textarea"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={onNotesBlur}
            placeholder="Add notes about this contact…"
            rows={4}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: '#fff', lineHeight: 1.6 }}
            onFocus={e => (e.target.style.borderColor = 'rgba(124,109,250,0.4)')}
            onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.07)'; onNotesBlur(); }}
          />
        </div>

        {/* ── Tags ──────────────────────────────────────────────────── */}
        <div className="rounded-xl px-5 py-4" style={{ background: '#161622', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-xs uppercase tracking-wider font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>Tags</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {(contact.tags || []).map(t => (
              <span key={t} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: 'rgba(124,109,250,0.1)', color: '#7c6dfa', border: '1px solid rgba(124,109,250,0.25)' }}>
                <Tag size={9} />{t}
                <button onClick={() => onRemoveTag(t)} className="hover:opacity-70">
                  <X size={9} />
                </button>
              </span>
            ))}
            {(contact.tags || []).length === 0 && (
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>No tags yet</span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              data-testid="contact-tag-input"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onAddTag()}
              placeholder="Add tag…"
              className="flex-1 px-3 py-1.5 rounded-lg text-xs outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: '#fff' }}
              onFocus={e => (e.target.style.borderColor = 'rgba(124,109,250,0.4)')}
              onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.09)')}
            />
            <button
              data-testid="contact-add-tag-button"
              onClick={onAddTag}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ background: 'rgba(124,109,250,0.12)', color: '#7c6dfa', border: '1px solid rgba(124,109,250,0.25)' }}
            >
              <Plus size={12} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
