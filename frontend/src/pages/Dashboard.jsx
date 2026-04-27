import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Search, RefreshCw, Plus, Send, Filter, Trash2, MoreHorizontal,
  BookOpen, Inbox,
} from 'lucide-react';
import DetailPanel from '../components/DetailPanel';
import ProcessEmailModal from '../components/ProcessEmailModal';
import OnboardingChecklist from '../components/OnboardingChecklist';
import ProductTour from '../components/ProductTour';
import { NotificationBell } from '../components/NotificationBell';
import { DealRow } from '../components/dashboard/DealRow';
import { SyncLogModal } from '../components/dashboard/SyncLogModal';
import ActivityFeed from '../components/ActivityFeed';
import { toast } from '../components/ui/sonner';
import { getDeals, triggerSync, getSyncStatus, updateDeal, getFundSettings, getMyFund, getFundDeals, deleteDeal, getArchivedDeals, recoverDeal, getBillingStatus, createCheckoutSession } from '../lib/api';
import UpgradeModal from '../components/UpgradeModal';

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

// ── Metric card (Image 2 pattern) ─────────────────────────────────────────────
function MetricCard({ label, value, color, accentColor }) {
  return (
    <div
      className="flex-1 flex flex-col justify-center"
      style={{
        background: '#131320',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 12,
        padding: '14px 16px',
        borderLeft: `3px solid ${accentColor}`,
        boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
        minWidth: 0,
      }}
    >
      <span
        className="uppercase font-semibold"
        style={{ fontSize: 10, letterSpacing: '0.07em', color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}
      >
        {label}
      </span>
      <span
        className="font-bold font-mono leading-none"
        style={{ fontSize: 28, color }}
        data-testid={`stat-${label.toLowerCase().replace(/\s/g, '-')}`}
      >
        {value}
      </span>
    </div>
  );
}

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
  const [billingStatus, setBillingStatus] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [syncCount, setSyncCount] = useState(0);
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
  // showTour intentionally excluded from deps
  }, [deals.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAll = useCallback(async () => {
    try {
      const [d, f, status, fi, billing] = await Promise.all([
        getDeals(), getFundSettings(),
        getSyncStatus().catch(() => null),
        getMyFund().catch(() => null),
        getBillingStatus().catch(() => null),
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
      if (billing) setBillingStatus(billing);
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
    } catch (err) {
      if (err?.message === 'subscription_required') {
        setIsSyncing(false);
        setShowUpgradeModal(true);
        return;
      }
    }
    let polls = 0;
    const maxPolls = 36;
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
          setSyncCount((c) => c + 1);
          setSyncMessage(newDeals > 0 ? `${newDeals} new deal${newDeals !== 1 ? 's' : ''} added` : 'All caught up');
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
    const prevDeals = deals;
    const prevFundDeals = fundDeals;
    setDeals((prev) => prev.filter((d) => d.id !== dealId));
    setFundDeals((prev) => prev.filter((d) => d.id !== dealId));
    if (selectedDeal?.id === dealId) setSelectedDeal(null);

    try {
      await deleteDeal(dealId);
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

  // ── Stats computed inline ────────────────────────────────────────────────
  const statTotal    = activeDeals.length;
  const statPitches  = activeDeals.filter(d => d.category === 'Founder pitch').length;
  const scores       = activeDeals.map(d => d.relevance_score).filter(s => s != null);
  const statAvg      = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '—';
  const statHigh     = activeDeals.filter(d => (d.relevance_score || 0) >= 7).length;
  const statUnrev    = activeDeals.filter(d => d.deal_stage === 'Inbound' || (!d.deal_stage && d.status === 'New')).length;

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100vh', background: '#080810' }} data-testid="dashboard">

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <div
        className="shrink-0 flex items-center px-5 gap-3"
        style={{
          height: 48,
          background: '#080810',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        {/* Page title */}
        <span className="font-semibold text-white" style={{ fontSize: 16 }}>
          {viewMode === 'fund-dashboard' ? fundName || 'Fund Dashboard' : 'Dashboard'}
        </span>

        {/* Fund inbox toggle */}
        {fundInfo?.fund && (
          <div
            className="flex items-center rounded-lg p-0.5"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            {[
              { id: 'my-inbox', label: 'My Inbox' },
              { id: 'fund-dashboard', label: 'Fund Dashboard' },
            ].map((tab) => (
              <button
                key={tab.id}
                data-testid={`view-${tab.id}`}
                onClick={() => setViewMode(tab.id)}
                className="px-3 py-1 rounded-md text-xs font-medium transition-all"
                style={viewMode === tab.id
                  ? { background: '#7c6dfa', color: 'white', boxShadow: '0 0 8px rgba(124,109,250,0.3)' }
                  : { color: 'rgba(255,255,255,0.4)', background: 'transparent' }
                }
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Gmail status pill */}
          {user && (
            <div
              data-testid="gmail-status"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono"
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
              <span className="hidden md:inline">{user.email || 'Connected'}</span>
              <span className="md:hidden">Gmail</span>
            </div>
          )}

          {/* Trial pill */}
          {billingStatus?.status === 'trialing' && billingStatus?.days_remaining != null && billingStatus.days_remaining < 7 && (
            <button
              onClick={createCheckoutSession}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all shrink-0"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b' }}
              title="Your trial ends soon — click to subscribe"
            >
              Trial: {billingStatus.days_remaining}d left
            </button>
          )}

          {/* Enable sending */}
          {!user?.gmail_send_enabled && (
            <a
              data-testid="enable-sending-btn"
              href={`${BACKEND_URL}/api/auth/google`}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all"
              style={{ background: 'rgba(77,166,255,0.08)', border: '1px solid rgba(77,166,255,0.25)', color: '#4da6ff' }}
              title="Click to grant Gmail send permission"
            >
              <Send size={11} />
              <span className="hidden sm:inline">Enable Sending</span>
            </a>
          )}

          {/* Last synced */}
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

          {/* Sync Now */}
          <button
            data-testid="sync-now-btn"
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all disabled:opacity-50"
            style={syncBtnStyle}
          >
            <RefreshCw size={11} className={isSyncing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline max-w-[160px] truncate">{syncBtnLabel}</span>
          </button>

          {/* Process Email */}
          <button
            data-testid="process-email-btn"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 text-white text-xs font-medium px-3 py-1 rounded-full transition-all"
            style={{ background: '#7c6dfa', boxShadow: '0 0 12px rgba(124,109,250,0.3)' }}
          >
            <Plus size={11} />
            <span className="hidden sm:inline">Process Email</span>
          </button>

          {/* Notification bell */}
          <NotificationBell onNavigateToDeal={(dealId) => {
            const d = [...deals, ...fundDeals].find((x) => x.id === dealId);
            if (d) { setSelectedDeal(d); if (d.user_id !== user?.id) setViewMode('fund-dashboard'); }
          }} />

          {/* ··· More menu */}
          <div className="relative" ref={moreMenuRef}>
            <button
              data-testid="more-menu-btn"
              onClick={() => setMoreMenuOpen((o) => !o)}
              className="flex items-center justify-center transition-all"
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: moreMenuOpen ? 'rgba(255,255,255,0.08)' : 'transparent',
                border: moreMenuOpen ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent',
                color: moreMenuOpen ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.4)',
                cursor: 'pointer',
              }}
              title="More options"
            >
              <MoreHorizontal size={15} />
            </button>
            {moreMenuOpen && (
              <div
                className="absolute right-0 top-full mt-1.5 w-44 rounded-xl overflow-hidden z-50"
                style={{ background: '#1a1a28', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
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
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats cards row ───────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-3 px-5 py-3">
        <MetricCard label="Total Inbound"    value={statTotal}   color="rgba(255,255,255,0.85)" accentColor="rgba(255,255,255,0.2)" />
        <MetricCard label="Founder Pitches"  value={statPitches} color="#7c6dfa"                accentColor="#7c6dfa" />
        <MetricCard label="Avg Score"        value={statAvg}     color="#f5a623"                accentColor="#f5a623" />
        <MetricCard label="Strong Fit"       value={statHigh}    color="#3dd68c"                accentColor="#3dd68c" />
        <MetricCard label="Unreviewed"       value={statUnrev}   color="#4da6ff"                accentColor="#4da6ff" />
      </div>

      {/* ── Watch List revisit banner ─────────────────────────────────────── */}
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

      {/* ── Follow-up due banner ──────────────────────────────────────────── */}
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

      {/* ── Toolbar: search + filters ─────────────────────────────────────── */}
      <div
        className="shrink-0 flex items-center px-5 gap-3 py-2"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        {/* Search */}
        <div
          className="flex items-center gap-2 flex-1 max-w-xs rounded-lg px-3 py-1.5"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <Search size={13} style={{ color: 'rgba(255,255,255,0.3)' }} className="shrink-0" />
          <input
            data-testid="search-input"
            type="text"
            placeholder="Search deals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm text-white placeholder-[rgba(255,255,255,0.25)] focus:outline-none flex-1 min-w-0"
          />
        </div>

        {/* Filter pills — capsule style */}
        <div className="flex items-center gap-1 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f}
              data-testid={`filter-${f.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
              onClick={() => setFilter(f)}
              className="text-xs font-medium transition-all"
              style={{
                borderRadius: 999,
                padding: '5px 13px',
                background: filter === f ? 'rgba(124,109,250,0.15)' : 'transparent',
                color: filter === f ? '#7c6dfa' : 'rgba(255,255,255,0.4)',
                border: filter === f ? '1px solid rgba(124,109,250,0.3)' : '1px solid transparent',
              }}
              onMouseEnter={(e) => {
                if (filter !== f) {
                  e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                }
              }}
              onMouseLeave={(e) => {
                if (filter !== f) {
                  e.currentTarget.style.color = 'rgba(255,255,255,0.4)';
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main content area ─────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Deals table / states */}
        <div className="flex-1 overflow-auto flex flex-col" style={{ minWidth: 0 }}>
          {loading ? (
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
            <div className="flex-1 overflow-auto p-5">
              {/* Archive card */}
              <div
                style={{
                  background: '#131320',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 16,
                  overflow: 'hidden',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
                }}
              >
                <div className="flex items-center gap-3 px-5 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <Trash2 size={14} className="text-[#f05252]" />
                  <p className="text-white text-sm font-semibold">Archive</p>
                  <span className="text-[rgba(255,255,255,0.3)] text-xs ml-1">
                    Deleted emails are recoverable for 30 days
                  </span>
                  <button
                    onClick={() => setViewMode('my-inbox')}
                    className="ml-auto text-xs text-[rgba(255,255,255,0.3)] hover:text-white transition-colors"
                  >
                    ← Back to inbox
                  </button>
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
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        {['Company / Sender', 'Subject', 'Deleted', 'Expires In', ''].map((h) => (
                          <th key={h} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                            style={{ color: 'rgba(255,255,255,0.25)', letterSpacing: '0.07em', fontSize: 10 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {archivedDeals.map((deal) => {
                        const deletedAt = new Date(deal.updated_at);
                        const expiresAt = new Date(deletedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
                        const daysLeft = Math.max(0, Math.ceil((expiresAt - new Date()) / (1000 * 60 * 60 * 24)));
                        return (
                          <tr key={deal.id}
                            style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', height: 56 }}
                            data-testid={`archived-deal-${deal.id}`}>
                            <td className="px-4 py-3">
                              <p className="text-white text-xs font-medium">{deal.company_name || deal.sender_name || '—'}</p>
                              <p className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>{deal.sender_email}</p>
                            </td>
                            <td className="px-4 py-3 max-w-[260px]">
                              <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>{deal.subject}</p>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <p className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>{deletedAt.toLocaleDateString()}</p>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="text-xs font-mono px-2 py-0.5 rounded"
                                style={daysLeft <= 3
                                  ? { background: 'rgba(240,82,82,0.12)', color: '#f05252' }
                                  : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.35)' }}>
                                {daysLeft}d
                              </span>
                            </td>
                            <td className="px-4 py-3">
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
            </div>

          ) : showChecklist ? (
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
            <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6 text-center" data-testid="empty-no-deals">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
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
                  className="flex items-center gap-1.5 text-white text-xs font-medium px-4 py-2 rounded-lg transition-all"
                  style={{ background: '#7c6dfa' }}
                >
                  <Plus size={12} />
                  Process Email
                </button>
              </div>
            </div>

          ) : filteredDeals.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center" data-testid="empty-filtered">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
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
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium border transition-all"
                style={{ color: '#7c6dfa', border: '1px solid rgba(124,109,250,0.3)', background: 'rgba(124,109,250,0.08)' }}
              >
                Clear filters
              </button>
            </div>

          ) : (
            /* ── Deals table in a card ── */
            <div className="p-4 flex-1 overflow-auto">
              <div
                style={{
                  background: '#131320',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 16,
                  overflow: 'hidden',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
                }}
              >
                <table className="w-full border-collapse text-left" data-testid="deals-table">
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#131320' }}>
                    <tr>
                      {[
                        '', 'Score', 'Sender', 'Company / Sector', 'Category', 'Subject', 'Summary', 'Next Action',
                        ...(viewMode === 'fund-dashboard' ? ['Owner', 'Assigned', 'Stage', 'Votes'] : []),
                        'Date',
                      ].map((h) => (
                        <th
                          key={h}
                          data-testid={h === 'Score' ? 'fit-pct-header' : undefined}
                          className="px-4 py-3 font-semibold uppercase whitespace-nowrap"
                          style={{
                            borderBottom: '1px solid rgba(255,255,255,0.06)',
                            color: 'rgba(255,255,255,0.25)',
                            fontSize: 10,
                            letterSpacing: '0.07em',
                          }}
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
              </div>
            </div>
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

        {/* Activity feed — right column, hidden below xl (1280px) */}
        <div
          className="hidden xl:flex flex-col shrink-0"
          style={{ width: 320, minWidth: 280, maxWidth: 340, padding: '12px 16px 12px 0' }}
        >
          <ActivityFeed
            userId={user?.id}
            refreshTrigger={syncCount}
            scope={viewMode === 'fund-dashboard' ? 'fund' : 'personal'}
          />
        </div>
      </div>

      {/* Modals */}
      {showModal && (
        <ProcessEmailModal onClose={() => setShowModal(false)} onProcessed={handleProcessed} />
      )}
      {showTour && (
        <ProductTour onDismiss={() => setShowTour(false)} />
      )}
      {showSyncLog && (
        <SyncLogModal syncLog={syncLog} onClose={() => setShowSyncLog(false)} />
      )}
      {showUpgradeModal && <UpgradeModal onClose={() => setShowUpgradeModal(false)} />}
    </div>
  );
}
