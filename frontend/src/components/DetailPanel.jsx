import { useState, useEffect } from 'react';
import {
  X, ExternalLink, Check, ChevronRight, XCircle, Trash2,
  MessageSquare, Share2, Target, TrendingUp, TrendingDown, FileText, Calendar, Phone, MoreHorizontal,
} from 'lucide-react';
import { updateDeal, deleteDeal, generateCallPrep } from '../lib/api';
import CallPrepModal from './CallPrepModal';
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

// ── Section label — Image 2 pattern ──────────────────────────────────────────
const SectionLabel = ({ children }) => (
  <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>
    {children}
  </p>
);

const ScoreBar = ({ value, color }) => (
  <div className="flex gap-0.5 mt-1.5">
    {Array.from({ length: 10 }, (_, i) => (
      <div key={i} className="h-1.5 flex-1 rounded-sm transition-all"
        style={{ background: i < value ? color : 'rgba(255,255,255,0.06)' }} />
    ))}
  </div>
);

const SignalChip = ({ label, value, active, activeColor = '#3dd68c' }) => (
  <div
    className="flex items-center gap-2 rounded-lg px-3 py-2"
    style={{ background: '#080810', border: '1px solid rgba(255,255,255,0.06)' }}
  >
    <div className="w-1.5 h-1.5 rounded-full shrink-0"
      style={{ background: active ? activeColor : 'rgba(255,255,255,0.2)' }} />
    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</span>
    <span className="text-white text-xs font-medium ml-auto">{value || '—'}</span>
  </div>
);

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

// ── Section wrapper ───────────────────────────────────────────────────────────
const Section = ({ children, style }) => (
  <div
    className="px-5 py-4"
    style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', ...style }}
  >
    {children}
  </div>
);

