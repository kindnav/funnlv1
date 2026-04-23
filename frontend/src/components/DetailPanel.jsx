import { useState, useEffect, useCallback } from 'react';
import {
  X, ExternalLink, Check, Archive, ChevronRight,
  XCircle, MessageSquare, Share2, Target, TrendingUp, TrendingDown, FileText, UserPlus, Bookmark,
  ChevronDown, Trash2,
} from 'lucide-react';
import { updateDeal, upsertContact, updateDealStage, assignDeal, deleteDeal } from '../lib/api';
import { toast } from '../components/ui/sonner';
import ActionModal from './ActionModal';
import { VotingSection } from './VotingSection';
import { CommentThread } from './CommentThread';
import { MemberAvatar } from './MemberAvatar';

const normalizeStatus = (s) => {
  if (!s) return 'New';
  const m = { pipeline: 'Pipeline', archived: 'Archived', Reviewed: 'In Review', reviewed: 'In Review' };
  return m[s] || s;
};

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
  CATEGORY_STYLES[cat] || 'bg-[rgba(255,255,255,0.05)] text-[rgba(255,255,255,0.4)] border-[rgba(255,255,255,0.1)]';

const ScoreBar = ({ value, color }) => (
  <div className="flex gap-0.5 mt-1">
    {Array.from({ length: 10 }, (_, i) => (
      <div key={i} className="h-1.5 flex-1 rounded-sm transition-all"
        style={{ background: i < value ? color : 'rgba(255,255,255,0.06)' }} />
    ))}
  </div>
);

const SignalChip = ({ label, value, active, activeColor = '#3dd68c' }) => (
  <div className="flex items-center gap-2 bg-[#0c0c12] border border-[rgba(255,255,255,0.06)] rounded-lg px-3 py-2">
    <div className="w-1.5 h-1.5 rounded-full shrink-0"
      style={{ background: active ? activeColor : 'rgba(255,255,255,0.2)' }} />
    <span className="text-[rgba(255,255,255,0.4)] text-xs">{label}</span>
    <span className="text-white text-xs font-medium ml-auto">{value || '—'}</span>
  </div>
);

// Thesis match score ring
const ThesisRing = ({ score }) => {
  const pct = Math.min(100, Math.max(0, score || 0));
  const color = pct >= 70 ? '#3dd68c' : pct >= 45 ? '#f5a623' : '#f05252';
  const r = 22;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className="relative flex items-center justify-center w-14 h-14 shrink-0">
      <svg width="56" height="56" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
        <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }} />
      </svg>
      <span className="absolute text-xs font-bold font-mono" style={{ color }}>{pct}</span>
    </div>
  );
};

const ACTIVE_STAGES = ['Inbound', 'First Look', 'In Conversation', 'Due Diligence', 'Closed'];
const EXIT_STAGES = ['Passed', 'Watch List'];

const STAGE_COLORS = {
  'Inbound':         ['rgba(124,109,250,0.15)', '#7c6dfa'],
  'First Look':      ['rgba(77,166,255,0.15)',  '#4da6ff'],
  'In Conversation': ['rgba(245,166,35,0.15)',  '#f5a623'],
  'Due Diligence':   ['rgba(61,214,140,0.15)',  '#3dd68c'],
  'Closed':          ['rgba(34,197,94,0.18)',   '#22c55e'],
  'Passed':          ['rgba(240,82,82,0.15)',   '#f05252'],
  'Watch List':      ['rgba(251,191,36,0.15)',  '#fbbf24'],
};

