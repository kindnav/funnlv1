import { useState } from 'react';
import { X, ExternalLink, Check, Archive, Plus, ChevronRight } from 'lucide-react';
import { updateDeal } from '../lib/api';

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
      <div
        key={i}
        className="h-1.5 flex-1 rounded-sm transition-all"
        style={{ background: i < value ? color : 'rgba(255,255,255,0.06)' }}
      />
    ))}
  </div>
);

const SignalChip = ({ label, value, active, activeColor = '#3dd68c' }) => (
  <div className="flex items-center gap-2 bg-[#0c0c12] border border-[rgba(255,255,255,0.06)] rounded-lg px-3 py-2">
    <div
      className="w-1.5 h-1.5 rounded-full shrink-0"
      style={{ background: active ? activeColor : 'rgba(255,255,255,0.2)' }}
    />
    <span className="text-[rgba(255,255,255,0.4)] text-xs">{label}</span>
    <span className="text-white text-xs font-medium ml-auto">{value || '—'}</span>
  </div>
);

export default function DetailPanel({ deal, onClose, onDealUpdated }) {
  const [saving, setSaving] = useState(null);

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

  return (
    <div
      data-testid="detail-panel"
      className="w-[440px] shrink-0 h-full border-l border-[rgba(255,255,255,0.07)] bg-[#13131c] flex flex-col overflow-hidden"
      style={{ boxShadow: '-8px 0 32px rgba(0,0,0,0.4)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.07)] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getCatStyle(deal.category)}`}
            style={{ whiteSpace: 'nowrap' }}
          >
            {deal.category}
          </span>
        </div>
        <button
          data-testid="close-detail-panel"
          onClick={onClose}
          className="text-[rgba(255,255,255,0.3)] hover:text-white transition-colors ml-2 shrink-0"
        >
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

        {/* AI Summary */}
        {deal.summary && (
          <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.05)]">
            <p className="text-[rgba(255,255,255,0.4)] text-xs uppercase tracking-wider font-semibold mb-2">
              AI Summary
            </p>
            <div
              className="rounded-lg p-3 text-sm text-[rgba(255,255,255,0.8)] leading-relaxed"
              style={{
                background: 'rgba(124,109,250,0.06)',
                border: '1px solid rgba(124,109,250,0.15)',
              }}
            >
              {deal.summary}
            </div>
          </div>
        )}

        {/* Scores */}
        <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.05)]">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-[rgba(255,255,255,0.4)] text-xs uppercase tracking-wider font-semibold">
                  Relevance
                </p>
                <span className="text-sm font-bold font-mono" style={{ color: relColor }}>
                  {relScore}/10
                </span>
              </div>
              <ScoreBar value={relScore} color={relColor} />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <p className="text-[rgba(255,255,255,0.4)] text-xs uppercase tracking-wider font-semibold">
                  Urgency
                </p>
                <span className="text-sm font-bold font-mono" style={{ color: urgColor }}>
                  {urgScore}/10
                </span>
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
            <SignalChip
              label="Deck"
              value={deal.deck_attached ? 'Attached' : 'None'}
              active={deal.deck_attached}
              activeColor="#3dd68c"
            />
            <SignalChip
              label="Traction"
              value={deal.traction_mentioned ? 'Mentioned' : 'None'}
              active={deal.traction_mentioned}
              activeColor="#3dd68c"
            />
          </div>
          {deal.intro_source && (
            <div className="mt-2">
              <SignalChip label="Intro via" value={deal.intro_source} active={true} activeColor="#4da6ff" />
            </div>
          )}
          {deal.warm_or_cold && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[rgba(255,255,255,0.3)] text-xs">Outreach:</span>
              <span
                className="text-xs font-medium"
                style={{
                  color:
                    deal.warm_or_cold === 'Warm'
                      ? '#3dd68c'
                      : deal.warm_or_cold === 'Cold'
                      ? '#f5a623'
                      : 'rgba(255,255,255,0.4)',
                }}
              >
                {deal.warm_or_cold}
              </span>
            </div>
          )}
        </div>

        {/* Tags */}
        {deal.tags && deal.tags.length > 0 && (
          <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.05)]">
            <p className="text-[rgba(255,255,255,0.4)] text-xs uppercase tracking-wider font-semibold mb-2">
              Tags
            </p>
            <div className="flex flex-wrap gap-1.5">
              {deal.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-md text-xs font-mono"
                  style={{
                    background: 'rgba(124,109,250,0.08)',
                    border: '1px solid rgba(124,109,250,0.2)',
                    color: 'rgba(255,255,255,0.6)',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Next action recommendation */}
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

        {/* Action buttons */}
        <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.05)] space-y-2">
          <p className="text-[rgba(255,255,255,0.4)] text-xs uppercase tracking-wider font-semibold mb-3">
            Actions
          </p>
          <button
            data-testid="action-mark-reviewed"
            onClick={() => handleAction('status', 'Reviewed', 'reviewed')}
            disabled={saving === 'reviewed' || deal.status === 'Reviewed'}
            className="w-full flex items-center gap-2 bg-[#3dd68c]/10 hover:bg-[#3dd68c]/15 border border-[#3dd68c]/20 text-[#3dd68c] text-sm font-medium px-4 py-2.5 rounded-lg transition-all disabled:opacity-40"
          >
            <Check size={14} />
            {deal.status === 'Reviewed' ? 'Already Reviewed' : 'Mark as Reviewed'}
          </button>
          <button
            data-testid="action-add-pipeline"
            onClick={() => handleAction('next_action', 'Add to pipeline', 'pipeline')}
            disabled={saving === 'pipeline'}
            className="w-full flex items-center gap-2 bg-[#7c6dfa]/10 hover:bg-[#7c6dfa]/15 border border-[#7c6dfa]/20 text-[#7c6dfa] text-sm font-medium px-4 py-2.5 rounded-lg transition-all disabled:opacity-40"
          >
            <Plus size={14} />
            Add to Pipeline
          </button>
          <button
            data-testid="action-archive"
            onClick={() => handleAction('status', 'Archived', 'archive')}
            disabled={saving === 'archive' || deal.status === 'Archived'}
            className="w-full flex items-center gap-2 bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.07)] text-[rgba(255,255,255,0.5)] hover:text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-all disabled:opacity-40"
          >
            <Archive size={14} />
            {deal.status === 'Archived' ? 'Already Archived' : 'Archive'}
          </button>
        </div>

        {/* Open in Gmail */}
        {deal.gmail_thread_link && deal.gmail_thread_link !== '#' && (
          <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.05)]">
            <a
              data-testid="open-gmail-link"
              href={deal.gmail_thread_link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[rgba(255,255,255,0.4)] hover:text-[#4da6ff] text-sm transition-colors"
            >
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
  );
}
