import { useState, useEffect, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { updateDealStage, assignDeal } from '../../lib/api';
import { toast } from '../ui/sonner';
import { MemberAvatar } from '../MemberAvatar';

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

export function DealStageSection({ deal, members, userId, onDealUpdated, showAssignment = false }) {
  const [dealStage, setDealStage] = useState(deal.deal_stage || 'Inbound');
  const [assignedTo, setAssignedTo] = useState(deal.assigned_to || '');
  const [assignDropdownOpen, setAssignDropdownOpen] = useState(false);
  const [passReason, setPassReason] = useState(deal.pass_reason || '');
  const [watchlistDate, setWatchlistDate] = useState(
    deal.watchlist_revisit_date ? deal.watchlist_revisit_date.slice(0, 10) : ''
  );

  // Reset local state when the selected deal changes
  useEffect(() => {
    setDealStage(deal.deal_stage || 'Inbound');
    setAssignedTo(deal.assigned_to || '');
    setPassReason(deal.pass_reason || '');
    setWatchlistDate(deal.watchlist_revisit_date ? deal.watchlist_revisit_date.slice(0, 10) : '');
  }, [deal.id]); // eslint-disable-line react-hooks/exhaustive-deps -- intentional: reset only on deal change

  const handleStageChange = useCallback(async (stage, extra = {}) => {
    setDealStage(stage);
    try {
      await updateDealStage(deal.id, stage, extra);
      onDealUpdated({ ...deal, deal_stage: stage, ...extra });
    } catch {
      toast.error('Failed to update stage');
    }
  }, [deal, onDealUpdated]);

  const handleAssign = useCallback(async (memberId) => {
    setAssignedTo(memberId);
    setAssignDropdownOpen(false);
    try {
      await assignDeal(deal.id, { assigned_to: memberId || null });
      onDealUpdated({ ...deal, assigned_to: memberId || null });
    } catch {
      toast.error('Failed to assign deal');
    }
  }, [deal, onDealUpdated]);

  const StageButton = ({ stage }) => {
    const active = dealStage === stage;
    const [bg, color] = STAGE_COLORS[stage];
    return (
      <button
        data-testid={`stage-btn-${stage.toLowerCase().replace(/ /g, '-')}`}
        onClick={() => handleStageChange(stage)}
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
        {stage}
      </button>
    );
  };

  return (
    <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.05)]" data-testid="deal-stage-section">
      <p className="text-[rgba(255,255,255,0.4)] text-xs uppercase tracking-wider font-semibold mb-2.5">
        Deal Stage
      </p>

      <p className="text-[rgba(255,255,255,0.25)] text-xs mb-1.5 font-mono">Progress</p>
      <div className="flex items-center gap-1 flex-wrap mb-3">
        {ACTIVE_STAGES.map((s) => <StageButton key={s} stage={s} />)}
      </div>

      <p className="text-[rgba(255,255,255,0.25)] text-xs mb-1.5 font-mono">Exit State</p>
      <div className="flex items-center gap-1 flex-wrap mb-3">
        {EXIT_STAGES.map((s) => <StageButton key={s} stage={s} />)}
      </div>

      {dealStage === 'Passed' && (
        <div className="mb-3">
          <p className="text-[rgba(255,255,255,0.3)] text-xs mb-1.5">Pass reason</p>
          <input
            data-testid="pass-reason-input"
            type="text"
            placeholder="e.g. Team not right, Too early, Not in thesis..."
            value={passReason}
            onChange={(e) => setPassReason(e.target.value)}
            onBlur={() => {
              if (passReason !== (deal.pass_reason || '')) {
                handleStageChange('Passed', { pass_reason: passReason });
              }
            }}
            className="w-full bg-[#0c0c12] border border-[rgba(240,82,82,0.25)] rounded-lg px-3 py-2 text-xs text-white placeholder-[rgba(255,255,255,0.2)] focus:outline-none focus:border-[#f05252] transition-colors"
          />
        </div>
      )}

      {dealStage === 'Watch List' && (
        <div className="mb-3">
          <p className="text-[rgba(255,255,255,0.3)] text-xs mb-1.5">Revisit date</p>
          <input
            data-testid="watchlist-date-input"
            type="date"
            value={watchlistDate}
            onChange={(e) => setWatchlistDate(e.target.value)}
            onBlur={() => {
              if (watchlistDate) {
                handleStageChange('Watch List', { watchlist_revisit_date: watchlistDate });
              }
            }}
            className="w-full bg-[#0c0c12] border border-[rgba(251,191,36,0.25)] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#fbbf24] transition-colors"
            style={{ colorScheme: 'dark' }}
          />
        </div>
      )}

      {showAssignment && (
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
              <MemberAvatar
                name={members.find((m) => m.user_id === assignedTo)?.display_name || ''}
                size={20}
              />
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
          <div
            className="absolute top-full left-0 mt-1 w-full rounded-lg overflow-hidden z-50"
            style={{ background: '#1a1a26', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
          >
            <button
              onClick={() => handleAssign('')}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 text-left transition-colors"
            >
              <span className="text-[rgba(255,255,255,0.4)] text-xs">Unassigned</span>
            </button>
            {members.map((m) => (
              <button
                key={m.user_id}
                onClick={() => handleAssign(m.user_id)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 text-left transition-colors"
              >
                <MemberAvatar name={m.display_name} size={20} />
                <span className="text-white text-xs">{m.display_name}</span>
                {m.user_id === userId && (
                  <span className="text-[rgba(255,255,255,0.25)] text-xs ml-auto">You</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