export default function DetailPanel({ deal, onClose, onDealUpdated, onDelete, fundInfo, userId }) {
  const [saving, setSaving] = useState(null);
  const [actionModal, setActionModal] = useState(null);
  const [notes, setNotes] = useState(deal.notes || '');
  const [notesSaved, setNotesSaved] = useState(false);
  const [dealStage, setDealStage] = useState(deal.deal_stage || 'Inbound');
  const [assignedTo, setAssignedTo] = useState(deal.assigned_to || '');
  const [assignDropdownOpen, setAssignDropdownOpen] = useState(false);
  const [passReason, setPassReason] = useState(deal.pass_reason || '');
  const [watchlistDate, setWatchlistDate] = useState(deal.watchlist_revisit_date ? deal.watchlist_revisit_date.slice(0,10) : '');

  const members = fundInfo?.members || [];
  const inFund = !!fundInfo?.fund;

  useEffect(() => {
    setNotes(deal.notes || '');
    setDealStage(deal.deal_stage || 'Inbound');
    setAssignedTo(deal.assigned_to || '');
    setPassReason(deal.pass_reason || '');
    setWatchlistDate(deal.watchlist_revisit_date ? deal.watchlist_revisit_date.slice(0,10) : '');
  }, [deal.id]); // eslint-disable-line react-hooks/exhaustive-deps — intentional: reset local state only when the selected deal changes, not on every field update

  const handleStageChange = useCallback(async (stage, extra = {}) => {
    setDealStage(stage);
    try {
      await updateDealStage(deal.id, stage, extra);
      onDealUpdated({ ...deal, deal_stage: stage, ...extra });
    } catch { toast.error('Failed to update stage'); }
  }, [deal, onDealUpdated]);

  const handleAssign = useCallback(async (memberId) => {
    setAssignedTo(memberId);
    setAssignDropdownOpen(false);
    try {
      await assignDeal(deal.id, { assigned_to: memberId || null });
      onDealUpdated({ ...deal, assigned_to: memberId || null });
    } catch { toast.error('Failed to assign deal'); }
  }, [deal, onDealUpdated]);

  const handleSaveNotes = async () => {
    if (notes === (deal.notes || '')) return;
    setSaving('notes');
    try {
      await updateDeal(deal.id, { notes });
      onDealUpdated({ ...deal, notes });
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    } finally {
      setSaving(null);
    }
  }; // 'reject' | 'request_info' | 'forward_partner' | null

  const relScore = deal.relevance_score || 0;
  const urgScore = deal.urgency_score || 0;
  const relColor = relScore >= 7 ? '#3dd68c' : relScore >= 4 ? '#f5a623' : '#f05252';
  const urgColor = urgScore >= 7 ? '#f05252' : urgScore >= 4 ? '#f5a623' : '#3dd68c';

  const handleAction = async (field, value, label) => {
    setSaving(label);
    try {
      await updateDeal(deal.id, { [field]: value });
      onDealUpdated({ ...deal, [field]: value });
    } finally {
      setSaving(null);
    }
  };

  const handleSent = (actionType) => {
    const statusMap = { reject: 'Archived', request_info: 'Reviewed', forward_partner: 'Reviewed' };
    onDealUpdated({ ...deal, status: statusMap[actionType] || 'Reviewed' });
  };

  const hasThesisData = deal.thesis_match_score != null;

  return (
    <>
      <div
        data-testid="detail-panel"
        className="w-[460px] shrink-0 h-full border-l border-[rgba(255,255,255,0.07)] bg-[#13131c] flex flex-col overflow-hidden"
        style={{ boxShadow: '-8px 0 32px rgba(0,0,0,0.4)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.07)] shrink-0">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getCatStyle(deal.category)}`}>
            {deal.category}
          </span>
          <button data-testid="close-detail-panel" onClick={onClose}
            className="text-[rgba(255,255,255,0.3)] hover:text-white transition-colors ml-2 shrink-0">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Company + sender */}
          <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.05)]">
            {deal.company_name && (
              <h2 className="text-lg font-bold text-white leading-tight">{deal.company_name}</h2>
            )}
            <div className="mt-1">
              <p className="text-[rgba(255,255,255,0.7)] text-sm font-medium">{deal.sender_name}</p>
              {deal.founder_role && (
                <p className="text-[rgba(255,255,255,0.35)] text-xs">{deal.founder_role}</p>
              )}
              <p className="text-[rgba(255,255,255,0.3)] text-xs font-mono">{deal.sender_email}</p>
            </div>
            <p className="text-[rgba(255,255,255,0.5)] text-xs mt-2 leading-snug">{deal.subject}</p>
          </div>

          {/* ── Deal Stage (fund only) ── */}
          {inFund && (
            <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.05)]" data-testid="deal-stage-section">
              <p className="text-[rgba(255,255,255,0.4)] text-xs uppercase tracking-wider font-semibold mb-2.5">Deal Stage</p>

              {/* Top row: active progression stages */}
              <p className="text-[rgba(255,255,255,0.25)] text-xs mb-1.5 font-mono">Progress</p>
              <div className="flex items-center gap-1 flex-wrap mb-3">
                {ACTIVE_STAGES.map((s) => {
                  const active = dealStage === s;
                  const [bg, color] = STAGE_COLORS[s];
                  return (
                    <button
                      key={s}
                      data-testid={`stage-btn-${s.toLowerCase().replace(/ /g, '-')}`}
                      onClick={() => handleStageChange(s)}
                      className="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
                      style={active ? {
                        background: bg, color, border: `1px solid ${color}66`,
                        boxShadow: `0 0 8px ${color}22`,
                      } : {
                        background: 'rgba(255,255,255,0.03)',
                        color: 'rgba(255,255,255,0.3)',
                        border: '1px solid rgba(255,255,255,0.07)',
                      }}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>

              {/* Bottom row: exit states */}
              <p className="text-[rgba(255,255,255,0.25)] text-xs mb-1.5 font-mono">Exit State</p>
              <div className="flex items-center gap-1 flex-wrap mb-3">
                {EXIT_STAGES.map((s) => {
                  const active = dealStage === s;
                  const [bg, color] = STAGE_COLORS[s];
                  return (
                    <button
                      key={s}
                      data-testid={`stage-btn-${s.toLowerCase().replace(/ /g, '-')}`}
                      onClick={() => handleStageChange(s)}
                      className="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
                      style={active ? {
                        background: bg, color, border: `1px solid ${color}66`,
                        boxShadow: `0 0 8px ${color}22`,
                      } : {
                        background: 'rgba(255,255,255,0.03)',
                        color: 'rgba(255,255,255,0.3)',
                        border: '1px solid rgba(255,255,255,0.07)',
                      }}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>

              {/* Pass reason input */}
              {dealStage === 'Passed' && (
                <div className="mb-3">
                  <p className="text-[rgba(255,255,255,0.3)] text-xs mb-1.5">Pass reason</p>
                  <input
                    data-testid="pass-reason-input"
                    type="text"
                    placeholder="e.g. Team not right, Too early, Not in thesis..."
                    value={passReason}
                    onChange={(e) => setPassReason(e.target.value)}
                    onBlur={() => { if (passReason !== (deal.pass_reason || '')) handleStageChange('Passed', { pass_reason: passReason }); }}
                    className="w-full bg-[#0c0c12] border border-[rgba(240,82,82,0.25)] rounded-lg px-3 py-2 text-xs text-white placeholder-[rgba(255,255,255,0.2)] focus:outline-none focus:border-[#f05252] transition-colors"
                  />
                </div>
              )}

              {/* Watch List revisit date */}
              {dealStage === 'Watch List' && (
                <div className="mb-3">
                  <p className="text-[rgba(255,255,255,0.3)] text-xs mb-1.5">Revisit date</p>
                  <input
                    data-testid="watchlist-date-input"
                    type="date"
                    value={watchlistDate}
                    onChange={(e) => setWatchlistDate(e.target.value)}
                    onBlur={() => { if (watchlistDate) handleStageChange('Watch List', { watchlist_revisit_date: watchlistDate }); }}
                    className="w-full bg-[#0c0c12] border border-[rgba(251,191,36,0.25)] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#fbbf24] transition-colors"
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
              )}

              {/* Assignment dropdown */}
              <div className="mt-3 relative">
                <p className="text-[rgba(255,255,255,0.3)] text-xs mb-1.5">Assigned to</p>
                <button
                  data-testid="assign-dropdown-btn"
                  onClick={() => setAssignDropdownOpen((o) => !o)}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors"
                  style={{ background: '#0c0c12', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  {assignedTo ? (
                    <>
                      <MemberAvatar name={members.find((m) => m.user_id === assignedTo)?.display_name || ''} size={20} />
                      <span className="text-white text-xs truncate flex-1 text-left">
                        {members.find((m) => m.user_id === assignedTo)?.display_name || 'Unknown'}
                      </span>
                    </>
                  ) : (
                    <span className="text-[rgba(255,255,255,0.3)] text-xs flex-1 text-left">Unassigned</span>
                  )}
                  <ChevronDown size={12} className="text-[rgba(255,255,255,0.3)] shrink-0" />
                </button>
                {assignDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 w-full rounded-lg overflow-hidden z-50"
                    style={{ background: '#1a1a26', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                    <button
                      onClick={() => handleAssign('')}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 text-left transition-colors">
                      <span className="text-[rgba(255,255,255,0.4)] text-xs">Unassigned</span>
                    </button>
                    {members.map((m) => (
                      <button key={m.user_id}
                        onClick={() => handleAssign(m.user_id)}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 text-left transition-colors">
                        <MemberAvatar name={m.display_name} size={20} />
                        <span className="text-white text-xs">{m.display_name}</span>
                        {m.user_id === userId && <span className="text-[rgba(255,255,255,0.25)] text-xs ml-auto">You</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AI Summary */}
          {deal.summary && (
            <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.05)]">
              <p className="text-[rgba(255,255,255,0.4)] text-xs uppercase tracking-wider font-semibold mb-2">
                AI Summary
              </p>
              <div className="rounded-lg p-3 text-sm text-[rgba(255,255,255,0.8)] leading-relaxed"
                style={{ background: 'rgba(124,109,250,0.06)', border: '1px solid rgba(124,109,250,0.15)' }}>
                {deal.summary}
              </div>
            </div>
          )}

          {/* ── Thesis Match Engine ── */}
          {hasThesisData && (
            <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.05)]">
              <div className="flex items-center gap-2 mb-3">
                <Target size={13} className="text-[#7c6dfa]" />
                <p className="text-[rgba(255,255,255,0.4)] text-xs uppercase tracking-wider font-semibold">
                  Focus Match
                </p>
              </div>

              <div className="flex items-start gap-4">
                <ThesisRing score={deal.thesis_match_score} />
                <div className="flex-1 min-w-0">
                  {deal.match_reasoning && (
                    <p className="text-[rgba(255,255,255,0.6)] text-xs leading-relaxed mb-3">
                      {deal.match_reasoning}
                    </p>
                  )}
                  {deal.fit_strengths && deal.fit_strengths.length > 0 && (
                    <div className="mb-2">
                      {deal.fit_strengths.map((s) => (
                        <div key={s} className="flex items-start gap-1.5 mb-1">
                          <TrendingUp size={11} className="text-[#3dd68c] shrink-0 mt-0.5" />
                          <span className="text-[rgba(255,255,255,0.55)] text-xs leading-snug">{s}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {deal.fit_weaknesses && deal.fit_weaknesses.length > 0 && (
                    <div>
                      {deal.fit_weaknesses.map((w) => (
                        <div key={w} className="flex items-start gap-1.5 mb-1">
                          <TrendingDown size={11} className="text-[#f05252] shrink-0 mt-0.5" />
                          <span className="text-[rgba(255,255,255,0.4)] text-xs leading-snug">{w}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Scores */}
          <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.05)]">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-[rgba(255,255,255,0.4)] text-xs uppercase tracking-wider font-semibold">Relevance</p>
                  <span className="text-sm font-bold font-mono" style={{ color: relColor }}>{relScore}/10</span>
                </div>
                <ScoreBar value={relScore} color={relColor} />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-[rgba(255,255,255,0.4)] text-xs uppercase tracking-wider font-semibold">Urgency</p>
                  <span className="text-sm font-bold font-mono" style={{ color: urgColor }}>{urgScore}/10</span>
                </div>
                <ScoreBar value={urgScore} color={urgColor} />
              </div>
            </div>
            {deal.confidence && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[rgba(255,255,255,0.3)] text-xs">AI Confidence:</span>
                <span className="text-[rgba(255,255,255,0.6)] text-xs font-medium">{deal.confidence}</span>
              </div>
            )}
          </div>

          {/* Deal signals */}
          <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.05)]">
            <p className="text-[rgba(255,255,255,0.4)] text-xs uppercase tracking-wider font-semibold mb-3">
              Deal Signals
            </p>
            <div className="grid grid-cols-2 gap-2">
              <SignalChip label="Stage" value={deal.stage} active={!!deal.stage} />
              <SignalChip label="Sector" value={deal.sector} active={!!deal.sector} />
              <SignalChip label="Geography" value={deal.geography} active={!!deal.geography} />
              <SignalChip label="Check Size" value={deal.check_size_requested} active={!!deal.check_size_requested} />
              <SignalChip label="Deck" value={deal.deck_attached ? 'Attached' : 'None'} active={deal.deck_attached} />
              <SignalChip label="Traction" value={deal.traction_mentioned ? 'Mentioned' : 'None'} active={deal.traction_mentioned} />
            </div>
            {deal.intro_source && (
              <div className="mt-2">
                <SignalChip label="Intro via" value={deal.intro_source} active={true} activeColor="#4da6ff" />
              </div>
            )}
            {deal.warm_or_cold && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[rgba(255,255,255,0.3)] text-xs">Outreach:</span>
                <span className="text-xs font-medium" style={{
                  color: deal.warm_or_cold === 'Warm' ? '#3dd68c' : deal.warm_or_cold === 'Cold' ? '#f5a623' : 'rgba(255,255,255,0.4)',
                }}>{deal.warm_or_cold}</span>
              </div>
            )}
          </div>

          {/* Tags */}
          {deal.tags && deal.tags.length > 0 && (
            <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.05)]">
              <p className="text-[rgba(255,255,255,0.4)] text-xs uppercase tracking-wider font-semibold mb-2">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {deal.tags.map((tag) => (
                  <span key={tag} className="px-2 py-0.5 rounded-md text-xs font-mono"
                    style={{ background: 'rgba(124,109,250,0.08)', border: '1px solid rgba(124,109,250,0.2)', color: 'rgba(255,255,255,0.6)' }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Notes (solo users only — fund members get CommentThread) */}
          {!inFund && (
          <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.05)]">
            <div className="flex items-center gap-2 mb-2">
              <FileText size={13} className="text-[rgba(255,255,255,0.3)]" />
              <p className="text-[rgba(255,255,255,0.4)] text-xs uppercase tracking-wider font-semibold flex-1">
                Notes
              </p>
              {notesSaved && (
                <span className="text-[#3dd68c] text-xs flex items-center gap-1">
                  <Check size={11} /> Saved
                </span>
              )}
            </div>
            <textarea
              data-testid="deal-notes-input"
              rows={3}
              placeholder="Add your notes, next steps, or follow-up reminders..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleSaveNotes}
              className="w-full bg-[#0c0c12] border border-[rgba(255,255,255,0.07)] rounded-lg px-3 py-2.5 text-xs text-[rgba(255,255,255,0.75)] placeholder-[rgba(255,255,255,0.2)] focus:outline-none focus:border-[#7c6dfa] transition-colors resize-none leading-relaxed"
            />
          </div>
          )}

          {deal.next_action && (
            <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.05)]">
              <p className="text-[rgba(255,255,255,0.4)] text-xs uppercase tracking-wider font-semibold mb-2">
                Recommended Action
              </p>
              <div className="flex items-center gap-2 bg-[#0c0c12] border border-[rgba(255,255,255,0.07)] rounded-lg px-3 py-2">
                <ChevronRight size={12} className="text-[#7c6dfa]" />
                <span className="text-white text-sm font-medium">{deal.next_action}</span>
              </div>
            </div>
          )}

          {/* ── One-click Actions ── */}
          <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.05)]">
            <p className="text-[rgba(255,255,255,0.4)] text-xs uppercase tracking-wider font-semibold mb-3">
              Send Email
            </p>
            <div className="space-y-2">
              <button
                data-testid="action-reject-btn"
                onClick={() => setActionModal('reject')}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
                style={{ background: 'rgba(240,82,82,0.08)', border: '1px solid rgba(240,82,82,0.25)', color: '#f05252' }}
              >
                <XCircle size={14} />
                Decline — Send Rejection
              </button>
              <button
                data-testid="action-request-info-btn"
                onClick={() => setActionModal('request_info')}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
                style={{ background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.25)', color: '#f5a623' }}
              >
                <MessageSquare size={14} />
                Request More Information
              </button>
              <button
                data-testid="action-forward-btn"
                onClick={() => setActionModal('forward_partner')}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
                style={{ background: 'rgba(77,166,255,0.08)', border: '1px solid rgba(77,166,255,0.25)', color: '#4da6ff' }}
              >
                <Share2 size={14} />
                Forward to Partner
              </button>
            </div>
          </div>

          {/* ── Categorize Deal (also saves contact) ── */}
          <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.05)] space-y-2">
            <p className="text-[rgba(255,255,255,0.4)] text-xs uppercase tracking-wider font-semibold mb-3">
              Categorize Deal
            </p>
            {/* Add to Pipeline — also creates/updates contact */}
            <button
              data-testid="action-add-pipeline"
              disabled={saving === 'pipeline'}
              onClick={async () => {
                if (saving === 'pipeline') return;
                setSaving('pipeline');
                try {
                  console.log('[Contact] Add to Pipeline triggered for:', deal.sender_email, 'deal:', deal.id);
                  await updateDeal(deal.id, { status: 'Pipeline' });
                  onDealUpdated({ ...deal, status: 'Pipeline' });
                  const res = await upsertContact(deal, 'In Pipeline');
                  console.log('[Contact] Upsert result:', res);
                  if (res?.returning) toast.info(`Returning founder — ${res.name || 'Contact'} updated`);
                  else toast.success(`Added to Pipeline · Contact saved`);
                } catch (e) {
                  console.error('[Contact] Add to Pipeline error:', e);
                  toast.error('Action failed — check console');
                }
                setSaving(null);
              }}
              className="w-full flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg transition-all disabled:opacity-40"
              style={
                normalizeStatus(deal.status) === 'Pipeline'
                  ? { background: 'rgba(124,109,250,0.2)', border: '1px solid rgba(124,109,250,0.5)', color: '#a89cf7' }
                  : { background: 'rgba(124,109,250,0.08)', border: '1px solid rgba(124,109,250,0.25)', color: '#7c6dfa' }
              }
            >
              <UserPlus size={14} />
              {saving === 'pipeline' ? 'Saving…' : normalizeStatus(deal.status) === 'Pipeline' ? '✓ In Pipeline' : 'Add to Pipeline'}
            </button>
            {/* Save for Review — also creates/updates contact */}
            <button
              data-testid="action-mark-reviewed"
              disabled={saving === 'reviewed'}
              onClick={async () => {
                if (saving === 'reviewed') return;
                setSaving('reviewed');
                try {
                  console.log('[Contact] Save for Review triggered for:', deal.sender_email, 'deal:', deal.id);
                  await updateDeal(deal.id, { status: 'In Review' });
                  onDealUpdated({ ...deal, status: 'In Review' });
                  const res = await upsertContact(deal, 'In Review');
                  console.log('[Contact] Upsert result:', res);
                  if (res?.returning) toast.info(`Returning founder — ${res.name || 'Contact'} updated`);
                  else toast.success(`Saved for Review · Contact saved`);
                } catch (e) {
                  console.error('[Contact] Save for Review error:', e);
                  toast.error('Action failed — check console');
                }
                setSaving(null);
              }}
              className="w-full flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg transition-all disabled:opacity-40"
              style={
                normalizeStatus(deal.status) === 'In Review'
                  ? { background: 'rgba(245,166,35,0.18)', border: '1px solid rgba(245,166,35,0.5)', color: '#f5a623' }
                  : { background: 'rgba(245,166,35,0.06)', border: '1px solid rgba(245,166,35,0.2)', color: '#f5a623' }
              }
            >
              <Bookmark size={14} />
              {saving === 'reviewed' ? 'Saving…' : normalizeStatus(deal.status) === 'In Review' ? '✓ In Review' : 'Save for Review'}
            </button>
            {/* Pass */}
            <button
              data-testid="action-pass"
              onClick={() => handleAction('status', 'Passed', 'passed')}
              disabled={saving === 'passed' || normalizeStatus(deal.status) === 'Passed'}
              className="w-full flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg transition-all disabled:opacity-40"
              style={
                normalizeStatus(deal.status) === 'Passed'
                  ? { background: 'rgba(240,82,82,0.15)', border: '1px solid rgba(240,82,82,0.4)', color: '#f05252' }
                  : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }
              }
            >
              <XCircle size={14} />
              {normalizeStatus(deal.status) === 'Passed' ? '✓ Passed' : 'Pass'}
            </button>
            {/* Archive */}
            <button
              data-testid="action-archive"
              onClick={() => handleAction('status', 'Archived', 'archive')}
              disabled={saving === 'archive' || normalizeStatus(deal.status) === 'Archived'}
              className="w-full flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg transition-all disabled:opacity-40"
              style={
                normalizeStatus(deal.status) === 'Archived'
                  ? { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.6)' }
                  : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)' }
              }
            >
              <Archive size={14} />
              {normalizeStatus(deal.status) === 'Archived' ? '✓ Archived' : 'Archive'}
            </button>
            {normalizeStatus(deal.status) === 'Archived' && (
              <button
                data-testid="action-restore"
                onClick={() => handleAction('status', 'New', 'restore')}
                disabled={saving === 'restore'}
                className="w-full flex items-center gap-2 text-xs font-medium px-4 py-2 rounded-lg transition-all"
                style={{ background: 'rgba(124,109,250,0.06)', border: '1px solid rgba(124,109,250,0.15)', color: 'rgba(255,255,255,0.4)' }}
              >
                <Check size={12} /> Restore to Inbox
              </button>
            )}
            {normalizeStatus(deal.status) === 'Passed' && (
              <button
                data-testid="action-reconsider"
                onClick={() => handleAction('status', 'In Review', 'reconsider')}
                disabled={saving === 'reconsider'}
                className="w-full flex items-center gap-2 text-xs font-medium px-4 py-2 rounded-lg transition-all"
                style={{ background: 'rgba(245,166,35,0.06)', border: '1px solid rgba(245,166,35,0.15)', color: 'rgba(255,255,255,0.4)' }}
              >
                <Check size={12} /> Reconsider — move to In Review
              </button>
            )}

            {/* Remove from dashboard */}
            {onDelete && (
              <button
                data-testid="action-delete-deal"
                onClick={async () => {
                  if (!window.confirm('Remove this email from your dashboard? This cannot be undone.')) return;
                  await deleteDeal(deal.id);
                  onDelete(deal.id);
                }}
                className="w-full flex items-center gap-2 text-xs font-medium px-4 py-2 rounded-lg transition-all mt-2"
                style={{ background: 'rgba(240,82,82,0.05)', border: '1px solid rgba(240,82,82,0.12)', color: 'rgba(240,82,82,0.5)' }}
              >
                <Trash2 size={12} /> Remove from dashboard
              </button>
            )}
          </div>

          {/* ── Voting + Comments (fund only) / Notes (solo) ── */}
          {inFund ? (
            <>
              <VotingSection dealId={deal.id} />
              <CommentThread dealId={deal.id} fundInfo={fundInfo} userId={userId} />
            </>
          ) : (
            /* solo notes */
            <div data-testid="notes-section" />
          )}

          {/* Open in Gmail */}
          {deal.gmail_thread_link && deal.gmail_thread_link !== '#' && (
            <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.05)]">
              <a data-testid="open-gmail-link" href={deal.gmail_thread_link}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-[rgba(255,255,255,0.4)] hover:text-[#4da6ff] text-sm transition-colors">
                <ExternalLink size={13} />
                Open in Gmail
              </a>
            </div>
          )}

          {/* Raw preview */}
          {deal.body_preview && (
            <div className="px-5 py-4">
              <p className="text-[rgba(255,255,255,0.4)] text-xs uppercase tracking-wider font-semibold mb-2">
                Email Preview
              </p>
              <div className="bg-[#0c0c12] border border-[rgba(255,255,255,0.05)] rounded-lg p-3">
                <p className="text-[rgba(255,255,255,0.35)] text-xs font-mono leading-relaxed whitespace-pre-wrap break-words">
                  {deal.body_preview}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Modal */}
      {actionModal && (
        <ActionModal
          deal={deal}
          actionType={actionModal}
          onClose={() => setActionModal(null)}
          onSent={handleSent}
        />
      )}
    </>
  );
}
