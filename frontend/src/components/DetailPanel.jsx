import { useState, useEffect } from 'react';
import {
  X, ExternalLink, Check, ChevronRight, XCircle, Trash2,
  MessageSquare, Share2, Target, TrendingUp, TrendingDown, FileText, RefreshCw, Calendar,
} from 'lucide-react';
import { updateDeal, deleteDeal } from '../lib/api';
import { toast } from '../components/ui/sonner';
import ActionModal from './ActionModal';
import { VotingSection } from './VotingSection';
import { CommentThread } from './CommentThread';
import { DealStageSection } from './detail/DealStageSection';

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
const getThresholdColor = (score, high = 70, mid = 45) => {
  if (score >= high) return '#3dd68c';
  if (score >= mid) return '#f5a623';
  return '#f05252';
};

const ThesisRing = ({ score }) => {
  const pct = Math.min(100, Math.max(0, score || 0));
  const color = getThresholdColor(pct, 70, 45);
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

export default function DetailPanel({ deal, onClose, onDealUpdated, onDelete, fundInfo, userId }) {
  const [saving, setSaving] = useState(null);
  const [actionModal, setActionModal] = useState(null);
  const [notes, setNotes] = useState(deal.notes || '');
  const [notesSaved, setNotesSaved] = useState(false);
  const [followUpDate, setFollowUpDate] = useState(deal.follow_up_date?.slice(0, 10) || '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const members = fundInfo?.members || [];
  const inFund = !!fundInfo?.fund;

  // Reset notes and follow-up date when the selected deal changes
  useEffect(() => {
    setNotes(deal.notes || '');
    setFollowUpDate(deal.follow_up_date?.slice(0, 10) || '');
  }, [deal.id]); // eslint-disable-line react-hooks/exhaustive-deps -- intentional: reset only on deal change

  const handleSaveFollowUpDate = async (value) => {
    const date = value || null;
    await updateDeal(deal.id, { follow_up_date: date });
    onDealUpdated({ ...deal, follow_up_date: date });
  };

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
  const relColor = getThresholdColor(relScore, 7, 4);
  const urgColor = urgScore >= 7 ? '#f05252' : urgScore >= 4 ? '#f5a623' : '#3dd68c';

  const handleSent = (actionType) => {
    const stageMap = {
      reject: 'Passed',
      request_info: 'In Conversation',
      forward_partner: 'In Conversation',
    };
    const newStage = stageMap[actionType] || 'In Conversation';
    onDealUpdated({ ...deal, deal_stage: newStage });
  };

  const hasThesisData = deal.thesis_match_score != null;

  // Outreach warm/cold display color
  let outreachColor;
  if (deal.warm_or_cold === 'Warm') outreachColor = '#3dd68c';
  else if (deal.warm_or_cold === 'Cold') outreachColor = '#f5a623';
  else outreachColor = 'rgba(255,255,255,0.4)';

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

          {/* ── Deal Stage (all users) ── */}
          <DealStageSection
            deal={deal}
            members={members}
            userId={userId}
            onDealUpdated={onDealUpdated}
            showAssignment={inFund}
          />

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
                <span className="text-xs font-medium" style={{ color: outreachColor }}>{deal.warm_or_cold}</span>
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

          {/* Follow-up date */}
          <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.05)]">
            <div className="flex items-center gap-2 mb-2">
              <Calendar size={13} className="text-[rgba(255,255,255,0.3)]" />
              <p className="text-[rgba(255,255,255,0.4)] text-xs uppercase tracking-wider font-semibold flex-1">
                Follow-up date
              </p>
              {followUpDate && (
                <button
                  onClick={() => { setFollowUpDate(''); handleSaveFollowUpDate(''); }}
                  className="text-xs text-[rgba(255,255,255,0.3)] hover:text-[rgba(255,255,255,0.6)] transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            <input
              type="date"
              value={followUpDate}
              onChange={(e) => { setFollowUpDate(e.target.value); handleSaveFollowUpDate(e.target.value); }}
              className="w-full bg-[#0c0c12] border border-[rgba(255,255,255,0.07)] rounded-lg px-3 py-2 text-xs text-[rgba(255,255,255,0.75)] focus:outline-none focus:border-[#f59e0b] transition-colors"
              style={{ colorScheme: 'dark' }}
            />
          </div>

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

          {/* ── Remove deal ── */}
          <div className="px-5 py-3 border-b border-[rgba(255,255,255,0.05)]">
            {onDelete && !confirmDelete && (
              <button
                data-testid="action-delete-deal"
                onClick={() => setConfirmDelete(true)}
                className="w-full flex items-center gap-2 text-xs font-medium px-4 py-2 rounded-lg transition-all"
                style={{
                  background: 'rgba(240,82,82,0.05)',
                  border: '1px solid rgba(240,82,82,0.12)',
                  color: 'rgba(240,82,82,0.5)',
                }}
              >
                <Trash2 size={12} />
                Remove from dashboard
              </button>
            )}
            {onDelete && confirmDelete && (
              <div className="flex gap-2">
                <button
                  data-testid="action-confirm-delete"
                  onClick={async () => {
                    await deleteDeal(deal.id);
                    onDelete(deal.id);
                  }}
                  className="flex-1 text-xs px-3 py-1.5 rounded-lg font-medium"
                  style={{
                    background: 'rgba(240,82,82,0.15)',
                    color: '#f05252',
                    border: '1px solid rgba(240,82,82,0.3)',
                  }}
                >
                  Confirm remove
                </button>
                <button
                  data-testid="action-cancel-delete"
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 text-xs px-3 py-1.5 rounded-lg font-medium"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    color: 'rgba(255,255,255,0.4)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  Cancel
                </button>
              </div>
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
