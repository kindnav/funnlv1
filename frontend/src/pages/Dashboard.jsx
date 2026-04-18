import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Search, RefreshCw, Plus, Mail, Settings as SettingsIcon,
  ChevronDown, LogOut, Inbox, BookOpen, LayoutGrid, Send, Layers, Filter
} from 'lucide-react';
import DetailPanel from '../components/DetailPanel';
import ProcessEmailModal from '../components/ProcessEmailModal';
import OnboardingChecklist from '../components/OnboardingChecklist';
import ProductTour from '../components/ProductTour';
import { getDeals, getStats, triggerSync, updateDeal, getFundSettings } from '../lib/api';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// ── Helpers ──────────────────────────────────────────────────────────────────
const CATEGORY_STYLES = {
  'Founder pitch': 'bg-[#7c6dfa]/10 text-[#7c6dfa] border-[#7c6dfa]/30',
  'Warm intro': 'bg-[#4da6ff]/10 text-[#4da6ff] border-[#4da6ff]/30',
  'LP / investor relations': 'bg-[#2dd4bf]/10 text-[#2dd4bf] border-[#2dd4bf]/30',
  'Portfolio company update': 'bg-[#3dd68c]/10 text-[#3dd68c] border-[#3dd68c]/30',
  'Service provider / vendor': 'bg-[#f05252]/10 text-[#f05252] border-[#f05252]/30',
  'Recruiter / hiring': 'bg-[#f05252]/10 text-[#f05252] border-[#f05252]/30',
  'Spam / irrelevant': 'bg-[#f05252]/10 text-[#f05252] border-[#f05252]/30',
};
const getCatStyle = (cat) =>
  CATEGORY_STYLES[cat] || 'bg-[rgba(255,255,255,0.05)] text-[rgba(255,255,255,0.35)] border-[rgba(255,255,255,0.08)]';

const getScoreStyle = (s) => {
  if (s >= 7) return 'bg-[#3dd68c]/10 text-[#3dd68c] border-[#3dd68c]/30';
  if (s >= 4) return 'bg-[#f5a623]/10 text-[#f5a623] border-[#f5a623]/30';
  return 'bg-[#f05252]/10 text-[#f05252] border-[#f05252]/30';
};

const StatusDot = ({ status }) => {
  if (status === 'New')
    return <div className="w-2 h-2 rounded-full bg-[#7c6dfa] shadow-[0_0_6px_rgba(124,109,250,0.9)]" />;
  if (status === 'Reviewed')
    return <div className="w-2 h-2 rounded-full bg-[#3dd68c] opacity-50" />;
  return <div className="w-2 h-2 rounded-full bg-[rgba(255,255,255,0.15)]" />;
};

const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt)) return '—';
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const FILTERS = ['All', 'New', 'Score ≥ 7', 'Pitches', 'Warm Intros'];