export default function DetailPanel({ deal, onClose, onDealUpdated, onDelete, fundInfo, userId }) {
  const [saving, setSaving] = useState(null);
  const [actionModal, setActionModal] = useState(null);
  const [notes, setNotes] = useState(deal.notes || '');
  const [notesSaved, setNotesSaved] = useState(false);
  const [followUpDate, setFollowUpDate] = useState(deal.follow_up_date?.slice(0, 10) || '');
  const [showCallPrep, setShowCallPrep] = useState(false);
  const [callPrepBrief, setCallPrepBrief] = useState(null);
  const [callPrepLoading, setCallPrepLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const members = fundInfo?.members || [];
  const inFund = !!fundInfo?.fund;

  useEffect(() => {
    setNotes(deal.notes || '');
    setFollowUpDate(deal.follow_up_date?.slice(0, 10) || '');
  }, [deal.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCallPrep = async () => {
    setCallPrepBrief(null);
    setCallPrepLoading(true);
    setShowCallPrep(true);
    try {
      const res = await generateCallPrep(deal.id);
      setCallPrepBrief(res?.brief || '');
    } finally {
      setCallPrepLoading(false);
    }
  };

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
  };

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

  let outreachColor;
  if (deal.warm_or_cold === 'Warm') outreachColor = '#3dd68c';
  else if (deal.warm_or_cold === 'Cold') outreachColor = '#f5a623';
  else outreachColor = 'rgba(255,255,255,0.4)';

  return (
    <>
      <div
        data-testid="detail-panel"
        className="w-[460px] shrink-0 h-full flex flex-col overflow-hidden"
        style={{
          background: '#131320',
          borderLeft: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '-8px 0 40px rgba(0,0,0,0.4)',
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-5 py-3.5 shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getCatStyle(deal.category)}`}
            style={{ borderRadius: 999 }}>
            {deal.category}
          </span>
          <div className="flex items-center gap-1">
            <button
              data-testid="close-detail-panel"
              onClick={onClose}
              className="flex items-center justify-center transition-all"
              style={{
                width: 30, height: 30, borderRadius: '50%',
                color: 'rgba(255,255,255,0.35)',
                background: 'transparent', border: 'none', cursor: 'pointer',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; }}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* ── Company + sender ──────────────────────────────────────── */}
          <Section>
            {deal.company_name && (
              <h2 className="text-lg font-bold text-white leading-tight">{deal.company_name}</h2>
            )}
            <div className="mt-1">
              <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>{deal.sender_name}</p>
              {deal.founder_role && (
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{deal.founder_role}</p>
              )}
              <p className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>{deal.sender_email}</p>
            </div>
            <p className="text-xs mt-2 leading-snug" style={{ color: 'rgba(255,255,255,0.5)' }}>{deal.subject}</p>
          </Section>

          {/* ── Deal Stage ────────────────────────────────────────────── */}
          <DealStageSection
            deal={deal}
            members={members}
            userId={userId}
            onDealUpdated={onDealUpdated}
            showAssignment={inFund}
          />

          {/* ── AI Summary — insight line style (Image 2) ────────────── */}
          {deal.summary && (
            <Section>
              <SectionLabel>AI Summary</SectionLabel>
              <div
                className="rounded-xl p-3.5 text-sm leading-relaxed"
                style={{
                  background: 'rgba(124,109,250,0.06)',
                  border: '1px solid rgba(124,109,250,0.15)',
                  borderLeft: '3px solid rgba(124,109,250,0.5)',
                  color: 'rgba(255,255,255,0.8)',
                }}
              >
                {deal.summary}
                <span className="ml-1.5" style={{ color: '#7c6dfa', fontSize: 13 }}>→</span>
              </div>
            </Section>
          )}

          {/* ── Thesis Match ──────────────────────────────────────────── */}
          {hasThesisData && (
            <Section>
              <div className="flex items-center gap-2 mb-3">
                <Target size={13} style={{ color: '#7c6dfa' }} />
                <SectionLabel>Focus Match</SectionLabel>
              </div>
              <div className="flex items-start gap-4">
                <ThesisRing score={deal.thesis_match_score} />
                <div className="flex-1 min-w-0">
                  {deal.match_reasoning && (
                    <p className="text-xs leading-relaxed mb-3" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      {deal.match_reasoning}
                    </p>
                  )}
                  {deal.fit_strengths && deal.fit_strengths.length > 0 && (
                    <div className="mb-2">
                      {deal.fit_strengths.map((s) => (
                        <div key={s} className="flex items-start gap-1.5 mb-1">
                          <TrendingUp size={11} style={{ color: '#3dd68c' }} className="shrink-0 mt-0.5" />
                          <span className="text-xs leading-snug" style={{ color: 'rgba(255,255,255,0.55)' }}>{s}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {deal.fit_weaknesses && deal.fit_weaknesses.length > 0 && (
                    <div>
                      {deal.fit_weaknesses.map((w) => (
                        <div key={w} className="flex items-start gap-1.5 mb-1">
                          <TrendingDown size={11} style={{ color: '#f05252' }} className="shrink-0 mt-0.5" />
                          <span className="text-xs leading-snug" style={{ color: 'rgba(255,255,255,0.4)' }}>{w}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Section>
          )}

          {/* ── Scores ────────────────────────────────────────────────── */}
          <Section>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <SectionLabel>Relevance</SectionLabel>
                  <span className="text-sm font-bold font-mono" style={{ color: relColor }}>{relScore}/10</span>
                </div>
                <ScoreBar value={relScore} color={relColor} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <SectionLabel>Urgency</SectionLabel>
                  <span className="text-sm font-bold font-mono" style={{ color: urgColor }}>{urgScore}/10</span>
                </div>
                <ScoreBar value={urgScore} color={urgColor} />
              </div>
            </div>
            {deal.confidence && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>AI Confidence:</span>
                <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>{deal.confidence}</span>
              </div>
            )}
          </Section>

          {/* ── Deal Signals ──────────────────────────────────────────── */}
          <Section>
            <SectionLabel>Deal Signals</SectionLabel>
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
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Outreach:</span>
                <span className="text-xs font-medium" style={{ color: outreachColor }}>{deal.warm_or_cold}</span>
              </div>
            )}
          </Section>

          {/* ── Tags ──────────────────────────────────────────────────── */}
          {deal.tags && deal.tags.length > 0 && (
            <Section>
              <SectionLabel>Tags</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {deal.tags.map((tag) => (
                  <span key={tag} className="px-2.5 py-1 rounded-full text-xs font-mono"
                    style={{ background: 'rgba(124,109,250,0.08)', border: '1px solid rgba(124,109,250,0.2)', color: 'rgba(255,255,255,0.6)' }}>
                    {tag}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* ── Notes (solo users) ────────────────────────────────────── */}
          {!inFund && (
            <Section>
              <div className="flex items-center gap-2 mb-2">
                <FileText size={13} style={{ color: 'rgba(255,255,255,0.3)' }} />
                <SectionLabel>Notes</SectionLabel>
                {notesSaved && (
                  <span className="text-xs flex items-center gap-1 ml-auto" style={{ color: '#3dd68c' }}>
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
                className="w-full rounded-xl px-3 py-2.5 text-xs placeholder-[rgba(255,255,255,0.2)] focus:outline-none transition-colors resize-none leading-relaxed"
                style={{
                  background: '#080810',
                  border: '1px solid rgba(255,255,255,0.07)',
                  color: 'rgba(255,255,255,0.75)',
                }}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(124,109,250,0.5)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.07)'; handleSaveNotes(); }}
              />
            </Section>
          )}

          {/* ── Follow-up date ────────────────────────────────────────── */}
          <Section>
            <div className="flex items-center gap-2 mb-2">
              <Calendar size={13} style={{ color: 'rgba(255,255,255,0.3)' }} />
              <SectionLabel>Follow-up date</SectionLabel>
              {followUpDate && (
                <button
                  onClick={() => { setFollowUpDate(''); handleSaveFollowUpDate(''); }}
                  className="text-xs ml-auto transition-colors"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; }}
                >
                  Clear
                </button>
              )}
            </div>
            <input
              type="date"
              value={followUpDate}
              onChange={(e) => { setFollowUpDate(e.target.value); handleSaveFollowUpDate(e.target.value); }}
              className="w-full rounded-xl px-3 py-2 text-xs focus:outline-none transition-colors"
              style={{
                background: '#080810',
                border: '1px solid rgba(255,255,255,0.07)',
                color: 'rgba(255,255,255,0.75)',
                colorScheme: 'dark',
              }}
              onFocus={(e) => { e.target.style.borderColor = 'rgba(245,158,11,0.5)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.07)'; }}
            />
          </Section>

          {/* ── Recommended Action ────────────────────────────────────── */}
          {deal.next_action && (
            <Section>
              <SectionLabel>Recommended Action</SectionLabel>
              <div
                className="flex items-center gap-2 rounded-xl px-3 py-2.5"
                style={{ background: '#080810', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <ChevronRight size={12} style={{ color: '#7c6dfa' }} />
                <span className="text-white text-sm font-medium">{deal.next_action}</span>
              </div>
            </Section>
          )}

          {/* ── Call Prep ─────────────────────────────────────────────── */}
          {(deal.deal_stage === 'First Look' || deal.deal_stage === 'In Conversation') && (
            <Section>
              <button
                onClick={handleCallPrep}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{ background: 'rgba(77,166,255,0.08)', border: '1px solid rgba(77,166,255,0.25)', color: '#4da6ff' }}
              >
                <Phone size={13} />
                Prep for call
              </button>
            </Section>
          )}

          {/* ── Send Email ────────────────────────────────────────────── */}
          <Section>
            <SectionLabel>Send Email</SectionLabel>
            <div className="space-y-2">
              <button
                data-testid="action-reject-btn"
                onClick={() => setActionModal('reject')}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{ background: 'rgba(240,82,82,0.08)', border: '1px solid rgba(240,82,82,0.25)', color: '#f05252' }}
              >
                <XCircle size={14} />
                Decline — Send Rejection
              </button>
              <button
                data-testid="action-request-info-btn"
                onClick={() => setActionModal('request_info')}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{ background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.25)', color: '#f5a623' }}
              >
                <MessageSquare size={14} />
                Request More Information
              </button>
              <button
                data-testid="action-forward-btn"
                onClick={() => setActionModal('forward_partner')}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{ background: 'rgba(77,166,255,0.08)', border: '1px solid rgba(77,166,255,0.25)', color: '#4da6ff' }}
              >
                <Share2 size={14} />
                Forward to Partner
              </button>
            </div>
          </Section>

          {/* ── Remove deal ───────────────────────────────────────────── */}
          <Section>
            {onDelete && !confirmDelete && (
              <button
                data-testid="action-delete-deal"
                onClick={() => setConfirmDelete(true)}
                className="w-full flex items-center gap-2 text-xs font-medium px-4 py-2 rounded-xl transition-all"
                style={{ background: 'rgba(240,82,82,0.05)', border: '1px solid rgba(240,82,82,0.12)', color: 'rgba(240,82,82,0.5)' }}
              >
                <Trash2 size={12} />
                Remove from dashboard
              </button>
            )}
            {onDelete && confirmDelete && (
              <div className="flex gap-2">
                <button
                  data-testid="action-confirm-delete"
                  onClick={async () => { await deleteDeal(deal.id); onDelete(deal.id); }}
                  className="flex-1 text-xs px-3 py-1.5 rounded-xl font-medium"
                  style={{ background: 'rgba(240,82,82,0.15)', color: '#f05252', border: '1px solid rgba(240,82,82,0.3)' }}
                >
                  Confirm remove
                </button>
                <button
                  data-testid="action-cancel-delete"
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 text-xs px-3 py-1.5 rounded-xl font-medium"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  Cancel
                </button>
              </div>
            )}
          </Section>

          {/* ── Voting + Comments (fund) / Notes placeholder (solo) ───── */}
          {inFund ? (
            <>
              <VotingSection dealId={deal.id} />
              <CommentThread dealId={deal.id} fundInfo={fundInfo} userId={userId} />
            </>
          ) : (
            <div data-testid="notes-section" />
          )}

          {/* ── Open in Gmail ─────────────────────────────────────────── */}
          {deal.gmail_thread_link && deal.gmail_thread_link !== '#' && (
            <Section>
              <a
                data-testid="open-gmail-link"
                href={deal.gmail_thread_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm transition-colors"
                style={{ color: 'rgba(255,255,255,0.4)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#4da6ff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
              >
                <ExternalLink size={13} />
                Open in Gmail
              </a>
            </Section>
          )}

          {/* ── Email Preview ─────────────────────────────────────────── */}
          {deal.body_preview && (
            <Section style={{ borderBottom: 'none' }}>
              <SectionLabel>Email Preview</SectionLabel>
              <div
                className="rounded-xl p-3"
                style={{ background: '#080810', border: '1px solid rgba(255,255,255,0.05)' }}
              >
                <p className="text-xs font-mono leading-relaxed whitespace-pre-wrap break-words"
                  style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {deal.body_preview}
                </p>
              </div>
            </Section>
          )}
        </div>
      </div>

      {actionModal && (
        <ActionModal
          deal={deal}
          actionType={actionModal}
          onClose={() => setActionModal(null)}
          onSent={handleSent}
        />
      )}
      {showCallPrep && (
        <CallPrepModal
          deal={deal}
          brief={callPrepBrief}
          loading={callPrepLoading}
          onClose={() => { setShowCallPrep(false); setCallPrepBrief(null); }}
        />
      )}
    </>
  );
}
