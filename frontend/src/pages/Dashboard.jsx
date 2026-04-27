import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Search, RefreshCw, Plus, Mail, Settings as SettingsIcon,
  ChevronDown, LogOut, Inbox, BookOpen, LayoutGrid, Send, Layers, Filter, Users, Trash2, MoreHorizontal,
} from 'lucide-react';
import DetailPanel from '../components/DetailPanel';
import ProcessEmailModal from '../components/ProcessEmailModal';
import OnboardingChecklist from '../components/OnboardingChecklist';
import ProductTour from '../components/ProductTour';
import { NotificationBell } from '../components/NotificationBell';
import { MemberAvatar, getInitials } from '../components/MemberAvatar';
import { StatsBar } from '../components/dashboard/StatsBar';
import { DealRow } from '../components/dashboard/DealRow';
import { SyncLogModal } from '../components/dashboard/SyncLogModal';
import { toast } from '../components/ui/sonner';
import { getDeals, triggerSync, getSyncStatus, updateDeal, getFundSettings, getMyFund, getFundDeals, deleteDeal, getArchivedDeals, recoverDeal } from '../lib/api';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtLastSynced = (ts) => {
  if (!ts) return null;
  const diff = Math.round((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const BASE_FILTERS = ['All', 'New', 'Score ≥ 7', 'Pitches', 'Warm Intros', 'Follow-ups due'];

// ── Component ────────────────────────────────────────────────────────────────
export default function Dashboard({ user, onLogout }) {
  const [deals, setDeals] = useState([]);
  const [fundDeals, setFundDeals] = useState([]);
  const [fundName, setFundName] = useState('');
  const [fundSettings, setFundSettings] = useState({});
  const [fundInfo, setFundInfo] = useState(null);
  const [viewMode, setViewMode] = useState('my-inbox'); // 'my-inbox' | 'fund-dashboard'
  const FILTERS = fundInfo ? [...BASE_FILTERS, 'Assigned to me'] : BASE_FILTERS;
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [syncMessage, setSyncMessage] = useState('');
  const [lastSynced, setLastSynced] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showChecklist, setShowChecklist] = useState(false);
  const [checklistReady, setChecklistReady] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [showSyncLog, setShowSyncLog] = useState(false);
  const [syncLog, setSyncLog] = useState(null);
  const [archivedDeals, setArchivedDeals] = useState([]);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [watchlistDue, setWatchlistDue] = useState([]);
  const [watchlistBannerDismissed, setWatchlistBannerDismissed] = useState(false);
  const [followUpDue, setFollowUpDue] = useState([]);
  const [followUpBannerDismissed, setFollowUpBannerDismissed] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Auto-open deal detail if returning from ReviewMode with a deal ID
  useEffect(() => {
    if (!location.state?.openDealId) return;
    if (deals.length === 0) return;
    const deal = deals.find(d => d.id === location.state.openDealId);
    if (deal) {
      setSelectedDeal(deal);
      // Clear the state so refreshing doesn't reopen the panel
      window.history.replaceState({}, '');
    }
  }, [location.state?.openDealId, deals]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close ··· More menu when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Product tour — show once per session unless permanently dismissed
  useEffect(() => {
    const permanentlyDismissed = localStorage.getItem('vc_tour_dismissed');
    const skippedThisSession = sessionStorage.getItem('vc_tour_skipped_this_session');
    if (permanentlyDismissed || skippedThisSession) return;

    if (deals.length > 0 && !showTour) {
      const t = setTimeout(() => setShowTour(true), 900);
      return () => clearTimeout(t);
    }
  // showTour intentionally excluded from deps — we only want this to fire when
  // deals first load, not every time the tour is toggled open/closed.
  }, [deals.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAll = useCallback(async () => {
    try {
      const [d, f, status, fi] = await Promise.all([
        getDeals(), getFundSettings(),
        getSyncStatus().catch(() => null),
        getMyFund().catch(() => null),
      ]);
      if (d) {
        setDeals(d);
        const today = new Date().toISOString().slice(0, 10);
        const due = d.filter(deal =>
          deal.deal_stage === 'Watch List' &&
          deal.watchlist_revisit_date &&
          deal.watchlist_revisit_date.slice(0, 10) <= today
        );
        setWatchlistDue(due);
        const fuDue = d.filter(deal =>
          deal.follow_up_date &&
          deal.follow_up_date.slice(0, 10) <= today
        );
        setFollowUpDue(fuDue);
      }
      if (f) { setFundSettings(f); if (f.fund_name) setFundName(f.fund_name); }
      if (status?.last_synced) setLastSynced(status.last_synced);
      if (fi?.fund) {
        setFundInfo(fi);
        const fd = await getFundDeals().catch(() => []);
        setFundDeals(fd || []);
      }
    } finally { setLoading(false); }
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

  const activeDeals = viewMode === 'fund-dashboard' ? fundDeals : deals;

  const filteredDeals = useMemo(() => {
    let list = activeDeals;
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
      case 'Assigned to me': return list.filter((d) => d.assigned_to === user?.id);
      case 'Follow-ups due': {
        const today = new Date().toISOString().slice(0, 10);
        return list.filter((d) => d.follow_up_date && d.follow_up_date.slice(0, 10) <= today);
      }
      default: return list;
    }
  }, [activeDeals, filter, search, user]);

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncResult(null);
    setSyncMessage('Connecting to Gmail...');
    const dealsCountBefore = deals.length;
    try {
      await triggerSync();
    } catch {
      // Sync trigger failed silently — progress polling will surface the error
    }
    let polls = 0;
    const maxPolls = 36; // 36 × 5s = 180s
    const poll = setInterval(async () => {
      polls++;
      try {
        const [status, d] = await Promise.all([
          getSyncStatus().catch(() => null),
          getDeals(),
        ]);
        if (status?.message) setSyncMessage(status.message);
        if (status?.last_synced) setLastSynced(status.last_synced);
        if (d) setDeals(d);
        const newDeals = Math.max(0, (d || []).length - dealsCountBefore);
        const done = polls >= maxPolls || status?.step === 5;
        if (done) {
          clearInterval(poll);
          setIsSyncing(false);
          setSyncResult({ status: 'done', new_deals: newDeals });
          setSyncMessage(newDeals > 0 ? `${newDeals} new deal${newDeals !== 1 ? 's' : ''} added` : 'All caught up');
          // Capture sync log stats from the final status
          if (status?.fetched != null) {
            setSyncLog({
              time: new Date().toLocaleTimeString(),
              fetched: status.fetched,
              passed_gate: status.passed_gate,
              gated_out: status.gated_out,
              new_deals: status.new_deals ?? newDeals,
            });
          }
          setTimeout(() => { setSyncResult(null); setSyncMessage(''); }, 8000);
        }
      } catch {
        // Transient API error during polling — keep polling until maxPolls
        if (polls >= maxPolls) {
          clearInterval(poll);
          setIsSyncing(false);
          setSyncMessage('Sync check timed out — please try again');
        }
      }
    }, 5000);
  };

  const handleProcessed = (newDeal) => {
    setDeals((prev) => [newDeal, ...prev]);
  };

  const handleDealUpdated = (updated) => {
    setDeals((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    if (selectedDeal?.id === updated.id) setSelectedDeal(updated);
  };

  const handleDeleteDeal = async (dealId) => {
    // Optimistic: remove from UI immediately
    const prevDeals = deals;
    const prevFundDeals = fundDeals;
    setDeals((prev) => prev.filter((d) => d.id !== dealId));
    setFundDeals((prev) => prev.filter((d) => d.id !== dealId));
    if (selectedDeal?.id === dealId) setSelectedDeal(null);

    try {
      await deleteDeal(dealId);
      // Refresh archive list so the recovered deal appears immediately
      if (viewMode === 'archived') {
        const a = await getArchivedDeals();
        setArchivedDeals(a || []);
      }
    } catch {
      setDeals(prevDeals);
      setFundDeals(prevFundDeals);
      toast.error('Could not remove deal — please try again');
    }
  };

  const handleRecoverDeal = async (dealId) => {
    try {
      await recoverDeal(dealId);
      setArchivedDeals((prev) => prev.filter((d) => d.id !== dealId));
      // Reload main deals list so recovered deal appears
      const d = await getDeals();
      if (d) setDeals(d);
      toast('Deal recovered and moved back to Inbound.');
    } catch {
      toast.error('Could not recover deal — please try again');
    }
  };

  const handleViewArchive = async () => {
    setViewMode('archived');
    setArchivedLoading(true);
    try {
      const a = await getArchivedDeals();
      setArchivedDeals(a || []);
    } finally {
      setArchivedLoading(false);
    }
  };

  // ── Sync button derived state ────────────────────────────────────────────
  let syncBtnStyle;
  if (syncResult?.status === 'done') {
    syncBtnStyle = { background: 'rgba(61,214,140,0.08)', border: '1px solid rgba(61,214,140,0.25)', color: '#3dd68c' };
  } else if (isSyncing) {
    syncBtnStyle = { background: 'rgba(77,166,255,0.08)', border: '1px solid rgba(77,166,255,0.25)', color: '#4da6ff' };
  } else {
    syncBtnStyle = { color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.07)', background: 'transparent' };
  }

  let syncBtnLabel;
  if (isSyncing) {
    syncBtnLabel = syncMessage || 'Connecting to Gmail...';
  } else if (syncResult?.status === 'done') {
    const resultMsg = syncResult.new_deals > 0 ? `${syncResult.new_deals} new` : 'Up to date';
    syncBtnLabel = `Synced · ${syncMessage || resultMsg}`;
  } else {
    syncBtnLabel = 'Sync Now';
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0c0c12] overflow-hidden" data-testid="dashboard">
      {/* Top Nav */}
      <nav className="h-14 shrink-0 border-b border-[rgba(255,255,255,0.07)] flex items-center px-5 gap-4 bg-[#0c0c12]">
        {/* Brand — funnl */}
        <div className="flex items-center gap-2 mr-auto">
          <span
            className="text-white font-bold tracking-tight select-none"
            style={{ fontSize: 22, letterSpacing: '-0.03em' }}
          >
            funnl
          </span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: '#7c6dfa',
              border: '1px solid rgba(124,109,250,0.35)',
              borderRadius: 4,
              padding: '1px 5px',
              letterSpacing: '0.08em',
              lineHeight: 1.8,
            }}
          >
            BETA
          </span>
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
          data-testid="contacts-btn"
          onClick={() => navigate('/contacts')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all"
          style={{ color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.07)', background: 'transparent' }}
        >
          <Users size={12} />
          <span className="hidden sm:inline">Contacts</span>
        </button>
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
        {!user?.gmail_send_enabled && (
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
        )}

        {/* ··· More menu (Archive, Fund Focus, Settings) */}
        <div className="relative" ref={moreMenuRef}>
          <button
            data-testid="more-menu-btn"
            onClick={() => setMoreMenuOpen((o) => !o)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all"
            style={{
              color: moreMenuOpen ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)',
              border: moreMenuOpen ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.07)',
              background: moreMenuOpen ? 'rgba(255,255,255,0.06)' : 'transparent',
            }}
            title="More options"
          >
            <MoreHorizontal size={14} />
          </button>
          {moreMenuOpen && (
            <div
              className="absolute right-0 top-full mt-1.5 w-44 rounded-xl overflow-hidden z-50"
              style={{
                background: '#1a1a26',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              }}
            >
              <button
                data-testid="archive-btn"
                onClick={() => { handleViewArchive(); setMoreMenuOpen(false); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors text-left"
                style={{ color: 'rgba(255,255,255,0.6)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; e.currentTarget.style.background = 'transparent'; }}
              >
                <Trash2 size={13} />
                Archive
              </button>
              <button
                data-testid="fund-thesis-btn"
                onClick={() => { navigate('/fund-focus'); setMoreMenuOpen(false); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors text-left"
                style={{ color: 'rgba(255,255,255,0.6)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; e.currentTarget.style.background = 'transparent'; }}
              >
                <BookOpen size={13} />
                Fund Focus
              </button>
              <button
                data-testid="settings-btn"
                onClick={() => { navigate('/settings'); setMoreMenuOpen(false); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors text-left"
                style={{ color: 'rgba(255,255,255,0.6)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; e.currentTarget.style.background = 'transparent'; }}
              >
                <SettingsIcon size={13} />
                Settings
              </button>
            </div>
          )}
        </div>

        <NotificationBell onNavigateToDeal={(dealId) => {
          const d = [...deals, ...fundDeals].find((x) => x.id === dealId);
          if (d) { setSelectedDeal(d); if (d.user_id !== user?.id) setViewMode('fund-dashboard'); }
        }} />
        <button
          data-testid="logout-btn"
          onClick={onLogout}
          className="text-[rgba(255,255,255,0.35)] hover:text-white transition-colors p-1"
        >
          <LogOut size={15} />
        </button>
      </nav>

      {/* Stats Bar */}
      <StatsBar deals={activeDeals} />

      {/* Watch List revisit banner */}
      {watchlistDue.length > 0 && !watchlistBannerDismissed && (
        <div
          className="shrink-0 flex items-center justify-between px-5 py-2.5"
          style={{ background: 'rgba(45,212,191,0.08)', borderBottom: '1px solid rgba(45,212,191,0.2)' }}
        >
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#2dd4bf' }} />
            <span className="text-sm" style={{ color: '#2dd4bf' }}>
              {watchlistDue.length} Watch List {watchlistDue.length === 1 ? 'deal' : 'deals'} ready for another look
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setFilter('All'); setSearch(''); }}
              className="text-xs font-medium underline underline-offset-2"
              style={{ color: '#2dd4bf' }}
            >
              Review now
            </button>
            <button
              onClick={() => setWatchlistBannerDismissed(true)}
              className="text-xs"
              style={{ color: 'rgba(45,212,191,0.5)' }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Follow-up due banner */}
      {followUpDue.length > 0 && !followUpBannerDismissed && (
        <div
          className="shrink-0 flex items-center justify-between px-5 py-2.5"
          style={{ background: 'rgba(245,158,11,0.08)', borderBottom: '1px solid rgba(245,158,11,0.2)' }}
        >
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#f59e0b' }} />
            <span className="text-sm" style={{ color: '#f59e0b' }}>
              {followUpDue.length} follow-up {followUpDue.length === 1 ? 'reminder' : 'reminders'} due today
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setFilter('Follow-ups due')}
              className="text-xs font-medium underline underline-offset-2"
              style={{ color: '#f59e0b' }}
            >
              Review now
            </button>
            <button
              onClick={() => setFollowUpBannerDismissed(true)}
              className="text-xs"
              style={{ color: 'rgba(245,158,11,0.5)' }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

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

        {/* My Inbox / Fund Dashboard toggle */}
        {fundInfo?.fund && (
          <div className="flex items-center rounded-lg p-0.5 shrink-0"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            {[
              { id: 'my-inbox', label: 'My Inbox' },
              { id: 'fund-dashboard', label: 'Fund Dashboard' },
            ].map((tab) => (
              <button
                key={tab.id}
                data-testid={`view-${tab.id}`}
                onClick={() => setViewMode(tab.id)}
                className="px-3 py-1 rounded-md text-xs font-medium transition-all"
                style={viewMode === tab.id ? {
                  background: '#7c6dfa', color: 'white',
                  boxShadow: '0 0 8px rgba(124,109,250,0.3)',
                } : {
                  color: 'rgba(255,255,255,0.4)',
                  background: 'transparent',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

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
          {/* Last synced time — clickable to show sync log */}
          {lastSynced && !isSyncing && (
            <button
              data-testid="sync-log-btn"
              onClick={() => setShowSyncLog(true)}
              className="text-[10px] font-mono hidden md:block hover:text-[rgba(255,255,255,0.5)] transition-colors"
              style={{ color: 'rgba(255,255,255,0.2)' }}
            >
              synced {fmtLastSynced(lastSynced)}
            </button>
          )}
          <button
            data-testid="sync-now-btn"
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all disabled:opacity-50"
            style={syncBtnStyle}
          >
            <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline max-w-[160px] truncate">{syncBtnLabel}</span>
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
          ) : viewMode === 'archived' ? (
            /* ── Archive view ── */
            <div className="flex-1 overflow-auto">
              <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.05)] flex items-center gap-3">
                <Trash2 size={14} className="text-[#f05252]" />
                <p className="text-white text-sm font-semibold">Archive</p>
                <span className="text-[rgba(255,255,255,0.3)] text-xs ml-1">
                  Deleted emails are recoverable for 30 days
                </span>
                <button
                  onClick={() => setViewMode('my-inbox')}
                  className="ml-auto text-xs text-[rgba(255,255,255,0.3)] hover:text-white transition-colors"
                >← Back to inbox</button>
              </div>
              {archivedLoading ? (
                <div className="flex items-center justify-center gap-2 py-12">
                  <div className="w-4 h-4 rounded-full border border-t-transparent animate-spin"
                    style={{ borderColor: 'rgba(255,255,255,0.15)', borderTopColor: '#7c6dfa' }} />
                  <span className="text-[rgba(255,255,255,0.3)] text-xs">Loading archive...</span>
                </div>
              ) : archivedDeals.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-6">
                  <Trash2 size={28} style={{ color: 'rgba(255,255,255,0.1)' }} />
                  <p className="text-[rgba(255,255,255,0.35)] text-sm">Archive is empty</p>
                  <p className="text-[rgba(255,255,255,0.2)] text-xs">Deleted deals will appear here for 30 days.</p>
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[rgba(255,255,255,0.05)]">
                      {['Company / Sender', 'Subject', 'Deleted', 'Expires In', ''].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-[rgba(255,255,255,0.25)] text-xs font-semibold uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {archivedDeals.map((deal) => {
                      const deletedAt = new Date(deal.updated_at);
                      const expiresAt = new Date(deletedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
                      const daysLeft = Math.max(0, Math.ceil((expiresAt - new Date()) / (1000 * 60 * 60 * 24)));
                      return (
                        <tr key={deal.id} className="border-b border-[rgba(255,255,255,0.03)]"
                          data-testid={`archived-deal-${deal.id}`}>
                          <td className="px-3 py-2.5">
                            <p className="text-white text-xs font-medium">{deal.company_name || deal.sender_name || '—'}</p>
                            <p className="text-[rgba(255,255,255,0.3)] text-xs">{deal.sender_email}</p>
                          </td>
                          <td className="px-3 py-2.5 max-w-[260px]">
                            <p className="text-[rgba(255,255,255,0.5)] text-xs truncate">{deal.subject}</p>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <p className="text-[rgba(255,255,255,0.3)] text-xs font-mono">{deletedAt.toLocaleDateString()}</p>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className="text-xs font-mono px-2 py-0.5 rounded"
                              style={daysLeft <= 3 ? {
                                background: 'rgba(240,82,82,0.12)', color: '#f05252',
                              } : {
                                background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.35)',
                              }}>
                              {daysLeft}d
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <button
                              data-testid={`recover-deal-${deal.id}`}
                              onClick={() => handleRecoverDeal(deal.id)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                              style={{ background: 'rgba(61,214,140,0.1)', color: '#3dd68c', border: '1px solid rgba(61,214,140,0.22)' }}
                            >
                              Recover
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
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
                  {[
                    '', 'Score', 'Sender', 'Company / Sector', 'Category', 'Subject', 'Summary', 'Next Action',
                    ...(viewMode === 'fund-dashboard' ? ['Owner', 'Assigned', 'Stage', 'Votes'] : []),
                    'Date',
                  ].map((h) => (
                    <th
                      key={h}
                      data-testid={h === 'Score' ? 'fit-pct-header' : undefined}
                      className="border-b border-[rgba(255,255,255,0.07)] px-3 py-2.5 text-[rgba(255,255,255,0.4)] text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredDeals.map((deal) => (
                  <DealRow
                    key={deal.id}
                    deal={deal}
                    isSelected={selectedDeal?.id === deal.id}
                    viewMode={viewMode}
                    fundMembers={fundInfo?.members}
                    onSelect={(d) => setSelectedDeal(selectedDeal?.id === d.id ? null : d)}
                    onDelete={handleDeleteDeal}
                  />
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
            onDelete={handleDeleteDeal}
            fundInfo={fundInfo}
            userId={user?.id}
          />
        )}
      </div>

      {/* Process email modal */}
      {showModal && (
        <ProcessEmailModal onClose={() => setShowModal(false)} onProcessed={handleProcessed} />
      )}

      {/* Product tour */}
      {showTour && (
        <ProductTour onDismiss={() => setShowTour(false)} />
      )}

      {/* Sync Log Modal */}
      {showSyncLog && (
        <SyncLogModal syncLog={syncLog} onClose={() => setShowSyncLog(false)} />
      )}
    </div>
  );
}