// ── Component ────────────────────────────────────────────────────────────────
export default function Dashboard({ user, onLogout }) {
  const [deals, setDeals] = useState([]);
  const [stats, setStats] = useState({ total: 0, founder_pitches: 0, avg_relevance: 0, high_score: 0, unreviewed: 0 });
  const [fundName, setFundName] = useState('');
  const [fundSettings, setFundSettings] = useState({});
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  // Onboarding: only show once, only if no deals on first load
  const [showChecklist, setShowChecklist] = useState(false);
  const [checklistReady, setChecklistReady] = useState(false);
  // Product tour
  const [showTour, setShowTour] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Auto-open deal detail if returning from ReviewMode with a deal ID
  useEffect(() => {
    if (location.state?.openDealId && deals.length > 0) {
      const deal = deals.find(d => d.id === location.state.openDealId);
      if (deal) setSelectedDeal(deal);
    }
  }, [location.state, deals]);

  // Product tour: show after deals load, if not yet dismissed
  useEffect(() => {
    if (deals.length > 0 && !showTour && localStorage.getItem('vc_tour_dismissed') !== '1') {
      const t = setTimeout(() => setShowTour(true), 900);
      return () => clearTimeout(t);
    }
  }, [deals.length]); // eslint-disable-line

  const fetchAll = useCallback(async () => {
    try {
      const [d, s, f] = await Promise.all([getDeals(), getStats(), getFundSettings()]);
      if (d) setDeals(d);
      if (s) setStats(s);
      if (f) {
        setFundSettings(f);
        if (f.fund_name) setFundName(f.fund_name);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Decide whether to show onboarding checklist (only on first load)
  useEffect(() => {
    if (!loading && !checklistReady) {
      setChecklistReady(true);
      if (!fundSettings?.onboarding_complete && deals.length === 0) {
        setShowChecklist(true);
      }
    }
  }, [loading, checklistReady, fundSettings, deals]);

  const filteredDeals = useMemo(() => {
    let list = deals;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (d) =>
          d.sender_name?.toLowerCase().includes(q) ||
          d.company_name?.toLowerCase().includes(q) ||
          d.subject?.toLowerCase().includes(q) ||
          d.summary?.toLowerCase().includes(q) ||
          d.sector?.toLowerCase().includes(q)
      );
    }
    switch (filter) {
      case 'New': return list.filter((d) => d.status === 'New');
      case 'Score ≥ 7': return list.filter((d) => (d.relevance_score || 0) >= 7);
      case 'Pitches': return list.filter((d) => d.category === 'Founder pitch');
      case 'Warm Intros': return list.filter((d) => d.category === 'Warm intro');
      default: return list;
    }
  }, [deals, filter, search]);

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncResult(null);
    const dealsCountBefore = deals.length;
    try {
      await triggerSync();
    } catch (e) {
      // Even if the trigger call itself fails, don't block the user
      console.warn('Sync trigger error:', e.message);
    }
    // Sync runs in the background — poll every 10s for up to 4 minutes
    setSyncResult({ status: 'background' });
    let polls = 0;
    const maxPolls = 24; // 24 × 10s = 240s (sync can take ~3min for large inboxes)
    const poll = setInterval(async () => {
      polls++;
      try {
        const [d, s] = await Promise.all([getDeals(), getStats()]);
        if (d) setDeals(d);
        if (s) setStats(s);
        const newDeals = (d || []).length - dealsCountBefore;
        if (polls >= maxPolls) {
          clearInterval(poll);
          setIsSyncing(false);
          setSyncResult({ status: 'done', new_deals: Math.max(0, newDeals) });
          setTimeout(() => setSyncResult(null), 6000);
        }
      } catch (_) {
        // ignore poll errors
      }
    }, 10000);
  };

  const handleProcessed = (newDeal) => {
    setDeals((prev) => [newDeal, ...prev]);
    setStats((prev) => ({ ...prev, total: prev.total + 1, unreviewed: prev.unreviewed + 1 }));
  };

  const handleDealUpdated = (updated) => {
    setDeals((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    if (selectedDeal?.id === updated.id) setSelectedDeal(updated);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0c0c12] overflow-hidden" data-testid="dashboard">
      {/* Top Nav */}
      <nav className="h-14 shrink-0 border-b border-[rgba(255,255,255,0.07)] flex items-center px-5 gap-4 bg-[#0c0c12]">
        <div className="flex items-center gap-2.5 mr-auto">
          <div
            className="w-7 h-7 rounded flex items-center justify-center text-white font-bold text-xs shrink-0"
            style={{ background: 'linear-gradient(135deg,#7c6dfa,#5b4de8)' }}
          >
            {fundName
              ? fundName.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
              : 'VC'}
          </div>
          <div className="hidden sm:block">
            <span className="text-white font-semibold text-sm" data-testid="fund-name-display">
              {fundName || 'Your Fund'}
            </span>
            <span className="text-[rgba(255,255,255,0.3)] text-xs ml-2 font-mono tracking-wide">
              deal flow intelligence
            </span>
          </div>
        </div>

        {/* Gmail status */}
        {user && (
          <div
            data-testid="gmail-status"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-mono"
            style={{
              background: user.gmail_connected ? 'rgba(61,214,140,0.08)' : 'rgba(245,166,35,0.08)',
              border: user.gmail_connected ? '1px solid rgba(61,214,140,0.25)' : '1px solid rgba(245,166,35,0.25)',
              color: user.gmail_connected ? '#3dd68c' : '#f5a623',
            }}
          >
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: user.gmail_connected ? '#3dd68c' : '#f5a623',
                boxShadow: user.gmail_connected ? '0 0 5px #3dd68c' : 'none',
              }}
            />
            <span className="hidden sm:inline">{user.email || 'Connected'}</span>
            <span className="sm:hidden">Gmail</span>
          </div>
        )}

        <button
          data-testid="pipeline-btn"
          onClick={() => navigate('/pipeline')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all"
          style={{ color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.07)', background: 'transparent' }}
        >
          <LayoutGrid size={12} />
          <span className="hidden sm:inline">Pipeline</span>
        </button>
        <button
          data-testid="review-mode-btn"
          onClick={() => navigate('/review')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-all"
          style={{
            background: 'linear-gradient(135deg, rgba(124,109,250,0.18), rgba(91,77,232,0.1))',
            border: '1px solid rgba(124,109,250,0.4)',
            color: '#a89cf7',
            boxShadow: '0 0 12px rgba(124,109,250,0.15)',
          }}
        >
          <Layers size={12} />
          <span className="hidden sm:inline">Review Mode</span>
          <span className="sm:hidden">Review</span>
        </button>
        <a
          data-testid="enable-sending-btn"
          href={`${BACKEND_URL}/api/auth/google`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all"
          style={{
            background: 'rgba(77,166,255,0.08)',
            border: '1px solid rgba(77,166,255,0.25)',
            color: '#4da6ff',
          }}
          title="Click to grant Gmail send permission — required for one-click email replies"
        >
          <Send size={12} />
          <span className="hidden sm:inline">Enable Sending</span>
        </a>
        <button
          data-testid="fund-thesis-btn"
          onClick={() => navigate('/settings')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all"
          style={{
            background: 'rgba(124,109,250,0.08)',
            border: '1px solid rgba(124,109,250,0.25)',
            color: '#7c6dfa',
          }}
        >
          <BookOpen size={13} />
          <span className="hidden sm:inline">Fund Focus</span>
        </button>
        <button
          data-testid="logout-btn"
          onClick={onLogout}
          className="text-[rgba(255,255,255,0.35)] hover:text-white transition-colors p-1"
        >
          <LogOut size={15} />
        </button>
      </nav>

      {/* Stats Bar */}
      <div className="h-16 shrink-0 border-b border-[rgba(255,255,255,0.05)] flex items-center px-5 gap-1 bg-[#0c0c12]">
        {[
          { label: 'Total Inbound', value: stats.total, color: 'rgba(255,255,255,0.7)' },
          { label: 'Founder Pitches', value: stats.founder_pitches, color: '#7c6dfa' },
          { label: 'Avg Relevance', value: stats.avg_relevance, color: '#f5a623' },
          { label: 'Score ≥ 8', value: stats.high_score, color: '#3dd68c' },
          { label: 'Unreviewed', value: stats.unreviewed, color: '#4da6ff' },
        ].map(({ label, value, color }, i) => (
          <div key={label} className="flex-1 flex flex-col items-center justify-center">
            {i > 0 && <div className="absolute h-6 w-px bg-[rgba(255,255,255,0.05)]" style={{ left: `${(i / 5) * 100}%` }} />}
            <span className="text-xl font-bold font-mono" style={{ color }} data-testid={`stat-${label.toLowerCase().replace(/\s/g,'-')}`}>
              {value}
            </span>
            <span className="text-[rgba(255,255,255,0.3)] text-xs uppercase tracking-wider mt-0.5 hidden sm:block">
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="h-12 shrink-0 border-b border-[rgba(255,255,255,0.05)] flex items-center px-4 gap-3 bg-[#0c0c12]">
        {/* Search */}
        <div className="flex items-center gap-2 flex-1 max-w-xs bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.07)] rounded-lg px-3 py-1.5">
          <Search size={13} className="text-[rgba(255,255,255,0.3)] shrink-0" />
          <input
            data-testid="search-input"
            type="text"
            placeholder="Search deals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm text-white placeholder-[rgba(255,255,255,0.25)] focus:outline-none flex-1 min-w-0"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              data-testid={`filter-${f.toLowerCase().replace(/[^a-z0-9]/g,'-')}`}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                filter === f
                  ? 'bg-[#7c6dfa]/20 text-[#7c6dfa] border border-[#7c6dfa]/30'
                  : 'text-[rgba(255,255,255,0.4)] hover:text-white hover:bg-[rgba(255,255,255,0.05)]'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            data-testid="sync-now-btn"
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all disabled:opacity-50"
            style={syncResult?.status === 'done' ? {
              background: 'rgba(61,214,140,0.08)',
              border: '1px solid rgba(61,214,140,0.25)',
              color: '#3dd68c',
            } : syncResult?.status === 'background' ? {
              background: 'rgba(77,166,255,0.08)',
              border: '1px solid rgba(77,166,255,0.25)',
              color: '#4da6ff',
            } : {
              color: 'rgba(255,255,255,0.5)',
              border: '1px solid rgba(255,255,255,0.07)',
              background: 'transparent',
            }}
          >
            <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">
              {isSyncing && syncResult?.status !== 'background'
                ? 'Triggering...'
                : syncResult?.status === 'background'
                  ? 'Syncing inbox...'
                  : syncResult?.status === 'done'
                    ? `Synced${syncResult.new_deals > 0 ? ` · ${syncResult.new_deals} new` : ' · Up to date'}`
                    : 'Sync Now'}
            </span>
          </button>
          <button
            data-testid="process-email-btn"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 bg-[#7c6dfa] hover:bg-[#6b5ded] text-white text-xs font-medium px-3 py-1.5 rounded-md transition-all"
            style={{ boxShadow: '0 0 12px rgba(124,109,250,0.3)' }}
          >
            <Plus size={12} />
            <span className="hidden sm:inline">Process Email</span>
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Deals table / checklist / empty states */}
        <div className="flex-1 overflow-auto flex flex-col">
          {loading ? (
            /* ── Loading / first sync state ── */
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: 'rgba(124,109,250,0.3)', borderTopColor: '#7c6dfa' }} />
              <div className="text-center">
                <p className="text-white text-sm font-medium mb-1">Analyzing your inbox...</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Claude is reading your recent emails. This takes about 30 seconds for the first batch.
                </p>
              </div>
            </div>
          ) : showChecklist ? (
            /* ── Onboarding checklist (new users only) ── */
            <OnboardingChecklist
              user={user}
              deals={deals}
              fundSettings={fundSettings}
              isSyncing={isSyncing}
              onDismiss={() => {
                setShowChecklist(false);
                setFundSettings(fs => ({ ...fs, onboarding_complete: true }));
              }}
              onSyncNow={handleSync}
              onOpenSettings={() => navigate('/settings')}
              onProcessEmail={() => setShowModal(true)}
            />
          ) : filteredDeals.length === 0 && deals.length === 0 ? (
            /* ── True empty state — no deals at all ── */
            <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6 text-center" data-testid="empty-no-deals">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <Inbox size={24} style={{ color: 'rgba(255,255,255,0.2)' }} />
              </div>
              <div>
                <p className="text-white font-semibold mb-1.5">Your deal flow inbox is empty</p>
                <p className="text-xs leading-relaxed max-w-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  New emails are synced automatically every 15 minutes. Or process an email manually to get started.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  data-testid="empty-sync-btn"
                  onClick={handleSync}
                  disabled={isSyncing}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium border transition-all disabled:opacity-50"
                  style={{ color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)' }}
                >
                  <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
                  Sync now
                </button>
                <button
                  data-testid="empty-process-btn"
                  onClick={() => setShowModal(true)}
                  className="flex items-center gap-1.5 bg-[#7c6dfa] hover:bg-[#6b5ded] text-white text-xs font-medium px-4 py-2 rounded-lg transition-all"
                >
                  <Plus size={12} />
                  Process Email
                </button>
              </div>
            </div>
          ) : filteredDeals.length === 0 ? (
            /* ── Filter empty state — deals exist but filter returns nothing ── */
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center" data-testid="empty-filtered">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <Filter size={20} style={{ color: 'rgba(255,255,255,0.2)' }} />
              </div>
              <div>
                <p className="text-white font-semibold mb-1.5">No deals match this filter</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Try a different filter or search term
                </p>
              </div>
              <button
                data-testid="clear-filters-btn"
                onClick={() => { setFilter('All'); setSearch(''); }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium border transition-all"
                style={{ color: '#7c6dfa', border: '1px solid rgba(124,109,250,0.3)', background: 'rgba(124,109,250,0.08)' }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            /* ── Normal deals table ── */
            <table className="w-full border-collapse text-left" data-testid="deals-table">
              <thead className="sticky top-0 z-10 bg-[#0c0c12]">
                <tr>
                  {['', 'Score', 'Fit %', 'Sender', 'Company / Sector', 'Category', 'Subject', 'Summary', 'Next Action', 'Date'].map((h) => (
                    <th
                      key={h}
                      data-testid={h === 'Fit %' ? 'fit-pct-header' : undefined}
                      className="border-b border-[rgba(255,255,255,0.07)] px-3 py-2.5 text-[rgba(255,255,255,0.4)] text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredDeals.map((deal) => (
                  <tr
                    key={deal.id}
                    data-testid={`deal-row-${deal.id}`}
                    onClick={() => setSelectedDeal(selectedDeal?.id === deal.id ? null : deal)}
                    className={`border-b border-[rgba(255,255,255,0.03)] cursor-pointer transition-colors group ${
                      selectedDeal?.id === deal.id
                        ? 'bg-[rgba(124,109,250,0.07)]'
                        : 'hover:bg-[rgba(255,255,255,0.02)]'
                    }`}
                  >
                    <td className="px-3 py-2.5 w-8">
                      <StatusDot status={deal.status} />
                    </td>
                    <td className="px-3 py-2.5 w-12">
                      <span
                        className={`inline-flex items-center justify-center w-8 h-6 rounded border font-mono text-xs font-bold ${getScoreStyle(deal.relevance_score || 0)}`}
                      >
                        {deal.relevance_score || '—'}
                      </span>
                    </td>
                    {/* Thesis match pill */}
                    <td className="px-3 py-2.5 w-12 hidden lg:table-cell">
                      {deal.thesis_match_score != null ? (
                        <span
                          className="inline-flex items-center justify-center w-9 h-6 rounded border font-mono text-xs font-bold"
                          style={{
                            background: deal.thesis_match_score >= 70
                              ? 'rgba(61,214,140,0.1)' : deal.thesis_match_score >= 45
                              ? 'rgba(245,166,35,0.1)' : 'rgba(240,82,82,0.1)',
                            borderColor: deal.thesis_match_score >= 70
                              ? 'rgba(61,214,140,0.3)' : deal.thesis_match_score >= 45
                              ? 'rgba(245,166,35,0.3)' : 'rgba(240,82,82,0.3)',
                            color: deal.thesis_match_score >= 70
                              ? '#3dd68c' : deal.thesis_match_score >= 45
                              ? '#f5a623' : '#f05252',
                          }}
                        >
                          {deal.thesis_match_score}
                        </span>
                      ) : (
                        <span className="text-[rgba(255,255,255,0.15)] text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 min-w-[140px] max-w-[160px]">
                      <p className="text-white text-sm font-medium truncate">{deal.sender_name || '—'}</p>
                      <p className="text-[rgba(255,255,255,0.3)] text-xs truncate font-mono">{deal.sender_email}</p>
                    </td>
                    <td className="px-3 py-2.5 min-w-[130px] max-w-[150px]">
                      <p className="text-[rgba(255,255,255,0.8)] text-sm truncate">{deal.company_name || '—'}</p>
                      {deal.sector && (
                        <p className="text-[rgba(255,255,255,0.3)] text-xs truncate">{deal.sector}</p>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs border whitespace-nowrap ${getCatStyle(deal.category)}`}
                      >
                        {deal.category || 'Other'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 max-w-[180px]">
                      <p className="text-[rgba(255,255,255,0.6)] text-xs truncate">{deal.subject}</p>
                    </td>
                    <td className="px-3 py-2.5 max-w-[240px]">
                      <p className="text-[rgba(255,255,255,0.45)] text-xs line-clamp-2 leading-relaxed">
                        {deal.summary || '—'}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 max-w-[140px]">
                      <p className="text-[rgba(255,255,255,0.45)] text-xs truncate">{deal.next_action || '—'}</p>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <p className="text-[rgba(255,255,255,0.3)] text-xs font-mono">
                        {fmtDate(deal.received_date || deal.created_at)}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Detail panel */}
        {selectedDeal && (
          <DetailPanel
            deal={selectedDeal}
            onClose={() => setSelectedDeal(null)}
            onDealUpdated={handleDealUpdated}
          />
        )}
      </div>

      {/* Process email modal */}
      {showModal && (
        <ProcessEmailModal onClose={() => setShowModal(false)} onProcessed={handleProcessed} />
      )}

      {/* Product tour */}
      {showTour && (
        <ProductTour
          firstDealId={deals[0]?.id}
          onDismiss={() => setShowTour(false)}
        />
      )}
    </div>
  );
}
